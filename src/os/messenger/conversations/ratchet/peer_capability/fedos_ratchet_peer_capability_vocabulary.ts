/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — Phase B: the closed capability
 * vocabulary.
 *
 * Every value here is REUSED from an already-live source of truth, never
 * invented: `FedosPrivateWireRouteRequest`
 * (`../../transport/fedos_private_wire_route.js`) and `FedosDirectRatchetSuite`
 * (`../fedos_direct_ratchet_session_id.js`) are imported, not redefined,
 * so this file can never silently drift from the real route/suite
 * vocabularies. The four `FedosRatchetLifecycleCapabilityId` values name
 * the four Runtime-level capabilities this Arc (and the Foundation Arc it
 * builds on) actually implements — see this Arc's own execution spec for
 * why `device-key-updated` was deliberately NOT added as a fifth value
 * (Phase A found no in-place Device key-rotation primitive; only
 * `fedos_device_replacement_coordinator.ts`'s register-then-revoke
 * exists, which this Arc represents via the lifecycle-notification
 * domain instead, see `fedos_ratchet_peer_lifecycle_notification.ts`).
 *
 * Deliberately named with the two-word compound "peer capability", never
 * the bare word "capability" alone, to avoid colliding with the
 * unrelated, pre-existing `src/conversation/capability/` (join-conversation
 * invitation tokens) domain — a real naming collision risk Phase A found.
 *
 * Unknown values fail closed: every `isKnown*` predicate here returns
 * `false` for anything outside its own closed array, and every caller in
 * this Arc's own codec/authority files MUST reject on a `false` result
 * rather than pass an unrecognized value through.
 */
import type { FedosPrivateWireRouteRequest } from "../../../adapters/nostr/transport/fedos_private_wire_route.js";
import type { FedosDirectRatchetSuite } from "../fedos_direct_ratchet_session_id.js";

export const FEDOS_RATCHET_PEER_CAPABILITY_SCHEMA_VERSION = 1 as const;

/** Reused verbatim from the live route vocabulary — never widened here. */
export type FedosRatchetPeerCapabilityRoute = FedosPrivateWireRouteRequest;

export const FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_ROUTES: readonly FedosRatchetPeerCapabilityRoute[] = Object.freeze([
  "fedos-private-v1",
  "nostr-nip17-v1",
  "nostr-nip17-v1-ratchet",
]);

export function isKnownFedosRatchetPeerCapabilityRoute(value: unknown): value is FedosRatchetPeerCapabilityRoute {
  return typeof value === "string" && (FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_ROUTES as readonly string[]).includes(value);
}

/** Reused verbatim from the live ratchet suite vocabulary — never widened here. */
export type FedosRatchetPeerCapabilitySuite = FedosDirectRatchetSuite;

export const FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_SUITES: readonly FedosRatchetPeerCapabilitySuite[] = Object.freeze([
  "fedos-direct-ratchet-v1",
]);

export function isKnownFedosRatchetPeerCapabilitySuite(value: unknown): value is FedosRatchetPeerCapabilitySuite {
  return typeof value === "string" && (FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_SUITES as readonly string[]).includes(value);
}

/**
 * Closed lifecycle-capability vocabulary — each names a Runtime-level
 * feature this codebase actually implements today (Phase A confirmed
 * each independently: device add/revoke/replace evidence exists via
 * Device Trust; session initialization and authenticated session reset
 * are the Foundation Arc's own live mechanisms; capability-advertisement
 * is this Arc's own self-describing entry, listed so a peer can learn
 * the local endpoint understands this vocabulary at all).
 */
export type FedosRatchetLifecycleCapabilityId =
  | "device-notification-v1"
  | "session-initialization-v1"
  | "authenticated-session-reset-v1"
  | "capability-advertisement-v1"
  | "identity-transition-v1";

