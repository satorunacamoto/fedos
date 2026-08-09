/**
 * OS Capability Modularization — real `TransportPort` adapter over Nostr
 * (Compatibility Facade Reduction + Package Extraction Readiness +
 * Remaining Architecture Debt Closure arc, Agent P).
 *
 * CONCURRENCY NOTE (binding on this file's own design, not just a comment):
 * Agent N, this same arc, is consolidating Nostr relay/socket-layer
 * duplication under `src/os/messenger/adapters/nostr/**` in parallel with
 * this file. This adapter therefore delegates ONLY to the two STABLE,
 * already-public entry points that predate and sit outside that
 * consolidation's own scope:
 *   - `./nostr/protocol/publish.js`'s `RelayPublisher` interface (write
 *     path — publish an already-signed event, await NIP-20 OK).
 *   - `./nostr/protocol/relay.js`'s `RelayAdapter` interface (read path —
 *     query for events matching a filter).
 * It deliberately does NOT import `./nostr/protocol/ws_relay.js`,
 * `os/messenger/desktop/websocket_relay.js`, `FedosRelay`,
 * `FedosConversationRelaySet`, or any retry/backoff/reconnect internals —
 * exactly the files this arc's own kickoff brief names as Agent N's
 * active-restructuring risk. Both `RelayPublisher` and `RelayAdapter` are
 * INTERFACES this adapter depends on and is handed a concrete
 * implementation of by its caller (the composition root) — this file
 * never constructs a `WebSocketRelayPublisher`/`WebSocketRelayAdapter`
 * itself, so it has no compile-time coupling to whichever concrete class
 * Agent N's pass leaves those interfaces backed by. If Agent N's work
 * changes either INTERFACE's shape (not just its concrete
 * implementation), this file breaks loudly at `typecheck:core` — see this
 * arc's own report for how that was re-verified at the end.
 *
 * WHAT THIS ADAPTER DOES NOT DO — and why that is a deliberate design
 * choice, not a gap: it never chooses a Nostr event `kind`, never
 * signs anything, never decides whether a payload should be public
 * (plain kind-1) or private (NIP-17 gift-wrapped/sealed). Every real
 * signing authority in this codebase enforces a CLOSED, purpose-specific
 * `kind` allowlist (`FedosNostrSigningAuthority.signEvent()`,
 * `./nostr/protocol/sign/fedos_nostr_signing_authority.ts` — exactly two
 * kinds, a public post and one FedOS-proprietary private-delivery kind,
 * each with its own encryption/sealing pipeline). A generic
 * `TransportPort` adapter has no business re-deciding that policy per
 * payload — doing so here would risk silently sending something private
 * in a public event, or vice versa. Instead, ALL of that stays behind an
 * injected `NostrTransportEventSource`: the composition root supplies one
 * already wired to whatever kind/sealing pipeline is correct for its own
 * use (e.g. the NIP-17 gift-wrap pipeline for private delivery), and this
 * adapter's own job stays exactly what `docs/architecture/ADDING-AN-ADAPTER.md`
 * prescribes for every adapter in this repo: "the class does the
 * TRANSLATING ONLY."
 *
 * LIFECYCLE HONESTY: neither `RelayPublisher` nor `RelayAdapter` exposes a
 * persistent "is this socket open" concept — both this repo's own real
 * implementations (`WebSocketRelayPublisher`/`WebSocketRelayAdapter`, in
 * the file this adapter deliberately does not import) open one
 * short-lived socket PER OPERATION and close it when done. `connect()`/
 * `disconnect()`/`status()` here therefore toggle a logical "armed" flag
 * this adapter owns (gating whether `send()`/`subscribe()` polling are
 * allowed to run at all), not a real socket's open/closed state — stated
 * here so a reader does not assume this class holds a live connection
 * handle it does not.
 *
 * SUBSCRIBE IS POLL-BASED, HONESTLY: `RelayAdapter.query()` is a
 * request/response call, not a push stream (mirrors
 * `WebSocketRelayAdapter.query()`'s own REQ -> collect -> EOSE -> CLOSE
 * shape, one full round-trip per call). `subscribe()` here therefore
 * starts a `setInterval` poll loop per destination while connected,
 * deduplicating by event id so a handler is never fired twice for the
 * same inbound event. This is the same class of honest gap
 * `FedosMessengerMessagingPortAdapter.onMessage()`/`dispatchInbound()`
 * already documents for `MessagingPort` — poll/pull, not a live push
 * subscription — surfaced here on purpose rather than hidden behind a
 * push-shaped method name that would overpromise.
 */

