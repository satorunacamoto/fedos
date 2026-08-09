/**
 * Secure Runtime Alpha 5961–6040 — Phase I/J: Ratchet impact
 * identification (read-only, pure) and the narrow, EXPLICIT reset
 * authorization method that is the ONLY way this Arc ever triggers a
 * real Ratchet reset.
 *
 * Phase I's own read-only impact identification is pure — no I/O, no
 * mutation, takes an already-loaded list of live session records. Phase
 * J's `authorizeFedosIdentityTransitionRatchetReset()` is the ONE
 * function in this entire Arc that mutates Ratchet state, and it does so
 * ONLY by calling the EXISTING, unmodified
 * `FedosDirectRatchetOutboundIntegration.establishSession()` with
 * `reason: "identity-transition"` — never a new reset message type
 * (Absolute Prohibitions). It refuses outright unless the caller passes
 * an ALREADY-`"accepted"` acceptance state; it never re-derives or
 * second-guesses that decision itself.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import type { FedosDirectRatchetSessionRecordV1 } from "../../ratchet/fedos_direct_ratchet_session_record.js";
import type {
  FedosDirectRatchetEstablishOutcome,
  FedosDirectRatchetOutboundIntegration,
} from "../../ratchet/fedos_direct_ratchet_outbound_integration.js";
import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosIdentityTransitionAcceptanceState } from "../fedos_identity_transition_acceptance_state.js";
import type { FedosIdentityTransitionRatchetResetLinkPersistence } from "./fedos_identity_transition_ratchet_reset_link.js";

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

/** Lifecycle states this Arc treats as "still live enough to need an explicit reset" — a session already `reset-required`/`expired`/`revoked`/`corrupt`/`unavailable` needs no NEW trigger from this Arc. */
const RESETTABLE_LIFECYCLE_STATES: ReadonlySet<string> = new Set(["initialized", "active", "suspended"]);

export interface FedosIdentityTransitionAffectedSession {
  readonly sessionId: string;
  readonly conversationId: FedosConversationId;
  readonly remoteAccountRef: FedosDeviceBindingAccountRef;
  readonly remoteDeviceRef: string;
}

/**
 * PURE — Phase I. Identifies every live session whose REMOTE party is
 * the transition's OLD identity. Never mutates anything; the caller
 * decides what to do with the result.
 */
export function planFedosIdentityTransitionAffectedSessions(
  oldAccountIdentity: FedosDeviceBindingAccountRef,
  liveSessions: readonly FedosDirectRatchetSessionRecordV1[],
): readonly FedosIdentityTransitionAffectedSession[] {
  return liveSessions
    .filter((s) => RESETTABLE_LIFECYCLE_STATES.has(s.lifecycleState) && accountRefsEqual(s.binding.remoteAccountRef, oldAccountIdentity))
    .map((s) => ({
      sessionId: s.binding.sessionId as unknown as string,
      conversationId: s.binding.conversationId,
      remoteAccountRef: s.binding.remoteAccountRef,
      remoteDeviceRef: s.binding.remoteDeviceRef,
    }));
}

export type FedosIdentityTransitionRatchetResetAuthorizationOutcome =
  | { readonly sessionId: string; readonly outcome: "reset-dispatched"; readonly establishOutcome: string }
  | { readonly sessionId: string; readonly outcome: "reset-not-applicable"; readonly establishOutcome: string }
  | { readonly sessionId: string; readonly outcome: "link-persistence-failed" };

/**
 * Phase J. The ONE function in this Arc that mutates Ratchet state.
 * Refuses outright (`"not-accepted"`) unless `acceptanceState ===
 * "accepted"` — this coordinator never re-evaluates evidence itself, it
 * only acts on an ALREADY-explicit local decision (Phase K/N).
 */
export async function authorizeFedosIdentityTransitionRatchetReset(params: {
  readonly transitionId: string;
  readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
  readonly affectedSessions: readonly FedosIdentityTransitionAffectedSession[];
  readonly outboundIntegration: Pick<FedosDirectRatchetOutboundIntegration, "establishSession">;
  readonly resetLinkPersistence: FedosIdentityTransitionRatchetResetLinkPersistence;
  readonly now: () => number;
}): Promise<
  | { readonly outcome: "not-accepted" }
  | { readonly outcome: "applied"; readonly results: readonly FedosIdentityTransitionRatchetResetAuthorizationOutcome[] }
> {
  if (params.acceptanceState !== "accepted") return { outcome: "not-accepted" };

  const results: FedosIdentityTransitionRatchetResetAuthorizationOutcome[] = [];
  for (const affected of params.affectedSessions) {
    const establishOutcome: FedosDirectRatchetEstablishOutcome = await params.outboundIntegration.establishSession(
      affected.conversationId,
      affected.remoteDeviceRef,
      { reason: "identity-transition" },
    );
    if (establishOutcome.outcome !== "initiated") {
      results.push({ sessionId: affected.sessionId, outcome: "reset-not-applicable", establishOutcome: establishOutcome.outcome });
      continue;
    }
    const linkResult = params.resetLinkPersistence.putLink({
      schemaVersion: 1,
      transitionId: params.transitionId,
      sessionId: establishOutcome.sessionId as unknown as string,
      conversationId: affected.conversationId as unknown as string,
      remoteAccountRef: affected.remoteAccountRef,
      remoteDeviceRef: affected.remoteDeviceRef,
      recordedAt: params.now(),
    });
    if (linkResult === "failed") {
      results.push({ sessionId: affected.sessionId, outcome: "link-persistence-failed" });
      continue;
    }
    results.push({ sessionId: affected.sessionId, outcome: "reset-dispatched", establishOutcome: establishOutcome.outcome });
  }
  return { outcome: "applied", results };
}