export const FEDOS_RATCHET_KNOWN_LIFECYCLE_CAPABILITIES: readonly FedosRatchetLifecycleCapabilityId[] = Object.freeze([
  "device-notification-v1",
  "session-initialization-v1",
  "authenticated-session-reset-v1",
  "capability-advertisement-v1",
  // Secure Runtime Alpha 5961-6040 (FedOS Identity Transition Peer
  // Notification and Ratchet Reset Integration Arc) — lets a peer
  // advertise it understands identity-transition notifications through
  // the EXISTING, unmodified advertisement pipeline; no new coordinator
  // needed for this half of that Arc's own Phase H.
  "identity-transition-v1",
]);

export function isKnownFedosRatchetLifecycleCapability(value: unknown): value is FedosRatchetLifecycleCapabilityId {
  return typeof value === "string" && (FEDOS_RATCHET_KNOWN_LIFECYCLE_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * One entry in a peer capability advertisement's bounded list. A closed
 * discriminated union — no arbitrary free-form feature strings are ever
 * accepted (Absolute Prohibitions). Envelope-level facts (sender/
 * recipient identity, issuedAt/expiresAt, revision, signature) live on
 * the advertisement record itself (`fedos_ratchet_peer_capability_advertisement.ts`),
 * not duplicated per entry — an entry is only ever "one supported
 * feature", never a second copy of the envelope.
 */
export type FedosRatchetPeerCapabilityEntry =
  | { readonly kind: "private-message-route"; readonly route: FedosRatchetPeerCapabilityRoute }
  | { readonly kind: "ratchet-suite"; readonly suite: FedosRatchetPeerCapabilitySuite }
  | { readonly kind: "lifecycle-capability"; readonly capability: FedosRatchetLifecycleCapabilityId };

/** A concrete, enforced ceiling — Phase C's own required bound. */
export const FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES = 16;

const ENTRY_FIELDS_BY_KIND: Readonly<Record<FedosRatchetPeerCapabilityEntry["kind"], ReadonlySet<string>>> = Object.freeze({
  "private-message-route": new Set(["kind", "route"]),
  "ratchet-suite": new Set(["kind", "suite"]),
  "lifecycle-capability": new Set(["kind", "capability"]),
});

/** Structural validation only, exact field set per kind. Fails closed; never throws. */
export function isWellFormedFedosRatchetPeerCapabilityEntry(candidate: unknown): candidate is FedosRatchetPeerCapabilityEntry {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (typeof r.kind !== "string") return false;
  const fields = ENTRY_FIELDS_BY_KIND[r.kind as FedosRatchetPeerCapabilityEntry["kind"]];
  if (fields === undefined) return false;
  const keys = Object.keys(r);
  if (keys.length !== fields.size || !keys.every((k) => fields.has(k))) return false;
  switch (r.kind) {
    case "private-message-route":
      return isKnownFedosRatchetPeerCapabilityRoute(r.route);
    case "ratchet-suite":
      return isKnownFedosRatchetPeerCapabilitySuite(r.suite);
    case "lifecycle-capability":
      return isKnownFedosRatchetLifecycleCapability(r.capability);
    default:
      return false;
  }
}

/** Extracts just the claimed route values, in order, from a bounded entries list — used to populate the durable Observation record's own `claimedRoutes` (downgrade detection must survive a restart without re-importing the raw advertisement). */
export function entriesOfKindRoutes(entries: readonly FedosRatchetPeerCapabilityEntry[]): readonly FedosRatchetPeerCapabilityRoute[] {
  return entries.filter((e): e is Extract<FedosRatchetPeerCapabilityEntry, { kind: "private-message-route" }> => e.kind === "private-message-route").map((e) => e.route);
}

/** Bounded, order-independent equality — used by the acceptance policy's conflict/duplicate checks. */
export function fedosRatchetPeerCapabilityEntryKey(entry: FedosRatchetPeerCapabilityEntry): string {
  switch (entry.kind) {
    case "private-message-route":
      return `private-message-route:${entry.route}`;
    case "ratchet-suite":
      return `ratchet-suite:${entry.suite}`;
    case "lifecycle-capability":
      return `lifecycle-capability:${entry.capability}`;
  }
}
