/**
 * Secure Runtime Alpha 3401-3480 — Error Renderer.
 *
 * The ONE shared place every other Renderer in this directory delegates its
 * own `"error"` branch to (via `fedosRenderModel()`,
 * `./fedos_desktop_render_model.ts`) — this file exists as its OWN
 * directly-testable, standalone unit because this Arc's own required
 * renderer list names it separately. `render()` is a pure, static
 * projection: `null` for any non-error state (a Renderer asking "is this an
 * error, and if so what does it look like" gets a clean, unambiguous
 * answer), the exact `outcome`/`reason` the ViewModel's own Shell call
 * already produced otherwise — never a re-derived or generic message.
 */

import type { FedosDesktopViewModelState } from "../presentation/fedos_desktop_view_model_state.js";

export interface FedosDesktopErrorRenderModel {
  readonly outcome: string;
  readonly message: string;
}

export class FedosDesktopErrorRenderer {
  /** `null` when `state.status !== "error"`. */
  static render<T>(state: FedosDesktopViewModelState<T>): FedosDesktopErrorRenderModel | null {
    if (state.status !== "error") return null;
    return Object.freeze({ outcome: state.outcome, message: state.reason });
  }
}
