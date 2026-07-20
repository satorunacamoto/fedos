/**
 * Secure Runtime Alpha 3241-3320 — Message List ViewModel.
 *
 * Wraps `FedosDesktopApplicationShell.listMessages()` (metadata only, never
 * decrypts — Alpha 1139, unchanged) plus `readMessage()` (the one real
 * decrypt path, Alpha 3081-3160) for revealing a SINGLE message's plaintext
 * on demand. `reveal()` never bulk-decrypts the whole list — a future UI
 * calls it once per message a user actually opens, mirroring
 * `listMessages()`'s own "never decrypts implicitly" discipline one layer
 * up. Revealed messages are merged into the in-memory list by id; nothing
 * is ever written to disk.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosMessageView } from "../shell/fedos_desktop_shell_view_models.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  fedosViewModelError,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopMessageListViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<readonly FedosMessageView[]> = fedosViewModelIdle();
  #conversationId: string | null = null;

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<readonly FedosMessageView[]> {
    return this.#state;
  }

  get conversationId(): string | null {
    return this.#conversationId;
  }

  async load(conversationId: string): Promise<FedosDesktopViewModelState<readonly FedosMessageView[]>> {
    this.#conversationId = conversationId;
    this.#state = fedosViewModelLoading();
    const result = this.#shell.listMessages(conversationId);
    this.#state = fedosViewModelFromShellResult(result);
    return this.#state;
  }

  /**
   * Decrypts ONE message (Alpha 3081-3160's own `readMessage()`) and merges
   * the result into the currently-loaded list by `messageId`. Requires a
   * successful prior `load()` for the SAME conversation — returns an
   * `"error"` state (never throws) otherwise, mirroring the Shell's own
   * fail-closed discipline.
   */
  async reveal(messageId: string): Promise<FedosDesktopViewModelState<readonly FedosMessageView[]>> {
    if (this.#conversationId === null || this.#state.status !== "loaded") {
      this.#state = fedosViewModelError("unavailable", "no conversation is currently loaded");
      return this.#state;
    }
    const result = await this.#shell.readMessage(this.#conversationId, messageId);
    if (result.outcome !== "ok") {
      this.#state = fedosViewModelError(result.outcome, result.reason);
      return this.#state;
    }
    const current = this.#state.data;
    const merged = current.map((m) => (m.messageId === messageId ? result.value : m));
    this.#state = { status: "loaded", data: Object.freeze(merged) };
    return this.#state;
  }
}
