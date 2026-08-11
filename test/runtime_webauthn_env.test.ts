import { describe, it, expect } from "vitest";
import {
  createRuntime,
  selectWebAuthnProvider,
} from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/os/_legacy_prototype/runtime/types.js";
import {
  NoopWebAuthnProvider,
  PlaceholderWebAuthnProvider,
  type WebAuthnAdapterRequest,
  type WebAuthnProvider,
  type WebAuthnReport,
} from "../src/os/core/identity/webauthn_adapter.js";
import { buildRuntimeStatusView } from "../src/os/_legacy_prototype/render/runtime_status.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import statusSource from "../src/os/_legacy_prototype/render/runtime_status.ts?raw";

describe("Stage 62 — WebAuthn provider runtime env selection (disabled by default)", () => {
  it("1. no env -> NoopWebAuthnProvider", () => {
    expect(selectWebAuthnProvider()).toBeInstanceOf(NoopWebAuthnProvider);
    expect(createRuntime().webAuthnProvider).toBeInstanceOf(NoopWebAuthnProvider);
  });

  it("2. WEBAUTHN_PROVIDER=noop -> NoopWebAuthnProvider", () => {
    const env: RuntimeEnv = { WEBAUTHN_PROVIDER: "noop" };
    expect(selectWebAuthnProvider(env)).toBeInstanceOf(NoopWebAuthnProvider);
    expect(createRuntime(env).webAuthnProvider).toBeInstanceOf(NoopWebAuthnProvider);
  });

  it("3. WEBAUTHN_PROVIDER=placeholder -> PlaceholderWebAuthnProvider", () => {
    const env: RuntimeEnv = { WEBAUTHN_PROVIDER: "placeholder" };
    expect(selectWebAuthnProvider(env)).toBeInstanceOf(PlaceholderWebAuthnProvider);
    expect(createRuntime(env).webAuthnProvider).toBeInstanceOf(PlaceholderWebAuthnProvider);
  });

  it("4. ENABLE_WEBAUTHN_PLACEHOLDER truthy -> PlaceholderWebAuthnProvider", () => {
    for (const flag of ["true", "1", "yes", "on", true] as const) {
      const env: RuntimeEnv = { ENABLE_WEBAUTHN_PLACEHOLDER: flag };
      expect(selectWebAuthnProvider(env)).toBeInstanceOf(PlaceholderWebAuthnProvider);
    }
    // Falsy values must not opt in.
    for (const flag of ["false", "0", "no", "off", false, ""] as const) {
      const env: RuntimeEnv = { ENABLE_WEBAUTHN_PLACEHOLDER: flag };
      expect(selectWebAuthnProvider(env)).toBeInstanceOf(NoopWebAuthnProvider);
    }
  });

  it("5. invalid / unknown WEBAUTHN_PROVIDER -> NoopWebAuthnProvider", () => {
    for (const provider of ["face_id", "touch_id", "webauthn", "", "PLACEHOLDER", "Noop"]) {
      const env: RuntimeEnv = { WEBAUTHN_PROVIDER: provider };
      expect(selectWebAuthnProvider(env)).toBeInstanceOf(NoopWebAuthnProvider);
    }
  });

  it("6. overrides.webAuthnProvider wins over env", () => {
    const stub = new NoopWebAuthnProvider();
    const envPlaceholder: RuntimeEnv = { WEBAUTHN_PROVIDER: "placeholder" };
    expect(selectWebAuthnProvider(envPlaceholder, { webAuthnProvider: stub })).toBe(stub);
    const rt = createRuntime(envPlaceholder, { webAuthnProvider: stub });
    expect(rt.webAuthnProvider).toBe(stub);
    expect(selectWebAuthnProvider(undefined, { webAuthnProvider: stub })).toBe(stub);
  });

  it("7. createRuntime does not call begin()", () => {
    let beginCalls = 0;
    const spy: WebAuthnProvider = {
      getStatus: () => ({ status: "idle", reason: "" }),
      getCapabilities: () => [],
      begin: (_request: WebAuthnAdapterRequest): WebAuthnReport => {
        beginCalls += 1;
        return { status: "authenticated_placeholder", reason: "" };
      },
      cancel: () => ({ status: "cancelled", reason: "" }),
    };
    const rt = createRuntime({ WEBAUTHN_PROVIDER: "placeholder" }, { webAuthnProvider: spy });
    expect(rt.webAuthnProvider).toBe(spy);
    expect(beginCalls).toBe(0);
  });

  it("8. createRuntime does not call cancel()", () => {
    let cancelCalls = 0;
    const spy: WebAuthnProvider = {
      getStatus: () => ({ status: "idle", reason: "" }),
      getCapabilities: () => [],
      begin: (): WebAuthnReport => ({ status: "authenticated_placeholder", reason: "" }),
      cancel: (): WebAuthnReport => {
        cancelCalls += 1;
        return { status: "cancelled", reason: "" };
      },
    };
    createRuntime(undefined, { webAuthnProvider: spy });
    expect(cancelCalls).toBe(0);
  });

  it("9. createRuntime touches no navigator.credentials (none in the runtime sources)", () => {
    const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");
    expect(runtimeSources).not.toContain("navigator.credentials");
    expect(runtimeSources).not.toMatch(/navigator\s*\.\s*credentials/);
    // Building a runtime does not throw even though there is no `navigator`.
    expect(() => createRuntime({ WEBAUTHN_PROVIDER: "placeholder" })).not.toThrow();
    expect(() => createRuntime({ ENABLE_WEBAUTHN_PLACEHOLDER: "true" })).not.toThrow();
  });

  it("10. Worker source has no begin()/cancel() auto-call on the WebAuthn provider", () => {
    expect(workerSource).not.toMatch(/webAuthnProvider\s*\.\s*begin\s*\(/);
    expect(workerSource).not.toMatch(/webAuthnProvider\s*\.\s*cancel\s*\(/);
    // No WebAuthn provider is constructed or begun from the Worker at all.
    expect(workerSource).not.toMatch(/new\s+PlaceholderWebAuthnProvider/);
    expect(workerSource).not.toMatch(/new\s+NoopWebAuthnProvider/);
  });

  it("11. Worker source has no navigator.credentials", () => {
    expect(workerSource).not.toContain("navigator.credentials");
    expect(workerSource).not.toMatch(/navigator\s*\.\s*credentials/);
  });

  it("12. runtime status page shows a WebAuthn label only, calling no provider method", () => {
    // The status source references only `constructor.name` reads — never begin/cancel.
    expect(statusSource).not.toMatch(/\.\s*begin\s*\(/);
    expect(statusSource).not.toMatch(/\.\s*cancel\s*\(/);
    expect(statusSource).not.toContain("navigator.credentials");

    let calls = 0;
    const spy: WebAuthnProvider = {
      getStatus: () => {
        calls += 1;
        return { status: "idle", reason: "" };
      },
      getCapabilities: () => {
        calls += 1;
        return [];
      },
      begin: () => {
        calls += 1;
        return { status: "authenticated_placeholder", reason: "" };
      },
      cancel: () => {
        calls += 1;
        return { status: "cancelled", reason: "" };
      },
    };
    const runtime = createRuntime(undefined, { webAuthnProvider: spy });
    const view = buildRuntimeStatusView(runtime);
    const webauthn = view.components.find((c) => c.name === "webAuthnProvider");
    expect(webauthn).toBeDefined();
    expect(webauthn!.category).toBe("security");
    // A coarse constructor label only; no provider method was called.
    expect(calls).toBe(0);
  });

  it("13. input env is not mutated by selectWebAuthnProvider or createRuntime", () => {
    const env: RuntimeEnv = {
      WEBAUTHN_PROVIDER: "placeholder",
      ENABLE_WEBAUTHN_PLACEHOLDER: "true",
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    selectWebAuthnProvider(env);
    createRuntime(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    for (const key of beforeKeys) {
      expect(env[key as keyof RuntimeEnv]).toBe(before[key as keyof RuntimeEnv]);
    }
  });
});
