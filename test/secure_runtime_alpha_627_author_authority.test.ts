import { describe, it, expect } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import type { FedosIdentityDescriptor } from "../src/identity/fedos_identity_descriptor.js";
import {
  FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER,
  anonymousLocalAuthorReference,
  resolvePublicAuthorReference,
} from "../src/board/runtime/fedos_board_runtime_author_authority.js";

function readerResolvingTo(descriptor: FedosIdentityDescriptor | null): FedosPublicIdentityReader {
  return { readPublicIdentity: async () => descriptor };
}

/**
 * Secure Runtime Alpha 627 ("Author Authority Decision") -- Stage 7 of
 * the Alpha 621-640 Public Board Runtime Application API Foundation
 * Arc. Confirms Option B (anonymous local author, preferring a real
 * identity whenever one resolves) against real `DesktopApplication`
 * behavior -- including today's real default (Alpha 621/B1: identity
 * always resolves to `null`).
 */
describe("Secure Runtime Alpha 627 -- Author Authority Decision", () => {
  it("1. today's REAL default DesktopApplication resolves an anonymous-local author (B1: default identity source is always null)", () => {
    const app = new DesktopApplication();
    const author = resolvePublicAuthorReference(app);
    expect(author.identityId).toBeNull();
    expect(author.protocol).toBe("fedos");
    expect(author.publicIdentifier).toBe(FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER);
  });

  it("2. never throws and never returns null, even before start()/readPublicIdentity() is ever called", () => {
    const app = new DesktopApplication();
    expect(() => resolvePublicAuthorReference(app)).not.toThrow();
    expect(resolvePublicAuthorReference(app)).not.toBeNull();
  });

  it("3. resolves a REAL identity when one is present and structurally valid", async () => {
    const app = new DesktopApplication(
      readerResolvingTo({ id: "local-id-1", provider: "nostr", publicIdentifier: "npub1realuser" }),
    );
    await app.readPublicIdentity();
    const author = resolvePublicAuthorReference(app);
    expect(author).toEqual({ identityId: "local-id-1", protocol: "nostr", publicIdentifier: "npub1realuser" });
  });

  it("4. falls back to anonymous-local when the resolved identity's provider is not a recognized FedosBoardSourceProtocol -- fails closed, never guesses", async () => {
    const app = new DesktopApplication(
      readerResolvingTo({ id: "local-id-2", provider: "unknown-future-provider", publicIdentifier: "whatever" }),
    );
    await app.readPublicIdentity();
    const author = resolvePublicAuthorReference(app);
    expect(author.protocol).toBe("fedos");
    expect(author.publicIdentifier).toBe(FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER);
  });

  it("5. falls back to anonymous-local when the resolved identity's publicIdentifier is empty", async () => {
    const app = new DesktopApplication(readerResolvingTo({ id: "local-id-3", provider: "nostr", publicIdentifier: "  " }));
    await app.readPublicIdentity();
    const author = resolvePublicAuthorReference(app);
    expect(author.publicIdentifier).toBe(FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER);
  });

  it("6. the anonymous-local sentinel is a SINGLE fixed value, never a per-call random pseudo-identity -- never conflates display pseudonym with cryptographic author", () => {
    const a = anonymousLocalAuthorReference();
    const b = anonymousLocalAuthorReference();
    expect(a).toEqual(b);
  });

  it("7. caller cannot supply an author -- resolvePublicAuthorReference()'s only input is a DesktopApplication, never a caller-facing identifier parameter", () => {
    expect(resolvePublicAuthorReference.length).toBe(1);
  });
});
