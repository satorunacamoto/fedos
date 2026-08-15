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
 *
 * Secure Runtime Alpha 7561–7640 ("FedOS Conversation Outbox Restart
 * Hydration and Scheduler Scalability Arc") — the constructor now
 * hydrates `FedosConversationTransportScheduler`'s `initialDelivered`/
 * `initialAbandoned` seed from the already-durable Delivery Observation
 * history before constructing it (`fedos_conversation_transport_delivery_recovery_hydration.ts`,
 * ONE new pure, read-only file), so a restart no longer treats every
 * historical intent in the shared, whole-profile Outbox log as pending.
 * This is the ONE production construction site for
 * `FedosConversationTransportScheduler` (structurally enforced —
 * `test/secure_runtime_alpha_1471_1540_structural_guards.test.ts`
 * separately enforces there is exactly one production construction
 * site for THIS class); no second Scheduler, no second timer, no
 * persistence rewrite.
 */

import type { FedosConversationMessageEnvelope } from "../../../conversations/envelope/fedos_conversation_message_envelope.js";
import type { FedosConversationRelaySet } from "./relay/fedos_conversation_relay_set.js";
import type { FedosNostrSigningAuthority } from "../protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosPrivateWireAdapter } from "./fedos_private_wire_adapter.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../conversations/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../../../conversations/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationMembership } from "../../../conversations/membership/fedos_conversation_membership.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../../../conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosSubscriptionFilter } from "../../../desktop/fedos_subscription_filter.js";

import { deserializeFedosConversationMessageEnvelope } from "../../../conversations/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { FedosConversationTransportSignedEventSource } from "./fedos_conversation_transport_signed_event_source.js";
import { FedosMultiRelayOkCorrelatedConversationTransportPublisher } from "./relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.js";
import {
  FedosConversationInboundSubscription,
  type FedosConversationInboundEnvelopeListener,
  type FedosConversationInboundRumorListener,
} from "./relay/fedos_conversation_inbound_subscription.js";
import { FedosRelayEventDeduplicator } from "./relay/fedos_relay_event_deduplicator.js";
import type { FedosConversationTransportOutboxPersistence } from "./fedos_conversation_transport_outbox_persistence.js";
import {
  createFedosConversationTransportOutboxIntent,
  type FedosConversationTransportOutboxId,
} from "./fedos_conversation_transport_outbox_types.js";
import {
  serializeFedosConversationTransportOutboxIntent,
  serializeFedosConversationTransportOutboxRecordV2,
} from "./fedos_conversation_transport_outbox_codec.js";
import type { FedosConversationTransportOutboxPersistenceWriteResult } from "./fedos_conversation_transport_outbox_persistence.js";
import { resolveFedosConversationTransportRoute } from "./fedos_conversation_transport_routing.js";
import type { FedosPrivateWireDeliveryQueueOutcome } from "./fedos_private_wire_prepared_delivery.js";
import type { FedosConversationTransportPublisher } from "./fedos_conversation_transport_publisher.js";
import {
  FedosConversationTransportScheduler,
  type FedosConversationTransportSchedulerTickEntry,
} from "./fedos_conversation_transport_scheduler.js";
import {
  sendFedosConversationEphemeral,
  type FedosConversationEphemeralSendOutcome,
} from "./fedos_conversation_ephemeral_transport.js";

import { FedosDeliveryRetryRegistry } from "../../../board/observation/fedos_delivery_retry_registry.js";
import { FedosDeliveryObservationRepository } from "../../../board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../../../board/observation/fedos_delivery_observation_query.js";
import { FedosDeliveryRetryQuery } from "../../../board/observation/fedos_delivery_retry_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../../../board/observation/fedos_delivery_observation_write_validator.js";
import { hydrateFedosConversationTransportDeliveryRecoveryState } from "./fedos_conversation_transport_delivery_recovery_hydration.js";

