/**
 * Secure Runtime Alpha 854 ("Private Message Envelope V1") — Stage 4 of
 * Phase A of the Alpha 851–890 Private Message Envelope and Encryption
 * Authority Activation Arc.
 *
 * Refines the review's own `04_envelope_v1.md` sketch against what this
 * Arc's own Alpha 852 V1 Scope Decision (Envelope + Rust/WASM encryption
 * boundary only, no product API) actually needs: `senderMembershipId`
 * (not a raw participant reference — Membership is now real, Alpha
 * 761–850, so the Envelope references the durable Membership fact
 * directly) and `payloadId` (a reference INTO the existing, durable
 * `FedosConversationPayloadStorage`, Alpha 804 — never an inline
 * ciphertext string) replace the review's own `senderRef`/`ciphertext`
 * placeholders now that both real targets exist.
 *
 * `encryptionSuite` is typed against the REAL, Rust-backed
 * `FedosAeadAlgorithm` union (`packages/fedos-core-rust/src/lib.rs`,
 * mirrored on the TypeScript side by `AeadAlgorithm`,
 * `../../runtime/fedos_wasm_loader.ts`) — `"ChaCha20Poly1305" |
 * "Aes256Gcm"` only, per the review's own `05_encryption_suites.md`
 * finding that Seam 1's `xchacha20poly1305`/`aes_gcm`/`other` union is
 * aspirational and has no real Rust counterpart. This file does not
 * import that type directly (this Arc's own "do not redesign existing
 * records" instruction keeps the Envelope module decoupled from the
 * Runtime module's own type location) — it declares the identical
 * literal union itself, the same "separate label per boundary"
 * discipline `packages/fedos-core-rust/src/lib.rs`'s own header comments
 * already establish crate-side.
 *
 * `keyEpoch` is a plain non-negative `number` (SEC §03's own branded-number
 * sketch, left unbranded per `04_envelope_v1.md`'s own finding that no
 * real epoch-identity type exists yet to justify branding it) —
 * `11_key_epochs.md`'s own open question ("does a Direct conversation's
 * epoch ever advance?") is left unresolved by this file; `keyEpoch: 0`
 * is simply always valid, and this Arc's own Encryption Authority never
 * increments it.
 *
 * Explicitly EXCLUDED, per this Arc's own instruction and every one of
 * SEC/CFv1's/this review's own prior findings:
 *   - plaintext — never travels through this domain.
 *   - ciphertext bytes — live in `FedosConversationPayloadStorage`
 *     (opaque, `payloadId`-referenced), never inline here.
 *   - raw key / key handle — Encryption/Decryption Authority concern
 *     only, never a field on the wire-adjacent Envelope record.
 *   - Capability bearer secret — Capability domain (Alpha 761–850),
 *     structurally unrelated.
 *   - participant/member list — Membership domain, not duplicated here.
 *   - display metadata — matches `FedosConversationRecord`'s own
 *     "no speculative field" discipline (Alpha 745).
 *   - delivery result — a future transport/protocol-mapping concern,
 *     explicitly out of scope (Alpha 884's own guard).
 *   - arbitrary metadata bag.
 *
 * HARD GUARDRAILS:
 *   - Every field `readonly`; no mutation method or setter.
 *   - Only `validateFedosConversationMessageEnvelope`
 *     (`./fedos_conversation_message_envelope_validator.ts`) constructs
 *     one.
 *   - `createdAt` is Unix seconds, matching `FedosConversationRecord`'s
 *     own convention.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "./fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";
import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";

/** The ONLY two real, Rust-backed AEAD suites this Arc's own Alpha 864 Suite Decision recognizes. Mirrors `FedosAeadAlgorithm` (`../../runtime/fedos_wasm_loader.ts`) exactly — never Seam 1's wider, aspirational union. */
export type FedosConversationEnvelopeEncryptionSuite = "ChaCha20Poly1305" | "Aes256Gcm";

export const FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES: readonly FedosConversationEnvelopeEncryptionSuite[] = [
  "ChaCha20Poly1305",
  "Aes256Gcm",
];

export interface FedosConversationMessageEnvelope {
  readonly id: FedosConversationEnvelopeId;
  readonly conversationId: FedosConversationId;
  readonly senderMembershipId: FedosConversationMembershipId;
  readonly payloadId: FedosConversationPayloadId;
  readonly encryptionSuite: FedosConversationEnvelopeEncryptionSuite;
  /** Non-negative. See this file's own header for why this stays unbranded and why `0` is always valid. */
  readonly keyEpoch: number;
  /** Unix seconds — matches `FedosConversationRecord.createdAt`'s own convention. */
  readonly createdAt: number;
  /** `null` for a root message; otherwise the Envelope this one replies to. */
  readonly replyToEnvelopeId: FedosConversationEnvelopeId | null;
}
