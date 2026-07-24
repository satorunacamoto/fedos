/**
 * Secure Runtime Alpha 4901-4980 — Electron Main/Preload Adapter for the
 * settings bridge (Phase G). The ONE translation point between an IPC
 * request and a `FedosDesktopSettingsHostBridge` call.
 *
 * Deliberately has NO Electron import (plain `.ts`, not `.cts`) so it is
 * directly unit-testable under plain Node/vitest with a hand-written
 * bridge double. It reads a closed `{op:"dispatch",command}` request and
 * forwards `command` to the bridge — it never re-validates, re-shapes, or
 * re-derives anything the bridge's own `dispatch()` does not already do
 * (the bridge already fails closed to `"unknown-command"` for anything not
 * in the closed five-command settings vocabulary, and already returns
 * `Object.freeze`d JSON-safe `FedosDesktopHostResponse` data).
 */

/** Structural shape only — never imports the real bridge TypeScript type (that would pull the root project's type graph into this isolated package). Both the real bridge and this narrow shape agree on this exact surface. */
export interface FedosElectronSettingsBridgeLike {
  dispatch(command: unknown): Promise<unknown>;
}

export type FedosElectronSettingsInvokeRequest = { readonly op: "dispatch"; readonly command: unknown };

/** Fails closed to `null` for anything not a well-formed `{op:"dispatch",command}` request. Never throws. */
export function fedosElectronSettingsValidateInvokeRequest(candidate: unknown): FedosElectronSettingsInvokeRequest | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  if (c.op !== "dispatch") return null;
  return { op: "dispatch", command: c.command };
}

/**
 * Translates one request into exactly one bridge `dispatch()` call.
 * `bridge === undefined` (the adapter never constructed a bridge) fails
 * closed to the SAME `{outcome:"error",code:"unavailable"}` shape
 * `FedosDesktopHostResponse` already uses — never an ad hoc error shape.
 */
export async function fedosElectronSettingsHandleInvoke(
  bridge: FedosElectronSettingsBridgeLike | undefined,
  requestCandidate: unknown,
): Promise<unknown> {
  if (bridge === undefined) {
    return { outcome: "error", code: "unavailable", message: "settings host is not available" };
  }
  const request = fedosElectronSettingsValidateInvokeRequest(requestCandidate);
  if (request === null) {
    return { outcome: "error", code: "invalid-input", message: "malformed request" };
  }
  return bridge.dispatch(request.command);
}
