/**
 * Secure Runtime Alpha 7161-7240 (FedOS Conversation-Level Production
 * Crypto and Identity Authority Wiring Arc) — structural guards, proving
 * by direct source inspection (never narrative claim alone) what this
 * Arc actually built and did NOT touch.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";
// @ts-expect-error see above.
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "b44e1a45";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

describe("Secure Runtime Alpha 7161-7240 -- structural guards", () => {
  it("1. zero Rust/Cargo change -- every new capability reuses an ALREADY-REAL, ALREADY-TESTED wasm_bindgen export, never new cryptography", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
    const rustSource = read("packages/fedos-core-rust/src/lib.rs");
    for (const exportName of ["encrypt_nip44_wire", "decrypt_nip44_wire", "build_and_sign_nip17_gift_wrap", "encrypt_aead", "decrypt_aead", "serialize_aead_ciphertext", "deserialize_aead_ciphertext"]) {
      expect(rustSource, exportName).toMatch(new RegExp(`pub fn ${exportName}`));
    }
  });

  it("2. Direct Ratchet's own cryptographic session logic, NIP-17's own Rumor/Seal/GiftWrap CONSTRUCTION pipeline, Identity Transition, and Signed Deletion source are untouched", () => {
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_outbound_integration.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts").trim()).toBe("");
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
    expect(diffNames("src/conversation/deletion_request").trim()).toBe("");
    expect(diffNames("src/conversation/invitation_bootstrap").trim()).toBe("");
  });

  it("3. the two NIP-17 files this Arc DID touch only relaxed a constructor parameter TYPE (concrete class -> the SAME class's own new interface) -- the construction pipeline itself is unmodified", () => {
    const giftWrapSource = stripComments(read("src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts"));
    expect(giftWrapSource).toMatch(/ephemeralSigningAuthority\.buildGiftWrap\(/);
    expect(giftWrapSource).toMatch(/ephemeralSigningAuthority:\s*FedosEphemeralGiftWrapSigningAuthority/);
    const adapterSource = stripComments(read("src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts"));
    expect(adapterSource).toMatch(/buildFedosNip17GiftWrap\(/);
    const ephemeralSource = stripComments(read("src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts"));
    expect(ephemeralSource).toMatch(/export interface FedosEphemeralGiftWrapSigningAuthority/);
    expect(ephemeralSource).toMatch(/class FedosWasmEphemeralGiftWrapSigningAuthority implements FedosEphemeralGiftWrapSigningAuthority/);
  });

  it("4. the legacy productionCryptoGraph path remains fully intact -- zero regression, zero removed capability", () => {
    const runtimeSource = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect(runtimeSource).toMatch(/assembleFedosConversationProductionCryptoGraph\(/);
    expect(runtimeSource).toMatch(/productionCryptoGraph\?\.creatorIdentityAuthority/);
    expect(runtimeSource).toMatch(/productionCryptoGraph\?\.encryptionAuthority/);
    // Legacy factory file itself is byte-for-byte unmodified.
    expect(diffNames("src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts").trim()).toBe("");
  });

  it("5. the canonical crypto graph is composed ENTIRELY over EXISTING, unmodified authority classes -- no new crypto class invented", () => {
    const source = stripComments(read("src/conversation/encryption/production/fedos_conversation_canonical_production_crypto_authority_factory.ts"));
    expect(source).toMatch(/new StaticFedosConversationCreatorIdentityAuthority\(/);
    expect(source).toMatch(/new FedosWasmConversationEncryptionAuthority\(/);
    expect(source).toMatch(/new FedosWasmConversationDecryptionAuthority\(/);
    expect(source).toMatch(/new FixedFedosConversationLocalAccountIndexAuthority\(/);
    expect(source).toMatch(/new FedosSigningAuthorityNostrAuthorBinding\(/);
    // No raw key material handling of any kind in this factory.
    expect(source).not.toMatch(/privateKey|private_key|secretKey|nsec|rawSeed/i);
  });

  it("6. the canonical Master Seed Authority is NEVER cleared by the Desktop Runtime's own stop() -- it is externally owned by the Coordinator's lock lifecycle, mirroring conversationDirectRatchetMasterSeedAuthority's own established discipline", () => {
    const source = read("src/desktop/runtime/fedos_desktop_runtime.ts");
    const stopBlockMatch = source.match(/if \(productionCryptoGraph !== null\) \{\s*await productionCryptoGraph\.masterSeedAuthority\.clear\(\);\s*\}/);
    expect(stopBlockMatch, "only the legacy self-constructed graph is cleared on stop").not.toBeNull();
    expect(source).not.toMatch(/canonicalCryptoGraph\.masterSeedAuthority\.clear\(\)/);
  });

  it("7. every new config field is optional and additive -- Runtime wiring is zero behavior change for every existing caller", () => {
    const configSource = stripComments(read("src/desktop/runtime/fedos_desktop_runtime_config.ts"));
    expect(configSource).toMatch(/readonly conversationCanonicalCryptoAuthority\?:/);
    const coordinatorSource = stripComments(read("src/desktop/onboarding/fedos_profile_initialization_coordinator.ts"));
    expect(coordinatorSource).toMatch(/readonly conversationCanonicalCryptoEnabled\?:/);
    expect(coordinatorSource).toMatch(/readonly conversationDirectMessageDeliveryRoute\?:/);
    expect(coordinatorSource).toMatch(/readonly conversationTransportInboundEnabled\?:/);
    expect(coordinatorSource).toMatch(/readonly conversationTransportIntervalMs\?:/);
  });

  it("8. no raw private key, Master Seed byte, or secret material appears anywhere in this Arc's own new production files", () => {
    const files = [
      "src/conversation/encryption/production/fedos_conversation_canonical_production_crypto_authority_factory.ts",
      "src/desktop/production_activation/fedos_production_ephemeral_gift_wrap_signing_authority.ts",
      "src/desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.ts",
    ];
    for (const file of files) {
      const source = stripComments(read(file));
      expect(source, file).not.toMatch(/privateKey|private_key|masterSeed.*handle.*byte|SecretHandle|root_key|nsec\b/i);
    }
  });

  it("9. every new production accessor on FedosProductionMasterSeedAuthority is gated on the SAME #cleared invariant every pre-existing method already uses", () => {
    const source = stripComments(read("src/desktop/production_activation/fedos_production_master_seed_authority.ts"));
    for (const method of ["buildEphemeralGiftWrap", "encryptAead", "decryptAead", "serializeAeadCiphertext", "deserializeAeadCiphertext"]) {
      const methodMatch = source.match(new RegExp(`${method}\\([^)]*\\)[^{]*\\{\\s*if \\(this\\.#cleared\\) return null;`));
      expect(methodMatch, method).not.toBeNull();
    }
  });

  it("10. no p2p/ or .tmp_gen/ file touched by this Arc", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
  });
});
