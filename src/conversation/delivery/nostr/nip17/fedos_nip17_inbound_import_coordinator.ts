/**
 * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport Integration
 * and Group Pairwise Delivery Arc") Phase D (Alpha 1856–1861) — Direct
 * Inbound for the standard `nostr-nip17-v1` route.
 *
 * `receiveRumor()` is the ONE inbound entry point for an ALREADY fully
 * unwrapped, fully authenticated Rumor (`FedosPrivateWireParsedRumor`,
 * `../../../transport/fedos_private_wire_adapter.ts`) — the caller
 * (an inbound subscription dispatching through `NostrNip17V1WireAdapter.parse()`)
 * has already done Gift-Wrap-signature verification, NIP-44 Seal
 * decryption, and inner-Rumor structural validation (Alpha 1858: "no
 * TypeScript-side crypto beyond calling the reviewed Authority
 * boundary" — this file performs none either, beyond the SAME
 * `FedosConversationEncryptionAuthority.encrypt()` boundary Alpha 861
 * already reviewed).
 *
 * Modeled DIRECTLY on `FedosPrivateNostrInboundDeliveryCoordinator`
 * (`../fedos_private_nostr_inbound_delivery_coordinator.ts`, Alpha
 * 1419–1428) — the SAME pipeline shape, reusing its own Conversation
 * Resolution function (`resolveFedosPrivateNostrInboundDirectConversation()`,
 * UNCHANGED) verbatim. The ONE genuine difference: that proprietary
 * coordinator stores the received WIRE CIPHERTEXT verbatim (it already
 * IS FedOS AEAD ciphertext, decryptable later by the unmodified
 * `FedosConversationDecryptionAuthority`). A NIP-17 Rumor's own
 * `.content` is PLAIN TEXT (NIP-17's own requirement) — there is no
 * FedOS ciphertext form for it. Alpha 1860 ("import once into EXISTING
 * Envelope/Payload/Conversation stores") is satisfied here by calling
 * the SAME, already-reviewed `FedosConversationEncryptionAuthority.encrypt()`
 * (Alpha 861/863/870, UNCHANGED) directly — exactly the reviewed
 * boundary the proprietary coordinator's own header names for its
 * OUTBOUND analog — to re-seal the plaintext for LOCAL storage-at-rest
 * ONLY, attributed to the COUNTERPARTY as sender (an explicit,
 * caller-supplied `senderMembershipId`, never the local user's own).
 * This is NOT "duplicating Conversation encryption" (an absolute
 * prohibition this Arc names): it is the SAME local storage-at-rest
 * mechanism every OTHER Envelope in this Conversation already uses,
 * applied once, locally, to content this runtime has ALREADY verified
 * end-to-end over the wire via real NIP-44/NIP-59 crypto — the
 * resulting local envelope is transparently readable through the
 * EXISTING, UNMODIFIED `readDirectMessage()`/`decryptionCoordinator.decrypt()`
 * path with ZERO changes to either.
 *
 * Alpha 1861 (Dedup identity) — keyed by the Rumor's OWN NIP-01 `id`
 * (`rumor.envelopeId` — see `FedosPrivateWireParsedRumor`'s own doc
 * comment: "the Rumor's own id... even though the Rumor itself is
 * never signed"), NEVER the outer Gift Wrap's own event id. This is the
 * canonical dedup identity across: the same Gift Wrap from two Relays
 * (Multi-Relay fan-out + `FedosRelayEventDeduplicator` already collapse
 * this before this file is ever reached), a re-wrap of the identical
 * Rumor inside a DIFFERENT Gift Wrap (a different outer event id, a
 * different ephemeral key, but the SAME inner Rumor id) — the Rumor id
 * is the one thing invariant across every legitimate re-delivery of
 * "the same logical message."
 *
 * Alpha 1859 (Admission Gate) — `resolveFedosPrivateNostrInboundDirectConversation()`
 * NEVER auto-creates a Conversation or Membership; an unmatched sender
 * is quarantined/dropped (`"unknown-sender"`), identically to the
 * proprietary route.
 */

import type { FedosConversationDraftPersistence } from "../../../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../../activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../../../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationEncryptionAuthority } from "../../../encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { serializeFedosConversationMessageEnvelope } from "../../../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { validateFedosConversationMessageEnvelope } from "../../../envelope/fedos_conversation_message_envelope_validator.js";
import {
  toFedosConversationEnvelopeId,
  type FedosConversationEnvelopeIdGenerator,
} from "../../../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../../../payload_storage/fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId, type FedosConversationPayloadIdGenerator } from "../../../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../../../fedos_conversation_id.js";
import { FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH } from "../../../encryption/fedos_conversation_membership_readiness.js";
import { resolveFedosPrivateNostrInboundDirectConversation } from "../fedos_private_nostr_inbound_conversation_resolver.js";
import {
  createFedosPrivateNostrImportRecord,
  type FedosPrivateNostrImportRecordPersistence,
} from "../fedos_private_nostr_import_record.js";
import type { FedosPrivateWireParsedRumor } from "../../../transport/fedos_private_wire_adapter.js";

