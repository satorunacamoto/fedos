import { describe, it, expect, vi } from "vitest";
import {
  FedosWasmMasterSeedAuthority,
  type FedosMasterSeedWasmLoaderBoundary,
} from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import type { FedosMasterSeedAuthorityHandle } from "../src/runtime/fedos_wasm_loader.js";

function fakeHandle(overrides: Partial<FedosMasterSeedAuthorityHandle> = {}): FedosMasterSeedAuthorityHandle {
  return {
    is_available: vi.fn(() => false),
    is_cleared: vi.fn(() => false),
    generate: vi.fn(() => true),
    seal: vi.fn(() => "sealed-envelope-json"),
    restore_sealed: vi.fn(() => true),
    clear: vi.fn(),
    sign_nostr_event: vi.fn(() => "signed-event-json"),
    public_key_hex_for_account: vi.fn(() => "a".repeat(64)),
    resolve_conversation_key: vi.fn(() => ({ kind: "AeadKeyHandle" }) as unknown),
    seal_direct_ratchet_secret: vi.fn(() => "aabbccddeeff00112233445566778899aabbccdd"),
    restore_direct_ratchet_secret: vi.fn(() => new Uint8Array([1, 2, 3])),
    ...overrides,
  };
}

function mockLoaderBoundary(handle: FedosMasterSeedAuthorityHandle | null): FedosMasterSeedWasmLoaderBoundary {
  return {
    attemptDevOnlyMasterSeedAuthorityConstructCall: vi.fn(async () => ({
      attempted: true,
      succeeded: handle !== null,
      authority: handle,
      reason: handle !== null ? ("Succeeded" as const) : ("PrototypeStillClosed" as const),
    })),
    attemptDevOnlyMasterSeedGenerateCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyMasterSeedSealCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      envelope: '{"v":1,"kdf":"argon2id","fake":"envelope"}',
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyMasterSeedRestoreSealedCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyMasterSeedClearCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyMasterSeedResolveConversationKeyCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      keyHandle: { kind: "AeadKeyHandle" } as const,
      reason: "Succeeded" as const,
    })),
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
    attemptDevOnlyEncryptNip44WireCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      payload: "AgAA",
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyDecryptNip44WireCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      plaintext: new Uint8Array([1, 2, 3]),
      reason: "Succeeded" as const,
    })),
  };
}

describe("Secure Runtime Alpha 438 -- TypeScript Authority Boundary", () => {
  it("isAvailable()/isCleared() report false when the dev-only gate is closed (no handle constructed)", async () => {
    const authority = new FedosWasmMasterSeedAuthority(mockLoaderBoundary(null));
    expect(await authority.isAvailable()).toBe(false);
    expect(await authority.isCleared()).toBe(false);
  });

  it("generate() routes through the gated loader call and reports success", async () => {
    const handle = fakeHandle();
    const boundary = mockLoaderBoundary(handle);
    const authority = new FedosWasmMasterSeedAuthority(boundary);
    expect(await authority.generate()).toBe(true);
    expect(boundary.attemptDevOnlyMasterSeedGenerateCall).toHaveBeenCalledWith(handle);
  });

  it("seal() returns a deep-frozen envelope wrapping exactly the returned JSON string", async () => {
    const authority = new FedosWasmMasterSeedAuthority(mockLoaderBoundary(fakeHandle()));
    const envelope = await authority.seal(new Uint8Array([1, 2, 3]));
    expect(envelope).not.toBeNull();
    expect(envelope?.json).toBe('{"v":1,"kdf":"argon2id","fake":"envelope"}');
    expect(Object.isFrozen(envelope)).toBe(true);
  });

  it("restoreSealed() passes the envelope's own json string and the passphrase through unchanged", async () => {
    const handle = fakeHandle();
    const boundary = mockLoaderBoundary(handle);
    const authority = new FedosWasmMasterSeedAuthority(boundary);
    const passphrase = new Uint8Array([9, 9, 9]);
    const succeeded = await authority.restoreSealed({ json: "envelope-text" }, passphrase);
    expect(succeeded).toBe(true);
    expect(boundary.attemptDevOnlyMasterSeedRestoreSealedCall).toHaveBeenCalledWith(
      handle,
      "envelope-text",
      passphrase,
    );
  });

  it("clear() is a no-op that never throws when construction never succeeded", async () => {
    const authority = new FedosWasmMasterSeedAuthority(mockLoaderBoundary(null));
    await expect(authority.clear()).resolves.toBeUndefined();
  });

  it("the same constructed handle is reused across multiple calls (lazy, memoized construction)", async () => {
    const handle = fakeHandle();
    const boundary = mockLoaderBoundary(handle);
    const authority = new FedosWasmMasterSeedAuthority(boundary);
    await authority.generate();
    await authority.isAvailable();
    expect(boundary.attemptDevOnlyMasterSeedAuthorityConstructCall).toHaveBeenCalledTimes(1);
  });

  it("accessForNostrSigningAuthorityInternalUse() returns the same opaque handle, never a copy of secret state", async () => {
    const handle = fakeHandle();
    const authority = new FedosWasmMasterSeedAuthority(mockLoaderBoundary(handle));
    const accessed = await authority.accessForNostrSigningAuthorityInternalUse();
    expect(accessed).toBe(handle);
  });

  it("no public method on FedosWasmMasterSeedAuthority returns raw seed bytes", () => {
    const proto = Object.getOwnPropertyNames(FedosWasmMasterSeedAuthority.prototype);
    expect(proto).not.toContain("exposeSeedBytes");
    expect(proto).not.toContain("rawSeed");
    expect(proto).not.toContain("secretKeyBytes");
  });
});
