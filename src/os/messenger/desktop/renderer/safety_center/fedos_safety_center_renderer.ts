/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase J: the ONE Safety Center Renderer. Reads
 * ONLY the Controller's own getters, never invokes an action, never
 * imports a rendering framework — mirrors every other `*_renderer.ts` file
 * under `src/desktop/renderer/` exactly.
 */
import type { FedosSafetyCenterController } from "../../presentation/safety_center/fedos_safety_center_controller.js";
import { fedosRenderModel, type FedosDesktopRenderModel } from "../fedos_desktop_render_model.js";
import type { FedosSafetyCenterOverviewContent } from "../../presentation/safety_center/fedos_safety_center_screen_model.js";
import type { FedosSafetyCenterConfirmationContent } from "../../presentation/safety_center/fedos_safety_center_screen_model.js";
import type { FedosSafetyCenterEventV1 } from "../../presentation/safety_center/fedos_safety_center_event_timeline.js";

export class FedosSafetyCenterRenderer {
  readonly #controller: FedosSafetyCenterController;

  constructor(controller: FedosSafetyCenterController) {
    this.#controller = controller;
  }

  overview(): FedosDesktopRenderModel<FedosSafetyCenterOverviewContent> {
    return fedosRenderModel(this.#controller.overviewState, (data) => data);
  }

  events(): FedosDesktopRenderModel<readonly FedosSafetyCenterEventV1[]> {
    return fedosRenderModel(this.#controller.eventsState, (data) => data);
  }

  confirmation(): FedosDesktopRenderModel<FedosSafetyCenterConfirmationContent> {
    return fedosRenderModel(this.#controller.confirmationState, (data) => data);
  }
}
