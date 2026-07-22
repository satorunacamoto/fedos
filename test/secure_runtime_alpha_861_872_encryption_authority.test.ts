import { describe, it, expect, vi } from "vitest";
import {
  FedosWasmConversationEncryptionAuthority,
  type FedosConversationEncryptionRuntimeBoundary,
} from "../src/conversation/encryption/fedos_wasm_conversation_encryption_authority.js";
import type { FedosConversationEncryptionRequest } from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { encodeFedosConversationEnvelopeAssociatedData } from "../src/conversation/envelope/fedos_conversation_envelope_associated_data.js";

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

function fakeRuntimeBoundary(overrides: Partial<FedosConversationEncryptionRuntimeBoundary> = {}): FedosConversationEncryptionRuntimeBoundary {
  return {
    encrypt: vi.fn(async () => CIPHERTEXT_HANDLE),
    exportCiphertext: vi.fn(async () => "wire-text" as any),
    ...overrides,
  };
}

/**
 * Secure Runtime Alpha 861 ("Encryption Authority") / 863 ("its own
 * result vocabulary") / 870 ("Encryption Authority Implementation") --
 * Stages 1/3/10 of Phase B of the Alpha 851-890 Private Message Envelope
 * and Encryption Authority Activation Arc.
 */
describe("Secure Runtime Alpha 861/863/870 -- FedosWasmConversationEncryptionAuthority", () => {
  it("1. invalid-input -- a negative localAccountIndex fails closed before any key resolution", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(resolveConversationKey),
      fakeRuntimeBoundary(),
    );
    const result = await authority.encrypt({ ...REQUEST, localAccountIndex: -1 });
    expect(result).toEqual({ outcome: "invalid-input" });
    expect(resolveConversationKey).not.toHaveBeenCalled();
  });

  it("2. invalid-input -- a non-integer localAccountIndex fails closed", async () => {
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRuntimeBoundary(),
    );
    const result = await authority.encrypt({ ...REQUEST, localAccountIndex: 1.5 });
    expect(result).toEqual({ outcome: "invalid-input" });
  });

  it("3. key-unavailable -- resolveConversationKey resolves null", async () => {
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => null)),
      fakeRuntimeBoundary(),
    );
    const result = await authority.encrypt(REQUEST);
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("4. key-unavailable -- resolveConversationKey throws (never propagates)", async () => {
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => {
        throw new Error("boom");
      })),
      fakeRuntimeBoundary(),
    );
    const result = await authority.encrypt(REQUEST);
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("5. failed -- the runtime boundary's encrypt() resolves null", async () => {
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRuntimeBoundary({ encrypt: vi.fn(async () => null) }),
    );
    const result = await authority.encrypt(REQUEST);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("6. failed -- the runtime boundary's exportCiphertext() resolves null", async () => {
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRuntimeBoundary({ exportCiphertext: vi.fn(async () => null) }),
    );
    const result = await authority.encrypt(REQUEST);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("7. failed -- the runtime boundary throws (never propagates)", async () => {
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRuntimeBoundary({
        encrypt: vi.fn(async () => {
          throw new Error("boom");
        }),
      }),
    );
    const result = await authority.encrypt(REQUEST);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("8. encrypted -- full success returns UTF-8-encoded wire bytes", async () => {
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRuntimeBoundary({ exportCiphertext: vi.fn(async () => "wire-text" as any) }),
    );
    const result = await authority.encrypt(REQUEST);
    expect(result.outcome).toBe("encrypted");
    if (result.outcome !== "encrypted") throw new Error("unreachable");
    expect(new TextDecoder().decode(result.ciphertext)).toBe("wire-text");
  });

  it("9. the associated-data header is prepended to the real plaintext before encrypt() is called", async () => {
    const encrypt = vi.fn(async () => CIPHERTEXT_HANDLE);
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRuntimeBoundary({ encrypt }),
    );
    await authority.encrypt(REQUEST);

    const expectedHeader = encodeFedosConversationEnvelopeAssociatedData({
      id: REQUEST.envelopeId,
      conversationId: REQUEST.conversationId,
      senderMembershipId: REQUEST.senderMembershipId,
      keyEpoch: REQUEST.keyEpoch,
      createdAt: REQUEST.createdAt,
      replyToEnvelopeId: REQUEST.replyToEnvelopeId,
      encryptionSuite: REQUEST.suite,
    });
    const [, , , actualPlaintext] = encrypt.mock.calls[0] as unknown as [unknown, unknown, unknown, Uint8Array];
    expect(actualPlaintext.subarray(0, expectedHeader.length)).toEqual(expectedHeader);
    expect(actualPlaintext.subarray(expectedHeader.length)).toEqual(REQUEST.plaintext);
  });

  it("10. resolveConversationKey is called with exactly the request's own localAccountIndex/counterpartyPublicKeyHex", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(resolveConversationKey),
      fakeRuntimeBoundary(),
    );
    await authority.encrypt({ ...REQUEST, localAccountIndex: 7, counterpartyPublicKeyHex: "cd".repeat(32) });
    expect(resolveConversationKey).toHaveBeenCalledWith(7, "cd".repeat(32));
  });

  it("11. encrypt() is called with the request's own suite and the fixed Conversation AAD domain", async () => {
    const encrypt = vi.fn(async () => CIPHERTEXT_HANDLE);
    const authority = new FedosWasmConversationEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRuntimeBoundary({ encrypt }),
    );
    await authority.encrypt(REQUEST);
    expect(encrypt).toHaveBeenCalledWith(KEY_HANDLE, "ChaCha20Poly1305", "Conversation", expect.any(Uint8Array));
  });
});
