/**
 * Secure Runtime Alpha 3241-3320 — Search ViewModel.
 *
 * Holds the current query text locally (in memory only) and delegates the
 * actual search entirely to `FedosDesktopApplicationShell.search()` (Alpha
 * 3081-3160) -- no keyword matching, ranking, or retention logic of any
 * kind is duplicated here; every hit already comes from the real,
 * retention-gated `FedosConversationSearchIndex`.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosContentAccessorSearchHit } from "../content_accessor/fedos_desktop_conversation_content_accessor_result.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopSearchViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #query = "";
  #state: FedosDesktopViewModelState<readonly FedosContentAccessorSearchHit[]> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get query(): string {
    return this.#query;
  }

  setQuery(query: string): void {
    this.#query = query;
  }

  get state(): FedosDesktopViewModelState<readonly FedosContentAccessorSearchHit[]> {
    return this.#state;
  }

  /** Searches using the CURRENT query -- call `setQuery()` first. Synchronous underneath; `async` only for this directory's own uniform contract. */
  async search(): Promise<FedosDesktopViewModelState<readonly FedosContentAccessorSearchHit[]>> {
    this.#state = fedosViewModelLoading();
    const result = this.#shell.search(this.#query);
    this.#state = fedosViewModelFromShellResult(result);
    return this.#state;
  }
}
