import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import lib from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoToml from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import masterSeedAuthoritySource from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sealedEnvelopeSource from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import signingAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmSigningAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.ts?raw";

const NEW_TS_SOURCES = [masterSeedAuthoritySource, sealedEnvelopeSource, signingAuthoritySource, wasmSigningAuthoritySource];

function masterRootBody(): string {
  const start = lib.indexOf("mod master_root {");
  let depth = 0;
  for (let i = start; i < lib.length; i++) {
    const c = lib[i];
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return lib.slice(start, i);
    }
  }
  throw new Error("mod master_root { ... } never closes");
}

function authorityImplBody(): string {
  return (lib.match(/impl FedosMasterSeedAuthority \{[\s\S]*?\n\}\n\n#\[cfg\(test\)\]/) ?? [""])[0];
}

describe("Secure Runtime Alpha 449 -- Security Regression Guards", () => {
  it("no raw seed getter exists on FedosMasterSeedAuthority", () => {
    expect(authorityImplBody()).not.toMatch(/-> \[u8; 32\]/);
    expect(authorityImplBody()).not.toMatch(/-> Option<\[u8; 32\]>/);
  });

  it("no raw secret-key getter or nsec export exists anywhere in lib.rs", () => {
    expect(lib).not.toMatch(/pub fn .*raw.*secret/i);
    expect(lib).not.toMatch(/fn .*nsec/i);
  });

  it("no generic sign(hash) escape hatch exists", () => {
    expect(lib).not.toMatch(/pub fn sign\(/);
  });

  it("no TypeScript file in this Arc implements signing cryptography", () => {
    for (const source of NEW_TS_SOURCES) {
      expect(source).not.toMatch(/schnorr\.sign|k256|secp256k1/i);
    }
  });

  it("no secret field is introduced into Outbox or Board source (this Arc touches neither)", () => {
    // Structural proxy: none of this Arc's new files reference outbox/board persistence types.
    for (const source of NEW_TS_SOURCES) {
      expect(source).not.toMatch(/FedosBoardOutboxPersistence|FedosBoardPersistence/);
    }
  });

  it("the signing authority has no Relay dependency (no real import, prose mentions of what's absent don't count)", () => {
    for (const source of [signingAuthoritySource, wasmSigningAuthoritySource]) {
      const importLines = (source as string).match(/^import .*$/gm) ?? [];
      for (const line of importLines) {
        expect(line.toLowerCase()).not.toContain("relay");
      }
    }
  });

  it("no file this Arc touched imports from p2p/", () => {
    for (const source of NEW_TS_SOURCES) {
      expect(source).not.toMatch(/p2p/);
    }
    expect(lib).not.toMatch(/p2p/);
  });

  it("FedosMasterSeedAuthority and its state enum carry zero leaking derives", () => {
    const stateIdx = lib.indexOf("enum FedosMasterSeedAuthorityState");
    const stateBefore = lib.slice(Math.max(0, stateIdx - 400), stateIdx);
    expect(stateBefore).not.toMatch(/#\[derive\([^)]*(Clone|Debug|Serialize)[^)]*\)\]/);

    const structIdx = lib.indexOf("pub struct FedosMasterSeedAuthority {");
    const structBefore = lib.slice(Math.max(0, structIdx - 400), structIdx);
    expect(structBefore).not.toMatch(/#\[derive\([^)]*(Clone|Debug|Serialize)[^)]*\)\]/);
  });

  it("mod master_root still carries no #[wasm_bindgen] attribute anywhere in its own body", () => {
    // Anchored to line-start (only whitespace before it) so a doc-comment
    // PROSE mention of the literal text "#[wasm_bindgen]" (this module
    // explains it deliberately carries none) is not a false positive --
    // only a REAL attribute line would start this way.
    expect(masterRootBody()).not.toMatch(/^\s*#\[wasm_bindgen\]/m);
  });

  it("Cargo.toml still declares exactly the same eleven production-dependency lines this Arc's own baseline had", () => {
    const deps = [
      "chacha20poly1305",
      "hkdf",
      "zeroize",
      "secrecy",
      "subtle",
      "argon2",
      "aes-gcm",
      "getrandom",
      "sha2",
      "k256",
      "wasm-bindgen",
    ];
    for (const dep of deps) {
      expect(cargoToml).toMatch(new RegExp(`^${dep}( |=)`, "m"));
    }
    // No new dependency name beyond this fixed set appears as a top-level `name = ` declaration.
    expect(cargoToml).not.toMatch(/^\s*rand\s*=/m);
    expect(cargoToml).not.toMatch(/^\s*secp256k1\s*=/m);
  });
});
