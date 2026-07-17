import { describe, it, expect, vi } from "vitest";
import { FedosWasmNostrSigningAuthority } from "../src/nostr/sign/fedos_wasm_nostr_signing_authority.js";
import { FedosWasmMasterSeedAuthority } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";
import type { FedosMasterSeedWasmLoaderBoundary } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";
import type { FedosNostrSigningWasmLoaderBoundary } from "../src/nostr/sign/fedos_wasm_nostr_signing_authority.js";
import type { FedosMasterSeedAuthorityHandle } from "../src/runtime/fedos_wasm_loader.js";
import { isWellFormedFedosNostrSigningPublicIdentity } from "../src/nostr/sign/fedos_nostr_signing_public_identity.js";

const VALID_HEX = "645ac5".repeat(11).slice(0, 64);

function fakeHandle(overrides: Partial<FedosMasterSeedAuthorityHandle> = {}): FedosMasterSeedAuthorityHandle {
  return {
    is_available: vi.fn(() => true),
    is_cleared: vi.fn(() => false),
    generate: vi.fn(() => true),
    seal: vi.fn(() => undefined),
    restore_sealed: vi.fn(() => true),
    clear: vi.fn(),
    sign_nostr_event: vi.fn(() => "{}"),
    public_key_hex_for_account: vi.fn(() => VALID_HEX),
    resolve_conversation_key: vi.fn(() => ({ kind: "AeadKeyHandle" }) as unknown),
    ...overrides,
  };
}

function masterSeedAuthorityWithHandle(handle: FedosMasterSeedAuthorityHandle | null): FedosWasmMasterSeedAuthority {
  const boundary: FedosMasterSeedWasmLoaderBoundary = {
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
    attemptDevOnlyMasterSeedResolveConversationKeyCall: vi.fn(),
  };
  return new FedosWasmMasterSeedAuthority(boundary);
}

function signingLoaderBoundary(publicKeyHex: string | null): FedosNostrSigningWasmLoaderBoundary {
  return {
    attemptDevOnlyNostrSignEventCall: vi.fn(),
    attemptDevOnlyNostrPublicIdentityForAccountCall: vi.fn(async () => ({
      attempted: true,
      succeeded: publicKeyHex !== null,
      publicKeyHex,
      reason: publicKeyHex !== null ? ("Succeeded" as const) : ("DerivationFailed" as const),
    })),
  };
}

/**
 * Secure Runtime Alpha 683 ("Signing Public Identity Output") / Alpha
 * 684 ("Signing Public Identity Method") / Alpha 685 ("Rust/WASM
 * Boundary Review") -- Stages 3-5 of Phase A of the Alpha 681-720 Arc.
 */
describe("Secure Runtime Alpha 683/684/685 -- Signing Public Identity", () => {
  it("1. publicIdentityForAccount returns accountIndex + canonical hex on success", async () => {
    const authority = new FedosWasmNostrSigningAuthority(
      masterSeedAuthorityWithHandle(fakeHandle()),
      signingLoaderBoundary(VALID_HEX),
    );
    const identity = await authority.publicIdentityForAccount(3);
    expect(identity).toEqual({ accountIndex: 3, publicKeyHex: VALID_HEX });
    expect(isWellFormedFedosNostrSigningPublicIdentity(identity)).toBe(true);
  });

  it("2. returns null when no Master Seed is held", async () => {
    const authority = new FedosWasmNostrSigningAuthority(
      masterSeedAuthorityWithHandle(null),
      signingLoaderBoundary(VALID_HEX),
    );
    expect(await authority.publicIdentityForAccount(0)).toBeNull();
  });

  it("3. returns null when the loader boundary fails to derive", async () => {
    const authority = new FedosWasmNostrSigningAuthority(
      masterSeedAuthorityWithHandle(fakeHandle()),
      signingLoaderBoundary(null),
    );
    expect(await authority.publicIdentityForAccount(0)).toBeNull();
  });

  it("4. rejects a non-canonical (e.g. uppercase, or wrong-length) hex return from the boundary -- fails closed, never trusts an injected boundary blindly", async () => {
    const authority = new FedosWasmNostrSigningAuthority(
      masterSeedAuthorityWithHandle(fakeHandle()),
      signingLoaderBoundary("ABCDEF"),
    );
    expect(await authority.publicIdentityForAccount(0)).toBeNull();
  });

  it("5. rejects an out-of-range or non-integer accountIndex before ever reaching the WASM boundary", async () => {
    const loaderBoundary = signingLoaderBoundary(VALID_HEX);
    const authority = new FedosWasmNostrSigningAuthority(masterSeedAuthorityWithHandle(fakeHandle()), loaderBoundary);
    expect(await authority.publicIdentityForAccount(-1)).toBeNull();
    expect(await authority.publicIdentityForAccount(1.5)).toBeNull();
    expect(await authority.publicIdentityForAccount(4_294_967_296)).toBeNull();
    expect(loaderBoundary.attemptDevOnlyNostrPublicIdentityForAccountCall).not.toHaveBeenCalled();
  });

  it("6. never signs -- the loader boundary's sign call is never invoked by publicIdentityForAccount", async () => {
    const loaderBoundary = signingLoaderBoundary(VALID_HEX);
    const authority = new FedosWasmNostrSigningAuthority(masterSeedAuthorityWithHandle(fakeHandle()), loaderBoundary);
    await authority.publicIdentityForAccount(0);
    expect(loaderBoundary.attemptDevOnlyNostrSignEventCall).not.toHaveBeenCalled();
  });

  it("7. isWellFormedFedosNostrSigningPublicIdentity rejects malformed candidates", () => {
    expect(isWellFormedFedosNostrSigningPublicIdentity(null)).toBe(false);
    expect(isWellFormedFedosNostrSigningPublicIdentity({ accountIndex: 0 })).toBe(false);
    expect(isWellFormedFedosNostrSigningPublicIdentity({ accountIndex: 0, publicKeyHex: "npub1x" })).toBe(false);
    expect(isWellFormedFedosNostrSigningPublicIdentity({ accountIndex: -1, publicKeyHex: VALID_HEX })).toBe(false);
    expect(
      isWellFormedFedosNostrSigningPublicIdentity({ accountIndex: 0, publicKeyHex: VALID_HEX, extra: "x" }),
    ).toBe(false);
    expect(isWellFormedFedosNostrSigningPublicIdentity({ accountIndex: 0, publicKeyHex: VALID_HEX })).toBe(true);
  });
});
