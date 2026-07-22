/**
 * Secure Runtime Alpha 4101-4180 -- Electron Main/Preload Adapter for
 * FedosDesktopHostBridge (Phase B).
 *
 * The ONE translation point between an IPC request and a
 * `FedosDesktopHostBridge` call. Deliberately has NO Electron import of
 * any kind (plain `.ts`, not `.cts`) so it is directly unit-testable
 * under plain Node/vitest with a hand-written `HostBridgeLike` double --
 * this file only reads a closed `{op}` discriminator and forwards to the
 * matching Host Bridge method; it never re-validates, re-shapes, or
 * re-derives anything the Bridge's own `dispatch()`/`render()`/`status()`
 * do not already do themselves (those three already fail closed, never
 * throw, and already return `Object.freeze`d JSON-safe data -- Alpha
 * 3561-3640's own guarantee, unchanged).
 *
 * `start()`/`stop()` are DELIBERATELY not reachable through this
 * translation -- see this Arc's own Phase A doc, "Design decision: what
 * the Electron adapter actually exposes." Only `dispatch`/`render`/
 * `status` are multiplexed here.
 */

/** Structural shape only -- this file never imports the real `FedosDesktopHostBridge`/`FedosDesktopHostPort` TypeScript types directly (doing so would pull the root project's own type graph into this physically-isolated package, undoing Alpha 4021-4100's own isolation). Both the real Bridge and this narrow shape already agree on this exact surface (`fedos_desktop_host_port.ts`, unmodified). `start()`/`stop()` are present here ONLY so `fedos_electron_host_adapter_main.cts` can hold ONE typed reference for the whole Bridge -- this file's own `fedosElectronHandleInvoke()` never calls either (see this file's own header). */
export interface FedosElectronHostBridgeLike {
  status(): string;
  dispatch(command: unknown): Promise<unknown>;
  render(): unknown;
  start(config: unknown): Promise<unknown>;
  stop(): Promise<unknown>;
}

export type FedosElectronInvokeRequest = { readonly op: "dispatch"; readonly command: unknown } | { readonly op: "render" } | { readonly op: "status" };

const KNOWN_OPS: readonly string[] = ["dispatch", "render", "status"];

/** Fails closed to `null` for anything not a genuinely well-formed, in-vocabulary request -- mirrors `validateFedosDesktopHostCommand()`'s own "never throw, never coerce" discipline one layer up. Never throws. */
export function fedosElectronValidateInvokeRequest(candidate: unknown): FedosElectronInvokeRequest | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  if (typeof c.op !== "string" || !KNOWN_OPS.includes(c.op)) return null;
  if (c.op === "dispatch") return { op: "dispatch", command: c.command };
  if (c.op === "render") return { op: "render" };
  return { op: "status" };
}

/**
 * Translates one already-validated `FedosElectronInvokeRequest` into
 * exactly one `FedosElectronHostBridgeLike` call -- no other side effect.
 * `hostBridge === undefined` (the Host has not started, or start()
 * failed and the app denied the window per Phase A's own documented
 * "startup failure closes/denies the window" contract) fails closed to
 * the SAME `{outcome:"error",code:"unavailable"}` shape
 * `FedosDesktopHostResponse` itself already uses -- never a different,
 * ad hoc error shape invented at this layer.
 */
export async function fedosElectronHandleInvoke(hostBridge: FedosElectronHostBridgeLike | undefined, requestCandidate: unknown): Promise<unknown> {
  if (hostBridge === undefined) {
    return { outcome: "error", code: "unavailable", message: "host is not available" };
  }
  const request = fedosElectronValidateInvokeRequest(requestCandidate);
  if (request === null) {
    return { outcome: "error", code: "invalid-input", message: "malformed request" };
  }
  switch (request.op) {
    case "dispatch":
      return hostBridge.dispatch(request.command);
    case "render":
      return hostBridge.render();
    case "status":
      return { outcome: "ok", value: hostBridge.status() };
  }
}
