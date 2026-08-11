import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoTypesSource from "../../../src/os/core/crypto/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopCryptoSource from "../../../src/os/core/crypto/noop_crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import coreAdapterSource from "../../../src/os/core/crypto/fedos_core_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeCryptoProviderSource from "../../../src/runtime/crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../../../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeEncryptSource from "../../../src/runtime/fedos_runtime_encrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDecryptSource from "../../../src/runtime/fedos_runtime_decrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextStorageSource from "../../../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../../../src/os/core/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storagePolicySource from "../../../src/os/core/storage/policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptedPayloadSource from "../../../src/os/core/storage/encrypted_payload.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import chatTypesSource from "../../../src/os/_legacy_prototype/chat/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import masterSeedAuthoritySource from "../../../src/os/core/vault/wasm/fedos_master_seed_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";
import { assertFedosRootDependencyInvariant } from "../../helpers/fedos_root_dependency_invariant.js";

/**
 * Private Message Envelope and Encryption Activation V1 review --
 * source alignment. Verifies, against this worktree's own REAL
 * checked-out `src/` tree (== current `master` @ 9c1f52c), the "current
 * implementation reality" claims `01_crypto_inventory.md` through
 * `05_encryption_suites.md` and `03_envelope_boundary.md` make. Never
 * asserts that any FUTURE (unimplemented) Envelope/Encryption-Authority
 * type exists -- only what this review's own docs claim IS true of the
 * repository today.
 */

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