export interface FedosPrivateTransportInboundConfig {
  readonly filter: FedosSubscriptionFilter;
  readonly onEnvelope: FedosConversationInboundEnvelopeListener;
  readonly deduplicator?: FedosRelayEventDeduplicator;
  /**
   * Secure Runtime Alpha 1841–1920 Phase D (Alpha 1856) — OPTIONAL.
   * Fires for a successfully unwrapped standard NIP-17 Rumor, classified
   * SEPARATELY from `onEnvelope` above (disjoint Nostr kinds — see
   * `FedosConversationInboundSubscription`'s own header). Only ever
   * invoked if this Transport was ALSO constructed with a
   * `wireAdapter` whose own `route` is `"nostr-nip17-v1"`.
   */
  readonly onRumor?: FedosConversationInboundRumorListener;
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
   * Standard Delivery Arc") Phase G (Alpha 1788) — OPTIONAL. Retrievable
   * via `wireAdapter()` below.
   *
   * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport
   * Integration and Group Pairwise Delivery Arc") Phase C (Alpha
   * 1843/1850) — this is now this Transport's own PLAINTEXT-SOURCING
   * SEAM CLOSURE point: `sendMailboxNip17()` below dispatches through
   * this adapter LIVE, at send time, while the caller (the application
   * send operation — `FedosConversationDirectMessagingCoordinator`,
   * transitively `FedosGroupSendCoordinator`) still holds the original
   * plaintext (Alpha 1842's own frozen Plaintext Ownership Decision —
   * plaintext belongs to the application send operation, is handed
   * ephemerally to ONE selected Wire Adapter, and is never retained by
   * this Transport, its Outbox, or Observation). The PRE-EXISTING
   * `sendMailbox()`/internal `FedosConversationTransportSignedEventSource`
   * path below is UNCHANGED — it remains the `fedos-private-v1` route's
   * own lazy, ciphertext-only resolution, exactly as before this Arc.
   */
  readonly wireAdapter?: FedosPrivateWireAdapter;
}

export class FedosPrivateTransport {
  readonly #relaySet: FedosConversationRelaySet;
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #localAccountIndex: number;
  readonly #outboxPersistence: FedosConversationTransportOutboxPersistence;
  readonly #envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly #payloadStorage: FedosConversationPayloadStorage;
  readonly #membershipsForConversation: (conversationId: FedosConversationId) => readonly FedosConversationMembership[];
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
    this.#payloadStorage = dependencies.payloadStorage;
    this.#membershipsForConversation = dependencies.membershipsForConversation;
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

    // Secure Runtime Alpha 7561-7640 (FedOS Conversation Outbox Restart
    // Hydration and Scheduler Scalability Arc) -- reconstructs terminal
    // delivery state from the ALREADY-DURABLE Delivery Observation
    // history BEFORE the Scheduler is constructed, so a restart treats
    // only genuinely pending intents as pending, mirroring Board's own
    // Alpha 585/586 hydration precedent
    // (`../../desktop/host/fedos_delivery_recovery_hydration.ts`). Pure
    // read against data this constructor already reads/builds (the same
    // `observationQuery` above) -- no new dependency, no new durable
    // backend, no new schema.
    const retryQuery = new FedosDeliveryRetryQuery(observationQuery);
    const recoveryState = hydrateFedosConversationTransportDeliveryRecoveryState(dependencies.outboxPersistence, retryQuery);

    this.#scheduler = new FedosConversationTransportScheduler({
      outboxPersistence: dependencies.outboxPersistence,
      publisher: this.#publisher,
      observationRepository: this.#validatingObservationRepository,
      intervalMs: dependencies.intervalMs,
      retryRegistry: dependencies.retryRegistry ?? new FedosDeliveryRetryRegistry(),
      now: this.#now,
      initialDelivered: recoveryState.delivered,
      initialAbandoned: recoveryState.abandoned,
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

