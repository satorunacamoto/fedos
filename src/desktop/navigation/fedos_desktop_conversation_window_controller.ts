/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase B: Conversation Window Controller.
 *
 * Orchestration ONLY — no business logic. Every fact still flows through
 * `FedosDesktopApplicationShell` (via the ViewModels below), exactly as
 * every file under `src/desktop/presentation/`/`src/desktop/renderer/`
 * already requires; this file adds no new authorization rule, no new
 * outcome, no new content shape — it only sequences existing calls and
 * tracks which conversation THIS window is currently pointed at.
 *
 * MULTI-WINDOW SAFETY (see `docs/secure_runtime_alpha_4181_4260_phase_a_navigation_api_inventory.md`
 * "Honest blocker and its resolution"): this Controller owns its OWN
 * `FedosDesktopConversationListViewModel`/`FedosDesktopConversationDetailViewModel`
 * (and matching Renderer-family instances), constructed over the
 * Presentation Boundary's single, shared `.shell` — never a second Shell,
 * never a second Runtime, never a Shell method called directly (every
 * read still goes through the exact same ViewModel classes
 * `FedosDesktopConversationUiPresentationBoundary` itself already uses
 * internally). This is the one deliberate use of `.shell` outside that
 * Boundary's own constructor anywhere in this codebase — necessary
 * because the Boundary's own shared ViewModel instances are last-write-
 * wins across callers, unsafe for two windows viewing two different
 * conversations at once.
 *
 * HARD GUARDRAILS:
 *   - No persistence, no crypto, no transport, no Electron/IPC import of
 *     any kind in this file.
 *   - `render()` reuses `FedosDesktopConversationListRenderer`/
 *     `FedosDesktopConversationDetailRenderer` (Phase D) — never a
 *     duplicated mapping of a ViewModel's own `.state` into a render
 *     shape.
 *   - Every navigation transition goes through exactly one of
 *     `openConversation`/`switchConversation`/`closeConversation`/`back`/
 *     `forward` — no other method mutates `#navigationState`/`#history`
 *     (Phase C "no implicit transitions").
 */

