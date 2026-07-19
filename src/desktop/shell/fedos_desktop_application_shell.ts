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

/** A bare `FedosDesktopShellFailure` object — unlike `fedosDesktopShellFailure()`, whose return type is the full `FedosDesktopShellResult<T>` union, for the internal call sites below that need exactly this narrower shape (e.g. `#validateSendPreconditions`'s own `FedosDesktopShellFailure | null` return). */
function shellFailure(outcome: FedosDesktopShellOutcomeKind, reason: string): FedosDesktopShellFailure {
  return Object.freeze({ outcome, reason });
}

/** `FedosContentAccessorFailure`'s outcome vocabulary is defined IDENTICALLY to `FedosDesktopShellOutcomeKind` (see both files' own headers) — a straight relabel, never a re-derivation. */
function mapContentAccessorFailure(failure: FedosContentAccessorFailure): FedosDesktopShellFailure {
  return shellFailure(failure.outcome as unknown as FedosDesktopShellOutcomeKind, failure.reason);
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

  private constructor() {}

  /** Thin factory — mirrors `createFedosConversationRuntime()`'s own style. No side effect until `start()` is called. */
  static create(): FedosDesktopApplicationShell {
    return new FedosDesktopApplicationShell();
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
