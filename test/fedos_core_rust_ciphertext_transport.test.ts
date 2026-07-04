import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import transportSource from "../packages/fedos-core-rust/src/crypto/ciphertext_transport.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serializationPlanDoc from "../docs/ciphertext_envelope_serialization_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44PlanDoc from "../docs/nip44_internal_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBoundaryDoc from "../docs/encrypted_payload_storage_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/federation/types.ts?raw";

/**
 * Stage 177–181 — "Ciphertext envelope serialization planning + NIP-44
 * internal implementation planning + storage/send boundary prep."
 *
 * `packages/fedos-core-rust/src/crypto/ciphertext_transport.rs` (new) adds
 * a crate-private, LABEL-ONLY `CiphertextTransportDescriptor` — no
 * ciphertext, nonce, tag, or key field of any kind, no serialization, no
 * connection to `ciphertext_envelope`/`aead_internal`, no public API
 * addition. Three new planning documents (`docs/
 * ciphertext_envelope_serialization_plan.md`, `docs/nip44_internal_plan.md`,
 * `docs/encrypted_payload_storage_boundary.md`) fix future shapes in
 * writing without implementing anything. This stage is planning/skeleton/
 * docs/guards ONLY: no JSON/base64/CBOR/binary serialization
 * implementation, no NIP-44 implementation, no Runtime/Worker/Storage/
 * Nostr/WASM connection, no `Cargo.toml` change, no public API addition —
 * every one of those is verified absent below.
 */
