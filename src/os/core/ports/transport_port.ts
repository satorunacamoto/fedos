/**
 * OS Capability Modularization — `TransportPort` (Compatibility Facade
 * Reduction + Package Extraction Readiness + Remaining Architecture Debt
 * Closure arc, Agent P).
 *
 * The gap `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md` explicitly
 * DEFERRED as "genuinely new design work, not a refactor" — no prior arc
 * (including the Factory/Port Completion pass whose `createMessenger()`
 * shipped without a `transport` dependency) attempted this. This file is
 * that design.
 *
 * WHAT THIS PORT MODELS, grounded in the REAL Nostr transport (not an
 * invented abstract ideal) — read against
 * `src/os/messenger/adapters/nostr/protocol/publish.ts`'s `RelayPublisher`
 * (publish an event, await a NIP-20 OK acknowledgement, never throw for a
 * relay-side problem) and `.../protocol/relay.ts`'s `RelayAdapter` (a
 * read-only query source) plus
 * `src/os/messenger/adapters/nostr/transport/fedos_private_transport.ts`'s
 * own `start()`/`stop()` connect/disconnect discipline and its Mailbox
 * Outbox's `"delivered" | "rejected" | "failed"` /
 * `"immediate" | "later" | "never"` retry vocabulary
 * (`fedos_conversation_transport_publisher.ts`, itself reused from
 * `board/outbox/fedos_board_outbox_publisher.ts`) — every real transport
 * this codebase has ever built does exactly four things: it SENDS one
 * message to one destination and reports success/failure (never throwing
 * for a transport-side problem); it lets a caller SUBSCRIBE to inbound
 * messages for a destination and later cancel that subscription; it has an
 * explicit connect/disconnect LIFECYCLE with a queryable status; and its
 * failures are reported as data, with an optional retry hint, never as an
 * exception.
 *
 * WHAT THIS PORT DELIBERATELY DOES NOT MODEL — kept OUT specifically
 * because it is Nostr-specific, not transport-generic (per this arc's own
 * brief: "if the real Nostr transport has Nostr-specific concepts, do NOT
 * put those in the generic Port"):
 *   - event `kind`, `tags`, `content` shape (NIP-01) — Nostr-only.
 *   - relay URLs / relay sets / multi-relay fan-out — Nostr-only; a
 *     different transport (Matrix, a raw TCP mailbox, ...) may have zero
 *     concept of "a relay" at all.
 *   - gift-wrap/seal/NIP-17/NIP-59, or any encryption/sealing decision —
 *     stays entirely inside whatever the adapter delegates to; this Port
 *     carries only already-opaque `Uint8Array` payload bytes, exactly
 *     like `MessagingPort.MessagePayload` and `SealingAuthorityPort` both
 *     already do for their own opaque-bytes fields.
 *   - signing-key/account/identity selection — a transport MOVES bytes; it
 *     does not decide WHO the bytes are signed as. That stays the
 *     concrete adapter's job (see `nostr_transport_adapter.ts`'s own
 *     header for how it delegates this out).
 *
 * INTERFACE SEGREGATION, matching every other widened Port in this file's
 * sibling directory (`MessagingPort`, `ConversationPort`): three narrow
 * capabilities — `TransportLifecyclePort` (connect/disconnect/status),
 * `TransportSendPort` (write), `TransportSubscribePort` (push-subscribe,
 * cancel via the returned `TransportUnsubscribe`) — composed back into one
 * `TransportPort` name for a consumer that wants the whole surface. A
 * future consumer that only ever sends (never subscribes) can depend on
 * `TransportSendPort` alone.
 *
 * "failure/cancel semantics", this Port's own answer: FAILURE is `send()`'s
 * `TransportSendResult`'s `sent: false` branch — a discriminated union,
 * never a thrown exception, with an OPTIONAL `retryPolicy` hint mirroring
 * the real Mailbox Outbox's own generic (not Nostr-specific)
 * `"immediate" | "later" | "never"` vocabulary. CANCEL is
 * `TransportSubscribePort.subscribe()`'s returned `TransportUnsubscribe`
 * function — the same "subscribe returns its own cancel handle" shape
 * `MessagingPort.onMessage()` already established in this codebase. There
 * is no separate cancel-a-pending-send primitive: `send()` is one
 * `Promise`, already cancellable at the caller's own await/race level —
 * inventing a second mechanism here would duplicate what every Promise
 * already offers, and no real coordinator in this repo exposes a
 * cancel-a-send operation to model this Port against.
 *
 * This file is an INTERFACE ONLY. It must never import from
 * `src/conversation`, `src/os/messenger`, `src/commerce`/`src/os/commerce`,
 * or any other domain-specific module — an adapter in a capability's own
 * `adapters/` directory implements this Port against a real backend.
 */

/**
 * Opaque destination reference — "who/where to send to" or "what to
 * subscribe for". Deliberately untyped beyond `string`, exactly like
 * `ConversationPort`'s own `CounterpartyRef` — a concrete adapter defines
 * its own encoding (the real Nostr adapter's is documented on
 * `nostr_transport_adapter.ts`) and parses/validates it at the adapter
 * boundary, never here.
 */
export type TransportEndpointRef = string;

/** Opaque identifier for one transport-level message, once sent or received. */
export type TransportMessageId = string;

