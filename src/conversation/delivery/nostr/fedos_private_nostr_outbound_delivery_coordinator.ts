/**
 * Secure Runtime Alpha 1399–1410 (Phase B — Outbound Direct Delivery) of
 * the Alpha 1391–1470 Nostr Private Direct and Pairwise Fanout Delivery
 * Arc.
 *
 * `deliverEnvelope()` is the ONE operation that takes an ALREADY
 * locally-encrypted, ALREADY-persisted Direct Envelope (produced by the
 * EXISTING, unmodified `FedosConversationEncryptionCoordinator`, Alpha
 * 943) and delivers it to exactly one recipient over Nostr. It invokes
 * no crypto directly (Alpha 1401's own "do not duplicate plaintext") —
 * it only reads already-sealed ciphertext bytes and Envelope metadata,
 * builds the wire payload (`fedos_private_nostr_wire_payload.ts`), signs
 * via the injected real `FedosNostrSigningAuthority`, and publishes via
 * the injected `FedosPrivateNostrDeliveryPublisher`.
 *
 * IDEMPOTENT / RESTART-SAFE (Alpha 1406/1410): the delivery request id
 * is deterministic (`toFedosPrivateNostrDeliveryRequestId`); a prior
 * `"accepted"` Observation for that same subject id short-circuits to
 * `"already-delivered"` WITHOUT re-signing or re-publishing — signing
 * the identical wire payload twice would still be deterministic-content
 * but a fresh Nostr event id each time (fresh `created_at`), so this
 * gate is what actually prevents an uncontrolled duplicate wire event,
 * not signature determinism.
 *
 * Recipient resolution reuses `resolveFedosConversationCounterpartyPublicKeyHex`
 * (Alpha 934, UNCHANGED) — no new identity-resolution logic invented.
 */

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import type { FedosConversationMembershipAuthority } from "../../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { deserializeFedosConversationMessageEnvelope } from "../../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import type { FedosConversationPayloadStorage } from "../../payload_storage/fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../../payload_storage/fedos_conversation_payload_id.js";
import { resolveFedosConversationCounterpartyPublicKeyHex } from "../../encryption/identity/fedos_conversation_counterparty_public_key_resolver.js";
import type { FedosConversationLocalAccountIndexAuthority } from "../../encryption/identity/fedos_conversation_local_account_index_authority.js";
import type { FedosNostrSigningAuthority } from "../../../nostr/sign/fedos_nostr_signing_authority.js";
import { isWellFormedFedosNostrUnsignedEventRequest } from "../../../nostr/sign/fedos_nostr_signing_authority.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND, type FedosPrivateNostrDeliveryMode } from "./fedos_private_nostr_delivery_mode.js";
import {
  encodeFedosPrivateNostrWirePayload,
  type FedosPrivateNostrWireGroupLinkage,
} from "./fedos_private_nostr_wire_payload.js";
import {
  createFedosPrivateNostrDeliveryRequest,
  toFedosPrivateNostrDeliveryRequestId,
  type FedosPrivateNostrDeliveryRequestPersistence,
} from "./fedos_private_nostr_delivery_request.js";
import type { FedosPrivateNostrDeliveryPublisher } from "./fedos_private_nostr_delivery_publisher.js";
import { FedosDeliveryObservationRepository } from "../../../board/observation/fedos_delivery_observation_repository.js";
import { toFedosDeliveryObservationSubjectId } from "../../../board/observation/fedos_delivery_observation.js";
import type { FedosConversationId } from "../../fedos_conversation_id.js";

export type FedosPrivateNostrOutboundDeliveryResult =
  | { readonly outcome: "accepted"; readonly nostrEventId: string }
  | { readonly outcome: "already-delivered"; readonly nostrEventId: string | null }
  | { readonly outcome: "rejected" }
  | { readonly outcome: "failed" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "envelope-not-found" }
  | { readonly outcome: "payload-not-found" }
  | { readonly outcome: "unsupported-recipient" }
  | { readonly outcome: "signing-unavailable" }
  | { readonly outcome: "persistence-failed" };

export interface FedosPrivateNostrOutboundDeliveryOptions {
  readonly recipientMembershipId: string;
  readonly relayUrls: readonly string[];
  readonly mode: FedosPrivateNostrDeliveryMode;
  readonly expiresAt: number | null;
  readonly groupLinkage?: FedosPrivateNostrWireGroupLinkage | null;
}

export interface FedosPrivateNostrOutboundDeliveryCoordinatorDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly accountIndexAuthority: FedosConversationLocalAccountIndexAuthority;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly deliveryRequestPersistence: FedosPrivateNostrDeliveryRequestPersistence;
  readonly observationRepository: FedosDeliveryObservationRepository;
  readonly publisher: FedosPrivateNostrDeliveryPublisher;
  readonly clock: () => number;
}

export class FedosPrivateNostrOutboundDeliveryCoordinator {
  readonly #deps: FedosPrivateNostrOutboundDeliveryCoordinatorDependencies;

  constructor(deps: FedosPrivateNostrOutboundDeliveryCoordinatorDependencies) {
    this.#deps = deps;
  }

