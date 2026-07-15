import { describe, it, expect, vi } from "vitest";
import {
  FedosWasmNostrSigningAuthority,
  type FedosNostrSigningWasmLoaderBoundary,
} from "../src/nostr/sign/fedos_wasm_nostr_signing_authority.js";
import { FedosWasmMasterSeedAuthority } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";
import type { FedosMasterSeedWasmLoaderBoundary } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";
import type { FedosMasterSeedAuthorityHandle } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterSource from "../src/nostr/sign/fedos_wasm_nostr_signing_authority.ts?raw";

const REAL_SIGNED_EVENT_JSON =
  '{"id":"8dfc662e1c95a0aa2e803316149583ff08b8e0a15c622b5b9a48b84983333cf2","pubkey":"0dd114ce42282a141284d9658753545d86574f763781ed302236d2e89f6668f7","created_at":1735000000,"kind":1,"tags":[["e","deadbeefcafe"],["p","abc123"]],"content":"Secure Runtime Alpha 446 fixture","sig":"cca2e65a427c06c01152baba037d68b978b0443c2211037a4df5a4579509bd3a993afa769b255880e0d962ca4b2d84f658eff155beaf81b623601ade3c57d100"}';

function fakeHandle(): FedosMasterSeedAuthorityHandle {
  return {
    is_available: vi.fn(() => true),
    is_cleared: vi.fn(() => false),
    generate: vi.fn(() => true),
    seal: vi.fn(() => undefined),
    restore_sealed: vi.fn(() => true),
    clear: vi.fn(),
    sign_nostr_event: vi.fn(() => REAL_SIGNED_EVENT_JSON),
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
    attemptDevOnlyMasterSeedGenerateCall: vi.fn(async () => ({ attempted: true, succeeded: true, reason: "Succeeded" as const })),
    attemptDevOnlyMasterSeedSealCall: vi.fn(async () => ({ attempted: true, succeeded: false, envelope: null, reason: "SealFailed" as const })),
    attemptDevOnlyMasterSeedRestoreSealedCall: vi.fn(async () => ({ attempted: true, succeeded: true, reason: "Succeeded" as const })),
    attemptDevOnlyMasterSeedClearCall: vi.fn(async () => ({ attempted: true, succeeded: true, reason: "Succeeded" as const })),
  };
  return new FedosWasmMasterSeedAuthority(boundary);
}

function mockSigningLoaderBoundary(signedEventJson: string | null): FedosNostrSigningWasmLoaderBoundary {
  return {
    attemptDevOnlyNostrSignEventCall: vi.fn(async () => ({
      attempted: true,
      succeeded: signedEventJson !== null,
      signedEventJson,
      reason: signedEventJson !== null ? ("Succeeded" as const) : ("SigningFailed" as const),
    })),
  };
}

const VALID_REQUEST = {
  accountIndex: 0,
  createdAt: 1_735_000_000,
  kind: 1,
  tags: [["e", "deadbeefcafe"], ["p", "abc123"]],
  content: "Secure Runtime Alpha 446 fixture",
};

describe("Secure Runtime Alpha 445 -- TypeScript Nostr Signing Authority Adapter", () => {
  it("signEvent() rejects a malformed request before ever reaching WASM", async () => {
    const loaderBoundary = mockSigningLoaderBoundary(REAL_SIGNED_EVENT_JSON);
    const authority = new FedosWasmNostrSigningAuthority(masterSeedAuthorityWithHandle(fakeHandle()), loaderBoundary);
    const result = await authority.signEvent({ ...VALID_REQUEST, kind: 7 });
    expect(result).toBeNull();
    expect(loaderBoundary.attemptDevOnlyNostrSignEventCall).not.toHaveBeenCalled();
  });

  it("signEvent() returns null when the Master Seed Authority has no available handle", async () => {
    const authority = new FedosWasmNostrSigningAuthority(
      masterSeedAuthorityWithHandle(null),
      mockSigningLoaderBoundary(REAL_SIGNED_EVENT_JSON),
    );
    expect(await authority.signEvent(VALID_REQUEST)).toBeNull();
  });

  it("signEvent() flattens tags with the U+0001 separator before crossing the WASM boundary", async () => {
    const loaderBoundary = mockSigningLoaderBoundary(REAL_SIGNED_EVENT_JSON);
    const authority = new FedosWasmNostrSigningAuthority(masterSeedAuthorityWithHandle(fakeHandle()), loaderBoundary);
    await authority.signEvent(VALID_REQUEST);
    const call = vi.mocked(loaderBoundary.attemptDevOnlyNostrSignEventCall).mock.calls[0]!;
    expect(call[4]).toEqual(["e\u{1}deadbeefcafe", "p\u{1}abc123"]);
  });

  it("signEvent() normalizes a real signed-event JSON string into a deep-frozen FedosNostrWireEvent", async () => {
    const authority = new FedosWasmNostrSigningAuthority(
      masterSeedAuthorityWithHandle(fakeHandle()),
      mockSigningLoaderBoundary(REAL_SIGNED_EVENT_JSON),
    );
    const event = await authority.signEvent(VALID_REQUEST);
    expect(event).not.toBeNull();
    expect(event?.id).toBe("8dfc662e1c95a0aa2e803316149583ff08b8e0a15c622b5b9a48b84983333cf2");
    expect(event?.kind).toBe(1);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event?.tags)).toBe(true);
  });

  it("signEvent() returns null (never throws) when WASM signing fails", async () => {
    const authority = new FedosWasmNostrSigningAuthority(
      masterSeedAuthorityWithHandle(fakeHandle()),
      mockSigningLoaderBoundary(null),
    );
    await expect(authority.signEvent(VALID_REQUEST)).resolves.toBeNull();
  });

  it("never selects a Relay or reads the Outbox -- source contains no such import", () => {
    // Doc comments legitimately name "Relay"/"Outbox" when explaining what this
    // file does NOT depend on -- only real `import ... from` paths matter here.
    const importLines = adapterSource.match(/^import .*$/gm) ?? [];
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toContain("relay");
      expect(line.toLowerCase()).not.toContain("outbox");
    }
  });
});
