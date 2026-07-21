/**
 * Secure Runtime Alpha 4821-4900 — Phase C: the unlock preload.
 *
 * `contextIsolation: true` / `sandbox: true` (mandatory, matches every
 * other preload in this package). Exposes exactly ONE frozen object,
 * `fedosProfile`, whose members are thin `ipcRenderer.invoke()` wrappers
 * around the closed, named `fedos-profile:*` channel set the unlock main
 * (`fedos_electron_unlock_main.cts`) registers — and nothing else.
 *
 * DEDICATED SECRET-INPUT BOUNDARY (Phase B/C): `create()`/`unlock()` are a
 * closed unlock-input contract, SEPARATE from any generic command. The
 * passphrase is a plain string ARGUMENT forwarded straight to the closed
 * main-process command; the preload never stores it, never returns it,
 * never places it in any other channel, and never exposes a generic
 * `invoke(channel, any)`, `ipcRenderer`, `require`, `fs`, `process`,
 * `Buffer`, `crypto`, or the WASM module. The object and its method names
 * are frozen — renderer code cannot choose an arbitrary IPC channel.
 */

import { contextBridge, ipcRenderer } from "electron";

const MAX_PASSPHRASE_CHARS = 4096;
const MAX_LABEL_CHARS = 256;

/** Coerces to a bounded string WITHOUT logging or storing it — a defensive cap so a runaway renderer value cannot be forwarded unbounded. */
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

contextBridge.exposeInMainWorld("fedosProfile", fedosProfile);
