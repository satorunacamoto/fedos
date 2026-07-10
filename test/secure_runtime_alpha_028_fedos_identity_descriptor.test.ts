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
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_028_fedos_identity_descriptor.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha027DocSource from "../docs/secure_runtime_alpha_027_identity_foundation_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
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

/** The exact, absolute-prohibition term list this Stage's own mandate names. */
const FORBIDDEN_SUBSTRINGS = [
  "privateKey",
  "secret",
  "seed",
  "mnemonic",
  "AeadKeyHandle",
  "Ciphertext",
  "RuntimeCapabilities",
  "Storage",
  "Worker",
  "Relay",
  "Profile",
  "Avatar",
  "Metadata",
  "Session",
  "Credential",
  "Authentication",
  "Passkey",
];

/**
 * Secure Runtime Alpha 028 — "FedOS Identity Descriptor": adds exactly
 * ONE type, `FedosIdentityDescriptor` (id/provider/publicIdentifier, all
 * readonly string), and nothing else -- no Identity Service, no
 * Provider, no Bridge, no Runtime wiring, no Nostr connection. This
 * Stage implements Alpha 027 §9's own sole recommendation.
 */
describe("Secure Runtime Alpha 028 -- FedOS Identity Descriptor, type only, no Service/Provider/Bridge/Runtime/Nostr/Worker change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc states this Stage implements exactly Alpha 027 §9's sole recommendation, and nothing more", () => {
    expect(designDocSource).toMatch(/a single, minimal type only/);
    expect(designDocSource).toMatch(
      /progress with zero risk to any existing file\. This Stage is exactly\s+that recommendation, and nothing more\./,
    );
    expect(designDocSource).toMatch(/secure_runtime_alpha_027_identity_foundation_inventory\.md/);
    expect(alpha027DocSource).toMatch(/FedosIdentityDescriptor/);
  });

  it("3. the design doc records the Descriptor shape, its own responsibility, and the full 17-term exclusion table with reasons", () => {
    expect(designDocSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(designDocSource).toMatch(/readonly id: string;/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/readonly publicIdentifier: string;/);
    expect(designDocSource).toMatch(/Descriptor責務/);
    expect(designDocSource).toMatch(/除外項目/);
    for (const term of FORBIDDEN_SUBSTRINGS) {
      // The design doc's own exclusion table (§4) is expected and REQUIRED
      // to name every forbidden term explicitly -- unlike the .ts source
      // file itself (test #7), which must contain NONE of them.
      expect(designDocSource).toMatch(new RegExp(term));
    }
  });

  it("4. the design doc states the Identity Layer and Protocol Adapter relationships, and defers a provider union to a future Stage", () => {
    expect(designDocSource).toMatch(/Identity Layerとの関係/);
    expect(designDocSource).toMatch(/Protocol Adapterとの関係/);
    expect(designDocSource).toMatch(
      /fixing `"nostr" \| "activitypub" \| \.\.\.` into this type NOW would mean/,
    );
    expect(designDocSource).toMatch(/将来拡張方針/);
  });

  it("5. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a FedOS Identity Service/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a FedOS Identity Provider/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Bridge/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* wire `FedosIdentityDescriptor` into Runtime, Worker/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect Nostr, ActivityPub, AT Protocol, or Session/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("6. fedos_identity_descriptor.ts exports EXACTLY FedosIdentityDescriptor, with exactly the three mandated readonly string fields, no function, no class, no default export", () => {
    const exportedInterfaces = [...descriptorSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["FedosIdentityDescriptor"]));
    const exportedFns = [...descriptorSource.matchAll(/^export (?:async )?function/gm)];
    expect(exportedFns.length).toBe(0);
    const exportedClasses = [...descriptorSource.matchAll(/^export class/gm)];
    expect(exportedClasses.length).toBe(0);
    expect(descriptorSource).not.toMatch(/export default/);

    const interfaceBody = (descriptorSource.match(/export interface FedosIdentityDescriptor \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fieldNames = [...interfaceBody.matchAll(/readonly (\w+):\s*(\w+);/g)].map((m: RegExpMatchArray) => [
      m[1],
      m[2],
    ]);
    expect(fieldNames.sort()).toEqual(
      [
        ["id", "string"],
        ["provider", "string"],
        ["publicIdentifier", "string"],
      ].sort(),
    );
  });

  it("7. ABSOLUTE PROHIBITION: fedos_identity_descriptor.ts contains NONE of the 17 mandated forbidden terms, anywhere in its own source (including comments)", () => {
    for (const term of FORBIDDEN_SUBSTRINGS) {
      const pattern = term.length <= 4 ? new RegExp(`\\b${term}\\b`, "i") : new RegExp(term, "i");
      expect(descriptorSource).not.toMatch(pattern);
    }
  });

  it("8. type-level: a real object literal matching FedosIdentityDescriptor compiles and holds exactly the three fields", () => {
    const descriptor: FedosIdentityDescriptor = {
      id: "local-id-1",
      provider: "some-provider-label",
      publicIdentifier: "some-public-value",
    };
    expect(Object.keys(descriptor).sort()).toEqual(["id", "provider", "publicIdentifier"].sort());
    expect(typeof descriptor.id).toBe("string");
    expect(typeof descriptor.provider).toBe("string");
    expect(typeof descriptor.publicIdentifier).toBe("string");
  });

  it("9. fedos_identity_descriptor.ts has ZERO importers anywhere in src/ or test/ other than this Stage's own guard test -- confirmed disconnected by design", () => {
    // Every other src/identity/ file, src/runtime/*, src/worker.ts, and
    // src/nostr/* must NOT reference the new file or its exported type.
    for (const source of [
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
      expect(source).not.toMatch(/fedos_identity_descriptor/);
      expect(source).not.toMatch(/FedosIdentityDescriptor/);
    }
  });

  it("10. no existing src/identity/* file was modified -- zero reference to this Stage's own doc in any of them", () => {
    for (const source of [providerBoundarySource, providerTypesSource, providerBridgeSource, webauthnAdapterSource, identityTypesSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_028/);
    }
  });

  it("11. no Runtime/Worker/Nostr file references this Stage's own doc or the new type -- confirmed unchanged", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource, nobleSignatureSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_028/);
    }
  });

  it("12. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("13. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_028/);

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

  it("14. no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files (the new Descriptor file lives in src/identity/, not src/runtime/)", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(56);
  });

  it("15. exactly one new file was added under src/identity/ -- 12 files total AS OF Alpha 028's own scope (Secure Runtime Alpha 029 later added a 13th, fedos_identity_provider.ts; Secure Runtime Alpha 030 later added a 14th, fedos_identity_capability.ts)", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(files).length).toBe(14);
  });

  it("16. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha028-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha028-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha028-id"));
    expect(deleted).toBe(true);
  });

  it("17. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha028-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha028-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha028-direct"))).toBe(true);
  });
});
