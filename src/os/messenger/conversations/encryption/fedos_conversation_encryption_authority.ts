/**
 * Secure Runtime Alpha 861 ("Encryption Authority") / Alpha 863 (its own
 * result vocabulary) — Stage 1/3 of Phase B of the Alpha 851–890 Private
 * Message Envelope and Encryption Authority Activation Arc.
 *
 * Mirrors `FedosMasterSeedAuthority`'s own narrow-interface discipline
 * (`../../runtime/master_seed/fedos_master_seed_authority.ts`, Alpha
 * 438) and the review's own `06_encryption_authority.md` design-level
 * sketch, adapted to the REAL fields this Arc's own Envelope/Membership
 * domains now provide.
 *
 * Responsibilities (per `06_encryption_authority.md`, unchanged):
 *   - resolve key material internally (`resolveConversationKey`, Alpha
 *     869, already real).
 *   - generate the nonce (100% Rust-internal already — Alpha 867's own
 *     requirement is satisfied structurally: `fedos_encrypt`'s own
 *     `seal_internal` draws a fresh nonce every call, and Seam 2's
 *     TS-facing `encrypt()` has no nonce PARAMETER at all — a caller
 *     cannot select or reuse one even by accident. Verified by this
 *     Arc's own `resolve_conversation_key_*` Rust tests, and re-verified
 *     TypeScript-side in `test/secure_runtime_alpha_861_872_encryption_authority.test.ts`'s
 *     own "ciphertext differs across repeated encryption of the same
 *     plaintext" case).
 *   - build the associated-data header (`../envelope/fedos_conversation_envelope_associated_data.ts`,
 *     Alpha 856).
 *   - encrypt (reusing the EXISTING, real `encrypt()`,
 *     `../../runtime/fedos_runtime_encrypt.ts`).
 *
 * Non-responsibilities (per `06_encryption_authority.md`, unchanged):
 *   - Membership authorization — the CALLER (a Coordinator,
 *     `./fedos_conversation_encryption_coordinator.ts`) must already have
 *     confirmed readiness via `evaluateFedosConversationCryptoReadiness()`
 *     (`./fedos_conversation_membership_readiness.ts`, Alpha 866) BEFORE
 *     calling `encrypt()` here — this interface's own implementation
 *     trusts that already happened and performs no Membership lookup of
 *     its own.
 *   - payload/Envelope persistence — returns opaque ciphertext bytes
 *     only; persisting them into `FedosConversationPayloadStorage` and
 *     the Envelope metadata port is the Coordinator's own job.
 *   - Capability issuance, GUI, protocol publishing.
 *
 * NAMED SCOPE BOUNDARY, not invented here: the review's own
 * `09_direct_key_strategy.md` states plainly that it "does not design
 * the actual lookup mechanism that resolves 'the other participant's
 * public key' from a `FedosConversationId`" — that mapping (which
 * Membership record field, if any, carries a Nostr-account-resolvable
 * public key hex; how a `FedosConversationParticipantReference.publicIdentifier`
 * string, whatever its own encoding turns out to be, maps to the
 * `accountIndex`/`counterpartyPublicKeyHex` pair `resolveConversationKey()`
 * (Alpha 869) actually needs) is a genuinely separate Identity-domain
 * decision this Arc does not invent inline. `FedosConversationEncryptionRequest`
 * therefore accepts `localAccountIndex`/`counterpartyPublicKeyHex`
 * ALREADY RESOLVED, explicit fields — resolving them correctly from a
 * live Conversation/Membership pair is named here as this Arc's own
 * exact remaining activation-boundary blocker (`Alpha 890`'s own
 * completion declaration), not silently assumed solved.
 *
 * No raw key is ever returned by anything in this file — `encrypt()`'s
 * own success case carries only ciphertext bytes.
 *
 * CORRECTION (Alpha 870, resuming this Arc): the `localAccountIndex`/
 * `counterpartyPublicKeyHex` fields this header paragraph has always
 * described were missing from the actual `FedosConversationEncryptionRequest`
 * shape below — an interruption artifact of the session that wrote this
 * file's own header before finishing the shape it describes. Added now,
 * verbatim to what this header already promised; this is a completion of
 * Alpha 861's own already-declared contract, not a new design decision or
 * a renamed public interface (no prior commit ever shipped this
 * interface without them).
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../envelope/fedos_conversation_message_envelope.js";

/**
 * Everything the Authority needs to build the associated-data header
 * (Alpha 856) and perform the seal — `envelopeId`/`createdAt` are
 * ALREADY minted/chosen by the caller (a Coordinator) before this call,
 * since both are bound into the associated-data header itself and must
 * exist before encryption, not after.
 */
export interface FedosConversationEncryptionRequest {
  readonly envelopeId: FedosConversationEnvelopeId;
  readonly conversationId: FedosConversationId;
  readonly senderMembershipId: FedosConversationMembershipId;
  readonly keyEpoch: number;
  readonly createdAt: number;
  readonly replyToEnvelopeId: FedosConversationEnvelopeId | null;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  readonly plaintext: Uint8Array;
  /**
   * ALREADY RESOLVED by the caller — see this file's own header for why
   * resolving these two fields from a live Conversation/Membership pair
   * is this Arc's own named remaining blocker, not solved here.
   */
  readonly localAccountIndex: number;
  /** ALREADY RESOLVED, already-public 64-character hex — see this file's own header. */
  readonly counterpartyPublicKeyHex: string;
}

/** Alpha 863 — coarse, stable outcomes only; no raw `Error`, no provider detail, no secret. */
export type FedosConversationEncryptionResult =
  | { readonly outcome: "encrypted"; readonly ciphertext: Uint8Array }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "unavailable" }
  | { readonly outcome: "failed" };

export interface FedosConversationEncryptionAuthority {
  /**
   * Resolves the sender's own account key against the conversation's
   * OTHER participant, builds the Alpha 856 associated-data header,
   * prepends it to `request.plaintext`, and seals the result. Trusts the
   * caller already confirmed Membership readiness — see this file's own
   * header.
   */
  encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult>;
}
