/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) — Phase I: render models for the
 * sent-status, received-inbox, and consent-detail screens. Consumes
 * `FedosDeletionRequestController` ONLY — reads its `.sentStatusState`/
 * `.inboxState`/`.consentDetailState` getters, calls no action method. No
 * business logic, no rendering framework.
 */
import type { FedosDeletionRequestController } from "../../presentation/deletion_request/fedos_deletion_request_controller.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "../fedos_desktop_render_model.js";
import type { FedosDeletionRequestSentStatusView, FedosDeletionRequestInboxItem, FedosDeletionRequestConsentDetailContent } from "../../presentation/deletion_request/fedos_deletion_request_screen_model.js";
import { fedosDeletionRequestWarningText } from "../../presentation/deletion_request/fedos_deletion_request_screen_model.js";

export class FedosDeletionRequestRenderer {
  readonly #controller: FedosDeletionRequestController;

  constructor(controller: FedosDeletionRequestController) {
    this.#controller = controller;
  }

  sentStatus(): FedosDesktopRenderModel<FedosDeletionRequestSentStatusView & { readonly warningText: readonly string[] }> {
    return fedosRenderModel(this.#controller.sentStatusState, (view) => Object.freeze({ ...view, warningText: view.warnings.map(fedosDeletionRequestWarningText) }));
  }

  receivedInbox(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosDeletionRequestInboxItem>> {
    return fedosRenderModel(this.#controller.inboxState, (items) => fedosRenderList(items));
  }

  consentDetail(): FedosDesktopRenderModel<FedosDeletionRequestConsentDetailContent & { readonly warningText: readonly string[] }> {
    return fedosRenderModel(this.#controller.consentDetailState, (content) => Object.freeze({ ...content, warningText: content.warnings.map(fedosDeletionRequestWarningText) }));
  }
}

export function createFedosDeletionRequestRenderer(controller: FedosDeletionRequestController): FedosDeletionRequestRenderer {
  return new FedosDeletionRequestRenderer(controller);
}
