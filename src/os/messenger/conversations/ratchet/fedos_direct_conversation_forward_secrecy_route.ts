/**
 * FedOS Conversation Forward Secrecy Route Selection (Phase 1).
 *
 * WHY THIS EXISTS — the honest statement, verified against source:
 *
 * `FedosConversationDirectMessagingCoordinator.sendDirectMessage()` chooses
 * between two wire routes. The Ratchet route (forward-secret) is taken ONLY
 * when `deps.ratchetDelivery` was constructed, which in turn requires
 * `FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef` to
 * be set. In the packaged Beta that value comes from ONE test-injection
 * environment variable, unset on every ordinary launch. Every real user's
 * message therefore takes the legacy static NIP-17 route, whose NIP-59 seal
 * is encrypted with a static ECDH between the two parties' LONG-TERM account
 * keys — so compromise of either long-term key retroactively decrypts every
 * previously captured message. That is the precise absence of forward
 * secrecy.
 *
 * Worse, the configured device reference is a SINGLE, construction-time-fixed
 * value for the whole Runtime. Even when set it names exactly one remote
 * Device, so it cannot serve two conversations with different peers.
 *
 * WHAT THIS MODULE DOES: it replaces that construction-time global with a
 * PURE, per-conversation, send-time decision, and — equally important — it
 * makes the NEGATIVE answer explicit and machine-readable. Before this
 * module, a message that silently shipped without forward secrecy was
 * indistinguishable from one that did not: nothing in the result said which
 * route ran or why. `FedosForwardSecrecyUnavailableReason` is a closed
 * vocabulary precisely so "no forward secrecy" can never again be a silent
 * default.
 *
 * WHAT THIS MODULE DOES NOT DO — stated plainly so no reader over-reads it:
 * selecting the Ratchet route requires an ALREADY-ESTABLISHED session for
 * this conversation, which requires the counterparty's Device to be a
 * trusted binding in the LOCAL Device Registry. The only production writer
 * of that registry is Device Pairing, which is same-account (multi-device)
 * only. There is no cross-account peer-Device discovery in this codebase, so
 * for a real two-account conversation this function will correctly and
 * honestly return `"no-session-for-conversation"`. Closing that gap needs a
 * peer key/Device announcement protocol — see the Migration Plan, Phase 2.
 *
 * PURE: no I/O, no clock, no crypto, no mutation. Every input is injected.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import { isFedosDeviceBindingRevoked, isFedosDeviceBindingTrusted } from "../../device/fedos_device_binding.js";
import type { FedosDirectRatchetSessionPersistence } from "./persistence/fedos_direct_ratchet_session_persistence.js";
import type { FedosDirectRatchetSessionRecordV1 } from "./fedos_direct_ratchet_session_record.js";

/**
 * The closed set of reasons a message did NOT get forward secrecy. Every
 * value names a REAL, reachable condition in this codebase — none is
 * aspirational, and none collapses into a generic "unavailable".
 */
export type FedosForwardSecrecyUnavailableReason =
  /** No Ratchet route is wired into this Runtime at all (the ordinary packaged default). */
  | "ratchet-not-configured"
  /** Ratchet is wired, but no Ratchet session exists for THIS conversation. The dominant real case: no cross-account peer-Device discovery exists to bootstrap one. */
  | "no-session-for-conversation"
  /** A session exists, but the remote Device binding is absent from the local Device Registry. */
  | "remote-device-unknown"
  /** A session exists, but the remote Device binding has been revoked. Fail closed — never silently downgrade to a revoked peer. */
  | "remote-device-revoked"
  /** A session exists, but the remote Device binding is not in a trusted state. */
  | "remote-device-not-trusted"
  /** Several distinct remote Devices have sessions for this conversation and no single one can be chosen without guessing. Fail closed rather than pick arbitrarily. */
  | "ambiguous-remote-device";

export type FedosDirectConversationForwardSecrecyRoute =
  | {
      readonly route: "ratchet";
      readonly remoteDeviceRef: string;
      readonly remoteAccountRef: FedosDeviceBindingAccountRef;
      readonly generation: number;
    }
  | { readonly route: "legacy"; readonly reason: FedosForwardSecrecyUnavailableReason };

