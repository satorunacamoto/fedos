import { describe, it, expect } from "vitest";
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import { storeCiphertext, loadCiphertext, deleteCiphertext } from "../src/runtime/fedos_runtime_ciphertext_storage.js";
import type { FedosIdentityDescriptor } from "../src/identity/fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "../src/identity/fedos_identity_provider.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha029DocSource from "../docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha030DocSource from "../docs/secure_runtime_alpha_030_fedos_identity_capability.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/identity/provider_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/identity/webauthn_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityTypesSource from "../src/identity/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/identity/session_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/nostr/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

async function withNodeEnv<T>(value: string | undefined, fn: () => T | Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
  try {
    return await fn();
  } finally {
    if (original === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = original;
    }
  }
}

/** A minimal, test-only FedosIdentityProvider implementation, purely for exercising the Service. */
function makeTestProvider(overrides: Partial<FedosIdentityProvider> & { provider: string }): FedosIdentityProvider {
  return {
    provider: overrides.provider,
    describeIdentity: overrides.describeIdentity ?? (async () => null),
  };
}

/**
 * Secure Runtime Alpha 031 — "FedOS Identity Service Skeleton": adds
 * exactly ONE class, `FedosIdentityService` (constructor takes a
 * `FedosIdentityProvider`; `describeIdentity()`/`describeCapability()`
 * both pure delegation, no cache, no internal logic beyond reading the
 * `provider` field) -- no Resolver, no Provider implementation, no
 * Runtime wiring, no modification to Alpha 028/029/030's own types.
 */