/**
 * One message as observed by a `subscribe()` handler. `payload` is opaque
 * bytes only — this Port never interprets, decrypts, or decodes content;
 * that is the concrete adapter's job (see this file's own header).
 */
export interface TransportMessage {
  readonly id: TransportMessageId;
  readonly payload: Uint8Array;
  /** Milliseconds since epoch, when known. */
  readonly receivedAtMs?: number;
}

/**
 * A closed failure vocabulary, kept deliberately small and
 * transport-generic (no relay-, socket-, or protocol-specific token) —
 * an adapter whose backend fails in a way none of these describe maps it
 * to `"failed"`, the same "fall back to the Port's own most generic
 * token" discipline `docs/architecture/ADDING-AN-ADAPTER.md` already
 * documents for `MessagingPort`.
 */
export type TransportSendFailureReason =
  | "not-connected"
  | "invalid-destination"
  | "invalid-payload"
  | "rejected"
  | "timeout"
  | "failed";

/**
 * Mirrors the real Mailbox Outbox's own retry vocabulary
 * (`FedosConversationTransportPublishResult`/`FedosBoardOutboxPublishResult`,
 * `"immediate" | "later" | "never"`) — reused here because "should the
 * caller retry, and roughly how soon" is genuinely transport-generic, not
 * Nostr-specific; every real outbox in this repo already reports exactly
 * this. OPTIONAL: an adapter that has no retry opinion (or wraps a backend
 * with none) omits it — a caller must not assume it is always present.
 */
export type TransportRetryPolicy = "immediate" | "later" | "never";

/**
 * Outcome of one `send()` attempt. A discriminated union, not a
 * stringly-typed `reason?: string` — mirrors `SendResult` on
 * `MessagingPort`. Failures are reported here, never thrown.
 */
export type TransportSendResult =
  | { readonly sent: true; readonly messageId: TransportMessageId }
  | { readonly sent: false; readonly reason: TransportSendFailureReason; readonly retryPolicy?: TransportRetryPolicy };

/**
 * Coarse connection state. `"degraded"` exists for a multi-relay-shaped
 * adapter that considers itself usably connected even when not every
 * underlying peer/relay is reachable (mirrors
 * `FedosConversationRelaySet.connectedCount()`'s own "some, not
 * necessarily all, relays connected" reality) — a Port consumer that only
 * cares about "can I currently send" treats `"connected"` and
 * `"degraded"` the same way; the distinction exists for a caller that
 * wants to surface partial-connectivity state to a user.
 */
export type TransportConnectionStatus = "disconnected" | "connecting" | "connected" | "degraded";

/** A handler registered via `subscribe()`. */
export type TransportHandler = (message: TransportMessage) => void;

/** Call to cancel a prior `subscribe()` call — this Port's own "cancel" primitive (see this file's header). */
export type TransportUnsubscribe = () => void;

/**
 * Connect/disconnect/status — absent from every other Port in this
 * directory (`MessagingPort`/`ConversationPort`/`NotificationPort` are all
 * connection-agnostic), because a transport, unlike those three, genuinely
 * owns a live connection lifecycle the real Nostr code already models
 * (`FedosPrivateTransport.start()`/`stop()`,
 * `FedosConversationRelaySet.connectAll()`/`disconnectAll()`).
 */
export interface TransportLifecyclePort {
  /**
   * Establishes (or re-establishes) the transport's connection. Resolves
   * with the resulting status — NEVER throws for a connection-side
   * failure; a backend that cannot connect resolves `"disconnected"`,
   * mirroring `FedosConversationRelaySet.connectAll()`'s own "one relay's
   * rejection never prevents another, and never throws" discipline.
   */
  connect(): Promise<TransportConnectionStatus>;
  /** Tears down the connection. Best-effort; never throws. Idempotent — calling it while already disconnected is a no-op. */
  disconnect(): Promise<void>;
  /** Synchronous, cheap, current status read — never triggers I/O of its own. */
  status(): TransportConnectionStatus;
}

/** Write-only half of the transport seam. */
export interface TransportSendPort {
  /**
   * Send `payload` to `destination`. Never throws — every failure mode
   * (not connected, malformed destination/payload, backend rejection,
   * timeout, or an unclassified backend-specific failure) is reported via
   * `TransportSendResult`'s `sent: false` branch.
   */
  send(destination: TransportEndpointRef, payload: Uint8Array): Promise<TransportSendResult>;
}

/** Push-subscription half of the transport seam. */
export interface TransportSubscribePort {
  /**
   * Subscribe to inbound messages matching `destination`. Returns a
   * function to cancel — this Port's own cancel primitive (see this
   * file's header). Never throws; a backend that cannot subscribe (e.g.
   * not connected) still returns a valid, callable unsubscribe function
   * that simply never fires `handler`.
   */
  subscribe(destination: TransportEndpointRef, handler: TransportHandler): TransportUnsubscribe;
}

/**
 * The full transport seam — the union of the three narrower interfaces
 * above, kept as one name for a consumer that wants the whole surface. An
 * adapter implementing this port owns the actual wire protocol/backend;
 * `os/core` and every other capability depend only on this shape.
 */
export interface TransportPort extends TransportLifecyclePort, TransportSendPort, TransportSubscribePort {}
