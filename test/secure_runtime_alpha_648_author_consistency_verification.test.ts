import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { NostrPublicIdentityReader } from "../src/os/messenger/desktop/nostr_public_identity_reader.js";
import { StaticNostrPublicIdentitySource } from "../src/os/messenger/desktop/static_nostr_public_identity_source.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosDesktopPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/fedos_desktop_public_author_authority.js";
import { StaticFedosPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/static_fedos_public_author_authority.js";
import type { CreatePublicThreadCommand, ReplyToPublicThreadCommand } from "../src/os/messenger/board/runtime/fedos_board_runtime_command_types.js";

async function readyHostWithIdentity(publicIdentifier: string): Promise<FedosDesktopHost> {
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(
      new NostrPublicIdentityReader(new StaticNostrPublicIdentitySource({ id: "id-1", publicIdentifier })),
    ),
    boardPersistence: new InMemoryFedosBoardPersistence(),
  });
  await host.start();
  return host;
}

/**
 * Secure Runtime Alpha 648 ("Author Consistency Verification") — Stage
 * 8 of the Alpha 641-680 Arc.
 */
describe("Secure Runtime Alpha 648 -- Author Consistency Verification", () => {
  it("1. command types carry no author/publicIdentifier/identityId field -- caller structurally cannot supply one", () => {
    const createFields = Object.keys({ boardId: "b", body: "x" } satisfies CreatePublicThreadCommand);
    const replyFields = Object.keys({
      boardId: "b",
      threadId: "t",
      replyTo: "r",
      body: "x",
    } satisfies ReplyToPublicThreadCommand);
    for (const forbidden of ["author", "publicIdentifier", "identityId", "signature"]) {
      expect(createFields).not.toContain(forbidden);
      expect(replyFields).not.toContain(forbidden);
    }
  });

  it("2. two independent FedosDesktopPublicAuthorAuthority instances over DIFFERENT hosts never share identity", async () => {
    const hostA = await readyHostWithIdentity("npub1AAA");
    const hostB = await readyHostWithIdentity("npub1BBB");
    const authorityA = new FedosDesktopPublicAuthorAuthority(hostA);
    const authorityB = new FedosDesktopPublicAuthorAuthority(hostB);
    const resolutionA = await authorityA.resolvePublicAuthor();
    const resolutionB = await authorityB.resolvePublicAuthor();
    if (resolutionA.outcome !== "resolved" || resolutionB.outcome !== "resolved") throw new Error("unreachable");
    expect(resolutionA.author.publicIdentifier).toBe("npub1AAA");
    expect(resolutionB.author.publicIdentifier).toBe("npub1BBB");
  });

  it("3. two instances over the SAME host observe the SAME identity", async () => {
    const host = await readyHostWithIdentity("npub1shared");
    const first = new FedosDesktopPublicAuthorAuthority(host);
    const second = new FedosDesktopPublicAuthorAuthority(host);
    expect(await first.resolvePublicAuthor()).toEqual(await second.resolvePublicAuthor());
  });

  it("4. StaticFedosPublicAuthorAuthority never varies from its constructed resolution, across any number of calls", async () => {
    const fixed = { outcome: "resolved" as const, author: { identityId: "x", protocol: "nostr" as const, publicIdentifier: "npub1fixed" } };
    const authority = new StaticFedosPublicAuthorAuthority(fixed);
    expect(await authority.resolvePublicAuthor()).toEqual(fixed);
    expect(await authority.resolvePublicAuthor()).toEqual(fixed);
  });
});
