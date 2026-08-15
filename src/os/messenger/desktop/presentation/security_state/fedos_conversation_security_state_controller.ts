/**
 * Verified Secure Session UI mega-arc (Coordinator) — the ONE controller
 * composing the EXISTING `FedosDesktopApplicationShell` with this arc's own
 * pure `deriveConversationSecurityState()` evaluator. Mirrors
 * `FedosSafetyCenterController`'s own established composition discipline
 * exactly ("Composes the EXISTING Shell... with this Arc's own pure
 * aggregation... builders. Never a second Shell/Runtime") — never a second
 * Shell, never a second Runtime, no I/O of its own beyond calling
 * already-public, already-real Shell methods.
 *
 * `counterpartyAccountRef` is CALLER-SUPPLIED, mirroring
 * `FedosSafetyCenterController.refreshOverview(ratchetPairs)`'s own
 * established "no account-wide Ratchet-session/peer-capability
 * listing-by-Conversation query exists, caller names the pair" precedent
 * exactly — the renderer already resolves and displays the conversation's
 * counterparty identity for its own header, so it already has this value.
 */
import type { FedosDesktopApplicationShell } from "../../shell/fedos_desktop_application_shell.js";
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import {
  deriveConversationSecurityState,
  type FedosConversationSecurityState,
  type FedosConversationSecurityStateFacts,
} from "./fedos_conversation_security_state.js";

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosConversationSecurityStateController {
  readonly #shell: FedosDesktopApplicationShell;
  /**
   * The SAME runtime-wide, construction-time-fixed value
   * `sendDirectMessage()`'s own real routing decision reads
   * (`FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`,
   * a test-injection-only env var in the packaged build, unset on every
   * ordinary launch -- see `fedos_direct_conversation_forward_secrecy_route.ts`'s
   * own header). Supplied by the composition root directly (the SAME value
   * it already reads to build the Runtime config) rather than plumbed
   * through a new Shell/Runtime accessor -- this is process-launch
   * configuration, not domain state.
   */
  #messageDeliveryRemoteDeviceRef: string | null = null;

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  /** Mirrors `FedosSafetyCenterController.configureOptionalDependencies()`'s own "always a safe default, real value injected once available" convention -- the composition root calls this once, right after it reads the same env var itself for Runtime config. */
  setMessageDeliveryRemoteDeviceRef(value: string | null): void {
    this.#messageDeliveryRemoteDeviceRef = value;
  }

  /**
   * Synchronous — every fact source this method calls is itself
   * synchronous (`directRatchetStatus`/`conversationIdentityContinuity`/
   * `peerDeviceAnnouncementListObserved`/`identityTransitionStatus` are all
   * synchronous reads over already-durable local state, no network I/O
   * inside this call). `now` is caller-supplied (never `Date.now()` read
   * here), matching this codebase's own established "no hidden clock
   * read inside a pure/near-pure boundary" discipline.
   */
  getSecurityState(conversationId: string, counterpartyAccountRef: FedosDeviceBindingAccountRef | null, now: number): FedosConversationSecurityState {
    const facts = this.#gatherFacts(conversationId, counterpartyAccountRef, now);
    return deriveConversationSecurityState(facts);
  }

  #gatherFacts(conversationId: string, counterpartyAccountRef: FedosDeviceBindingAccountRef | null, now: number): FedosConversationSecurityStateFacts {
    // --- Axis 1: IDENTITY_CONTINUITY ---
    const continuityResult = this.#shell.conversationIdentityContinuity(conversationId);
    const continuity = continuityResult.outcome === "ok" ? continuityResult.value : null;
    let silentlyAutoAcceptedWithoutAsking = false;
    if (continuity !== null) {
      const statusResult = this.#shell.identityTransitionStatus(continuity.oldAccountIdentity, continuity.localDeviceRef, continuity.transitionId);
      if (statusResult.outcome === "ok" && statusResult.value !== null) {
        silentlyAutoAcceptedWithoutAsking = statusResult.value.silentlyAutoAcceptedWithoutAsking;
      }
    }

    // --- Axis 4: DEVICE_KNOWLEDGE (also feeds the remoteDeviceRef used by axes 2/3) ---
    // FedOS Peer Device Discovery Arc -- REDESIGNED: this controller now
    // sources its device facts from `peerDeviceAnnouncementListObserved()`
    // (a LIVE Device Registry trust-state lookup, per real cross-account
    // signed announcements) instead of `peerCapabilityListObserved()`
    // (a capability-compatibility signal, never a trust claim -- see
    // `fedos_conversation_security_state.ts`'s own Axis 4 header for the
    // full justification). This is the single, strictly stronger fact
    // source for device selection across every axis below -- never two
    // divergent device lists feeding different axes.
    const peerDeviceAnnouncementResult = this.#shell.peerDeviceAnnouncementListObserved();
    const observedForCounterparty =
      peerDeviceAnnouncementResult.outcome === "ok" && counterpartyAccountRef !== null
        ? peerDeviceAnnouncementResult.value.filter((d) => accountRefsEqual(d.peerAccountRef, counterpartyAccountRef))
        : [];
    // Prefer an already-trusted device for the real Ratchet check; fall
    // back to the first observed device either way -- honest either way,
    // never fabricated.
    const chosenDevice = observedForCounterparty.find((d) => d.trustState === "trusted") ?? observedForCounterparty[0];

    // --- Axis 2: ENCRYPTION ---
    const ratchetStatusResult = chosenDevice !== undefined ? this.#shell.directRatchetStatus(conversationId, chosenDevice.deviceId) : null;
    const ratchetStatus = ratchetStatusResult !== null && ratchetStatusResult.outcome === "ok" ? ratchetStatusResult.value : null;

    // --- Axis 3: FORWARD_SECRECY --- see `fedos_conversation_security_state.ts`'s
    // own header for why this is a separate axis from ENCRYPTION. Honest,
    // conservative proxy for `selectFedosDirectConversationForwardSecrecyRoute()`'s
    // real send-time decision, using ONLY facts already reachable from this
    // controller: a session must be genuinely `"active"` for THIS exact
    // device AND the runtime-wide message-delivery device ref (the same
    // real gate `sendDirectMessage()` itself checks -- see
    // `fedos_conversation_direct_messaging_coordinator.ts`) must be set to
    // THIS exact device. Never inferred from session existence alone.
    const forwardSecrecyConfigured =
      this.#messageDeliveryRemoteDeviceRef !== null && chosenDevice !== undefined && this.#messageDeliveryRemoteDeviceRef === chosenDevice.deviceId;
    const forwardSecrecy = ratchetStatus === null ? null : ratchetStatus === "active" && forwardSecrecyConfigured;
    const forwardSecrecyReason = forwardSecrecy === false ? (forwardSecrecyConfigured ? null : "ratchet-not-configured") : null;

    // --- Axis 5: EVIDENCE_INTEGRITY --- no dedicated Shell query exists for
    // "most recent rejected security evidence for this conversation" today
    // (a genuine gap -- see this arc's own Direct Ratchet readiness note);
    // honestly reports null (no known rejection) rather than fabricating a
    // negative signal that cannot currently be derived.
    const evidenceIntegrity = { lastRejectionReasonCode: null, asOf: now };

    // --- Axis 6: METADATA_EXPOSURE --- permanent, needs no live count.
    const metadataExposure = { connectedRelayCount: null };

    return {
      conversationId,
      now,
      identityContinuity: {
        hasRecord: continuity !== null,
        acceptanceState: continuity === null ? null : (continuity.evidenceLevel as "manual-review-required" | "accepted" | "rejected" | "conflicting" | "stale" | "superseded" | "rollback-detected"),
        silentlyAutoAcceptedWithoutAsking,
        recordedAt: continuity?.acceptedAt ?? null,
        hasEverExchangedMessages: this.#hasEverExchangedMessages(conversationId),
      },
      encryption: { ratchetStatus, asOf: now },
      forwardSecrecy: { forwardSecrecy, reason: forwardSecrecyReason, asOf: now },
      deviceKnowledge: { observedPeerDeviceTrustStates: observedForCounterparty.map((d) => d.trustState), asOf: now },
      evidenceIntegrity,
      metadataExposure,
    };
  }

  /**
   * Honest "does this conversation have any real history at all" signal,
   * distinguishing a genuinely brand-new peer from a known one with no
   * identity changes. Found and fixed live, this arc, via a real two-
   * process installed E2E: an EARLIER version of this method used
   * `getConversation(conversationId).participantCount > 0`, which is
   * trivially true the INSTANT a conversation is created (both parties are
   * already members) -- a real false-green (`IDENTITY_CONTINUITY: GOOD`
   * for a conversation seconds old, with a peer never before observed),
   * exactly the "TOFU presented as verified" failure mandate section 27's
   * scenario 1 forbids. Message history, not membership, is the honest
   * signal: a conversation with zero exchanged messages has no real basis
   * for "no unexplained change observed" to mean anything yet.
   */
  #hasEverExchangedMessages(conversationId: string): boolean {
    const messages = this.#shell.listMessages(conversationId);
    return messages.outcome === "ok" && messages.value.length > 0;
  }
}
