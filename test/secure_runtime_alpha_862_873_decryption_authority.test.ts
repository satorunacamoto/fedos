import { describe, it, expect, vi } from "vitest";
import { Buffer } from "node:buffer";
import {
  FedosWasmConversationEncryptionAuthority,
  type FedosConversationEncryptionRuntimeBoundary,
} from "../src/os/messenger/conversations/encryption/fedos_wasm_conversation_encryption_authority.js";
import {
  FedosWasmConversationDecryptionAuthority,
  type FedosConversationDecryptionRuntimeBoundary,
} from "../src/os/messenger/conversations/encryption/fedos_wasm_conversation_decryption_authority.js";
import type { FedosConversationEncryptionRequest } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionRequest } from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";

const REQUEST: FedosConversationEncryptionRequest = {
  envelopeId: "envelope-1" as any,
  conversationId: "board-a::thread-1" as any,
  senderMembershipId: "board-a::thread-1::fedos::alice" as any,
  keyEpoch: 0,
  createdAt: 1_700_000_000,
  replyToEnvelopeId: null,
  suite: "ChaCha20Poly1305",
  plaintext: new TextEncoder().encode("hello, bob"),
  localAccountIndex: 0,
  counterpartyPublicKeyHex: "ab".repeat(32),
};

function decryptionRequestFrom(
  request: FedosConversationEncryptionRequest,
  ciphertext: Uint8Array,
): FedosConversationDecryptionRequest {
  return {
    envelopeId: request.envelopeId,
    conversationId: request.conversationId,
    senderMembershipId: request.senderMembershipId,
    keyEpoch: request.keyEpoch,
    createdAt: request.createdAt,
    replyToEnvelopeId: request.replyToEnvelopeId,
    suite: request.suite,
    localAccountIndex: request.localAccountIndex,
    counterpartyPublicKeyHex: request.counterpartyPublicKeyHex,
    ciphertext,
  };
}

const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;
const CIPHERTEXT_HANDLE: AeadCiphertextHandle = { kind: "AeadCiphertextHandle" };

function fakeMasterSeedAuthority(resolveConversationKey: FedosMasterSeedAuthority["resolveConversationKey"]): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey,
    encryptNip44Wire: vi.fn(async () => null),
    decryptNip44Wire: vi.fn(async () => null),
  };
}

function fakeDecryptionBoundary(overrides: Partial<FedosConversationDecryptionRuntimeBoundary> = {}): FedosConversationDecryptionRuntimeBoundary {
  return {
    importCiphertext: vi.fn(async () => CIPHERTEXT_HANDLE),
    decrypt: vi.fn(async () => new TextEncoder().encode("does-not-matter")),
    ...overrides,
  };
}

/**
 * A minimal, in-memory fake AEAD pair shared between an Encryption and a
 * Decryption Authority for a full round-trip test -- NOT real
 * cryptography (that is Rust/Vector-tested elsewhere, see
 * `packages/fedos-core-rust/src/lib.rs`'s own
 * `resolve_conversation_key_*` tests and
 * `test/fedos_core_rust_nip44_wire_nonce_payload.test.ts`). This fake
 * exists ONLY to prove the TypeScript-side wiring -- the associated-data
 * prepend/strip/compare cycle and the wire-bytes round-trip -- end to
 * end, keyed by object identity through a shared registry.
 */
function fakeSharedAeadPair(): {
  encryptionBoundary: FedosConversationEncryptionRuntimeBoundary;
  decryptionBoundary: FedosConversationDecryptionRuntimeBoundary;
} {
  const byHandle = new WeakMap<AeadCiphertextHandle, Uint8Array>();
  const byWire = new Map<string, Uint8Array>();

  const encryptionBoundary: FedosConversationEncryptionRuntimeBoundary = {
    encrypt: async (_key, _algorithm, _aadDomain, plaintext) => {
      const handle: AeadCiphertextHandle = { kind: "AeadCiphertextHandle" };
      byHandle.set(handle, plaintext);
      return handle;
    },
    exportCiphertext: async (handle) => {
      const plaintext = byHandle.get(handle);
      if (plaintext === undefined) return null;
      const wire = Buffer.from(plaintext).toString("base64");
      byWire.set(wire, plaintext);
      return wire as any;
    },
  };

  const decryptionBoundary: FedosConversationDecryptionRuntimeBoundary = {
    importCiphertext: async (serialized) => {
      if (!byWire.has(serialized as unknown as string)) return null;
      const handle: AeadCiphertextHandle = { kind: "AeadCiphertextHandle" };
      byHandle.set(handle, byWire.get(serialized as unknown as string)!);
      return handle;
    },
    decrypt: async (_key, _algorithm, _aadDomain, ciphertext) => byHandle.get(ciphertext) ?? null,
  };

  return { encryptionBoundary, decryptionBoundary };
}

/**
 * Secure Runtime Alpha 862 ("Decryption Authority") / 865 ("its own
 * result vocabulary") / 871 ("Decryption Authority Implementation") --
 * Stages 2/5/11 of Phase B of the Alpha 851-890 Private Message Envelope
 * and Encryption Authority Activation Arc.
 */
