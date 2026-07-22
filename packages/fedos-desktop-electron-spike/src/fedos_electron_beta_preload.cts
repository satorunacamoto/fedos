/**
 * Secure Runtime Alpha 5061-5160 — the Beta preload.
 *
 * `contextIsolation: true` / `sandbox: true` (mandatory, matches every other
 * preload in this package). Exposes exactly TWO frozen objects:
 *   - `fedosProfile` — the SAME closed shape as `fedos_electron_unlock_preload.cts`
 *     exposes, over the SAME `fedos-profile:*` channels (Phase P reuse).
 *   - `fedosBeta` — status + settings-application only, over the closed,
 *     additive `fedos-beta:*` channel set `fedos_electron_beta_main.cts`
 *     registers.
 *
 * No generic `invoke(channel, any)`, no `ipcRenderer`, no `require`, no
 * `fs`/`process`/`Buffer`/`crypto`/WASM exposure.
 */

import { contextBridge, ipcRenderer } from "electron";

const MAX_PASSPHRASE_CHARS = 4096;
const MAX_LABEL_CHARS = 256;

function boundedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

const fedosProfile: FedosProfileBridge = Object.freeze({
  status: () => ipcRenderer.invoke("fedos-profile:status"),
  create: (label: string, passphrase: string) =>
    ipcRenderer.invoke("fedos-profile:create", {
      label: boundedString(label, MAX_LABEL_CHARS),
      secret: boundedString(passphrase, MAX_PASSPHRASE_CHARS),
    }),
  unlock: (passphrase: string) =>
    ipcRenderer.invoke("fedos-profile:unlock", { secret: boundedString(passphrase, MAX_PASSPHRASE_CHARS) }),
  lock: () => ipcRenderer.invoke("fedos-profile:lock"),
  quit: () => ipcRenderer.invoke("fedos-profile:quit"),
});

const fedosBeta: FedosBetaBridge = Object.freeze({
  status: () => ipcRenderer.invoke("fedos-beta:status"),
  settingsPlan: (candidate: unknown) => ipcRenderer.invoke("fedos-beta:settings-plan", candidate),
  settingsApply: (candidate: unknown) => ipcRenderer.invoke("fedos-beta:settings-apply", candidate),
});

contextBridge.exposeInMainWorld("fedosProfile", fedosProfile);
contextBridge.exposeInMainWorld("fedosBeta", fedosBeta);