export type FedosNip17InboundReceiveResult =
  | { readonly outcome: "imported"; readonly conversationId: string; readonly envelopeId: string }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "unknown-sender" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "invalid-rumor" }
  | { readonly outcome: "encryption-failed" }
  | { readonly outcome: "persistence-failed" };

export interface FedosNip17InboundImportCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly localAccountIndex: number;
  readonly encryptionAuthority: FedosConversationEncryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly envelopeIdGenerator: FedosConversationEnvelopeIdGenerator;
  readonly payloadIdGenerator: FedosConversationPayloadIdGenerator;
  readonly importRecordPersistence: FedosPrivateNostrImportRecordPersistence;
  readonly clock: () => number;
}

export class FedosNip17InboundImportCoordinator {
  readonly #deps: FedosNip17InboundImportCoordinatorDependencies;

  constructor(deps: FedosNip17InboundImportCoordinatorDependencies) {
    this.#deps = deps;
  }

  async receiveRumor(rumor: FedosPrivateWireParsedRumor, relaySource: string | null): Promise<FedosNip17InboundReceiveResult> {
    if (typeof rumor.envelopeId !== "string" || rumor.envelopeId.length === 0) return { outcome: "invalid-rumor" };
    if (typeof rumor.senderPublicKeyHex !== "string" || rumor.senderPublicKeyHex.length === 0) return { outcome: "invalid-rumor" };
    if (typeof rumor.content !== "string") return { outcome: "invalid-rumor" };

    // Alpha 1861 -- dedup BEFORE any decrypt/re-encrypt, keyed by the
    // Rumor's OWN id -- stable across re-wraps in a different Gift Wrap.
    const existingImport = this.#deps.importRecordPersistence.getImport(rumor.envelopeId);
    if (existingImport !== null) return { outcome: "duplicate" };

    // Alpha 1859 -- admission gate. Never auto-creates a Conversation.
    const resolution = resolveFedosPrivateNostrInboundDirectConversation(
      {
        draftPersistence: this.#deps.draftPersistence,
        activationPersistence: this.#deps.activationPersistence,
        membershipAuthority: this.#deps.membershipAuthority,
        identityResolver: this.#deps.identityResolver,
      },
      rumor.senderPublicKeyHex,
    );
    if (resolution.outcome === "identity-unavailable") return { outcome: "identity-unavailable" };
    if (resolution.outcome === "unknown-sender") return { outcome: "unknown-sender" };

    const now = this.#deps.clock();
    const localEnvelopeIdRaw = this.#deps.envelopeIdGenerator.generateEnvelopeId();
    const localEnvelopeId = toFedosConversationEnvelopeId(localEnvelopeIdRaw);
    const localPayloadId = toFedosConversationPayloadId(this.#deps.payloadIdGenerator.generatePayloadId());
    if (localEnvelopeId === null || localPayloadId === null) return { outcome: "persistence-failed" };

    // Alpha 1860 -- local storage-at-rest, via the SAME already-reviewed
    // Authority boundary (Alpha 861/863/870), never a new crypto path.
    // `senderMembershipId` is the COUNTERPARTY's (this is THEIR message),
    // never the local participant's own.
    const plaintext = new TextEncoder().encode(rumor.content);
    const conversationId = resolution.conversationId as FedosConversationId;
    const encryption = await this.#deps.encryptionAuthority.encrypt({
      envelopeId: localEnvelopeId,
      conversationId,
      senderMembershipId: resolution.counterpartyMembership.id,
      keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
      createdAt: now,
      replyToEnvelopeId: null,
      suite: "ChaCha20Poly1305",
      plaintext,
      localAccountIndex: this.#deps.localAccountIndex,
      counterpartyPublicKeyHex: rumor.senderPublicKeyHex,
    });
    if (encryption.outcome !== "encrypted") return { outcome: "encryption-failed" };

    const localPayloadDescriptor = {
      id: localPayloadId,
      conversationId,
      mediaType: "application/octet-stream" as const,
      byteLength: encryption.ciphertext.length,
      createdAt: now,
    };
    const payloadWrite = this.#deps.payloadStorage.putPayload(localPayloadDescriptor, encryption.ciphertext);
    if (payloadWrite === "failed" || payloadWrite === "conflict") return { outcome: "persistence-failed" };

    const localEnvelope = validateFedosConversationMessageEnvelope({
      id: localEnvelopeId,
      conversationId: resolution.conversationId,
      senderMembershipId: resolution.counterpartyMembership.id as unknown as string,
      payloadId: localPayloadId,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
      createdAt: now,
      replyToEnvelopeId: null,
    });
    if (localEnvelope === null) return { outcome: "invalid-rumor" };
    const envelopeWrite = this.#deps.envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(localEnvelope));
    if (envelopeWrite === "failed" || envelopeWrite === "conflict") return { outcome: "persistence-failed" };

    const importRecord = createFedosPrivateNostrImportRecord({
      nostrEventId: rumor.envelopeId,
      conversationId: resolution.conversationId,
      envelopeId: localEnvelopeId,
      relaySource,
      receivedAt: now,
      importResult: "imported",
    });
    if (importRecord === null) return { outcome: "persistence-failed" };
    this.#deps.importRecordPersistence.putImportFact(importRecord);

    return { outcome: "imported", conversationId: resolution.conversationId, envelopeId: localEnvelopeId };
  }
}
