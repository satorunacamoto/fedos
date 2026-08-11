import { describe, it, expect } from "vitest";
import { NoopFederationProvider } from "../src/os/_legacy_prototype/federation/noop_federation.js";
import {
  FEDERATION_CAPABILITIES,
  FEDERATION_PROVIDER_KINDS,
} from "../src/os/_legacy_prototype/federation/types.js";
import type {
  FederationFetchDecision,
  FederationFetchRequest,
  FederationProvider,
  FederationPublishDecision,
  FederationPublishRequest,
  FederationStatus,
} from "../src/os/_legacy_prototype/federation/types.js";
import { createRuntime, selectFederationProvider } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/os/_legacy_prototype/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopFederationSource from "../src/os/_legacy_prototype/federation/noop_federation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const federationSources = [federationTypesSource, noopFederationSource].join("\n");
const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");

describe("NoopFederationProvider", () => {
  it("1. is always disconnected", async () => {
    const provider = new NoopFederationProvider();
    const status = provider.status();
    expect(status.state).toBe("disconnected");
    expect(status.descriptor.capabilities).toEqual([]);
  });

  it("2. connect() never reaches connected_placeholder", async () => {
    const provider = new NoopFederationProvider();
    const status = await provider.connect();
    expect(status.state).toBe("disconnected");
    expect(status.state).not.toBe("connected_placeholder");
  });

  it("3. disconnect() is a safe no-op", async () => {
    const provider = new NoopFederationProvider();
    await provider.connect();
    const status = await provider.disconnect();
    expect(status.state).toBe("disconnected");
  });

  it("4. publishPlaceholder denies and publishes nothing", async () => {
    const provider = new NoopFederationProvider();
    const decision = await provider.publishPlaceholder({ eventRef: "evt-1" });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("disconnected");
  });

  it("5. fetchPlaceholder denies and returns no items", async () => {
    const provider = new NoopFederationProvider();
    const decision = await provider.fetchPlaceholder({ targetRef: "board-1" });
    expect(decision.allowed).toBe(false);
    expect(decision.items).toEqual([]);
  });

  it("6. never throws", async () => {
    const provider = new NoopFederationProvider();
    expect(() => provider.status()).not.toThrow();
    await expect(provider.connect()).resolves.toBeDefined();
    await expect(provider.disconnect()).resolves.toBeDefined();
    await expect(provider.publishPlaceholder({})).resolves.toBeDefined();
    await expect(provider.fetchPlaceholder({})).resolves.toBeDefined();
  });
});