import type { FedosDesktopConversationUiPresentationBoundary } from "../presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { FedosDesktopConversationListViewModel } from "../presentation/fedos_desktop_conversation_list_view_model.js";
import { FedosDesktopConversationDetailViewModel } from "../presentation/fedos_desktop_conversation_detail_view_model.js";
import { FedosDesktopConversationListRenderer } from "../renderer/fedos_desktop_conversation_list_renderer.js";
import { FedosDesktopConversationDetailRenderer } from "../renderer/fedos_desktop_conversation_detail_renderer.js";
import type { FedosDesktopRenderList, FedosDesktopRenderModel } from "../renderer/fedos_desktop_render_model.js";
import type { FedosConversationDetailView, FedosConversationListFilter, FedosConversationSummaryView } from "../shell/fedos_desktop_shell_view_models.js";
import type { FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";
import {
  fedosNavigationEmpty,
  fedosNavigationOpen,
  fedosNavigationOpenFailed,
  fedosNavigationOpening,
  type FedosConversationNavigationState,
} from "./fedos_desktop_conversation_navigation_state.js";
import {
  fedosNavigationHistoryBack,
  fedosNavigationHistoryCanGoBack,
  fedosNavigationHistoryCanGoForward,
  fedosNavigationHistoryEmpty,
  fedosNavigationHistoryForward,
  fedosNavigationHistoryPush,
  type FedosConversationNavigationHistory,
} from "./fedos_desktop_conversation_navigation_history.js";
import { fedosDesktopConversationWindowTitle } from "./fedos_desktop_conversation_window_title.js";

export interface FedosDesktopConversationWindowRenderModel {
  readonly title: string;
  readonly navigationState: FedosConversationNavigationState;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly conversationList: FedosDesktopRenderModel<FedosDesktopRenderList<FedosConversationSummaryView>>;
  readonly conversationDetail: FedosDesktopRenderModel<FedosConversationDetailView>;
}

export class FedosDesktopConversationWindowController {
  readonly #viewerParticipant: FedosConversationParticipantReference;
  readonly #listViewModel: FedosDesktopConversationListViewModel;
  readonly #detailViewModel: FedosDesktopConversationDetailViewModel;
  readonly #listRenderer: FedosDesktopConversationListRenderer;
  readonly #detailRenderer: FedosDesktopConversationDetailRenderer;

  #navigationState: FedosConversationNavigationState = fedosNavigationEmpty();
  #history: FedosConversationNavigationHistory = fedosNavigationHistoryEmpty();
  #lastDetail: FedosConversationDetailView | null = null;

  constructor(boundary: FedosDesktopConversationUiPresentationBoundary, viewerParticipant: FedosConversationParticipantReference) {
    this.#viewerParticipant = viewerParticipant;
    // Own instances over the Boundary's single shared Shell -- see this file's own header, "MULTI-WINDOW SAFETY".
    this.#listViewModel = new FedosDesktopConversationListViewModel(boundary.shell);
    this.#detailViewModel = new FedosDesktopConversationDetailViewModel(boundary.shell);
    this.#listRenderer = new FedosDesktopConversationListRenderer(this.#listViewModel);
    this.#detailRenderer = new FedosDesktopConversationDetailRenderer(this.#detailViewModel);
  }

  get navigationState(): FedosConversationNavigationState {
    return this.#navigationState;
  }

  get history(): FedosConversationNavigationHistory {
    return this.#history;
  }

  get title(): string {
    return fedosDesktopConversationWindowTitle(this.#navigationState, this.#lastDetail, this.#viewerParticipant);
  }

  get canGoBack(): boolean {
    return fedosNavigationHistoryCanGoBack(this.#history);
  }

  get canGoForward(): boolean {
    return fedosNavigationHistoryCanGoForward(this.#history);
  }

  /** Refreshes the conversation list for this window only (its own ViewModel instance — see "MULTI-WINDOW SAFETY"). Never itself a navigation event: does not touch `#navigationState`/`#history`. */
  async loadConversationList(filter?: FedosConversationListFilter): Promise<void> {
    await this.#listViewModel.load(filter);
  }

  /**
   * Opens `conversationId` in this window, from ANY current state
   * (including already-`"open"` on a different id — opening while
   * something else is open is exactly what a user clicking a different
   * list item does). Always records one history entry, whether the load
   * succeeds or fails (a failed attempt is still a real, undoable
   * navigation — see `../navigation/fedos_desktop_conversation_navigation_history.ts`'s
   * own header).
   */
  async openConversation(conversationId: string): Promise<FedosConversationNavigationState> {
    return this.#navigateTo(conversationId, true);
  }

  /**
   * Switches this window from its CURRENTLY open conversation to a
   * different one. Identical mechanics to `openConversation` — this is a
   * distinct, named method (rather than a bare alias) so a caller's own
   * intent ("I am replacing what's shown" vs. "I am showing something for
   * the first time") is explicit at the call site, and so THIS method can
   * enforce its own precondition: throws if this window has nothing open
   * yet (Phase C "no implicit transitions" — there is nothing to switch
   * FROM).
   */
  async switchConversation(conversationId: string): Promise<FedosConversationNavigationState> {
    if (this.#navigationState.kind === "empty") {
      throw new Error("FedosDesktopConversationWindowController.switchConversation: no conversation is currently open in this window; call openConversation() first.");
    }
    return this.#navigateTo(conversationId, true);
  }

  /** Closes whatever is currently open, returning this window to `"empty"`. Records one history entry (closing is a real navigation — `back()` can reopen what was closed). Throws if already `"empty"` (Phase C "no implicit transitions" — closing nothing is not a valid transition). */
  closeConversation(): FedosConversationNavigationState {
    if (this.#navigationState.kind === "empty") {
      throw new Error("FedosDesktopConversationWindowController.closeConversation: this window has no conversation open.");
    }
    this.#history = fedosNavigationHistoryPush(this.#history, null);
    this.#lastDetail = null;
    this.#navigationState = fedosNavigationEmpty();
    return this.#navigationState;
  }

  /** `false` (no-op, state unchanged) when there is nothing to go back to; otherwise navigates to the previous history entry (re-loading real content for a non-null target) and returns `true`. */
  async back(): Promise<boolean> {
    const popped = fedosNavigationHistoryBack(this.#history);
    if (popped === null) return false;
    this.#history = popped;
    await this.#applyTargetFromHistory(popped.current);
    return true;
  }

  /** `false` (no-op) when there is nothing to go forward to; otherwise the mirror image of `back()`. */
  async forward(): Promise<boolean> {
    const popped = fedosNavigationHistoryForward(this.#history);
    if (popped === null) return false;
    this.#history = popped;
    await this.#applyTargetFromHistory(popped.current);
    return true;
  }

  /**
   * A fresh window's own startup navigation, given whatever conversation
   * id (if any) a `FedosDesktopConversationWindowRegistry` restored from
   * `AppendOnlyFedosDesktopNavigationPersistence`'s own last-opened
   * record (Phase C "last-opened restoration"). `null` leaves this window
   * `"empty"` (no restore target) without recording a spurious history
   * entry.
   */
  async restoreLastOpened(conversationId: string | null): Promise<FedosConversationNavigationState> {
    if (conversationId === null) return this.#navigationState;
    return this.openConversation(conversationId);
  }

  /** The FULL current render model for this window — every renderer's own `render()` output for THIS window's own ViewModel instances, plus navigation-only fields no content Renderer knows about. Mirrors `FedosDesktopHostBridge.render()`'s own aggregation shape (Phase D "reuse existing Renderer"). */
  render(): FedosDesktopConversationWindowRenderModel {
    return Object.freeze({
      title: this.title,
      navigationState: this.#navigationState,
      canGoBack: this.canGoBack,
      canGoForward: this.canGoForward,
      conversationList: this.#listRenderer.render(),
      conversationDetail: this.#detailRenderer.render(),
    });
  }

  async #navigateTo(conversationId: string, recordHistory: boolean): Promise<FedosConversationNavigationState> {
    this.#navigationState = fedosNavigationOpening(conversationId);
    const state = await this.#detailViewModel.load(conversationId);
    if (state.status === "loaded") {
      this.#lastDetail = state.data;
      this.#navigationState = fedosNavigationOpen(conversationId);
    } else {
      this.#lastDetail = null;
      const outcome = state.status === "error" ? state.outcome : "unavailable";
      const reason = state.status === "error" ? state.reason : `ViewModel action did not settle (status: ${state.status})`;
      this.#navigationState = fedosNavigationOpenFailed(conversationId, outcome, reason);
    }
    if (recordHistory) {
      this.#history = fedosNavigationHistoryPush(this.#history, conversationId);
    }
    return this.#navigationState;
  }

  /** `back()`/`forward()`'s own shared tail — history is ALREADY updated by the caller before this runs; this only re-derives `#navigationState`/`#lastDetail` for the (already-known) target, never pushing a further history entry. */
  async #applyTargetFromHistory(conversationId: string | null): Promise<void> {
    if (conversationId === null) {
      this.#lastDetail = null;
      this.#navigationState = fedosNavigationEmpty();
      return;
    }
    await this.#navigateTo(conversationId, false);
  }
}
