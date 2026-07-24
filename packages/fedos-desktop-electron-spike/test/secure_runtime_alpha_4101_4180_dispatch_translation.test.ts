import { describe, it, expect } from "vitest";
import { fedosElectronHandleInvoke, fedosElectronValidateInvokeRequest, type FedosElectronHostBridgeLike } from "../src/fedos_electron_host_adapter_dispatch_translation.js";

/**
 * Secure Runtime Alpha 4101-4180 -- unit tests for the ONE translation
 * point between an IPC request and a `FedosDesktopHostBridge` call. Pure,
 * fast, no Electron process needed -- a hand-written `FedosElectronHostBridgeLike`
 * double stands in for the real Bridge here (already exhaustively tested
 * elsewhere, Alpha 3561-3640/3801-3880); this file only proves the
 * translation itself is correct, never re-testing the Bridge.
 */

function makeMockBridge(overrides: Partial<FedosElectronHostBridgeLike> = {}): FedosElectronHostBridgeLike {
  return {
    status: () => "running",
    dispatch: async (command) => ({ outcome: "ok", value: { echoedCommand: command } }),
    render: () => ({ outcome: "ok", value: { rendered: true } }),
    start: async () => ({ outcome: "ok", value: null }),
    stop: async () => ({ outcome: "ok", value: null }),
    ...overrides,
  };
}

describe("Secure Runtime Alpha 4101-4180 -- fedosElectronValidateInvokeRequest", () => {
  it("1. accepts 'dispatch' with a command payload", () => {
    const result = fedosElectronValidateInvokeRequest({ op: "dispatch", command: { type: "runtime-status" } });
    expect(result).toEqual({ op: "dispatch", command: { type: "runtime-status" } });
  });

  it("2. accepts 'render' and 'status' with no extra payload", () => {
    expect(fedosElectronValidateInvokeRequest({ op: "render" })).toEqual({ op: "render" });
    expect(fedosElectronValidateInvokeRequest({ op: "status" })).toEqual({ op: "status" });
  });

  it("3. fails closed to null for a non-object candidate", () => {
    expect(fedosElectronValidateInvokeRequest(null)).toBeNull();
    expect(fedosElectronValidateInvokeRequest("dispatch")).toBeNull();
    expect(fedosElectronValidateInvokeRequest(42)).toBeNull();
    expect(fedosElectronValidateInvokeRequest(undefined)).toBeNull();
  });

  it("4. fails closed to null for an unrecognized op", () => {
    expect(fedosElectronValidateInvokeRequest({ op: "start" })).toBeNull();
    expect(fedosElectronValidateInvokeRequest({ op: "stop" })).toBeNull();
    expect(fedosElectronValidateInvokeRequest({ op: "arbitrary-ipc-channel" })).toBeNull();
    expect(fedosElectronValidateInvokeRequest({})).toBeNull();
  });

  it("5. never throws for a malformed/malicious-shaped candidate", () => {
    expect(() => fedosElectronValidateInvokeRequest({ op: { toString: () => "dispatch" } })).not.toThrow();
    expect(() => fedosElectronValidateInvokeRequest([1, 2, 3])).not.toThrow();
  });
});

describe("Secure Runtime Alpha 4101-4180 -- fedosElectronHandleInvoke", () => {
  it("6. 'dispatch' forwards the command to bridge.dispatch(), nothing else", async () => {
    let receivedCommand: unknown;
    const bridge = makeMockBridge({
      dispatch: async (command) => {
        receivedCommand = command;
        return { outcome: "ok", value: "dispatched" };
      },
    });
    const result = await fedosElectronHandleInvoke(bridge, { op: "dispatch", command: { type: "search", query: "hello" } });
    expect(result).toEqual({ outcome: "ok", value: "dispatched" });
    expect(receivedCommand).toEqual({ type: "search", query: "hello" });
  });

  it("7. 'render' forwards to bridge.render()", async () => {
    const bridge = makeMockBridge({ render: () => ({ outcome: "ok", value: { screen: "real" } }) });
    const result = await fedosElectronHandleInvoke(bridge, { op: "render" });
    expect(result).toEqual({ outcome: "ok", value: { screen: "real" } });
  });

  it("8. 'status' forwards to bridge.status(), wrapped as a closed ok response", async () => {
    const bridge = makeMockBridge({ status: () => "stopped" });
    const result = await fedosElectronHandleInvoke(bridge, { op: "status" });
    expect(result).toEqual({ outcome: "ok", value: "stopped" });
  });

  it("9. 'unavailable' -- hostBridge undefined (host not started, or start() failed) fails closed to the SAME closed error shape FedosDesktopHostResponse itself uses", async () => {
    const result = await fedosElectronHandleInvoke(undefined, { op: "status" });
    expect(result).toEqual({ outcome: "error", code: "unavailable", message: "host is not available" });
  });

  it("10. 'errors' -- an unrecognized op is denied 'invalid-input', never silently ignored or forwarded", async () => {
    const bridge = makeMockBridge();
    const result = await fedosElectronHandleInvoke(bridge, { op: "not-a-real-op" });
    expect(result).toEqual({ outcome: "error", code: "invalid-input", message: "malformed request" });
  });

  it("11. 'errors' -- a non-object request is denied 'invalid-input'", async () => {
    const bridge = makeMockBridge();
    expect(await fedosElectronHandleInvoke(bridge, null)).toEqual({ outcome: "error", code: "invalid-input", message: "malformed request" });
    expect(await fedosElectronHandleInvoke(bridge, "arbitrary string")).toEqual({ outcome: "error", code: "invalid-input", message: "malformed request" });
  });

  it("12. never throws, even for a wildly malformed request", async () => {
    const bridge = makeMockBridge();
    await expect(fedosElectronHandleInvoke(bridge, { op: "dispatch", command: undefined })).resolves.toBeDefined();
    await expect(fedosElectronHandleInvoke(bridge, [1, 2, 3])).resolves.toBeDefined();
  });

  it("13. structured-clone-safe -- every possible result shape is plain, JSON-serializable data, no function/Error instance", async () => {
    const bridge = makeMockBridge();
    const results = await Promise.all([
      fedosElectronHandleInvoke(bridge, { op: "dispatch", command: { type: "runtime-status" } }),
      fedosElectronHandleInvoke(bridge, { op: "render" }),
      fedosElectronHandleInvoke(bridge, { op: "status" }),
      fedosElectronHandleInvoke(undefined, { op: "status" }),
      fedosElectronHandleInvoke(bridge, { op: "bogus" }),
    ]);
    for (const result of results) {
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      expect(result).not.toBeInstanceOf(Error);
      for (const value of Object.values(result as Record<string, unknown>)) {
        expect(typeof value).not.toBe("function");
      }
    }
  });
});