describe("Private Message Envelope V1 review -- source alignment (master reality)", () => {
  it("1. no compiled WASM artifact exists in this checked-out tree -- grounds 01/12/13/20's own BLOCK-2 finding", () => {
    expect(() => readdirSync("packages/fedos-core-rust/pkg")).toThrow();
  });

  it("2. Seam 1 (src/crypto/types.ts) CryptoProvider is placeholder-only -- NO real encryption/AEAD/KDF anywhere in the file's own text", () => {
    expect(cryptoTypesSource as string).toMatch(/NO real encryption, NO AEAD/i);
    expect(cryptoTypesSource as string).toMatch(/export interface CryptoProvider/);
  });

  it("3. NoopCryptoProvider denies every operation -- behavioral, grounds 01's Seam 1 finding", async () => {
    const { NoopCryptoProvider } = await import("../../../src/crypto/noop_crypto.js");
    const provider = new NoopCryptoProvider();
    expect(provider.getStatus()).toEqual({ state: "unavailable", reason: "no crypto core is configured" });
    expect(provider.getCapabilities()).toEqual([]);
    const decision = await provider.encrypt({});
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("4. fedos_core_adapter.ts confirms it is NOT wired into the runtime or Worker -- grounds 01's Seam 1 inert finding", () => {
    expect(coreAdapterSource as string).toMatch(/NOT wired into the runtime or the Worker/i);
  });

  it("5. src/runtime/crypto_provider.ts (Seam 3) is explicitly a SEPARATE seam from src/crypto/types.ts -- grounds 01's Seam 3 finding", () => {
    expect(runtimeCryptoProviderSource as string).toMatch(/SEPARATE seam from `src\/crypto\/types\.ts`/);
    expect(runtimeCryptoProviderSource as string).toMatch(/export class PlaceholderRuntimeCryptoProvider/);
  });

  it("6. PlaceholderRuntimeCryptoProvider denies every encrypt/decrypt call -- behavioral, grounds 01's Seam 3 finding", async () => {
    const { PlaceholderRuntimeCryptoProvider } = await import("../../../src/runtime/crypto_provider.js");
    const provider = new PlaceholderRuntimeCryptoProvider();
    const encryptDecision = await provider.encrypt({});
    expect(encryptDecision.allowed).toBe(false);
    expect(encryptDecision.state).toBe("NotConnected");
    const decryptDecision = await provider.decrypt({});
    expect(decryptDecision.allowed).toBe(false);
  });

  it("7. real AeadKeyHandle/AeadCiphertextHandle (Seam 2) carry no raw byte field -- grounds 01/04's opaque-handle finding", () => {
    const code = codeOnlyLines(wasmLoaderSource as string);
    const keyHandleStart = code.indexOf("export interface AeadKeyHandle");
    const keyHandleBody = code.slice(keyHandleStart, code.indexOf("}", keyHandleStart));
    expect(keyHandleBody).toMatch(/readonly kind:\s*"AeadKeyHandle"/);
    expect(keyHandleBody).not.toMatch(/bytes|Uint8Array|key:/i);

    const ciphertextHandleStart = code.indexOf("export interface AeadCiphertextHandle");
    const ciphertextHandleBody = code.slice(ciphertextHandleStart, code.indexOf("}", ciphertextHandleStart));
    expect(ciphertextHandleBody).toMatch(/readonly kind:\s*"AeadCiphertextHandle"/);
    expect(ciphertextHandleBody).not.toMatch(/bytes|Uint8Array/i);
  });

  it("8. the REAL AeadAlgorithm union (Seam 2) is narrower than Seam 1's own placeholder union -- grounds 05's suite-gap finding", () => {
    expect(wasmLoaderSource as string).toMatch(/export type AeadAlgorithm = "ChaCha20Poly1305" \| "Aes256Gcm"/);
    expect(cryptoTypesSource as string).toMatch(/export type AeadAlgorithm =/);
    expect(cryptoTypesSource as string).toMatch(/xchacha20poly1305/);
    // The real union must NOT itself carry the placeholder's xchacha20 label.
    const realUnionLine = (wasmLoaderSource as string).match(/export type AeadAlgorithm = [^\n]+/)?.[0] ?? "";
    expect(realUnionLine).not.toMatch(/xchacha/i);
  });

  it("9. AeadAadDomain already names a 'Conversation' value -- grounds 04/14's AAD-domain finding", () => {
    expect(wasmLoaderSource as string).toMatch(
      /AeadAadDomain\s*=\s*"RootKey"\s*\|\s*"Identity"\s*\|\s*"Storage"\s*\|\s*"Conversation"/,
    );
  });

  it("10. AeadCiphertextWire is a real, branded wire-string type -- grounds 04's envelope ciphertext-field finding", () => {
    expect(wasmLoaderSource as string).toMatch(/export type AeadCiphertextWire = string & \{/);
  });

  it("11. fedos_runtime_encrypt.ts / fedos_runtime_decrypt.ts both fail closed to null on any exception -- grounds 06/07's Encryption/Decryption Authority reuse finding", () => {
    for (const source of [runtimeEncryptSource, runtimeDecryptSource]) {
      const code = codeOnlyLines(source as string);
      expect(code).toMatch(/catch\s*\{\s*return null;\s*\}/);
    }
  });

  it("12. fedos_runtime_ciphertext_storage.ts only ever resolves MemoryStorageBackend -- grounds 02's storage-alignment rejection of Seam 2 storage", () => {
    expect(ciphertextStorageSource as string).toMatch(/resolveRuntimeStorageBackend/);
    expect(ciphertextStorageSource as string).toMatch(/NO OS Keychain, Secure Enclave, Cloud/i);
  });

  it("13. src/storage/policy.ts rejects metadata containing 'message'/'content'/'dm'/'body' -- grounds 02's storage-incompatibility finding, behavioral", async () => {
    const { reviewStoragePacket } = await import("../../../src/storage/policy.js");
    const rejected = reviewStoragePacket({
      backendKind: "local_sqlite_placeholder",
      visibility: "local_only",
      metadata: { conversationMessage: "x" },
    } as never);
    expect(rejected.allowed).toBe(false);
    expect(rejected.state).toBe("rejected");
    expect(storagePolicySource as string).toMatch(/"message"/);
    expect(storagePolicySource as string).toMatch(/"dm"/);
    expect(storagePolicySource as string).toMatch(/"body"/);
    expect(storagePolicySource as string).toMatch(/"content"/);
  });

  it("14. src/storage/encrypted_payload.ts additionally rejects 'chat'/'private'/'buyer' metadata -- grounds 02's finding for the fourth seam", () => {
    expect(encryptedPayloadSource as string).toMatch(/"chat"/);
    expect(encryptedPayloadSource as string).toMatch(/"private"/);
    expect(encryptedPayloadSource as string).toMatch(/"buyer"/);
  });

  it("15. src/chat/types.ts ChatMessage requires a NostrEvent and carries plain-string content with no encryption field -- grounds 03's Surface A/B split", () => {
    expect(chatTypesSource as string).toMatch(/export type ChatKind = "dm" \| "group"/);
    const code = codeOnlyLines(chatTypesSource as string);
    const messageStart = code.indexOf("export interface ChatMessage");
    const messageBody = code.slice(messageStart, code.indexOf("}", messageStart));
    expect(messageBody).toMatch(/content:\s*string/);
    expect(messageBody).toMatch(/event:\s*NostrEvent/);
    expect(messageBody).not.toMatch(/ciphertext|encrypt/i);
    expect(chatTypesSource as string).toMatch(/OUT OF SCOPE for this stage/i);
  });

  it("16. Conversation/ConversationPolicy/ConversationMode/ConversationId types now exist under src/ -- the Alpha 1051-1110 Conversation Runtime Consolidation Arc merged the Conversation domain this review's 'unimplemented' finding originally documented as absent", () => {
    function allSrcFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
      let files: string[] = [];
      for (const entry of entries) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          files = files.concat(allSrcFiles(path));
        } else if (entry.name.endsWith(".ts")) {
          files.push(path);
        }
      }
      return files;
    }
    const found: string[] = [];
    for (const file of allSrcFiles("src")) {
      const text = readFileSync(file, "utf8") as string;
      if (/\bFedosConversationPolicy\b|\bFedosConversationMode\b|\bFedosConversationId\b|\bFedosConversationMessageEnvelope\b/.test(text)) {
        found.push(file);
      }
    }
    expect(found.length).toBeGreaterThan(0);
  });

  it("17. conversation_key.rs remains pub(crate)-only in the checked-out Rust source -- grounds 01/12's BLOCK-1 finding", () => {
    const rustSource = readFileSync("packages/fedos-core-rust/src/crypto/conversation_key.rs", "utf8") as string;
    expect(rustSource).toMatch(/pub\(crate\)\s+fn derive_conversation_key_via_ecdh_internal/);
    expect(rustSource).not.toMatch(/#\[wasm_bindgen\]/);
  });

  it("18. nip44_public_api.rs's Nip44OpaqueStatus has exactly one variant, Unimplemented -- grounds 12's export-gap finding", () => {
    const rustSource = readFileSync("packages/fedos-core-rust/src/crypto/nip44_public_api.rs", "utf8") as string;
    expect(rustSource).toMatch(/Unimplemented/);
    expect(rustSource).toMatch(/adds NO public API/i);
  });

  it("19. a #[wasm_bindgen] export now exists near a conversation-key item in lib.rs -- Alpha 869's resolve_conversation_key (wired to the pre-existing crypto::conversation_key ECDH module, see test/nip44_key_derivation_stage_guard.test.ts test 8) closes 12's export-gap finding", () => {
    const libSource = readFileSync("packages/fedos-core-rust/src/lib.rs", "utf8") as string;
    expect(libSource).toMatch(/#\[wasm_bindgen\]\s*\nimpl FedosMasterSeedAuthority \{/);
    expect(libSource).toMatch(/pub fn resolve_conversation_key\(/);
  });

  it("20. package.json already names a build:wasm script -- grounds 12/20's finding that tooling (not just source) exists to close the artifact gap", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { scripts: Record<string, string> };
    expect(parsed.scripts["build:wasm"]).toMatch(/wasm-bindgen/);
  });

  it("21. FedosMasterSeedAuthority interface exposes no raw-byte getter -- grounds 01/06's Encryption-Authority-pattern finding", () => {
    expect(masterSeedAuthoritySource as string).not.toMatch(/getRawSeed|getSecretKey|exportRawBytes/i);
    expect(masterSeedAuthoritySource as string).toMatch(/isAvailable\(\): Promise<boolean>/);
    expect(masterSeedAuthoritySource as string).toMatch(/seal\(passphrase: Uint8Array\): Promise<FedosSealedMasterSeedEnvelopeV1 \| null>/);
  });

  it("22. package.json still carries exactly two production dependencies -- no new dependency introduced by this review", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });
});
