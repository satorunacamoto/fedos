/**
 * Secure Runtime Alpha 1613 ("Canonical Route Decision") — part of the
 * Alpha 1611–1690 Nostr Private Wire Standardization and Transport
 * Reconciliation Arc.
 *
 * The one closed route-selection vocabulary a caller of the Private
 * Wire boundary (`fedos_private_wire_adapter.ts`) chooses between.
 * `"fedos-private-v1"` is `FedosPrivateV1WireAdapter` (Alpha 1614 —
 * the existing, real, disclosed FedOS-proprietary `kind: 24700` wire
 * shape, unchanged by this Arc beyond Alpha 1615's own kind-1 closure).
 * `"nostr-nip17-v1"` names the standard NIP-17/NIP-44/NIP-59 wire route
 * this Arc's own Alpha 1617 Normative Source Gate found blocked (see
 * `docs/secure_runtime_alpha_1611_1690_phase_b_normative_source_gate.md`)
 * — `NostrNip17V1WireAdapter` exists as a real, additive module
 * implementing this SAME adapter interface, but every operation on it
 * resolves to `"unsupported"`, always, never a partial/best-effort
 * result.
 *
 * HARD GUARDRAILS:
 *   - The default route, when a caller supplies none, is the FIXED
 *     constant `"fedos-private-v1"` — NEVER computed by probing which
 *     files/modules happen to exist at runtime (the Arc's own explicit
 *     instruction: "The default must not silently change based on
 *     available files"). Today's `"fedos-private-v1"` default would be
 *     the identical value on any machine, with or without this file's
 *     own sibling `nip17/` module ever having been written.
 *   - `resolveFedosPrivateWireRoute()` never returns `"nostr-nip17-v1"`
 *     unless the caller EXPLICITLY requested it AND the adapter it
 *     resolves to reports itself available (Alpha 1631's own "no
 *     auto-upgrade, no heuristic fallback" requirement) — requesting
 *     `"nostr-nip17-v1"` today always resolves to `"unsupported"`,
 *     never silently falls back to `"fedos-private-v1"` (Alpha 1648's
 *     own "No-Downgrade Rule": failing the requested route is reported
 *     as `"unsupported"`, never silently swapped for a different route
 *     the caller did not ask for).
 */

/** The one closed route-selection vocabulary (Alpha 1613). */
export type FedosPrivateWireRouteRequest = "fedos-private-v1" | "nostr-nip17-v1";

/** `resolveFedosPrivateWireRoute()`'s own closed outcome vocabulary — `"unsupported"` is a first-class outcome, never an exception. */
export type FedosPrivateWireRoute = "fedos-private-v1" | "nostr-nip17-v1" | "unsupported";

/** The one fixed default (Alpha 1613) — never derived from filesystem/module probing. */
export const FEDOS_PRIVATE_WIRE_ROUTE_DEFAULT: FedosPrivateWireRouteRequest = "fedos-private-v1";

/**
 * Narrow capability probe an adapter implements so
 * `resolveFedosPrivateWireRoute()` can decide `"unsupported"` without
 * importing every adapter's own full interface here (kept minimal on
 * purpose — see `fedos_private_wire_adapter.ts` for the real adapter
 * shape this augments).
 */
export interface FedosPrivateWireRouteAvailability {
  readonly isAvailable: () => boolean;
}

/**
 * Resolves a caller's requested route to the closed outcome vocabulary.
 * `requested` omitted -> the fixed default. `requested` supplied but its
 * own adapter reports itself unavailable (e.g. `NostrNip17V1WireAdapter`,
 * always, today) -> `"unsupported"`, explicit, never a silent swap to a
 * different route (Alpha 1648).
 */
export function resolveFedosPrivateWireRoute(
  requested: FedosPrivateWireRouteRequest | undefined,
  adapterFor: (route: FedosPrivateWireRouteRequest) => FedosPrivateWireRouteAvailability,
): FedosPrivateWireRoute {
  const route = requested ?? FEDOS_PRIVATE_WIRE_ROUTE_DEFAULT;
  return adapterFor(route).isAvailable() ? route : "unsupported";
}
