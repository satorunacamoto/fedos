/**
 * Secure Runtime Alpha 4661-4740 — Phase J: the closed onboarding command
 * vocabulary + validation + a dispatcher over the coordinator.
 *
 * Mirrors this repository's own Host/Shell command discipline
 * (`src/desktop/host_boundary/fedos_desktop_host_command.ts`): a closed
 * union, a total `validate*` guard for every NON-SECRET field, and a single
 * `dispatch` switch. There is NO generic secret command.
 *
 * SECRET HANDLING (Phase J): the unlock secret is carried ONLY as a
 * `FedosProfileUnlockSecret` (`./fedos_profile_unlock_secret.ts`) on the
 * dedicated `profile-create`/`profile-unlock`/`profile-open` payloads. That
 * type redacts itself from `toString`/`toJSON`, so a command logged or
 * echoed never reveals the secret. NO command RESPONSE ever contains the
 * secret — responses are the coordinator's own secret-free view models.
 *
 * The commands themselves (minus the secret payload) are safe to validate,
 * log, and forward. The secret payload is validated only for coarse
 * presence/length (`validateFedosUnlockSecretBytes`), never inspected.
 */

import type { FedosProfileUnlockSecret } from "./fedos_profile_unlock_secret.js";
import {
  FEDOS_UNLOCK_SECRET_REDACTION,
} from "./fedos_profile_unlock_secret.js";
import type {
  FedosProfileInitializationCoordinator,
  FedosProfileCoordinatorResult,
  FedosProfileReadyView,
  FedosProfileStatusView,
} from "./fedos_profile_initialization_coordinator.js";
import type { FedosProfileRecoveryNotice } from "./fedos_profile_recovery_notice.js";
import type { FedosProfileLifecycleState } from "./fedos_profile_lifecycle_state.js";

/** The closed onboarding command kinds. */
export type FedosOnboardingCommandKind =
  | "profile-status"
  | "profile-create"
  | "profile-unlock"
  | "profile-lock"
  | "profile-recovery-status"
  | "profile-initialization-status"
  | "profile-open"
  | "profile-stop";

/** Non-secret status/query commands. */
export interface FedosOnboardingStatusCommand {
  readonly kind: "profile-status" | "profile-recovery-status" | "profile-initialization-status";
}
export interface FedosOnboardingLockCommand {
  readonly kind: "profile-lock" | "profile-stop";
}
/** Create — non-secret `displayLabel` + the trusted secret payload. */
export interface FedosOnboardingCreateCommand {
  readonly kind: "profile-create";
  readonly displayLabel: string;
  readonly secret: FedosProfileUnlockSecret;
}
/** Unlock/open — the trusted secret payload only. */
export interface FedosOnboardingUnlockCommand {
  readonly kind: "profile-unlock" | "profile-open";
  readonly secret: FedosProfileUnlockSecret;
}

export type FedosOnboardingCommand =
  | FedosOnboardingStatusCommand
  | FedosOnboardingLockCommand
  | FedosOnboardingCreateCommand
  | FedosOnboardingUnlockCommand;

export const FEDOS_ONBOARDING_COMMAND_KINDS: readonly FedosOnboardingCommandKind[] = Object.freeze([
  "profile-status",
  "profile-create",
  "profile-unlock",
  "profile-lock",
  "profile-recovery-status",
  "profile-initialization-status",
  "profile-open",
  "profile-stop",
]);

function isSecretPayload(value: unknown): value is FedosProfileUnlockSecret {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { consume?: unknown }).consume === "function" &&
    typeof (value as { available?: unknown }).available === "boolean"
  );
}

