/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — the ONE Safety Center controller. Composes the
 * EXISTING `FedosDesktopApplicationShell` (this Arc's own four narrow,
 * additive accessors plus every already-public method it already had) with
 * this Arc's own pure aggregation/screen-model builders. Never a second
 * Shell/Runtime/Presentation Boundary/Renderer/Navigation Registry.
 *
 * Two OPTIONAL sibling facades are accepted beyond the Shell — never a
 * second Shell/Runtime of any kind, but real, honest sections this
 * mission's own Phase C item 1/Phase N explicitly require cannot be built
 * from the Shell alone (the Shell only exists AFTER a profile is already
 * unlocked; Settings is its own separate, pre-existing domain):
 *   - `profileCoordinator` (`FedosProfileInitializationCoordinator`,
 *     `4661-4740`, unmodified) — read-only `status()` call only, for the
 *     "profile-and-unlock" section. Omitted, that section is honestly
 *     `"unavailable"`, never fabricated as locked/unlocked.
 *   - `settingsController` (`FedosDesktopSettingsController`, pre-existing,
 *     unmodified) — read via `load()`, written via `save()` for exactly the
 *     two already-existing fields this domain needs
 *     (`notificationsEnabled`/`backgroundSyncEnabled`) — never a second
 *     settings system, never a new field.
 */
import type { FedosDesktopApplicationShell } from "../../shell/fedos_desktop_application_shell.js";
import type { FedosProfileInitializationCoordinator } from "../../onboarding/fedos_profile_initialization_coordinator.js";
import type { FedosDesktopSettingsController } from "../../settings/fedos_desktop_settings_controller.js";
import { fedosViewModelIdle, fedosViewModelLoading, fedosViewModelLoaded, fedosViewModelError, type FedosDesktopViewModelState } from "../fedos_desktop_view_model_state.js";
import { FedosSafetyCenterNavigationState, type FedosSafetyCenterConfirmableAction } from "./fedos_safety_center_navigation_state.js";
import { fedosSafetyCenterBuildSummary, type FedosSafetyCenterRawFacts, type FedosSafetyCenterSummaryV1 } from "./fedos_safety_center_summary.js";
import { fedosSafetyCenterBuildOverviewContent, fedosSafetyCenterBuildConfirmationContent, type FedosSafetyCenterOverviewContent, type FedosSafetyCenterConfirmationContent } from "./fedos_safety_center_screen_model.js";
import { fedosSafetyCenterBuildEventTimeline, type FedosSafetyCenterEventV1 } from "./fedos_safety_center_event_timeline.js";
import { FedosDesktopNotificationCoordinator } from "../../../notifications/fedos_desktop_notification_coordinator.js";
import { NoopFedosDesktopNotificationPort, type FedosDesktopNotificationPort } from "../../../notifications/fedos_desktop_notification_port.js";
import type { FedosDirectRatchetSafeStatus } from "../../../conversations/ratchet/fedos_direct_ratchet_conversation_runtime.js";
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";

export interface FedosSafetyCenterRatchetPairToAssess {
  readonly conversationId: string;
  readonly remoteDeviceRef: string;
}

export interface FedosSafetyCenterPeerToAssess {
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly peerDeviceRef: string;
}

export interface FedosSafetyCenterControllerDependencies {
  readonly profileCoordinator?: FedosProfileInitializationCoordinator | null;
  readonly settingsController?: FedosDesktopSettingsController | null;
  readonly notificationPort?: FedosDesktopNotificationPort;
}

export class FedosSafetyCenterController {
  readonly navigation = new FedosSafetyCenterNavigationState();
  readonly #shell: FedosDesktopApplicationShell;
  #profileCoordinator: FedosProfileInitializationCoordinator | null;
  #settingsController: FedosDesktopSettingsController | null;
  #notificationCoordinator: FedosDesktopNotificationCoordinator;
  /** Restart-non-durable, in-memory only -- which facts this process has already raised a notification for, mirroring `FedosDeletionRequestController.#notifiedRequestIds`'s own established discipline exactly. */
  readonly #notifiedFacts = new Set<string>();

