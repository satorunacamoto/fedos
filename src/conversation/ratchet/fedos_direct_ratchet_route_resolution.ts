/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase B: the closed route
 * decision layered above `resolveFedosDirectRatchetDevicePair()` (Phase
 * C) and `FedosDirectRatchetStateRuntime.readiness()` (Alpha 5401–5480,
 * UNCHANGED). Reuses the existing frozen `FedosPrivateWireRoute`/
 * `FedosPrivateWireRouteRequest` vocabulary (`../transport/fedos_private_wire_route.js`,
 * additively widened by this same Arc to add `"nostr-nip17-v1-ratchet"`)
 * rather than inventing a parallel one.
 *
 * CLOSED, EXPLICIT, NEVER BOOLEAN-ONLY:
 *   - `"fedos-private-v1"`/`"nostr-nip17-v1"` requests delegate to the
 *     EXISTING, unchanged `resolveFedosPrivateWireRoute()` — this Arc
 *     never alters legacy/static route resolution.
 *   - `"nostr-nip17-v1-ratchet"` requires BOTH Device-pair trust (Phase
 *     C) AND session readiness (`FedosDirectRatchetStateRuntime`) —
 *     never adapter availability alone.
 *   - An unready/uninitialized/reset-required ratchet request NEVER
 *     silently resolves to a lower route — it fails closed to
 *     `"unsupported"` with a specific, closed reason (Alpha 1648's own
 *     "No-Downgrade Rule", extended to the ratchet dimension).
 *   - `"downgrade-detected"`: if a ratchet session already exists in an
 *     `"active"`/`"initialized"` lifecycle state for this exact Device
 *     pair/Conversation, but the caller requests a NON-ratchet route,
 *     this resolver reports the attempt explicitly rather than silently
 *     obeying it — a caller that genuinely wants to stop using the
 *     ratchet must first `resetDirectRatchetSession()` (Phase M), never
 *     achieve it by simply requesting a different route.
 */
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import {
  resolveFedosPrivateWireRoute,
  type FedosPrivateWireRouteAvailability,
  type FedosPrivateWireRouteRequest,
} from "../transport/fedos_private_wire_route.js";
import {
  resolveFedosDirectRatchetDevicePair,
  type FedosDirectRatchetDevicePairRequest,
} from "./fedos_direct_ratchet_device_pair_resolver.js";
import type { FedosDirectRatchetSessionPersistence } from "./persistence/fedos_direct_ratchet_session_persistence.js";
import { FedosDirectRatchetStateRuntime, fedosDirectRatchetReadinessIsReady } from "./fedos_direct_ratchet_state_runtime.js";
import type { FedosDirectRatchetSessionId } from "./fedos_direct_ratchet_session_id.js";

export type FedosDirectRatchetRouteUnsupportedReason =
  | "unknown-route"
  | "local-device-unknown"
  | "local-device-revoked"
  | "local-device-not-trusted"
  | "remote-device-unknown"
  | "remote-device-revoked"
  | "remote-device-not-trusted"
  | "invalid-binding"
  | "session-initialization-required"
  | "session-reset-required"
  | "session-revoked"
  | "session-expired"
  | "session-corrupt"
  | "session-unavailable"
  | "downgrade-detected"
  | "legacy-route-unsupported";

export type FedosDirectRatchetRouteDecision =
  | { readonly route: "fedos-private-v1" }
  | { readonly route: "nostr-nip17-v1" }
  | { readonly route: "nostr-nip17-v1-ratchet"; readonly sessionId: FedosDirectRatchetSessionId }
  | { readonly route: "unsupported"; readonly reason: FedosDirectRatchetRouteUnsupportedReason };

export interface FedosDirectRatchetRouteResolutionContext {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly sessionPersistence: FedosDirectRatchetSessionPersistence;
  readonly stateRuntime: FedosDirectRatchetStateRuntime;
  readonly devicePair: Omit<FedosDirectRatchetDevicePairRequest, "generation">;
  /** The narrow legacy-adapter-availability probe `resolveFedosPrivateWireRoute()` itself already requires — see that file's own header. Only consulted for the two pre-existing route values. */
  readonly legacyAdapterFor: (route: FedosPrivateWireRouteRequest) => FedosPrivateWireRouteAvailability;
}

function sessionReasonFromReadiness(
  lifecycleState: ReturnType<FedosDirectRatchetStateRuntime["readiness"]>["lifecycleState"],
): FedosDirectRatchetRouteUnsupportedReason {
  switch (lifecycleState) {
    case "reset-required":
      return "session-reset-required";
    case "revoked":
      return "session-revoked";
    case "expired":
      return "session-expired";
    case "corrupt":
      return "session-corrupt";
    case "suspended":
      return "session-reset-required";
    case "unavailable":
    default:
      return "session-unavailable";
  }
}

/**
 * Total, never throws. `requestedGeneration` is OPTIONAL — omitted, the
 * CURRENT (highest already-persisted) generation for this Device pair is
 * used, matching `resolveFedosDirectRatchetDevicePair()`'s own default.
 */
export function resolveFedosDirectRatchetRoute(
  requested: FedosPrivateWireRouteRequest | undefined,
  ctx: FedosDirectRatchetRouteResolutionContext,
): FedosDirectRatchetRouteDecision {
  const route = requested ?? "fedos-private-v1";

  // Downgrade detection: an ALREADY-active ratchet session for this exact
  // Device pair/Conversation must never be silently bypassed by a caller
  // requesting a non-ratchet route.
  if (route !== "nostr-nip17-v1-ratchet") {
    const existing = resolveFedosDirectRatchetDevicePair(ctx.deviceRegistry, ctx.sessionPersistence, ctx.devicePair);
    if (existing.outcome === "resolved") {
      const metadata = ctx.stateRuntime.getSessionMetadata(existing.sessionId);
      if (metadata !== null && (metadata.lifecycleState === "active" || metadata.lifecycleState === "initialized")) {
        return { route: "unsupported", reason: "downgrade-detected" };
      }
    }
  }

  if (route === "fedos-private-v1" || route === "nostr-nip17-v1") {
    const legacy = resolveFedosPrivateWireRoute(route, ctx.legacyAdapterFor);
    if (legacy === "fedos-private-v1") return { route: "fedos-private-v1" };
    if (legacy === "nostr-nip17-v1") return { route: "nostr-nip17-v1" };
    return { route: "unsupported", reason: "legacy-route-unsupported" };
  }

  if (route !== "nostr-nip17-v1-ratchet") {
    return { route: "unsupported", reason: "unknown-route" };
  }

  const resolution = resolveFedosDirectRatchetDevicePair(ctx.deviceRegistry, ctx.sessionPersistence, ctx.devicePair);
  if (resolution.outcome !== "resolved") {
    return { route: "unsupported", reason: resolution.outcome };
  }

  const readiness = ctx.stateRuntime.readiness(resolution.sessionId);
  if (readiness.state === "session-not-found") {
    return { route: "unsupported", reason: "session-initialization-required" };
  }
  if (readiness.state === "sealing-authority-unavailable" || readiness.state === "runtime-stopped") {
    return { route: "unsupported", reason: "session-unavailable" };
  }
  if (readiness.state === "session-not-active") {
    return { route: "unsupported", reason: sessionReasonFromReadiness(readiness.lifecycleState) };
  }
  if (!fedosDirectRatchetReadinessIsReady(readiness)) {
    return { route: "unsupported", reason: "session-unavailable" };
  }

  return { route: "nostr-nip17-v1-ratchet", sessionId: resolution.sessionId };
}
