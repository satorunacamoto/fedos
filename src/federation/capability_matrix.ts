/**
 * Stage 117 — Protocol adapter capability matrix (types + pure policy).
 *
 * A FIXED, static matrix naming WHICH future protocol adapter (Nostr,
 * Bluesky, Threads, RSS, FedOS's own local store) WOULD be able to carry
 * WHICH kind of social feature — before any of those adapters is built. This
 * is a NAMING/PLANNING boundary, one level more general than
 * `./nostr_mapping.js`'s Nostr-specific event-kind table
 * (`docs/nostr_adapter_planning.md` §5): that table maps a FedOS concept to
 * a Nostr event-kind candidate; this matrix maps an ADAPTER KIND to a
 * coarse yes/no per FEATURE, across every protocol `FederationProviderKind`
 * (`./types.js`) already names.
 *
 * HARD GUARDRAILS:
 *   - NO relay/WebSocket/HTTP/OAuth/AT-Protocol connection, NO `fetch`. Every
 *     function here is a PURE lookup over a fixed table — it never dials a
 *     socket, never calls an API, and never depends on any adapter actually
 *     existing.
 *   - `available_placeholder` means "this matrix entry says a FUTURE adapter
 *     of this kind WOULD be able to carry this feature", NEVER "a working
 *     adapter exists today". No adapter behind `FederationProvider` is built
 *     or changed by this file.
 *   - Private/paid content is NEVER marked available for a public-relay
 *     protocol. Matches `docs/nostr_adapter_planning.md` §4/§9: a Nostr
 *     event is permanently public, so `private_message_placeholder`/
 *     `paid_content_placeholder` are `rejected` for `nostr_placeholder` —
 *     never "coming soon", a structural exclusion.
 *   - This boundary makes NO connectivity, delivery, or feature-availability
 *     guarantee. Do not describe an `available_placeholder` entry as
 *     "supported", "live", or "working".
 */

/**
 * Which future protocol/adapter a matrix entry describes — a label of
 * intent only. Mirrors `FederationProviderKind` (`./types.js`) on purpose:
 * this matrix is about the SAME set of future adapters, viewed feature-by-
 * feature instead of connection-status-by-status.
 */
export type ProtocolAdapterKind =
  | "nostr_placeholder"
  | "bluesky_placeholder"
  | "threads_placeholder"
  | "rss_placeholder"
  | "local_placeholder"
  | "test_placeholder";

/**
 * A future social FEATURE a protocol adapter might eventually carry — all
 * PLACEHOLDERS. Presence of a name is a label of intent, NOT a working or
 * safe feature. None of these is performed by anything in this stage.
 */
export type ProtocolAdapterCapability =
  | "read_public_placeholder"
  | "publish_public_placeholder"
  | "reply_placeholder"
  | "reaction_placeholder"
  | "profile_placeholder"
  | "marketplace_announcement_placeholder"
  | "moderation_signal_placeholder"
  | "private_message_placeholder"
  | "paid_content_placeholder"
  | "test_placeholder";

/**
 * Coarse observable state of one matrix entry. No socket, session, token, or
 * real feature is exposed at any state.
 *   - `available_placeholder`: a FUTURE adapter of this kind WOULD be able
 *     to carry this feature — not that one exists today.
 *   - `unavailable`: this matrix does not (yet) name this feature as
 *     reachable for this adapter kind — a "not planned this stage" label,
 *     not a permanent policy exclusion.
 *   - `rejected`: this feature is STRUCTURALLY excluded for this adapter
 *     kind (e.g. private/paid content on a public-relay protocol) — a
 *     design constraint, not a "not built yet" gap.
 *   - `error`: reserved for a future real capability probe; no code path in
 *     this stage ever produces it.
 */
export type ProtocolAdapterCapabilityState =
  | "available_placeholder"
  | "unavailable"
  | "rejected"
  | "error";

/** The result of one matrix lookup. Never carries a connection, token, or real feature payload. */
export interface ProtocolAdapterCapabilityDecision {
  readonly allowed: boolean;
  readonly state: ProtocolAdapterCapabilityState;
  /** Non-sensitive display reason only. */
  readonly reason?: string;
}

