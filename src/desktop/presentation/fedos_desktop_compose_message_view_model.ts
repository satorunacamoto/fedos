/**
 * Secure Runtime Alpha 3241-3320 — Compose Message ViewModel.
 *
 * Holds exactly one thing locally, in memory only, never persisted: the
 * draft body text a future UI is currently editing for one conversation.
 * `send()` delegates the actual write entirely to
 * `FedosDesktopApplicationShell.sendMessage()` (Alpha 3081-3160) — this
 * file invents no authorization, activation, or encryption logic of its
 * own; `sendMessage()` itself already resolves/validates all of that.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosMessageSendResultView } from "../shell/fedos_desktop_shell_view_models.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  fedosViewModelError,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopComposeMessageViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #body = "";
  #state: FedosDesktopViewModelState<FedosMessageSendResultView> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  /** The draft body text currently being composed — local, in-memory presentation state only. */
  get body(): string {
    return this.#body;
  }

  setBody(body: string): void {
    this.#body = body;
  }

  get state(): FedosDesktopViewModelState<FedosMessageSendResultView> {
    return this.#state;
  }

  /** Sends the current draft as a NEW (non-reply) message. Clears the draft only on a real `"ok"` result -- a failed/error send leaves the draft intact so the user does not lose their text. */
  async send(conversationId: string, sender: FedosConversationParticipantReference): Promise<FedosDesktopViewModelState<FedosMessageSendResultView>> {
    if (this.#body.length === 0) {
      this.#state = fedosViewModelError("invalid-input", "message body must be non-empty");
      return this.#state;
    }
    this.#state = fedosViewModelLoading();
    const result = await this.#shell.sendMessage(conversationId, sender, this.#body);
    this.#state = fedosViewModelFromShellResult(result);
    if (result.outcome === "ok") this.#body = "";
    return this.#state;
  }
}
