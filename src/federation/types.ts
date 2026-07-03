/**
 * Stage 110 — Federation provider boundary (types only).
 *
 * A MINIMAL, future-facing seam so FedOS can eventually speak to multiple
 * social protocols (Nostr, Bluesky, Threads, RSS, and FedOS's own local
 * store) behind ONE interface, instead of hard-coupling to any single one.
 * This file defines shapes ONLY — it opens no relay connection, no
 * WebSocket, no HTTP request, no OAuth flow, no AT Protocol session, signs
 * no event, and publishes/fetches nothing.
 *
 * HARD GUARDRAILS (see `docs/federation_boundary.md`):
 *   - NO real relay/WebSocket/HTTP/OAuth/AT-Protocol connection is opened by
 *     anything in this boundary. `connect()` never dials a socket or calls
 *     `fetch`.
 *   - `connected_placeholder` means "this provider WOULD report connected",
 *     NEVER "a real session/socket/HTTP connection exists". No
 *     implementation this stage ever reaches it — see `./noop_federation.js`.
 *   - Requests/decisions carry OPAQUE, non-secret labels ONLY (`eventRef`,
 *     `targetRef`) — never raw bytes, event content, a signed event, a
 *     relay URL, an OAuth token, or a DID/session credential.
 *   - This boundary is separate from `StorageBackend` (`src/storage/`),
 *     `CryptoProvider` (`src/crypto/`), and identity/`WebAuthnProvider`
 *     (`src/identity/`) — an adapter behind this seam only ever reads,
 *     writes, or replies to social content; it never stores bytes, never
 *     signs/encrypts, and never authenticates a user.
 *   - This boundary makes NO connectivity, delivery, or federation
 *     guarantee. Do not describe it as "connected", "live", or "synced".
 */

/**
 * Which future protocol/adapter a provider speaks — a label of intent only.
 * None of these names a working, connected, or safe transport.
 */
export type FederationProviderKind =
  | "nostr_placeholder"
  | "bluesky_placeholder"
  | "threads_placeholder"
  | "rss_placeholder"
  | "local_placeholder"
  | "test_placeholder";

/**
 * FUTURE capabilities a provider MIGHT expose — all PLACEHOLDERS. Presence of
 * a name is a label of intent, NOT a working or safe feature. None of these
 * is performed by anything in this stage.
 */
export type FederationCapability =
  | "read_placeholder"
  | "write_placeholder"
  | "reply_placeholder"
  | "reaction_placeholder"
  | "media_placeholder";

/**
 * Coarse observable connection state. No socket, session, token, or content
 * is exposed at any state.
 */
export type FederationConnectionState =
  | "disconnected" // no session/connection is open (the no-op default)
  | "connected_placeholder" // PLACEHOLDER "connected" — no real socket/HTTP/OAuth session exists
  | "error"; // an operation could not be served; recorded as state, never thrown

/** A provider's fixed, non-sensitive identity: which kind it is and what it advertises. */
export interface FederationDescriptor {
  readonly kind: FederationProviderKind;
  /** The PLACEHOLDER capabilities this provider advertises (may be empty). */
  readonly capabilities: readonly FederationCapability[];
  /** Display label only, e.g. "Nostr (placeholder)". Never a relay URL or handle. */
  readonly label: string;
}

/** The current, non-sensitive status of a provider. */
export interface FederationStatus {
  readonly descriptor: FederationDescriptor;
  readonly state: FederationConnectionState;
  /** Non-sensitive explanation. Never echoes a URL, token, or content. */
  readonly reason: string;
}

/**
 * How a caller asks to (eventually) publish. `eventRef` is an OPAQUE,
 * non-secret reference to a `SocialEventDescriptor` (see `src/social/event.ts`)
 * this WOULD publish — NEVER the event's bytes/content, and never a signed
 * event.
 */
export interface FederationPublishRequest {
  readonly eventRef?: string;
}

/** The result of a `publishPlaceholder` attempt. Never carries a relay ack, event id, or content. */
export interface FederationPublishDecision {
  readonly allowed: boolean;
  readonly state: FederationConnectionState;
  readonly reason: string;
}

/**
 * How a caller asks to (eventually) fetch. `targetRef` is an OPAQUE,
 * non-secret reference (e.g. a board/topic label) — NEVER a URL, query, or
 * filter sent to a real API.
 */
export interface FederationFetchRequest {
  readonly targetRef?: string;
}

/**
 * The result of a `fetchPlaceholder` attempt. `items` is ALWAYS empty in
 * this stage — nothing is ever fetched.
 */
export interface FederationFetchDecision {
  readonly allowed: boolean;
  readonly state: FederationConnectionState;
  readonly reason: string;
  readonly items: readonly never[];
}

/**
 * The federation seam. Implementations MUST NOT open a relay/WebSocket/HTTP/
 * OAuth/AT-Protocol connection, sign or publish a real event, or subscribe to
 * or fetch a real timeline. Every method is total and never throws.
 * `connect()`/`disconnect()` only move the reported state; `publishPlaceholder`/
 * `fetchPlaceholder` only evaluate a decision — none of the four sends or
 * receives anything real. Constructing an implementation does nothing.
 */
export interface FederationProvider {
  /** Current coarse status (pure read). */
  status(): FederationStatus;
  /** Ask to connect. Opens NO real socket/HTTP/OAuth session. */
  connect(): Promise<FederationStatus>;
  /** Ask to disconnect. Closes nothing real; only moves the reported state. */
  disconnect(): Promise<FederationStatus>;
  /** Ask to (eventually) publish. Publishes NOTHING in this stage. */
  publishPlaceholder(request: FederationPublishRequest): Promise<FederationPublishDecision>;
  /** Ask to (eventually) fetch. Fetches NOTHING in this stage; `items` is always empty. */
  fetchPlaceholder(request: FederationFetchRequest): Promise<FederationFetchDecision>;
}

/** Every provider-kind label (for mapping/documentation helpers). */
export const FEDERATION_PROVIDER_KINDS: readonly FederationProviderKind[] = [
  "nostr_placeholder",
  "bluesky_placeholder",
  "threads_placeholder",
  "rss_placeholder",
  "local_placeholder",
  "test_placeholder",
];

/** Every capability label (for mapping/documentation helpers). */
export const FEDERATION_CAPABILITIES: readonly FederationCapability[] = [
  "read_placeholder",
  "write_placeholder",
  "reply_placeholder",
  "reaction_placeholder",
  "media_placeholder",
];
