/**
 * Secure Runtime Alpha 3241-3320 — Reply ViewModel.
 *
 * Identical shape to `FedosDesktopComposeMessageViewModel` plus the ONE
 * additional field a reply needs: `replyToMessageId`. Delegates entirely to
 * `FedosDesktopApplicationShell.reply()` (Alpha 3081-3160) -- this file
 * invents no reply-target validation of its own (`reply()` itself already
 * rejects an empty `replyToMessageId` and verifies, deeper in the Content
 * Accessor, that the target belongs to the same conversation).
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosConversationParticipantReference } from "../../conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosMessageSendResultView } from "../shell/fedos_desktop_shell_view_models.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  fedosViewModelError,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopReplyViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #body = "";
  #replyToMessageId: string | null = null;
  #state: FedosDesktopViewModelState<FedosMessageSendResultView> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get body(): string {
    return this.#body;
  }

  setBody(body: string): void {
    this.#body = body;
  }

  /** The message this draft is currently replying to, or `null` before `startReplyTo()` is called. */
  get replyToMessageId(): string | null {
    return this.#replyToMessageId;
  }

  /** Begins (or switches) a reply draft -- local presentation state only, no Shell call. */
  startReplyTo(messageId: string): void {
    this.#replyToMessageId = messageId;
    this.#body = "";
    this.#state = fedosViewModelIdle();
  }

  get state(): FedosDesktopViewModelState<FedosMessageSendResultView> {
    return this.#state;
  }

  async send(conversationId: string, sender: FedosConversationParticipantReference): Promise<FedosDesktopViewModelState<FedosMessageSendResultView>> {
    if (this.#replyToMessageId === null) {
      this.#state = fedosViewModelError("invalid-input", "no message selected to reply to -- call startReplyTo() first");
      return this.#state;
    }
    if (this.#body.length === 0) {
      this.#state = fedosViewModelError("invalid-input", "reply body must be non-empty");
      return this.#state;
    }
    this.#state = fedosViewModelLoading();
    const result = await this.#shell.reply(conversationId, sender, this.#replyToMessageId, this.#body);
    this.#state = fedosViewModelFromShellResult(result);
    if (result.outcome === "ok") {
      this.#body = "";
      this.#replyToMessageId = null;
    }
    return this.#state;
  }
}
