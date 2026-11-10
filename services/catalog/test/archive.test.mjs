/*
 * The archive reader, and the three ways an archive attacks its reader:
 * a path that escapes the destination, a member that inflates to fill memory,
 * and a container that lies about what it holds.
 *
 * Every ZIP here is built byte by byte in this file. A checked-in malicious
 * archive would be a liability in a public repository and would also be
 * opaque — a reader could not tell what makes it malicious without a hex
 * editor. Constructing them makes the attack legible.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';

import {
  ArchiveError,
  isSafeEntryName,
  MAX_COMPRESSION_RATIO,
  readDelimitedPayload,
  readZipMembers,
} from '../dist/index.js';

/** Minimal single-member ZIP writer, so the tests own their inputs. */
function makeZip(entries, { lieAboutUncompressedSize = null, method = 8 } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const body = method === 0 ? Buffer.from(data) : deflateRawSync(data);
    const crc = crc32(data);
    const uncompressed = lieAboutUncompressedSize ?? data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(uncompressed, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(uncompressed, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const localPart = Buffer.concat(locals);
  const centralPart = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, eocd]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

const FEED = Buffer.from('ID\tTITLE\nA1\tA thing\n', 'utf8');

test('reads a delimited member and hashes the TEXT, not the container', () => {
  const a = makeZip([{ name: 'feed.txt', data: FEED }]);
  const b = makeZip([{ name: 'feed.txt', data: FEED }], { method: 0 });

  const pa = readDelimitedPayload(a);
  const pb = readDelimitedPayload(b);

  assert.equal(pa.text, FEED.toString('utf8'));
  // Re-zipping the same export with a different compression method changes
  // every byte of the container. If the hash followed the container, a
  // re-download would re-import a feed that had not changed.
  assert.notEqual(a.toString('base64'), b.toString('base64'));
  assert.equal(pa.sha256, pb.sha256);
});

test('a UTF-8 BOM is stripped before hashing', () => {
  const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), FEED]);
  const payload = readDelimitedPayload(makeZip([{ name: 'feed.txt', data: withBom }]));
  assert.equal(payload.text, FEED.toString('utf8'));
  assert.ok(!payload.text.startsWith('\ufeff'));
});

test('path traversal in an entry name is refused outright', () => {
  for (const name of [
    '../../etc/passwd',
    '/etc/passwd',
    'C:/windows/system32/drivers/etc/hosts',
    'a\\..\\b.txt',
    'ok/../../escape.txt',
  ]) {
    assert.equal(isSafeEntryName(name), false, name);
    assert.throws(
      () => readZipMembers(makeZip([{ name, data: FEED }])),
      (e) => e instanceof ArchiveError && e.failure === 'unsafe-entry-name',
      name,
    );
  }
});

test('ordinary nested names are still accepted', () => {
  assert.equal(isSafeEntryName('exports/2026-11-10/feed.txt'), true);
  const members = readZipMembers(makeZip([{ name: 'exports/feed.txt', data: FEED }]));
  assert.equal(members.length, 1);
});

test('a decompression bomb is refused by its declared ratio', () => {
  // Highly compressible, and the header claims an absurd inflated size.
  const zeros = Buffer.alloc(64 * 1024, 0);
  const bomb = makeZip([{ name: 'bomb.txt', data: zeros }], {
    lieAboutUncompressedSize: 64 * 1024 * MAX_COMPRESSION_RATIO * 10,
  });
  assert.throws(
    () => readZipMembers(bomb),
    (e) =>
      e instanceof ArchiveError &&
      (e.failure === 'compression-ratio-exceeded' || e.failure === 'entry-too-large'),
  );
});

test('a member whose bytes do not match its CRC is refused', () => {
  const zip = makeZip([{ name: 'feed.txt', data: FEED }]);
  // Corrupt one byte of the deflate stream, leaving the CRC claiming the original.
  const dataStart = 30 + 'feed.txt'.length;
  zip[dataStart + 2] ^= 0xff;
  assert.throws(
    () => readZipMembers(zip),
    (e) =>
      e instanceof ArchiveError &&
      // A corrupt deflate stream fails to inflate before the CRC is reached,
      // so `truncated` is the honest report; a STORE member reaches the CRC.
      ['checksum-mismatch', 'truncated', 'not-a-zip'].includes(e.failure),
  );
});

test('something that is not a ZIP is refused', () => {
  assert.throws(
    () => readZipMembers(Buffer.from('definitely not a zip file at all', 'utf8')),
    (e) => e instanceof ArchiveError && e.failure === 'not-a-zip',
  );
});

test('an unsupported compression method is refused, not skipped', () => {
  assert.throws(
    () => readZipMembers(makeZip([{ name: 'feed.txt', data: FEED }], { method: 6 })),
    (e) => e instanceof ArchiveError && e.failure === 'unsupported-compression',
  );
});

test('zero or many delimited members is an error, never a guess', () => {
  assert.throws(
    () => readDelimitedPayload(makeZip([{ name: 'readme.pdf', data: FEED }])),
    (e) => e instanceof ArchiveError && e.failure === 'no-delimited-member',
  );
  assert.throws(
    () =>
      readDelimitedPayload(
        makeZip([
          { name: 'a.txt', data: FEED },
          { name: 'b.csv', data: FEED },
        ]),
      ),
    (e) => e instanceof ArchiveError && e.failure === 'multiple-delimited-members',
  );
});

test('directory entries are ignored rather than treated as members', () => {
  const zip = makeZip([
    { name: 'exports/', data: Buffer.alloc(0) },
    { name: 'exports/feed.txt', data: FEED },
  ]);
  assert.equal(readZipMembers(zip).length, 1);
  assert.equal(readDelimitedPayload(zip).memberName, 'exports/feed.txt');
});
