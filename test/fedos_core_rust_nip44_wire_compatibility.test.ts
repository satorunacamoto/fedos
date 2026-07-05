import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../packages/fedos-core-rust/src/crypto/capability_matrix.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../packages/fedos-core-rust/src/crypto/diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44PaddingSource from "../packages/fedos-core-rust/src/crypto/nip44_padding.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44EncryptSource from "../packages/fedos-core-rust/src/crypto/nip44_encrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44DecryptSource from "../packages/fedos-core-rust/src/crypto/nip44_decrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44BridgeSource from "../packages/fedos-core-rust/src/crypto/nip44_bridge.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireSource from "../packages/fedos-core-rust/src/crypto/nip44_wire.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44StreamCipherSource from "../packages/fedos-core-rust/src/crypto/nip44_stream_cipher.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44HmacSource from "../packages/fedos-core-rust/src/crypto/nip44_hmac.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDecryptSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_payload.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44InternalPlanSource from "../docs/nip44_internal_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireCompatibilityGapSource from "../docs/nip44_wire_compatibility_gap.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireRoadmapSource from "../docs/nip44_wire_implementation_roadmap.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Stage 209–213 — "NIP-44 compatibility gap clarification + wire-compatible
 * implementation prep". Docs (`docs/nip44_wire_compatibility_gap.md`,
 * `docs/nip44_wire_implementation_roadmap.md`) name, in writing, that the
 * Stage 202–208 `nip44_padding`/`nip44_encrypt`/`nip44_decrypt`/
 * `nip44_bridge` pipeline is a "FedOS internal NIP-44-like bridge" — NOT a
 * NIP-44 v2 wire-compatible implementation — and `crypto::nip44_wire` adds
 * a LABEL-ONLY skeleton (`Nip44WireVersion`/`Nip44WirePayloadKind`/
 * `Nip44WireStatus`/`Nip44WireDecision`) fixing the vocabulary a future
 * wire-compatible implementation would use. **No wire encrypt/decrypt, no
 * base64, no HMAC-SHA256, no raw ChaCha20 stream cipher, no public API
 * addition, no Runtime/Worker/Storage/Relay connection, no new Cargo
 * dependency** — every one of those is verified absent below.
 */
