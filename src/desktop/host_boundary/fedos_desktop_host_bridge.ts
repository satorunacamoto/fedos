/**
 * Secure Runtime Alpha 3561-3640 ("Desktop Electron Host Boundary Arc") —
 * Phases E (in-process reference)/F (lifecycle)/G (render loop).
 *
 * `FedosDesktopHostBridge` is the in-process reference implementation of
 * `FedosDesktopHostPort` (`./fedos_desktop_host_port.ts`) — this
 * repository has no accepted Electron dependency (see
 * `docs/secure_runtime_alpha_3561_3640_reconciliation_report.md` §2), so
 * this Arc stops exactly at the external Electron boundary and implements
 * the complete host abstraction over an in-process bridge instead. A
 * FUTURE Electron adapter would implement the SAME `FedosDesktopHostPort`
 * interface, wiring `ipcMain`/a preload script to `start`/`stop`/
 * `dispatch`/`render` one-for-one — no redesign of this class would be
 * required, only a new sibling implementation.
 *
 * OWNERSHIP (Phase B/F): constructs exactly one
 * `FedosDesktopConversationUiPresentationBoundary` (which itself owns
 * exactly one `FedosDesktopApplicationShell`, which owns exactly one
 * `FedosRunningDesktopRuntime`) and exactly one `FedosDesktopRenderer` per
 * `start()` call — never a second, divergent instance while running.
 * `stop()` releases both references (this class's own reverse-of-construction
 * order: Renderer reference cleared, then Boundary/Shell/Runtime stopped
 * via the ONE real `shell.stop()` call the Presentation Boundary already
 * owns — see the reconciliation report's own §11 for why this collapses
 * to one real stop call).
 *
 * SERIALIZATION (Phase I "concurrent commands are serialized"): every
 * `dispatch()` call is chained through one internal Promise queue — two
 * concurrent `dispatch()` calls never run their own ViewModel-mutating
 * logic interleaved; the second always sees the state the first left
 * behind. This is NOT hidden polling (Phase G's own prohibition) — it is
 * ordering only, applied to caller-initiated actions.
 *
 * SECRET/ERROR ISOLATION (Phase D/J): every branch below returns via
 * `fedosHostOk`/`fedosHostFailure`/`fedosHostResponseFromResult` — never a
 * raw `Error`. A genuine unexpected exception from a lower layer (e.g.
 * `startFedosDesktopRuntime()` throwing on a structurally invalid config)
 * is caught here and converted to a closed `"failed"` response; no stack,
 * no provider detail, ever crosses this boundary.
 */

import {
  createFedosDesktopConversationUiPresentationBoundary,
  type FedosDesktopConversationUiPresentationBoundary,
} from "../presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { createFedosDesktopRenderer, type FedosDesktopRenderer } from "../renderer/fedos_desktop_renderer.js";
import type { FedosDesktopRuntimeConfig } from "../runtime/fedos_desktop_runtime_config.js";
import type { FedosDesktopHostPort, FedosDesktopHostStatus } from "./fedos_desktop_host_port.js";
import { validateFedosDesktopHostCommand } from "./fedos_desktop_host_command.js";
import {
  fedosHostOk,
  fedosHostFailure,
  fedosHostResponseFromResult,
  fedosHostResponseFromViewModelState,
  type FedosDesktopHostDiagnosticCode,
  type FedosDesktopHostResponse,
} from "./fedos_desktop_host_response.js";

/** The FULL current screen -- every content renderer's own output, aggregated. Phase G's own "request a current screen model" primitive. */
export interface FedosDesktopFullRenderModel {
  readonly runtimeStatus: ReturnType<FedosDesktopRenderer["status"]["render"]>;
  readonly conversationList: ReturnType<FedosDesktopRenderer["conversationList"]["render"]>;
  readonly conversationDetail: ReturnType<FedosDesktopRenderer["conversationDetail"]["render"]>;
  readonly message: ReturnType<FedosDesktopRenderer["message"]["render"]>;
  readonly reply: ReturnType<FedosDesktopRenderer["reply"]["render"]>;
  readonly search: ReturnType<FedosDesktopRenderer["search"]["render"]>;
  readonly archive: ReturnType<FedosDesktopRenderer["archive"]["render"]>;
  readonly membership: ReturnType<FedosDesktopRenderer["membership"]["render"]>;
}

export class FedosDesktopHostBridge implements FedosDesktopHostPort {
  #status: FedosDesktopHostStatus = "stopped";
  #boundary: FedosDesktopConversationUiPresentationBoundary | null = null;
  #renderer: FedosDesktopRenderer | null = null;
  #dispatchQueue: Promise<unknown> = Promise.resolve();

