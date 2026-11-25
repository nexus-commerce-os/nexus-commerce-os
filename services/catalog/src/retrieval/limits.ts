/*
 * How much data a feed is allowed to be, compressed and expanded.
 *
 * WHY. A provider feed is data we did not write, fetched unattended, and then
 * decompressed. Both halves of that are a denial-of-service waiting to happen:
 * a response with no `content-length` can stream until memory runs out, and a
 * 1MB gzip can expand to several gigabytes. "The provider would never" is not
 * a control — the provider is not the only party who can answer a request, and
 * a compromised or misconfigured endpoint looks exactly like a working one.
 *
 * So both are budgeted. The budget is enforced DURING the read, not after it:
 * checking the size of a buffer you have already allocated is a check that
 * runs after the damage.
 */

import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

/** Defaults sized for a real provider export, with room to grow. */
export const DEFAULT_LIMITS = {
  /** The compressed bytes we will accept off the wire. */
  maxDownloadBytes: 256 * 1024 * 1024,
  /** The bytes we will accept AFTER expansion. */
  maxExpandedBytes: 1024 * 1024 * 1024,
  /**
   * The largest expansion factor we will tolerate.
   *
   * A real CSV of product rows gzips to roughly 5-15x. A ratio in the hundreds
   * or thousands is not a catalogue, it is a bomb: 10GB of zeroes compresses
   * to about 10MB. This catches that while the stream is still running, long
   * before `maxExpandedBytes` would.
   */
  maxExpansionRatio: 200,
} as const;

export type SizeLimits = typeof DEFAULT_LIMITS;

export class FeedTooLargeError extends Error {
  constructor(readonly detail: string) {
    super(`feed refused: ${detail}`);
    this.name = 'FeedTooLargeError';
  }
}

/**
 * Reads a stream into memory, refusing as soon as the budget is exceeded.
 *
 * Takes a web `ReadableStream` because that is what `fetch` gives us.
 */
export async function readWithLimit(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // Cancel rather than drain: the point is to stop paying for it.
        await reader.cancel().catch(() => {});
        throw new FeedTooLargeError(
          `download exceeded ${maxBytes} bytes (stopped at ${total}) — raise the limit deliberately if a provider really is this big`,
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

/** gzip magic: 0x1f 0x8b. Checked rather than trusting a file extension. */
export function isGzip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

/** ZIP local file header: "PK\x03\x04". */
export function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/**
 * Expands gzip with both an absolute cap and a ratio cap, enforced as the
 * bytes arrive.
 *
 * The ratio cap is the one that matters. An absolute cap alone still lets an
 * attacker burn the entire budget — a gigabyte of CPU and memory — before the
 * refusal. The ratio catches a bomb within the first few megabytes, because a
 * bomb is abnormal from its very first block.
 */
export async function gunzipWithLimit(
  input: Buffer,
  limits: Pick<SizeLimits, 'maxExpandedBytes' | 'maxExpansionRatio'> = DEFAULT_LIMITS,
): Promise<Buffer> {
  const out: Buffer[] = [];
  let expanded = 0;

  const gunzip = createGunzip();
  gunzip.on('data', (chunk: Buffer) => {
    expanded += chunk.byteLength;
    if (expanded > limits.maxExpandedBytes) {
      gunzip.destroy(
        new FeedTooLargeError(`expanded past ${limits.maxExpandedBytes} bytes`),
      );
      return;
    }
    // `input.length` is never 0 here: an empty buffer is not valid gzip.
    const ratio = expanded / input.length;
    if (ratio > limits.maxExpansionRatio) {
      gunzip.destroy(
        new FeedTooLargeError(
          `expansion ratio ${ratio.toFixed(0)}x exceeds ${limits.maxExpansionRatio}x ` +
            `(${input.length} compressed bytes produced ${expanded}) — this is the shape of a decompression bomb, not a catalogue`,
        ),
      );
      return;
    }
    out.push(chunk);
  });

  await pipeline(Readable.from(input), gunzip);
  return Buffer.concat(out, expanded);
}

/**
 * Normalises whatever a provider served into the bytes the importer expects.
 *
 * `readDelimitedPayload` already understands a ZIP container and a bare
 * delimited file, so gzip is the gap this closes. A gzipped ZIP is handled by
 * expanding once and handing the result on.
 */
export async function expandIfCompressed(
  body: Buffer,
  limits: SizeLimits = DEFAULT_LIMITS,
): Promise<Buffer> {
  if (!isGzip(body)) return body;
  return gunzipWithLimit(body, limits);
}
