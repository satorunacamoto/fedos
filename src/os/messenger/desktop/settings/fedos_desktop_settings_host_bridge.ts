/**
 * Secure Runtime Alpha 4901-4980 — Phase F: `FedosDesktopSettingsHostBridge`.
 *
 * A narrow, additive host bridge for the CLOSED settings command set only
 * (`./fedos_desktop_settings_host_command.ts`). It REUSES the existing,
 * unmodified host response vocabulary (`FedosDesktopHostResponse`,
 * `../host_boundary/fedos_desktop_host_response.ts`) — every branch returns
 * via `fedosHostOk`/`fedosHostFailure`, never a raw `Error`, stack, or
 * secret. It is a SEPARATE bridge from the conversation
 * `FedosDesktopHostBridge` (which owns the Runtime/Shell): settings are
 * durable-file-backed and independent of the running conversation Runtime,
 * so this bridge owns exactly ONE `FedosDesktopSettingsController` and
 * nothing lower.
 *
 * Command→controller mapping (one-for-one, no re-derivation):
 *   settings-load   → controller.load()
 *   settings-save   → controller.save(descriptor)
 *   settings-reset  → controller.reset()
 *   settings-export → controller.export()
 *   settings-import → controller.import(serialized)
 *
 * The authority's closed `FedosSettingsResult` outcomes map onto the host
 * diagnostic vocabulary verbatim: `invalid`→`invalid-input`,
 * `corrupt`→`failed` (a corrupt store is a closed failure, never leaking the
 * raw bytes), `failed`→`failed`. `dispatch()` never throws.
 */

import type { FedosDesktopSettingsController } from "./fedos_desktop_settings_controller.js";
import type { FedosSettingsResult } from "../../../core/settings/fedos_settings_authority.js";
import {
  fedosHostOk,
  fedosHostFailure,
  type FedosDesktopHostResponse,
} from "../host_boundary/fedos_desktop_host_response.js";
import { validateFedosDesktopSettingsHostCommand } from "./fedos_desktop_settings_host_command.js";

function responseFromResult<T>(result: FedosSettingsResult<T>, requestId?: string): FedosDesktopHostResponse<T> {
  switch (result.outcome) {
    case "ok":
      return fedosHostOk(result.value, requestId);
    case "invalid":
      return fedosHostFailure("invalid-input", `${result.reason}: ${result.errors.join(", ")}`, requestId);
    case "corrupt":
      return fedosHostFailure("failed", "stored settings are corrupt", requestId);
    default:
      return fedosHostFailure("failed", result.reason, requestId);
  }
}

export class FedosDesktopSettingsHostBridge {
  readonly #controller: FedosDesktopSettingsController;

  constructor(controller: FedosDesktopSettingsController) {
    this.#controller = controller;
  }

  /** Validates, then dispatches, one settings command. Fails closed to `"unknown-command"` for anything not in the closed vocabulary; never throws. */
  async dispatch(command: unknown): Promise<FedosDesktopHostResponse<unknown>> {
    const validated = validateFedosDesktopSettingsHostCommand(command);
    if (validated === null) {
      return fedosHostFailure("unknown-command", "malformed or unrecognized settings command");
    }
    const requestId = validated.requestId;
    try {
      switch (validated.type) {
        case "settings-load":
          return responseFromResult(this.#controller.load(), requestId);
        case "settings-save":
          return responseFromResult(this.#controller.save(validated.descriptor), requestId);
        case "settings-reset":
          return responseFromResult(this.#controller.reset(), requestId);
        case "settings-export":
          return responseFromResult(this.#controller.export(), requestId);
        case "settings-import":
          return responseFromResult(this.#controller.import(validated.serialized), requestId);
      }
    } catch {
      return fedosHostFailure("failed", "settings command failed", requestId);
    }
  }
}

export function createFedosDesktopSettingsHostBridge(
  controller: FedosDesktopSettingsController,
): FedosDesktopSettingsHostBridge {
  return new FedosDesktopSettingsHostBridge(controller);
}
