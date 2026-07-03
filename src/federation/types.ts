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

/**
 * Stage 113 — Nostr event MAPPING candidate (types only, additive).
 *
 * A PURE, unsigned shape a future Nostr adapter's mapping step would
 * produce from a `SocialEventDescriptor`/`BoardDescriptor`/
 * `MarketplaceListingDescriptor`/moderation signal — see
 * `./nostr_mapping.js` and `docs/nostr_adapter_planning.md` §5 and §10
 * step 1. A `NostrEventCandidate` is NOT an actual Nostr event: it has no
 * event id, no signature, and no real pubkey.
 *
 * HARD GUARDRAILS:
 *   - NO actual Nostr event id, signature, or private/real pubkey field
 *     anywhere. `pubkeyRef` is an OPAQUE label only — never a real
 *     hex-encoded pubkey a signer would use.
 *   - `contentPreview` is NEVER the real post/message body — a fixed
 *     placeholder or a sanitized, non-sensitive display-label string only.
 *   - NO private/gated/payment/entitlement/buyer/download/signed-URL data
 *     of any kind (see `./nostr_mapping.js`'s policy).
 *   - This is a MAPPING CANDIDATE, not a wire format: `tags` borrows the
 *     Nostr tag SHAPE (`readonly (readonly string[])[]`) for eventual
 *     familiarity only — nothing here is ever serialized for a relay,
 *     signed, published, or subscribed to.
 */

/** Candidate Nostr event "kind" — a label of intent only; no NIP kind number is finalized. */
export type NostrEventCandidateKind =
  | "text_note_placeholder"
  | "reply_placeholder"
  | "reaction_placeholder"
  | "profile_placeholder"
  | "long_form_placeholder"
  | "marketplace_announcement_placeholder"
  | "moderation_signal_placeholder"
  | "test_placeholder";

/**
 * A pure, unsigned candidate shape — never an actual Nostr event. See the
 * hard guardrails above.
 */
export interface NostrEventCandidate {
  readonly kindLabel: NostrEventCandidateKind;
  /** Nostr TAG SHAPE only — no relay ever receives these tags. */
  readonly tags: readonly (readonly string[])[];
  /** A fixed placeholder or sanitized display label — NEVER real content. */
  readonly contentPreview?: string;
  /** OPAQUE label — NEVER a real pubkey. */
  readonly pubkeyRef?: string;
  readonly createdAt?: number;
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Coarse observable state of a mapping attempt. */
export type NostrMappingState = "accepted_placeholder" | "rejected";

/**
 * The result of a mapping attempt. `candidate` is present ONLY when
 * `allowed`/`accepted_placeholder` — a rejection never carries a partial
 * candidate.
 */
export interface NostrEventMappingDecision {
  readonly allowed: boolean;
  readonly state: NostrMappingState;
  readonly reason: string;
  readonly candidate?: NostrEventCandidate;
}

/** Every candidate-kind label (for mapping/documentation helpers). */
export const NOSTR_EVENT_CANDIDATE_KINDS: readonly NostrEventCandidateKind[] = [
  "text_note_placeholder",
  "reply_placeholder",
  "reaction_placeholder",
  "profile_placeholder",
  "long_form_placeholder",
  "marketplace_announcement_placeholder",
  "moderation_signal_placeholder",
  "test_placeholder",
];

/**
 * A FedOS-local moderation decision (hide/mute/filter — never a claim of
 * deletion, per `docs/nostr_adapter_planning.md` §7). `targetRef` is an
 * OPAQUE label to the board/event/user being moderated — never a real
 * pubkey or event id.
 */
export type ModerationAction = "hide_placeholder" | "mute_placeholder" | "filter_placeholder";

/** Input to `moderationSignalToNostrCandidate` (see `./nostr_mapping.js`). */
export interface ModerationSignalInput {
  readonly idRef?: string;
  /** OPAQUE label to what is being moderated — never a real pubkey/event id. */
  readonly targetRef?: string;
  readonly action: ModerationAction;
  /** Non-sensitive display reason only — reviewed by the mapping policy. */
  readonly reason?: string;
  readonly createdAt?: number;
  readonly metadata?: Readonly<Record<string, string>>;
}
