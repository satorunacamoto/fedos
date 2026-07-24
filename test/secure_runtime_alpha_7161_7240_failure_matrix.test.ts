/**
 * Secure Runtime Alpha 7161-7240 — Failure matrix. Proves the new
 * canonical crypto graph factory, the new
 * `FedosProductionMasterSeedAuthority` accessors, and the new
 * production runtime boundaries all fail CLOSED (never a throw, never
 * fabricated success) on malformed/unavailable input. Uses mocked, narrow
 * dependencies (no real WASM needed) so these run unconditionally,
 * mirroring this codebase's own established failure-matrix convention.
 */
import { describe, it, expect } from "vitest";
import { assembleFedosConversationCanonicalProductionCryptoGraph } from "../src/conversation/encryption/production/fedos_conversation_canonical_production_crypto_authority_factory.js";
import { FedosProductionEphemeralGiftWrapSigningAuthority } from "../src/desktop/production_activation/fedos_production_ephemeral_gift_wrap_signing_authority.js";
import {
  FedosProductionConversationEncryptionRuntimeBoundary,
  FedosProductionConversationDecryptionRuntimeBoundary,
} from "../src/desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.js";
import { FEDOS_GIFT_WRAP_KIND } from "../src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";

function mockMasterSeedAuthority(publicKeyHex: string | null) {
  return {
    isAvailable: async () => true,
    isCleared: async () => false,
    generate: async () => true,
    restoreSealed: async () => true,
    seal: async () => null,
    clear: async () => {},
    resolveConversationKey: async () => null,
  } as unknown as import("../src/runtime/master_seed/fedos_master_seed_authority.js").FedosMasterSeedAuthority;
  void publicKeyHex;
}

function mockSigningAuthority(publicKeyHex: string | null) {
  return {
    signEvent: async () => null,
    publicIdentityForAccount: async (accountIndex: number) =>
      publicKeyHex === null ? null : { accountIndex, publicKeyHex },
  } as unknown as import("../src/nostr/sign/fedos_nostr_signing_authority.js").FedosNostrSigningAuthority;
}