  private constructor() {}

  /** Thin factory -- mirrors `createFedosDesktopApplicationShell()`'s own style. No side effect (no Runtime started) until `start()` is called. */
  static create(): FedosDesktopHostBridge {
    return new FedosDesktopHostBridge();
  }

  status(): FedosDesktopHostStatus {
    return this.#status;
  }

  async start(config: FedosDesktopRuntimeConfig): Promise<FedosDesktopHostResponse<null>> {
    if (this.#status === "running") {
      return fedosHostFailure("conflict", "host is already running; call stop() first");
    }
    try {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      const started = await boundary.runtimeStatus.start(config);
      if (started.status === "error") {
        // Startup failed at the Shell/Runtime layer -- deny, never leave a half-started Host (Phase F "startup failure closes/denies the window").
        return fedosHostFailure(started.outcome as FedosDesktopHostDiagnosticCode, started.reason);
      }
      this.#boundary = boundary;
      this.#renderer = createFedosDesktopRenderer(boundary);
      this.#status = "running";
      return fedosHostOk(null);
    } catch {
      // A genuine, unexpected exception from a lower layer (e.g. startFedosDesktopRuntime()
      // itself throwing on a structurally invalid config) -- never a raw Error crosses this
      // boundary (Phase D/J). No orphan state: this.#boundary/#renderer are never assigned above.
      return fedosHostFailure("failed", "startup failed");
    }
  }

  async stop(): Promise<FedosDesktopHostResponse<null>> {
    if (this.#status !== "running" || this.#boundary === null) {
      return fedosHostFailure("unavailable", "host is not running");
    }
    const boundary = this.#boundary;
    // Cleared BEFORE the await -- a command already queued behind this stop() sees
    // "not running" the instant its own turn comes up, never a stale reference.
    this.#boundary = null;
    this.#renderer = null;
    this.#status = "stopped";
    try {
      const stopped = await boundary.runtimeStatus.stop();
      if (stopped.status === "error") return fedosHostFailure(stopped.outcome as FedosDesktopHostDiagnosticCode, stopped.reason);
      return fedosHostOk(null);
    } catch {
      return fedosHostFailure("failed", "stop failed");
    }
  }

  render(): FedosDesktopHostResponse<FedosDesktopFullRenderModel> {
    if (this.#status !== "running" || this.#renderer === null) {
      return fedosHostFailure("unavailable", "host is not running");
    }
    const r = this.#renderer;
    return fedosHostOk(
      Object.freeze({
        runtimeStatus: r.status.render(),
        conversationList: r.conversationList.render(),
        conversationDetail: r.conversationDetail.render(),
        message: r.message.render(),
        reply: r.reply.render(),
        search: r.search.render(),
        archive: r.archive.render(),
        membership: r.membership.render(),
      }),
    );
  }

  /** Validates, then QUEUES, one command -- see this file's own header, "SERIALIZATION". */
  async dispatch(command: unknown): Promise<FedosDesktopHostResponse<unknown>> {
    const task = this.#dispatchQueue.then(() => this.#dispatchOne(command));
    // Never let one failed dispatch poison the queue for every later caller.
    this.#dispatchQueue = task.catch(() => undefined);
    return task;
  }

  async #dispatchOne(command: unknown): Promise<FedosDesktopHostResponse<unknown>> {
    if (this.#status !== "running" || this.#boundary === null) {
      return fedosHostFailure("unavailable", "host is not running");
    }
    const validated = validateFedosDesktopHostCommand(command);
    if (validated === null) {
      return fedosHostFailure("unknown-command", "malformed or unrecognized command");
    }
    const requestId = validated.requestId;
    const boundary = this.#boundary;