export interface FedosDirectConversationForwardSecrecyRouteRequest {
  readonly conversationId: FedosConversationId;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  /** `false` when no Ratchet route is wired at all — short-circuits to `"ratchet-not-configured"`. */
  readonly ratchetConfigured: boolean;
  readonly sessionPersistence: FedosDirectRatchetSessionPersistence;
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

function legacy(reason: FedosForwardSecrecyUnavailableReason): FedosDirectConversationForwardSecrecyRoute {
  return { route: "legacy", reason };
}

/**
 * Decide, for ONE conversation at send time, whether the forward-secret
 * Ratchet route can genuinely be used — and when it cannot, say exactly why.
 *
 * Selection rule: among the local Device's own Ratchet sessions bound to this
 * conversation, take the highest generation. If that resolves to more than
 * one DISTINCT remote Device, fail closed with `"ambiguous-remote-device"`
 * rather than guess — picking arbitrarily is how a message ends up encrypted
 * to the wrong peer's Device.
 *
 * Bounded truthfulness hardening (Direct Ratchet identity-space audit) — a
 * candidate session record's own `lifecycleState` (`fedos_direct_ratchet_session_lifecycle.js`)
 * MUST be `"active"` to count. Before this check, a `"revoked"`/
 * `"reset-required"`/`"expired"`/`"corrupt"` session record still passed
 * `resolveFedosDirectRatchetRoute()`'s own `sessionPersistence.listSessions()`-
 * derived candidate set here unfiltered by lifecycle state at all (only the
 * separate live Device-Registry binding trust was checked below) — a real,
 * if currently DORMANT (see this file's own header: `ratchetConfigured` is
 * `false` on every ordinary packaged launch, which already short-circuits
 * above), gap where a session this Runtime would refuse to actually use for
 * sending (`FedosDirectRatchetStateRuntime.readiness()`/`updateCounters()`
 * both require exactly `"active"`) could still be reported here as
 * `route: "ratchet"` / `forwardSecrecy: true`. This filter cannot make this
 * function report `"ratchet"` in any case it did not already; it can only
 * ever narrow an existing `"ratchet"` answer to the honest `"legacy"` one.
 * Still NOT a full guarantee the Ratchet route will actually succeed — only
 * the LIVE cryptographic session (`FedosDirectRatchetCryptographicSession.isReadyToSend()`,
 * checked separately, at send time, inside `FedosDirectRatchetOutboundIntegration.sendMessage()`)
 * knows that; this module has no access to that live, in-memory state and
 * intentionally does not gain any here (out of this fix's own bounded,
 * non-architectural scope) — see this file's own "WHAT THIS MODULE DOES
 * NOT DO" header section.
 */
export function selectFedosDirectConversationForwardSecrecyRoute(
  request: FedosDirectConversationForwardSecrecyRouteRequest,
): FedosDirectConversationForwardSecrecyRoute {
  if (!request.ratchetConfigured) return legacy("ratchet-not-configured");

  const candidates: FedosDirectRatchetSessionRecordV1[] = [];
  for (const record of request.sessionPersistence.listSessions()) {
    const b = record.binding;
    if (b.conversationId !== request.conversationId) continue;
    if (!accountRefsEqual(b.localAccountRef, request.localAccountRef)) continue;
    if (b.localDeviceRef !== request.localDeviceRef) continue;
    if (record.lifecycleState !== "active") continue;
    candidates.push(record);
  }
  if (candidates.length === 0) return legacy("no-session-for-conversation");

  let highestGeneration = -1;
  for (const record of candidates) {
    if (record.binding.generation > highestGeneration) highestGeneration = record.binding.generation;
  }
  const current = candidates.filter((record) => record.binding.generation === highestGeneration);

  const distinctDeviceRefs = new Set(current.map((record) => record.binding.remoteDeviceRef));
  if (distinctDeviceRefs.size > 1) return legacy("ambiguous-remote-device");

  const chosen = current[0]!;
  const remoteDeviceRef = chosen.binding.remoteDeviceRef;

  // The session record alone is NOT authority to send: the Device binding is
  // re-checked against the live registry on EVERY send, so a revocation that
  // lands after a session was established takes effect immediately rather
  // than at the next restart.
  const binding = request.deviceRegistry.getBinding(remoteDeviceRef);
  if (binding === null) return legacy("remote-device-unknown");
  if (isFedosDeviceBindingRevoked(binding)) return legacy("remote-device-revoked");
  if (!isFedosDeviceBindingTrusted(binding)) return legacy("remote-device-not-trusted");

  return {
    route: "ratchet",
    remoteDeviceRef,
    remoteAccountRef: chosen.binding.remoteAccountRef,
    generation: highestGeneration,
  };
}

/**
 * A stable, non-secret, user-presentable description of a route decision.
 * Carries NO key material, NO Device identifier, and NO account identifier —
 * safe to log, to surface in the UI, and to assert on in tests.
 */
export function describeFedosForwardSecrecyRoute(route: FedosDirectConversationForwardSecrecyRoute): {
  readonly forwardSecrecy: boolean;
  readonly reason: FedosForwardSecrecyUnavailableReason | null;
} {
  return route.route === "ratchet"
    ? { forwardSecrecy: true, reason: null }
    : { forwardSecrecy: false, reason: route.reason };
}