  async deliverEnvelope(
    conversationId: string,
    envelopeId: string,
    options: FedosPrivateNostrOutboundDeliveryOptions,
  ): Promise<FedosPrivateNostrOutboundDeliveryResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) return { outcome: "invalid-input" };
    if (typeof envelopeId !== "string" || envelopeId.length === 0) return { outcome: "invalid-input" };
    if (typeof options.recipientMembershipId !== "string" || options.recipientMembershipId.length === 0) {
      return { outcome: "invalid-input" };
    }
    if (!Array.isArray(options.relayUrls) || options.relayUrls.length === 0) return { outcome: "invalid-input" };

    const persistedEnvelope = this.#deps.envelopePersistence.getEnvelope(envelopeId);
    if (persistedEnvelope === null) return { outcome: "envelope-not-found" };
    const envelope = deserializeFedosConversationMessageEnvelope(persistedEnvelope);
    if (envelope === null || (envelope.conversationId as unknown as string) !== conversationId) {
      return { outcome: "envelope-not-found" };
    }

    const payloadId = toFedosConversationPayloadId(envelope.payloadId as unknown as string);
    if (payloadId === null) return { outcome: "envelope-not-found" };
    const payload = this.#deps.payloadStorage.getPayload(payloadId);
    if (payload === null) return { outcome: "payload-not-found" };

    const requestId = toFedosPrivateNostrDeliveryRequestId(conversationId, envelopeId, options.recipientMembershipId);
    const subjectId = toFedosDeliveryObservationSubjectId(requestId);
    if (subjectId === null) return { outcome: "invalid-input" };

    // Alpha 1406/1410 -- restart-safe idempotency: a prior accepted delivery is never re-published.
    const priorAccepted = this.#deps.observationRepository
      .list()
      .find((o) => o.subjectId === subjectId && o.state === "accepted");
    if (priorAccepted !== undefined) {
      return { outcome: "already-delivered", nostrEventId: null };
    }

    const memberships = this.#deps.membershipAuthority.listMemberships(conversationId as FedosConversationId);
    const recipientMembership = memberships.find((m) => (m.id as unknown as string) === options.recipientMembershipId);
    if (recipientMembership === undefined || recipientMembership.state !== "active") {
      return { outcome: "unsupported-recipient" };
    }
    const keyResolution = resolveFedosConversationCounterpartyPublicKeyHex(recipientMembership.participant);
    if (keyResolution.outcome !== "resolved") return { outcome: "unsupported-recipient" };

    const deliveryRequest = createFedosPrivateNostrDeliveryRequest({
      conversationId,
      envelopeId,
      recipientMembershipId: options.recipientMembershipId,
      recipientPublicKeyHex: keyResolution.publicKeyHex,
      relayUrls: options.relayUrls,
      mode: options.mode,
      expiresAt: options.expiresAt,
      createdAt: this.#deps.clock(),
    });
    if (deliveryRequest === null) return { outcome: "invalid-input" };
    const putResult = this.#deps.deliveryRequestPersistence.putRequest(deliveryRequest);
    if (putResult === "failed" || putResult === "conflict") return { outcome: "persistence-failed" };

    const now = this.#deps.clock();
    const wirePayload = {
      schemaVersion: 1 as const,
      envelopeId: envelope.id as unknown as string,
      conversationId: envelope.conversationId as unknown as string,
      senderMembershipId: envelope.senderMembershipId as unknown as string,
      keyEpoch: envelope.keyEpoch,
      createdAt: envelope.createdAt,
      replyToEnvelopeId: envelope.replyToEnvelopeId as unknown as string | null,
      suite: envelope.encryptionSuite,
      ciphertextBase64: Buffer.from(payload.bytes).toString("base64"),
      groupLinkage: options.groupLinkage ?? null,
    };
    const content = encodeFedosPrivateNostrWirePayload(wirePayload);

    const localAccountIndex = this.#deps.accountIndexAuthority.localAccountIndex();
    const unsignedRequest = {
      accountIndex: localAccountIndex,
      createdAt: now,
      kind: FEDOS_PRIVATE_NOSTR_DELIVERY_KIND,
      tags: [["p", keyResolution.publicKeyHex]],
      content,
    };
    if (!isWellFormedFedosNostrUnsignedEventRequest(unsignedRequest)) return { outcome: "invalid-input" };

    this.#deps.observationRepository.record(subjectId, "queued", now);

    const signed = await this.#deps.signingAuthority.signEvent(unsignedRequest);
    if (signed === null) return { outcome: "signing-unavailable" };

    this.#deps.observationRepository.record(subjectId, "publishing", this.#deps.clock());
    const publishOutcome = await this.#deps.publisher.publish(signed);
    const settledAt = this.#deps.clock();

    if (publishOutcome === "accepted") {
      this.#deps.observationRepository.record(subjectId, "accepted", settledAt);
      return { outcome: "accepted", nostrEventId: signed.id };
    }
    if (publishOutcome === "rejected") {
      this.#deps.observationRepository.record(subjectId, "rejected", settledAt);
      return { outcome: "rejected" };
    }
    this.#deps.observationRepository.record(subjectId, "failed", settledAt);
    return { outcome: "failed" };
  }
}
