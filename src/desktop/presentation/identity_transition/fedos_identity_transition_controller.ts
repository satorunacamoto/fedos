/**
 * Secure Runtime Alpha 6121–6200 (FedOS Identity Replacement User
 * Verification and Conversation Continuity UI Arc) — Phases C/L: the ONE
 * Identity Transition controller. Owns navigation state (Phase N) and
 * composes the EXISTING `FedosDesktopApplicationShell` identity-transition
 * methods (`5961-6040` facade underneath) with this Arc's own pure
 * screen-model builders. Calls NOTHING beyond the Shell's own
 * already-public methods — never `conversationRuntime()`/
 * `identityTransition()` directly, never a persistence port, crypto
 * authority, or secret.
 *
 * `"Evidence Review"` and `"Peer Device Evidence"` (Phase L's own named
 * ViewModels) are represented by the SAME `detailState` as
 * `"Identity Transition Detail"` — the safe view the Shell already
 * returns (`FedosIdentityTransitionSafeViewV1`) already includes the full
 * per-Device evidence list and centralized warnings; a second, divergent
 * read would only risk drifting from the first.
 *
 * Opening/inspecting NEVER accepts/rejects/resets anything — only
 * `acceptSelected()`/`rejectSelected()`/`authorizeRatchetReset()` mutate
 * any durable state, and they remain entirely separate calls (Phase C/H).
 */
import type { FedosDesktopApplicationShell } from "../../shell/fedos_desktop_application_shell.js";
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import { fedosViewModelIdle, fedosViewModelLoading, fedosViewModelLoaded, fedosViewModelError, fedosViewModelFromShellResult, type FedosDesktopViewModelState } from "../fedos_desktop_view_model_state.js";
import { FedosIdentityTransitionNavigationState, type FedosIdentityTransitionScreen } from "./fedos_identity_transition_navigation_state.js";
import {
  fedosIdentityTransitionBuildDetailContent,
  fedosIdentityTransitionBuildInboxItem,
  fedosIdentityTransitionBuildRatchetResetConfirmationContent,
  fedosIdentityTransitionSortInboxItems,
  fedosIdentityTransitionTruncateInboxItems,
  type FedosIdentityTransitionDetailContent,
  type FedosIdentityTransitionInboxItem,
  type FedosIdentityTransitionRatchetResetConfirmationContent,
} from "./fedos_identity_transition_screen_model.js";
import type { FedosIdentityTransitionManualVerificationMethod, FedosIdentityTransitionManualVerificationNoteCode } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import type { FedosIdentityTransitionSessionPairToAssess, FedosIdentityTransitionSessionImpactRowV1 } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_impact_view.js";
import type { FedosIdentityTransitionAcceptanceState } from "../../../conversation/identity_transition/fedos_identity_transition_acceptance_state.js";
import type { FedosIdentityTransitionAffectedSession } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_authorization.js";

interface FedosIdentityTransitionSelector {
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly peerDeviceRef: string;
  readonly transitionId: string;
}

export class FedosIdentityTransitionController {
  readonly navigation = new FedosIdentityTransitionNavigationState();
  readonly #shell: FedosDesktopApplicationShell;

  #inboxState: FedosDesktopViewModelState<readonly FedosIdentityTransitionInboxItem[]> = fedosViewModelIdle();
  #detailState: FedosDesktopViewModelState<FedosIdentityTransitionDetailContent> = fedosViewModelIdle();
  #manualVerificationState: FedosDesktopViewModelState<"recorded" | "already-present"> = fedosViewModelIdle();
  #continuityState: FedosDesktopViewModelState<number> = fedosViewModelIdle();
  #ratchetImpactState: FedosDesktopViewModelState<readonly FedosIdentityTransitionSessionImpactRowV1[]> = fedosViewModelIdle();
  #ratchetResetConfirmationState: FedosDesktopViewModelState<FedosIdentityTransitionRatchetResetConfirmationContent> = fedosViewModelIdle();
  #selector: FedosIdentityTransitionSelector | null = null;
  #actionInFlight = false;

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  // ---------------------------------------------------------------------
  // Phase J — bounded, deterministic Inbox.
  // ---------------------------------------------------------------------