import type {
  TransportConnectionStatus,
  TransportEndpointRef,
  TransportHandler,
  TransportMessageId,
  TransportPort,
  TransportSendResult,
  TransportUnsubscribe,
} from "../../core/ports/transport_port.js";
import type { RelayPublisher } from "./nostr/protocol/publish.js";
import type { NostrFilter, RelayAdapter } from "./nostr/protocol/relay.js";
import type { NostrEvent } from "./nostr/protocol/types.js";

/**
 * Everything Nostr-domain-specific this adapter needs but deliberately
 * does not decide for itself — see this file's own header. The
 * composition root supplies one instance, already wired to the correct
 * kind/signing/sealing pipeline for its own use case.
 */
export interface NostrTransportEventSource {
  /**
   * Produces an already fully-formed, already-signed `NostrEvent` ready to
   * hand to a `RelayPublisher`, for sending `payload` to `destination`, or
   * `null` if it cannot (no identity/key currently available, destination
   * does not resolve to a valid recipient, or any other reason the source
   * chooses not to detail further). Never throws — a source-side failure
   * is always `null`, mapped by this adapter to
   * `TransportSendFailureReason: "invalid-destination"` (the most common
   * real cause; see `send()`'s own doc comment).
   */
  prepareOutboundEvent(destination: TransportEndpointRef, payload: Uint8Array): Promise<NostrEvent | null>;

  /**
   * Decodes one inbound `NostrEvent` (already matched by `filterFor()`'s
   * own filter) into plain payload bytes, or `null` if this event is not
   * genuinely addressed to us, fails to decrypt/unwrap, or is otherwise
   * not deliverable. Never throws.
   */
  decodeInboundEvent(event: NostrEvent): Promise<Uint8Array | null>;

  /**
   * Builds the NIP-01 filter `subscribe()` polls with for `destination`.
   * Pure and synchronous — never throws, never performs I/O.
   */
  filterFor(destination: TransportEndpointRef): NostrFilter;
}

export interface NostrTransportAdapterOptions {
  readonly publisher: RelayPublisher;
  readonly relayAdapter: RelayAdapter;
  readonly eventSource: NostrTransportEventSource;
  /** Poll interval for active subscriptions, in milliseconds. Defaults to 5000. */
  readonly pollIntervalMs?: number;
}

interface Subscription {
  readonly destination: TransportEndpointRef;
  readonly filter: NostrFilter;
  readonly handler: TransportHandler;
  readonly seenEventIds: Set<string>;
  timer: ReturnType<typeof setInterval> | null;
}

const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * Real `TransportPort` implementation over Nostr, delegating all wire I/O
 * to an injected `RelayPublisher`/`RelayAdapter` pair and all Nostr-domain
 * decisions (kind, signing, sealing) to an injected
 * `NostrTransportEventSource`. See this file's own header for the full
 * design rationale.
 */
export class NostrTransportAdapter implements TransportPort {
  readonly #publisher: RelayPublisher;
  readonly #relayAdapter: RelayAdapter;
  readonly #eventSource: NostrTransportEventSource;
  readonly #pollIntervalMs: number;
  readonly #subscriptions = new Map<TransportEndpointRef, Subscription>();
  #status: TransportConnectionStatus = "disconnected";

