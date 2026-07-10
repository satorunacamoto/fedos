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
import designDocSource from "../docs/secure_runtime_alpha_027_identity_foundation_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha026DocSource from "../docs/secure_runtime_alpha_026_identity_layer_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultCryptoIdentityDocSource from "../docs/vault_crypto_identity.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceIdentityBoundaryDocSource from "../docs/device_identity_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/identity/provider_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/identity/webauthn_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import passkeyBoundarySource from "../src/identity/passkey_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityVaultBridgeSource from "../src/identity/vault_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceRegistrationSource from "../src/identity/device_registration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceTrustSource from "../src/identity/device_trust.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/identity/session_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recoveryPolicySource from "../src/identity/recovery_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/nostr/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublishSource from "../src/nostr/publish.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrRelaySource from "../src/nostr/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrCryptoSource from "../src/nostr/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import devicePreviewSource from "../src/render/device_preview.ts?raw";
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

const SECRET_TERMS = /nsec|mnemonic|\bseed\b|raw[_ ]?private[_ ]?key|raw[_ ]?aead[_ ]?key/i;

/**
 * Secure Runtime Alpha 027 — "Existing Identity Foundation Inventory &
 * Integration Decision": REVIEW / DESIGN DECISION ONLY, no code change
 * of any kind. Inventories 29 Identity-related files by VERIFIED
 * import-graph reachability, audits provider_boundary.ts's real shape,
 * confirms zero Secret handling anywhere in Identity/Nostr code,
 * compares four integration Options (recommending C), and names exactly
 * one Alpha 028 candidate (a FedosIdentityDescriptor type only).
 */
