/**
 * Secure Runtime Alpha 3401-3480 — Loading Renderer.
 *
 * Mirrors `FedosDesktopErrorRenderer`'s own shape and rationale exactly,
 * for the `"loading"` branch — the ONE shared place every other Renderer
 * delegates to (via `fedosRenderModel()`), plus its own standalone,
 * directly-testable unit.
 */

import type { FedosDesktopViewModelState } from "../presentation/fedos_desktop_view_model_state.js";

export class FedosDesktopLoadingRenderer {
  /** `true` iff `state.status === "loading"` — a future UI's ONE question ("should I show a spinner / disable this button right now") answered without it ever inspecting a ViewModel's own state shape directly. */
  static isLoading<T>(state: FedosDesktopViewModelState<T>): boolean {
    return state.status === "loading";
  }
}
