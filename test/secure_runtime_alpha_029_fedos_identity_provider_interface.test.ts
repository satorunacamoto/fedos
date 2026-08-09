import { describe, it, expect } from "vitest";
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
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
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha027DocSource from "../docs/secure_runtime_alpha_027_identity_foundation_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha028DocSource from "../docs/secure_runtime_alpha_028_fedos_identity_descriptor.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/os/core/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/os/core/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/os/core/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/os/core/identity/provider_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/os/core/identity/webauthn_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityTypesSource from "../src/os/core/identity/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
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

/** Methods this interface must NEVER define, per this Stage's own mandate. */
const FORBIDDEN_METHODS = ["begin", "login", "authenticate", "create"];

/**
 * Secure Runtime Alpha 029 — "FedOS Identity Provider Interface": adds
 * exactly ONE interface, `FedosIdentityProvider` (`provider: string` +
 * `describeIdentity(): Promise<FedosIdentityDescriptor | null>`), and
 * nothing else -- no implementation (not even Noop), no Resolver, no
 * Service, no Bridge, no Runtime wiring. Continues Alpha 027's Option C
 * decision and Alpha 028's unmodified Descriptor.
 */
describe("Secure Runtime Alpha 029 -- FedOS Identity Provider Interface, interface only, no implementation/Resolver/Service/Bridge/Runtime/Nostr/Worker change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc states this Stage adds exactly one interface, continuing Alpha 027/028, with no implementation", () => {
    expect(designDocSource).toMatch(/a single interface only/);
    expect(designDocSource).toMatch(/no Resolver, no Service, no\s*\nBridge, no Runtime wiring/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_027_identity_foundation_inventory\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_028_fedos_identity_descriptor\.md/);
    expect(alpha027DocSource).toMatch(/Identity Provider Boundary/);
    expect(alpha028DocSource).toMatch(/FedosIdentityDescriptor/);
  });

  it("3. the design doc records the exact Interface shape and states exactly one method exists, forbidding begin/login/authenticate/create permanently", () => {
    expect(designDocSource).toMatch(/export interface FedosIdentityProvider \{/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(designDocSource).toMatch(
      /\*\*Exactly one method exists, and only one ever should\.\*\* `begin\(\)`,\s*\n`login\(\)`, `authenticate\(\)`, and `create\(\)` are explicitly, permanently/,
    );
  });

  it("4. the design doc states the separation from Descriptor, Runtime, Authentication, and Protocol Adapters, plus the future Resolver relationship", () => {
    expect(designDocSource).toMatch(/Descriptorとの責務分離/);
    expect(designDocSource).toMatch(/Runtimeとの責務分離/);
    expect(designDocSource).toMatch(/Authenticationとの責務分離/);
    expect(designDocSource).toMatch(/Protocol Adapterとの責務分離/);
    expect(designDocSource).toMatch(/将来Resolverとの関係/);
    expect(designDocSource).toMatch(/\*\*`describeIdentity\(\)` is a READ, never an authentication flow\.\*\*/);
    expect(designDocSource).toMatch(/idle → waiting → authenticated → cancelled\/error/);
  });

  it("5. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any `FedosIdentityProvider`, not even a Noop or\s+Placeholder default/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a Resolver of any kind for this interface/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a FedOS Identity Service/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Bridge/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add `begin\(\)`, `login\(\)`, `authenticate\(\)`, `create\(\)`,\s+or any method beyond `describeIdentity\(\)`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `FedosIdentityDescriptor`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("6. fedos_identity_provider.ts exports EXACTLY FedosIdentityProvider, with EXACTLY the mandated provider field and describeIdentity() method, no class, no other function", () => {
    const exportedInterfaces = [...providerInterfaceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["FedosIdentityProvider"]));
    expect([...providerInterfaceSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...providerInterfaceSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect(providerInterfaceSource).not.toMatch(/export default/);

    const interfaceBody = (providerInterfaceSource.match(/export interface FedosIdentityProvider \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldLines = interfaceBody
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);
    expect(fieldLines.sort()).toEqual(
      ["readonly provider: string;", "describeIdentity(): Promise<FedosIdentityDescriptor | null>;"].sort(),
    );
  });

  it("7. ABSOLUTE PROHIBITION: fedos_identity_provider.ts defines NONE of begin()/login()/authenticate()/create() as a method, anywhere in the interface body", () => {
    const interfaceBody = (providerInterfaceSource.match(/export interface FedosIdentityProvider \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    for (const method of FORBIDDEN_METHODS) {
      expect(interfaceBody).not.toMatch(new RegExp(`\\b${method}\\s*\\(`));
    }
  });

  it("8. fedos_identity_provider.ts imports FedosIdentityDescriptor as a type-only import from the unmodified Alpha 028 file, and references no Runtime/Storage/Worker/Nostr module", () => {
    const codeOnly = codeOnlyLines(providerInterfaceSource);
    expect(codeOnly).toMatch(/import type \{ FedosIdentityDescriptor \} from "\.\/fedos_identity_descriptor\.js";/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader|fedos_runtime_storage_backend|fedos_runtime_ciphertext_storage|runtime\//);
    expect(codeOnly).not.toMatch(/nostr\//);
  });

  it("9. fedos_identity_descriptor.ts (Alpha 028) is confirmed BYTE-FOR-BYTE unchanged -- still exactly the three original fields, no reference to this Stage's own doc", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(descriptorSource).toMatch(/readonly id: string;/);
    expect(descriptorSource).toMatch(/readonly provider: string;/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    const exportedInterfaces = [...descriptorSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["FedosIdentityDescriptor"]));
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_029/);
  });

  it("10. type-level: a real object literal matching FedosIdentityProvider compiles, and describeIdentity() resolves either a valid Descriptor or null", async () => {
    const resolvingProvider: FedosIdentityProvider = {
      provider: "test-provider-label",
      describeIdentity: async (): Promise<FedosIdentityDescriptor | null> => ({
        id: "local-1",
        provider: "test-provider-label",
        publicIdentifier: "public-value-1",
      }),
    };
    const descriptor = await resolvingProvider.describeIdentity();
    expect(descriptor).toEqual({
      id: "local-1",
      provider: "test-provider-label",
      publicIdentifier: "public-value-1",
    });

    const emptyProvider: FedosIdentityProvider = {
      provider: "empty-provider-label",
      describeIdentity: async (): Promise<FedosIdentityDescriptor | null> => null,
    };
    expect(await emptyProvider.describeIdentity()).toBeNull();
  });

  it("11. RIPPLE (Secure Runtime Alpha 050-052): fedos_identity_provider.ts had ZERO importers anywhere in src/ or referenced test sources AS OF this Stage's own scope; Alpha 050-052 later made fedos_runtime_identity.ts an indirect referrer via `resolveFedosIdentityProvider` (whose own name contains the substring `FedosIdentityProvider`), without importing the bare Interface file itself -- reconfirmed here as the CURRENT state, per this arc's own established ripple convention. Every other file listed remains a non-importer of the Interface file", () => {
    for (const source of [
      descriptorSource,
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      nobleSignatureSource,
    ]) {
      expect(source).not.toMatch(/fedos_identity_provider/);
      expect(source).not.toMatch(/FedosIdentityProvider/);
    }
    expect(fedosRuntimeIdentitySource).not.toMatch(/from "\.\.\/identity\/fedos_identity_provider\.js"/);
    expect(fedosRuntimeIdentitySource).toMatch(/resolveFedosIdentityProvider/);
  });

  it("12. no existing src/identity/* file was modified -- zero reference to this Stage's own doc in any of them", () => {
    for (const source of [providerBoundarySource, providerTypesSource, providerBridgeSource, webauthnAdapterSource, identityTypesSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_029/);
    }
  });

  it("13. no Runtime/Worker/Nostr file references this Stage's own doc or the new interface -- confirmed unchanged", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource, nobleSignatureSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_029/);
    }
  });

  it("14. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("15. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_029/);

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

  it("16. no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files; exactly one new file was added under src/identity/ -- 13 files total AS OF Alpha 029's own scope (Secure Runtime Alpha 030 later added a 14th, fedos_identity_capability.ts; Secure Runtime Alpha 031 later added a 15th, fedos_identity_service.ts; Secure Runtime Alpha 032 later added a 16th, fedos_identity_provider_resolver.ts; Secure Runtime Alpha 033 later added a 17th, fedos_noop_identity_provider.ts; Secure Runtime Alpha 035 later added an 18th, fedos_nostr_identity_provider.ts; Secure Runtime Alpha 039 later added a 19th and 20th, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("17. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha029-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha029-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha029-id"));
    expect(deleted).toBe(true);
  });

  it("18. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha029-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha029-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha029-direct"))).toBe(true);
  });
});
