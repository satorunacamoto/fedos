/**
 * Secure Runtime Alpha 4661-4740 — Phase K: the framework-neutral
 * onboarding presentation boundary.
 *
 * Pure functions from a coordinator status/result to a closed set of safe
 * view models (mirrors `src/desktop/presentation/*`'s own ViewModel
 * discipline: no framework, no DOM, only safe fields + explicit action
 * descriptors). Renders ONLY non-secret fields. Never carries a secret
 * input after submission, sealed bytes, a handle, a stack trace, or a
 * private key. No hidden auto-submit — every action is an explicit,
 * named descriptor a UI must invoke deliberately.
 */

import type {
  FedosProfileCoordinatorOutcome,
  FedosProfileReadyView,
  FedosProfileStatusView,
} from "./fedos_profile_initialization_coordinator.js";
import type { FedosProfileRecoveryNotice } from "./fedos_profile_recovery_notice.js";

/** The closed set of onboarding screens (Phase K's required states). */
export type FedosOnboardingScreen =
  | "welcome"
  | "create-or-open"
  | "create-profile-form"
  | "unlock-form"
  | "initializing"
  | "recovery-warning"
  | "profile-ready"
  | "unlock-failed"
  | "recovery-required"
  | "runtime-startup-failed"
  | "stopped";

/** A named, explicit action a UI may present. No auto-submit — the UI invokes it deliberately. */
export type FedosOnboardingAction =
  | "create-profile"
  | "unlock-profile"
  | "retry-unlock"
  | "acknowledge-recovery-warning"
  | "open-recovery"
  | "lock"
  | "relaunch";

export interface FedosOnboardingActionDescriptor {
  readonly action: FedosOnboardingAction;
  readonly label: string;
  /** Whether this action requires the secret-input field (create/unlock forms only). */
  readonly requiresSecretInput: boolean;
}

export interface FedosOnboardingViewModel {
  readonly screen: FedosOnboardingScreen;
  /** Fixed, non-secret headline for the screen. */
  readonly headline: string;
  /** Short, non-secret guidance line. Never a raw error/stack. */
  readonly message: string;
  /** The explicit actions available on this screen. */
  readonly actions: readonly FedosOnboardingActionDescriptor[];
  /** Present only on `profile-ready`. */
  readonly ready: FedosProfileReadyView | null;
  /** Present only on `recovery-warning`/`profile-ready`. */
  readonly recoveryNotice: FedosProfileRecoveryNotice | null;
}

function descriptor(
  action: FedosOnboardingAction,
  label: string,
  requiresSecretInput = false,
): FedosOnboardingActionDescriptor {
  return Object.freeze({ action, label, requiresSecretInput });
}

/** The initial view for a launch, derived from coordinator presence — never auto-advances past a required decision. */
export function fedosOnboardingViewForStatus(status: FedosProfileStatusView): FedosOnboardingViewModel {
  switch (status.presence) {
    case "absent":
      return Object.freeze({
        screen: "welcome",
        headline: "Welcome",
        message: "No local profile was found on this device. Create one to get started.",
        actions: Object.freeze([descriptor("create-profile", "Create a new profile", true)]),
        ready: null,
        recoveryNotice: null,
      });
    case "locked":
      return Object.freeze({
        screen: "unlock-form",
        headline: "Unlock your profile",
        message: "Enter your unlock secret to open this profile.",
        actions: Object.freeze([descriptor("unlock-profile", "Unlock", true)]),
        ready: null,
        recoveryNotice: null,
      });
    case "in-progress":
      return Object.freeze({
        screen: "initializing",
        headline: "Setting up…",
        message: "Initialization is in progress.",
        actions: Object.freeze([]),
        ready: null,
        recoveryNotice: null,
      });
    case "recovery-required":
      return Object.freeze({
        screen: "recovery-required",
        headline: "Recovery required",
        message:
          "This profile could not be opened safely (it may be corrupt or interrupted). It will NOT be overwritten. Restore your backup or start recovery.",
        actions: Object.freeze([descriptor("open-recovery", "Recovery options")]),
        ready: null,
        recoveryNotice: null,
      });
    default:
      return Object.freeze({
        screen: "create-or-open",
        headline: "Get started",
        message: "Create a new profile or open an existing one.",
        actions: Object.freeze([
          descriptor("create-profile", "Create", true),
          descriptor("unlock-profile", "Open", true),
        ]),
        ready: null,
        recoveryNotice: null,
      });
  }
}