describe("FederationProvider labels", () => {
  it("7. every provider kind and capability is a placeholder label", () => {
    for (const kind of FEDERATION_PROVIDER_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
    for (const cap of FEDERATION_CAPABILITIES) {
      expect(cap).toMatch(/_placeholder$/);
    }
  });
});

describe("Stage 110 — Federation provider runtime selection", () => {
  it("8. no overrides -> NoopFederationProvider", () => {
    expect(selectFederationProvider()).toBeInstanceOf(NoopFederationProvider);
    expect(createRuntime().federationProvider).toBeInstanceOf(NoopFederationProvider);
  });

  it("9. overrides.federationProvider wins", () => {
    const stub = new NoopFederationProvider();
    expect(selectFederationProvider(undefined, { federationProvider: stub })).toBe(stub);
    const rt = createRuntime(undefined, { federationProvider: stub });
    expect(rt.federationProvider).toBe(stub);
  });

  it("10. createRuntime does not call connect/disconnect/publishPlaceholder/fetchPlaceholder", async () => {
    let connectCalls = 0;
    let disconnectCalls = 0;
    let publishCalls = 0;
    let fetchCalls = 0;
    const spy: FederationProvider = {
      status: (): FederationStatus => ({
        descriptor: { kind: "test_placeholder", capabilities: [], label: "spy" },
        state: "disconnected",
        reason: "",
      }),
      connect: async (): Promise<FederationStatus> => {
        connectCalls += 1;
        return {
          descriptor: { kind: "test_placeholder", capabilities: [], label: "spy" },
          state: "disconnected",
          reason: "",
        };
      },
      disconnect: async (): Promise<FederationStatus> => {
        disconnectCalls += 1;
        return {
          descriptor: { kind: "test_placeholder", capabilities: [], label: "spy" },
          state: "disconnected",
          reason: "",
        };
      },
      publishPlaceholder: async (
        _request: FederationPublishRequest,
      ): Promise<FederationPublishDecision> => {
        publishCalls += 1;
        return { allowed: false, state: "disconnected", reason: "" };
      },
      fetchPlaceholder: async (
        _request: FederationFetchRequest,
      ): Promise<FederationFetchDecision> => {
        fetchCalls += 1;
        return { allowed: false, state: "disconnected", reason: "", items: [] };
      },
    };
    const rt = createRuntime(undefined, { federationProvider: spy });
    expect(rt.federationProvider).toBe(spy);
    expect(connectCalls).toBe(0);
    expect(disconnectCalls).toBe(0);
    expect(publishCalls).toBe(0);
    expect(fetchCalls).toBe(0);
  });

  it("11. Worker source does not select or call a FederationProvider", () => {
    expect(workerSource).not.toMatch(/FederationProvider/);
    expect(workerSource).not.toMatch(/NoopFederationProvider/);
    expect(workerSource).not.toMatch(/from\s+['"].*federation\//);
  });
});

describe("federation boundary stays unwired and free of real network/protocol libraries", () => {
  it("12. imports no relay/WebSocket/HTTP/OAuth/AT-Protocol library", () => {
    const importLines = federationSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "ws",
      "websocket",
      "isomorphic-fetch",
      "node-fetch",
      "node:http",
      "node:https",
      "oauth",
      "@atproto",
      "atproto",
      "bsky",
      "activitypub",
      "rss-parser",
      "eventsource",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("13. issues no fetch, opens no WebSocket/EventSource, and starts no OAuth flow", () => {
    // Doc comments legitimately DISCUSS "OAuth"/"fetch"/etc. as things that
    // are NOT done; the real invariant is that none is actually invoked.
    expect(federationSources).not.toMatch(/\bfetch\s*\(/);
    expect(federationSources).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    expect(federationSources).not.toMatch(/\bnew\s+EventSource\s*\(/);
    expect(federationSources).not.toMatch(/oauth\w*\s*\(/i);
    expect(federationSources).not.toMatch(/signEvent\s*\(|nip44\s*\(|nip17\s*\(/i);
  });

  it("14. does not import StorageBackend or any CryptoProvider", () => {
    // Doc comments legitimately NAME `StorageBackend`/`CryptoProvider` when
    // explaining that this boundary is separate from them; the real
    // invariant is no import/type-usage.
    expect(federationSources).not.toMatch(/from\s+['"].*storage\//);
    expect(federationSources).not.toMatch(/from\s+['"].*crypto\//);
    expect(federationSources).not.toMatch(/:\s*(StorageBackend|CryptoProvider)\b/);
    expect(federationSources).not.toMatch(/implements\s+(StorageBackend|CryptoProvider)\b/);
  });

  it("15. types declare no bytes/content/body field", () => {
    expect(federationTypesSource).not.toMatch(/readonly\s+bytes\s*[?:]/);
    expect(federationTypesSource).not.toMatch(/readonly\s+content\s*[?:]/);
    expect(federationTypesSource).not.toMatch(/readonly\s+body\s*[?:]/);
  });

  it("16. Runtime source imports no relay/WebSocket/OAuth/AT-Protocol library for federation selection", () => {
    const importLines = runtimeSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = ["oauth", "@atproto", "atproto", "bsky", "activitypub"];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("17. input is not mutated by selectFederationProvider or createRuntime", () => {
    const request: FederationPublishRequest = { eventRef: "evt-1" };
    const snapshot = JSON.stringify(request);
    selectFederationProvider();
    createRuntime();
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});
