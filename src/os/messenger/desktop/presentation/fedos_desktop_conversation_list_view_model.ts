/**
 * Secure Runtime Alpha 3241-3320 — Conversation List ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.listConversations()` — no new
 * filtering/sorting logic of any kind is added here (the Shell's own
 * `listConversations()` already sorts deterministically and applies the
 * filter); this file only shapes that ONE call's result into a
 * `FedosDesktopViewModelState` a future UI can render loading/error/loaded
 * branches from.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosConversationListFilter, FedosConversationSummaryView } from "../shell/fedos_desktop_shell_view_models.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopConversationListViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<readonly FedosConversationSummaryView[]> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<readonly FedosConversationSummaryView[]> {
    return this.#state;
  }

  /** Re-reads the current conversation list from the Shell, optionally filtered. Synchronous underneath (the Shell call itself is sync); `async` only for a uniform contract across every ViewModel in this directory. */
  async load(filter?: FedosConversationListFilter): Promise<FedosDesktopViewModelState<readonly FedosConversationSummaryView[]>> {
    this.#state = fedosViewModelLoading();
    const result = this.#shell.listConversations(filter);
    this.#state = fedosViewModelFromShellResult(result);
    return this.#state;
  }
}