  constructor(options: NostrTransportAdapterOptions) {
    this.#publisher = options.publisher;
    this.#relayAdapter = options.relayAdapter;
    this.#eventSource = options.eventSource;
    this.#pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  /**
   * Flips the logical "armed" flag to `"connected"` and starts polling
   * every already-registered `subscribe()` destination. Never throws —
   * see this file's own header for why this never touches a real socket
   * directly (`RelayPublisher`/`RelayAdapter` each own their own
   * short-lived connections per operation).
   */
  async connect(): Promise<TransportConnectionStatus> {
    this.#status = "connected";
    for (const subscription of this.#subscriptions.values()) {
      this.#startPolling(subscription);
    }
    return this.#status;
  }

  /** Flips the logical "armed" flag to `"disconnected"` and stops every active poll loop. `send()` fails closed afterward. Idempotent; never throws. */
  async disconnect(): Promise<void> {
    this.#status = "disconnected";
    for (const subscription of this.#subscriptions.values()) {
      this.#stopPolling(subscription);
    }
  }

  status(): TransportConnectionStatus {
    return this.#status;
  }

  /**
   * `prepareOutboundEvent()` returning `null` maps to
   * `"invalid-destination"` (rather than a more generic `"failed"`) on
   * the documented assumption that an unroutable/unresolvable destination
   * is the far more common real cause than a malformed payload, since
   * `payload` is already opaque bytes by the time it reaches the event
   * source. A `!accepted` `PublishResult` (relay rejection, socket error,
   * or timeout — `RelayPublisher` collapses all three into one boolean,
   * see `publish.ts`'s own header) maps to `"rejected"` with
   * `retryPolicy: "later"`, mirroring the real Mailbox Outbox's own
   * generic "a relay-side failure is usually worth retrying, not fatal"
   * disposition.
   */
  async send(destination: TransportEndpointRef, payload: Uint8Array): Promise<TransportSendResult> {
    if (this.#status !== "connected" && this.#status !== "degraded") {
      return { sent: false, reason: "not-connected" };
    }
    if (typeof destination !== "string" || destination.length === 0) {
      return { sent: false, reason: "invalid-destination" };
    }
    if (!(payload instanceof Uint8Array)) {
      return { sent: false, reason: "invalid-payload" };
    }

    const event = await this.#eventSource.prepareOutboundEvent(destination, payload);
    if (event === null) {
      return { sent: false, reason: "invalid-destination" };
    }

    const result = await this.#publisher.publish(event);
    if (result.accepted) {
      const messageId: TransportMessageId = result.eventId;
      return { sent: true, messageId };
    }
    return { sent: false, reason: "rejected", retryPolicy: "later" };
  }

  /**
   * Registers a poll-based subscription for `destination` (see this
   * file's own header for why this is poll-based, not push). Polling
   * only actually runs while `status()` is `"connected"`/`"degraded"` —
   * calling this while disconnected registers the subscription (so a
   * later `connect()` picks it up) without starting a timer. Returns a
   * working unsubscribe function regardless of current connection state.
   */
  subscribe(destination: TransportEndpointRef, handler: TransportHandler): TransportUnsubscribe {
    const subscription: Subscription = {
      destination,
      filter: this.#eventSource.filterFor(destination),
      handler,
      seenEventIds: new Set(),
      timer: null,
    };
    this.#subscriptions.set(destination, subscription);
    if (this.#status === "connected" || this.#status === "degraded") {
      this.#startPolling(subscription);
    }
    return () => {
      const existing = this.#subscriptions.get(destination);
      if (existing !== subscription) return; // already replaced/removed
      this.#stopPolling(subscription);
      this.#subscriptions.delete(destination);
    };
  }

  #startPolling(subscription: Subscription): void {
    if (subscription.timer !== null) return; // already polling
    subscription.timer = setInterval(() => {
      void this.#pollOnce(subscription);
    }, this.#pollIntervalMs);
  }

  #stopPolling(subscription: Subscription): void {
    if (subscription.timer === null) return;
    clearInterval(subscription.timer);
    subscription.timer = null;
  }

  async #pollOnce(subscription: Subscription): Promise<void> {
    let events: readonly NostrEvent[];
    try {
      events = await this.#relayAdapter.query([subscription.filter]);
    } catch {
      // A read-side failure never crashes the poll loop or the caller --
      // simply nothing new is delivered this tick.
      return;
    }
    for (const event of events) {
      if (subscription.seenEventIds.has(event.id)) continue;
      subscription.seenEventIds.add(event.id);
      const payload = await this.#eventSource.decodeInboundEvent(event);
      if (payload === null) continue; // not addressed to us / not decodable
      subscription.handler({ id: event.id, payload, receivedAtMs: Date.now() });
    }
  }

  /**
   * NOT part of `TransportPort`. A deterministic, test-only escape hatch
   * that runs exactly one poll iteration for `destination`'s registered
   * subscription (if any) without waiting on `setInterval` timing —
   * mirrors `FedosMessengerMessagingPortAdapter.dispatchInbound()`'s own
   * "exposed as a plain public method specifically for a future/test
   * caller to reach" precedent. A no-op if `destination` has no active
   * subscription.
   */
  async pollOnce(destination: TransportEndpointRef): Promise<void> {
    const subscription = this.#subscriptions.get(destination);
    if (subscription === undefined) return;
    await this.#pollOnce(subscription);
  }
}