  /**
   * Secure Runtime Alpha 1841–1920 Phase C (Alpha 1843/1850) — the
   * standard `nostr-nip17-v1` route's own send-time preparation +
   * durable enqueue, closing this Arc's own named plaintext-sourcing
   * blocker. Requires `plaintext` (the caller's OWN, still-in-scope
   * bytes — see `fedos_private_wire_prepared_delivery.ts`'s own header)
   * and a constructor-injected `wireAdapter` whose own `route` is
   * `"nostr-nip17-v1"` and which reports itself `isAvailable()` — an
   * unavailable/missing/wrong-route adapter fails closed to
   * `"route-unavailable"` BEFORE any Relay is ever reached (Alpha 1844's
   * own "fails closed BEFORE Relay publication" rule), never a silent
   * downgrade to `fedos-private-v1`.
   *
   * Sequence: read the ALREADY-persisted Envelope (fails closed if
   * absent/mismatched, exactly like `sendMailbox()` above) -> resolve
   * Direct-mode routing (`resolveFedosConversationTransportRoute()`,
   * reused unchanged) -> `wireAdapter.build()` with plaintext (the ONE
   * moment plaintext crosses this Transport, never persisted) -> persist
   * the ALREADY-SIGNED native event as an ADDITIVE `schemaVersion: 2`
   * Outbox record (`fedos_conversation_transport_outbox_codec.ts`) for
   * the existing Scheduler to publish on its own next tick, exactly like
   * any other Mailbox Delivery intent — no second Outbox domain, no
   * second Scheduler.
   */
  async sendMailboxNip17(
    envelopeId: FedosConversationEnvelopeId,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
  ): Promise<FedosPrivateWireDeliveryQueueOutcome> {
    if (!(plaintext instanceof Uint8Array) || plaintext.length === 0) return { outcome: "invalid-input" };

    const adapter = this.#wireAdapter;
    if (adapter === undefined || adapter.route !== "nostr-nip17-v1" || !adapter.isAvailable()) {
      return { outcome: "route-unavailable" };
    }

    const persistedEnvelope = this.#envelopePersistence.getEnvelope(envelopeId);
    if (persistedEnvelope === null || persistedEnvelope.conversationId !== conversationId) return { outcome: "invalid-input" };
    const envelope = deserializeFedosConversationMessageEnvelope(persistedEnvelope);
    if (envelope === null) return { outcome: "invalid-input" };

    const payload = this.#payloadStorage.getPayload(envelope.payloadId);
    if (payload === null) return { outcome: "failed" };

    const memberships = this.#membershipsForConversation(conversationId);
    const route = await resolveFedosConversationTransportRoute({
      memberships,
      signingAuthority: this.#signingAuthority,
      localAccountIndex: this.#localAccountIndex,
    });
    if (route.outcome === "local-membership-unresolved") return { outcome: "identity-unavailable" };
    if (route.outcome === "not-direct") return { outcome: "unauthorized" };
    if (route.outcome === "counterparty-not-nostr" || route.outcome === "invalid-counterparty-key") {
      return { outcome: "unsupported-recipient" };
    }

    const built = await adapter.build({
      envelope,
      ciphertext: payload.bytes,
      plaintext,
      counterpartyPublicKeyHex: route.counterpartyPublicKeyHex,
      localAccountIndex: route.localAccountIndex,
    });
    if (built.outcome !== "built-signed") return { outcome: "crypto-unavailable" };

    const record = serializeFedosConversationTransportOutboxRecordV2({
      envelopeId,
      conversationId,
      createdAt: persistedEnvelope.createdAt,
      recipientPublicKeyHex: route.counterpartyPublicKeyHex,
      nativeEvent: built.event,
    });
    const write = this.#outboxPersistence.putIntent(record);
    if (write === "failed" || write === "conflict") return { outcome: "persistence-failed" };

    // P0 Closure (conversation-discovery timing root cause): the periodic
    // Scheduler timer alone can leave a freshly-enqueued intent waiting up
    // to a full interval (`start()` arms via `setInterval`, no t=0 firing)
    // before its first real publish attempt. Fire an immediate best-effort
    // flush now — `tick()` is single-flight, so this is safe to race
    // against the periodic timer (a second call while one is in flight
    // just returns the same in-flight Promise, never double-publishes).
    // Deliberately NOT awaited: the enqueue is already durable via
    // `putIntent()` above, so this must not change this method's existing
    // return timing/contract for any caller. The periodic tick remains the
    // unmodified durable retry backstop if this attempt fails.
    void this.tick().catch(() => {});

    return { outcome: "queued", envelopeId };
  }

