/**
 * Secure Runtime Alpha 4901-4980 — Phase E: `FedosDesktopSettingsViewModel`.
 *
 * The presentation-state holder for the settings screens. It delegates
 * every fact and every mutation to `FedosDesktopSettingsController`
 * (`../settings/fedos_desktop_settings_controller.ts`) — never a
 * persistence port, authority, Runtime, Shell, or crypto directly — and
 * holds its result in the SHARED, closed `FedosDesktopViewModelState<T>`
 * (`./fedos_desktop_view_model_state.ts`) every other desktop ViewModel
 * uses. It imports NO rendering framework, NO browser global, NO Electron.
 *
 * The ONE piece of local, in-memory-only presentation state it adds is the
 * currently-active settings screen (`#activeScreen`) — never durable, lost
 * on process exit, never written anywhere.
 *
 * `FedosSettingsResult<T>` (the controller's own closed outcome) maps onto
 * `FedosDesktopViewModelState<T>` verbatim: `"ok"`→loaded, everything else
 * →error carrying the exact outcome/reason the authority returned (an
 * `"invalid"` result additionally carries its field-error codes in the
 * reason string, never a re-derived message).
 */

import type { FedosSettingsDescriptorV1 } from "../../settings/fedos_settings_descriptor.js";
import type { FedosSettingsResult } from "../../settings/fedos_settings_authority.js";
import type { FedosDesktopSettingsController } from "../settings/fedos_desktop_settings_controller.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoaded,
  fedosViewModelError,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

/** The closed set of settings screens Phase E names. Never a free-form screen id. */
export type FedosDesktopSettingsScreen =
  | "general"
  | "appearance"
  | "relay"
  | "notification"
  | "privacy"
  | "archive"
  | "advanced"
  | "about";

export const FEDOS_DESKTOP_SETTINGS_SCREENS: readonly FedosDesktopSettingsScreen[] = Object.freeze([
  "general",
  "appearance",
  "relay",
  "notification",
  "privacy",
  "archive",
  "advanced",
  "about",
]);

/** Maps a closed authority/controller result onto the shared ViewModel-state shape, verbatim. */
function stateFromResult<T>(result: FedosSettingsResult<T>): FedosDesktopViewModelState<T> {
  if (result.outcome === "ok") return fedosViewModelLoaded(result.value);
  if (result.outcome === "invalid") {
    return fedosViewModelError("invalid", `${result.reason}: ${result.errors.join(", ")}`);
  }
  return fedosViewModelError(result.outcome, result.reason);
}

export class FedosDesktopSettingsViewModel {
  readonly #controller: FedosDesktopSettingsController;
  #state: FedosDesktopViewModelState<FedosSettingsDescriptorV1> = fedosViewModelIdle();
  #activeScreen: FedosDesktopSettingsScreen = "general";

  constructor(controller: FedosDesktopSettingsController) {
    this.#controller = controller;
  }

  get state(): FedosDesktopViewModelState<FedosSettingsDescriptorV1> {
    return this.#state;
  }

  get activeScreen(): FedosDesktopSettingsScreen {
    return this.#activeScreen;
  }

  /** Local, non-durable screen selection. Ignores an unknown screen id (never throws). */
  setActiveScreen(screen: FedosDesktopSettingsScreen): void {
    if (FEDOS_DESKTOP_SETTINGS_SCREENS.includes(screen)) this.#activeScreen = screen;
  }

  load(): FedosDesktopViewModelState<FedosSettingsDescriptorV1> {
    this.#state = stateFromResult(this.#controller.load());
    return this.#state;
  }

  save(candidate: unknown): FedosDesktopViewModelState<FedosSettingsDescriptorV1> {
    this.#state = stateFromResult(this.#controller.save(candidate));
    return this.#state;
  }

  reset(): FedosDesktopViewModelState<FedosSettingsDescriptorV1> {
    this.#state = stateFromResult(this.#controller.reset());
    return this.#state;
  }

  import(serialized: unknown): FedosDesktopViewModelState<FedosSettingsDescriptorV1> {
    this.#state = stateFromResult(this.#controller.import(serialized));
    return this.#state;
  }

  /** Export does not change the loaded state — it returns a separate, read-only export result. */
  export(): FedosDesktopViewModelState<string> {
    return stateFromResult(this.#controller.export());
  }
}
