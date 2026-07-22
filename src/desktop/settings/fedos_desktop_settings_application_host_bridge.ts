/**
 * Secure Runtime Alpha 4981-5060 — Phase M: `FedosDesktopSettingsApplicationHostBridge`.
 *
 * A narrow, additive host bridge for the CLOSED settings-application command
 * set only (`./fedos_desktop_settings_application_host_command.ts`). It REUSES
 * the existing, unmodified host response vocabulary
 * (`../host_boundary/fedos_desktop_host_response.ts`) — every branch returns
 * via `fedosHostOk`/`fedosHostFailure`, never a raw `Error`, stack, secret,
 * or raw Relay/Scheduler object. It owns exactly ONE
 * `FedosDesktopSettingsApplicationCoordinator` and nothing lower.
 *
 * Command -> coordinator mapping:
 *   settings-application-plan       -> coordinator.previewPlan(descriptor)
 *   settings-apply                  -> coordinator.apply(descriptor)
 *   settings-effective-state        -> coordinator.effectiveState()
 *   settings-reload-effective-state -> coordinator.initialize()
 *
 * The application REPORT is returned as the response value verbatim (it is a
 * plain, structured-clone-safe closed record carrying its own honest outcome)
 * — a partially-applied / blocked / failed report is NOT a transport error,
 * it is the honest result the UI must render. Only a genuinely rejected
 * (invalid) candidate maps to a host `invalid-input` failure.
 */

import type { FedosDesktopSettingsApplicationCoordinator } from "./fedos_desktop_settings_application_coordinator.js";
import type { FedosSettingsResult } from "../../settings/fedos_settings_authority.js";
import {
  fedosHostOk,
  fedosHostFailure,
  type FedosDesktopHostResponse,
} from "../host_boundary/fedos_desktop_host_response.js";
import { validateFedosDesktopSettingsApplicationHostCommand } from "./fedos_desktop_settings_application_host_command.js";
import { fedosSettingsEffectiveStateView } from "../../settings/application/fedos_settings_effective_state.js";

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

export class FedosDesktopSettingsApplicationHostBridge {
  readonly #coordinator: FedosDesktopSettingsApplicationCoordinator;

  constructor(coordinator: FedosDesktopSettingsApplicationCoordinator) {
    this.#coordinator = coordinator;
  }

  /** Validates, then dispatches, one settings-application command. Fails closed to `"unknown-command"` for anything not in the closed vocabulary; never throws. */
  async dispatch(command: unknown): Promise<FedosDesktopHostResponse<unknown>> {
    const validated = validateFedosDesktopSettingsApplicationHostCommand(command);
    if (validated === null) {
      return fedosHostFailure("unknown-command", "malformed or unrecognized settings-application command");
    }
    const requestId = validated.requestId;
    try {
      switch (validated.type) {
        case "settings-application-plan":
          return responseFromResult(this.#coordinator.previewPlan(validated.descriptor), requestId);
        case "settings-apply": {
          const applied = await this.#coordinator.apply(validated.descriptor);
          if (applied.outcome === "rejected-before-persist") {
            return fedosHostFailure("invalid-input", applied.reason, requestId);
          }
          return fedosHostOk(applied, requestId);
        }
        case "settings-effective-state": {
          const state = this.#coordinator.effectiveState();
          if (state === null) {
            return fedosHostFailure("unavailable", "effective state not initialized -- call settings-reload-effective-state first", requestId);
          }
          // Sanitize: only the boundary-safe view crosses toward the renderer.
          return fedosHostOk(fedosSettingsEffectiveStateView(state), requestId);
        }
        case "settings-reload-effective-state": {
          const init = this.#coordinator.initialize();
          if (init.outcome !== "ok") return responseFromResult(init, requestId);
          return fedosHostOk(fedosSettingsEffectiveStateView(init.value), requestId);
        }
      }
    } catch {
      return fedosHostFailure("failed", "settings-application command failed", requestId);
    }
  }
}

export function createFedosDesktopSettingsApplicationHostBridge(
  coordinator: FedosDesktopSettingsApplicationCoordinator,
): FedosDesktopSettingsApplicationHostBridge {
  return new FedosDesktopSettingsApplicationHostBridge(coordinator);
}
