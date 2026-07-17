/**
 * Secure Runtime Alpha 946 ("Decryption Coordinator") — Phase B of the
 * Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * The exact mirror of `FedosConversationEncryptionCoordinator`
 * (`./fedos_conversation_encryption_coordinator.ts`, Alpha 943) — same
 * fail-closed gates, same identity-resolution dependency
 * (`./identity/fedos_conversation_key_resolver.ts`, Alpha 935), same
 * reuse of the EXISTING, unmodified `FedosConversationDecryptionAuthority`
 * (Alpha 862/865/871). See that file's own header for the shared
 * rationale; this header only states what differs.
 *
 * NO COORDINATION LOG — deliberately, unlike its Encryption sibling.
 * Decryption performs no durable write of any kind (it only READS an
 * already-persisted Envelope and Payload and returns plaintext), so
 * there is no partial durable state to converge after a crash: a call
 * either succeeds or fails-closed identically on every invocation,
 * restart or no restart. Building a coordination log here would be
 * exactly the "generic saga framework" both sibling coordination logs'
 * own headers already disclaim.
 *
 * SEQUENCE: validate command -> load the Envelope (by id) -> FAIL CLOSED
 * unless it belongs to the requested Conversation -> load the
 * Conversation (draft record) -> FAIL CLOSED unless
 * `lifecycleState === "active"` -> resolve local identity -> Membership/
 * crypto readiness (Alpha 866, unmodified, using the ENVELOPE's own
 * recorded `encryptionSuite`/`keyEpoch` — never the caller's) -> resolve
 * Conversation key (Alpha 935) -> load the Payload (by id) -> decrypt
 * (Alpha 871, unmodified) -> return.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import { evaluateFedosConversationCryptoReadiness } from "./fedos_conversation_membership_readiness.js";
import type { FedosConversationDecryptionAuthority } from "./fedos_conversation_decryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { deserializeFedosConversationMessageEnvelope } from "../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { toFedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationIdentityResolver } from "./identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationKeyResolver } from "./identity/fedos_conversation_key_resolver.js";

export interface FedosConversationDecryptMessageCommand {
  readonly conversationId: string;
  readonly envelopeId: string;
}

export type FedosConversationDecryptionCoordinatorResult =
  | { readonly outcome: "decrypted"; readonly plaintext: Uint8Array }
  | { readonly outcome: "invalid-command" }
  | { readonly outcome: "envelope-not-found" }
  | { readonly outcome: "payload-not-found" }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "conversation-not-active" }
  | { readonly outcome: "not-member" }
  | { readonly outcome: "unsupported-suite" }
  | { readonly outcome: "unsupported-epoch" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "no-counterparty" }
  | { readonly outcome: "ambiguous-counterparty" }
  | { readonly outcome: "unsupported-counterparty-authority" }
  | { readonly outcome: "invalid-counterparty-public-key" }
  | { readonly outcome: "identity-binding-unavailable" }
  | { readonly outcome: "identity-binding-mismatch" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "decryption-failed" };

export interface FedosConversationDecryptionCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly keyResolver: FedosConversationKeyResolver;
  readonly decryptionAuthority: FedosConversationDecryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
}

export class FedosConversationDecryptionCoordinator {
  readonly #deps: FedosConversationDecryptionCoordinatorDependencies;

  constructor(deps: FedosConversationDecryptionCoordinatorDependencies) {
    this.#deps = deps;
  }

  async decrypt(command: FedosConversationDecryptMessageCommand): Promise<FedosConversationDecryptionCoordinatorResult> {
    if (command === null || typeof command !== "object") return { outcome: "invalid-command" };
    if (typeof command.conversationId !== "string" || command.conversationId.length === 0) return { outcome: "invalid-command" };
    if (typeof command.envelopeId !== "string" || command.envelopeId.length === 0) return { outcome: "invalid-command" };

    const conversationId = command.conversationId as FedosConversationId;
    const envelopeIdInput = toFedosConversationEnvelopeId(command.envelopeId);
    if (envelopeIdInput === null) return { outcome: "invalid-command" };

    const persistedEnvelope = this.#deps.envelopePersistence.getEnvelope(envelopeIdInput);
    if (persistedEnvelope === null) return { outcome: "envelope-not-found" };
    const envelope = deserializeFedosConversationMessageEnvelope(persistedEnvelope);
    if (envelope === null) return { outcome: "envelope-not-found" };
    if (envelope.conversationId !== conversationId) return { outcome: "envelope-not-found" };

    // Fail closed #2 — the Conversation must be "active". Reads the RAW
    // persisted `lifecycleState` field directly — see
    // `FedosConversationEncryptionCoordinator`'s own identical gate for the
    // full rationale (avoids a permanently-dead-code branch without
    // inventing any new way to construct an `"active"` record).
    const persistedDraft = this.#deps.draftPersistence.getDraft(conversationId);
    if (persistedDraft === null) return { outcome: "conversation-not-found" };
    if (persistedDraft.lifecycleState !== "active") return { outcome: "conversation-not-active" };

    // Fail closed #1 — resolve local identity.
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localParticipant = identity.creator;

    const readiness = evaluateFedosConversationCryptoReadiness(
      this.#deps.membershipAuthority,
      conversationId,
      localParticipant,
      envelope.encryptionSuite,
      envelope.keyEpoch,
    );
    if (readiness.outcome !== "ready") return { outcome: readiness.outcome };

    const keyResolution = await this.#deps.keyResolver.resolve(conversationId);
    if (keyResolution.outcome !== "resolved") return { outcome: keyResolution.outcome };

    const payload = this.#deps.payloadStorage.getPayload(envelope.payloadId);
    if (payload === null) return { outcome: "payload-not-found" };

    // Fail closed #3 — encryption unavailable propagates from the EXISTING Authority's own coarse vocabulary, unmodified.
    const decryption = await this.#deps.decryptionAuthority.decrypt({
      envelopeId: envelope.id,
      conversationId: envelope.conversationId,
      senderMembershipId: envelope.senderMembershipId,
      keyEpoch: envelope.keyEpoch,
      createdAt: envelope.createdAt,
      replyToEnvelopeId: envelope.replyToEnvelopeId,
      suite: envelope.encryptionSuite,
      ciphertext: payload.bytes,
      localAccountIndex: keyResolution.localAccountIndex,
      counterpartyPublicKeyHex: keyResolution.counterpartyPublicKeyHex,
    });
    if (decryption.outcome === "key-unavailable") return { outcome: "key-unavailable" };
    if (decryption.outcome !== "decrypted") return { outcome: "decryption-failed" };

    return { outcome: "decrypted", plaintext: decryption.plaintext };
  }
}