/** Every protocol-adapter-kind label (for mapping/documentation helpers). */
export const PROTOCOL_ADAPTER_KINDS: readonly ProtocolAdapterKind[] = [
  "nostr_placeholder",
  "bluesky_placeholder",
  "threads_placeholder",
  "rss_placeholder",
  "local_placeholder",
  "test_placeholder",
];

/** Every protocol-adapter-capability label (for mapping/documentation helpers). */
export const PROTOCOL_ADAPTER_CAPABILITIES: readonly ProtocolAdapterCapability[] = [
  "read_public_placeholder",
  "publish_public_placeholder",
  "reply_placeholder",
  "reaction_placeholder",
  "profile_placeholder",
  "marketplace_announcement_placeholder",
  "moderation_signal_placeholder",
  "private_message_placeholder",
  "paid_content_placeholder",
  "test_placeholder",
];

/**
 * Public-surface features `nostr_placeholder` names as `available_placeholder`
 * — the same public post/reply/reaction/profile/marketplace-announcement/
 * moderation-signal set already scoped in
 * `docs/nostr_adapter_planning.md` §3/§5. NEVER includes
 * `private_message_placeholder`/`paid_content_placeholder` — see the hard
 * guardrails above.
 */
const NOSTR_AVAILABLE_CAPABILITIES: ReadonlySet<ProtocolAdapterCapability> = new Set([
  "read_public_placeholder",
  "publish_public_placeholder",
  "reply_placeholder",
  "reaction_placeholder",
  "profile_placeholder",
  "marketplace_announcement_placeholder",
  "moderation_signal_placeholder",
]);

/**
 * Decide whether `adapter` names `capability` as reachable. Pure, total,
 * never throws, opens no connection.
 *   - `test_placeholder` capability is ALWAYS `available_placeholder` — a
 *     trivial, adapter-independent fixture, never a real feature.
 *   - `nostr_placeholder`: the public-surface set above is
 *     `available_placeholder`; `private_message_placeholder`/
 *     `paid_content_placeholder` are `rejected` (structural — see hard
 *     guardrails); any other combination falls through to `unavailable`.
 *   - Every other adapter kind (`bluesky_placeholder`/`threads_placeholder`/
 *     `rss_placeholder`/`local_placeholder`): `unavailable` for every
 *     non-test capability — a placeholder matrix only, no OAuth/API/relay
 *     design committed by this stage.
 */
export function canProtocolAdapterSupport(
  adapter: ProtocolAdapterKind,
  capability: ProtocolAdapterCapability,
): ProtocolAdapterCapabilityDecision {
  if (capability === "test_placeholder") {
    return {
      allowed: true,
      state: "available_placeholder",
      reason: "test_placeholder is a trivial, adapter-independent fixture capability",
    };
  }

  if (adapter === "nostr_placeholder") {
    if (capability === "private_message_placeholder") {
      return {
        allowed: false,
        state: "rejected",
        reason: "private messages must never ride on a public Nostr relay event (NIP-17/NIP-44 out of scope)",
      };
    }
    if (capability === "paid_content_placeholder") {
      return {
        allowed: false,
        state: "rejected",
        reason: "paid/entitlement-gated content must never be placed on a public Nostr event",
      };
    }
    if (NOSTR_AVAILABLE_CAPABILITIES.has(capability)) {
      return {
        allowed: true,
        state: "available_placeholder",
        reason: "a future Nostr adapter would be able to carry this public-surface feature",
      };
    }
    return {
      allowed: false,
      state: "unavailable",
      reason: "not named as reachable for nostr_placeholder by this matrix",
    };
  }

  return {
    allowed: false,
    state: "unavailable",
    reason: `${adapter} capability matrix is placeholder only — no adapter, OAuth, or API is implemented`,
  };
}

/**
 * The full capability row for one adapter kind — every
 * `ProtocolAdapterCapability` mapped through `canProtocolAdapterSupport`.
 * Pure, total, never throws, opens no connection.
 */
export function getProtocolAdapterCapabilities(
  adapter: ProtocolAdapterKind,
): Readonly<Record<ProtocolAdapterCapability, ProtocolAdapterCapabilityDecision>> {
  const row = {} as Record<ProtocolAdapterCapability, ProtocolAdapterCapabilityDecision>;
  for (const capability of PROTOCOL_ADAPTER_CAPABILITIES) {
    row[capability] = canProtocolAdapterSupport(adapter, capability);
  }
  return row;
}
