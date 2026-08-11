import { describe, it, expect } from "vitest";
import { FedosNostrSigningPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/fedos_nostr_signing_public_author_authority.js";
import type { FedosNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";

const HEX = "0dd114".repeat(11).slice(0, 64);

function fakeSigningAuthority(byAccount: Record<number, string | null>): FedosNostrSigningAuthority {
  return {
    async signEvent() {
      throw new Error("must never be called by FedosNostrSigningPublicAuthorAuthority");
    },
    async publicIdentityForAccount(accountIndex: number) {
      const hex = byAccount[accountIndex];
      if (hex === undefined || hex === null) return null;
      return { accountIndex, publicKeyHex: hex };
    },
  };
}

/**
 * Secure Runtime Alpha 690 ("Public Author Authority Assembly") / Alpha
 * 691 ("Resolved Nostr Author Authority") -- Stages 10-11 of Phase A of
 * the Alpha 681-720 Arc.
 */
describe("Secure Runtime Alpha 690/691 -- Nostr Signing Public Author Authority", () => {
  it("1. resolves a 'resolved' author whose publicIdentifier IS the signing authority's own derived hex", async () => {
    const authority = new FedosNostrSigningPublicAuthorAuthority(fakeSigningAuthority({ 0: HEX }), 0);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution).toEqual({
      outcome: "resolved",
      author: { identityId: null, protocol: "nostr", publicIdentifier: HEX },
    });
  });

  it("2. resolves 'unavailable' when the signing authority cannot derive (no Master Seed held)", async () => {
    const authority = new FedosNostrSigningPublicAuthorAuthority(fakeSigningAuthority({}), 0);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution).toEqual({ outcome: "unavailable" });
  });

  it("3. uses the configured accountIndex, not always 0", async () => {
    const authority = new FedosNostrSigningPublicAuthorAuthority(fakeSigningAuthority({ 7: HEX }), 7);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution).toEqual({
      outcome: "resolved",
      author: { identityId: null, protocol: "nostr", publicIdentifier: HEX },
    });
  });

  it("4. never returns displayName/avatar -- FedosBoardAuthorReference's own permanent exclusion", async () => {
    const authority = new FedosNostrSigningPublicAuthorAuthority(fakeSigningAuthority({ 0: HEX }), 0);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution.outcome).toBe("resolved");
    if (resolution.outcome === "resolved") {
      expect(Object.keys(resolution.author).sort()).toEqual(["identityId", "protocol", "publicIdentifier"]);
    }
  });

  it("5. a self-assembled author always binds against the SAME signing authority/account -- consistency by construction", async () => {
    const signingAuthority = fakeSigningAuthority({ 0: HEX });
    const authorAuthority = new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0);
    const resolution = await authorAuthority.resolvePublicAuthor();
    expect(resolution.outcome).toBe("resolved");
    if (resolution.outcome !== "resolved") return;

    const { FedosSigningAuthorityNostrAuthorBinding } = await import(
      "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js"
    );
    const binding = new FedosSigningAuthorityNostrAuthorBinding(signingAuthority);
    const bindingResult = await binding.verifyBinding({ author: resolution.author, accountIndex: 0 });
    expect(bindingResult.outcome).toBe("bound");
  });
});
