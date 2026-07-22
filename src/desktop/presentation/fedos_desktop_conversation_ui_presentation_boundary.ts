/**
 * Secure Runtime Alpha 3241-3320 ("Desktop Local Conversation Management UI
 * Prototype Arc") — the named top-level deliverable.
 *
 * `FedosDesktopConversationUiPresentationBoundary` is a pure TypeScript
 * presentation boundary a future UI (of ANY kind -- CLI, Electron, a native
 * shell, a test harness) consumes instead of constructing the ten
 * ViewModels in this directory by hand. It owns exactly one
 * `FedosDesktopApplicationShell` instance and constructs exactly one of
 * each ViewModel over it — never a second, divergent Shell.
 *
 * HARD GUARDRAILS (this Arc's own, restated from the ten ViewModel files
 * this class composes):
 *   - No persistence, no crypto, no transport of any kind lives here or in
 *     any file under `src/desktop/presentation/` — every fact and every
 *     mutation is delegated to `FedosDesktopApplicationShell`.
 *   - No rendering framework (Electron/React/Vue/Svelte/Tauri), no HTML, no
 *     CSS, no browser global.
 *   - No duplicate business logic — every ViewModel method is a thin call
 *     into the Shell plus state-shape bookkeeping.
 */

import { createFedosDesktopApplicationShell, type FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import { FedosDesktopConversationListViewModel } from "./fedos_desktop_conversation_list_view_model.js";
import { FedosDesktopConversationDetailViewModel } from "./fedos_desktop_conversation_detail_view_model.js";
import { FedosDesktopMessageListViewModel } from "./fedos_desktop_message_list_view_model.js";
import { FedosDesktopComposeMessageViewModel } from "./fedos_desktop_compose_message_view_model.js";
import { FedosDesktopReplyViewModel } from "./fedos_desktop_reply_view_model.js";
import { FedosDesktopSearchViewModel } from "./fedos_desktop_search_view_model.js";
import { FedosDesktopArchiveViewModel } from "./fedos_desktop_archive_view_model.js";
import { FedosDesktopMembershipViewModel } from "./fedos_desktop_membership_view_model.js";
import { FedosDesktopUnreadCounterViewModel } from "./fedos_desktop_unread_counter_view_model.js";
import { FedosDesktopRuntimeStatusViewModel } from "./fedos_desktop_runtime_status_view_model.js";
// Secure Runtime Alpha 3801-3880 (Device Sync Operational Status and Desktop
// Shell Integration Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring this file's own established pattern above.
import { FedosDesktopDeviceInventoryViewModel } from "./fedos_desktop_device_inventory_view_model.js";
import { FedosDesktopDeviceSyncStatusViewModel } from "./fedos_desktop_device_sync_status_view_model.js";
import { FedosDesktopSyncScheduleViewModel } from "./fedos_desktop_sync_schedule_view_model.js";
import { FedosDesktopTransferSessionViewModel } from "./fedos_desktop_transfer_session_view_model.js";
import { FedosDesktopSyncConflictViewModel } from "./fedos_desktop_sync_conflict_view_model.js";
// Secure Runtime Alpha 3941-4020 (Desktop Device Management and Sync
// Operations UI Renderer Arc) -- every import/addition below this comment
// is ADDITIVE ONLY, mirroring this file's own established pattern above.
import { FedosDeviceManagementController } from "./device_management/fedos_device_management_controller.js";
// Secure Runtime Alpha 4581-4660 (Desktop Device Registration, Pairing, and
// Durable Sync Journal Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring this file's own established pattern above.
import { FedosDesktopDevicePairingViewModel } from "./fedos_desktop_device_pairing_view_model.js";
// Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
// Aggregation and User Consent UI Arc) -- every import/addition below this
// comment is ADDITIVE ONLY, mirroring this file's own established pattern.
import { FedosDeletionRequestController } from "./deletion_request/fedos_deletion_request_controller.js";
// Secure Runtime Alpha 6121-6200 (FedOS Identity Replacement User
// Verification and Conversation Continuity UI Arc) -- additive only,
// mirroring this file's own established pattern.
import { FedosIdentityTransitionController } from "./identity_transition/fedos_identity_transition_controller.js";
// Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
// Safety Center Arc) -- additive only, mirroring this file's own
// established pattern.
import { FedosSafetyCenterController } from "./safety_center/fedos_safety_center_controller.js";

export class FedosDesktopConversationUiPresentationBoundary {
  readonly #shell: FedosDesktopApplicationShell;
  readonly conversationList: FedosDesktopConversationListViewModel;
  readonly conversationDetail: FedosDesktopConversationDetailViewModel;
  readonly messageList: FedosDesktopMessageListViewModel;
  readonly composeMessage: FedosDesktopComposeMessageViewModel;
  readonly reply: FedosDesktopReplyViewModel;
  readonly search: FedosDesktopSearchViewModel;
  readonly archive: FedosDesktopArchiveViewModel;
  readonly membership: FedosDesktopMembershipViewModel;
  readonly unreadCounter: FedosDesktopUnreadCounterViewModel;
  readonly runtimeStatus: FedosDesktopRuntimeStatusViewModel;
  readonly deviceInventory: FedosDesktopDeviceInventoryViewModel;
  readonly deviceSyncStatus: FedosDesktopDeviceSyncStatusViewModel;
  readonly syncSchedule: FedosDesktopSyncScheduleViewModel;
  readonly transferSession: FedosDesktopTransferSessionViewModel;
  readonly syncConflict: FedosDesktopSyncConflictViewModel;
  readonly devicePairing: FedosDesktopDevicePairingViewModel;
  readonly deviceManagement: FedosDeviceManagementController;
  readonly deletionRequests: FedosDeletionRequestController;
  readonly identityTransitions: FedosIdentityTransitionController;
  readonly safetyCenter: FedosSafetyCenterController;

  private constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
    this.conversationList = new FedosDesktopConversationListViewModel(shell);
    this.conversationDetail = new FedosDesktopConversationDetailViewModel(shell);
    this.messageList = new FedosDesktopMessageListViewModel(shell);
    this.composeMessage = new FedosDesktopComposeMessageViewModel(shell);
    this.reply = new FedosDesktopReplyViewModel(shell);
    this.search = new FedosDesktopSearchViewModel(shell);
    this.archive = new FedosDesktopArchiveViewModel(shell);
    this.membership = new FedosDesktopMembershipViewModel(shell);
    this.unreadCounter = new FedosDesktopUnreadCounterViewModel(shell);
    this.runtimeStatus = new FedosDesktopRuntimeStatusViewModel(shell);
    this.deviceInventory = new FedosDesktopDeviceInventoryViewModel(shell);
    this.deviceSyncStatus = new FedosDesktopDeviceSyncStatusViewModel(shell);
    this.syncSchedule = new FedosDesktopSyncScheduleViewModel(shell);
    this.transferSession = new FedosDesktopTransferSessionViewModel(shell);
    this.syncConflict = new FedosDesktopSyncConflictViewModel(shell);
    this.devicePairing = new FedosDesktopDevicePairingViewModel(shell);
    this.deviceManagement = new FedosDeviceManagementController(this);
    this.deletionRequests = new FedosDeletionRequestController(shell);
    this.identityTransitions = new FedosIdentityTransitionController(shell);
    this.safetyCenter = new FedosSafetyCenterController(shell);
  }

  /** Thin factory — mirrors `createFedosDesktopApplicationShell()`'s own style. No side effect (no Runtime started) until `runtimeStatus.start()` is called. */
  static create(): FedosDesktopConversationUiPresentationBoundary {
    return new FedosDesktopConversationUiPresentationBoundary(createFedosDesktopApplicationShell());
  }

  /**
   * Secure Runtime Alpha 5061-5160 (FedOS Desktop Beta 0.1 Integration Arc) —
   * additive Phase C factory. Wraps an ALREADY-STARTED `FedosDesktopApplicationShell`
   * (typically one built via `FedosDesktopApplicationShell.fromRunningRuntime()`)
   * instead of constructing a fresh, unstarted one. Composes the SAME ten+
   * ViewModels over it as `create()` does — never a second, divergent Shell.
   * See `FedosDesktopApplicationShell.fromRunningRuntime()`'s own header for why
   * this exists (the single-Runtime composition gap this Arc closes).
   */
  static fromShell(shell: FedosDesktopApplicationShell): FedosDesktopConversationUiPresentationBoundary {
    return new FedosDesktopConversationUiPresentationBoundary(shell);
  }

  /** Never exposed to a future UI beyond this file's own constructor use -- present only so tests can assert every ViewModel shares the identical Shell instance. */
  get shell(): FedosDesktopApplicationShell {
    return this.#shell;
  }
}

export function createFedosDesktopConversationUiPresentationBoundary(): FedosDesktopConversationUiPresentationBoundary {
  return FedosDesktopConversationUiPresentationBoundary.create();
}
