/*
 * ZIP reading for provider feed exports.
 *
 * WHY THIS EXTRACTS TO MEMORY AND NEVER TO DISK. Path traversal is the classic
 * archive vulnerability — an entry named `../../etc/passwd`, or `C:\windows\…`
 * on Windows — and every mitigation for it is a string check that someone can
 * get subtly wrong. Writing no files at all removes the vulnerability rather
 * than defending against it: there is no destination directory to escape from.
 * The parser downstream wants text, so a buffer is what it should be handed.
 * Entry names are still validated, because a name is also how the right entry
 * is chosen, and a name that looks like an escape attempt is a reason to
 * refuse the archive rather than to quietly pick a different member.
 *
 * WHY THIS IS HAND-ROLLED RATHER THAN A DEPENDENCY. `zlib.inflateRawSync` is
 * in Node; a ZIP container around it is a central directory and a local
 * header. Adding an unzip package to read one vendor's daily export would put
 * a transitive dependency tree on the path that ingests untrusted third-party
 * bytes — which is the opposite of what this path should be. The limits below
 * are the actual reason to own this code: a library will happily inflate a
 * 4KB archive into 4GB of memory, and the caller has to stop it anyway.
 *
 * DECOMPRESSION BOMBS are refused three ways, because any one of them alone
 * has a hole: a cap on the archive, a cap on what one entry may inflate to,
 * and a cap on the ratio between them. The ratio catches the small archive
 * that claims a modest size and lies; the absolute cap catches the honest
 * declaration that is simply too big to hold.
 *
 * NOTHING HERE LOGS. Not the entry names, not the bytes, not the path. A feed
 * archive is merchant content under a network's terms, and a log line is the
 * easiest way for it to end up somewhere nobody is guarding.
 */
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

/** Nothing this provider sends is near this; a bigger file is a surprise. */
export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

/** One member's inflated size. The CJ shopping export is ~400KB. */
export const MAX_ENTRY_BYTES = 256 * 1024 * 1024;

/**
 * Inflated-to-compressed ratio. Text compresses well — the real exports run
 * about 5:1 — so 1000:1 is far above anything legitimate and far below the
 * ~1000000:1 a zip bomb needs to be interesting.
 */
export const MAX_COMPRESSION_RATIO = 1000;

export type ArchiveFailure =
  | 'archive-too-large'
  | 'not-a-zip'
  | 'truncated'
  | 'unsupported-compression'
  | 'unsafe-entry-name'
  | 'entry-too-large'
  | 'compression-ratio-exceeded'
  | 'checksum-mismatch'
  | 'no-delimited-member'
  | 'multiple-delimited-members';

export class ArchiveError extends Error {
  readonly failure: ArchiveFailure;
  constructor(failure: ArchiveFailure, detail?: string) {
    super(detail ? `${failure}: ${detail}` : failure);
    this.name = 'ArchiveError';
    this.failure = failure;
  }
}

export interface ArchiveMember {
  /** Entry name as stored, after validation. */
  readonly name: string;
  readonly bytes: Buffer;
}

export interface DelimitedPayload {
  /** The member the text came from. */
  readonly memberName: string;
  /** Decoded text, BOM stripped. */
  readonly text: string;
  /**
   * sha256 of the DECODED TEXT, lower-case hex — the idempotency key.
   *
   * Hashing the text rather than the archive is deliberate: re-zipping the
   * same export changes the container (timestamps, ordering, compression
   * level) while the payload is identical, and an importer that re-applied a
   * byte-identical feed because its wrapper changed would write a duplicate
   * day of history.
   */
  readonly sha256: string;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** `..`, absolute paths, drive letters, backslashes, NULs — all refused. */
export function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name.length > 512) return false;
  if (name.includes('\0') || name.includes('\\')) return false;
  if (name.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(name)) return false;
  return !name.split('/').some((segment) => segment === '..');
}

