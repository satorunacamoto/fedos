/**
 * Secure Runtime Alpha 1471–1540 — resolves an already-signed
 * `FedosNostrWireEvent` for a Mailbox/Ephemeral Delivery Outbox record.
 * Mirrors `FedosSigningAuthorityBoardPostEventSource`'s own exact role
 * (`../../board/publish/nostr/fedos_signing_authority_board_post_event_source.ts`,
 * Alpha 702/704: deserialize record → read the referenced domain object
 * → map to an unsigned request → sign) applied to a Conversation Envelope
 * instead of a Board post.
 *
 * Composes, never modifies:
 *   - `FedosConversationMessageEnvelopePersistence.getEnvelope()` (Alpha
 *     857) — the Envelope metadata this arc's own "Private Delivery"
 *     reuse instruction names.
 *   - `FedosConversationPayloadStorage.getPayload()` (Alpha 804) — the
 *     ciphertext bytes `FedosConversationEncryptionAuthority.encrypt()`
 *     already produced upstream; this file never encrypts anything.
 *   - `resolveFedosConversationTransportRoute()`
 *     (`./fedos_conversation_transport_routing.ts`) — the Identity
 *     Resolution reuse this arc's own routing file implements.
 *   - `buildFedosPrivateTransportUnsignedEventRequest()`
 *     (`./fedos_conversation_transport_event.ts`).
 *   - `FedosNostrSigningAuthority.signEvent()` (Alpha 442–445, UNCHANGED).
 *
 * `membershipsForConversation` is a narrow accessor, `(conversationId) =>
 * readonly FedosConversationMembership[]`, rather than the whole
 * `FedosConversationRuntime` — the SAME "narrowest boundary a real
 * caller needs" discipline `FedosSigningAuthorityBoardPostEventSource`
 * itself uses for its own `boardReaderAccessor`. A production caller
 * supplies `(id) => conversationRuntime.listMemberships(id)`.
 *
 * Returns `null` (never throws) whenever the Envelope/Payload is not yet
 * durable, the route cannot be resolved, or signing itself fails — every
 * one of these is a legitimate "not ready yet, try again later"
 * condition for the Scheduler, not a permanent error.
 *
 * Secure Runtime Alpha 1841–1920 Phase B (Alpha 1843/1848) — ADDITIVELY
 * handles a `schemaVersion: 2` (standard `nostr-nip17-v1`) record FIRST,
 * BEFORE any V1 handling: it already carries an already-signed native
 * Gift Wrap event (`FedosPreparedPrivateDelivery`, prepared once, at
 * SEND time, while plaintext was still in scope — see
 * `fedos_private_wire_prepared_delivery.ts`'s own header for why this is
 * the ONLY sound retry strategy) and is returned VERBATIM — no Envelope/
 * Payload/route re-derivation, no re-signing, ever. Every V1 record
 * continues through the ORIGINAL, byte-for-byte unchanged lazy-resolution
 * path below.
 */

import {
  deserializeFedosConversationTransportOutboxIntent,
  deserializeFedosConversationTransportOutboxRecordV2,
} from "./fedos_conversation_transport_outbox_codec.js";
import type { FedosPersistedConversationTransportOutboxRecord } from "./fedos_conversation_transport_outbox_codec.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../conversations/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { deserializeFedosConversationMessageEnvelope } from "../../../conversations/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import type { FedosConversationPayloadStorage } from "../../../conversations/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationMembership } from "../../../conversations/membership/fedos_conversation_membership.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";
import type { FedosNostrSigningAuthority } from "../protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrWireEvent } from "../../../desktop/fedos_nostr_wire_event.js";
import { resolveFedosConversationTransportRoute } from "./fedos_conversation_transport_routing.js";
import { buildFedosPrivateTransportUnsignedEventRequest } from "./fedos_conversation_transport_event.js";

export interface FedosConversationTransportSignedEventSourceDependencies {
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly membershipsForConversation: (conversationId: FedosConversationId) => readonly FedosConversationMembership[];
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly localAccountIndex: number;
}

export class FedosConversationTransportSignedEventSource {
  readonly #envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly #payloadStorage: FedosConversationPayloadStorage;
  readonly #membershipsForConversation: (conversationId: FedosConversationId) => readonly FedosConversationMembership[];
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #localAccountIndex: number;

  constructor(dependencies: FedosConversationTransportSignedEventSourceDependencies) {
    this.#envelopePersistence = dependencies.envelopePersistence;
    this.#payloadStorage = dependencies.payloadStorage;
    this.#membershipsForConversation = dependencies.membershipsForConversation;
    this.#signingAuthority = dependencies.signingAuthority;
    this.#localAccountIndex = dependencies.localAccountIndex;
  }

  resolveSignedEvent = async (
    record: FedosPersistedConversationTransportOutboxRecord,
  ): Promise<FedosNostrWireEvent | null> => {
    if ((record as { schemaVersion?: unknown }).schemaVersion === 2) {
      const v2 = deserializeFedosConversationTransportOutboxRecordV2(record);
      return v2 === null ? null : v2.nativeEvent;
    }

    const intent = deserializeFedosConversationTransportOutboxIntent(record);
    if (intent === null) return null;

    const persistedEnvelope = this.#envelopePersistence.getEnvelope(intent.envelopeId);
    if (persistedEnvelope === null) return null;
    const envelope = deserializeFedosConversationMessageEnvelope(persistedEnvelope);
    if (envelope === null) return null;

    const payload = this.#payloadStorage.getPayload(envelope.payloadId);
    if (payload === null) return null;

    const memberships = this.#membershipsForConversation(envelope.conversationId);
    const route = await resolveFedosConversationTransportRoute({
      memberships,
      signingAuthority: this.#signingAuthority,
      localAccountIndex: this.#localAccountIndex,
    });
    if (route.outcome !== "resolved") return null;

    const request = buildFedosPrivateTransportUnsignedEventRequest({
      envelope,
      ciphertext: payload.bytes,
      counterpartyPublicKeyHex: route.counterpartyPublicKeyHex,
      localAccountIndex: route.localAccountIndex,
    });

    return this.#signingAuthority.signEvent(request);
  };
}