describe("FedOS Rust crate — ciphertext transport descriptor + NIP-44/storage planning (Stage 177–181)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  // The module's own doc comment (`//!`/`///` lines) legitimately discusses
  // NIP-44/JSON/`ciphertext_envelope` etc. in PROSE, explaining what this
  // skeleton deliberately does NOT connect to — a bare whole-file match
  // would false-positive on that prose. This strips doc-comment lines,
  // leaving only actual code for the "no connection"/"no serialization"
  // checks below.
  const transportCodeOnly = transportSource
    .split("\n")
    .filter((line: string) => !/^\s*(\/\/!|\/\/\/|\/\/)/.test(line))
    .join("\n");

  it("1. crypto.rs declares ciphertext_transport as a pub(crate)-only child module", () => {
    expect(cryptoModSource).toMatch(/\bpub\(crate\)\s+mod\s+ciphertext_transport\s*;/);
    expect(cryptoModSource).not.toMatch(/\bpub\s+mod\s+ciphertext_transport\b/);
  });

  it("2. CiphertextTransportDescriptor and every one of its label enums are pub(crate)-only, never pub", () => {
    for (const name of [
      "CiphertextTransportDescriptor",
      "CiphertextTransportVersion",
      "CiphertextTransportAlgorithm",
      "CiphertextEncodingPlaceholder",
      "CiphertextTransportKind",
      "CiphertextTransportStatus",
    ]) {
      expect(transportSource, `expected pub(crate) ${name}`).toMatch(
        new RegExp(`\\bpub\\(crate\\)\\s+(enum|struct)\\s+${name}\\b`),
      );
      expect(transportSource, `${name} must never be pub`).not.toMatch(
        new RegExp(`\\bpub\\s+(enum|struct)\\s+${name}\\b`),
      );
    }
  });

  it("3. the descriptor holds no ciphertext, nonce, tag, or key field of any kind", () => {
    const structMatch = transportSource.match(
      /pub\(crate\)\s+struct\s+CiphertextTransportDescriptor\s*\{([\s\S]*?)\}/,
    );
    expect(structMatch, "expected to find the descriptor struct body").not.toBeNull();
    const body = structMatch![1] ?? "";
    expect(body).not.toMatch(/\bciphertext\b/i);
    expect(body).not.toMatch(/\bnonce\b/i);
    expect(body).not.toMatch(/\btag\b/i);
    expect(body).not.toMatch(/\bkey\b/i);
    expect(body).not.toMatch(/\bsecret\b/i);
    expect(body).not.toMatch(/Vec\s*<\s*u8\s*>/);
    expect(body).not.toMatch(/\[\s*u8\s*;/);
  });

  it("4. CiphertextEncodingPlaceholder has exactly two variants, Undecided and CanonicalJsonBase64UrlPlaceholder (Stage 182) — still a label, no codec", () => {
    const enumMatch = transportSource.match(
      /pub\(crate\)\s+enum\s+CiphertextEncodingPlaceholder\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch).not.toBeNull();
    const body = (enumMatch![1] ?? "").replace(/\/\/\/.*$/gm, ""); // strip doc-comment lines before scanning for variants
    const variants = [...body.matchAll(/^\s*([A-Za-z0-9_]+)\s*,/gm)].map((m) => m[1]);
    expect([...variants].sort()).toEqual(
      ["Undecided", "CanonicalJsonBase64UrlPlaceholder"].sort(),
    );
  });

  it("4b. the new CanonicalJsonBase64UrlPlaceholder variant records the Stage 182 decision as a label only — no encode/decode function anywhere", () => {
    expect(transportSource).toContain("CanonicalJsonBase64UrlPlaceholder");
    expect(transportSource).not.toMatch(/\bfn\s+\w*(encode|decode|serialize|deserialize)\w*\s*\(/i);
  });

  it("5. CiphertextTransportKind has exactly Storage and NostrEvent — labels only, no connection", () => {
    const enumMatch = transportSource.match(
      /pub\(crate\)\s+enum\s+CiphertextTransportKind\s*\{([\s\S]*?)\}/,
    );
    expect(enumMatch).not.toBeNull();
    const variants = [...(enumMatch![1] ?? "").matchAll(/([A-Za-z0-9_]+)\s*,/g)].map((m) => m[1]);
    expect([...variants].sort()).toEqual(["NostrEvent", "Storage"].sort());
  });

  it("6. no bridge/connection to ciphertext_envelope's real envelope type or aead_internal's real cipher labels", () => {
    expect(transportCodeOnly).not.toMatch(/\bsuper::ciphertext_envelope::/);
    expect(transportCodeOnly).not.toMatch(/\bsuper::aead_internal::/);
    expect(transportCodeOnly).not.toMatch(/\bAeadCiphertextEnvelope\b/);
    expect(transportCodeOnly).not.toMatch(/\bAeadCipher\b/);
    expect(transportCodeOnly).not.toMatch(/\bAeadAadDomain\b/);
    expect(transportCodeOnly).not.toMatch(/\bSecretHandle\b/);
  });

  it("7. no serialization of any kind anywhere in the new module: no JSON/base64/CBOR/serde", () => {
    expect(transportCodeOnly).not.toMatch(/\bserde\b/i);
    expect(transportCodeOnly).not.toMatch(/\bjson\b/i);
    expect(transportCodeOnly).not.toMatch(/\bbase64\b/i);
    expect(transportCodeOnly).not.toMatch(/\bcbor\b/i);
    expect(transportCodeOnly).not.toMatch(/impl\s+(serde::)?Serialize\s+for\b/);
    expect(transportCodeOnly).not.toMatch(/impl\s+(serde::)?Deserialize\s+for\b/);
  });

  it("8. no unwrap/expect/panic/todo/unimplemented in the new module's production code", () => {
    const firstCfgTestIdx = transportSource.indexOf("#[cfg(test)]");
    const productionOnly =
      firstCfgTestIdx === -1 ? transportSource : transportSource.slice(0, firstCfgTestIdx);
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
    expect(productionOnly).not.toMatch(/\btodo!\s*\(/);
    expect(productionOnly).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("9. no `unsafe` anywhere in this module; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(transportSource).not.toContain("unsafe");
  });

  it("10. not connected to Runtime/Worker/Storage/Nostr/NIP-44/WASM in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("ciphertexttransport");
      expect(src).not.toContain("ciphertext_transport");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(transportCodeOnly).not.toMatch(/\bnip.?44\b/i);
    expect(transportCodeOnly).not.toMatch(/\bstorage::/);
    expect(transportCodeOnly).not.toMatch(/\bnostr::/i);
  });

  it("11. no NIP-44 implementation exists anywhere in this crate: no conversation-key/padding/HMAC function", () => {
    for (const forbidden of [
      /\bfn\s+\w*conversation_key\w*\s*\(/i,
      /\bfn\s+\w*calc_padded_len\w*\s*\(/i,
      /\bfn\s+\w*nip44\w*_(encrypt|decrypt)\s*\(/i,
      /\bhmac::Hmac\b/,
      /\bsecp256k1::/i,
    ]) {
      expect(libRsSource).not.toMatch(forbidden);
      expect(transportCodeOnly).not.toMatch(forbidden);
    }
  });

  it("12. Cargo.toml is unchanged — no new dependency since this stage, still 10 production dependencies (Stage 194 separately added k256; see test/nip44_pre_adoption_guard.test.ts for that stage's own dedicated checks), no CBOR crate, no rust-secp256k1 C-FFI crate", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(10);
    expect(depLines.some((line: string) => /^\s*secp256k1\s*=/.test(line))).toBe(false);
    expect(cargoCode).not.toMatch(/\bcbor\b/);
  });

  it("13. the crate's public pub fn surface is unchanged at twenty-seven — this stage adds no public API", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(27);
    expect(pubFnNames).not.toContain("ciphertext_transport_descriptor");
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("transport");
    }
  });

  it("14. the three new planning documents exist and each states it adds no code", () => {
    expect(serializationPlanDoc).toMatch(/adds no code/i);
    expect(nip44PlanDoc).toMatch(/adds no code/i);
    expect(storageBoundaryDoc).toMatch(/adds no code/i);
  });

  it("15. the serialization plan excludes raw secret, key ID, and buyer/payment/entitlement metadata", () => {
    expect(serializationPlanDoc).toMatch(/no raw secret/i);
    expect(serializationPlanDoc).toMatch(/key identifier|key id/i);
    expect(serializationPlanDoc).toMatch(/buyer.{0,20}payment.{0,20}entitlement|payment\/entitlement/i);
    // No MVP encoding is chosen — the document says so explicitly.
    expect(serializationPlanDoc).toMatch(/no MVP encoding|not chosen|NOT decided/i);
  });

  it("16. the serialization plan compares JSON, base64, CBOR, and raw binary without implementing any of them", () => {
    for (const encoding of ["JSON", "base64", "CBOR", "binary"]) {
      expect(serializationPlanDoc).toContain(encoding);
    }
  });

  it("17. the NIP-44 plan references the already-imported v2 test vectors and names a SecretHandle strategy, without implementing anything", () => {
    expect(nip44PlanDoc).toContain("test-vectors/nip44/nip44-v2.json");
    expect(nip44PlanDoc).toMatch(/SecretHandle/);
    expect(nip44PlanDoc).toMatch(/conversation.key/i);
    expect(nip44PlanDoc).toMatch(/pad/i);
    expect(nip44PlanDoc).toMatch(/HMAC|MAC/);
    expect(nip44PlanDoc).not.toMatch(/```rust/);
  });

  it("18. the storage boundary doc names what StorageBackend/FederationProvider may carry and forbids raw key/plaintext/commerce metadata", () => {
    expect(storageBoundaryDoc).toMatch(/StorageBackend/);
    expect(storageBoundaryDoc).toMatch(/FederationProvider/);
    expect(storageBoundaryDoc).toMatch(/no raw key/i);
    expect(storageBoundaryDoc).toMatch(/no plaintext/i);
    expect(storageBoundaryDoc).toMatch(/payment.{0,20}entitlement|entitlement.{0,20}payment/i);
    expect(storageBoundaryDoc).toMatch(/rlib/);
  });

  it("19. StorageBackend/FederationProvider TypeScript source is unchanged by this stage — no crypto import, no WASM/FFI reference", () => {
    for (const src of [storageTypesSource, federationTypesSource]) {
      expect(src).not.toMatch(/fedos_encrypt|fedos_decrypt|fedos_generate_aead_key_32/);
      expect(src).not.toMatch(/FedosAeadKeyHandle|FedosCiphertextEnvelope/);
      expect(src).not.toMatch(/wasm|\.rs\b|cargo/i);
    }
  });
});
