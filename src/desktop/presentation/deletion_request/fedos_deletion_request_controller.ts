/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) — Phases C/D/E/H: the ONE Deletion
 * Request controller. Owns navigation state (Phase J) and composes the
 * EXISTING `FedosDesktopApplicationShell` deletion-request methods (`5881-5960`
 * facade underneath) with this Arc's own pure aggregation/screen-model
 * builders. Calls NOTHING beyond the Shell's own already-public methods —
 * never `conversationRuntime()`/`deletionRequest()` directly, never a
 * persistence port, crypto authority, or secret.
 */
import type { FedosDesktopApplicationShell } from "../../shell/fedos_desktop_application_shell.js";
import type { FedosDeletionRequestCreateParams } from "../../../conversation/deletion_request/fedos_deletion_request_outbound_coordinator.js";
import type { FedosDeletionRecipientPolicy } from "../../../conversation/deletion_request/fedos_deletion_recipient_policy.js";
import { fedosViewModelIdle, fedosViewModelLoading, fedosViewModelLoaded, fedosViewModelError, fedosViewModelFromShellResult, type FedosDesktopViewModelState } from "../fedos_desktop_view_model_state.js";
import { FedosDeletionRequestNavigationState, type FedosDeletionRequestScreen } from "./fedos_deletion_request_navigation_state.js";
import { fedosDeletionRequestDeviceStatus, fedosDeletionRequestAggregateAccountStatus, type FedosDeletionRequestPerDeviceRow, type FedosDeletionRequestDeviceTrustFact } from "./fedos_deletion_request_device_status.js";
import {
  fedosDeletionRequestBuildSentStatusView,
  fedosDeletionRequestBuildInboxItem,
  fedosDeletionRequestSortInboxItems,
  fedosDeletionRequestTruncateInboxItems,
  fedosDeletionRequestBuildConsentDetail,
  type FedosDeletionRequestSentStatusView,
  type FedosDeletionRequestInboxItem,
  type FedosDeletionRequestConsentDetailContent,
} from "./fedos_deletion_request_screen_model.js";
// Secure Runtime Alpha 6041-6120 -- Phase K: Notification integration, over
// the EXISTING `FedosDesktopNotificationCoordinator` (`4261-4340`,
// unmodified) -- this Controller never sends anything itself, and every
// notification carries only the closed, fixed-template kind + an opaque
// `targetConversationId` + a bounded, policy-checked `detail` string, never
// message plaintext or a requester identity.
import { FedosDesktopNotificationCoordinator } from "../../notification/fedos_desktop_notification_coordinator.js";
import { NoopFedosDesktopNotificationPort, type FedosDesktopNotificationPort } from "../../notification/fedos_desktop_notification_port.js";

export class FedosDeletionRequestController {
  readonly navigation = new FedosDeletionRequestNavigationState();
  readonly #shell: FedosDesktopApplicationShell;

  #sentStatusState: FedosDesktopViewModelState<FedosDeletionRequestSentStatusView> = fedosViewModelIdle();
  #inboxState: FedosDesktopViewModelState<readonly FedosDeletionRequestInboxItem[]> = fedosViewModelIdle();
  #consentDetailState: FedosDesktopViewModelState<FedosDeletionRequestConsentDetailContent> = fedosViewModelIdle();
  #createState: FedosDesktopViewModelState<{ readonly requestId: string }> = fedosViewModelIdle();
  #actionInFlight = false;
  #notificationCoordinator: FedosDesktopNotificationCoordinator;
  /** Restart-non-durable, in-memory only -- which requestIds this process has already raised a `"deletion-request-received"` notification for, so a repeated `refreshReceivedInbox()` call never re-notifies for the SAME item. */
  readonly #notifiedRequestIds = new Set<string>();

  constructor(shell: FedosDesktopApplicationShell, notificationPort: FedosDesktopNotificationPort = new NoopFedosDesktopNotificationPort()) {
    this.#shell = shell;
    this.#notificationCoordinator = new FedosDesktopNotificationCoordinator(notificationPort);
  }

  /** Swaps in a real notification backend (e.g. a real Electron `Notification` port) after construction -- mirrors this codebase's own "always a safe Noop default, real backend injected once available" convention. Never creates a second, parallel notification subsystem. */
  setNotificationPort(port: FedosDesktopNotificationPort): void {
    this.#notificationCoordinator = new FedosDesktopNotificationCoordinator(port);
  }