  /**
   * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet
   * Conversation Runtime and NIP-17 Integration Arc) — the control-message
   * counterpart of `sendMailboxNip17()` above, for ratchet-protocol
   * facts (Phase D session-establishment, Phase F ratchet message
   * payloads) that are NOT backed by an already-persisted Conversation
   * Envelope. Byte-for-byte the SAME route/adapter/Outbox mechanics —
   * still the SAME real NIP-17 Rumor -> Seal -> Gift Wrap pipeline, still
   * an additive `schemaVersion: 2` Outbox record, still published on the
   * existing Scheduler's own next tick — the ONE difference is that
   * `createdAt` and the outbox record id are supplied directly by the
   * caller (`controlId`) rather than resolved from a persisted Envelope
   * (there is none to resolve for a control fact). `envelope.id`/
   * `envelope.createdAt` are the ONLY two fields `NostrNip17V1WireAdapter.build()`
   * ever reads from its own `envelope` parameter (see that adapter's own
   * `build()` body) — every other field on the minimal stand-in object
   * below is inert and never inspected.
   */
  async sendMailboxNip17Control(
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ): Promise<FedosPrivateWireDeliveryQueueOutcome> {
    if (!(plaintext instanceof Uint8Array) || plaintext.length === 0) return { outcome: "invalid-input" };
    if (typeof controlId !== "string" || controlId.length === 0) return { outcome: "invalid-input" };

    const adapter = this.#wireAdapter;
    if (adapter === undefined || adapter.route !== "nostr-nip17-v1" || !adapter.isAvailable()) {
      return { outcome: "route-unavailable" };
    }

    const memberships = this.#membershipsForConversation(conversationId);
    const route = await resolveFedosConversationTransportRoute({
      memberships,
      signingAuthority: this.#signingAuthority,
      localAccountIndex: this.#localAccountIndex,
    });
    if (route.outcome === "local-membership-unresolved") return { outcome: "identity-unavailable" };
    if (route.outcome === "not-direct") return { outcome: "unauthorized" };
    if (route.outcome === "counterparty-not-nostr" || route.outcome === "invalid-counterparty-key") {
      return { outcome: "unsupported-recipient" };
    }

    const stubEnvelope = {
      id: controlId,
      conversationId,
      createdAt,
    } as unknown as FedosConversationMessageEnvelope;

    const built = await adapter.build({
      envelope: stubEnvelope,
      ciphertext: new Uint8Array(0),
      plaintext,
      counterpartyPublicKeyHex: route.counterpartyPublicKeyHex,
      localAccountIndex: route.localAccountIndex,
    });
    if (built.outcome !== "built-signed") return { outcome: "crypto-unavailable" };

    const record = serializeFedosConversationTransportOutboxRecordV2({
      envelopeId: controlId as unknown as FedosConversationEnvelopeId,
      conversationId,
      createdAt,
      recipientPublicKeyHex: route.counterpartyPublicKeyHex,
      nativeEvent: built.event,
    });
    const write = this.#outboxPersistence.putIntent(record);
    if (write === "failed" || write === "conflict") return { outcome: "persistence-failed" };

    // P0 Closure (conversation-discovery timing root cause) — see the
    // matching comment in `sendMailboxNip17()` above: immediate,
    // non-awaited, single-flight-safe best-effort flush so Direct Ratchet
    // control payloads (Phase D session-establishment, Phase F ratchet
    // messages) don't sit idle for a full Scheduler interval.
    void this.tick().catch(() => {});

    return { outcome: "queued", envelopeId: controlId };
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
      // Alpha 1841-1920 Phase D -- the nip17 adapter is passed through
      // ONLY when its own `route` is the standard one; a `wireAdapter`
      // constructed for some other route is never mistakenly used to
      // classify inbound events.
      const nip17Adapter =
        this.#wireAdapter !== undefined && this.#wireAdapter.route === "nostr-nip17-v1" ? this.#wireAdapter : undefined;
      const subscription = new FedosConversationInboundSubscription(
        this.#relaySet,
        identity.publicKeyHex,
        this.#inboundConfig.deduplicator,
        nip17Adapter,
      );
      await subscription.start(this.#inboundConfig.filter, this.#inboundConfig.onEnvelope, this.#inboundConfig.onRumor);
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
