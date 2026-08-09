/**
 * Secure Runtime Alpha 3241-3320 — Unread Counter ViewModel.
 *
 * HONEST SCOPE NOTE: no "read receipt" or "last viewed" concept exists
 * anywhere in this codebase (`fedos_desktop_shell_view_models.ts`'s own
 * header: "No read receipt... is invented here — none of those facts exist
 * anywhere in this codebase"). This ViewModel does not fabricate one as a
 * new backend capability either. Instead it keeps exactly one piece of
 * LOCAL, in-memory-only, non-persisted presentation state per conversation
 * -- a "last viewed" watermark (the newest `createdAt` this UI has shown
 * the user) -- and counts, from the Shell's own real `listMessages()`
 * result, how many messages are newer than that watermark. This is pure
 * presentation-layer bookkeeping over already-real data, never a second
 * business capability: it is lost on process exit, never written to any
 * log/file/persistence port, and never claims to be a durable multi-device
 * "unread" fact -- only "messages this UI session has not yet shown."
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelError,
  fedosViewModelLoaded,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export interface FedosDesktopUnreadCount {
  readonly conversationId: string;
  readonly count: number;
}

export class FedosDesktopUnreadCounterViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  /** conversationId -> newest `createdAt` this UI has shown so far. Never persisted. */
  readonly #watermarks = new Map<string, number>();
  #state: FedosDesktopViewModelState<FedosDesktopUnreadCount> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<FedosDesktopUnreadCount> {
    return this.#state;
  }

  /** Counts messages in `conversationId` newer than this session's own watermark for it (everything, if the conversation was never marked viewed). */
  async refresh(conversationId: string): Promise<FedosDesktopViewModelState<FedosDesktopUnreadCount>> {
    this.#state = fedosViewModelLoading();
    const result = this.#shell.listMessages(conversationId);
    if (result.outcome !== "ok") {
      this.#state = fedosViewModelError(result.outcome, result.reason);
      return this.#state;
    }
    const watermark = this.#watermarks.get(conversationId) ?? -1;
    const count = result.value.filter((m) => m.createdAt > watermark).length;
    this.#state = fedosViewModelLoaded({ conversationId, count });
    return this.#state;
  }

  /**
   * Marks `conversationId` as viewed up to its CURRENT newest message
   * (re-reads `listMessages()` to find it -- never trusts a caller-supplied
   * timestamp, mirroring this codebase's own "never a caller-supplied
   * override" discipline one layer up). A conversation with zero messages
   * is a no-op (nothing to mark viewed yet).
   */
  async markViewed(conversationId: string): Promise<void> {
    const result = this.#shell.listMessages(conversationId);
    if (result.outcome !== "ok" || result.value.length === 0) return;
    const newest = result.value.reduce((max, m) => Math.max(max, m.createdAt), -1);
    this.#watermarks.set(conversationId, newest);
  }
}
