/**
 * Disaster Recovery / Portable Backup Arc — Recovery Bundle Data Part
 * codec.
 *
 * Pure, deterministic framing for the curated set of a profile's own
 * NDJSON logs the Data Part carries (`fedos_recovery_bundle_profile_selection.ts`
 * names exactly which ones). Mirrors `fedos_device_sync_package_header.ts`'s
 * own length-prefixed byte-framing technique, generalized from a single
 * fixed field set to an ordered list of (name, bytes) entries, so the
 * Encryption Authority can seal ONE ciphertext for however many logs a
 * given profile actually has (a leaf that does not exist yet on the
 * source profile is simply omitted — never an error, never a
 * zero-length placeholder).
 *
 * Entries are sorted by logical name before encoding, so two builds of
 * the identical log set always produce byte-identical Data Part bytes
 * regardless of caller iteration order — required for the content-hash
 * check (`fedos_recovery_bundle_manifest.ts`) to be meaningful.
 *
 * HARD GUARDRAILS: pure, synchronous, never throws. No filesystem
 * access, no cryptography, no Host wiring.
 */

const ENTRY_COUNT_BYTES = 4;
const NAME_LENGTH_BYTES = 4;
const CONTENT_LENGTH_BYTES = 4;

export interface FedosRecoveryBundleDataPartEntry {
  readonly name: string;
  readonly bytes: Uint8Array;
}

function encodeUint32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

function encodeLengthPrefixedUtf8(text: string): Uint8Array {
  const utf8 = new TextEncoder().encode(text);
  const out = new Uint8Array(NAME_LENGTH_BYTES + utf8.length);
  new DataView(out.buffer).setUint32(0, utf8.length, false);
  out.set(utf8, NAME_LENGTH_BYTES);
  return out;
}

function encodeLengthPrefixedBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(CONTENT_LENGTH_BYTES + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, false);
  out.set(bytes, CONTENT_LENGTH_BYTES);
  return out;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Encodes `entries` (deduplicated and sorted by `name` first — a caller
 * passing a duplicate name has the LAST occurrence win, matching plain
 * object/Map semantics) into one deterministic byte blob:
 * `[u32 entryCount] [for each, name-sorted: [u32 nameLen][name utf8][u32 contentLen][content bytes]]`.
 */
export function encodeFedosRecoveryBundleDataPart(entries: readonly FedosRecoveryBundleDataPartEntry[]): Uint8Array {
  const byName = new Map<string, Uint8Array>();
  for (const entry of entries) byName.set(entry.name, entry.bytes);
  const sortedNames = [...byName.keys()].sort();

  const chunks: Uint8Array[] = [encodeUint32(sortedNames.length)];
  for (const name of sortedNames) {
    chunks.push(encodeLengthPrefixedUtf8(name));
    chunks.push(encodeLengthPrefixedBytes(byName.get(name)!));
  }
  return concatBytes(chunks);
}

/**
 * The inverse of `encodeFedosRecoveryBundleDataPart`. `null` on ANY
 * malformed input (truncated length prefix, declared length exceeding
 * the remaining buffer, trailing garbage after the last entry) — fails
 * closed, never throws.
 */
export function decodeFedosRecoveryBundleDataPart(bytes: Uint8Array): readonly FedosRecoveryBundleDataPartEntry[] | null {
  if (bytes.length < ENTRY_COUNT_BYTES) return null;
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    const entryCount = view.getUint32(offset, false);
    offset += ENTRY_COUNT_BYTES;

    const entries: FedosRecoveryBundleDataPartEntry[] = [];
    for (let i = 0; i < entryCount; i += 1) {
      if (offset + NAME_LENGTH_BYTES > bytes.length) return null;
      const nameLength = view.getUint32(offset, false);
      offset += NAME_LENGTH_BYTES;
      if (offset + nameLength > bytes.length) return null;
      const name = new TextDecoder().decode(bytes.slice(offset, offset + nameLength));
      offset += nameLength;

      if (offset + CONTENT_LENGTH_BYTES > bytes.length) return null;
      const contentLength = view.getUint32(offset, false);
      offset += CONTENT_LENGTH_BYTES;
      if (offset + contentLength > bytes.length) return null;
      const content = bytes.slice(offset, offset + contentLength);
      offset += contentLength;

      entries.push({ name, bytes: content });
    }
    if (offset !== bytes.length) return null; // trailing garbage
    return Object.freeze(entries);
  } catch {
    return null;
  }
}
