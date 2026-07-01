import { describe, it, expect } from "vitest";
import {
  MeshKV,
  createMeshKV,
  LocalCache,
  PeerCache,
  SignalingChannel,
} from "../packages/meshkv/src/index.js";
import type { MeshKVApi } from "../packages/meshkv/src/index.js";
// Package sources as strings: prove the package never depends on the host.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import indexSrc from "../packages/meshkv/src/index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import meshkvSrc from "../packages/meshkv/src/meshkv.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import typesSrc from "../packages/meshkv/src/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import localSrc from "../packages/meshkv/src/local_cache.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import peerSrc from "../packages/meshkv/src/peer_cache.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import signalingSrc from "../packages/meshkv/src/signaling.ts?raw";

const PACKAGE_SOURCES: Record<string, string> = {
  "index.ts": indexSrc,
  "meshkv.ts": meshkvSrc,
  "types.ts": typesSrc,
  "local_cache.ts": localSrc,
  "peer_cache.ts": peerSrc,
  "signaling.ts": signalingSrc,
};

describe("meshkv package entry point", () => {
  it("1. exposes a stable entry point with the reference node + contract", () => {
    expect(typeof createMeshKV).toBe("function");
    expect(MeshKV).toBeTypeOf("function");
    expect(LocalCache).toBeTypeOf("function");
    expect(PeerCache).toBeTypeOf("function");
    expect(SignalingChannel).toBeTypeOf("function");
  });

  it("2. createMeshKV() returns a node satisfying the real MeshKV API surface", () => {
    const node: MeshKVApi = createMeshKV();
    expect(node.get).toBeTypeOf("function");
    expect(node.put).toBeTypeOf("function");
    expect(node.remove).toBeTypeOf("function");
    expect(node.init).toBeTypeOf("function");
  });
});

describe("meshkv package isolation (no host dependency)", () => {
  /** Every `import ... from "x"` / `export ... from "x"` specifier in a source. */
  function moduleSpecifiers(src: string): string[] {
    const specifiers: string[] = [];
    const re = /\bfrom\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(src)) !== null) specifiers.push(match[1]!);
    return specifiers;
  }

  it("3. every package import is a package-internal ./ path (never escapes to host src)", () => {
    for (const [name, src] of Object.entries(PACKAGE_SOURCES)) {
      for (const spec of moduleSpecifiers(src)) {
        // Package files import only sibling modules; any `../` would escape the
        // package (e.g. into the host's src/asset) — that must never happen.
        expect(spec.startsWith("./"), `${name} imports ${spec}`).toBe(true);
        expect(spec, name).not.toContain("src");
        expect(spec, name).not.toContain("asset");
      }
    }
  });
});

describe("meshkv package starts no network on its own", () => {
  it("4. constructing a node opens no signaling / peer connection", () => {
    const node = new MeshKV();
    expect(node.online).toBe(false);
    expect(node.meshWired).toBe(false);
    expect(node.signaling.isOpen).toBe(false);
  });

  it("5. init() (even with a signal) wires handlers but opens no socket", async () => {
    const node = new MeshKV();
    await node.init(); // no signal
    expect(node.meshWired).toBe(false);
    expect(node.online).toBe(false);
    await node.init({ signal: {} }); // signal present -> wiring only
    expect(node.meshWired).toBe(true);
    expect(node.online).toBe(false);
    expect(node.signaling.isOpen).toBe(false);
  });

  it("6. going online requires an explicit startSignaling()", async () => {
    const node = new MeshKV();
    await node.startSignaling();
    expect(node.signaling.isOpen).toBe(true);
    expect(node.online).toBe(true);
    await node.stop();
    expect(node.online).toBe(false);
  });

  it("7. get/put/remove are local-tier only and never go online", async () => {
    const node = new MeshKV();
    const bytes = new TextEncoder().encode("data").buffer;
    await node.put("k", bytes, "image/png");
    await expect(node.get("k")).resolves.not.toBeNull();
    await node.remove("k");
    expect(node.online).toBe(false);
    expect(node.signaling.isOpen).toBe(false);
  });
});
