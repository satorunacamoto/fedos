/**
 * Secure Runtime Alpha 4901-4980 — Phase E: `FedosDesktopSettingsRenderer`.
 *
 * A pure, plain-data PROJECTION of `FedosDesktopSettingsViewModel`'s current
 * `.state` onto the shared `FedosDesktopRenderModel<T>`
 * (`./fedos_desktop_render_model.ts`). Reads ONLY the ViewModel's public
 * getters (`.state`, `.activeScreen`); NEVER calls a ViewModel action, and
 * owns NO business logic, NO Runtime/Shell/persistence/crypto, NO rendering
 * framework/DOM/browser global. Producing DATA for an eventual concrete UI
 * is this layer's whole job; DRIVING the ViewModel is the future UI's job.
 *
 * The eight closed screens Phase E names (General / Appearance / Relay /
 * Notification / Privacy / Archive / Advanced / About) are projected as
 * per-screen field groups computed from the ONE loaded descriptor — never a
 * second copy of the settings state, so a screen model can never drift from
 * the descriptor it reads.
 */

import type { FedosDesktopSettingsViewModel, FedosDesktopSettingsScreen } from "../presentation/fedos_desktop_settings_view_model.js";
import { FEDOS_DESKTOP_SETTINGS_SCREENS } from "../presentation/fedos_desktop_settings_view_model.js";
import type { FedosSettingsDescriptorV1 } from "../../../../settings/fedos_settings_descriptor.js";
import { fedosRenderModel, type FedosDesktopRenderModel } from "./fedos_desktop_render_model.js";

/** Build-embedded, non-secret about-screen facts. */
export const FEDOS_DESKTOP_SETTINGS_ABOUT = Object.freeze({
  application: "FedOS Secure Runtime Desktop",
  settingsSchemaVersion: 1,
});

/** The per-screen projected content shape — every field group a screen exposes, plus the active-screen marker and the closed screen list (for a future tab bar). */
export interface FedosDesktopSettingsRenderContent {
  readonly activeScreen: FedosDesktopSettingsScreen;
  readonly screens: readonly FedosDesktopSettingsScreen[];
  readonly general: { readonly language: string; readonly autoStart: boolean };
  readonly appearance: { readonly theme: string; readonly language: string; readonly windowLayout: string };
  readonly relay: { readonly relays: readonly string[]; readonly defaultRelay: string; readonly count: number; readonly isEmpty: boolean };
  readonly notification: { readonly notificationsEnabled: boolean };
  readonly privacy: { readonly autoLockTimeoutMinutes: number; readonly backgroundSyncEnabled: boolean };
  readonly archive: { readonly archiveDirectory: string; readonly configured: boolean };
  readonly advanced: { readonly backgroundSyncEnabled: boolean; readonly autoLockTimeoutMinutes: number; readonly schemaVersion: number };
  readonly about: { readonly application: string; readonly settingsSchemaVersion: number };
}

function project(descriptor: FedosSettingsDescriptorV1, activeScreen: FedosDesktopSettingsScreen): FedosDesktopSettingsRenderContent {
  return Object.freeze({
    activeScreen,
    screens: FEDOS_DESKTOP_SETTINGS_SCREENS,
    general: Object.freeze({ language: descriptor.language, autoStart: descriptor.autoStart }),
    appearance: Object.freeze({ theme: descriptor.theme, language: descriptor.language, windowLayout: descriptor.windowLayout }),
    relay: Object.freeze({
      relays: descriptor.relays,
      defaultRelay: descriptor.defaultRelay,
      count: descriptor.relays.length,
      isEmpty: descriptor.relays.length === 0,
    }),
    notification: Object.freeze({ notificationsEnabled: descriptor.notificationsEnabled }),
    privacy: Object.freeze({ autoLockTimeoutMinutes: descriptor.autoLockTimeoutMinutes, backgroundSyncEnabled: descriptor.backgroundSyncEnabled }),
    archive: Object.freeze({ archiveDirectory: descriptor.archiveDirectory, configured: descriptor.archiveDirectory.length > 0 }),
    advanced: Object.freeze({
      backgroundSyncEnabled: descriptor.backgroundSyncEnabled,
      autoLockTimeoutMinutes: descriptor.autoLockTimeoutMinutes,
      schemaVersion: descriptor.schemaVersion,
    }),
    about: Object.freeze({
      application: FEDOS_DESKTOP_SETTINGS_ABOUT.application,
      settingsSchemaVersion: FEDOS_DESKTOP_SETTINGS_ABOUT.settingsSchemaVersion,
    }),
  });
}

export class FedosDesktopSettingsRenderer {
  readonly #viewModel: FedosDesktopSettingsViewModel;

  constructor(viewModel: FedosDesktopSettingsViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopRenderModel<FedosDesktopSettingsRenderContent> {
    const activeScreen = this.#viewModel.activeScreen;
    return fedosRenderModel(this.#viewModel.state, (descriptor) => project(descriptor, activeScreen));
  }
}
