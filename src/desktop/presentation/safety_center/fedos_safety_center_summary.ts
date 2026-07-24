/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase C: the pure, safe security summary aggregator.
 *
 * Every field here is traceable to a real Shell/sub-Runtime accessor the
 * Controller (`fedos_safety_center_controller.ts`) gathers BEFORE calling
 * this function — this file performs no Runtime call, no persistence, no
 * crypto of its own. No hidden weighting, no single numeric score, no
 * `"100% safe"`/`"all protected"` output — each section keeps its OWN
 * independent state (`fedos_safety_center_state.ts`).
 */
import type { FedosConversationProductionCryptoCapabilityOutcome } from "../../../conversation/encryption/production/fedos_conversation_production_crypto_capability_result.js";
import type { FedosDirectRatchetSafeStatus } from "../../../conversation/ratchet/fedos_direct_ratchet_conversation_runtime.js";
import type { FedosRatchetPeerCapabilityPeerDeviceStatus } from "../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.js";
import type { FedosProfileLifecycleState } from "../../onboarding/fedos_profile_lifecycle_state.js";
import type { FedosSafetyCenterSection, FedosSafetyCenterSectionState, FedosSafetyCenterSectionSummary } from "./fedos_safety_center_state.js";

export interface FedosSafetyCenterRawFacts {
  /** `null` when no `FedosProfileInitializationCoordinator` was supplied to the Controller (an honest build-configuration fact, distinct from the profile itself being locked). */
  readonly profileLifecycleState: FedosProfileLifecycleState | null;
  readonly productionCrypto: FedosConversationProductionCryptoCapabilityOutcome | null;
  readonly trustedDeviceCount: number;
  readonly revokedDeviceCount: number;
  readonly totalKnownDeviceCount: number;
  /** `null` when Device Sync is not configured for this Runtime. */
  readonly deviceSyncRunning: boolean | null;
  readonly pendingSyncConflictCount: number;
  /** Caller-named `(conversationId, remoteDeviceRef)` pairs only — no account-wide Ratchet session listing query exists (mirrors `identityTransitionAssessContinuity()`'s own disclosed precedent). Empty when none were assessed. */
  readonly ratchetSessionStatuses: readonly FedosDirectRatchetSafeStatus[];
  readonly peerCapabilityStatuses: readonly FedosRatchetPeerCapabilityPeerDeviceStatus[];
  readonly peerCapabilityRuntimeConfigured: boolean;
  readonly pendingIdentityReplacementCount: number;
  readonly identityReplacementRuntimeConfigured: boolean;
  readonly pendingDeletionConsentCount: number;
  readonly mixedOrUnknownDeletionOutcomeCount: number;
  readonly deletionRequestRuntimeConfigured: boolean;
  /** `null` when no settings controller was supplied to the Controller. */
  readonly notificationsEnabled: boolean | null;
  readonly backgroundSyncEnabled: boolean | null;
}

export interface FedosSafetyCenterSummaryV1 {
  readonly sections: readonly FedosSafetyCenterSectionSummary[];
  readonly productionCryptoActive: boolean;
  readonly profileLocked: boolean | null;
  readonly trustedDeviceCount: number;
  readonly revokedDeviceCount: number;
  readonly deviceSyncRunning: boolean | null;
  readonly pendingSyncConflictCount: number;
  readonly activeRatchetSessionCount: number;
  readonly resetRequiredRatchetSessionCount: number;
  readonly peerCapabilityConflictCount: number;
  readonly pendingIdentityReplacementCount: number;
  readonly pendingDeletionConsentCount: number;
  readonly mixedOrUnknownDeletionOutcomeCount: number;
  readonly notificationsEnabled: boolean | null;
  readonly backgroundSyncEnabled: boolean | null;
  /** Sum of every section's own attention-worthy count — the ONE number a badge may show; never a claim of overall safety. */
  readonly attentionCount: number;
}

function sectionState(section: FedosSafetyCenterSection, state: FedosSafetyCenterSectionState, reason: string | null = null): FedosSafetyCenterSectionSummary {
  return { section, state, reason };
}

const SEVERITY_RANK: Readonly<Record<FedosSafetyCenterSectionState, number>> = {
  ready: 0,
  loading: 0,
  unavailable: 1,
  attention: 2,
  warning: 3,
  blocked: 4,
  error: 4,
};

function worstOf(states: readonly FedosSafetyCenterSectionState[]): FedosSafetyCenterSectionState {
  let worst: FedosSafetyCenterSectionState = "ready";
  for (const s of states) if (SEVERITY_RANK[s] > SEVERITY_RANK[worst]) worst = s;
  return worst;
}