/** Total validator for the NON-SECRET structure of a command. Confirms the kind + non-secret field shapes; only checks the secret payload's presence, never its bytes. Never throws. */
export function validateFedosOnboardingCommand(value: unknown): FedosOnboardingCommand | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  switch (kind) {
    case "profile-status":
    case "profile-recovery-status":
    case "profile-initialization-status":
      return Object.keys(record).length === 1 ? ({ kind } as FedosOnboardingStatusCommand) : null;
    case "profile-lock":
    case "profile-stop":
      return Object.keys(record).length === 1 ? ({ kind } as FedosOnboardingLockCommand) : null;
    case "profile-create": {
      if (typeof record.displayLabel !== "string") return null;
      const label = record.displayLabel.trim();
      if (label.length === 0 || label.length > 128) return null;
      if (!isSecretPayload(record.secret)) return null;
      return { kind, displayLabel: record.displayLabel, secret: record.secret } as FedosOnboardingCreateCommand;
    }
    case "profile-unlock":
    case "profile-open": {
      if (!isSecretPayload(record.secret)) return null;
      return { kind, secret: record.secret } as FedosOnboardingUnlockCommand;
    }
    default:
      return null;
  }
}

/** A safe, secret-free string for logging a command — the secret is ALWAYS redacted. */
export function redactFedosOnboardingCommand(command: FedosOnboardingCommand): string {
  switch (command.kind) {
    case "profile-create":
      return `profile-create{displayLabel:${JSON.stringify(command.displayLabel)},secret:${FEDOS_UNLOCK_SECRET_REDACTION}}`;
    case "profile-unlock":
    case "profile-open":
      return `${command.kind}{secret:${FEDOS_UNLOCK_SECRET_REDACTION}}`;
    default:
      return command.kind;
  }
}

/** The closed, secret-free response vocabulary. No response ever carries the secret. */
export type FedosOnboardingResponse =
  | { readonly kind: "status"; readonly status: FedosProfileStatusView }
  | { readonly kind: "ready"; readonly ready: FedosProfileReadyView }
  | { readonly kind: "recovery"; readonly recovery: FedosProfileRecoveryNotice }
  | { readonly kind: "locked"; readonly lifecycleState: FedosProfileLifecycleState }
  | { readonly kind: "error"; readonly outcome: string; readonly reason: string };

function toReadyResponse(result: FedosProfileCoordinatorResult<FedosProfileReadyView>): FedosOnboardingResponse {
  if (result.outcome === "ok") return { kind: "ready", ready: result.value };
  return { kind: "error", outcome: result.outcome, reason: result.reason };
}

/**
 * Dispatches one validated command against the coordinator. Never echoes a
 * secret. `invalid-input` for a structurally-invalid command (guard failed
 * upstream). The secret payload is consumed by the coordinator; this
 * dispatcher never reads its bytes.
 */
export async function dispatchFedosOnboardingCommand(
  coordinator: FedosProfileInitializationCoordinator,
  raw: unknown,
): Promise<FedosOnboardingResponse> {
  const command = validateFedosOnboardingCommand(raw);
  if (command === null) {
    return { kind: "error", outcome: "invalid-input", reason: "malformed onboarding command" };
  }
  switch (command.kind) {
    case "profile-status": {
      const detect = coordinator.detectProfileState();
      if (detect.outcome !== "ok") return { kind: "error", outcome: detect.outcome, reason: detect.reason };
      return { kind: "status", status: detect.value };
    }
    case "profile-initialization-status":
      return { kind: "status", status: coordinator.status() };
    case "profile-recovery-status":
      return { kind: "recovery", recovery: coordinator.recoveryNotice() };
    case "profile-create":
      return toReadyResponse(await coordinator.createProfile({ displayLabel: command.displayLabel }, command.secret));
    case "profile-unlock":
    case "profile-open":
      return toReadyResponse(await coordinator.unlockProfile(command.secret));
    case "profile-lock":
    case "profile-stop": {
      const result = await coordinator.lock();
      if (result.outcome !== "ok") return { kind: "error", outcome: result.outcome, reason: result.reason };
      return { kind: "locked", lifecycleState: result.value.lifecycleState };
    }
    default:
      return { kind: "error", outcome: "invalid-input", reason: "unsupported onboarding command" };
  }
}
