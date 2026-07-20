/**
 * Secure Runtime Alpha 3321–3400 — Encrypted Sync Package Header.
 *
 * Reuses `encodeFedosConversationArchiveHeader()`'s own ADOPTED
 * "prefix-then-encrypt" technique
 * (`../../conversation/archive/fedos_conversation_archive_header.ts`, Alpha
 * 1541–1610, itself reusing Alpha 856): the real `encrypt()`/`decrypt()`
 * Runtime Service (`../../runtime/fedos_runtime_encrypt.ts`/
 * `fedos_runtime_decrypt.ts`) accepts only the closed `AeadAadDomain` enum,
 * no free-form associated-data byte parameter — so this file produces a
 * deterministic, canonical byte header from the Sync Package identity
 * fields, prepended to the real plaintext session bytes before sealing,
 * and stripped + re-derived + byte-compared after opening. A mismatch
 * after successful AEAD authentication (a relocated/substituted ciphertext
 * presented alongside a DIFFERENT manifest) is caught here — distinct from
 * the content-hash check (`./fedos_device_sync_package_manifest.ts`),
 * which binds the manifest to the session's own CONTENT rather than its
 * identity.
 *
 * Canonical wire format, identical length-prefix convention to the Archive
 * Header:
 *
 *   [0x01 schemaVersion byte]
 *   [len(accountAuthority) u32][accountAuthority utf8]
 *   [len(accountPublicIdentifier) u32][accountPublicIdentifier utf8]
 *   [len(targetDeviceId) u32][targetDeviceId utf8]
 *   [preparedAt u32]
 *
 * HARD GUARDRAILS: pure, deterministic, synchronous. No plaintext session
 * content, no ciphertext, no key material.
 */

const SCHEMA_VERSION_BYTE = 1;

function encodeLengthPrefixedUtf8(text: string): Uint8Array {
  const utf8 = new TextEncoder().encode(text);
  const out = new Uint8Array(4 + utf8.length);
  new DataView(out.buffer).setUint32(0, utf8.length, false);
  out.set(utf8, 4);
  return out;
}

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

export interface FedosDeviceSyncPackageHeaderFields {
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly targetDeviceId: string;
  readonly preparedAt: number;
}

/** Deterministic canonical encoding of the Package-identifying fields this Arc binds for tamper detection. See this file's own header for the exact wire layout. */
export function encodeFedosDeviceSyncPackageHeader(fields: FedosDeviceSyncPackageHeaderFields): Uint8Array {
  return concatBytes([
    new Uint8Array([SCHEMA_VERSION_BYTE]),
    encodeLengthPrefixedUtf8(fields.accountAuthority),
    encodeLengthPrefixedUtf8(fields.accountPublicIdentifier),
    encodeLengthPrefixedUtf8(fields.targetDeviceId),
    encodeUint32(fields.preparedAt),
  ]);
}

/** Byte-for-byte equality — used to detect a relocated/substituted header after decrypt. */
export function fedosDeviceSyncPackageHeaderBytesAreEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** FLOOR length (schemaVersion byte + three length-prefix u32s + preparedAt u32) — every string field is variable-length, so this alone cannot locate the split point; `splitFedosDeviceSyncPackageHeader` walks each length prefix in turn. */
export const FEDOS_DEVICE_SYNC_PACKAGE_HEADER_FIXED_PREFIX_LENGTH = 1 + 4 + 4 + 4 + 4;

/**
 * Splits `sealed` (header bytes followed by session bytes) back into its
 * two parts, using the SAME length-prefix convention
 * `encodeFedosDeviceSyncPackageHeader` writes. `null` if `sealed` is too
 * short or malformed to contain a well-formed header — fails closed, never
 * throws.
 */
export function splitFedosDeviceSyncPackageHeader(sealed: Uint8Array): { header: Uint8Array; sessionBytes: Uint8Array } | null {
  if (sealed.length < FEDOS_DEVICE_SYNC_PACKAGE_HEADER_FIXED_PREFIX_LENGTH) return null;
  try {
    const view = new DataView(sealed.buffer, sealed.byteOffset, sealed.byteLength);
    let offset = 1;
    const authorityLength = view.getUint32(offset, false);
    offset += 4 + authorityLength;
    if (sealed.length < offset + 4) return null;
    const identifierLength = view.getUint32(offset, false);
    offset += 4 + identifierLength;
    if (sealed.length < offset + 4) return null;
    const deviceIdLength = view.getUint32(offset, false);
    offset += 4 + deviceIdLength;
    const headerLength = offset + 4;
    if (sealed.length < headerLength) return null;
    return { header: sealed.slice(0, headerLength), sessionBytes: sealed.slice(headerLength) };
  } catch {
    return null;
  }
}
