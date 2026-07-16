import { describe, it, expect } from "vitest";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import type { FedosNostrSigningAuthority } from "../src/nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrSigningPublicIdentity } from "../src/nostr/sign/fedos_nostr_signing_public_identity.js";
import type { FedosBoardAuthorReference } from "../src/board/fedos_board_author.js";

/** Deterministic, exactly-64-hex-char test fixture -- pads `seed` with itself until long enough, then truncates. */
function fixtureHex(seed: string): string {
  let hex = seed;
  while (hex.length < 64) hex += seed;
  return hex.slice(0, 64);
}

const ACCOUNT_0_HEX = fixtureHex("a0");
const ACCOUNT_1_HEX = fixtureHex("b1");

/** A scriptable fake `FedosNostrSigningAuthority` keyed by account index -- never a real WASM/crypto dependency (Rust owns the real cryptographic verification, `packages/fedos-core-rust/src/lib.rs`'s own `public_key_hex_for_account_*` tests). */
function fakeSigningAuthority(byAccount: Record<number, string | null>): FedosNostrSigningAuthority {
  return {
    async signEvent() {
      throw new Error("must never be called by FedosSigningAuthorityNostrAuthorBinding");
    },
    async publicIdentityForAccount(accountIndex: number): Promise<FedosNostrSigningPublicIdentity | null> {
      const hex = byAccount[accountIndex];
      if (hex === undefined || hex === null) return null;
      return { accountIndex, publicKeyHex: hex };
    },
  };
}

function nostrAuthor(publicIdentifier: string): FedosBoardAuthorReference {
  return Object.freeze({ identityId: null, protocol: "nostr", publicIdentifier });
}

/**
 * Secure Runtime Alpha 686 ("Canonical Nostr Author Binding Type") /
 * Alpha 687 ("Public Identifier Normalization Decision") / Alpha 688
 * ("Binding Authority Interface") -- Stages 6-8 of Phase A of the Alpha
 * 681-720 Arc.
 */
describe("Secure Runtime Alpha 686/687/688 -- Nostr Author Binding Authority", () => {
  it("1. bound: resolved author's publicIdentifier equals the signing authority's own derived hex for the account", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: ACCOUNT_0_HEX }));
    const result = await binding.verifyBinding({ author: nostrAuthor(ACCOUNT_0_HEX), accountIndex: 0 });
    expect(result).toEqual({ outcome: "bound", accountIndex: 0, publicKeyHex: ACCOUNT_0_HEX });
  });

  it("2. author-not-nostr: an activitypub/atproto/session/fedos author can never bind, regardless of publicIdentifier shape", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: ACCOUNT_0_HEX }));
    for (const protocol of ["activitypub", "atproto", "session", "fedos"] as const) {
      const author: FedosBoardAuthorReference = Object.freeze({
        identityId: null,
        protocol,
        publicIdentifier: ACCOUNT_0_HEX,
      });
      const result = await binding.verifyBinding({ author, accountIndex: 0 });
      expect(result).toEqual({ outcome: "author-not-nostr" });
    }
  });

  it("3. invalid-author-identifier: an npub-form identifier fails closed rather than being decoded -- Alpha 687's own 'hex only' decision", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: ACCOUNT_0_HEX }));
    const result = await binding.verifyBinding({ author: nostrAuthor("npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"), accountIndex: 0 });
    expect(result).toEqual({ outcome: "invalid-author-identifier" });
  });

  it("3b. invalid-author-identifier: uppercase hex is rejected -- never case-normalized, matching signEvent's own canonical-lowercase-only convention", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: ACCOUNT_0_HEX }));
    const result = await binding.verifyBinding({ author: nostrAuthor(ACCOUNT_0_HEX.toUpperCase()), accountIndex: 0 });
    expect(result).toEqual({ outcome: "invalid-author-identifier" });
  });

  it("3c. invalid-author-identifier: wrong-length hex is rejected", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: ACCOUNT_0_HEX }));
    const result = await binding.verifyBinding({ author: nostrAuthor("abcd"), accountIndex: 0 });
    expect(result).toEqual({ outcome: "invalid-author-identifier" });
  });

  it("4. signing-authority-unavailable: no Master Seed held (publicIdentityForAccount returns null)", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({}));
    const result = await binding.verifyBinding({ author: nostrAuthor(ACCOUNT_0_HEX), accountIndex: 0 });
    expect(result).toEqual({ outcome: "signing-authority-unavailable" });
  });

  it("5. public-key-mismatch: a real Signing Authority derives a DIFFERENT key for this account than the author claims -- the core anti-impersonation guard", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: ACCOUNT_1_HEX }));
    const result = await binding.verifyBinding({ author: nostrAuthor(ACCOUNT_0_HEX), accountIndex: 0 });
    expect(result).toEqual({ outcome: "public-key-mismatch" });
  });

  it("6. account 0 and account 1 are independently checked -- binding for account 0 never accidentally matches account 1's own key", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(
      fakeSigningAuthority({ 0: ACCOUNT_0_HEX, 1: ACCOUNT_1_HEX }),
    );
    const boundToZero = await binding.verifyBinding({ author: nostrAuthor(ACCOUNT_0_HEX), accountIndex: 0 });
    const mismatchAtOne = await binding.verifyBinding({ author: nostrAuthor(ACCOUNT_0_HEX), accountIndex: 1 });
    expect(boundToZero.outcome).toBe("bound");
    expect(mismatchAtOne.outcome).toBe("public-key-mismatch");
  });

  it("7. never calls signEvent -- this class only ever calls publicIdentityForAccount, never signs", async () => {
    const binding = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: ACCOUNT_0_HEX }));
    await expect(binding.verifyBinding({ author: nostrAuthor(ACCOUNT_0_HEX), accountIndex: 0 })).resolves.toEqual({
      outcome: "bound",
      accountIndex: 0,
      publicKeyHex: ACCOUNT_0_HEX,
    });
  });
});