  get notificationCoordinator(): FedosDesktopNotificationCoordinator {
    return this.#notificationCoordinator;
  }

  // ---------------------------------------------------------------------
  // Phase E — sender side: create + per-target status.
  // ---------------------------------------------------------------------

  get createState(): FedosDesktopViewModelState<{ readonly requestId: string }> {
    return this.#createState;
  }

  async createRequest(params: FedosDeletionRequestCreateParams): Promise<void> {
    this.#createState = fedosViewModelLoading();
    this.#createState = fedosViewModelFromShellResult(await this.#shell.deletionRequestCreate(params));
  }

  get sentStatusState(): FedosDesktopViewModelState<FedosDeletionRequestSentStatusView> {
    return this.#sentStatusState;
  }

  /** Builds the full per-Device aggregate for one target message — every Device this local sender's own real Registry currently knows about, cross-referenced with every real request/acknowledgement fact on file. */
  async refreshSentStatus(conversationId: string, targetEnvelopeId: string, knownDeviceIds: readonly string[]): Promise<void> {
    this.#sentStatusState = fedosViewModelLoading();
    const sentResult = this.#shell.deletionRequestListSentForTarget(conversationId, targetEnvelopeId);
    if (sentResult.outcome !== "ok") {
      this.#sentStatusState = fedosViewModelError(sentResult.outcome, sentResult.reason);
      return;
    }
    const byDevice = new Map(sentResult.value.filter((r) => r.recipientDeviceRef !== null).map((r) => [r.recipientDeviceRef as string, r]));
    const rows: FedosDeletionRequestPerDeviceRow[] = [];
    for (const deviceId of knownDeviceIds) {
      const request = byDevice.get(deviceId) ?? null;
      const trustFact = this.#deviceTrustFact(deviceId);
      const ackOutcome = request === null ? null : this.#ackOutcomeFor(request.requestId);
      rows.push({ deviceId, status: fedosDeletionRequestDeviceStatus(request, ackOutcome, trustFact), requestId: request?.requestId ?? null });
    }
    const aggregate = fedosDeletionRequestAggregateAccountStatus(rows);
    this.#sentStatusState = fedosViewModelLoaded(fedosDeletionRequestBuildSentStatusView(conversationId, targetEnvelopeId, rows, aggregate));
  }