  #overviewState: FedosDesktopViewModelState<FedosSafetyCenterOverviewContent> = fedosViewModelIdle();
  #eventsState: FedosDesktopViewModelState<readonly FedosSafetyCenterEventV1[]> = fedosViewModelIdle();
  #confirmationState: FedosDesktopViewModelState<FedosSafetyCenterConfirmationContent> = fedosViewModelIdle();
  #actionInFlight = false;

  constructor(shell: FedosDesktopApplicationShell, deps: FedosSafetyCenterControllerDependencies = {}) {
    this.#shell = shell;
    this.#profileCoordinator = deps.profileCoordinator ?? null;
    this.#settingsController = deps.settingsController ?? null;
    this.#notificationCoordinator = new FedosDesktopNotificationCoordinator(deps.notificationPort ?? new NoopFedosDesktopNotificationPort());
  }

  /** Swaps in a real notification backend after construction — mirrors `FedosDeletionRequestController.setNotificationPort()`'s own convention exactly; never a second, parallel notification subsystem. */
  setNotificationPort(port: FedosDesktopNotificationPort): void {
    this.#notificationCoordinator = new FedosDesktopNotificationCoordinator(port);
  }

  /**
   * `FedosDesktopConversationUiPresentationBoundary`'s own constructor
   * accepts only a Shell (unchanged by this Arc) — the two sibling
   * facades this Controller optionally needs are supplied AFTER
   * construction, mirroring `setNotificationPort()`'s own "always a safe
   * default, real backend injected once available" convention. Omitted,
   * the "profile-and-unlock"/"notifications-and-background" sections
   * remain honestly `"unavailable"`.
   */
  configureOptionalDependencies(deps: { readonly profileCoordinator?: FedosProfileInitializationCoordinator | null; readonly settingsController?: FedosDesktopSettingsController | null }): void {
    if (deps.profileCoordinator !== undefined) this.#profileCoordinator = deps.profileCoordinator;
    if (deps.settingsController !== undefined) this.#settingsController = deps.settingsController;
  }

  get overviewState(): FedosDesktopViewModelState<FedosSafetyCenterOverviewContent> {
    return this.#overviewState;
  }

  get eventsState(): FedosDesktopViewModelState<readonly FedosSafetyCenterEventV1[]> {
    return this.#eventsState;
  }

  get confirmationState(): FedosDesktopViewModelState<FedosSafetyCenterConfirmationContent> {
    return this.#confirmationState;
  }

  // ---------------------------------------------------------------------
  // Phase C — the safe security summary. `ratchetPairs`/`peers` are
  // caller-supplied (e.g. the currently-open Conversation's own known
  // Device pairs) — no account-wide Ratchet-session or peer-capability
  // listing-by-Conversation query exists (Ratchet); peer-capability DOES
  // have a real full listing, used unconditionally below.
  // ---------------------------------------------------------------------

