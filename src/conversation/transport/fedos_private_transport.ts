/**
 * Secure Runtime Alpha 1471–1540 ("Private Transport Boundary and
 * Multi-Relay Delivery Arc") — the named top-level deliverable.
 *
 * `FedosPrivateTransport` is the boundary that actually moves an
 * already-encrypted `FedosConversationMessageEnvelope`
 * (`../envelope/fedos_conversation_message_envelope.ts`, Private
 * Delivery, UNCHANGED, reused) over one or more Nostr relays. It
 * composes, and constructs nothing silently beyond what its own injected
 * dependencies describe:
 *   - Mailbox Delivery: `FedosConversationTransportScheduler`
 *     (`./fedos_conversation_transport_scheduler.ts`) over a durable
 *     `FedosConversationTransportOutboxPersistence`.
 *   - Ephemeral Delivery: `sendFedosConversationEphemeral()`
 *     (`./fedos_conversation_ephemeral_transport.ts`).
 *   - Multiple Relay fan-out: `FedosMultiRelayOkCorrelatedConversationTransportPublisher`
 *     (`./relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.ts`)
 *     over a `FedosConversationRelaySet`.
 *   - Inbound Subscription + Relay Deduplication:
 *     `FedosConversationInboundSubscription`
 *     (`./relay/fedos_conversation_inbound_subscription.ts`), activated
 *     only when the caller supplies an `inbound` config — no silent
 *     "subscribe to everything" default.
 *   - Identity Resolution / Private Delivery reuse:
 *     `FedosConversationTransportSignedEventSource`
 *     (`./fedos_conversation_transport_signed_event_source.ts`).
 *
 * `membershipsForConversation` is an injected accessor rather than a
 * `FedosConversationRuntime` reference — the narrowest boundary a real
 * caller needs, matching `FedosConversationTransportSignedEventSource`'s
 * own identical discipline. A production caller (Runtime wiring,
 * `../../desktop/runtime/fedos_desktop_runtime.ts`) supplies `(id) =>
 * conversationRuntime.listMemberships(id)`.
 *
 * HARD GUARDRAILS:
 *   - No default Relay, Signing Authority, or durable backend is ever
 *     constructed here — every dependency is injected.
 *   - `start()`/`stop()` mirror `FedosPublishScheduler`'s own "may only
 *     be called once, from the [stopped/running] state" convention.
 *   - No Tor, onion, ActivityPub, AT Protocol, GUI, or Worker reference
 *     anywhere in this file.
 */

import type { FedosConversationRelaySet } from "./relay/fedos_conversation_relay_set.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosPrivateWireAdapter } from "./fedos_private_wire_adapter.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationMembership } from "../membership/fedos_conversation_membership.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosSubscriptionFilter } from "../../desktop/fedos_subscription_filter.js";

import { FedosConversationTransportSignedEventSource } from "./fedos_conversation_transport_signed_event_source.js";
import { FedosMultiRelayOkCorrelatedConversationTransportPublisher } from "./relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.js";
import {
  FedosConversationInboundSubscription,
  type FedosConversationInboundEnvelopeListener,
} from "./relay/fedos_conversation_inbound_subscription.js";
import { FedosRelayEventDeduplicator } from "./relay/fedos_relay_event_deduplicator.js";
import type { FedosConversationTransportOutboxPersistence } from "./fedos_conversation_transport_outbox_persistence.js";
import {
  createFedosConversationTransportOutboxIntent,
  type FedosConversationTransportOutboxId,
} from "./fedos_conversation_transport_outbox_types.js";
import { serializeFedosConversationTransportOutboxIntent } from "./fedos_conversation_transport_outbox_codec.js";
import type { FedosConversationTransportOutboxPersistenceWriteResult } from "./fedos_conversation_transport_outbox_persistence.js";
import type { FedosConversationTransportPublisher } from "./fedos_conversation_transport_publisher.js";
import {
  FedosConversationTransportScheduler,
  type FedosConversationTransportSchedulerTickEntry,
} from "./fedos_conversation_transport_scheduler.js";
import {
  sendFedosConversationEphemeral,
  type FedosConversationEphemeralSendOutcome,
} from "./fedos_conversation_ephemeral_transport.js";