describe("Secure Runtime Alpha 862/865/871 -- FedosWasmConversationDecryptionAuthority", () => {
  it("1. invalid-input -- a negative localAccountIndex fails closed before any key resolution", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(resolveConversationKey),
      fakeDecryptionBoundary(),
    );
    const request = decryptionRequestFrom({ ...REQUEST, localAccountIndex: -1 }, new Uint8Array([1, 2, 3]));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "invalid-input" });
    expect(resolveConversationKey).not.toHaveBeenCalled();
  });

  it("2. invalid-input -- malformed UTF-8 ciphertext bytes fail closed before any key resolution", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(resolveConversationKey),
      fakeDecryptionBoundary(),
    );
    // A lone continuation byte -- not valid UTF-8 on its own.
    const request = decryptionRequestFrom(REQUEST, new Uint8Array([0xff, 0xfe, 0xfd]));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "invalid-input" });
    expect(resolveConversationKey).not.toHaveBeenCalled();
  });

  it("3. key-unavailable -- resolveConversationKey resolves null", async () => {
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => null)),
      fakeDecryptionBoundary(),
    );
    const request = decryptionRequestFrom(REQUEST, new TextEncoder().encode("wire"));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("4. key-unavailable -- resolveConversationKey throws (never propagates)", async () => {
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => {
        throw new Error("boom");
      })),
      fakeDecryptionBoundary(),
    );
    const request = decryptionRequestFrom(REQUEST, new TextEncoder().encode("wire"));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("5. failed -- importCiphertext resolves null", async () => {
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeDecryptionBoundary({ importCiphertext: vi.fn(async () => null) }),
    );
    const request = decryptionRequestFrom(REQUEST, new TextEncoder().encode("wire"));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("6. failed -- decrypt resolves null (undifferentiated AEAD failure, no oracle)", async () => {
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeDecryptionBoundary({ decrypt: vi.fn(async () => null) }),
    );
    const request = decryptionRequestFrom(REQUEST, new TextEncoder().encode("wire"));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("7. failed -- the runtime boundary throws (never propagates)", async () => {
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeDecryptionBoundary({
        importCiphertext: vi.fn(async () => {
          throw new Error("boom");
        }),
      }),
    );
    const request = decryptionRequestFrom(REQUEST, new TextEncoder().encode("wire"));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("8. failed -- recovered plaintext shorter than the expected associated-data header", async () => {
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeDecryptionBoundary({ decrypt: vi.fn(async () => new Uint8Array([1, 2])) }),
    );
    const request = decryptionRequestFrom(REQUEST, new TextEncoder().encode("wire"));
    const result = await authority.decrypt(request);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("9. round-trip: encrypt() then decrypt() with the SAME request fields recovers the original plaintext", async () => {
    const { encryptionBoundary, decryptionBoundary } = fakeSharedAeadPair();
    const encryptionAuthority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      encryptionBoundary,
    );
    const decryptionAuthority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      decryptionBoundary,
    );

    const encrypted = await encryptionAuthority.encrypt(REQUEST);
    expect(encrypted.outcome).toBe("encrypted");
    if (encrypted.outcome !== "encrypted") throw new Error("unreachable");

    const decryptRequest = decryptionRequestFrom(REQUEST, encrypted.ciphertext);
    const decrypted = await decryptionAuthority.decrypt(decryptRequest);
    expect(decrypted.outcome).toBe("decrypted");
    if (decrypted.outcome !== "decrypted") throw new Error("unreachable");
    expect(decrypted.plaintext).toEqual(REQUEST.plaintext);
  });

  it("10. round-trip failure: a tampered Envelope field (different conversationId at decrypt time) fails closed to \"failed\", never a distinguishable reason", async () => {
    const { encryptionBoundary, decryptionBoundary } = fakeSharedAeadPair();
    const encryptionAuthority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      encryptionBoundary,
    );
    const decryptionAuthority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      decryptionBoundary,
    );

    const encrypted = await encryptionAuthority.encrypt(REQUEST);
    if (encrypted.outcome !== "encrypted") throw new Error("unreachable");

    const tamperedRequest = decryptionRequestFrom(
      { ...REQUEST, conversationId: "board-a::thread-2" as any },
      encrypted.ciphertext,
    );
    const decrypted = await decryptionAuthority.decrypt(tamperedRequest);
    expect(decrypted).toEqual({ outcome: "failed" });
  });

  it("11. resolveConversationKey is called with exactly the request's own localAccountIndex/counterpartyPublicKeyHex", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmConversationDecryptionAuthority(
      fakeMasterSeedAuthority(resolveConversationKey),
      fakeDecryptionBoundary(),
    );
    const request = decryptionRequestFrom(
      { ...REQUEST, localAccountIndex: 7, counterpartyPublicKeyHex: "cd".repeat(32) },
      new TextEncoder().encode("wire"),
    );
    await authority.decrypt(request);
    expect(resolveConversationKey).toHaveBeenCalledWith(7, "cd".repeat(32));
  });
});