  async refreshOverview(ratchetPairs: readonly FedosSafetyCenterRatchetPairToAssess[] = []): Promise<void> {
    this.#overviewState = fedosViewModelLoading();

    const devicesResult = this.#shell.devicesList();
    const devices = devicesResult.outcome === "ok" ? devicesResult.value : [];
    const trustedDeviceCount = devices.filter((d) => d.trustState === "trusted").length;
    const revokedDeviceCount = devices.filter((d) => d.trustState === "revoked").length;

    const syncResult = this.#shell.deviceSyncStatus();
    const deviceSyncRunning = syncResult.outcome === "ok" ? syncResult.value.running : null;
    const pendingSyncConflictCount = syncResult.outcome === "ok" ? syncResult.value.pendingCount : 0;

    const productionCryptoResult = this.#shell.productionCryptoStatus();
    const productionCrypto = productionCryptoResult.outcome === "ok" ? productionCryptoResult.value : null;

    const ratchetSessionStatuses: FedosDirectRatchetSafeStatus[] = [];
    for (const pair of ratchetPairs) {
      const r = this.#shell.directRatchetStatus(pair.conversationId, pair.remoteDeviceRef);
      if (r.outcome === "ok") ratchetSessionStatuses.push(r.value);
    }

    const peerCapabilityResult = this.#shell.peerCapabilityListObserved();
    const peerCapabilityStatuses = peerCapabilityResult.outcome === "ok" ? peerCapabilityResult.value : [];

    const identityListResult = this.#shell.identityTransitionList(200, 0);
    const identityRuntimeConfigured = identityListResult.outcome !== "unavailable";
    const pendingIdentityReplacementCount =
      identityListResult.outcome === "ok" ? identityListResult.value.filter((v) => !v.superseded && v.acceptanceState !== "accepted" && v.acceptanceState !== "rejected").length : 0;
    // Wave A (Agent S) Task 1 — old-key continuity auto-accept visibility
    // recovery. Counted SEPARATELY from `pendingIdentityReplacementCount`
    // above: these are NOT pending (they already reached "accepted"), so
    // without this they would never surface anywhere in the Safety Center
    // at all. See `fedos_identity_transition_silent_acceptance_detection.ts`.
    const accountSilentlyAcceptedIdentityReplacementCount =
      identityListResult.outcome === "ok" ? identityListResult.value.filter((v) => v.silentlyAutoAcceptedWithoutAsking).length : 0;

    const deletionListResult = this.#shell.deletionRequestListReceived();
    const deletionRuntimeConfigured = deletionListResult.outcome !== "unavailable";
    const pendingDeletionConsentCount = deletionListResult.outcome === "ok" ? deletionListResult.value.filter((r) => r.decisionState === "policy-pending").length : 0;
    // No account-wide "sent requests across every Conversation" query exists (`deletionRequestListSentForTarget` needs one specific target) — 0 here is honest, never fabricated.
    const mixedOrUnknownDeletionOutcomeCount = 0;

    const profileStatus = this.#profileCoordinator?.status() ?? null;
    const settingsResult = this.#settingsController?.load() ?? null;
    const notificationsEnabled = settingsResult !== null && settingsResult.outcome === "ok" ? settingsResult.value.notificationsEnabled : null;
    const backgroundSyncEnabled = settingsResult !== null && settingsResult.outcome === "ok" ? settingsResult.value.backgroundSyncEnabled : null;

    const facts: FedosSafetyCenterRawFacts = {
      profileLifecycleState: profileStatus?.lifecycleState ?? null,
      productionCrypto,
      trustedDeviceCount,
      revokedDeviceCount,
      totalKnownDeviceCount: devices.length,
      deviceSyncRunning,
      pendingSyncConflictCount,
      ratchetSessionStatuses,
      peerCapabilityStatuses,
      peerCapabilityRuntimeConfigured: peerCapabilityResult.outcome !== "unavailable",
      pendingIdentityReplacementCount,
      accountSilentlyAcceptedIdentityReplacementCount,
      identityReplacementRuntimeConfigured: identityRuntimeConfigured,
      pendingDeletionConsentCount,
      mixedOrUnknownDeletionOutcomeCount,
      deletionRequestRuntimeConfigured: deletionRuntimeConfigured,
      notificationsEnabled,
      backgroundSyncEnabled,
    };
    const summary = fedosSafetyCenterBuildSummary(facts);
    this.#overviewState = fedosViewModelLoaded(fedosSafetyCenterBuildOverviewContent(summary));
    await this.#notifyNewAttentionFacts(summary, devices, peerCapabilityStatuses);
  }

