/**
 * Secure Runtime Alpha 3401-3480 ("Desktop UI Renderer Boundary").
 *
 * `FedosDesktopRenderModel<T>` is the ONE shared, closed render-output shape
 * every Renderer in `src/desktop/renderer/` returns — a pure, plain-data
 * PROJECTION of a ViewModel's own `FedosDesktopViewModelState<T>`
 * (`../presentation/fedos_desktop_view_model_state.ts`), never a second,
 * divergent state machine. `"idle"`/`"loading"`/`"error"` map straight
 * through unchanged; `"loaded"` becomes `"content"`, carrying whatever
 * renderer-specific, already-presentation-ready shape that renderer's own
 * `mapContent` callback produces (e.g. `{ items, count, isEmpty }` for a
 * list-shaped ViewModel).
 *
 * This file, and every file under `src/desktop/renderer/`, owns:
 *   - NO business logic — every `"error"`/`"loading"`/`"idle"` branch is
 *     read STRAIGHT from the ViewModel's own current `.state`, never
 *     re-derived or re-validated.
 *   - NO Runtime, NO Shell call, NO persistence, NO crypto — a Renderer
 *     reads ONLY the public getters (`.state`, `.query`, `.body`, etc.) a
 *     ViewModel already exposes; it never calls a ViewModel's own action
 *     method (`.load()`/`.send()`/`.search()`/...) itself. Producing DATA
 *     to feed an eventual concrete UI is this layer's entire job; DRIVING
 *     the ViewModel is the future UI's own job, one layer further out.
 *   - NO rendering framework, NO HTML/CSS/DOM, NO browser global — a
 *     `FedosDesktopRenderModel` is plain, JSON-serializable data.
 */

import type { FedosDesktopViewModelState } from "../presentation/fedos_desktop_view_model_state.js";

export type FedosDesktopRenderModel<T> =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly outcome: string; readonly message: string }
  | { readonly kind: "content"; readonly content: T };

/**
 * The ONE shared state->render-model projection every content Renderer in
 * this directory composes — centralizes the idle/loading/error branches
 * (mirrors what `FedosDesktopErrorRenderer`/`FedosDesktopLoadingRenderer`,
 * this Arc's own two required shared renderers, individually expose) so no
 * renderer file re-implements that mapping on its own.
 */
export function fedosRenderModel<T, R>(
  state: FedosDesktopViewModelState<T>,
  mapContent: (data: T) => R,
): FedosDesktopRenderModel<R> {
  switch (state.status) {
    case "idle":
      return Object.freeze({ kind: "idle" });
    case "loading":
      return Object.freeze({ kind: "loading" });
    case "error":
      return Object.freeze({ kind: "error", outcome: state.outcome, message: state.reason });
    case "loaded":
      return Object.freeze({ kind: "content", content: mapContent(state.data) });
  }
}

/** Shared shape every LIST-like content renderer (Conversation List, Message, Search) produces for its own `content` — distinguishes "loaded but empty" from "loaded with items" as DATA (`isEmpty`/`count`), never a separate top-level render `kind` (an empty list is still real, successfully-loaded content, not an error or an absence). */
export interface FedosDesktopRenderList<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly isEmpty: boolean;
}

export function fedosRenderList<T>(items: readonly T[]): FedosDesktopRenderList<T> {
  return Object.freeze({ items, count: items.length, isEmpty: items.length === 0 });
}