import { FedosDeliveryRetryRegistry } from "../../board/observation/fedos_delivery_retry_registry.js";
import { FedosDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../../board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_write_validator.js";

export interface FedosPrivateTransportInboundConfig {
  readonly filter: FedosSubscriptionFilter;
  readonly onEnvelope: FedosConversationInboundEnvelopeListener;
  readonly deduplicator?: FedosRelayEventDeduplicator;
}

export interface FedosPrivateTransportDependencies {
  readonly relaySet: FedosConversationRelaySet;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly localAccountIndex: number;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly membershipsForConversation: (conversationId: FedosConversationId) => readonly FedosConversationMembership[];
  readonly outboxPersistence: FedosConversationTransportOutboxPersistence;
  readonly observationRepository: FedosDeliveryObservationRepository;
  readonly intervalMs: number;
  /** OPTIONAL override — omitted, a `FedosMultiRelayOkCorrelatedConversationTransportPublisher` over `relaySet` is constructed. */
  readonly publisher?: FedosConversationTransportPublisher;
  /** OPTIONAL — omitted, a fresh `FedosDeliveryRetryRegistry` is constructed (mirrors `FedosDesktopHost`'s own `#deliveryRetryRegistry` field, Alpha 531). */
  readonly retryRegistry?: FedosDeliveryRetryRegistry;
  readonly now?: () => number;
  /** OPTIONAL — Inbound Subscription is activated ONLY when this is supplied. No silent default subscription of any kind. */
  readonly inbound?: FedosPrivateTransportInboundConfig;
  /**
   * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap
   * Standard Delivery Arc") Phase G (Alpha 1788) — OPTIONAL. Narrow
   * constructor-injection ONLY: a caller MAY supply a
   * `FedosPrivateWireAdapter` (`fedos_private_wire_adapter.js`) and
   * retrieve it via `wireAdapter()` below, but this Transport's own
   * internal outbound dispatch (`FedosConversationTransportSignedEventSource`,
   * unchanged) and inbound path (`FedosConversationInboundSubscription`,
   * unchanged) do NOT yet route through it — that deeper rewiring is a
   * real, separate, deliberately deferred piece of work (see the
   * completion declaration's own honest boundary: the Transport's
   * existing outbound path resolves already-encrypted, plaintext-free
   * ciphertext via `FedosConversationMessageEnvelope`/
   * `FedosConversationPayloadStorage` — by design, neither ever carries
   * plaintext — BEFORE any Wire Adapter is reached, but the standard
   * NIP-17 route structurally requires the original plaintext; sourcing
   * it at the right seam without redesigning the Envelope/Payload
   * domains is real surgery this Arc's own "extend, don't redesign"
   * discipline does not rush). This field exists so a caller CAN start
   * holding/passing a real adapter reference today, ahead of that future
   * wiring, without a second breaking constructor change later.
   */
  readonly wireAdapter?: FedosPrivateWireAdapter;
}

export class FedosPrivateTransport {
  readonly #relaySet: FedosConversationRelaySet;
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #localAccountIndex: number;
  readonly #outboxPersistence: FedosConversationTransportOutboxPersistence;
  readonly #envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly #publisher: FedosConversationTransportPublisher;
  readonly #validatingObservationRepository: FedosValidatingDeliveryObservationRepository;
  readonly #observationRepository: FedosDeliveryObservationRepository;
  readonly #scheduler: FedosConversationTransportScheduler;
  readonly #now: () => number;
  readonly #inboundConfig: FedosPrivateTransportInboundConfig | undefined;
  readonly #wireAdapter: FedosPrivateWireAdapter | undefined;

  #inboundSubscription: FedosConversationInboundSubscription | null = null;
  #running = false;

  constructor(dependencies: FedosPrivateTransportDependencies) {
    this.#relaySet = dependencies.relaySet;
    this.#signingAuthority = dependencies.signingAuthority;
    this.#localAccountIndex = dependencies.localAccountIndex;
    this.#wireAdapter = dependencies.wireAdapter;
    this.#outboxPersistence = dependencies.outboxPersistence;
    this.#envelopePersistence = dependencies.envelopePersistence;
    this.#now = dependencies.now ?? Date.now;
    this.#inboundConfig = dependencies.inbound;

    const eventSource = new FedosConversationTransportSignedEventSource({
      envelopePersistence: dependencies.envelopePersistence,
      payloadStorage: dependencies.payloadStorage,
      membershipsForConversation: dependencies.membershipsForConversation,
      signingAuthority: dependencies.signingAuthority,
      localAccountIndex: dependencies.localAccountIndex,
    });

    this.#publisher =
      dependencies.publisher ??
      new FedosMultiRelayOkCorrelatedConversationTransportPublisher(dependencies.relaySet, eventSource.resolveSignedEvent);

    this.#observationRepository = dependencies.observationRepository;
    const observationQuery = new FedosDeliveryObservationQuery(dependencies.observationRepository);
    this.#validatingObservationRepository = new FedosValidatingDeliveryObservationRepository(
      dependencies.observationRepository,
      observationQuery,
    );

    this.#scheduler = new FedosConversationTransportScheduler({
      outboxPersistence: dependencies.outboxPersistence,
      publisher: this.#publisher,
      observationRepository: this.#validatingObservationRepository,
      intervalMs: dependencies.intervalMs,
      retryRegistry: dependencies.retryRegistry ?? new FedosDeliveryRetryRegistry(),
      now: this.#now,
    });
  }

  isRunning(): boolean {
    return this.#running;
  }

  /**
   * Secure Runtime Alpha 1761–1840 Phase G (Alpha 1788) — read-only
   * accessor for the OPTIONAL injected `FedosPrivateWireAdapter`, or
   * `undefined` if none was supplied at construction. See
   * `FedosPrivateTransportDependencies.wireAdapter`'s own doc comment
   * for the exact, honest scope of this injection today (retrievable,
   * not yet dispatched-through internally).
   */
  wireAdapter(): FedosPrivateWireAdapter | undefined {
    return this.#wireAdapter;
  }

  /**
   * Queues an envelope for Mailbox (durable) Delivery — idempotent by
   * `envelopeId` (`FedosConversationTransportOutboxPersistence.putIntent()`'s
   * own `"already-present"` semantics). Actual delivery happens on the
   * next `tick()` (driven by `start()`'s own internal timer, or a
   * caller-driven manual `tick()`).
   *
   * `createdAt` reuses the ALREADY-persisted Envelope's own `createdAt`
   * — never a fresh `Date.now()` read — the SAME "reuse the caller's own
   * already-chosen timestamp" discipline
   * `FedosDesktopHost.submitPostWithOutbox()` (Alpha 419) established for
   * the identical reason: a `Date.now()`-derived `createdAt` would make
   * two `sendMailbox()` calls for the SAME envelope, milliseconds apart,
   * produce two STRUCTURALLY DIFFERENT records for the same deterministic
   * id — a `"conflict"`, not the intended idempotent `"already-present"`.
   * Returns `"failed"` if no Envelope is persisted for `envelopeId` yet,
   * or if the persisted Envelope's own `conversationId` does not match
   * `conversationId` — never silently queues an intent for content that
   * cannot possibly resolve later.
   */
  sendMailbox(
    envelopeId: FedosConversationEnvelopeId,
    conversationId: FedosConversationId,
  ): FedosConversationTransportOutboxPersistenceWriteResult {
    const persistedEnvelope = this.#envelopePersistence.getEnvelope(envelopeId);
    if (persistedEnvelope === null || persistedEnvelope.conversationId !== conversationId) return "failed";

    const intent = createFedosConversationTransportOutboxIntent(envelopeId, conversationId, persistedEnvelope.createdAt);
    if (intent === null) return "failed";
    return this.#outboxPersistence.putIntent(serializeFedosConversationTransportOutboxIntent(intent));
  }

  /** Best-effort, one-attempt delivery — see `./fedos_conversation_ephemeral_transport.ts`'s own header for why this never touches the Outbox or Retry Registry. */
  async sendEphemeral(
    envelopeId: FedosConversationEnvelopeId,
    conversationId: FedosConversationId,
  ): Promise<FedosConversationEphemeralSendOutcome> {
    return sendFedosConversationEphemeral({
      envelopeId,
      conversationId,
      publisher: this.#publisher,
      observationRepository: this.#validatingObservationRepository,
      now: this.#now,
    });
  }

  /** Drives exactly one Mailbox Delivery pass, regardless of `start()`/`stop()` state — for tests/manual driving, mirrors `FedosPublishScheduler.tick()`. */
  tick(): Promise<readonly FedosConversationTransportSchedulerTickEntry[]> {
    return this.#scheduler.tick();
  }

  observationQuery(): FedosDeliveryObservationQuery {
    return new FedosDeliveryObservationQuery(this.#observationRepository);
  }

  /**
   * Connects every relay in the Relay Set, starts the Mailbox Scheduler's
   * own timer, and — ONLY if `inbound` was supplied at construction —
   * resolves this transport's own local public key
   * (`signingAuthority.publicIdentityForAccount(localAccountIndex)`) and
   * opens the Inbound Subscription. Throws if `inbound` was configured
   * but the local identity cannot be resolved (a genuine configuration
   * error — never silently skipped).
   */
  async start(): Promise<void> {
    if (this.#running) {
      throw new Error("FedosPrivateTransport.start() may only be called from the stopped state.");
    }
    this.#running = true;

    await this.#relaySet.connectAll();
    this.#scheduler.start();

    if (this.#inboundConfig !== undefined) {
      const identity = await this.#signingAuthority.publicIdentityForAccount(this.#localAccountIndex);
      if (identity === null) {
        this.#scheduler.stop();
        this.#running = false;
        throw new Error(
          "FedosPrivateTransport.start(): inbound was configured but the local Nostr identity could not be resolved for localAccountIndex.",
        );
      }
      const subscription = new FedosConversationInboundSubscription(
        this.#relaySet,
        identity.publicKeyHex,
        this.#inboundConfig.deduplicator,
      );
      await subscription.start(this.#inboundConfig.filter, this.#inboundConfig.onEnvelope);
      this.#inboundSubscription = subscription;
    }
  }

  /** Reverses `start()` exactly: stops the Inbound Subscription (if any), stops the Scheduler, then disconnects every relay. */
  async stop(): Promise<void> {
    if (!this.#running) {
      throw new Error("FedosPrivateTransport.stop() may only be called from the running state.");
    }
    this.#running = false;

    if (this.#inboundSubscription !== null) {
      await this.#inboundSubscription.stop();
      this.#inboundSubscription = null;
    }
    this.#scheduler.stop();
    await this.#relaySet.disconnectAll();
  }
}

/** Re-exported for callers that need the branded Outbox id type without importing `./fedos_conversation_transport_outbox_types.js` directly. */
export type { FedosConversationTransportOutboxId };
