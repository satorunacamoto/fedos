/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Header.
 *
 * Reuses `encodeFedosConversationEnvelopeAssociatedData()`'s own
 * ADOPTED "prefix-then-encrypt" technique (Alpha 856): Seam 2's real
 * `encrypt()`/`decrypt()` accept only the closed `AeadAadDomain` enum —
 * no free-form associated-data byte parameter exists — so this file
 * produces a deterministic, canonical byte header from the Manifest
 * fields that identify WHICH conversation/export this ciphertext
 * belongs to (`schemaVersion`, `conversationId`, `exportedAt`), which
 * `fedos_conversation_archive_encryption.ts` prepends to the real
 * plaintext bundle bytes before sealing, and strips + re-derives +
 * byte-compares after opening — the SAME discipline Alpha
 * 870/871's Encryption/Decryption Authorities already apply to
 * Envelopes, applied here to Archives instead. A mismatch after
 * successful AEAD authentication (a relocated/substituted ciphertext
 * presented alongside a DIFFERENT Manifest) is caught here, distinct
 * from the Integrity content-hash check
 * (`fedos_conversation_archive_integrity.ts`), which binds the Manifest
 * to the bundle's own CONTENT rather than its identity.
 *
 * Canonical wire format — every string field LENGTH-PREFIXED (4-byte
 * big-endian `Uint32`), identical convention to
 * `fedos_conversation_envelope_associated_data.ts`:
 *
 *   [0x01 schemaVersion byte]
 *   [len(conversationId) u32][conversationId utf8]
 *   [exportedAt u32]
 *
 * HARD GUARDRAILS:
 *   - Pure, deterministic, synchronous — the SAME input always produces
 *     byte-identical output.
 *   - No plaintext bundle content, no ciphertext, no key material.
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

export interface FedosConversationArchiveHeaderFields {
  readonly conversationId: string;
  readonly exportedAt: number;
}

/** Deterministic canonical encoding of the Archive-identifying fields this Arc binds for tamper detection. See this file's own header for the exact wire layout. */
export function encodeFedosConversationArchiveHeader(fields: FedosConversationArchiveHeaderFields): Uint8Array {
  return concatBytes([
    new Uint8Array([SCHEMA_VERSION_BYTE]),
    encodeLengthPrefixedUtf8(fields.conversationId),
    encodeUint32(fields.exportedAt),
  ]);
}

/** Byte-for-byte equality — used to detect a relocated/substituted header after decrypt. */
export function fedosConversationArchiveHeaderBytesAreEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** The fixed length of the header this file encodes — used by the Decryption side to split header bytes from bundle bytes after a successful open. `conversationId` is variable-length, so this is a FLOOR (schemaVersion byte + length-prefix u32 + exportedAt u32), not the full header length. */
export const FEDOS_CONVERSATION_ARCHIVE_HEADER_FIXED_PREFIX_LENGTH = 1 + 4 + 4;

/**
 * Splits `sealed` (header bytes followed by bundle bytes) back into its
 * two parts, using the SAME length-prefix convention
 * `encodeFedosConversationArchiveHeader` writes. `null` if `sealed` is
 * too short to contain a well-formed header — fails closed, never
 * throws.
 */
export function splitFedosConversationArchiveHeader(sealed: Uint8Array): { header: Uint8Array; bundleBytes: Uint8Array } | null {
  if (sealed.length < FEDOS_CONVERSATION_ARCHIVE_HEADER_FIXED_PREFIX_LENGTH) return null;
  const view = new DataView(sealed.buffer, sealed.byteOffset, sealed.byteLength);
  const conversationIdLength = view.getUint32(1, false);
  const headerLength = 1 + 4 + conversationIdLength + 4;
  if (sealed.length < headerLength) return null;
  return {
    header: sealed.slice(0, headerLength),
    bundleBytes: sealed.slice(headerLength),
  };
}
