import { describe, it, expect, vi } from "vitest";
import {
  FedosWasmMasterSeedAuthority,
  type FedosMasterSeedWasmLoaderBoundary,
} from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import type { FedosMasterSeedAuthorityHandle } from "../src/runtime/fedos_wasm_loader.js";

const COUNTERPARTY_HEX = "ab".repeat(32);

function fakeHandle(overrides: Partial<FedosMasterSeedAuthorityHandle> = {}): FedosMasterSeedAuthorityHandle {
  return {
    is_available: vi.fn(() => true),
    is_cleared: vi.fn(() => false),
    generate: vi.fn(() => true),
    seal: vi.fn(() => undefined),
    restore_sealed: vi.fn(() => true),
    clear: vi.fn(),
    sign_nostr_event: vi.fn(() => "{}"),
    public_key_hex_for_account: vi.fn(() => "a".repeat(64)),
    resolve_conversation_key: vi.fn(() => ({ kind: "AeadKeyHandle" }) as unknown),
    seal_direct_ratchet_secret: vi.fn(() => "aabbccddeeff00112233445566778899aabbccdd"),
    restore_direct_ratchet_secret: vi.fn(() => new Uint8Array([1, 2, 3])),
    ...overrides,
  };
}

function boundaryWithResolveResult(
  handle: FedosMasterSeedAuthorityHandle | null,
  resolveResult: Awaited<ReturnType<FedosMasterSeedWasmLoaderBoundary["attemptDevOnlyMasterSeedResolveConversationKeyCall"]>>,
): FedosMasterSeedWasmLoaderBoundary {
  return {
    attemptDevOnlyMasterSeedAuthorityConstructCall: vi.fn(async () => ({
      attempted: true,
      succeeded: handle !== null,
      authority: handle,
      reason: handle !== null ? ("Succeeded" as const) : ("PrototypeStillClosed" as const),
    })),
    attemptDevOnlyMasterSeedGenerateCall: vi.fn(),
    attemptDevOnlyMasterSeedSealCall: vi.fn(),
    attemptDevOnlyMasterSeedRestoreSealedCall: vi.fn(),
    attemptDevOnlyMasterSeedClearCall: vi.fn(),
    attemptDevOnlyMasterSeedResolveConversationKeyCall: vi.fn(async () => resolveResult),
    attemptDevOnlyMasterSeedSealDirectRatchetSecretCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      sealedBlob: "aabbccddeeff00112233445566778899aabbccdd",
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyMasterSeedRestoreDirectRatchetSecretCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      secretBytes: new Uint8Array([1, 2, 3]),
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyEncryptNip44WireCall: vi.fn(),
    attemptDevOnlyDecryptNip44WireCall: vi.fn(),  };
}

describe("Secure Runtime Alpha 869 -- resolveConversationKey() TypeScript wiring", () => {
  it("1. no Master Seed constructed (gate closed) -- resolves null", async () => {
    const authority = new FedosWasmMasterSeedAuthority(
      boundaryWithResolveResult(null, { attempted: false, succeeded: false, keyHandle: null, reason: "PrototypeStillClosed" }),
    );
    expect(await authority.resolveConversationKey(0, COUNTERPARTY_HEX)).toBeNull();
  });

  it("2. successful resolution -- returns the opaque AeadKeyHandle unchanged", async () => {
    const keyHandle = { kind: "AeadKeyHandle" as const };
    const authority = new FedosWasmMasterSeedAuthority(
      boundaryWithResolveResult(fakeHandle(), { attempted: true, succeeded: true, keyHandle, reason: "Succeeded" }),
    );
    const result = await authority.resolveConversationKey(0, COUNTERPARTY_HEX);
    expect(result).toBe(keyHandle);
  });

  it("3. Rust-side derivation failure (e.g. malformed hex, off-curve key) -- resolves null, never throws", async () => {
    const authority = new FedosWasmMasterSeedAuthority(
      boundaryWithResolveResult(fakeHandle(), { attempted: true, succeeded: false, keyHandle: null, reason: "DerivationFailed" }),
    );
    await expect(authority.resolveConversationKey(0, "not-valid-hex")).resolves.toBeNull();
  });

  it("4. the loader boundary receives the exact account index and counterparty hex passed in", async () => {
    const resolveMock = vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      keyHandle: { kind: "AeadKeyHandle" as const },
      reason: "Succeeded" as const,
    }));
    const boundary = boundaryWithResolveResult(fakeHandle(), await resolveMock());
    boundary.attemptDevOnlyMasterSeedResolveConversationKeyCall = resolveMock;
    const authority = new FedosWasmMasterSeedAuthority(boundary);
    await authority.resolveConversationKey(7, COUNTERPARTY_HEX);
    expect(resolveMock).toHaveBeenCalledWith(expect.anything(), 7, COUNTERPARTY_HEX);
  });

  it("5. a wasm-level shape-check failure (InvalidHandleShape) resolves null just like any other failure reason", async () => {
    const authority = new FedosWasmMasterSeedAuthority(
      boundaryWithResolveResult(fakeHandle(), { attempted: true, succeeded: false, keyHandle: null, reason: "InvalidHandleShape" }),
    );
    expect(await authority.resolveConversationKey(0, COUNTERPARTY_HEX)).toBeNull();
  });
});