  get inboxState(): FedosDesktopViewModelState<readonly FedosIdentityTransitionInboxItem[]> {
    return this.#inboxState;
  }

  async refreshInbox(limit: number, offset: number): Promise<void> {
    this.#inboxState = fedosViewModelLoading();
    const result = this.#shell.identityTransitionList(limit, offset);
    if (result.outcome !== "ok") {
      this.#inboxState = fedosViewModelError(result.outcome, result.reason);
      return;
    }
    const items = result.value.map((view) => fedosIdentityTransitionBuildInboxItem(view));
    this.#inboxState = fedosViewModelLoaded(fedosIdentityTransitionTruncateInboxItems(fedosIdentityTransitionSortInboxItems(items), limit));
  }

  // ---------------------------------------------------------------------
  // Phase B/C/E — Detail (also serves Evidence Review / Peer Device
  // Evidence, see this file's own header).
  // ---------------------------------------------------------------------

  get detailState(): FedosDesktopViewModelState<FedosIdentityTransitionDetailContent> {
    return this.#detailState;
  }

  /** A pure read — never accepts/rejects/resets anything (Phase C's own "opening a screen must never accept or reset anything"). */
  async openTransition(peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): Promise<void> {
    this.#selector = { peerAccountRef, peerDeviceRef, transitionId };
    this.navigation.selectTransition(transitionId, "detail");
    await this.#refreshDetail();
  }

  async #refreshDetail(): Promise<void> {
    if (this.#selector === null) return;
    this.#detailState = fedosViewModelLoading();
    const result = this.#shell.identityTransitionOpen(this.#selector.peerAccountRef, this.#selector.peerDeviceRef, this.#selector.transitionId);
    if (result.outcome !== "ok") {
      this.#detailState = fedosViewModelError(result.outcome, result.reason);
      return;
    }
    if (result.value === null) {
      this.#detailState = fedosViewModelError("not-found", "transition no longer on file");
      return;
    }
    this.#detailState = fedosViewModelLoaded(fedosIdentityTransitionBuildDetailContent(result.value));
  }

  // ---------------------------------------------------------------------
  // Phase D — Manual Verification.
  // ---------------------------------------------------------------------

  get manualVerificationState(): FedosDesktopViewModelState<"recorded" | "already-present"> {
    return this.#manualVerificationState;
  }