describe("Secure Runtime Alpha 7161-7240 -- failure matrix", () => {
  it("1. canonical crypto graph: invalid accountIndex fails closed to null", async () => {
    const result = await assembleFedosConversationCanonicalProductionCryptoGraph({
      masterSeedAuthority: mockMasterSeedAuthority(null),
      signingAuthority: mockSigningAuthority("a".repeat(64)),
      accountIndex: -1,
    });
    expect(result).toBeNull();
  });

  it("2. canonical crypto graph: unresolvable local identity fails closed to null", async () => {
    const result = await assembleFedosConversationCanonicalProductionCryptoGraph({
      masterSeedAuthority: mockMasterSeedAuthority(null),
      signingAuthority: mockSigningAuthority(null),
      accountIndex: 0,
    });
    expect(result).toBeNull();
  });

  it("3. canonical crypto graph: a real identity resolves a real graph shape (mocked authorities, no WASM needed)", async () => {
    const result = await assembleFedosConversationCanonicalProductionCryptoGraph({
      masterSeedAuthority: mockMasterSeedAuthority("b".repeat(64)),
      signingAuthority: mockSigningAuthority("b".repeat(64)),
      accountIndex: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.creatorIdentityAuthority.resolveCreator()).toEqual({
      outcome: "resolved",
      creator: { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null },
    });
  });

  it("4. ephemeral gift wrap authority: an unrecognized kind fails closed", async () => {
    const authority = new FedosProductionEphemeralGiftWrapSigningAuthority({
      buildEphemeralGiftWrap: () => "unreachable -- kind check happens before this is ever called",
    });
    const result = await authority.buildGiftWrap("c".repeat(64), 1_000_000, 9999, new TextEncoder().encode("x"));
    expect(result).toBeNull();
  });

  it("5. ephemeral gift wrap authority: a malformed recipient key fails closed", async () => {
    const authority = new FedosProductionEphemeralGiftWrapSigningAuthority({
      buildEphemeralGiftWrap: () => "unreachable",
    });
    const result = await authority.buildGiftWrap("not-a-real-hex-key", 1_000_000, FEDOS_GIFT_WRAP_KIND, new TextEncoder().encode("x"));
    expect(result).toBeNull();
  });

  it("6. ephemeral gift wrap authority: empty plaintext fails closed", async () => {
    const authority = new FedosProductionEphemeralGiftWrapSigningAuthority({
      buildEphemeralGiftWrap: () => "unreachable",
    });
    const result = await authority.buildGiftWrap("d".repeat(64), 1_000_000, FEDOS_GIFT_WRAP_KIND, new Uint8Array(0));
    expect(result).toBeNull();
  });

  it("7. ephemeral gift wrap authority: the underlying handle source returning null fails closed", async () => {
    const authority = new FedosProductionEphemeralGiftWrapSigningAuthority({
      buildEphemeralGiftWrap: () => null,
    });
    const result = await authority.buildGiftWrap("e".repeat(64), 1_000_000, FEDOS_GIFT_WRAP_KIND, new TextEncoder().encode("x"));
    expect(result).toBeNull();
  });

  it("8. ephemeral gift wrap authority: a malformed signed-event JSON from the handle source fails closed, never throws", async () => {
    const authority = new FedosProductionEphemeralGiftWrapSigningAuthority({
      buildEphemeralGiftWrap: () => "{not valid json",
    });
    const result = await authority.buildGiftWrap("f".repeat(64), 1_000_000, FEDOS_GIFT_WRAP_KIND, new TextEncoder().encode("x"));
    expect(result).toBeNull();
  });

  it("9. ephemeral gift wrap authority: the underlying handle source throwing is caught, never propagates", async () => {
    const authority = new FedosProductionEphemeralGiftWrapSigningAuthority({
      buildEphemeralGiftWrap: () => {
        throw new Error("simulated internal failure");
      },
    });
    await expect(authority.buildGiftWrap("0".repeat(64), 1_000_000, FEDOS_GIFT_WRAP_KIND, new TextEncoder().encode("x"))).resolves.toBeNull();
  });

  it("10. encryption runtime boundary: the underlying handle source returning null fails closed", async () => {
    const boundary = new FedosProductionConversationEncryptionRuntimeBoundary({
      encryptAead: () => null,
      decryptAead: () => null,
      serializeAeadCiphertext: () => null,
      deserializeAeadCiphertext: () => null,
    });
    const encrypted = await boundary.encrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "Conversation", new TextEncoder().encode("x"));
    expect(encrypted).toBeNull();
    const exported = await boundary.exportCiphertext({ kind: "AeadCiphertextHandle" } as never);
    expect(exported).toBeNull();
  });

  it("11. decryption runtime boundary: the underlying handle source returning null fails closed", async () => {
    const boundary = new FedosProductionConversationDecryptionRuntimeBoundary({
      encryptAead: () => null,
      decryptAead: () => null,
      serializeAeadCiphertext: () => null,
      deserializeAeadCiphertext: () => null,
    });
    const imported = await boundary.importCiphertext("not-a-real-wire" as never);
    expect(imported).toBeNull();
    const decrypted = await boundary.decrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "Conversation", { kind: "AeadCiphertextHandle" } as never);
    expect(decrypted).toBeNull();
  });

  it("12. encryption/decryption runtime boundaries: the underlying handle source throwing is caught, never propagates", async () => {
    const throwing = {
      encryptAead: () => {
        throw new Error("simulated");
      },
      decryptAead: () => {
        throw new Error("simulated");
      },
      serializeAeadCiphertext: () => {
        throw new Error("simulated");
      },
      deserializeAeadCiphertext: () => {
        throw new Error("simulated");
      },
    };
    const encBoundary = new FedosProductionConversationEncryptionRuntimeBoundary(throwing);
    const decBoundary = new FedosProductionConversationDecryptionRuntimeBoundary(throwing);
    await expect(encBoundary.encrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "Conversation", new Uint8Array())).resolves.toBeNull();
    await expect(encBoundary.exportCiphertext({ kind: "AeadCiphertextHandle" } as never)).resolves.toBeNull();
    await expect(decBoundary.importCiphertext("x" as never)).resolves.toBeNull();
    await expect(decBoundary.decrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "Conversation", { kind: "AeadCiphertextHandle" } as never)).resolves.toBeNull();
  });
});
