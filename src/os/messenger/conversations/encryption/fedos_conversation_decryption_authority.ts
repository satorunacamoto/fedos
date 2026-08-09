/**
 * Secure Runtime Alpha 862 ("Decryption Authority") / Alpha 865 (its own
 * result vocabulary) — Stage 2/5 of Phase B of the Alpha 851–890 Private
 * Message Envelope and Encryption Authority Activation Arc.
 *
 * The exact mirror of `FedosConversationEncryptionAuthority`
 * (`./fedos_conversation_encryption_authority.ts`, Alpha 861/863) — same
 * narrow-interface discipline, same non-responsibilities, same NAMED
 * SCOPE BOUNDARY. See that file's own header for the full rationale;
 * this header only states what differs.
 *
 * Responsibilities (per `07_decryption_authority.md`, unchanged):
 *   - resolve key material internally (`resolveConversationKey`, Alpha
 *     869, already real — the SAME shared primitive Alpha 861/863's own
 *     Encryption Authority uses, per `07_decryption_authority.md`'s own
 *     "single shared implementation rather than two" recommendation,
 *     adopted here: both Authorities call the identical
 *     `FedosMasterSeedAuthority.resolveConversationKey()` method, never
 *     two independent derivations).
 *   - re-derive the Alpha 856 associated-data header from the request's
 *     own Envelope-identifying fields and byte-compare it against what
 *     decryption actually recovers (`fedosConversationEnvelopeAssociatedDataBytesAreEqual()`,
 *     `../envelope/fedos_conversation_envelope_associated_data.ts`) —
 *     the STRIP + RE-DERIVE + COMPARE half of that file's own
 *     prefix-then-encrypt design, never duplicated ad hoc here.
 *   - decrypt (reusing the EXISTING, real `decrypt()`,
 *     `../../runtime/fedos_runtime_decrypt.ts`, plus `importCiphertext()`,
 *     `../../runtime/fedos_runtime_import_ciphertext.ts`).
 *
 * Non-responsibilities — IDENTICAL to `06_encryption_authority.md`'s own
 * list (membership authorization, payload/Envelope persistence,
 * Capability issuance, GUI, protocol publishing) — not restated field by
 * field here; see that file.
 *
 * NAMED SCOPE BOUNDARY — the SAME one `06_encryption_authority.md`/
 * `fedos_conversation_encryption_authority.ts` already names:
 * `FedosConversationDecryptionRequest` accepts `localAccountIndex`/
 * `counterpartyPublicKeyHex` ALREADY RESOLVED, explicit fields, for the
 * identical reason — resolving them from a live Conversation/Membership
 * pair remains this Arc's own exact remaining activation-boundary
 * blocker (`Alpha 890`'s own completion declaration), not solved here or
 * there.
 *
 * FAILURE VOCABULARY — Alpha 863's own coarse, stable, six-outcome shape
 * (`FedosConversationEncryptionResult`) reused verbatim in structure
 * here (`"decrypted" | "unauthorized" | "key-unavailable" |
 * "invalid-input" | "unavailable" | "failed"`), rather than
 * `16_failure_vocabulary.md`'s own finer-grained, four-reason
 * `FedosEnvelopeKeyResolutionFailure` proposal. `16_failure_vocabulary.md`
 * itself states plainly it is "a proposed vocabulary only... for a
 * future Arc... to adopt or revise" — this Arc, being that future Arc,
 * revises it down to Alpha 863's own already-adopted coarseness for one
 * concrete reason: internal consistency between this Arc's two sibling
 * Authorities matters more than matching a not-yet-implemented proposal
 * document field-for-field, and a six-outcome vocabulary already
 * distinguishes exactly the one class `07_decryption_authority.md` itself
 * flagged as safe to distinguish (`"key-unavailable"`, resolved strictly
 * BEFORE any ciphertext is touched) from the deliberately undifferentiated
 * AEAD/tamper/associated-data-mismatch collapse (`"failed"`) — the
 * concrete case for a wider one-off vocabulary here dissolves once that
 * one distinction already both exists and matches the resolvable-first
 * Authority.
 *
 * No raw key is ever returned by anything in this file — `decrypt()`'s
 * own success case carries only the recovered plaintext bytes.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../../../../conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../../../../conversation/membership/fedos_conversation_membership_id.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../../../../conversation/envelope/fedos_conversation_message_envelope.js";

/**
 * Everything the Authority needs to re-derive the associated-data header
 * (Alpha 856) for byte-comparison after decrypt, and to resolve the key.
 * Every field here is the SAME Envelope-identifying field
 * `FedosConversationEncryptionRequest` accepts (`./fedos_conversation_encryption_authority.ts`)
 * — a caller reconstructs this request from the already-persisted
 * `FedosConversationMessageEnvelope` (Alpha 854) plus the already-stored
 * `ciphertext` bytes (`FedosConversationPayloadStorage`, Alpha 804),
 * never from anything new.
 */
export interface FedosConversationDecryptionRequest {
  readonly envelopeId: FedosConversationEnvelopeId;
  readonly conversationId: FedosConversationId;
  readonly senderMembershipId: FedosConversationMembershipId;
  readonly keyEpoch: number;
  readonly createdAt: number;
  readonly replyToEnvelopeId: FedosConversationEnvelopeId | null;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  readonly ciphertext: Uint8Array;
  /** ALREADY RESOLVED by the caller — see this file's own header. */
  readonly localAccountIndex: number;
  /** ALREADY RESOLVED, already-public 64-character hex — see this file's own header. */
  readonly counterpartyPublicKeyHex: string;
}

/** Alpha 865 — coarse, stable outcomes only; no raw `Error`, no provider detail, no secret. Mirrors `FedosConversationEncryptionResult`'s own shape exactly — see this file's own header for why. */
export type FedosConversationDecryptionResult =
  | { readonly outcome: "decrypted"; readonly plaintext: Uint8Array }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "unavailable" }
  | { readonly outcome: "failed" };

export interface FedosConversationDecryptionAuthority {
  /**
   * Resolves the local account's own key against the conversation's
   * OTHER participant, imports and opens `request.ciphertext`, then
   * strips and re-derives the Alpha 856 associated-data header and
   * byte-compares it before returning the recovered plaintext. Trusts
   * the caller already confirmed Membership readiness — see this file's
   * own header. A byte mismatch on the re-derived header (relocated or
   * tampered Envelope metadata) collapses into `"failed"`, the SAME
   * undifferentiated outcome a genuine AEAD authentication failure
   * produces — never a distinguishable reason, per this file's own
   * header (no oracle).
   */
  decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult>;
}