/** The recovery-warning screen shown DURING create, before completion — an explicit acknowledge action, no auto-submit. */
export function fedosOnboardingRecoveryWarningView(notice: FedosProfileRecoveryNotice): FedosOnboardingViewModel {
  return Object.freeze({
    screen: "recovery-warning",
    headline: notice.headline,
    message:
      "Back up the files listed below now. If you lose your unlock secret, this profile cannot be recovered.",
    actions: Object.freeze([descriptor("acknowledge-recovery-warning", "I have backed up my recovery material")]),
    ready: null,
    recoveryNotice: notice,
  });
}

/** The success view. */
export function fedosOnboardingReadyView(ready: FedosProfileReadyView): FedosOnboardingViewModel {
  return Object.freeze({
    screen: "profile-ready",
    headline: `Profile ready — ${ready.displayLabel}`,
    message: "Your profile is unlocked and the runtime is running.",
    actions: Object.freeze([descriptor("lock", "Lock"), descriptor("open-recovery", "Recovery material")]),
    ready,
    recoveryNotice: ready.recoveryNotice,
  });
}

/** Maps a non-ok coordinator outcome to the honest failure/blocked screen. */
export function fedosOnboardingViewForFailure(
  outcome: Exclude<FedosProfileCoordinatorOutcome, "ok">,
  reason: string,
): FedosOnboardingViewModel {
  switch (outcome) {
    case "unlock-failed":
      return Object.freeze({
        screen: "unlock-failed",
        headline: "Unlock failed",
        message: "The unlock secret was not accepted. Try again.",
        actions: Object.freeze([descriptor("retry-unlock", "Try again", true)]),
        ready: null,
        recoveryNotice: null,
      });
    case "identity-mismatch":
    case "corrupt":
    case "recovery-required":
      return Object.freeze({
        screen: "recovery-required",
        headline: "Recovery required",
        message: "This profile could not be opened safely and will not be overwritten. Restore your backup.",
        actions: Object.freeze([descriptor("open-recovery", "Recovery options")]),
        ready: null,
        recoveryNotice: null,
      });
    case "runtime-start-failed":
      return Object.freeze({
        screen: "runtime-startup-failed",
        headline: "Could not start",
        message: "The runtime failed to start. No partial session is running. You can retry.",
        actions: Object.freeze([descriptor("retry-unlock", "Retry", true)]),
        ready: null,
        recoveryNotice: null,
      });
    case "seed-unavailable":
      return Object.freeze({
        screen: "runtime-startup-failed",
        headline: "Secure crypto unavailable",
        message:
          "The Master Seed authority is unavailable in this build (the crypto engine is not present). Profile unlock cannot proceed.",
        actions: Object.freeze([]),
        ready: null,
        recoveryNotice: null,
      });
    case "already-exists":
      return Object.freeze({
        screen: "unlock-form",
        headline: "Profile already exists",
        message: "A profile already exists here. Unlock it instead of creating a new one.",
        actions: Object.freeze([descriptor("unlock-profile", "Unlock", true)]),
        ready: null,
        recoveryNotice: null,
      });
    default:
      return Object.freeze({
        screen: "runtime-startup-failed",
        headline: "Something went wrong",
        message: `Onboarding could not complete (${outcome}).`,
        actions: Object.freeze([]),
        ready: null,
        recoveryNotice: null,
      });
  }
}

/** The stopped/locked view after `lock`. */
export function fedosOnboardingStoppedView(): FedosOnboardingViewModel {
  return Object.freeze({
    screen: "stopped",
    headline: "Locked",
    message: "Your profile is locked. Durable data is intact. Unlock to continue.",
    actions: Object.freeze([descriptor("unlock-profile", "Unlock", true)]),
    ready: null,
    recoveryNotice: null,
  });
}
