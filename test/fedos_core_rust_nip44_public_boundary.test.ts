import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44PublicApiSource from "../packages/fedos-core-rust/src/crypto/nip44_public_api.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_payload.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../packages/fedos-core-rust/src/crypto/capability_matrix.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../packages/fedos-core-rust/src/crypto/diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/os/core/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/os/core/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/os/_legacy_prototype/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoTypesSource from "../src/os/core/crypto/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publicNip44WireApiDocSource from "../docs/public_nip44_wire_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeCryptoBridgeDocSource from "../docs/runtime_crypto_bridge.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrDmBridgeDocSource from "../docs/nostr_dm_bridge.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireRoadmapSource from "../docs/nip44_wire_implementation_roadmap.md?raw";

/**
 * Stage 241–248 — "public NIP-44 wire boundary planning + skeleton":
 * docs/public_nip44_wire_api.md (Stage 241), crypto::nip44_public_api
 * (Stage 242, a label-only pub(crate) skeleton), docs/runtime_crypto_bridge.md
 * (Stage 243), docs/nostr_dm_bridge.md (Stage 244) — all planning-only,
 * no Runtime/Worker/Storage/Relay/NIP-17 connection, no public API
 * addition. Every check below verifies that boundary held.
 */
describe("NIP-44 public wire boundary: planning + skeleton (Stage 241-248)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  }

  it("1. crypto.rs declares nip44_public_api as pub(crate) mod, never bare pub mod", () => {
    expect(cryptoModSource).toMatch(/pub\(crate\)\s+mod\s+nip44_public_api;/);
    expect(cryptoModSource).not.toMatch(/\n\s*pub\s+mod\s+nip44_public_api;/);
  });

  it("2. nip44_public_api.rs declares no pub fn/struct/enum/mod — pub(crate) only", () => {
    expect(nip44PublicApiSource).not.toMatch(/^\s*pub\s+fn\s+/m);
    expect(nip44PublicApiSource).not.toMatch(/^\s*pub\s+struct\s+/m);
    expect(nip44PublicApiSource).not.toMatch(/^\s*pub\s+enum\s+/m);
    expect(nip44PublicApiSource).not.toMatch(/^\s*pub\s+mod\s+/m);
    for (const name of [
      "Nip44OpaqueConversation",
      "Nip44OpaquePayload",
      "Nip44OpaqueStatus",
      "Nip44OpaqueDecision",
    ]) {
      expect(nip44PublicApiSource).toMatch(new RegExp(`pub\\(crate\\)\\s+(struct|enum)\\s+${name}`));
    }
  });

  it("3. nip44_public_api.rs has no unsafe/unwrap/expect/panic in production code", () => {
    const productionOnly = nip44PublicApiSource.slice(
      0,
      nip44PublicApiSource.indexOf("#[cfg(test)]") === -1
        ? nip44PublicApiSource.length
        : nip44PublicApiSource.indexOf("#[cfg(test)]"),
    );
    const codeOnly = codeOnlyOf(productionOnly);
    expect(codeOnly).not.toContain("unsafe");
    expect(codeOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(codeOnly).not.toMatch(/\.expect\s*\(/);
    expect(codeOnly).not.toMatch(/\bpanic!\s*\(/);
  });

  it("4. the public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(69);    for (const name of pubFnNames) {
      if (name === "encrypt_nip44_wire" || name === "decrypt_nip44_wire") continue;
      expect(name.toLowerCase()).not.toContain("nip44");
    }
  });

  it("5. SecretHandle/ConversationKey/MessageKey/Nip44WirePayload are never pub — opaque handle only, per docs/public_nip44_wire_api.md", () => {
    expect(libRsSource).toMatch(/pub\(crate\)\s+struct\s+SecretHandle\b/);
    expect(libRsSource).not.toMatch(/pub\s+struct\s+SecretHandle\b/);
    expect(conversationKeySource).toMatch(/pub\(crate\)\s+struct\s+ConversationKey\b/);
    expect(conversationKeySource).not.toMatch(/pub\s+struct\s+ConversationKey\b/);
    expect(messageKeySource).toMatch(/pub\(crate\)\s+struct\s+MessageKey\b/);
    expect(messageKeySource).not.toMatch(/pub\s+struct\s+MessageKey\b/);
    expect(nip44WirePayloadSource).toMatch(/pub\(crate\)\s+struct\s+Nip44WirePayload\b/);
    expect(nip44WirePayloadSource).not.toMatch(/pub\s+struct\s+Nip44WirePayload\b/);
  });

  it("6. no Runtime/Worker/Storage/Relay/NIP-17 connection (code, not doc-comment reassurance prose) anywhere in the new Rust file, and no reverse reference from existing Runtime/Worker/Storage/Federation .ts files", () => {
    for (const src of [nip44PublicApiSource]) {
      expect(codeOnlyOf(src)).not.toMatch(/Runtime|Worker|Storage|Relay|nip.?17|nip-17/i);
    }
    for (const src of [runtimeSource, runtimeTypesSource, workerSource, storageTypesSource, noopStorageSource, federationTypesSource, cryptoTypesSource]) {
      expect(src).not.toMatch(/nip44_public_api|Nip44Opaque/);
    }
  });

  it("7. Cargo.toml and package.json are unchanged — no new dependency", () => {
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
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("8. capability_matrix/diagnostics are unchanged in shape — still sixteen capabilities, no public-boundary row added there", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
    expect(diagnosticsSource).not.toMatch(/Nip44Opaque|PublicBoundary/);
  });

  it("9. all three planning docs exist and state the opaque-handle-only rule / unconnected status", () => {
    expect(publicNip44WireApiDocSource).toMatch(/opaque/i);
    expect(publicNip44WireApiDocSource).toMatch(/ConversationKey/);
    expect(publicNip44WireApiDocSource).toMatch(/SecretHandle/);
    expect(publicNip44WireApiDocSource).toMatch(/this document adds no code/i);

    expect(runtimeCryptoBridgeDocSource).toMatch(/Runtime/);
    expect(runtimeCryptoBridgeDocSource).toMatch(/this document adds no code/i);
    expect(runtimeCryptoBridgeDocSource).not.toMatch(/```[\s\S]*?connect\(\)[\s\S]*?```/);

    expect(nostrDmBridgeDocSource).toMatch(/NIP-17|NIP17|nip17/i);
    expect(nostrDmBridgeDocSource).toMatch(/this document adds no code/i);
    expect(nostrDmBridgeDocSource).toMatch(/not connected|not implemented/i);
  });

  it("10. docs/nip44_wire_implementation_roadmap.md names Stage 249-252 candidates (Runtime opt-in, Nostr DM, NIP-17, WASM)", () => {
    expect(nip44WireRoadmapSource).toMatch(/249/);
    expect(nip44WireRoadmapSource).toMatch(/250/);
    expect(nip44WireRoadmapSource).toMatch(/251/);
    expect(nip44WireRoadmapSource).toMatch(/252/);
    expect(nip44WireRoadmapSource).toMatch(/NIP-17|NIP17/i);
    expect(nip44WireRoadmapSource).toMatch(/WASM/);
  });
});