    try {
      switch (validated.type) {
        case "runtime-status": {
          const state = await boundary.runtimeStatus.refresh();
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "device-status": {
          const state = await boundary.runtimeStatus.refresh();
          if (state.status !== "loaded") return fedosHostResponseFromViewModelState(state, requestId);
          return fedosHostOk(state.data.deviceStatus, requestId);
        }
        case "conversations-list": {
          const state = await boundary.conversationList.load(validated.filter);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "conversation-open": {
          const state = await boundary.conversationDetail.load(validated.conversationId);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "conversation-create-direct": {
          const result = boundary.shell.createDirectConversation(validated.command);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "conversation-create-group": {
          const result = boundary.shell.createPrivateGroup(validated.command);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "messages-list": {
          const state = await boundary.messageList.load(validated.conversationId);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "message-reveal": {
          const state = await boundary.messageList.reveal(validated.messageId);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "message-send": {
          boundary.composeMessage.setBody(validated.body);
          const state = await boundary.composeMessage.send(validated.conversationId, validated.sender);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "message-reply": {
          boundary.reply.startReplyTo(validated.replyToMessageId);
          boundary.reply.setBody(validated.body);
          const state = await boundary.reply.send(validated.conversationId, validated.sender);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "membership-list": {
          const state = await boundary.membership.load(validated.conversationId);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "invitation-descriptor": {
          const state = await boundary.membership.loadInvitations(validated.conversationId, validated.issuer);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "search": {
          boundary.search.setQuery(validated.query);
          const state = await boundary.search.search();
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        case "archive-inspect": {
          const state = await boundary.archive.inspect(validated.sourcePath);
          return fedosHostResponseFromViewModelState(state, requestId);
        }
        // Secure Runtime Alpha 4581-4660 -- Device Registration/Pairing
        // commands. Each delegates DIRECTLY to `boundary.shell`, the SAME
        // pattern `conversation-create-direct`/`conversation-create-group`
        // above already use for a Shell method with no dedicated ViewModel.
        case "device-pairing-create": {
          const result = boundary.shell.devicePairingCreate(validated.deviceId, validated.expectedAccountRef);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "device-pairing-inspect": {
          const result = boundary.shell.devicePairingInspect(validated.encodedRequest);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "device-pairing-approve": {
          const result = await boundary.shell.devicePairingApprove(validated.encodedRequest);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "device-pairing-complete": {
          const result = await boundary.shell.devicePairingComplete(validated.pairingId, validated.encodedApproval);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "device-pairings-list": {
          const result = boundary.shell.devicePairingsList();
          return fedosHostResponseFromResult(result, requestId);
        }
        case "device-revoke": {
          const result = await boundary.shell.deviceRevoke(validated.deviceId, validated.devicePublicKeyHex);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "device-registration-status": {
          const result = boundary.shell.deviceRegistrationStatus(validated.deviceId);
          return fedosHostResponseFromResult(result, requestId);
        }
        // Secure Runtime Alpha 6041-6120 -- Signed Deletion Request Multi-
        // Device Aggregation and Consent commands. Every case delegates to
        // `boundary.deletionRequests` (the Controller, `5881-5960`'s Shell
        // facade underneath) -- this Bridge invents no business logic.
        case "deletion-request-create": {
          await boundary.deletionRequests.createRequest({
            requesterAccountRef: validated.requesterAccountRef,
            recipientAccountRef: validated.recipientAccountRef,
            recipientDeviceRef: validated.recipientDeviceRef,
            conversationId: validated.conversationId as never,
            targetEnvelopeId: validated.targetEnvelopeId as never,
            scope: validated.scope,
            expiresInSeconds: validated.expiresInSeconds,
            reasonCode: validated.reasonCode,
          });
          return fedosHostResponseFromViewModelState(boundary.deletionRequests.createState, requestId);
        }
        case "deletion-request-list-sent":
        case "deletion-request-device-outcomes": {
          await boundary.deletionRequests.refreshSentStatus(validated.conversationId, validated.targetEnvelopeId, validated.knownDeviceIds);
          return fedosHostResponseFromViewModelState(boundary.deletionRequests.sentStatusState, requestId);
        }
        case "deletion-request-list-received": {
          await boundary.deletionRequests.openReceivedInbox();
          return fedosHostResponseFromViewModelState(boundary.deletionRequests.inboxState, requestId);
        }
        case "deletion-request-open": {
          await boundary.deletionRequests.openReceivedRequest(validated.deletionRequestId, validated.localPolicy);
          return fedosHostResponseFromViewModelState(boundary.deletionRequests.consentDetailState, requestId);
        }
        case "deletion-request-approve": {
          const result = await boundary.shell.deletionRequestApprove(validated.deletionRequestId);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "deletion-request-reject": {
          const result = await boundary.shell.deletionRequestReject(validated.deletionRequestId);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "deletion-request-status": {
          const result = boundary.shell.deletionRequestStatus(validated.deletionRequestId);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "deletion-request-dismiss": {
          boundary.deletionRequests.dismiss(validated.deletionRequestId);
          return fedosHostOk(null, requestId);
        }
        // Secure Runtime Alpha 6121-6200 (FedOS Identity Replacement User
        // Verification and Conversation Continuity UI Arc). Listing/
        // opening go through `boundary.identityTransitions` (the
        // Controller, `5961-6040`'s Shell facade underneath); every other
        // action is a direct pass-through to `boundary.shell` — the SAME
        // two dispatch idioms `deletion-request-*` already established
        // above, never a third.
        case "identity-transition-list": {
          await boundary.identityTransitions.refreshInbox(validated.limit, validated.offset);
          return fedosHostResponseFromViewModelState(boundary.identityTransitions.inboxState, requestId);
        }
        case "identity-transition-open":
        case "identity-transition-inspect-evidence": {
          await boundary.identityTransitions.openTransition(validated.peerAccountRef, validated.peerDeviceRef, validated.transitionId);
          return fedosHostResponseFromViewModelState(boundary.identityTransitions.detailState, requestId);
        }
        case "identity-transition-record-manual-verification": {
          await boundary.identityTransitions.recordManualVerification(validated.method, validated.verifiedAt, validated.noteCode);
          return fedosHostResponseFromViewModelState(boundary.identityTransitions.manualVerificationState, requestId);
        }
        case "identity-transition-accept": {
          const result = await boundary.shell.identityTransitionAccept(validated.peerAccountRef, validated.peerDeviceRef, validated.transitionId);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "identity-transition-reject": {
          const result = await boundary.shell.identityTransitionReject(validated.peerAccountRef, validated.peerDeviceRef, validated.transitionId);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "identity-transition-defer": {
          const result = await boundary.shell.identityTransitionDefer(validated.peerAccountRef, validated.peerDeviceRef, validated.transitionId);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "identity-transition-status": {
          const result = boundary.shell.identityTransitionStatus(validated.peerAccountRef, validated.peerDeviceRef, validated.transitionId);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "identity-transition-assess-continuity": {
          const result = boundary.shell.identityTransitionAssessContinuity(validated.pairs);
          return fedosHostResponseFromResult(result, requestId);
        }
        case "identity-transition-authorize-ratchet-reset": {
          const result = await boundary.shell.identityTransitionAuthorizeRatchetReset({
            transitionId: validated.transitionId,
            acceptanceState: validated.acceptanceState,
            affectedSessions: validated.affectedSessions as never,
          });
          return fedosHostResponseFromResult(result, requestId);
        }
        // Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy
        // Controls and Safety Center Arc). Every case delegates to
        // `boundary.safetyCenter` (the Controller) -- this Bridge invents
        // no aggregation/business logic of its own.
        case "safety-center-overview": {
          await boundary.safetyCenter.refreshOverview(validated.ratchetPairs);
          return fedosHostResponseFromViewModelState(boundary.safetyCenter.overviewState, requestId);
        }
        case "safety-center-events": {
          await boundary.safetyCenter.refreshEvents(validated.limit, validated.offset);
          return fedosHostResponseFromViewModelState(boundary.safetyCenter.eventsState, requestId);
        }
        case "safety-center-section": {
          const ok = boundary.safetyCenter.goto(validated.section);
          return ok ? fedosHostOk(null, requestId) : fedosHostFailure("invalid-input", "unknown section", requestId);
        }
        case "safety-center-device-action": {
          boundary.safetyCenter.requestRevokeDeviceConfirmation(validated.deviceId, validated.devicePublicKeyHex);
          return fedosHostResponseFromViewModelState(boundary.safetyCenter.confirmationState, requestId);
        }
        case "safety-center-ratchet-action": {
          boundary.safetyCenter.requestAuthorizeRatchetResetConfirmation(validated.conversationId, validated.remoteDeviceRef);
          return fedosHostResponseFromViewModelState(boundary.safetyCenter.confirmationState, requestId);
        }
        case "safety-center-confirm-action": {
          await boundary.safetyCenter.confirmPendingAction();
          return fedosHostResponseFromViewModelState(boundary.safetyCenter.confirmationState, requestId);
        }
        case "safety-center-cancel-action": {
          boundary.safetyCenter.cancelPendingConfirmation();
          return fedosHostOk(null, requestId);
        }
        case "safety-center-settings-action": {
          const applied =
            validated.field === "notifications"
              ? await boundary.safetyCenter.updateNotificationsEnabled(validated.enabled)
              : await boundary.safetyCenter.updateBackgroundSyncEnabled(validated.enabled);
          return applied ? fedosHostOk(null, requestId) : fedosHostFailure("unavailable", "settings are not wired into this build", requestId);
        }
      }
    } catch {
      return fedosHostFailure("failed", "command failed", requestId);
    }
  }
}

export function createFedosDesktopHostBridge(): FedosDesktopHostBridge {
  return FedosDesktopHostBridge.create();
}
