import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { NostrPublicIdentityReader } from "../src/os/messenger/desktop/nostr_public_identity_reader.js";
import { StaticNostrPublicIdentitySource } from "../src/os/messenger/desktop/static_nostr_public_identity_source.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosDesktopPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/fedos_desktop_public_author_authority.js";
import type { FedosPublicIdentityReader } from "../src/os/messenger/desktop/fedos_public_identity_reader.js";
import type { FedosIdentityDescriptor } from "../src/os/core/identity/fedos_identity_descriptor.js";

function fixedDescriptorReader(descriptor: FedosIdentityDescriptor): FedosPublicIdentityReader {
  return { readPublicIdentity: async () => descriptor };
}

async function readyHostWithIdentity(
  reader: FedosPublicIdentityReader = new NostrPublicIdentityReader(
    new StaticNostrPublicIdentitySource({ id: "local-1", publicIdentifier: "npub1resolved" }),
  ),
): Promise<FedosDesktopHost> {
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(reader),
    boardPersistence: new InMemoryFedosBoardPersistence(),
  });
  await host.start();
  return host;
}

/**
 * Secure Runtime Alpha 644 ("Resolved Identity Mapping Policy") — Stage
 * 4 of the Alpha 641-680 Arc.
 */
describe("Secure Runtime Alpha 644 -- Resolved Identity Mapping Policy", () => {
  it("1. a real, resolved Nostr identity maps to a 'resolved' outcome, publicIdentifier preserved verbatim", async () => {
    const host = await readyHostWithIdentity();
    const authority = new FedosDesktopPublicAuthorAuthority(host);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution.outcome).toBe("resolved");
    if (resolution.outcome !== "resolved") throw new Error("unreachable");
    expect(resolution.author.publicIdentifier).toBe("npub1resolved");
    expect(resolution.author.identityId).toBe("local-1");
    expect(resolution.author.protocol).toBe("nostr");
  });

  it("2. no configured identity (today's real default) maps to 'anonymous-local'", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const authority = new FedosDesktopPublicAuthorAuthority(host);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution.outcome).toBe("anonymous-local");
    if (resolution.outcome !== "anonymous-local") throw new Error("unreachable");
    expect(resolution.author.protocol).toBe("fedos");
    expect(resolution.author.publicIdentifier).toBe("local-anonymous");
  });

  it("3. a not-yet-ready Host resolves 'unavailable', distinct from 'anonymous-local'", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    const authority = new FedosDesktopPublicAuthorAuthority(host);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution).toEqual({ outcome: "unavailable" });
  });

  it("4. displayName/avatar are never read into the mapped author reference", async () => {
    const reader = new NostrPublicIdentityReader(
      new StaticNostrPublicIdentitySource({
        id: "local-2",
        publicIdentifier: "npub1withdisplay",
        displayName: "Alice",
        avatar: "https://example.invalid/a.png",
      }),
    );
    const host = await readyHostWithIdentity(reader);
    const authority = new FedosDesktopPublicAuthorAuthority(host);
    const resolution = await authority.resolvePublicAuthor();
    if (resolution.outcome !== "resolved") throw new Error("unreachable");
    expect(Object.keys(resolution.author).sort()).toEqual(["identityId", "protocol", "publicIdentifier"]);
  });

  it("5. mapping is deterministic across repeated calls for the same identity", async () => {
    const host = await readyHostWithIdentity();
    const authority = new FedosDesktopPublicAuthorAuthority(host);
    const first = await authority.resolvePublicAuthor();
    const second = await authority.resolvePublicAuthor();
    expect(first).toEqual(second);
  });

  it("6. a resolved identity with an unrecognized provider fails closed to 'conflict', not 'resolved' or silent promotion", async () => {
    const host = await readyHostWithIdentity(
      fixedDescriptorReader({ id: "local-3", provider: "some-unrecognized-provider", publicIdentifier: "x" }),
    );
    const authority = new FedosDesktopPublicAuthorAuthority(host);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution).toEqual({ outcome: "conflict" });
  });

  it("7. a resolved identity with an empty publicIdentifier fails closed to 'conflict'", async () => {
    const host = await readyHostWithIdentity(
      fixedDescriptorReader({ id: "local-4", provider: "nostr", publicIdentifier: "   " }),
    );
    const authority = new FedosDesktopPublicAuthorAuthority(host);
    const resolution = await authority.resolvePublicAuthor();
    expect(resolution).toEqual({ outcome: "conflict" });
  });
});
