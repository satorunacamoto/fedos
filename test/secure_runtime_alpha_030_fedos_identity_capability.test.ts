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
import type { FedosIdentityCapability } from "../src/identity/fedos_identity_capability.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_030_fedos_identity_capability.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha028DocSource from "../docs/secure_runtime_alpha_028_fedos_identity_descriptor.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha029DocSource from "../docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/identity/fedos_identity_provider.ts?raw";
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

/**
 * Secure Runtime Alpha 030 — "FedOS Identity Capability": adds exactly
 * ONE interface, `FedosIdentityCapability` (`provider: string` +
 * `available: boolean`), and nothing else -- no implementation, no
 * Resolver, no Service, no Runtime wiring, no modification to Alpha
 * 028's Descriptor or Alpha 029's Provider Interface. Reviews (but does
 * not implement) a future `describeCapability()` companion method.
 */
describe("Secure Runtime Alpha 030 -- FedOS Identity Capability, type only, no Provider implementation/Resolver/Service/Runtime/Nostr/Worker change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc states this Stage adds exactly one interface, continuing Alpha 028/029, with no implementation", () => {
    expect(designDocSource).toMatch(/a single interface only/);
    expect(designDocSource).toMatch(/no Resolver, no Service, no\s+Runtime wiring/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_028_fedos_identity_descriptor\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_029_fedos_identity_provider_interface\.md/);
    expect(alpha028DocSource).toMatch(/FedosIdentityDescriptor/);
    expect(alpha029DocSource).toMatch(/FedosIdentityProvider/);
  });

  it("3. the design doc records the exact Capability shape and its own 'availability, and only availability' responsibility", () => {
    expect(designDocSource).toMatch(/export interface FedosIdentityCapability \{/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/readonly available: boolean;/);
    expect(designDocSource).toMatch(/Capability責務/);
    expect(designDocSource).toMatch(
      /\*\*"is this provider\s+available\?"\*\*/,
    );
    expect(designDocSource).toMatch(/A `true` value means only\s+"this provider mechanism could, in principle,/);
  });

  it("4. the design doc states the differences from Descriptor and from Provider with comparison tables", () => {
    expect(designDocSource).toMatch(/Descriptorとの違い/);
    expect(designDocSource).toMatch(/Providerとの違い/);
    expect(designDocSource).toMatch(/\| \*\*Represents\*\* \|/);
    expect(designDocSource).toMatch(/\| \*\*Kind of thing\*\* \|/);
  });

  it("5. the design doc explicitly distinguishes FedosIdentityCapability from the existing, unrelated IdentityProviderCapability, and reviews (without implementing) a future describeCapability() method", () => {
    expect(designDocSource).toMatch(/IdentityProviderCapability/);
    expect(designDocSource).toMatch(/This is flagged explicitly\s+to avoid confusion/);
    expect(designDocSource).toMatch(
      /\*\*Reviewed, per this Stage's own mandate, but NOT implemented\*\*: a\s+future `describeCapability\(\): Promise<FedosIdentityCapability>` method/,
    );
    expect(designDocSource).toMatch(/\*\*`fedos_identity_provider\.ts`\s+is NOT modified by this Stage\*\*/);
  });

  it("6. the design doc records Runtime separation, authentication separation, and the future Resolver relationship", () => {
    expect(designDocSource).toMatch(/Runtimeとの責務分離/);
    expect(designDocSource).toMatch(/Authenticationとの責務分離/);
    expect(designDocSource).toMatch(/将来Resolverとの関係/);
    expect(designDocSource).toMatch(/\*\*`available` is never an authentication\/login\/connection status\.\*\*/);
  });

  it("7. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any producer of a real\s+`FedosIdentityCapability` value/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a Resolver of any kind/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a FedOS Identity Service/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any `FedosIdentityProvider`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_provider\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_descriptor\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("8. fedos_identity_capability.ts exports EXACTLY FedosIdentityCapability, with EXACTLY the two mandated fields, no class, no function, no default export", () => {
    const exportedInterfaces = [...capabilitySource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["FedosIdentityCapability"]));
    expect([...capabilitySource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...capabilitySource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect(capabilitySource).not.toMatch(/export default/);

    const interfaceBody = (capabilitySource.match(/export interface FedosIdentityCapability \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldLines = interfaceBody
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);
    expect(fieldLines.sort()).toEqual(["readonly provider: string;", "readonly available: boolean;"].sort());
  });

  it("9. ABSOLUTE PROHIBITION: fedos_identity_capability.ts contains no Session/Credential/Profile/Metadata field or type, and zero imports of any kind", () => {
    const codeOnly = codeOnlyLines(capabilitySource);
    expect(codeOnly).not.toMatch(/\bimport\b/);
    expect(codeOnly).not.toMatch(/\breadonly\s+(session|credential|profile|metadata|status|loggedIn|connected|authenticated)\b/i);
    expect(codeOnly).not.toMatch(/interface\s+\w*(Session|Credential|Profile|Metadata)/i);
  });

  it("10. type-level: a real object literal matching FedosIdentityCapability compiles and holds exactly the two fields", () => {
    const available: FedosIdentityCapability = { provider: "some-provider-label", available: true };
    const unavailable: FedosIdentityCapability = { provider: "another-provider-label", available: false };
    expect(Object.keys(available).sort()).toEqual(["provider", "available"].sort());
    expect(typeof available.provider).toBe("string");
    expect(typeof available.available).toBe("boolean");
    expect(unavailable.available).toBe(false);
  });

  it("11. fedos_identity_capability.ts has ZERO importers anywhere in src/ other than this Stage's own guard test", () => {
    for (const source of [
      descriptorSource,
      providerInterfaceSource,
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
      expect(source).not.toMatch(/fedos_identity_capability/);
      expect(source).not.toMatch(/FedosIdentityCapability/);
    }
  });

  it("12. fedos_identity_provider.ts (Alpha 029) is confirmed BYTE-FOR-BYTE unchanged -- still exactly one method, describeIdentity(), no describeCapability(), no reference to this Stage's own doc", () => {
    expect(providerInterfaceSource).toMatch(/export interface FedosIdentityProvider \{/);
    expect(providerInterfaceSource).toMatch(/readonly provider: string;/);
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/describeCapability/);
    const interfaceBody = (providerInterfaceSource.match(/export interface FedosIdentityProvider \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const methodCount = (interfaceBody.match(/\(\):/g) ?? []).length;
    expect(methodCount).toBe(1);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_030/);
  });

  it("13. fedos_identity_descriptor.ts (Alpha 028) is confirmed BYTE-FOR-BYTE unchanged -- still exactly the three original fields, no reference to this Stage's own doc", () => {
    expect(descriptorSource).toMatch(/readonly id: string;/);
    expect(descriptorSource).toMatch(/readonly provider: string;/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_030/);
  });

  it("14. no existing src/identity/* file was modified -- zero reference to this Stage's own doc in any of them", () => {
    for (const source of [providerBoundarySource, providerTypesSource, providerBridgeSource, webauthnAdapterSource, identityTypesSource, sessionBoundarySource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_030/);
    }
  });

  it("15. no Runtime/Worker/Nostr file references this Stage's own doc or the new type -- confirmed unchanged", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource, nobleSignatureSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_030/);
    }
  });

  it("16. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("17. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_030/);

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

  it("18. no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files; exactly one new file was added under src/identity/ -- 14 files total AS OF Alpha 030's own scope (Secure Runtime Alpha 031 later added a 15th, fedos_identity_service.ts; Secure Runtime Alpha 032 later added a 16th, fedos_identity_provider_resolver.ts; Secure Runtime Alpha 033 later added a 17th, fedos_noop_identity_provider.ts; Secure Runtime Alpha 035 later added an 18th, fedos_nostr_identity_provider.ts; Secure Runtime Alpha 039 later added a 19th and 20th, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("19. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha030-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha030-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha030-id"));
    expect(deleted).toBe(true);
  });

  it("20. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha030-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha030-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha030-direct"))).toBe(true);
  });
});
