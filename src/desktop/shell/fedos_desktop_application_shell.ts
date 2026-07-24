/**
 * Secure Runtime Alpha 2841–2920 ("Desktop Local Application Shell and
 * Conversation Management Boundary Arc") — the named top-level deliverable.
 *
 * `FedosDesktopApplicationShell` is a narrow application-layer boundary
 * owned by exactly one `FedosRunningDesktopRuntime`
 * (`../runtime/fedos_desktop_runtime.ts`, unmodified). It exists so a
 * future desktop UI calls one small, closed, view-model-returning surface
 * instead of the Runtime handle directly — never exposing a persistence
 * port, a raw Authority, a crypto handle, a raw key, or plaintext outside
 * an authorized view model (this Arc's own Absolute Prohibitions).
 *
 * Every method fails closed: before `start()` and after `stop()`, every
 * operation returns `{ outcome: "unavailable" }` — never throws, never
 * returns stale data. `start()`/`stop()` are the only two methods that can
 * themselves fail with a structural `"conflict"`/`"unavailable"` (calling
 * `start()` twice, or `stop()`/any other method before a first `start()`).
 *
 * `listMessages`/`readMessage`/`sendMessage`/`reply`/`search`/`archive` are
 * now REAL, wired through `FedosDesktopConversationContentAccessor`
 * (`../content_accessor/fedos_desktop_conversation_content_accessor.ts`,
 * Alpha 3081-3160) — the narrow Runtime-owned boundary that closes the
 * exact gap Alpha 2841-2920 documented and stopped at (see that Arc's own
 * execution spec, Phase A/A4/A5/A6). `deviceStatus()` remains honestly
 * `"unavailable"` — `src/sync/*` (Device Sync Foundation) is still wired
 * into nothing on this base, an INDEPENDENT gap this Arc's own scope does
 * not touch (Absolute Prohibitions: "do not implement Device Sync").
 *
 * HARD GUARDRAILS:
 *   - Owns exactly one `FedosRunningDesktopRuntime` per shell instance; two
 *     shell instances started against two different configs are fully
 *     independent (mirrors the Runtime's own "no shared singleton"
 *     guarantee).
 *   - Never exposes `this.#runtime` itself, `host`, `boardRuntime()`,
 *     `conversationRuntime()`, `privateTransport()`, or
 *     `conversationContentAccessor()` itself to a caller.
 *   - No `Error` object, stack trace, or raw backend string crosses this
 *     boundary — every failure is `FedosDesktopShellFailure`.
 *   - No new dependency, no Rust/WASM/Cargo touch, no network transport,
 *     no HTTP/Worker route, no UI framework.
 */

