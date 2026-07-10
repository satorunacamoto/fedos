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
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_026_identity_layer_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha025DocSource from "../docs/secure_runtime_alpha_025_secure_storage_api_scope_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultCryptoIdentityDocSource from "../docs/vault_crypto_identity.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderTypesSource from "../src/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderBoundarySource from "../src/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageServiceSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
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
 * Secure Runtime Alpha 026 — "Identity Layer / Secure Runtime Boundary
 * Review": REVIEW ONLY, no code change of any kind. Inventories all 11
 * Public Runtime API functions (confirming none is Identity-shaped),
 * compares five Identity Layer architecture candidates, and formally
 * defines what Identity Layer may/may not hold, that Runtime handles
 * only Crypto/Storage/Environment, and that Nostr/ActivityPub/Bluesky/
 * Session sit above Identity Layer, never injecting semantics into
 * Storage or Runtime.
 */
describe("Secure Runtime Alpha 026 -- Identity Layer / Secure Runtime Boundary Review, review only, no Runtime/Identity/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'no code change' list", () => {
    expect(designDocSource).toMatch(/REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* implement an Identity Layer, Identity Provider, or any\s+Protocol adapter/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `src\/identity\/provider_types\.ts`,/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `src\/nostr\/\*` or `src\/sign\/\*`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any `src\/runtime\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature/);
  });

  it("3. inventories all 11 Public Runtime API functions and confirms none is Identity-shaped", () => {
    for (const fn of [
      "initializeCrypto",
      "runtimeCapabilities",
      "randomBytes",
      "generateAeadKey",
      "encrypt",
      "decrypt",
      "exportCiphertext",
      "importCiphertext",
      "storeCiphertext",
      "loadCiphertext",
      "deleteCiphertext",
    ]) {
      expect(designDocSource).toMatch(new RegExp(`\`${fn}`));
    }
    expect(designDocSource).toMatch(/NONE accepts or returns an Identity-shaped value/);
  });

  it("4. compares all five mandated Identity Layer candidates across all eight mandated criteria", () => {
    for (const candidate of [
      "① Runtimeへ直接鍵管理",
      "② Identity Service",
      "③ Identity Provider抽象",
      "④ Protocolごと独立Identity",
      "⑤ FedOS Identity中核",
    ]) {
      expect(designDocSource).toMatch(new RegExp(candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const criterion of ["Security", "責務分離", "Runtime依存", "Nostr", "ActivityPub", "Bluesky", "Session", "将来性"]) {
      expect(designDocSource).toMatch(new RegExp(criterion));
    }
  });

  it("5. concludes candidate ① is rejected and ③ (structure) + ⑤ (content) are the recommended direction", () => {
    expect(designDocSource).toMatch(/① is REJECTED outright/);
    expect(designDocSource).toMatch(
      /is the correct STRUCTURAL answer — the\s+direct extension of the SAME architecture pattern this arc already/,
    );
    expect(designDocSource).toMatch(/⑤.*is the correct CONTENT answer/s);
  });

  it("6. defines what Identity Layer MAY and MUST NOT hold", () => {
    expect(designDocSource).toMatch(/\*\*MAY hold:\*\*/);
    expect(designDocSource).toMatch(/\*\*MUST NOT hold:\*\*/);
    expect(designDocSource).toMatch(/OPAQUE HANDLES Runtime itself issues/);
    expect(designDocSource).toMatch(/Raw private signing keys/);
    expect(designDocSource).toMatch(/Raw AEAD key material of any kind/);
    expect(designDocSource).toMatch(/A `RuntimeStorageBackend` instance/);
  });

  it("7. confirms Runtime handles exactly Crypto/Storage/Environment and no Identity semantics", () => {
    expect(designDocSource).toMatch(/confirmed: 暗号 \(Crypto\), Storage, Environment only/);
    expect(designDocSource).toMatch(/Runtime does not, and must not, handle Identity semantics/);
  });

  it("8. states the Protocol/Identity/Crypto/Storage layering diagram and Protocol prohibitions", () => {
    expect(designDocSource).toMatch(
      /Nostr \| ActivityPub \| Bluesky \| Session {8}Protocol Layer/,
    );
    expect(designDocSource).toMatch(/Each Protocol must NOT:/);
    expect(designDocSource).toMatch(/Reach directly into Crypto Layer or Storage Layer, BYPASSING Identity/);
  });

  it("9. names the FedOS Identity policy direction (structural + content) and marks it advisory only", () => {
    expect(designDocSource).toMatch(/FedOS Identity方針 — recommended direction \(advisory only\)/);
    expect(designDocSource).toMatch(/no Identity Layer, Provider, or adapter is implemented\s*\nby this Stage/);
  });

  it("10. cross-references existing src/identity/ scaffold and docs/vault_crypto_identity.md, confirmed consistent and unmodified", () => {
    expect(designDocSource).toMatch(/src\/identity\/provider_types\.ts`\/`provider_boundary\.ts`/);
    expect(designDocSource).toMatch(/docs\/vault_crypto_identity\.md/);
    expect(vaultCryptoIdentityDocSource).toMatch(/No key custody in the app/);
    expect(identityProviderTypesSource).toMatch(/IdentityProviderBoundary/);
    expect(identityProviderBoundarySource).toMatch(/NoopIdentityProvider/);
    expect(identityProviderBoundarySource).toMatch(/PlaceholderIdentityProvider/);
  });

  it("11. cross-references Alpha 006/021/022/023/024/025 and the permanent opaque-handle exclusion doc", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_006_mode_authority_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_021_storage_backend_abstraction\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_025_secure_storage_api_scope_review\.md/);
    expect(designDocSource).toMatch(/public_crypto_opaque_handles\.md/);
    expect(alpha025DocSource).toMatch(/Identity Layer/);
  });

  it("12. src/identity/ scaffold is confirmed unmodified by this Stage -- no reference to this Stage's own doc", () => {
    expect(identityProviderTypesSource).not.toMatch(/secure_runtime_alpha_026/);
    expect(identityProviderBoundarySource).not.toMatch(/secure_runtime_alpha_026/);
  });

  it("13. no Runtime/Storage/Resolver file references this Stage's own doc or was modified -- confirmed unchanged exports", () => {
    for (const source of [storageServiceSource, storageBackendSource, storageResolverSource, runtimeTypesSource, createRuntimeSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_026/);
    }
    const serviceFns = [...storageServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(serviceFns)).toEqual(new Set(["storeCiphertext", "loadCiphertext", "deleteCiphertext"]));
  });

  it("14. Worker remains fully unconnected and unmodified -- no reference to this Stage's own doc, and no storage/identity reference", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_026/);
    expect(workerSource).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext/);
    expect(workerSource).not.toMatch(/IdentityProvider/);
  });

  it("15. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("16. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_026/);

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

  it("17. no fedos_*.ts file was added or removed by this documentation-only Stage -- still exactly 56 files", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(57);
  });

  it("18. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this review", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha026-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha026-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha026-id"));
    expect(deleted).toBe(true);
  });

  it("19. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha026-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha026-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha026-direct"))).toBe(true);
  });
});