  /**
   * Phase L — fires ONLY for facts that have NO existing per-domain
   * notification anywhere in this codebase (confirmed by this Arc's own
   * inventory: Device revocation, Ratchet reset-required, peer-capability
   * conflict, and Identity Replacement pending-review had none). Deletion
   * Request's own `FedosDeletionRequestController` already fires
   * `"deletion-request-received"` — this method never re-fires an
   * equivalent signal for the SAME fact (Phase L's own "do not double-fire"
   * requirement). In-memory-only dedup, once per fact per process lifetime.
   */
  async #notifyNewAttentionFacts(
    summary: FedosSafetyCenterSummaryV1,
    devices: readonly { readonly deviceId: string; readonly trustState: string }[],
    peerStatuses: readonly { readonly peerAccountRef: FedosDeviceBindingAccountRef; readonly peerDeviceRef: string; readonly safeStatus: string }[],
  ): Promise<void> {
    for (const d of devices) {
      if (d.trustState !== "revoked") continue;
      const key = `device-revoked:${d.deviceId}`;
      if (this.#notifiedFacts.has(key)) continue;
      this.#notifiedFacts.add(key);
      await this.#notificationCoordinator.notify({ kind: "device-revoked" });
    }
    if (summary.resetRequiredRatchetSessionCount > 0) {
      const key = "ratchet-reset-required";
      if (!this.#notifiedFacts.has(key)) {
        this.#notifiedFacts.add(key);
        await this.#notificationCoordinator.notify({ kind: "ratchet-reset-required", detail: `${summary.resetRequiredRatchetSessionCount} session(s)` });
      }
    }
    for (const p of peerStatuses) {
      if (p.safeStatus !== "conflicting") continue;
      const key = `peer-conflict:${p.peerAccountRef}:${p.peerDeviceRef}`;
      if (this.#notifiedFacts.has(key)) continue;
      this.#notifiedFacts.add(key);
      await this.#notificationCoordinator.notify({ kind: "peer-capability-conflict" });
    }
    if (summary.pendingIdentityReplacementCount > 0) {
      const key = "identity-replacement-pending-review";
      if (!this.#notifiedFacts.has(key)) {
        this.#notifiedFacts.add(key);
        await this.#notificationCoordinator.notify({ kind: "identity-replacement-pending-review", detail: `${summary.pendingIdentityReplacementCount} pending` });
      }
    }
    // Wave A (Agent S) Task 1 — old-key continuity auto-accept visibility
    // recovery. This fact has NO existing per-domain notification anywhere
    // in this codebase (it is not "pending", so the block immediately
    // above never covers it) -- fires exactly once per process lifetime,
    // same in-memory dedup discipline as every other fact in this method.
    if (summary.accountSilentlyAcceptedIdentityReplacementCount > 0) {
      const key = "identity-replacement-accepted-without-asking";
      if (!this.#notifiedFacts.has(key)) {
        this.#notifiedFacts.add(key);
        await this.#notificationCoordinator.notify({
          kind: "identity-replacement-accepted-without-asking",
          detail: `${summary.accountSilentlyAcceptedIdentityReplacementCount} auto-accepted`,
        });
      }
    }
    // Deliberately NOT firing for `summary.pendingDeletionConsentCount` — `FedosDeletionRequestController` already raises `"deletion-request-received"` for the SAME underlying fact (Phase L "no double-fire").
  }

  // ---------------------------------------------------------------------
  // Phase E — bounded, safe event timeline, composed from already-real,
  // already-durable per-domain facts only.
  // ---------------------------------------------------------------------

  async refreshEvents(limit = 200, offset = 0): Promise<void> {
    this.#eventsState = fedosViewModelLoading();
    const events: FedosSafetyCenterEventV1[] = [];

    const devicesResult = this.#shell.devicesList();
    if (devicesResult.outcome === "ok") {
      for (const d of devicesResult.value) {
        events.push({ category: "device-registered", at: d.createdAt, subjectRef: d.deviceId });
        if (d.trustState === "trusted") events.push({ category: "device-trusted", at: d.createdAt, subjectRef: d.deviceId });
        if (d.trustState === "revoked" && d.revokedAt !== null) events.push({ category: "device-revoked", at: d.revokedAt, subjectRef: d.deviceId });
      }
    }

    const identityResult = this.#shell.identityTransitionList(200, 0);
    if (identityResult.outcome === "ok") {
      for (const v of identityResult.value) {
        const category = v.acceptanceState === "accepted" ? "identity-replacement-accepted" : v.acceptanceState === "rejected" ? "identity-replacement-rejected" : v.evidenceOutcome === "conflicting" ? "identity-replacement-conflicting" : "identity-replacement-observed";
        events.push({ category, at: Date.now(), subjectRef: v.transitionId });
      }
    }

    const deletionResult = this.#shell.deletionRequestListReceived();
    if (deletionResult.outcome === "ok") {
      for (const r of deletionResult.value) {
        const category =
          r.decisionState === "policy-pending" ? "deletion-request-received" : r.decisionState === "policy-rejected" ? "deletion-request-rejected" : "deletion-request-approved";
        events.push({ category, at: r.summary.recordedAt, subjectRef: r.summary.requestId });
      }
    }

    this.#eventsState = fedosViewModelLoaded(fedosSafetyCenterBuildEventTimeline(events, limit, offset));
  }

  // ---------------------------------------------------------------------
  // Phase F — explicit, confirmed dangerous actions. Every one goes through
  // the Safety Confirmation Dialog first — never a direct one-call mutate.
  // ---------------------------------------------------------------------

  requestRevokeDeviceConfirmation(deviceId: string, devicePublicKeyHex: string): void {
    const action: FedosSafetyCenterConfirmableAction = { kind: "revoke-device", deviceId, devicePublicKeyHex };
    this.navigation.requestConfirmation(action);
    this.#confirmationState = fedosViewModelLoaded(fedosSafetyCenterBuildConfirmationContent(action));
  }

  requestAuthorizeRatchetResetConfirmation(conversationId: string, remoteDeviceRef: string): void {
    const action: FedosSafetyCenterConfirmableAction = { kind: "authorize-ratchet-reset", conversationId, remoteDeviceRef };
    this.navigation.requestConfirmation(action);
    this.#confirmationState = fedosViewModelLoaded(fedosSafetyCenterBuildConfirmationContent(action));
  }

  cancelPendingConfirmation(): void {
    this.navigation.clearConfirmation();
    this.#confirmationState = fedosViewModelIdle();
  }

  /** Duplicate submission is prevented — mirrors `FedosDeletionRequestController`/`FedosIdentityTransitionController`'s own `#actionInFlight` discipline exactly. */
  async confirmPendingAction(): Promise<void> {
    if (this.#actionInFlight) return;
    const action = this.navigation.pendingConfirmation;
    if (action === null) return;
    this.#actionInFlight = true;
    try {
      if (action.kind === "revoke-device") {
        const result = await this.#shell.deviceRevoke(action.deviceId, action.devicePublicKeyHex);
        if (result.outcome !== "ok") {
          this.#confirmationState = fedosViewModelError(result.outcome, result.reason);
          return;
        }
      } else {
        // "authorize-ratchet-reset" is deliberately NOT reachable from this generic dialog for
        // an Identity Replacement transition — that path remains
        // `identityTransitionAuthorizeRatchetReset()`'s own two-step (assess-then-authorize) call
        // contract, unmodified. This dialog's own ratchet-reset confirmation exists for a future,
        // non-identity-replacement manual reset entry point; today it honestly reports
        // `"unsupported"` rather than fabricating a reset this Arc does not itself perform.
        this.#confirmationState = fedosViewModelError("unsupported", "manual Ratchet reset outside the Identity Replacement flow is not implemented");
        return;
      }
      this.navigation.clearConfirmation();
      this.#confirmationState = fedosViewModelIdle();
      await this.refreshOverview();
    } finally {
      this.#actionInFlight = false;
    }
  }

  // ---------------------------------------------------------------------
  // Phase N — Settings passthrough. Never a second settings system, never
  // a new field beyond the two this domain needs.
  // ---------------------------------------------------------------------

  async updateNotificationsEnabled(enabled: boolean): Promise<boolean> {
    if (this.#settingsController === null) return false;
    const current = this.#settingsController.load();
    if (current.outcome !== "ok") return false;
    const result = this.#settingsController.save({ ...current.value, notificationsEnabled: enabled });
    return result.outcome === "ok";
  }

  async updateBackgroundSyncEnabled(enabled: boolean): Promise<boolean> {
    if (this.#settingsController === null) return false;
    const current = this.#settingsController.load();
    if (current.outcome !== "ok") return false;
    const result = this.#settingsController.save({ ...current.value, backgroundSyncEnabled: enabled });
    return result.outcome === "ok";
  }

  // ---------------------------------------------------------------------
  // Navigation passthroughs.
  // ---------------------------------------------------------------------

  goto(section: unknown): boolean {
    return this.navigation.goto(section);
  }

  goBack(): boolean {
    return this.navigation.goBack();
  }
}
