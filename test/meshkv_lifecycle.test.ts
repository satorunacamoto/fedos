import { describe, it, expect } from "vitest";
import {
  MeshKVBrowserLifecycle,
  createMeshKVLifecycle,
  type MeshKVLifecycleNode,
} from "../src/asset/meshkv_lifecycle.js";
import { MeshKV } from "../packages/meshkv/src/index.js";
import type { MeshKVApi, MeshKVInitOptions } from "../packages/meshkv/src/index.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
// Runtime / Worker sources as strings: prove the lifecycle is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/** A node that records every lifecycle call and can be told to fail a step. */
class MockNode implements MeshKVLifecycleNode {
  readonly calls = { init: 0, startSignaling: 0, stop: 0 };
  lastInitOptions: MeshKVInitOptions | undefined;
  failOn: Partial<Record<"init" | "startSignaling" | "stop", boolean>> = {};

  async init(options?: MeshKVInitOptions): Promise<void> {
    this.calls.init += 1;
    this.lastInitOptions = options;
    if (this.failOn.init) throw new Error("init failed");
  }
  async startSignaling(): Promise<void> {
    this.calls.startSignaling += 1;
    if (this.failOn.startSignaling) throw new Error("signaling failed");
  }
  async stop(): Promise<void> {
    this.calls.stop += 1;
    if (this.failOn.stop) throw new Error("stop failed");
  }
}

/** A MeshKVApi spy that also exposes online-step methods, to prove the runtime never calls them. */
function spyApi(): MeshKVApi & {
  startSignaling(): Promise<void>;
  stop(): Promise<void>;
  calls: { init: number; startSignaling: number; stop: number };
} {
  const calls = { init: 0, startSignaling: 0, stop: 0 };
  return {
    calls,
    async init() {
      calls.init += 1;
    },
    async get() {
      return null;
    },
    async put() {},
    async remove() {},
    async startSignaling() {
      calls.startSignaling += 1;
    },
    async stop() {
      calls.stop += 1;
    },
  };
}

