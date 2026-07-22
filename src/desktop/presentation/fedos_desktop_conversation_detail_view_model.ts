/**
 * Secure Runtime Alpha 3241-3320 — Conversation Detail ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.getConversation()` for exactly one
 * conversation id at a time. No new detail-composition logic — the Shell's
 * own `FedosConversationDetailView` already carries creator/readiness/
 * memberships (see `../shell/fedos_desktop_shell_view_models.ts`).
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosConversationDetailView } from "../shell/fedos_desktop_shell_view_models.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopConversationDetailViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<FedosConversationDetailView> = fedosViewModelIdle();
  #conversationId: string | null = null;

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<FedosConversationDetailView> {
    return this.#state;
  }

  /** The conversation id this ViewModel is currently showing, or `null` before the first `load()`. */
  get conversationId(): string | null {
    return this.#conversationId;
  }

  async load(conversationId: string): Promise<FedosDesktopViewModelState<FedosConversationDetailView>> {
    this.#conversationId = conversationId;
    this.#state = fedosViewModelLoading();
    const result = this.#shell.getConversation(conversationId);
    this.#state = fedosViewModelFromShellResult(result);
    return this.#state;
  }
}