  #ackOutcomeFor(requestId: string) {
    const result = this.#shell.deletionRequestAcknowledgementOutcome(requestId);
    return result.outcome === "ok" ? result.value : null;
  }

  #deviceTrustFact(deviceId: string): FedosDeletionRequestDeviceTrustFact {
    const result = this.#shell.deviceDetail(deviceId);
    if (result.outcome !== "ok") return "not-in-registry";
    return result.value.trustState;
  }

  // ---------------------------------------------------------------------
  // Phase D — recipient side: Inbox.
  // ---------------------------------------------------------------------

  get inboxState(): FedosDesktopViewModelState<readonly FedosDeletionRequestInboxItem[]> {
    return this.#inboxState;
  }

  async openReceivedInbox(): Promise<void> {
    this.navigation.goto("received-inbox");
    await this.refreshReceivedInbox();
  }

  async refreshReceivedInbox(): Promise<void> {
    this.#inboxState = fedosViewModelLoading();
    const result = this.#shell.deletionRequestListReceived();
    if (result.outcome !== "ok") {
      this.#inboxState = fedosViewModelError(result.outcome, result.reason);
      return;
    }
    const items = result.value.map(({ summary, decisionState }) => fedosDeletionRequestBuildInboxItem(summary, decisionState));
    const sorted = fedosDeletionRequestSortInboxItems(items);
    const { items: truncated } = fedosDeletionRequestTruncateInboxItems(sorted);
    this.#inboxState = fedosViewModelLoaded(truncated);
    await this.#notifyNewInboxItems(truncated);
  }

  /** Phase K — fires `"deletion-request-received"`/`"deletion-request-expired"` for any item this process has not already notified about. In-memory-only tracking (`#notifiedRequestIds`) -- never re-notifies for the same requestId within one process lifetime; a restart may re-notify once, which is safe (never a duplicate DELETION, only a duplicate coarse signal). */
  async #notifyNewInboxItems(items: readonly FedosDeletionRequestInboxItem[]): Promise<void> {
    for (const item of items) {
      if (this.#notifiedRequestIds.has(item.requestId)) continue;
      this.#notifiedRequestIds.add(item.requestId);
      if (item.displayStatus === "pending-review") {
        await this.#notificationCoordinator.notify({ kind: "deletion-request-received", targetConversationId: item.conversationId });
      } else if (item.displayStatus === "expired") {
        await this.#notificationCoordinator.notify({ kind: "deletion-request-expired", targetConversationId: item.conversationId });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Phase E/K — sender side: explicit notification triggers. The Sender
  // Status model (`refreshSentStatus()`, above) is this Arc's own read
  // path; a caller that independently detects a real status change (e.g.
  // after a real `deletionRequestAcknowledgementOutcome()` read) may
  // explicitly raise the matching safe signal — never automatic, never
  // polling, never message content.
  // ---------------------------------------------------------------------

  async notifyRecipientResponded(conversationId: string): Promise<void> {
    await this.#notificationCoordinator.notify({ kind: "deletion-request-responded", targetConversationId: conversationId });
  }

  async notifySomeDevicesPending(conversationId: string, pendingCount: number): Promise<void> {
    await this.#notificationCoordinator.notify({ kind: "deletion-request-pending-devices", targetConversationId: conversationId, detail: `${pendingCount} device(s) pending` });
  }

  async notifyPartiallyApplied(conversationId: string): Promise<void> {
    await this.#notificationCoordinator.notify({ kind: "deletion-request-partial", targetConversationId: conversationId });
  }

  // ---------------------------------------------------------------------
  // Phase C — recipient side: consent detail + actions.
  // ---------------------------------------------------------------------

  get consentDetailState(): FedosDesktopViewModelState<FedosDeletionRequestConsentDetailContent> {
    return this.#consentDetailState;
  }

  /** Opening a detail item performs NO deletion — a pure, read-only render of already-durable facts (mission's own explicit "no request may execute solely because the UI opened it" requirement). */
  async openReceivedRequest(requestId: string, policy: FedosDeletionRecipientPolicy): Promise<void> {
    this.navigation.selectRequest(requestId, "consent-detail");
    this.#consentDetailState = fedosViewModelLoading();
    const listResult = this.#shell.deletionRequestListReceived();
    if (listResult.outcome !== "ok") {
      this.#consentDetailState = fedosViewModelError(listResult.outcome, listResult.reason);
      return;
    }
    const found = listResult.value.find((r) => r.summary.requestId === requestId);
    if (found === undefined) {
      this.#consentDetailState = fedosViewModelError("not-found", "selected request id is stale or unknown");
      return;
    }
    const decisionState = found.decisionState ?? "received";
    const policyDecision = decisionState === "policy-pending" ? this.#assessPolicy(policy, found.summary.scope) : null;
    this.#consentDetailState = fedosViewModelLoaded(fedosDeletionRequestBuildConsentDetail(found.summary, decisionState, policyDecision));
  }

  #assessPolicy(policy: FedosDeletionRecipientPolicy, scope: Parameters<FedosDesktopApplicationShell["deletionRequestAssessPolicy"]>[1]) {
    const result = this.#shell.deletionRequestAssessPolicy(policy, scope);
    return result.outcome === "ok" ? result.value : null;
  }

  /** Duplicate submission is prevented — a second call while one is already in flight is a silent no-op, mirroring `FedosDeviceManagementController`'s own established discipline. */
  async approveSelected(): Promise<void> {
    if (this.#actionInFlight) return;
    const requestId = this.navigation.selectedRequestId;
    if (requestId === null) return;
    this.#actionInFlight = true;
    try {
      await this.#shell.deletionRequestApprove(requestId);
      await this.refreshReceivedInbox();
    } finally {
      this.#actionInFlight = false;
    }
  }

  async rejectSelected(): Promise<void> {
    if (this.#actionInFlight) return;
    const requestId = this.navigation.selectedRequestId;
    if (requestId === null) return;
    this.#actionInFlight = true;
    try {
      await this.#shell.deletionRequestReject(requestId);
      await this.refreshReceivedInbox();
    } finally {
      this.#actionInFlight = false;
    }
  }

  /** Clears a terminal item from view (local presentation state only — the durable decision record itself is never deleted). */
  dismiss(requestId: string): void {
    if (this.navigation.selectedRequestId === requestId) this.navigation.clearSelection();
  }

  goBack(): boolean {
    return this.navigation.goBack();
  }

  goto(screen: FedosDeletionRequestScreen): boolean {
    return this.navigation.goto(screen);
  }
}