function findEndOfCentralDirectory(buf: Buffer): number {
  // The EOCD is last, after a comment of up to 65535 bytes. Scan backwards.
  const min = Math.max(0, buf.length - (22 + 0xffff));
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

/**
 * Read every member into memory, enforcing the limits above.
 *
 * Only STORE (0) and DEFLATE (8) are supported — the two a ZIP writer uses in
 * practice. An unexpected method is refused rather than skipped, so a feed
 * that silently changes format fails loudly instead of importing nothing.
 */
export function readZipMembers(archive: Buffer): readonly ArchiveMember[] {
  if (archive.length > MAX_ARCHIVE_BYTES) throw new ArchiveError('archive-too-large');
  if (archive.length < 22) throw new ArchiveError('not-a-zip', 'shorter than an empty archive');

  const eocd = findEndOfCentralDirectory(archive);
  if (eocd < 0) throw new ArchiveError('not-a-zip', 'no end-of-central-directory record');

  const entryCount = archive.readUInt16LE(eocd + 10);
  let offset = archive.readUInt32LE(eocd + 16);
  const members: ArchiveMember[] = [];

  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > archive.length) throw new ArchiveError('truncated', 'central directory');
    if (archive.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new ArchiveError('not-a-zip', 'bad central-directory signature');
    }

    const method = archive.readUInt16LE(offset + 10);
    const crc32 = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength);

    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) continue; // directory entry, nothing to inflate
    if (!isSafeEntryName(name)) throw new ArchiveError('unsafe-entry-name');
    if (uncompressedSize > MAX_ENTRY_BYTES) throw new ArchiveError('entry-too-large', name);
    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) {
      throw new ArchiveError('compression-ratio-exceeded', name);
    }

    if (localOffset + 30 > archive.length) throw new ArchiveError('truncated', 'local header');
    if (archive.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new ArchiveError('not-a-zip', 'bad local-header signature');
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.length) throw new ArchiveError('truncated', name);

    const raw = archive.subarray(dataStart, dataEnd);
    let bytes: Buffer;
    if (method === 0) {
      bytes = Buffer.from(raw);
    } else if (method === 8) {
      try {
        // maxOutputLength makes the limit the decompressor's problem rather
        // than a check performed after the memory has already been allocated.
        bytes = inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
      } catch (cause) {
        // zlib throws its own errors for a corrupt stream and for exceeding
        // maxOutputLength. Both mean "this archive cannot be trusted", and a
        // caller should get one typed failure rather than having to know
        // zlib's error codes to tell a bomb from a truncated download.
        const code = (cause as { code?: string } | null)?.code;
        throw new ArchiveError(
          code === 'ERR_BUFFER_TOO_LARGE' ? 'entry-too-large' : 'truncated',
          name,
        );
      }
    } else {
      throw new ArchiveError('unsupported-compression', `method ${method}`);
    }

    if (bytes.length > MAX_ENTRY_BYTES) throw new ArchiveError('entry-too-large', name);
    // The CRC in the header is the archive's own claim about its contents;
    // checking it catches a truncated or tampered member before the parser
    // sees half a feed and reports it as a short export.
    if (crc32 !== 0 && crc32OfBuffer(bytes) !== crc32) {
      throw new ArchiveError('checksum-mismatch', name);
    }

    members.push({ name, bytes });
  }

  return members;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32OfBuffer(buf: Buffer): number {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i += 1) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

/** `.txt`, `.tsv` and `.csv` are what a delimited export arrives as. */
function isDelimitedName(name: string): boolean {
  return /\.(txt|tsv|csv)$/i.test(name);
}

/**
 * The one delimited member of an archive, as text plus its content hash.
 *
 * Exactly one is required. Zero means the export changed shape; more than one
 * means a guess would have to be made about which is the feed, and guessing
 * which file is the product catalogue is not a decision code should take.
 */
export function readDelimitedPayload(archive: Buffer): DelimitedPayload {
  const delimited = readZipMembers(archive).filter((m) => isDelimitedName(m.name));
  if (delimited.length === 0) throw new ArchiveError('no-delimited-member');
  if (delimited.length > 1) {
    throw new ArchiveError('multiple-delimited-members', String(delimited.length));
  }

  const member = delimited[0];
  let text = member.bytes.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  return {
    memberName: member.name,
    text,
    sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
  };
}
