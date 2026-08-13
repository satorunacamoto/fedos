/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) —
 * pure, honest connection/sync-state derivation for the Shop/Commerce
 * DISCOVERY surface specifically (as opposed to `../order/sync_state.ts`,
 * which covers a bounded Commerce DATA VIEW like My Orders/Incoming Orders).
 *
 * WHY THIS IS A SEPARATE FILE FROM `../order/sync_state.ts`
 * ----------------------------------------------------------------------
 * `CommerceSyncStatus` (`"offline"|"syncing"|"sync-failed"|"up-to-date"|
 * "connected"`) is the right vocabulary for "did my last fetch of data I
 * ALREADY have permission to see succeed" — it has no notion of a user
 * having deliberately turned network discovery off, and no notion of
 * "demo/local-only" being a DISTINCT, non-jargon-labeled mode a real user
 * needs to understand they are in (never a silent stand-in for real
 * discovery). Reusing/widening that file's own union would blur its
 * existing, already-tested "genuine offline vs deliberately local" meaning
 * for every OTHER caller (My Orders, Incoming Orders) that has nothing to
 * do with Nostr Commerce publication/discovery. This file owns its own
 * closed vocabulary instead, staying consistent in STYLE (pure, `now`
 * always caller-supplied, one derivation function, one label/detail
 * lookup, never `Date.now()`/jargon internally) without touching that
 * file's own contract.
 *
 * THE MANDATE THIS FILE CLOSES: prior arcs left Commerce network discovery
 * as an "experimental" per-session toggle defaulting to `"local-only"`
 * (Commerce Nostr Publication) sitting ALONGSIDE (never wired to) the
 * user's already-real, already-configured Messenger Relay — so a fresh
 * buyer who genuinely configured a Relay for messaging still saw an
 * unlabeled, indistinguishable static "LOCAL DEMO" catalog in Shop with no
 * visible connection/attempt state at all (see
 * `docs/commerce/COMMERCE-PURCHASE-COMPLETION-FINAL-REPORT.md`'s own "UX"
 * section). This module gives the Shop screen an honest, explicit status
 * for every one of the required states (arc brief: "LOCAL DEMO / OFFLINE /
 * CONNECTING / SYNCING / CONNECTED / SYNC FAILED / NO LISTINGS") — no
 * Nostr/relay jargon in the default label text, no empty demo catalog ever
 * silently standing in for a real "we tried and found nothing" state.
 */

/**
 * The six mutually-exclusive CONNECTION states this module derives —
 * `"no-listings"` is deliberately NOT a seventh member of this union: it is
 * an ORTHOGONAL, content-emptiness signal (see `CommerceDiscoveryView.noListings`
 * below) that can co-occur with `"connected"` (queried successfully, found
 * zero), `"offline"`, or `"local-demo"` alike — collapsing it into this
 * union would force an arbitrary priority choice between "are we connected"
 * and "is there anything to see", which are genuinely independent facts a
 * real user benefits from seeing separately (arc brief's own "NO LISTINGS"
 * state, kept as its own visible signal, never silently merged away).
 *
 * - `"local-demo"` — the user has DELIBERATELY chosen not to use the
 *   network for Commerce this session (network profile is `"local-only"`),
 *   even though a Relay may be configured for messaging. Only local +
 *   explicitly-labeled demo/tutorial listings are shown.
 * - `"offline"` — no Relay is configured at all; there is nothing to
 *   connect to yet (the honest "you haven't set this up" state, distinct
 *   from a deliberate local-only choice).
 * - `"connecting"` — the FIRST discovery attempt this session is currently
 *   in flight (no prior attempt has ever completed).
 * - `"syncing"` — a SUBSEQUENT discovery attempt (at least one prior
 *   attempt already completed) is currently in flight.
 * - `"connected"` — the most recent attempt completed successfully.
 * - `"sync-failed"` — the most recent attempt completed but failed
 *   (timeout/refusal/malformed reply) — local data is still shown, never
 *   blanked.
 */
export type CommerceDiscoveryStatus =
  | "local-demo"
  | "offline"
  | "connecting"
  | "syncing"
  | "connected"
  | "sync-failed";

/**
 * The generic signals the Shop screen's composition point can report,
 * regardless of transport — mirrors `../order/sync_state.ts`'s own
 * `CommerceSyncSnapshot` discipline (plain data in, pure function out,
 * nothing here reaches a network or a clock itself).
 */
export interface CommerceDiscoverySnapshot {
  /** Mirrors the process's own Commerce network profile — `"local-only"`
   * means the user has deliberately opted Commerce out of the network this
   * session (see this file's header on why that is `"local-demo"`, never
   * conflated with genuine `"offline"`). */
  readonly networkProfile: "local-only" | "direct" | "tor-optional";
  /** Whether at least one Relay is configured at all (independent of
   * `networkProfile` — a user can have zero Relays configured AND an
   * explicit `"direct"` profile; that combination is still `"offline"`,
   * never a false `"connecting"`). */
  readonly hasConfiguredRelay: boolean;
  /** A discovery query is in flight right now. */
  readonly inFlight: boolean;
  /** Whether ANY discovery attempt has ever completed (success or
   * failure) for this process. `false` + `inFlight: true` is what makes
   * the FIRST attempt read as `"connecting"` rather than `"syncing"`. */
  readonly hasEverAttempted: boolean;
  /** The outcome of the most recently COMPLETED attempt; `null` iff
   * `hasEverAttempted` is `false`. */
  readonly lastAttemptSucceeded: boolean | null;
  /** Count of REAL listings (local + genuinely Nostr-discovered) currently
   * known — MUST exclude every demo/tutorial fixture; see this file's
   * header. Used only to derive `noListings` below, never the connection
   * state itself. */
  readonly realListingCount: number;
}

export interface CommerceDiscoveryView {
  readonly status: CommerceDiscoveryStatus;
  /** `true` iff `realListingCount === 0` — an orthogonal signal, see this
   * file's header on why it is not folded into `status`. */
  readonly noListings: boolean;
}

/**
 * Pure derivation. Priority order (each check short-circuits the ones
 * below it) — mirrors `deriveCommerceSyncStatus`'s own "most decisive fact
 * wins" discipline:
 *   1. `networkProfile === "local-only"` -> `"local-demo"`, regardless of
 *      Relay configuration or any in-flight/completed attempt (a
 *      deliberate local-only choice always means "no network attempt was
 *      or will be made", so nothing below this line can ever be true at
 *      the same time in a caller that is honest about its own state).
 *   2. no Relay configured -> `"offline"`.
 *   3. an attempt is in flight and none has EVER completed -> `"connecting"`.
 *   4. an attempt is in flight and at least one has completed before ->
 *      `"syncing"`.
 *   5. the most recent completed attempt failed -> `"sync-failed"`.
 *   6. otherwise (a completed, successful attempt) -> `"connected"`.
 */
export function deriveCommerceDiscoveryView(snapshot: CommerceDiscoverySnapshot): CommerceDiscoveryView {
  const status = deriveCommerceDiscoveryStatus(snapshot);
  return { status, noListings: snapshot.realListingCount === 0 };
}

function deriveCommerceDiscoveryStatus(snapshot: CommerceDiscoverySnapshot): CommerceDiscoveryStatus {
  if (snapshot.networkProfile === "local-only") return "local-demo";
  if (!snapshot.hasConfiguredRelay) return "offline";
  if (snapshot.inFlight) return snapshot.hasEverAttempted ? "syncing" : "connecting";
  if (snapshot.lastAttemptSucceeded === false) return "sync-failed";
  return "connected";
}

/** Short badge word + one non-jargon sentence per state — mirrors
 * `describeCommerceSyncStatus`'s own "never mentions relay/Nostr/IPC"
 * discipline. Uses the arc brief's own required label vocabulary verbatim
 * (uppercase badge words) so the visible UI text and this module's own
 * tests both anchor to the same source of truth. */
export interface CommerceDiscoveryStatusText {
  readonly badge: string;
  readonly detail: string;
}

const COMMERCE_DISCOVERY_STATUS_TEXT: Readonly<Record<CommerceDiscoveryStatus, CommerceDiscoveryStatusText>> = {
  "local-demo": {
    badge: "LOCAL DEMO",
    detail: "Network discovery is turned off for Shop. You're seeing only your own local listings and tutorial/demo items — not real sellers on the network.",
  },
  offline: {
    badge: "OFFLINE",
    detail: "You haven't connected to a network yet. Connect to discover real sellers' listings.",
  },
  connecting: {
    badge: "CONNECTING",
    detail: "Connecting to look for sellers…",
  },
  syncing: {
    badge: "SYNCING",
    detail: "Checking for new listings…",
  },
  connected: {
    badge: "CONNECTED",
    detail: "Connected. Showing listings synced from the network.",
  },
  "sync-failed": {
    badge: "SYNC FAILED",
    detail: "Could not reach the network just now. Showing your own local listings only — try again.",
  },
};

export function describeCommerceDiscoveryStatus(status: CommerceDiscoveryStatus): CommerceDiscoveryStatusText {
  return COMMERCE_DISCOVERY_STATUS_TEXT[status];
}

/** Fixed text for the orthogonal "no real listings" signal — never used as
 * a replacement for `status`'s own text, always shown ALONGSIDE it (see
 * this file's header). */
export const COMMERCE_DISCOVERY_NO_LISTINGS_TEXT = "No real sellers' listings found yet." as const;