describe("NIP-44 wire compatibility gap clarification + wire skeleton (Stage 209-213)", () => {
  function productionOnlyOf(source: string): string {
    const idx = source.indexOf("#[cfg(test)]");
    return idx === -1 ? source : source.slice(0, idx);
  }

  const FORBIDDEN_COMPATIBILITY_CLAIMS = [
    /NIP-44 compatible\b/i,
    /NIP-44 v2 compatible\b/i,
    /NIP-44-compliant\b/i,
    /NIP-44 compliant\b/i,
  ];

  const BRIDGE_SOURCES: [string, string][] = [
    ["nip44_padding.rs", nip44PaddingSource],
    ["nip44_encrypt.rs", nip44EncryptSource],
    ["nip44_decrypt.rs", nip44DecryptSource],
    ["nip44_bridge.rs", nip44BridgeSource],
    ["capability_matrix.rs", capabilityMatrixSource],
    ["diagnostics.rs", diagnosticsSource],
    ["crypto.rs", cryptoModSource],
    // Stage 229-233 — real wire ChaCha20/HMAC/decrypt-pipeline code now
    // exists, but base64/wire-encode/invalid-vector handling/Nostr bridge
    // still do not, so none of these may claim full compatibility either.
    ["nip44_stream_cipher.rs", nip44StreamCipherSource],
    ["nip44_hmac.rs", nip44HmacSource],
    ["nip44_wire_decrypt.rs", nip44WireDecryptSource],
    ["nip44_wire_payload.rs", nip44WirePayloadSource],
  ];

  it("1. no Rust source in the Stage 198-233 bridge/wire-crypto code (or crypto.rs/capability_matrix.rs/diagnostics.rs) ever claims NIP-44/NIP-44 v2 'compatible' or 'compliant'", () => {
    for (const [name, src] of BRIDGE_SOURCES) {
      for (const forbidden of FORBIDDEN_COMPATIBILITY_CLAIMS) {
        expect(src, `${name} must not claim ${forbidden}`).not.toMatch(forbidden);
      }
    }
  });

  it("2. docs/nip44_wire_compatibility_gap.md exists, names the required/forbidden terminology, and never itself claims the bridge is NIP-44 compatible", () => {
    expect(nip44WireCompatibilityGapSource).toMatch(/FedOS internal NIP-44-like bridge/);
    expect(nip44WireCompatibilityGapSource).toMatch(/NIP-44 v2 wire-compatible implementation/);
    expect(nip44WireCompatibilityGapSource).toMatch(/Forbidden phrasing/i);
    // The doc itself only ever uses the forbidden phrases inside its own
    // "forbidden phrasing" list/table — never as an assertion the bridge
    // IS one of them.
    expect(nip44WireCompatibilityGapSource).not.toMatch(
      /this (crate|bridge|implementation) is NIP-44 (v2 )?compatible/i,
    );
  });

  it("3. docs/nip44_wire_implementation_roadmap.md exists and names all eight roadmap steps (steps 1/3/4/5 now marked IMPLEMENTED, 2/6/7/8 still plan-only)", () => {
    for (const keyword of [
      "message key",
      "padding",
      "nonce",
      "ChaCha20 stream",
      "HMAC-SHA256",
      "base64",
      "invalid vectors",
      "Nostr DM",
    ]) {
      expect(
        nip44WireRoadmapSource.toLowerCase(),
        `expected roadmap to mention ${keyword}`,
      ).toContain(keyword.toLowerCase());
    }
    // Stage 219-233 implemented steps 1/3/4/5 for real, so the doc's
    // intro now speaks in the past tense ("added", not "adds") — both
    // phrasings are accepted here.
    expect(nip44WireRoadmapSource).toMatch(/this document (adds|added) no code/i);
    expect(nip44WireRoadmapSource).toMatch(/IMPLEMENTED Stage 219/);
  });

  it("4. docs/nip44_internal_plan.md points to the new terminology/gap/roadmap docs", () => {
    expect(nip44InternalPlanSource).toMatch(/nip44_wire_compatibility_gap\.md/);
    expect(nip44InternalPlanSource).toMatch(/nip44_wire_implementation_roadmap\.md/);
    expect(nip44InternalPlanSource).toMatch(/FedOS internal NIP-44-like bridge/);
  });

  it("5. crypto.rs declares nip44_wire as pub(crate) mod, never bare pub mod", () => {
    expect(cryptoModSource).toMatch(/pub\(crate\)\s+mod\s+nip44_wire;/);
    expect(cryptoModSource).not.toMatch(/\n\s*pub\s+mod\s+nip44_wire;/);
  });

  it("6. nip44_wire declares no pub fn/struct/enum/mod — pub(crate) only", () => {
    expect(nip44WireSource).not.toMatch(/^\s*pub\s+fn\s+/m);
    expect(nip44WireSource).not.toMatch(/^\s*pub\s+struct\s+/m);
    expect(nip44WireSource).not.toMatch(/^\s*pub\s+enum\s+/m);
    expect(nip44WireSource).not.toMatch(/^\s*pub\s+mod\s+/m);
  });

  it("7. nip44_wire declares exactly the four documented types", () => {
    for (const item of [
      "pub(crate) enum Nip44WireVersion",
      "pub(crate) enum Nip44WirePayloadKind",
      "pub(crate) enum Nip44WireStatus",
      "pub(crate) struct Nip44WireDecision",
    ]) {
      expect(nip44WireSource).toContain(item);
    }
  });

  it("8. nip44_wire's Nip44WireStatus has no variant other than Unimplemented — no wire-compatible implementation exists yet", () => {
    const enumMatch = nip44WireSource.match(
      /pub\(crate\)\s+enum\s+Nip44WireStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch, "expected to find the Nip44WireStatus enum body").not.toBeNull();
    const variants = [...enumMatch![1].matchAll(/^\s*(\w+),?\s*$/gm)].map((m) => m[1]);
    expect(variants).toEqual(["Unimplemented"]);
  });

  it("9. no unsafe/unwrap/expect/panic in nip44_wire's production code", () => {
    const productionOnly = productionOnlyOf(nip44WireSource);
    expect(productionOnly).not.toContain("unsafe");
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
  });

  it("10. nip44_wire implements no real wire cryptography — no base64, no HMAC, no raw ChaCha20 stream cipher, no encrypt/decrypt function", () => {
    expect(nip44WireSource).not.toMatch(/use\s+base64/i);
    expect(nip44WireSource).not.toMatch(/use\s+hmac\s*::/);
    expect(nip44WireSource).not.toMatch(/use\s+chacha20\s*::/);
    expect(nip44WireSource).not.toMatch(/fn\s+\w*encrypt\w*\s*\(/i);
    expect(nip44WireSource).not.toMatch(/fn\s+\w*decrypt\w*\s*\(/i);
    expect(nip44WireSource).not.toMatch(/fn\s+\w*base64\w*\s*\(/i);
    expect(nip44WireSource).not.toMatch(/fn\s+\w*hmac\w*\s*\(/i);
  });

  it("11. the existing Stage 202-208 bridge (nip44_encrypt/nip44_decrypt/nip44_bridge) is untouched by this stage — still no base64/hmac/raw-chacha20-stream import", () => {
    for (const src of [nip44EncryptSource, nip44DecryptSource, nip44BridgeSource]) {
      expect(src).not.toMatch(/use\s+base64/i);
      expect(src).not.toMatch(/use\s+hmac\s*::/);
      expect(src).not.toMatch(/use\s+chacha20\s*::/);
    }
  });

  it("12. capability_matrix/diagnostics are unchanged in shape — still sixteen capabilities, still zero NotConnected rows (no new capability added by this stage)", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
    expect(diagnosticsSource).not.toMatch(/readiness:\s*CapabilityReadiness::NotConnected/);
  });

  it("13. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/nip44_wire|Nip44Wire/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip44_wire|Nip44Wire/i);
    }
  });

  it("14. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(27);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("wire");
    }
  });

  it("15. Cargo.toml still has exactly 10 production dependencies — zero new dependency added", () => {
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
    expect(depLines.length).toBe(10);
    expect(cargoCode).not.toMatch(/^\s*chacha20\s*=/m);
    expect(cargoCode).not.toMatch(/^\s*hmac\s*=/m);
    expect(cargoCode).not.toMatch(/^\s*base64\s*=/m);
  });

  it("16. package.json is unchanged — still 2 production dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("17. no serialization change: no serde derive anywhere in nip44_wire.rs", () => {
    expect(nip44WireSource).not.toMatch(/derive\(Serialize/);
    expect(nip44WireSource).not.toMatch(/derive\(Deserialize/);
  });
});
