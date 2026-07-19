/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") — the
 * indexable unit every sub-index in `src/conversation/search/` operates
 * on. One `FedosConversationSearchEnvelopeDocument` per already-real
 * `FedosConversationMessageEnvelope` (`../envelope/fedos_conversation_message_envelope.ts`,
 * Alpha 854) — never a new envelope shape, only the fields a search
 * index actually needs, plus one additive field: `text`.
 *
 * PLAINTEXT BOUNDARY (named, not silently dropped): `text` is
 * `string | null` — ALREADY-DECRYPTED plaintext, SUPPLIED BY THE
 * CALLER, exactly the SAME "ALREADY RESOLVED by the caller" idiom
 * `FedosConversationEncryptionRequest`/`FedosConversationDecryptionRequest`
 * already use for `localAccountIndex`/`counterpartyPublicKeyHex`
 * (`../encryption/fedos_conversation_encryption_authority.ts`,
 * `../encryption/fedos_conversation_decryption_authority.ts`, Alpha
 * 861/862). This Arc calls no Decryption Authority, touches no
 * ciphertext, reads no Payload byte, and derives no key — Payload
 * Storage's own bytes stay genuinely opaque
 * (`../payload_storage/fedos_conversation_payload_descriptor.ts`, Alpha
 * 803). Resolving `text` from a live Envelope/Payload pair is a
 * separate, not-yet-solved Decryption-Authority-wiring concern, named
 * here as this Arc's own remaining boundary — never silently assumed
 * solved. `text: null` means "no plaintext available to index" (a
 * group conversation, an unresolved key, or simply a caller that chose
 * not to decrypt yet) — the keyword index treats it as "nothing to
 * index for this document," never an error.
 *
 * HARD GUARDRAILS:
 *   - Every field `readonly`.
 *   - No ciphertext, no payload id, no key material of any kind — a
 *     document is deliberately NOT a full mirror of
 *     `FedosConversationMessageEnvelope`; `payloadId`/`encryptionSuite`/
 *     `keyEpoch` carry nothing a search index needs and are left out.
 *   - This file defines TYPES ONLY — no function, no class.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";

export interface FedosConversationSearchEnvelopeDocument {
  readonly envelopeId: FedosConversationEnvelopeId;
  readonly conversationId: FedosConversationId;
  readonly senderMembershipId: FedosConversationMembershipId;
  /** Unix seconds — matches `FedosConversationMessageEnvelope.createdAt`'s own convention. */
  readonly createdAt: number;
  readonly replyToEnvelopeId: FedosConversationEnvelopeId | null;
  /** Already-decrypted plaintext, or `null` — see this file's own header. */
  readonly text: string | null;
}
