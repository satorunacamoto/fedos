import { describe, it, expect } from "vitest";
import { AnonymousLocalPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/anonymous_local_public_author_authority.js";
import { FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER } from "../src/os/messenger/board/runtime/fedos_board_runtime_author_authority.js";

/**
 * Secure Runtime Alpha 645 ("Anonymous Local Author Policy") — Stage 5
 * of the Alpha 641-680 Arc.
 */
describe("Secure Runtime Alpha 645 -- Anonymous Local Author Policy", () => {
  it("1. always resolves 'anonymous-local', regardless of how many times called", async () => {
    const authority = new AnonymousLocalPublicAuthorAuthority();
    const first = await authority.resolvePublicAuthor();
    const second = await authority.resolvePublicAuthor();
    expect(first.outcome).toBe("anonymous-local");
    expect(second.outcome).toBe("anonymous-local");
  });

  it("2. reuses the SAME fixed sentinel constant Alpha 627 already established -- not a duplicate literal", async () => {
    const authority = new AnonymousLocalPublicAuthorAuthority();
    const resolution = await authority.resolvePublicAuthor();
    if (resolution.outcome !== "anonymous-local") throw new Error("unreachable");
    expect(resolution.author.publicIdentifier).toBe(FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER);
  });

  it("3. protocol is always 'fedos' -- never presented as nostr/activitypub/atproto/session", async () => {
    const authority = new AnonymousLocalPublicAuthorAuthority();
    const resolution = await authority.resolvePublicAuthor();
    if (resolution.outcome !== "anonymous-local") throw new Error("unreachable");
    expect(resolution.author.protocol).toBe("fedos");
  });

  it("4. identityId is always null -- no local identity record backs this author", async () => {
    const authority = new AnonymousLocalPublicAuthorAuthority();
    const resolution = await authority.resolvePublicAuthor();
    if (resolution.outcome !== "anonymous-local") throw new Error("unreachable");
    expect(resolution.author.identityId).toBeNull();
  });
});