import { startFedosDesktopRuntime, type FedosRunningDesktopRuntime } from "../runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../runtime/fedos_desktop_runtime_config.js";
import type {
  CreateDirectDraftCommand,
  CreatePrivateGroupDraftCommand,
} from "../../conversation/construction/fedos_private_conversation_construction_command.js";
import type { FedosPrivateConversationConstructionResult } from "../../conversation/construction/fedos_private_conversation_construction_result.js";
import type { FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../../conversation/fedos_conversation_id.js";
import {
  fedosDesktopShellOk,
  fedosDesktopShellFailure,
  type FedosDesktopShellFailure,
  type FedosDesktopShellOutcomeKind,
  type FedosDesktopShellResult,
} from "./fedos_desktop_shell_result.js";
import type {
  FedosConversationDetailView,
  FedosConversationListFilter,
  FedosConversationSummaryView,
  FedosDeviceStatusView,
  FedosIssuedInvitationView,
  FedosMessageView,
  FedosMessageSendResultView,
} from "./fedos_desktop_shell_view_models.js";
import type {
  FedosContentAccessorArchiveCommand,
  FedosContentAccessorArchiveValue,
  FedosContentAccessorFailure,
  FedosContentAccessorMessageView,
  FedosContentAccessorResult,
  FedosContentAccessorSearchHit,
  FedosContentAccessorSendResult,
} from "../content_accessor/fedos_desktop_conversation_content_accessor_result.js";
import type {
  FedosDeviceSyncConflictView,
  FedosDeviceSyncDeviceView,
  FedosDeviceSyncOperationalOutcomeKind,
  FedosDeviceSyncOperationalResult,
  FedosDeviceSyncScheduleView,
  FedosDeviceSyncSchedulerStatusView,
  FedosDeviceSyncTransferSessionView,
} from "../runtime/fedos_device_sync_operational_facade.js";
import type { FedosDeviceSyncTickEntry } from "../../device/sync_scheduler/fedos_device_sync_scheduler.js";
// Secure Runtime Alpha 6041-6120 -- Deletion Request Shell surface.
import type { FedosDeletionRequestRuntime } from "../../conversation/deletion_request/fedos_deletion_request_runtime.js";
import type { FedosDeletionRequestCreateParams } from "../../conversation/deletion_request/fedos_deletion_request_outbound_coordinator.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../../conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import type { FedosDeletionRequestAcknowledgementOutcome } from "../../conversation/deletion_request/fedos_deletion_request_acknowledgement_outcome.js";
import type { FedosDeletionRequestInboxSummaryV1 } from "../../conversation/deletion_request/fedos_deletion_request_inbox_summary.js";
import type { FedosDeletionRecipientDecisionState } from "../../conversation/deletion_request/fedos_deletion_recipient_decision_state.js";
import type { FedosDeletionRequestInboundOutcome } from "../../conversation/deletion_request/fedos_deletion_request_inbound_coordinator.js";
import type { FedosDeletionRecipientPolicy, FedosDeletionRecipientPolicyDecision } from "../../conversation/deletion_request/fedos_deletion_recipient_policy.js";
import type { FedosDeletionRequestScope } from "../../conversation/deletion_request/fedos_deletion_request_scope.js";
// Secure Runtime Alpha 6121-6200 -- Identity Transition Shell surface.
import type { FedosIdentityTransitionPeerRuntime, FedosIdentityTransitionPeerStatusView } from "../../conversation/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.js";
import type { FedosIdentityTransitionSafeViewV1 } from "../../conversation/identity_transition/peer_integration/fedos_identity_transition_safe_view.js";
import type { FedosIdentityTransitionManualVerificationMethod, FedosIdentityTransitionManualVerificationNoteCode } from "../../conversation/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import type { FedosIdentityTransitionAcceptanceState } from "../../conversation/identity_transition/fedos_identity_transition_acceptance_state.js";
import type { FedosIdentityTransitionAffectedSession } from "../../conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_authorization.js";
import {
  fedosIdentityTransitionBuildSessionImpactRow,
  type FedosIdentityTransitionSessionImpactRowV1,
  type FedosIdentityTransitionSessionPairToAssess,
} from "../../conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_impact_view.js";
import type { FedosIdentityTransitionConversationContinuityRecordV1 } from "../../conversation/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";
import type { FedosDeviceSyncConflictResolutionAction } from "../../device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js";
// Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and Safety Center Arc) -- narrow additive accessors the Safety Center needs, none of which existed on this Shell before.
import type { FedosConversationProductionCryptoCapabilityOutcome } from "../../conversation/encryption/production/fedos_conversation_production_crypto_capability_result.js";
import type { FedosDirectRatchetSafeStatus } from "../../conversation/ratchet/fedos_direct_ratchet_conversation_runtime.js";
// Secure Runtime Alpha 7001-7080 -- narrow, additive, real wrappers only; no new activation/establishment logic.
import type { FedosConversationDirectActivationResult } from "../../conversation/activation/fedos_conversation_direct_activation_result.js";
import type { FedosDirectRatchetEstablishOptions, FedosDirectRatchetEstablishOutcome } from "../../conversation/ratchet/fedos_direct_ratchet_outbound_integration.js";
import type { FedosConversationInvitationOutboundOutcome } from "../../conversation/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.js";
import type { FedosRatchetPeerCapabilitySafeStatus } from "../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_safe_status.js";
import type { FedosRatchetPeerCapabilityPeerDeviceStatus } from "../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.js";
// Secure Runtime Alpha 4581-4660 (Desktop Device Registration, Pairing, and
// Durable Sync Journal Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring the Alpha 3801-3880 boundary above.
import type {
  FedosDevicePairingApprovalOutcomeView,
  FedosDevicePairingBindingView,
  FedosDevicePairingOutcomeKind,
  FedosDevicePairingRequestInspectionView,
  FedosDevicePairingRequestSummary,
  FedosDevicePairingResult,
} from "../runtime/fedos_device_pairing_facade.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import { generateFedosDeviceSigningKeypair, type FedosDeviceSigningKeypair } from "../../device/crypto/fedos_device_signing_keypair.js";

/** A bare `FedosDesktopShellFailure` object — unlike `fedosDesktopShellFailure()`, whose return type is the full `FedosDesktopShellResult<T>` union, for the internal call sites below that need exactly this narrower shape (e.g. `#validateSendPreconditions`'s own `FedosDesktopShellFailure | null` return). */
function shellFailure(outcome: FedosDesktopShellOutcomeKind, reason: string): FedosDesktopShellFailure {
  return Object.freeze({ outcome, reason });
}

/** `FedosContentAccessorFailure`'s outcome vocabulary is defined IDENTICALLY to `FedosDesktopShellOutcomeKind` (see both files' own headers) — a straight relabel, never a re-derivation. */
function mapContentAccessorFailure(failure: FedosContentAccessorFailure): FedosDesktopShellFailure {
  return shellFailure(failure.outcome as unknown as FedosDesktopShellOutcomeKind, failure.reason);
}

/**
 * Secure Runtime Alpha 3801-3880 — maps `FedosDeviceSyncOperationalResult<T>`'s
 * own closed outcome vocabulary onto the Shell's existing `FedosDesktopShellOutcomeKind`
 * (`./fedos_desktop_shell_result.ts`, unmodified) — never widens that shared
 * union. `"disabled"` (the facade's own "this optional capability was never
 * configured" outcome) maps to the Shell's existing `"unsupported"`; every
 * other facade outcome name already exists verbatim in the Shell's own
 * vocabulary.
 */
const DEVICE_SYNC_OUTCOME_TO_SHELL_OUTCOME: Readonly<Record<Exclude<FedosDeviceSyncOperationalOutcomeKind, "ok">, FedosDesktopShellOutcomeKind>> = Object.freeze({
  disabled: "unsupported",
  unavailable: "unavailable",
  "not-found": "not-found",
  "invalid-input": "invalid-input",
  conflict: "conflict",
  failed: "failed",
});

function mapDeviceSyncFacadeResult<T>(result: FedosDeviceSyncOperationalResult<T>): FedosDesktopShellResult<T> {
  if (result.outcome === "ok") return fedosDesktopShellOk(result.value);
  return fedosDesktopShellFailure(DEVICE_SYNC_OUTCOME_TO_SHELL_OUTCOME[result.outcome], result.reason);
}

/** Secure Runtime Alpha 6041-6120 -- maps `FedosDeletionRequestOutboundOutcome`'s own closed non-"published" outcomes onto this Shell's existing vocabulary; never invents a new one. */
function mapDeletionRequestOutboundOutcomeKind(outcome: string): FedosDesktopShellOutcomeKind {
  switch (outcome) {
    case "recipient-device-unknown":
    case "recipient-device-revoked":
    case "local-device-revoked":
    case "not-author":
      return "unauthorized";
    case "signing-unavailable":
    case "route-unavailable":
    case "runtime-stopped":
      return "unavailable";
    case "invalid-input":
      return "invalid-input";
    case "persistence-failed":
      return "failed";
    default:
      return "failed";
  }
}

/**
 * Secure Runtime Alpha 4581-4660 -- maps `FedosDevicePairingResult<T>`'s own
 * closed, pairing-specific outcome vocabulary onto the Shell's EXISTING
 * `FedosDesktopShellOutcomeKind` (unmodified, per this Arc's own "do not
 * widen a shared, previously-accepted vocabulary" discipline) -- several
 * pairing outcomes collapse onto the SAME existing Shell bucket; the
 * fine-grained distinction (`"expired"`/`"replayed"`/`"revoked"`/
 * `"wrong-account"`) is NEVER lost, only carried forward verbatim inside
 * `result.reason`'s own already-descriptive text, exactly like every other
 * mapping function in this file already does for its own source union.
 */
const DEVICE_PAIRING_OUTCOME_TO_SHELL_OUTCOME: Readonly<Record<Exclude<FedosDevicePairingOutcomeKind, "ok">, FedosDesktopShellOutcomeKind>> = Object.freeze({
  disabled: "unsupported",
  unavailable: "unavailable",
  "not-found": "not-found",
  "invalid-input": "invalid-input",
  malformed: "invalid-input",
  expired: "invalid-input",
  replayed: "conflict",
  revoked: "conflict",
  "wrong-account": "unauthorized",
  conflict: "conflict",
  failed: "failed",
});

function mapDevicePairingFacadeResult<T>(result: FedosDevicePairingResult<T>): FedosDesktopShellResult<T> {
  if (result.outcome === "ok") return fedosDesktopShellOk(result.value);
  return fedosDesktopShellFailure(DEVICE_PAIRING_OUTCOME_TO_SHELL_OUTCOME[result.outcome], result.reason);
}

function toShellMessageView(view: FedosContentAccessorMessageView): FedosMessageView {
  return Object.freeze({
    messageId: view.messageId,
    conversationId: view.conversationId as FedosConversationId,
    senderMembershipId: view.senderMembershipId,
    createdAt: view.createdAt,
    replyToMessageId: view.replyToMessageId,
    plaintext: view.plaintext,
    localDeliveryState: view.localDeliveryState,
    retentionState: view.retentionState,
  });
}

function toShellSendResultView(conversationId: string, result: FedosContentAccessorSendResult): FedosMessageSendResultView {
  return Object.freeze({
    messageId: result.messageId,
    conversationId: conversationId as FedosConversationId,
    createdAt: result.createdAt,
    localWrite: result.localWrite,
    fanout: result.fanout,
  });
}

/** Why `deviceStatus()` is always unavailable — see execution spec Phase A/A7. */
const DEVICE_SYNC_UNAVAILABLE_REASON =
  "src/sync/* (Device Sync Foundation) is not wired into any running Desktop Runtime on this base " +
  "(zero imports from src/desktop or src/conversation); see Alpha 2841-2920 execution spec Phase A/A7";

/** Why invitation redemption is always unavailable — see execution spec Phase A/A3. */
const INVITATION_REDEMPTION_UNAVAILABLE_REASON =
  "no FedosConversationCapabilityRedemptionAuthority is constructed by assembleFedosConversationRuntimeDependencies() " +
  "on this base; see Alpha 2841-2920 execution spec Phase A/A3";

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosDesktopApplicationShell {
  #runtime: FedosRunningDesktopRuntime | null = null;
  readonly #knownConversationIds = new Set<string>();
  /**
   * Secure Runtime Alpha 4581-4660 -- the ONE place a JOINING Device's own
   * ephemeral `FedosDeviceSigningKeypair` is held in-process, keyed by
   * `pairingId`. This is the boundary that makes Phase J's "never expose
   * Device private keys" true across a REAL Electron IPC hop: a renderer
   * only ever sends/receives `deviceId`/`pairingId`/encoded-record strings
   * -- the raw keypair object never crosses `dispatch()` in either
   * direction. Cleared unconditionally once `devicePairingComplete()` has
   * been attempted for a given `pairingId`, mirroring
   * `FedosDevicePairingFacade`'s own identical "consumed regardless of
   * outcome" bookkeeping discipline.
   */
  readonly #pairingKeypairsByPairingId = new Map<string, FedosDeviceSigningKeypair>();

  private constructor() {}

  /** Thin factory — mirrors `createFedosConversationRuntime()`'s own style. No side effect until `start()` is called. */
  static create(): FedosDesktopApplicationShell {
    return new FedosDesktopApplicationShell();
  }

  /**
   * Secure Runtime Alpha 5061-5160 (FedOS Desktop Beta 0.1 Integration Arc) —
   * additive Phase C factory. Wraps an ALREADY-RUNNING `FedosRunningDesktopRuntime`
   * (e.g. one `FedosProfileInitializationCoordinator` started during unlock/create,
   * `../onboarding/fedos_profile_initialization_coordinator.ts`) instead of
   * starting a second, independent one via `start()`.
   *
   * WHY THIS EXISTS: `start()` unconditionally calls `startFedosDesktopRuntime()`
   * itself, and the Coordinator's own `unlockProfile()`/`createProfile()` ALSO
   * unconditionally starts its own Runtime (it has no "skip Runtime start" mode).
   * Composing both into one real Electron process without this factory would
   * mean two independent `FedosRunningDesktopRuntime` instances constructed
   * from the same durable paths — a real "duplicate Runtime ownership" defect
   * (divergent in-memory Board/Conversation state, and, for file-backed logs,
   * two independent writers on the same append-only files), not a stylistic one.
   *
   * This is a pure, additive wrapper: it does not change `start()`/`stop()`/
   * `status()`/any existing method's behavior for any existing caller. A Shell
   * built this way behaves identically to one built via `create()` + `start()`
   * from the caller's perspective (`status()` reports `"running"` immediately;
   * `stop()` stops the SAME wrapped Runtime; a second `start()` call correctly
   * fails with `"conflict"`, exactly as it already does for a doubly-started Shell).
   */
  static fromRunningRuntime(runtime: FedosRunningDesktopRuntime): FedosDesktopApplicationShell {
    const shell = new FedosDesktopApplicationShell();
    shell.#runtime = runtime;
    return shell;
  }

  status(): "stopped" | "running" {
    return this.#runtime === null ? "stopped" : "running";
  }

  async start(config: FedosDesktopRuntimeConfig): Promise<FedosDesktopShellResult<null>> {
    if (this.#runtime !== null) {
      return fedosDesktopShellFailure("conflict", "shell is already running; call stop() first");
    }
    this.#runtime = await startFedosDesktopRuntime(config);
    return fedosDesktopShellOk(null);
  }

  async stop(): Promise<FedosDesktopShellResult<null>> {
    if (this.#runtime === null) {
      return fedosDesktopShellFailure("unavailable", "shell is not running");
    }
    const runtime = this.#runtime;
    this.#runtime = null;
    await runtime.stop();
    return fedosDesktopShellOk(null);
  }

  // ---------------------------------------------------------------------
  // Conversation creation, list, detail — real, wired to conversationRuntime().
  // ---------------------------------------------------------------------

  createDirectConversation(command: CreateDirectDraftCommand): FedosDesktopShellResult<FedosConversationDetailView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = this.#runtime.conversationRuntime().createDirectDraft(command);
    return this.#mapConstructionResult(result);
  }

  /**
   * Secure Runtime Alpha 7001-7080 — a narrow, real, additive wrapper over
   * `FedosConversationRuntime.activateDirectConversation()` (already real,
   * already used by the established Node-level real vertical slice at
   * Alpha 5561-5640) — the missing step between drafting a Direct
   * Conversation and it being usable for real messaging/Ratchet session
   * establishment (two `"active"` Memberships required). No new
   * activation logic; this method adds zero business rules of its own.
   */
  async activateDirectConversation(conversationId: string): Promise<FedosDesktopShellResult<FedosConversationDirectActivationResult>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = await this.#runtime.conversationRuntime().activateDirectConversation(conversationId);
    return fedosDesktopShellOk(result);
  }

  /**
   * Secure Runtime Alpha 7081-7160 (FedOS Conversation Invitation and
   * Shared Conversation Foundation Arc) — a narrow, real, additive
   * wrapper over `FedosConversationInvitationRuntime.createAndSendInvitation()`.
   * No new business logic; creates a brand-new Direct conversation and
   * sends the invitee a real, signed invitation through the real NIP-17
   * transport.
   */
  async createConversationInvitation(
    invitee: FedosConversationParticipantReference,
    expiresInMs?: number,
  ): Promise<FedosDesktopShellResult<FedosConversationInvitationOutboundOutcome>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const invitation = this.#runtime.conversationRuntime().conversationInvitation();
    if (invitation === null) return fedosDesktopShellFailure("unavailable", "conversation invitation Runtime is not configured");
    const outcome = await invitation.createAndSendInvitation(invitee, expiresInMs);
    return fedosDesktopShellOk(outcome);
  }

  createPrivateGroup(command: CreatePrivateGroupDraftCommand): FedosDesktopShellResult<FedosConversationDetailView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = this.#runtime.conversationRuntime().createPrivateGroupDraft(command);
    return this.#mapConstructionResult(result);
  }

  getConversation(conversationId: string): FedosDesktopShellResult<FedosConversationDetailView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const detail = this.#toDetailView(conversationId);
    if (detail === null) return fedosDesktopShellFailure("not-found", "unknown conversation");
    return fedosDesktopShellOk(detail);
  }

  listConversations(filter?: FedosConversationListFilter): FedosDesktopShellResult<readonly FedosConversationSummaryView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const summaries: FedosConversationSummaryView[] = [];
    for (const id of this.#knownConversationIds) {
      const summary = this.#toSummaryView(id);
      if (summary === null) continue;
      if (filter?.mode !== undefined && summary.mode !== filter.mode) continue;
      if (filter?.lifecycleState !== undefined && summary.lifecycleState !== filter.lifecycleState) continue;
      summaries.push(summary);
    }
    summaries.sort((a, b) => a.createdAt - b.createdAt || a.conversationId.localeCompare(b.conversationId));
    return fedosDesktopShellOk(Object.freeze(summaries));
  }

  issuedInvitations(
    conversationId: string,
    issuer: FedosConversationParticipantReference,
  ): FedosDesktopShellResult<readonly FedosIssuedInvitationView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const cr = this.#runtime.conversationRuntime();
    if (cr.findConversation(conversationId) === null) return fedosDesktopShellFailure("not-found", "unknown conversation");
    const descriptors = cr.issuedCapabilityDescriptors(conversationId, issuer);
    return fedosDesktopShellOk(Object.freeze(descriptors.map((descriptor) => Object.freeze({ descriptor }))));
  }

  /** Always `"unavailable"` on this base — see execution spec Phase A/A3. */
  redeemInvitation(): FedosDesktopShellResult<never> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    return fedosDesktopShellFailure("unavailable", INVITATION_REDEMPTION_UNAVAILABLE_REASON);
  }

  // ---------------------------------------------------------------------
  // Messages — Secure Runtime Alpha 3081-3160 — real, wired through
  // FedosDesktopConversationContentAccessor. `#validateSendPreconditions()`
  // preserves this Shell's own PRE-EXISTING sender-based authorization/
  // lifecycle pre-check (Alpha 2841-2920) verbatim in spirit — a non-member
  // still learns nothing about activation state before authorization is
  // checked — now consulting the REAL activation/usability fact instead of
  // the draft record's own permanently-"draft" `lifecycleState` (Alpha
  // 1116). Once preconditions pass, the real send is delegated to the
  // Content Accessor.
  // ---------------------------------------------------------------------

  listMessages(conversationId: string): FedosDesktopShellResult<readonly FedosMessageView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = this.#runtime.conversationContentAccessor().listMessages(conversationId);
    if (result.outcome !== "ok") return mapContentAccessorFailure(result);
    return fedosDesktopShellOk(Object.freeze(result.value.map((v) => toShellMessageView(v))));
  }

  async readMessage(conversationId: string, messageId: string): Promise<FedosDesktopShellResult<FedosMessageView>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = await this.#runtime.conversationContentAccessor().readMessage(conversationId, messageId);
    if (result.outcome !== "ok") return mapContentAccessorFailure(result);
    return fedosDesktopShellOk(toShellMessageView(result.value));
  }

  async sendMessage(
    conversationId: string,
    sender: FedosConversationParticipantReference,
    body: string,
  ): Promise<FedosDesktopShellResult<FedosMessageSendResultView>> {
    const precondition = this.#validateSendPreconditions(conversationId, sender);
    if (precondition !== null) return precondition;
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = await this.#runtime.conversationContentAccessor().sendMessage(conversationId, body, null);
    return this.#mapSendResult(conversationId, result);
  }

  async reply(
    conversationId: string,
    sender: FedosConversationParticipantReference,
    replyToMessageId: string,
    body: string,
  ): Promise<FedosDesktopShellResult<FedosMessageSendResultView>> {
    if (replyToMessageId.length === 0) return fedosDesktopShellFailure("invalid-input", "replyToMessageId must be non-empty");
    const precondition = this.#validateSendPreconditions(conversationId, sender);
    if (precondition !== null) return precondition;
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = await this.#runtime.conversationContentAccessor().replyToMessage(conversationId, replyToMessageId, body);
    return this.#mapSendResult(conversationId, result);
  }

  #mapSendResult(
    conversationId: string,
    result: FedosContentAccessorResult<FedosContentAccessorSendResult>,
  ): FedosDesktopShellResult<FedosMessageSendResultView> {
    if (result.outcome !== "ok") return mapContentAccessorFailure(result);
    return fedosDesktopShellOk(toShellSendResultView(conversationId, result.value));
  }

  /** Returns `null` when every precondition passes (caller should proceed to the real accessor call); a `FedosDesktopShellFailure` otherwise. */
  #validateSendPreconditions(conversationId: string, sender: FedosConversationParticipantReference): FedosDesktopShellFailure | null {
    if (this.#runtime === null) return shellFailure("unavailable", "shell is not running");
    const cr = this.#runtime.conversationRuntime();
    const draft = cr.findConversation(conversationId);
    if (draft === null) return shellFailure("not-found", "unknown conversation");
    // Authorization is checked BEFORE lifecycle state, deliberately: a
    // non-member must never learn anything about a conversation's
    // activation state, only that they are not authorized to act on it.
    const membership = cr.listMemberships(conversationId).find((m) => participantsEqual(m.participant, sender));
    if (membership === undefined || membership.state !== "active") {
      return shellFailure("unauthorized", "sender is not an active member of this conversation");
    }
    // Secure Runtime Alpha 3081-3160 -- the REAL activation/usability fact,
    // never `draft.lifecycleState` (permanently "draft" by construction,
    // Alpha 1116 -- see `FedosConversationRuntime.resolveActiveConversation()`'s
    // own header).
    if (draft.mode === "direct") {
      const active = cr.resolveActiveConversation(conversationId);
      if (active.outcome !== "active") {
        return shellFailure("requires-activation", "this Direct conversation has not been activated yet");
      }
    } else {
      const usability = cr.groupRuntime().readinessForPrivateGroup(conversationId);
      if (usability.outcome !== "usable") {
        return shellFailure("requires-activation", `this Group conversation is not currently usable for sending ("${usability.outcome}")`);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Search, Archive — Secure Runtime Alpha 3081-3160 — real, wired through
  // FedosDesktopConversationContentAccessor. Device status remains honestly
  // "unavailable" — see this file's own header.
  // ---------------------------------------------------------------------

  search(query: string): FedosDesktopShellResult<readonly FedosContentAccessorSearchHit[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = this.#runtime.conversationContentAccessor().searchConversations(query);
    if (result.outcome !== "ok") return mapContentAccessorFailure(result);
    return fedosDesktopShellOk(result.value);
  }

  async archive(command: FedosContentAccessorArchiveCommand): Promise<FedosDesktopShellResult<FedosContentAccessorArchiveValue>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const result = await this.#runtime.conversationContentAccessor().archive(command);
    if (result.outcome !== "ok") return mapContentAccessorFailure(result);
    return fedosDesktopShellOk(result.value);
  }

  /** Always reports `state: "unavailable"` — see execution spec Phase A/A7. */
  deviceStatus(): FedosDesktopShellResult<FedosDeviceStatusView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    return fedosDesktopShellOk(Object.freeze({ state: "unavailable" as const, reason: DEVICE_SYNC_UNAVAILABLE_REASON }));
  }

  // ---------------------------------------------------------------------
  // Secure Runtime Alpha 3801-3880 -- Device Sync Operational commands.
  // Every method below delegates ENTIRELY to `FedosRunningDesktopRuntime.deviceSyncOperational()`
  // (`../runtime/fedos_device_sync_operational_facade.ts`) -- this Shell owns
  // no Device Sync state of its own, only maps that facade's own closed
  // outcomes onto this Shell's existing result vocabulary.
  // ---------------------------------------------------------------------

  devicesList(): FedosDesktopShellResult<readonly FedosDeviceSyncDeviceView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().listDevices());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  deviceDetail(deviceId: string): FedosDesktopShellResult<FedosDeviceSyncDeviceView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().deviceDetail(deviceId));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  deviceSyncStatus(): FedosDesktopShellResult<FedosDeviceSyncSchedulerStatusView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().syncStatus());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  deviceSyncStart(): FedosDesktopShellResult<null> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().startSync());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  async deviceSyncStop(): Promise<FedosDesktopShellResult<null>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(await this.#runtime.deviceSyncOperational().stopSync());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  async deviceSyncNow(): Promise<FedosDesktopShellResult<readonly FedosDeviceSyncTickEntry[]>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(await this.#runtime.deviceSyncOperational().triggerSyncNow());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  syncSchedulesList(): FedosDesktopShellResult<readonly FedosDeviceSyncScheduleView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().listSchedules());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  syncTransfersList(): FedosDesktopShellResult<readonly FedosDeviceSyncTransferSessionView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().listTransferSessions());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  syncConflictsList(includeResolved = false): FedosDesktopShellResult<readonly FedosDeviceSyncConflictView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().listConflicts(includeResolved));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  syncConflictDetail(conflictId: string): FedosDesktopShellResult<FedosDeviceSyncConflictView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().conflictDetail(conflictId));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  /** Only the safe, existing Conflict Authority actions (`acknowledge`/`accept-identical`/`discard-invalid`/`refresh-missing-dependency`) -- never a generic "resolve-any-conflict" (this Arc's own Absolute Prohibitions). */
  syncConflictAcknowledge(conflictId: string, action: FedosDeviceSyncConflictResolutionAction): FedosDesktopShellResult<null> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDeviceSyncFacadeResult(this.#runtime.deviceSyncOperational().acknowledgeConflict(conflictId, action));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Sync is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  // ---------------------------------------------------------------------
  // Secure Runtime Alpha 4581-4660 -- Device Registration/Pairing commands.
  // Every method below delegates ENTIRELY to
  // `FedosRunningDesktopRuntime.devicePairing()` -- this Shell owns no
  // cryptographic implementation or independent trust truth, only maps that
  // facade's own closed outcomes onto this Shell's existing result
  // vocabulary (see `mapDevicePairingFacadeResult()` above) and owns the
  // one thing the facade deliberately does NOT: the ephemeral in-process
  // Device keypair a real Electron IPC caller can never itself hold
  // (`#pairingKeypairsByPairingId` above).
  // ---------------------------------------------------------------------

  /** JOINING Device: generates a fresh, independent Device keypair, mints a real challenge + this Device's own proof of possession, and returns the encoded, bounded pairing request string ready for manual transfer to the Authorizing Device. */
  devicePairingCreate(deviceId: string, expectedAccountRef: FedosDeviceBindingAccountRef): FedosDesktopShellResult<{ readonly pairingId: string; readonly encoded: string }> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      const keypair = generateFedosDeviceSigningKeypair();
      const result = this.#runtime.devicePairing().createPairingRequest(deviceId, keypair, expectedAccountRef);
      if (result.outcome === "ok") {
        this.#pairingKeypairsByPairingId.set(result.value.pairingId, keypair);
      }
      return mapDevicePairingFacadeResult(result);
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Pairing is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  /** Ephemeral, in-process bookkeeping only -- see `FedosDevicePairingFacade.listPendingPairings()`'s own header. Never the source of registration truth. */
  devicePairingsList(): FedosDesktopShellResult<readonly FedosDevicePairingRequestSummary[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDevicePairingFacadeResult(this.#runtime.devicePairing().listPendingPairings());
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Pairing is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  /** AUTHORIZING Device: safe, read-only inspection of an inbound encoded pairing request -- re-verifies the embedded Device proof of possession (no secret required), never mutates anything. */
  devicePairingInspect(encodedRequest: string): FedosDesktopShellResult<FedosDevicePairingRequestInspectionView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDevicePairingFacadeResult(this.#runtime.devicePairing().inspectPairingRequest(encodedRequest));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Pairing is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  /** AUTHORIZING Device: signs a real account authorization over the inbound request's own challenge and returns the encoded approval for manual transfer back to the Joining Device. Requires `config.deviceBindingAccountSigningAuthority`. */
  async devicePairingApprove(encodedRequest: string): Promise<FedosDesktopShellResult<FedosDevicePairingApprovalOutcomeView>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDevicePairingFacadeResult(await this.#runtime.devicePairing().approvePairingRequest(encodedRequest));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Pairing is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  /** JOINING Device: completes registration using the in-process keypair this Shell generated in `devicePairingCreate()`. Consumes (removes) that keypair regardless of outcome. */
  async devicePairingComplete(pairingId: string, encodedApproval: string): Promise<FedosDesktopShellResult<FedosDevicePairingBindingView>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const keypair = this.#pairingKeypairsByPairingId.get(pairingId);
    this.#pairingKeypairsByPairingId.delete(pairingId);
    if (keypair === undefined) return fedosDesktopShellFailure("not-found", `no in-process Device keypair for pairingId "${pairingId}" -- either unknown, already completed, or created in a different process`);
    try {
      return mapDevicePairingFacadeResult(await this.#runtime.devicePairing().completePairing(pairingId, keypair, encodedApproval));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Pairing is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  /** AUTHORIZING Device: revokes a Device binding by account authorization alone. Requires `config.deviceBindingAccountSigningAuthority`. Terminal on this Runtime's own local Registry. */
  async deviceRevoke(deviceId: string, devicePublicKeyHex: string): Promise<FedosDesktopShellResult<FedosDevicePairingBindingView>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDevicePairingFacadeResult(await this.#runtime.devicePairing().revokeDevice(deviceId, devicePublicKeyHex));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Pairing is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  /** Either Device: the real, current registration/trust/sync-eligibility status for `deviceId` on THIS local Registry. */
  deviceRegistrationStatus(deviceId: string): FedosDesktopShellResult<FedosDevicePairingBindingView> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    try {
      return mapDevicePairingFacadeResult(this.#runtime.devicePairing().registrationStatus(deviceId));
    } catch {
      return fedosDesktopShellFailure("unsupported", "Device Pairing is not enabled on this Runtime -- see config.deviceTrustEnabled");
    }
  }

  // ---------------------------------------------------------------------
  // Internal view-model composition.
  // ---------------------------------------------------------------------

  #mapConstructionResult(result: FedosPrivateConversationConstructionResult): FedosDesktopShellResult<FedosConversationDetailView> {
    switch (result.outcome) {
      case "draft-created":
      case "already-present": {
        this.#knownConversationIds.add(result.draft.id);
        const detail = this.#toDetailView(result.draft.id);
        return detail === null
          ? fedosDesktopShellFailure("failed", "construction reported success but the draft could not be re-read")
          : fedosDesktopShellOk(detail);
      }
      case "partial-construction": {
        this.#knownConversationIds.add(result.draft.id);
        return fedosDesktopShellFailure("conflict", `construction is partially complete (pending: ${result.detail})`);
      }
      case "conflict":
        return fedosDesktopShellFailure("conflict", "a different conversation already occupies this id");
      case "invalid-command":
        return fedosDesktopShellFailure("invalid-input", "malformed creation command");
      case "identity-unavailable":
        return fedosDesktopShellFailure("unauthorized", "creator identity axis failed closed");
      case "policy-failed":
        return fedosDesktopShellFailure("failed", "no valid policy for the requested mode");
      case "membership-failed":
        this.#knownConversationIds.add(result.draft.id);
        return fedosDesktopShellFailure("failed", "creator membership admission failed");
      case "capability-failed":
        this.#knownConversationIds.add(result.draft.id);
        return fedosDesktopShellFailure("failed", "capability issuance failed");
      case "persistence-failed":
        return fedosDesktopShellFailure("failed", "draft record write failed");
      case "unavailable":
        return fedosDesktopShellFailure("unavailable", "a required construction dependency was not available");
    }
  }

  // ---------------------------------------------------------------------
  // Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-
  // Device Aggregation and User Consent UI Arc) -- every method below
  // delegates ENTIRELY to `FedosConversationRuntime.deletionRequest()`
  // (`../../conversation/deletion_request/fedos_deletion_request_runtime.ts`,
  // `5881-5960`) -- this Shell owns no deletion-request protocol/policy/
  // execution logic of its own, only maps that facade's own closed
  // outcomes onto this Shell's existing result vocabulary. `"unavailable"`
  // when `deletionRequest()` returns `null` (the Runtime was started
  // without `deletionRequest` configured) -- the SAME honest terminus
  // `deviceStatus()`/`deviceTrust()`-gated methods already use above.
  // ---------------------------------------------------------------------

  #deletionRequestRuntime(): FedosDeletionRequestRuntime | null {
    if (this.#runtime === null) return null;
    return this.#runtime.conversationRuntime().deletionRequest();
  }

  async deletionRequestCreate(params: FedosDeletionRequestCreateParams): Promise<FedosDesktopShellResult<{ readonly requestId: string }>> {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    const outcome = await dr.createDeletionRequest(params);
    if (outcome.outcome === "published") return fedosDesktopShellOk({ requestId: outcome.requestId });
    return fedosDesktopShellFailure(mapDeletionRequestOutboundOutcomeKind(outcome.outcome), outcome.outcome);
  }

  /** Every LATEST snapshot this local sender has for the given target — the Controller (Phase B) builds the per-Device aggregate from this plus `deletionRequestAcknowledgementOutcome()` and the real Device Registry list. */
  deletionRequestListSentForTarget(conversationId: string, targetEnvelopeId: string): FedosDesktopShellResult<readonly FedosPersistedDeletionRequestStateRecordV1[]> {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    return fedosDesktopShellOk(dr.listSentRequestsForTarget(conversationId, targetEnvelopeId));
  }

  deletionRequestAcknowledgementOutcome(requestId: string): FedosDesktopShellResult<FedosDeletionRequestAcknowledgementOutcome | null> {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    return fedosDesktopShellOk(dr.getAcknowledgementOutcome(requestId));
  }

  deletionRequestListReceived(): FedosDesktopShellResult<
    readonly { readonly summary: FedosDeletionRequestInboxSummaryV1; readonly decisionState: FedosDeletionRecipientDecisionState | null }[]
  > {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    return fedosDesktopShellOk(dr.listReceivedRequestSummaries());
  }

  deletionRequestAssessPolicy(policy: FedosDeletionRecipientPolicy, requestedScope: FedosDeletionRequestScope): FedosDesktopShellResult<FedosDeletionRecipientPolicyDecision> {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    return fedosDesktopShellOk(dr.assessRecipientDeletionPolicy(policy, requestedScope));
  }

  async deletionRequestApprove(requestId: string): Promise<FedosDesktopShellResult<FedosDeletionRequestInboundOutcome | { readonly outcome: "unknown-request" }>> {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    return fedosDesktopShellOk(await dr.approveReceivedDeletionRequest(requestId));
  }

  async deletionRequestReject(requestId: string): Promise<FedosDesktopShellResult<FedosDeletionRequestInboundOutcome | { readonly outcome: "unknown-request" }>> {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    return fedosDesktopShellOk(await dr.rejectReceivedDeletionRequest(requestId));
  }

  deletionRequestStatus(requestId: string): FedosDesktopShellResult<{ readonly requestId: string; readonly safeStatus: string } | null> {
    const dr = this.#deletionRequestRuntime();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "deletion request Runtime is not configured");
    return fedosDesktopShellOk(dr.inspectDeletionRequestStatus(requestId));
  }

  // ---------------------------------------------------------------------
  // Secure Runtime Alpha 6121-6200 (FedOS Identity Replacement User
  // Verification and Conversation Continuity UI Arc) -- every method
  // below delegates ENTIRELY to `FedosConversationRuntime.identityTransition()`
  // (`../../conversation/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.ts`,
  // `5961-6040`) plus the ALREADY-PUBLIC `directRatchet()` accessor for
  // the two operations that need a live Ratchet safe-status/reset call
  // (`identityTransitionAssessContinuity`/`identityTransitionAuthorizeRatchetReset`)
  // -- this Shell owns no identity-transition evidence/evaluation/reset
  // logic of its own, only maps those facades' own closed outcomes onto
  // this Shell's existing result vocabulary. `"unavailable"` when either
  // accessor returns `null` -- the SAME honest terminus every other
  // optional-integration section of this Shell already uses. Opening,
  // listing, or inspecting a transition NEVER accepts or resets anything
  // -- only `identityTransitionAccept`/`Reject` and
  // `identityTransitionAuthorizeRatchetReset` mutate any durable state,
  // and they remain two entirely separate calls (Phase C/H's own
  // requirement).
  // ---------------------------------------------------------------------

  #identityTransitionRuntime(): FedosIdentityTransitionPeerRuntime | null {
    if (this.#runtime === null) return null;
    return this.#runtime.conversationRuntime().identityTransition();
  }

  identityTransitionList(limit: number, offset: number): FedosDesktopShellResult<readonly FedosIdentityTransitionPeerStatusView[]> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    return fedosDesktopShellOk(it.listIdentityTransitionInbox(limit, offset));
  }

  /** Opening a transition is a pure read — never accepts/rejects/resets anything. */
  identityTransitionOpen(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosDesktopShellResult<FedosIdentityTransitionSafeViewV1 | null> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    return fedosDesktopShellOk(it.getIdentityTransitionSafeView(peerAccountRef, peerDeviceRef, transitionId));
  }

  /** Phase K's own distinct evidence-review action — same underlying safe view as `identityTransitionOpen` (which already includes the full per-Device evidence list and centralized warnings), never a second, divergent read. */
  identityTransitionInspectEvidence(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosDesktopShellResult<FedosIdentityTransitionSafeViewV1 | null> {
    return this.identityTransitionOpen(peerAccountRef, peerDeviceRef, transitionId);
  }

  /** Phase D — a local trust decision, never universal proof. Fails closed on an unknown method/note code (mapped to `"invalid-input"`, never silently accepted). */
  identityTransitionRecordManualVerification(params: {
    readonly transitionId: string;
    readonly method: FedosIdentityTransitionManualVerificationMethod;
    readonly verifiedAt: number;
    readonly noteCode: FedosIdentityTransitionManualVerificationNoteCode;
  }): FedosDesktopShellResult<"recorded" | "already-present"> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    const outcome = it.recordManualVerification(params);
    if (outcome === "recorded" || outcome === "already-present") return fedosDesktopShellOk(outcome);
    if (outcome === "unavailable") return fedosDesktopShellFailure("invalid-input", "unknown manual verification method or note code");
    if (outcome === "conflict") return fedosDesktopShellFailure("conflict", outcome);
    if (outcome === "stale-revision") return fedosDesktopShellFailure("conflict", outcome);
    return fedosDesktopShellFailure("failed", outcome);
  }

  identityTransitionAccept(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosDesktopShellResult<FedosIdentityTransitionPeerStatusView> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    const view = it.recordIdentityTransitionDecision(peerAccountRef, peerDeviceRef, transitionId, "accept");
    if (view === null) return fedosDesktopShellFailure("not-found", "unknown transition");
    return fedosDesktopShellOk(view);
  }

  identityTransitionReject(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosDesktopShellResult<FedosIdentityTransitionPeerStatusView> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    const view = it.recordIdentityTransitionDecision(peerAccountRef, peerDeviceRef, transitionId, "reject");
    if (view === null) return fedosDesktopShellFailure("not-found", "unknown transition");
    return fedosDesktopShellOk(view);
  }

  /** Deferring is explicitly NOT a decision — it never changes `acceptanceState` away from its evidence-only baseline (mirrors `"none"`). */
  identityTransitionDefer(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosDesktopShellResult<FedosIdentityTransitionPeerStatusView> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    const view = it.recordIdentityTransitionDecision(peerAccountRef, peerDeviceRef, transitionId, "defer");
    if (view === null) return fedosDesktopShellFailure("not-found", "unknown transition");
    return fedosDesktopShellOk(view);
  }

  identityTransitionStatus(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    transitionId: string,
  ): FedosDesktopShellResult<FedosIdentityTransitionPeerStatusView | null> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    return fedosDesktopShellOk(it.inspectPeerIdentityTransitionStatus(peerAccountRef, peerDeviceRef, transitionId));
  }

  /** Phase F/G — links a Direct Conversation to an ALREADY-accepted transition. Refuses (`"conflict"`, mapped from the Runtime's own `"not-accepted"`) if the transition is not yet accepted on this Device. */
  identityTransitionRecordContinuity(params: {
    readonly conversationId: string;
    readonly transitionId: string;
    readonly acceptedAt: number;
    readonly newSessionRequired: boolean;
  }): FedosDesktopShellResult<FedosIdentityTransitionConversationContinuityRecordV1["revision"]> {
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    const outcome = it.recordConversationContinuity(params);
    if (outcome === "inserted" || outcome === "already-present") {
      const current = it.getConversationContinuity(params.conversationId);
      return fedosDesktopShellOk(current?.revision ?? 0);
    }
    if (outcome === "not-accepted") return fedosDesktopShellFailure("conflict", "transition is not yet accepted on this Device");
    if (outcome === "conflict" || outcome === "rollback-detected") return fedosDesktopShellFailure("conflict", outcome);
    if (outcome === "unavailable") return fedosDesktopShellFailure("unavailable", outcome);
    return fedosDesktopShellFailure("failed", outcome);
  }

  /** Phase H/I — read-only. Reports each named `(conversationId, remoteDeviceRef)` pair's ALREADY-PUBLIC Ratchet safe status; never mutates anything. */
  identityTransitionAssessContinuity(
    pairs: readonly FedosIdentityTransitionSessionPairToAssess[],
  ): FedosDesktopShellResult<readonly FedosIdentityTransitionSessionImpactRowV1[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "Runtime is not started");
    const dr = this.#runtime.conversationRuntime().directRatchet();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "direct ratchet Runtime is not configured");
    const rows = pairs.map((pair) => fedosIdentityTransitionBuildSessionImpactRow(pair, dr.getDirectRatchetStatus(pair.conversationId, pair.remoteDeviceRef)));
    return fedosDesktopShellOk(rows);
  }

  /**
   * Phase H/J — the ONE method in this Shell that mutates Ratchet state,
   * and only for an ALREADY-`"accepted"` transition (enforced by the
   * Runtime's own `authorizeIdentityTransitionRatchetReset()`, never
   * re-checked or second-guessed here). Constructs a THIN adapter over
   * the ALREADY-PUBLIC `initializeDirectRatchetSession()` — never a new
   * Ratchet-facing method, never root/chain/session secrets exposed.
   */
  async identityTransitionAuthorizeRatchetReset(params: {
    readonly transitionId: string;
    readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
    readonly affectedSessions: readonly FedosIdentityTransitionAffectedSession[];
  }): Promise<FedosDesktopShellResult<{ readonly outcome: string }>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "Runtime is not started");
    const it = this.#identityTransitionRuntime();
    if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
    const dr = this.#runtime.conversationRuntime().directRatchet();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "direct ratchet Runtime is not configured");
    const result = await it.authorizeIdentityTransitionRatchetReset({
      transitionId: params.transitionId,
      acceptanceState: params.acceptanceState,
      affectedSessions: params.affectedSessions,
      outboundIntegration: {
        establishSession: (conversationId, remoteDeviceRef, options) => dr.initializeDirectRatchetSession(conversationId, remoteDeviceRef, options),
      },
    });
    if (result.outcome === "not-accepted") return fedosDesktopShellFailure("conflict", "transition is not accepted");
    return fedosDesktopShellOk(result);
  }

  // ---------------------------------------------------------------------
  // Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
  // Safety Center Arc) -- four narrow, additive, read-only accessors the
  // Safety Center's own aggregation needs and this Shell did not expose
  // before. Every one of them delegates entirely to an ALREADY-PUBLIC
  // Runtime/sub-Runtime method -- no new business logic, no new mutation.
  // `"unavailable"` on a stopped Shell or an unconfigured optional
  // sub-Runtime -- the SAME honest terminus every other optional
  // integration on this Shell already uses.
  // ---------------------------------------------------------------------

  /** Whether real (non-development-double) encryption is active for this Runtime -- never a claim about any specific Conversation's own readiness. */
  productionCryptoStatus(): FedosDesktopShellResult<FedosConversationProductionCryptoCapabilityOutcome> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    return fedosDesktopShellOk(this.#runtime.conversationProductionCryptoCapability());
  }

  /** Read-only Ratchet safe status for one already-known `(conversationId, remoteDeviceRef)` pair -- mirrors `identityTransitionAssessContinuity()`'s own established "no session-listing query exists, caller names the pairs" precedent, since no such listing exists here either. */
  directRatchetStatus(conversationId: string, remoteDeviceRef: string): FedosDesktopShellResult<FedosDirectRatchetSafeStatus> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const dr = this.#runtime.conversationRuntime().directRatchet();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "direct ratchet Runtime is not configured");
    return fedosDesktopShellOk(dr.getDirectRatchetStatus(conversationId, remoteDeviceRef));
  }

  /**
   * Secure Runtime Alpha 7001-7080 — a narrow, real, additive wrapper over
   * `FedosDirectRatchetConversationRuntime.initializeDirectRatchetSession()`
   * (already real, unchanged since Alpha 5561-5640/6521-6600). No new
   * establishment logic; this method only routes the call through the
   * Shell's own established `"unavailable"`-when-not-running/not-configured
   * discipline, mirroring `directRatchetStatus()` immediately above.
   */
  async establishDirectRatchetSession(
    conversationId: string,
    remoteDeviceRef: string,
    options?: FedosDirectRatchetEstablishOptions,
  ): Promise<FedosDesktopShellResult<FedosDirectRatchetEstablishOutcome>> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const dr = this.#runtime.conversationRuntime().directRatchet();
    if (dr === null) return fedosDesktopShellFailure("unavailable", "direct ratchet Runtime is not configured");
    const outcome = await dr.initializeDirectRatchetSession(conversationId, remoteDeviceRef, options);
    return fedosDesktopShellOk(outcome);
  }

  /** Every peer Device this local Device has ever observed a capability advertisement from -- a real listing query DOES exist here (unlike Direct Ratchet above). */
  peerCapabilityListObserved(): FedosDesktopShellResult<readonly FedosRatchetPeerCapabilityPeerDeviceStatus[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const pc = this.#runtime.conversationRuntime().peerCapability();
    if (pc === null) return fedosDesktopShellFailure("unavailable", "peer capability Runtime is not configured");
    return fedosDesktopShellOk(pc.listObservedPeerDevices());
  }

  /** Read-only peer capability safe status for one named peer Device. */
  peerCapabilityStatus(peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string): FedosDesktopShellResult<FedosRatchetPeerCapabilitySafeStatus> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const pc = this.#runtime.conversationRuntime().peerCapability();
    if (pc === null) return fedosDesktopShellFailure("unavailable", "peer capability Runtime is not configured");
    return fedosDesktopShellOk(pc.getPeerDeviceCapabilityStatus(peerAccountRef, peerDeviceRef));
  }

  #toSummaryView(conversationId: string): FedosConversationSummaryView | null {
    if (this.#runtime === null) return null;
    const cr = this.#runtime.conversationRuntime();
    const draft = cr.findConversation(conversationId);
    if (draft === null) return null;
    const readiness = cr.readinessForConversation(conversationId);
    const memberships = cr.listMemberships(conversationId);
    const constructionStatus = cr.constructionStatus(conversationId);
    return Object.freeze({
      conversationId: draft.id,
      mode: draft.mode,
      lifecycleState: draft.lifecycleState,
      activationStatus: readiness?.overall ?? "blocked",
      participantCount: memberships.filter((m) => m.state === "active").length,
      createdAt: draft.createdAt,
      constructionStatus,
    });
  }

  #toDetailView(conversationId: string): FedosConversationDetailView | null {
    if (this.#runtime === null) return null;
    const summary = this.#toSummaryView(conversationId);
    if (summary === null) return null;
    const cr = this.#runtime.conversationRuntime();
    const draft = cr.findConversation(conversationId);
    const readiness = cr.readinessForConversation(conversationId);
    if (draft === null || readiness === null) return null;
    return Object.freeze({
      ...summary,
      creator: draft.creator,
      readiness,
      memberships: cr.listMemberships(conversationId),
    });
  }
}

export function createFedosDesktopApplicationShell(): FedosDesktopApplicationShell {
  return FedosDesktopApplicationShell.create();
}