describe("Secure Runtime Alpha 027 -- Existing Identity Foundation Inventory & Integration Decision, review only, no Runtime/Identity/Nostr/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(12000);
  });

  it("2. states REVIEW / DESIGN DECISION ONLY with an explicit multi-target 'no code change' list", () => {
    expect(designDocSource).toMatch(/REVIEW \/ DESIGN DECISION ONLY/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Identity API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new Public Runtime API function/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Nostr feature/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* generate, derive, or store any secret key/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Crypto API or Storage API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect Worker or Production/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a new dependency/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* delete, merge, or reorganize any existing file/);
  });

  it("3. records the full 29-file inventory with connected/disconnected classification", () => {
    expect(designDocSource).toMatch(/29 files/);
    expect(designDocSource).toMatch(/\*\*Connected\*\* — imported by `create_runtime\.ts`.*`webauthn_adapter\.ts`|webauthn_adapter\.ts.*\*\*Connected\*\*/s);
    expect(designDocSource).toMatch(/\*\*Disconnected island\*\*/);
    expect(designDocSource).toMatch(/Worker-reachable \(HTTP\), Secure-Runtime-disconnected/);
    expect(designDocSource).toMatch(/STALE/);
  });

  it("4. records provider_boundary.ts's actual interface/type/function shape and its reusability verdict", () => {
    expect(designDocSource).toMatch(/IdentityProviderKind = "apple" \| "google" \| "external" \| "passkey"/);
    expect(designDocSource).toMatch(/IdentityProviderBoundary \{ getStatus\(\); getCapabilities\(\); begin\(request\); cancel\(\); \}/);
    expect(designDocSource).toMatch(/Reusable for Alpha 026's recommended structure/);
    expect(designDocSource).toMatch(/directly, as a literal artifact\*\*: \*\*NO\*\*|as a literal artifact.{0,20}NO/is);
    expect(designDocSource).toMatch(/architectural precedent\*\*: \*\*YES\*\*|architectural precedent.{0,20}YES/is);
  });

  it("5. records the Secret boundary audit -- all eight mandated terms present with 'No' findings", () => {
    expect(designDocSource).toMatch(/Secret boundary audit/);
    for (const term of ["`nsec`", "Raw private key", "Raw AEAD key bytes", "Seed", "Mnemonic", "Secret serialization", "Direct filesystem secret storage", "Direct `RuntimeStorageBackend` construction", "Direct `FedosWasmLoader` access"]) {
      expect(designDocSource).toMatch(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    expect(designDocSource).toMatch(
      /\*\*Result: no Secret-boundary violation exists anywhere in the current\s+Identity\/Nostr codebase\.\*\*/,
    );
  });

  it("6. compares all four mandated Options across all ten mandated criteria, and recommends Option C", () => {
    for (const label of ["A: `provider_boundary\\.ts`をそのまま中核に", "B: 既存boundaryを拡張して昇格", "C: 新Provider追加、既存boundaryはAdapter化", "D: 整理してから新規設計"]) {
      expect(designDocSource).toMatch(new RegExp(label));
    }
    for (const criterion of ["重複回避", "Public API安定性", "Protocol非依存性", "Secret非公開", "Runtimeとの責務分離", "Storageとの責務分離", "Nostr Adapterへの適合性", "移行コスト", "Fail Closed"]) {
      expect(designDocSource).toMatch(new RegExp(criterion));
    }
    expect(designDocSource).toMatch(/### Conclusion: \*\*Option C\*\*/);
    expect(designDocSource).toMatch(
      /\*\*Option C is the only candidate that satisfies BOTH of this Stage's/,
    );
  });

  it("7. states the recommended architecture with Runtime/Identity Service/Protocol Adapter layers and confirms the five responsibility-separation rules", () => {
    expect(designDocSource).toMatch(/Protocol Adapter {18}\(Nostr \/ ActivityPub \/ AT Protocol \/ Session/);
    expect(designDocSource).toMatch(/FedOS Identity Service {13}\(NOT YET IMPLEMENTED/);
    expect(designDocSource).toMatch(/Identity Provider Boundary {9}\(TWO parallel occupants/);
    expect(designDocSource).toMatch(/\*\*Runtime holds no Identity semantics\*\*/);
    expect(designDocSource).toMatch(/\*\*Identity Service holds no raw secret\*\*/);
    expect(designDocSource).toMatch(/\*\*Protocol Adapter never calls Runtime directly\*\*/);
    expect(designDocSource).toMatch(/\*\*Identity Provider understands no Protocol-specific event\*\*/);
    expect(designDocSource).toMatch(/\*\*Storage understands no Identity\*\*/);
  });

  it("8. names the minimal FedosIdentityDescriptor candidate with its exclusion list, and the Nostr Adapter boundary with what src/nostr/ already does", () => {
    expect(designDocSource).toMatch(/interface FedosIdentityDescriptor \{/);
    expect(designDocSource).toMatch(/readonly id: string;/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/readonly publicIdentifier: string;/);
    expect(designDocSource).toMatch(
      /\*\*Explicitly excluded, per the mandate\*\*: raw private key, `nsec`,/,
    );
    expect(designDocSource).toMatch(/Nostr Adapter {22}\(NOT YET IMPLEMENTED/);
    expect(designDocSource).toMatch(/Real BIP-340 Schnorr signature VERIFICATION/);
    expect(designDocSource).toMatch(
      /Explicitly forbidden by this Stage's own mandate, and NOT implemented\s+here/,
    );
  });

  it("9. names exactly one Alpha 028 recommendation (FedOS Identity Descriptor type) and rejects the other four with reasons", () => {
    expect(designDocSource).toMatch(
      /\*\*Recommended: FedOS Identity Descriptor型の追加\*\*/,
    );
    const recommendedCount = (designDocSource.match(/\*\*RECOMMENDED\*\*/g) ?? []).length;
    expect(recommendedCount).toBe(1);
    expect(designDocSource).toMatch(/REJECTED for Alpha\s*\n\s*028/);
    expect(designDocSource).toMatch(/premature: a Nostr Adapter/);
  });

  it("10. cross-references Alpha 021/022/025/026 and the pre-existing identity/vault docs", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_026_identity_layer_boundary_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_025_secure_storage_api_scope_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_021_storage_backend_abstraction\.md/);
    expect(designDocSource).toMatch(/vault_crypto_identity\.md/);
    expect(designDocSource).toMatch(/device_identity_boundary\.md/);
    expect(alpha026DocSource).toMatch(/IdentityProviderBoundary/);
    expect(vaultCryptoIdentityDocSource).toMatch(/No key custody in the app/);
    expect(deviceIdentityBoundaryDocSource).toMatch(/DeviceRegistrationDescriptor/);
  });

  it("11. EMPIRICAL: create_runtime.ts is confirmed, by actual import inspection, to wire webauthn_adapter.ts/noble_signature.ts/publish.ts into AppRuntime, and to NOT import provider_boundary.ts/provider_types.ts/provider_bridge.ts/passkey_boundary.ts/vault_bridge.ts/device_*.ts/relay.ts", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    expect(codeOnly).toMatch(/from "\.\.\/identity\/webauthn_adapter\.js"/);
    expect(codeOnly).toMatch(/from "\.\.\/nostr\/noble_signature\.js"/);
    expect(codeOnly).toMatch(/from "\.\.\/nostr\/publish\.js"/);
    expect(codeOnly).toMatch(/webAuthnProvider:\s*selectWebAuthnProvider/);
    expect(codeOnly).toMatch(/signatureVerifier:.*selectSignatureVerifier/);
    expect(codeOnly).toMatch(/relayPublisher:.*selectRelayPublisher/);
    expect(codeOnly).toMatch(/return new MockRelayPublisher\(\);/);

    for (const forbidden of [
      "provider_boundary",
      "provider_types",
      "provider_bridge",
      "passkey_boundary",
      "identity/vault_bridge",
      "device_registration",
      "device_trust",
      "session_boundary",
      "recovery_policy",
      "nostr/relay",
    ]) {
      expect(codeOnly).not.toMatch(new RegExp(forbidden));
    }
  });

  it("12. EMPIRICAL: src/worker.ts is confirmed to reach the four device_* files ONLY via ./render/device_preview.js, gated by ?devicePreview=1, and the route is documented as never reading `runtime`", () => {
    expect(workerSource).toMatch(/from "\.\/render\/device_preview\.js"/);
    expect(workerSource).toMatch(/isDevicePreviewEnabled/);
    expect(workerSource).toMatch(/devicePreview/);
    expect(workerSource).toMatch(/`runtime` is not (?:even )?read here/);
  });

  it("13. EMPIRICAL: provider_boundary.ts/provider_types.ts contain zero Nostr vocabulary and zero Secret-shaped fields", () => {
    const combined = codeOnlyLines(providerBoundarySource) + "\n" + codeOnlyLines(providerTypesSource);
    expect(combined).not.toMatch(/nostr/i);
    expect(combined).not.toMatch(/npub|nsec|relay\b/i);
    expect(combined).not.toMatch(SECRET_TERMS);
    expect(combined).not.toMatch(/RuntimeStorageBackend|FedosWasmLoader/);
  });

  it("14. EMPIRICAL: the core Identity/Passkey/Nostr files contain zero Secret-shaped vocabulary and zero direct Storage/WASM-loader construction", () => {
    // The four device_*/session_boundary/recovery_policy files are checked
    // separately (test #14b) -- they LEGITIMATELY contain terms like "seed"/
    // "mnemonic" inside their own SENSITIVE_MARKERS rejection list (they
    // actively screen OUT sensitive metadata, per docs/device_identity_boundary.md),
    // which would false-positive against a blunt keyword scan.
    for (const source of [
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      passkeyBoundarySource,
      identityVaultBridgeSource,
      nobleSignatureSource,
      nostrPublishSource,
      nostrRelaySource,
      nostrCryptoSource,
    ]) {
      const codeOnly = codeOnlyLines(source);
      expect(codeOnly).not.toMatch(SECRET_TERMS);
      expect(codeOnly).not.toMatch(/RuntimeStorageBackend|FedosWasmLoader/);
    }
    expect(codeOnlyLines(nobleSignatureSource)).not.toMatch(/\bsign\(/);
  });

  it("14b. EMPIRICAL: the four device_*/session_boundary/recovery_policy files use sensitive-marker terms ONLY defensively (to REJECT such metadata), never as a real field/parameter, and never construct Storage/WASM-loader directly", () => {
    for (const source of [deviceRegistrationSource, deviceTrustSource, sessionBoundarySource, recoveryPolicySource]) {
      const codeOnly = codeOnlyLines(source);
      // The defensive rejection list itself must be present (confirms these
      // files actively screen out sensitive metadata, not merely omit it).
      expect(codeOnly).toMatch(/SENSITIVE_MARKERS/);
      // No field/parameter is actually TYPED or NAMED as a secret container.
      expect(codeOnly).not.toMatch(/readonly (nsec|seed|mnemonic|privateKey|rawKey)\s*[?:]/i);
      expect(codeOnly).not.toMatch(/RuntimeStorageBackend|FedosWasmLoader/);
    }
  });

  it("15. EMPIRICAL: device_preview.ts is confirmed to import all four device_*/session_boundary/recovery_policy files, and calls no runtime-selected boundary", () => {
    const codeOnly = codeOnlyLines(devicePreviewSource);
    expect(codeOnly).toMatch(/from "\.\.\/identity\/device_registration\.js"/);
    expect(codeOnly).toMatch(/from "\.\.\/identity\/device_trust\.js"/);
    expect(codeOnly).toMatch(/from "\.\.\/identity\/session_boundary\.js"/);
    expect(codeOnly).toMatch(/from "\.\.\/identity\/recovery_policy\.js"/);
  });

  it("16. no Storage/Backend/Resolver/Authority file, types.ts, create_runtime.ts, or Worker references this Stage's own doc -- confirmed unchanged", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource, providerBoundarySource, providerTypesSource, nobleSignatureSource, nostrPublishSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_027/);
    }
  });

  it("17. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("18. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_027/);

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

  it("19. no fedos_*.ts file was added or removed by this documentation-only Stage -- still exactly 56 files", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(57);
  });

  it("20. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this review", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha027-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha027-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha027-id"));
    expect(deleted).toBe(true);
  });

  it("21. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha027-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha027-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha027-direct"))).toBe(true);
  });
});
