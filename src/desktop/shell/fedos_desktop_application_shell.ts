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
 * `listMessages`/`sendMessage`/`reply`/`search`/`archive`/`deviceStatus`
 * are real, testable methods that perform every check possible against
 * live Runtime state and terminate at an honest `"unavailable"`/
 * `"requires-activation"` outcome at the exact structural boundary
 * `docs/secure_runtime_alpha_2841_2920_execution_spec.md` Phase A documents
 * — never a fabricated plaintext, never a silent no-op success. See that
 * document for the full reasoning; this file does not restate it inline
 * beyond a one-line pointer per method.
 *
 * HARD GUARDRAILS:
 *   - Owns exactly one `FedosRunningDesktopRuntime` per shell instance; two
 *     shell instances started against two different configs are fully
 *     independent (mirrors the Runtime's own "no shared singleton"
 *     guarantee).
 *   - Never exposes `this.#runtime` itself, `host`, `boardRuntime()`,
 *     `conversationRuntime()`, or `privateTransport()` to a caller.
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
import {
  fedosDesktopShellOk,
  fedosDesktopShellFailure,
  type FedosDesktopShellResult,
} from "./fedos_desktop_shell_result.js";
import type {
  FedosConversationDetailView,
  FedosConversationListFilter,
  FedosConversationSummaryView,
  FedosDeviceStatusView,
  FedosIssuedInvitationView,
  FedosMessageView,
} from "./fedos_desktop_shell_view_models.js";

/** Why `listMessages`/`sendMessage`/`reply` cannot reach real Envelope content on this base — see execution spec Phase A/A6. */
const MESSAGE_ACCESS_UNAVAILABLE_REASON =
  "message envelope/payload access is not reachable from FedosRunningDesktopRuntime's public surface on this base " +
  "(no accessor exposes conversation Envelope/Payload persistence; see Alpha 2841-2920 execution spec Phase A/A6)";

/** Why `search()` cannot reach a real, connected Search Index — see execution spec Phase A/A4/A6. */
const SEARCH_UNAVAILABLE_REASON =
  "FedosConversationSearchIndex is not owned by, or reachable through, FedosRunningDesktopRuntime on this base " +
  "(its own draftPersistence/membershipAuthority dependencies are private to FedosConversationRuntime; see Alpha 2841-2920 execution spec Phase A/A4/A6)";

/** Why `archive()` cannot reach the five raw ports the Archive Collector needs — see execution spec Phase A/A5/A6. */
const ARCHIVE_UNAVAILABLE_REASON =
  "the Archive Collector's five required persistence ports (conversation, membership, capability, envelope, payload) " +
  "are not reachable from FedosRunningDesktopRuntime on this base; see Alpha 2841-2920 execution spec Phase A/A5/A6";

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
  // Messages — real precondition checks; honest "unavailable" terminus.
  // See execution spec Phase A/A6, A/A2 (why "requires-activation" fires
  // before the deeper unavailable boundary is ever reached: no conversation
  // on this base can ever leave the "draft" lifecycle state).
  // ---------------------------------------------------------------------

  listMessages(conversationId: string): FedosDesktopShellResult<readonly FedosMessageView[]> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    if (this.#runtime.conversationRuntime().findConversation(conversationId) === null) {
      return fedosDesktopShellFailure("not-found", "unknown conversation");
    }
    return fedosDesktopShellFailure("unavailable", MESSAGE_ACCESS_UNAVAILABLE_REASON);
  }

  sendMessage(conversationId: string, sender: FedosConversationParticipantReference): FedosDesktopShellResult<never> {
    return this.#validateSendPreconditions(conversationId, sender);
  }

  reply(conversationId: string, sender: FedosConversationParticipantReference, replyToMessageId: string): FedosDesktopShellResult<never> {
    if (replyToMessageId.length === 0) return fedosDesktopShellFailure("invalid-input", "replyToMessageId must be non-empty");
    return this.#validateSendPreconditions(conversationId, sender);
  }

  #validateSendPreconditions(conversationId: string, sender: FedosConversationParticipantReference): FedosDesktopShellResult<never> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    const cr = this.#runtime.conversationRuntime();
    const draft = cr.findConversation(conversationId);
    if (draft === null) return fedosDesktopShellFailure("not-found", "unknown conversation");
    // Authorization is checked BEFORE lifecycle state, deliberately: a
    // non-member must never learn anything about a conversation's
    // activation state, only that they are not authorized to act on it.
    const membership = cr.listMemberships(conversationId).find((m) => participantsEqual(m.participant, sender));
    if (membership === undefined || membership.state !== "active") {
      return fedosDesktopShellFailure("unauthorized", "sender is not an active member of this conversation");
    }
    if (draft.lifecycleState !== "active") {
      return fedosDesktopShellFailure(
        "requires-activation",
        `conversation lifecycle is "${draft.lifecycleState}"; no activation primitive exists on this base (see Alpha 2841-2920 execution spec Phase A/A2)`,
      );
    }
    return fedosDesktopShellFailure("unavailable", MESSAGE_ACCESS_UNAVAILABLE_REASON);
  }

  // ---------------------------------------------------------------------
  // Search, Archive, Device status — honest "unavailable" on this base.
  // ---------------------------------------------------------------------

  /** Always `"unavailable"` once running — see execution spec Phase A/A4/A6. */
  search(): FedosDesktopShellResult<never> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    return fedosDesktopShellFailure("unavailable", SEARCH_UNAVAILABLE_REASON);
  }

  /** Always `"unavailable"` once running — see execution spec Phase A/A5/A6. */
  archive(): FedosDesktopShellResult<never> {
    if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "shell is not running");
    return fedosDesktopShellFailure("unavailable", ARCHIVE_UNAVAILABLE_REASON);
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