/** Pure, total, never throws — builds every section's state from already-gathered facts, then the one safe overview roll-up (severity-ranked, never averaged/scored). */
export function fedosSafetyCenterBuildSummary(facts: FedosSafetyCenterRawFacts): FedosSafetyCenterSummaryV1 {
  const profileSection: FedosSafetyCenterSectionSummary =
    facts.profileLifecycleState === null
      ? sectionState("profile-and-unlock", "unavailable", "profile lifecycle is not wired into this build")
      : facts.profileLifecycleState === "ready"
        ? sectionState("profile-and-unlock", "ready")
        : sectionState("profile-and-unlock", "blocked", `profile is "${facts.profileLifecycleState}"`);

  const devicesSection: FedosSafetyCenterSectionSummary =
    facts.revokedDeviceCount > 0
      ? sectionState("devices", "warning", `${facts.revokedDeviceCount} revoked Device(s) on record`)
      : facts.totalKnownDeviceCount === 0
        ? sectionState("devices", "attention", "no Devices registered yet")
        : sectionState("devices", "ready");

  const syncSection: FedosSafetyCenterSectionSummary =
    facts.deviceSyncRunning === null
      ? sectionState("device-sync", "unavailable", "Device Sync is not configured for this Runtime")
      : facts.pendingSyncConflictCount > 0
        ? sectionState("device-sync", "warning", `${facts.pendingSyncConflictCount} unresolved sync conflict(s)`)
        : facts.deviceSyncRunning
          ? sectionState("device-sync", "ready")
          : sectionState("device-sync", "attention", "Device Sync is stopped");

  const ratchetWarning = facts.ratchetSessionStatuses.some((s) => s === "reset-required" || s === "revoked" || s === "peer-incompatible");
  const ratchetAttention = facts.ratchetSessionStatuses.some((s) => s === "pending" || s === "initialization-required");
  const messagingSection: FedosSafetyCenterSectionSummary =
    facts.ratchetSessionStatuses.length === 0
      ? sectionState("secure-messaging", "unavailable", "no Ratchet session was assessed (no known Conversation/Device pair supplied)")
      : ratchetWarning
        ? sectionState("secure-messaging", "warning", "at least one Ratchet session requires attention")
        : ratchetAttention
          ? sectionState("secure-messaging", "attention", "at least one Ratchet session is still initializing")
          : sectionState("secure-messaging", "ready");

  const peerConflictCount = facts.peerCapabilityStatuses.filter((s) => s.safeStatus === "conflicting" || s.safeStatus === "revoked").length;
  const peerAttentionCount = facts.peerCapabilityStatuses.filter((s) => s.safeStatus === "reset-required" || s.safeStatus === "stale").length;
  const peerSection: FedosSafetyCenterSectionSummary = !facts.peerCapabilityRuntimeConfigured
    ? sectionState("peer-capabilities", "unavailable", "peer capability Runtime is not configured")
    : peerConflictCount > 0
      ? sectionState("peer-capabilities", "warning", `${peerConflictCount} conflicting/revoked peer capability observation(s)`)
      : peerAttentionCount > 0
        ? sectionState("peer-capabilities", "attention", `${peerAttentionCount} peer capability observation(s) need review`)
        : sectionState("peer-capabilities", "ready");

  const identitySection: FedosSafetyCenterSectionSummary = !facts.identityReplacementRuntimeConfigured
    ? sectionState("identity-replacement", "unavailable", "Identity Transition Runtime is not configured")
    : facts.pendingIdentityReplacementCount > 0
      ? sectionState("identity-replacement", "attention", `${facts.pendingIdentityReplacementCount} pending review(s)`)
      : sectionState("identity-replacement", "ready");

  const deletionSection: FedosSafetyCenterSectionSummary = !facts.deletionRequestRuntimeConfigured
    ? sectionState("deletion-requests", "unavailable", "Deletion Request Runtime is not configured")
    : facts.mixedOrUnknownDeletionOutcomeCount > 0
      ? sectionState("deletion-requests", "warning", `${facts.mixedOrUnknownDeletionOutcomeCount} mixed/unknown per-Device outcome(s)`)
      : facts.pendingDeletionConsentCount > 0
        ? sectionState("deletion-requests", "attention", `${facts.pendingDeletionConsentCount} pending consent item(s)`)
        : sectionState("deletion-requests", "ready");

  const retentionSection = sectionState("retention-and-search", "attention", "deletion here is local-history/local-index only — see Retention limitations");
  const archiveSection = sectionState("archive-and-backups", "attention", "Archives and backups may still retain a copy");
  const notificationsSection: FedosSafetyCenterSectionSummary =
    facts.notificationsEnabled === null ? sectionState("notifications-and-background", "unavailable", "settings are not wired into this build") : sectionState("notifications-and-background", "ready");
  const eventsSection = sectionState("security-events", "ready");
  const limitationsSection = sectionState("limitations", "attention", "see the completion declaration for every disclosed boundary");

  const nonOverviewSections = [
    profileSection,
    devicesSection,
    syncSection,
    messagingSection,
    peerSection,
    identitySection,
    deletionSection,
    retentionSection,
    archiveSection,
    notificationsSection,
    eventsSection,
    limitationsSection,
  ];
  const overviewSection = sectionState("overview", worstOf(nonOverviewSections.map((s) => s.state)));

  const attentionCount =
    facts.revokedDeviceCount +
    facts.pendingSyncConflictCount +
    facts.ratchetSessionStatuses.filter((s) => s === "reset-required").length +
    peerConflictCount +
    facts.pendingIdentityReplacementCount +
    facts.pendingDeletionConsentCount +
    facts.mixedOrUnknownDeletionOutcomeCount;

  return {
    sections: [overviewSection, ...nonOverviewSections],
    productionCryptoActive: facts.productionCrypto === "available",
    profileLocked: facts.profileLifecycleState === null ? null : facts.profileLifecycleState !== "ready",
    trustedDeviceCount: facts.trustedDeviceCount,
    revokedDeviceCount: facts.revokedDeviceCount,
    deviceSyncRunning: facts.deviceSyncRunning,
    pendingSyncConflictCount: facts.pendingSyncConflictCount,
    activeRatchetSessionCount: facts.ratchetSessionStatuses.filter((s) => s === "active").length,
    resetRequiredRatchetSessionCount: facts.ratchetSessionStatuses.filter((s) => s === "reset-required").length,
    peerCapabilityConflictCount: peerConflictCount,
    pendingIdentityReplacementCount: facts.pendingIdentityReplacementCount,
    pendingDeletionConsentCount: facts.pendingDeletionConsentCount,
    mixedOrUnknownDeletionOutcomeCount: facts.mixedOrUnknownDeletionOutcomeCount,
    notificationsEnabled: facts.notificationsEnabled,
    backgroundSyncEnabled: facts.backgroundSyncEnabled,
    attentionCount,
  };
}
