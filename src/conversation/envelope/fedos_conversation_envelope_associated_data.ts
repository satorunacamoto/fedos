/**
 * Secure Runtime Alpha 856 ("Associated Data Contract") — Stage 6 of
 * Phase A of the Alpha 851–890 Private Message Envelope and Encryption
 * Authority Activation Arc.
 *
 * The review's own `14_associated_data.md` found that Seam 2's real,
 * existing `encrypt()`/`decrypt()` (`../../runtime/fedos_wasm_loader.ts`)
 * accept ONLY the closed `AeadAadDomain` enum — no free-form associated-
 * data byte parameter exists anywhere in the real Rust API today, and
 * extending it would be a genuine Rust-side API change this Arc's own
 * Alpha 868 instruction ("no generic `encrypt(key, bytes)` oracle")
 * counsels against for a boundary this narrow.
 *
 * ADOPTED (Alpha 856's own decision, not made by the review): **prefix-
 * then-encrypt**, option (b) the review named but did not choose between.
 * `encodeFedosConversationEnvelopeAssociatedData()` below produces a
 * deterministic, canonical byte header from exactly the Envelope fields
 * the review's own `14_associated_data.md` identified as needing
 * cryptographic binding (`conversationId`, `keyEpoch`, `senderMembershipId`
 * — plus `id`/`createdAt`/`replyToEnvelopeId`/`suite` for completeness).
 * `FedosConversationEncryptionAuthority`/`FedosConversationDecryptionAuthority`
 * (`../encryption/`) PREPEND this header to the real plaintext before
 * calling the existing `encrypt()`, and STRIP + independently RE-DERIVE
 * + byte-compare it after `decrypt()` — since the WHOLE sealed blob
 * (header + plaintext) shares ONE AEAD authentication tag, tampering
 * with any Envelope metadata field this header covers breaks
 * authentication exactly as true native AAD would, without requiring any
 * Rust-side signature change. The one honest tradeoff, stated plainly:
 * these fields become part of the ENCRYPTED blob (hidden until
 * decryption succeeds), not visible-but-authenticated alongside the
 * ciphertext the way native AEAD associated data would be — Envelope
 * ROUTING metadata (`conversationId`/`senderMembershipId`/`createdAt`/
 * etc.) still travels in the PLAINTEXT `FedosConversationMessageEnvelope`
 * record itself (`../fedos_conversation_message_envelope.ts`), so
 * nothing a caller needs to route on is actually hidden by this choice —
 * only the REDUNDANT copy bound inside the ciphertext for tamper-
 * detection is.
 *
 * Canonical wire format — every field LENGTH-PREFIXED (4-byte big-endian
 * `Uint32`) to make the encoding unambiguous regardless of field
 * content: an id like `FedosConversationMembershipId` already legitimately
 * CONTAINS the `::` characters a naive delimiter-joined encoding would
 * collide on (`conversationId::authority::publicIdentifier`, Alpha 767)
 * — length-prefixing sidesteps that entirely, no escaping needed.
 *
 *   [0x01 schemaVersion byte]
 *   [len(id) u32][id utf8]
 *   [len(conversationId) u32][conversationId utf8]
 *   [len(senderMembershipId) u32][senderMembershipId utf8]
 *   [keyEpoch u32]
 *   [createdAt u32]
 *   [presence byte: 0x00 absent | 0x01 present]
 *   [len(replyToEnvelopeId) u32][replyToEnvelopeId utf8]   -- only if present
 *   [len(suite) u32][suite utf8]
 *
 * `keyEpoch`/`createdAt` are encoded as raw big-endian `Uint32` (not a
 * length-prefixed decimal string) — both are already validated
 * non-negative integers within `FEDOS_BOARD_POST_MAX_CREATED_AT`'s own
 * bound (`../fedos_conversation_message_envelope_validator.ts`), which
 * fits comfortably inside 32 bits.
 *
 * HARD GUARDRAILS:
 *   - Pure, deterministic, synchronous — the SAME input always produces
 *     byte-identical output (verified by known-answer tests,
 *     `test/secure_runtime_alpha_853_860_envelope_persistence.test.ts`).
 *   - No mutable display data, no storage path, no delivery state, no
 *     arbitrary JSON object ordering (a fixed field ORDER is encoded
 *     directly into the byte layout, never `JSON.stringify` on an
 *     object whose key order is not language-guaranteed).
 *   - Never includes plaintext, ciphertext, or key material.
 */

import type { FedosConversationMessageEnvelope } from "./fedos_conversation_message_envelope.js";

const SCHEMA_VERSION = 1;

function encodeLengthPrefixedUtf8(text: string): Uint8Array {
  const utf8 = new TextEncoder().encode(text);
  const out = new Uint8Array(4 + utf8.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, utf8.length, false);
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

/**
 * Deterministic canonical encoding of the Envelope fields this Arc binds
 * for tamper detection. See this file's own header for the exact wire
 * layout and the prefix-then-encrypt rationale.
 */
export function encodeFedosConversationEnvelopeAssociatedData(
  envelope: Pick<
    FedosConversationMessageEnvelope,
    "id" | "conversationId" | "senderMembershipId" | "keyEpoch" | "createdAt" | "replyToEnvelopeId" | "encryptionSuite"
  >,
): Uint8Array {
  const chunks: Uint8Array[] = [
    new Uint8Array([SCHEMA_VERSION]),
    encodeLengthPrefixedUtf8(envelope.id),
    encodeLengthPrefixedUtf8(envelope.conversationId),
    encodeLengthPrefixedUtf8(envelope.senderMembershipId),
    encodeUint32(envelope.keyEpoch),
    encodeUint32(envelope.createdAt),
  ];
  if (envelope.replyToEnvelopeId === null) {
    chunks.push(new Uint8Array([0x00]));
  } else {
    chunks.push(new Uint8Array([0x01]), encodeLengthPrefixedUtf8(envelope.replyToEnvelopeId));
  }
  chunks.push(encodeLengthPrefixedUtf8(envelope.encryptionSuite));
  return concatBytes(chunks);
}

/** Byte-for-byte equality — used by the Decryption Authority to detect a relocated/tampered header after decrypt. */
export function fedosConversationEnvelopeAssociatedDataBytesAreEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
