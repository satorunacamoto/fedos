/**
 * Secure Runtime Alpha 6121–6200 (FedOS Identity Replacement User
 * Verification and Conversation Continuity UI Arc) — Phase M: render
 * models for the inbox, detail (also serves evidence/Peer Device
 * evidence), manual-verification, continuity, and Ratchet reset
 * confirmation screens. Consumes `FedosIdentityTransitionController` ONLY
 * — reads its own `.inboxState`/`.detailState`/etc. getters, calls no
 * action method. No business logic, no rendering framework, no raw
 * signature/protocol byte ever appears in any output here (every field
 * already flowed through the domain's own safe view/screen-model
 * builders before reaching this file).
 */
import type { FedosIdentityTransitionController } from "../../presentation/identity_transition/fedos_identity_transition_controller.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "../fedos_desktop_render_model.js";
import type {
  FedosIdentityTransitionDetailContent,
  FedosIdentityTransitionInboxItem,
  FedosIdentityTransitionRatchetResetConfirmationContent,
} from "../../presentation/identity_transition/fedos_identity_transition_screen_model.js";
import type { FedosIdentityTransitionSessionImpactRowV1 } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_impact_view.js";

export class FedosIdentityTransitionRenderer {
  readonly #controller: FedosIdentityTransitionController;

  constructor(controller: FedosIdentityTransitionController) {
    this.#controller = controller;
  }

  inbox(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosIdentityTransitionInboxItem>> {
    return fedosRenderModel(this.#controller.inboxState, (items) => fedosRenderList(items));
  }

  /** Also serves the Evidence Review / Peer Device Evidence screens — see the Controller's own header for why this is the SAME content, never a second divergent read. Never renders a misleading "verified" state: `acceptanceState` and `evidenceOutcome` are always shown as the two distinct closed fields they are. */
  detail(): FedosDesktopRenderModel<FedosIdentityTransitionDetailContent> {
    return fedosRenderModel(this.#controller.detailState, (content) => content);
  }

  manualVerification(): FedosDesktopRenderModel<"recorded" | "already-present"> {
    return fedosRenderModel(this.#controller.manualVerificationState, (outcome) => outcome);
  }

  continuity(): FedosDesktopRenderModel<number> {
    return fedosRenderModel(this.#controller.continuityState, (revision) => revision);
  }

  ratchetImpact(): FedosDesktopRenderModel<FedosDesktopRenderList<FedosIdentityTransitionSessionImpactRowV1>> {
    return fedosRenderModel(this.#controller.ratchetImpactState, (rows) => fedosRenderList(rows));
  }

  ratchetResetConfirmation(): FedosDesktopRenderModel<FedosIdentityTransitionRatchetResetConfirmationContent> {
    return fedosRenderModel(this.#controller.ratchetResetConfirmationState, (content) => content);
  }
}

export function createFedosIdentityTransitionRenderer(controller: FedosIdentityTransitionController): FedosIdentityTransitionRenderer {
  return new FedosIdentityTransitionRenderer(controller);
}
