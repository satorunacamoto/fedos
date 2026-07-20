/**
 * Secure Runtime Alpha 3241-3320 — Archive ViewModel.
 *
 * One convenience method per REAL Archive operation
 * `FedosDesktopApplicationShell.archive()` (Alpha 3081-3160) actually
 * accepts -- `inspect`/`preflightRestore`/`export`/`restore`. No
 * "list"/"summary"/"verify" method is invented here (the Shell's own
 * Content Accessor already documents why no such distinct operation exists
 * on this base); this file only shapes each call's result into this
 * directory's own `FedosDesktopViewModelState`.
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosContentAccessorArchiveValue } from "../content_accessor/fedos_desktop_conversation_content_accessor_result.js";
import type {
  FedosConversationArchiveExportRequest,
  FedosConversationArchiveRestoreRequest,
} from "../../conversation/archive/runtime/fedos_conversation_archive_runtime.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export class FedosDesktopArchiveViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<FedosContentAccessorArchiveValue> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<FedosContentAccessorArchiveValue> {
    return this.#state;
  }

  /** Reads an archive container's cleartext Manifest only -- never decrypts (closest real "summary"/"verify" this base has, see the Content Accessor's own header). */
  async inspect(sourcePath: string): Promise<FedosDesktopViewModelState<FedosContentAccessorArchiveValue>> {
    return this.#run({ operation: "inspect", sourcePath });
  }

  async preflightRestore(request: FedosConversationArchiveRestoreRequest): Promise<FedosDesktopViewModelState<FedosContentAccessorArchiveValue>> {
    return this.#run({ operation: "preflightRestore", request });
  }

  async export(request: FedosConversationArchiveExportRequest): Promise<FedosDesktopViewModelState<FedosContentAccessorArchiveValue>> {
    return this.#run({ operation: "export", request });
  }

  async restore(request: FedosConversationArchiveRestoreRequest): Promise<FedosDesktopViewModelState<FedosContentAccessorArchiveValue>> {
    return this.#run({ operation: "restore", request });
  }

  async #run(
    command:
      | { readonly operation: "inspect"; readonly sourcePath: string }
      | { readonly operation: "preflightRestore"; readonly request: FedosConversationArchiveRestoreRequest }
      | { readonly operation: "export"; readonly request: FedosConversationArchiveExportRequest }
      | { readonly operation: "restore"; readonly request: FedosConversationArchiveRestoreRequest },
  ): Promise<FedosDesktopViewModelState<FedosContentAccessorArchiveValue>> {
    this.#state = fedosViewModelLoading();
    const result = await this.#shell.archive(command);
    this.#state = fedosViewModelFromShellResult(result);
    return this.#state;
  }
}