  async recordManualVerification(
    method: FedosIdentityTransitionManualVerificationMethod,
    verifiedAt: number,
    noteCode: FedosIdentityTransitionManualVerificationNoteCode,
  ): Promise<void> {
    if (this.#selector === null) {
      this.#manualVerificationState = fedosViewModelError("not-found", "no transition selected");
      return;
    }
    this.#manualVerificationState = fedosViewModelLoading();
    this.#manualVerificationState = fedosViewModelFromShellResult(
      this.#shell.identityTransitionRecordManualVerification({ transitionId: this.#selector.transitionId, method, verifiedAt, noteCode }),
    );
    await this.#refreshDetail();
  }

  // ---------------------------------------------------------------------
  // Phase C — explicit accept/reject/defer. Re-entrancy guarded exactly
  // like `FedosDeletionRequestController`'s own `#actionInFlight`.
  // ---------------------------------------------------------------------

  async acceptSelected(): Promise<void> {
    await this.#decide("accept");
  }

  async rejectSelected(): Promise<void> {
    await this.#decide("reject");
  }

  async deferSelected(): Promise<void> {
    await this.#decide("defer");
  }

  async #decide(decision: "accept" | "reject" | "defer"): Promise<void> {
    if (this.#actionInFlight || this.#selector === null) return;
    this.#actionInFlight = true;
    try {
      const { peerAccountRef, peerDeviceRef, transitionId } = this.#selector;
      if (decision === "accept") await this.#shell.identityTransitionAccept(peerAccountRef, peerDeviceRef, transitionId);
      else if (decision === "reject") await this.#shell.identityTransitionReject(peerAccountRef, peerDeviceRef, transitionId);
      else await this.#shell.identityTransitionDefer(peerAccountRef, peerDeviceRef, transitionId);
      await this.#refreshDetail();
    } finally {
      this.#actionInFlight = false;
    }
  }

  // ---------------------------------------------------------------------
  // Phase F/G — Conversation Continuity.
  // ---------------------------------------------------------------------

  get continuityState(): FedosDesktopViewModelState<number> {
    return this.#continuityState;
  }

  async recordContinuity(conversationId: string, acceptedAt: number, newSessionRequired: boolean): Promise<void> {
    if (this.#selector === null) {
      this.#continuityState = fedosViewModelError("not-found", "no transition selected");
      return;
    }
    this.#continuityState = fedosViewModelLoading();
    this.#continuityState = fedosViewModelFromShellResult(
      this.#shell.identityTransitionRecordContinuity({ conversationId, transitionId: this.#selector.transitionId, acceptedAt, newSessionRequired }),
    );
  }

  // ---------------------------------------------------------------------
  // Phase H/I — Ratchet Reset Confirmation (two explicit steps, never one).
  // ---------------------------------------------------------------------

  get ratchetImpactState(): FedosDesktopViewModelState<readonly FedosIdentityTransitionSessionImpactRowV1[]> {
    return this.#ratchetImpactState;
  }

  get ratchetResetConfirmationState(): FedosDesktopViewModelState<FedosIdentityTransitionRatchetResetConfirmationContent> {
    return this.#ratchetResetConfirmationState;
  }

  /** Step 1 — read-only. Never mutates anything. */
  async assessContinuity(pairs: readonly FedosIdentityTransitionSessionPairToAssess[]): Promise<void> {
    this.#ratchetImpactState = fedosViewModelLoading();
    const result = this.#shell.identityTransitionAssessContinuity(pairs);
    this.#ratchetImpactState = fedosViewModelFromShellResult(result);
    if (result.outcome === "ok" && this.#selector !== null) {
      const statusResult = this.#shell.identityTransitionStatus(this.#selector.peerAccountRef, this.#selector.peerDeviceRef, this.#selector.transitionId);
      const acceptanceState: FedosIdentityTransitionAcceptanceState = statusResult.outcome === "ok" && statusResult.value !== null ? statusResult.value.acceptanceState : "rejected";
      this.#ratchetResetConfirmationState = fedosViewModelLoaded(
        fedosIdentityTransitionBuildRatchetResetConfirmationContent(this.#selector.transitionId, acceptanceState, result.value),
      );
    }
  }

  /** Step 2 — the ONE action that mutates Ratchet state, and only for an ALREADY-`"accepted"` transition (enforced by the Shell/Runtime, never re-checked here). */
  async authorizeRatchetReset(acceptanceState: FedosIdentityTransitionAcceptanceState, affectedSessions: readonly FedosIdentityTransitionAffectedSession[]): Promise<void> {
    if (this.#actionInFlight || this.#selector === null) return;
    this.#actionInFlight = true;
    try {
      await this.#shell.identityTransitionAuthorizeRatchetReset({ transitionId: this.#selector.transitionId, acceptanceState, affectedSessions });
    } finally {
      this.#actionInFlight = false;
    }
  }

  // ---------------------------------------------------------------------
  // Navigation passthroughs.
  // ---------------------------------------------------------------------

  goto(screen: FedosIdentityTransitionScreen): boolean {
    return this.navigation.goto(screen);
  }

  goBack(): boolean {
    return this.navigation.goBack();
  }
}