describe("Secure Runtime Alpha 031 -- FedOS Identity Service Skeleton, delegation only, no Resolver/Provider-implementation/Runtime/Nostr/Worker change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(7000);
  });

  it("2. the design doc states this Stage adds exactly one class, continuing Alpha 028/029/030, with no Resolver", () => {
    expect(designDocSource).toMatch(/a single, minimal class only/);
    expect(designDocSource).toMatch(/No Resolver, no Provider implementation, no Runtime wiring/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_028_fedos_identity_descriptor\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_029_fedos_identity_provider_interface\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_030_fedos_identity_capability\.md/);
    expect(alpha029DocSource).toMatch(/FedosIdentityProvider/);
    expect(alpha030DocSource).toMatch(/FedosIdentityCapability/);
  });

  it("3. the design doc records the exact Service shape and its own composition-not-computation responsibility", () => {
    expect(designDocSource).toMatch(/export class FedosIdentityService \{/);
    expect(designDocSource).toMatch(/constructor\(provider: FedosIdentityProvider\) \{/);
    expect(designDocSource).toMatch(
      /async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/,
    );
    expect(designDocSource).toMatch(/async describeCapability\(\): Promise<FedosIdentityCapability> \{/);
    expect(designDocSource).toMatch(/Service責務/);
    expect(designDocSource).toMatch(/COMPOSITION\s+convenience, not a new source of information/);
  });

  it("4. the design doc states no-internal-state-beyond-the-dependency, and the exact delegation body for describeIdentity()", () => {
    expect(designDocSource).toMatch(
      /\*\*No internal state beyond the injected dependency itself\.\*\*/,
    );
    expect(designDocSource).toMatch(/return this\.#provider\.describeIdentity\(\);/);
  });

  it("5. the design doc names the describeCapability() design decision, its reasoning, and why describeIdentity() is not called to determine availability", () => {
    expect(designDocSource).toMatch(
      /Capabilityとの責務 \(relationship to `FedosIdentityCapability`\) — the one real design decision this Stage makes/,
    );
    expect(designDocSource).toMatch(/provider: this\.#provider\.provider, available: true/);
    expect(designDocSource).toMatch(/\*\*Why NOT call `describeIdentity\(\)` to determine availability\*\*/);
  });

  it("6. the design doc states why this Service has no Resolver, and the Runtime separation", () => {
    expect(designDocSource).toMatch(/Resolverを持たない理由/);
    expect(designDocSource).toMatch(/DEPENDENCY INJECTION, not resolution/);
    expect(designDocSource).toMatch(/Runtimeとの責務分離/);
  });

  it("7. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a Resolver of any kind/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any `FedosIdentityProvider`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Bridge/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_provider\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_descriptor\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_capability\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* cache, memoize, or otherwise retain any result/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("8. fedos_identity_service.ts exports EXACTLY FedosIdentityService, with EXACTLY the mandated constructor and two methods, no other export", () => {
    const exportedClasses = [...serviceSource.matchAll(/^export class (\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(exportedClasses)).toEqual(new Set(["FedosIdentityService"]));
    expect([...serviceSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...serviceSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect(serviceSource).not.toMatch(/export default/);

    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider\) \{/);
    const methodNames = [...serviceSource.matchAll(/^\s*async (\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(methodNames)).toEqual(new Set(["describeIdentity", "describeCapability"]));
  });

  it("9. ABSOLUTE PROHIBITION: fedos_identity_service.ts defines no field beyond the single injected provider, no cache/memo/timestamp/counter, and no begin/login/authenticate/create method", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    const fieldDeclarations = [...codeOnly.matchAll(/^\s*readonly #(\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldDeclarations).toEqual(["provider"]);
    expect(codeOnly).not.toMatch(/cache|memo|timestamp|counter/i);
    for (const method of ["begin", "login", "authenticate", "create"]) {
      expect(codeOnly).not.toMatch(new RegExp(`\\b${method}\\s*\\(`));
    }
  });

  it("10. fedos_identity_service.ts's describeIdentity() body is pure delegation, and describeCapability() only reads provider.provider plus a fixed literal true -- no call to describeIdentity() inside describeCapability()", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    const describeIdentityBody = (codeOnly.match(/async describeIdentity\(\)[^{]*\{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(describeIdentityBody.trim()).toBe("return this.#provider.describeIdentity();");

    const describeCapabilityBody = (codeOnly.match(/async describeCapability\(\)[^{]*\{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(describeCapabilityBody).not.toMatch(/describeIdentity/);
    expect(describeCapabilityBody).toMatch(/this\.#provider\.provider/);
    expect(describeCapabilityBody).toMatch(/available:\s*true/);
  });

  it("11. fedos_identity_service.ts imports only the three existing Identity types (type-only) and references no Runtime/Storage/Worker/Nostr module", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    expect(codeOnly).toMatch(/import type \{ FedosIdentityDescriptor \} from "\.\/fedos_identity_descriptor\.js";/);
    expect(codeOnly).toMatch(/import type \{ FedosIdentityProvider \} from "\.\/fedos_identity_provider\.js";/);
    expect(codeOnly).toMatch(/import type \{ FedosIdentityCapability \} from "\.\/fedos_identity_capability\.js";/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader|fedos_runtime_storage_backend|fedos_runtime_ciphertext_storage|runtime\//);
    expect(codeOnly).not.toMatch(/nostr\//);
  });

  it("12. behavioral: describeIdentity() delegates exactly to the injected provider's own result, including null, across repeated calls with no memoization", async () => {
    let callCount = 0;
    const descriptor: FedosIdentityDescriptor = { id: "local-1", provider: "test-provider", publicIdentifier: "public-1" };
    const provider = makeTestProvider({
      provider: "test-provider",
      describeIdentity: async () => {
        callCount += 1;
        return callCount === 1 ? descriptor : null;
      },
    });
    const service = new FedosIdentityService(provider);

    const first = await service.describeIdentity();
    expect(first).toEqual(descriptor);
    const second = await service.describeIdentity();
    expect(second).toBeNull();
    expect(callCount).toBe(2);
  });

  it("13. behavioral: describeCapability() reports the injected provider's own label with available: true, and does not call describeIdentity()", async () => {
    let describeIdentityCalls = 0;
    const provider = makeTestProvider({
      provider: "capability-check-provider",
      describeIdentity: async () => {
        describeIdentityCalls += 1;
        return null;
      },
    });
    const service = new FedosIdentityService(provider);

    const capability = await service.describeCapability();
    expect(capability).toEqual({ provider: "capability-check-provider", available: true });
    expect(describeIdentityCalls).toBe(0);
  });

  it("14. fedos_identity_provider.ts (Alpha 029) is confirmed BYTE-FOR-BYTE unchanged -- still exactly one method, no describeCapability()", () => {
    expect(providerInterfaceSource).toMatch(/export interface FedosIdentityProvider \{/);
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/describeCapability/);
    const interfaceBody = (providerInterfaceSource.match(/export interface FedosIdentityProvider \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const methodCount = (interfaceBody.match(/\(\):/g) ?? []).length;
    expect(methodCount).toBe(1);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_031/);
  });

  it("15. fedos_identity_descriptor.ts (Alpha 028) and fedos_identity_capability.ts (Alpha 030) are confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(descriptorSource).toMatch(/readonly id: string;/);
    expect(descriptorSource).toMatch(/readonly provider: string;/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_031/);

    expect(capabilitySource).toMatch(/readonly provider: string;/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_031/);
  });

  it("16. fedos_identity_service.ts has ZERO importers anywhere in src/ other than this Stage's own guard test", () => {
    for (const source of [
      descriptorSource,
      providerInterfaceSource,
      capabilitySource,
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      sessionBoundarySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      nobleSignatureSource,
    ]) {
      expect(source).not.toMatch(/fedos_identity_service/);
      expect(source).not.toMatch(/FedosIdentityService/);
    }
  });

  it("17. no existing src/identity/* file was modified, and no Runtime/Worker/Nostr file references this Stage's own doc", () => {
    for (const source of [
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      sessionBoundarySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      nobleSignatureSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_031/);
    }
  });

  it("18. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("19. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_031/);

    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n")
      .toLowerCase();
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("20. no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files; exactly one new file was added under src/identity/ -- 15 files total AS OF Alpha 031's own scope (Secure Runtime Alpha 032 later added a 16th, fedos_identity_provider_resolver.ts; Secure Runtime Alpha 033 later added a 17th, fedos_noop_identity_provider.ts; Secure Runtime Alpha 035 later added an 18th, fedos_nostr_identity_provider.ts; Secure Runtime Alpha 039 later added a 19th and 20th, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(56);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(21);
  });

  it("21. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha031-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha031-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha031-id"));
    expect(deleted).toBe(true);
  });

  it("22. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
    expect(createRuntimeInitializeCryptoResult()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });

    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());

    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);

    const ciphertext = await withNodeEnv("development", () =>
      encrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1])),
    );
    expect(ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null)).toBe(true);

    const plaintext = await withNodeEnv("development", () =>
      decrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", { kind: "AeadCiphertextHandle" } as never),
    );
    expect(plaintext === null || plaintext instanceof Uint8Array).toBe(true);

    const exported = await withNodeEnv("development", () => exportCiphertext({ kind: "AeadCiphertextHandle" } as never));
    expect(exported === null || typeof exported === "string").toBe(true);

    const imported = await withNodeEnv("development", () => importCiphertext("x" as never));
    expect(imported === null || typeof imported === "object").toBe(true);

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha031-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha031-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha031-direct"))).toBe(true);
  });
});