describe("MeshKVBrowserLifecycle", () => {
  it("1. the constructor starts no network / calls no node method", () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    expect(lc.getState()).toBe("idle");
    expect(node.calls).toEqual({ init: 0, startSignaling: 0, stop: 0 });
  });

  it("1b. against a real reference node, constructing brings nothing online", () => {
    const mesh = new MeshKV();
    createMeshKVLifecycle(mesh);
    expect(mesh.online).toBe(false);
    expect(mesh.meshWired).toBe(false);
    expect(mesh.signaling.isOpen).toBe(false);
  });

  it("2. prepare() wires (init) only — no signaling / connect", async () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    const state = await lc.prepare();
    expect(state).toBe("prepared");
    expect(lc.getState()).toBe("prepared");
    expect(node.calls).toEqual({ init: 1, startSignaling: 0, stop: 0 });
  });

  it("2b. prepare() forwards the init options (e.g. signal) without mutating them", async () => {
    const node = new MockNode();
    const initOptions: MeshKVInitOptions = { signal: {} };
    const lc = new MeshKVBrowserLifecycle({ node, initOptions });
    await lc.prepare();
    expect(node.lastInitOptions).toBe(initOptions);
  });

  it("3. goOnline() calls startSignaling (the first online step)", async () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    await lc.prepare();
    const state = await lc.goOnline();
    expect(state).toBe("online");
    expect(node.calls).toEqual({ init: 1, startSignaling: 1, stop: 0 });
  });

  it("3b. goOnline() from idle auto-wires then goes online", async () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    await lc.goOnline();
    expect(lc.getState()).toBe("online");
    expect(node.calls).toEqual({ init: 1, startSignaling: 1, stop: 0 });
  });

  it("4. goOffline() calls stop (tears the mesh down)", async () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    await lc.goOnline();
    const state = await lc.goOffline();
    expect(state).toBe("offline");
    expect(node.calls).toEqual({ init: 1, startSignaling: 1, stop: 1 });
  });

  it("5. double prepare() is safe — init runs once", async () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    await lc.prepare();
    await lc.prepare();
    expect(lc.getState()).toBe("prepared");
    expect(node.calls.init).toBe(1);
  });

  it("6. double goOnline() is safe — startSignaling runs once", async () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    await lc.goOnline();
    await lc.goOnline();
    expect(lc.getState()).toBe("online");
    expect(node.calls.startSignaling).toBe(1);
  });

  it("6b. double goOffline() is safe — stop runs once", async () => {
    const node = new MockNode();
    const lc = new MeshKVBrowserLifecycle({ node });
    await lc.goOnline();
    await lc.goOffline();
    await lc.goOffline();
    expect(lc.getState()).toBe("offline");
    expect(node.calls.stop).toBe(1);
  });

  it("7. a failing step moves the state to error and records the cause", async () => {
    const node = new MockNode();
    node.failOn.startSignaling = true;
    const lc = new MeshKVBrowserLifecycle({ node });
    const state = await lc.goOnline();
    expect(state).toBe("error");
    expect(lc.getState()).toBe("error");
    expect(lc.getLastError()?.message).toBe("signaling failed");
  });

  it("7b. a failing prepare() also lands in error (no throw)", async () => {
    const node = new MockNode();
    node.failOn.init = true;
    const lc = new MeshKVBrowserLifecycle({ node });
    await expect(lc.prepare()).resolves.toBe("error");
    expect(lc.getState()).toBe("error");
  });

  it("drives a real reference node online and back offline explicitly", async () => {
    const mesh = new MeshKV();
    const lc = createMeshKVLifecycle(mesh, { signal: {} });
    await lc.prepare();
    expect(mesh.meshWired).toBe(true);
    expect(mesh.online).toBe(false); // prepare wires only
    await lc.goOnline();
    expect(mesh.online).toBe(true);
    expect(mesh.signaling.isOpen).toBe(true);
    await lc.goOffline();
    expect(mesh.online).toBe(false);
    expect(mesh.signaling.isOpen).toBe(false);
  });

  it("8. createRuntime never drives the lifecycle (no online step)", () => {
    const api = spyApi();
    createRuntime({ ENABLE_MESHKV_ASSET_CACHE: true, MESHKV_API: api });
    // Selecting the adapter must not init/connect/startSignaling the node.
    expect(api.calls).toEqual({ init: 0, startSignaling: 0, stop: 0 });
    // The runtime does not import or drive the lifecycle module. (It may mention
    // startSignaling in a guardrail comment stating it does NOT call it.)
    const src: string = runtimeSource;
    expect(src).not.toContain("meshkv_lifecycle");
    expect(src).not.toContain("MeshKVLifecycle");
    expect(src).not.toContain("createMeshKVLifecycle");
    expect(src).not.toContain("goOnline");
    expect(src).not.toContain(".startSignaling(");
  });

  it("9. the Worker source has no lifecycle auto-wire", () => {
    const src: string = workerSource;
    expect(src).not.toContain("meshkv_lifecycle");
    expect(src).not.toContain("MeshKVLifecycle");
    expect(src).not.toContain("goOnline");
    expect(src).not.toContain("startSignaling");
  });

  it("10. does not mutate the input init options", async () => {
    const node = new MockNode();
    const initOptions: MeshKVInitOptions = { signal: {}, dbName: "x" };
    const before = { ...initOptions };
    const beforeKeys = Object.keys(initOptions).sort();
    const lc = new MeshKVBrowserLifecycle({ node, initOptions });
    await lc.prepare();
    await lc.goOnline();
    await lc.goOffline();
    expect(Object.keys(initOptions).sort()).toEqual(beforeKeys);
    expect(initOptions.signal).toBe(before.signal);
    expect(initOptions.dbName).toBe(before.dbName);
  });
});
