/**
 * Disaster Recovery / Portable Backup Arc — Recovery Bundle Header.
 *
 * Reuses `fedos_device_sync_package_header.ts`'s own ADOPTED
 * "prefix-then-encrypt" technique (itself reusing the Conversation
 * Archive Header's): the real `encrypt()`/`decrypt()` Runtime Service
 * accepts only the closed `AeadAadDomain` enum, no free-form associated-
 * data byte parameter — so this file produces a deterministic, canonical
 * byte header from the Recovery Bundle's own identity fields, prepended
 * to the real Data Part bytes before sealing, and stripped + re-derived
 * + byte-compared after opening. A mismatch after successful AEAD
 * authentication (a relocated/substituted ciphertext presented alongside
 * a DIFFERENT manifest) is caught here — distinct from the content-hash
 * check (`fedos_recovery_bundle_manifest.ts`), which binds the manifest
 * to the Data Part's own CONTENT rather than its identity.
 *
 * Canonical wire format, identical length-prefix convention to the Sync
 * Package Header:
 *
 *   [0x01 schemaVersion byte]
 *   [accountIndex u32]
 *   [createdAt u32]
 */

const SCHEMA_VERSION_BYTE = 1;
const HEADER_LENGTH = 1 + 4 + 4;

function encodeUint32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
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

export interface FedosRecoveryBundleHeaderFields {
  readonly accountIndex: number;
  readonly createdAt: number;
}

/** Deterministic canonical encoding of the Bundle-identifying fields this Arc binds for tamper detection. */
export function encodeFedosRecoveryBundleHeader(fields: FedosRecoveryBundleHeaderFields): Uint8Array {
  return concatBytes([new Uint8Array([SCHEMA_VERSION_BYTE]), encodeUint32(fields.accountIndex), encodeUint32(fields.createdAt)]);
}

/** Byte-for-byte equality — used to detect a relocated/substituted header after decrypt. */
export function fedosRecoveryBundleHeaderBytesAreEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Fixed length — every field is fixed-width, unlike the Sync Package Header's variable-length strings, so this format needs no length-prefix walk. */
export const FEDOS_RECOVERY_BUNDLE_HEADER_LENGTH = HEADER_LENGTH;

/**
 * Splits `sealed` (header bytes followed by Data Part bytes) back into
 * its two parts. `null` if `sealed` is too short to contain a
 * well-formed header, or the header's own `schemaVersion` byte is
 * unrecognized — fails closed, never throws.
 */
export function splitFedosRecoveryBundleHeader(sealed: Uint8Array): { header: Uint8Array; dataPartBytes: Uint8Array } | null {
  if (sealed.length < HEADER_LENGTH) return null;
  if (sealed[0] !== SCHEMA_VERSION_BYTE) return null;
  return { header: sealed.slice(0, HEADER_LENGTH), dataPartBytes: sealed.slice(HEADER_LENGTH) };
}
