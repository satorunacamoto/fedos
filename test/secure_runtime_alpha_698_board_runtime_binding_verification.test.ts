import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardRuntime } from "../src/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/board/runtime/fedos_board_runtime_id_generator.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import type { FedosNostrSigningAuthority } from "../src/nostr/sign/fedos_nostr_signing_authority.js";

const CONTROLLED_HEX = "0dd114".repeat(11).slice(0, 64);
const OTHER_HEX = "1ee225".repeat(11).slice(0, 64);

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

function readerResolvingToNostr(publicIdentifier: string): FedosPublicIdentityReader {
  return { readPublicIdentity: async () => ({ id: "id-1", provider: "nostr", publicIdentifier }) };
}

function fakeSigningAuthorityControlling(accountIndex: number, publicKeyHex: string): FedosNostrSigningAuthority {
  return {
    async signEvent() {
      throw new Error("must never be called in this test");
    },
    async publicIdentityForAccount(requestedIndex: number) {
      if (requestedIndex !== accountIndex) return null;
      return { accountIndex, publicKeyHex };
    },
  };
}

async function newHost(desktopApplication: DesktopApplication): Promise<{
  host: FedosDesktopHost;
  outboxPersistence: InMemoryFedosBoardOutboxPersistence;
}> {
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  const host = new FedosDesktopHost({
    desktopApplication,
    boardPersistence: new InMemoryFedosBoardPersistence(),
    outboxPersistence,
  });
  await host.start();
  return { host, outboxPersistence };
}

/**
 * Secure Runtime Alpha 698 ("BoardRuntime Binding Verification") --
 * Stage 18 of Phase A of the Alpha 681-720 Arc. Closes the Alpha
 * 649/665/667-test-6 blocker: a real, controlled Nostr identity's public
 * post with an explicit nostr target now becomes eligible, once a
 * genuine `FedosNostrAuthorBindingAuthority` confirms the resolved
 * author IS the signing authority's own account.
 */
describe("Secure Runtime Alpha 698 -- BoardRuntime Binding Verification", () => {
  it("1. a matching signing-backed author + nostr target becomes eligible (Outbox intent created)", async () => {
    const desktopApplication = new DesktopApplication(readerResolvingToNostr(CONTROLLED_HEX));
    const { host, outboxPersistence } = await newHost(desktopApplication);
    const signingAuthority = fakeSigningAuthorityControlling(0, CONTROLLED_HEX);
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("post-1"),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
      nostrAccountIndex: 0,
    });

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "inserted" }]);
    expect(outboxPersistence.listIntents()).toHaveLength(1);
  });

  it("2. a mismatched author (resolved identifier != signing authority's own derived key) stays ineligible, but the post itself still persists", async () => {
    const desktopApplication = new DesktopApplication(readerResolvingToNostr(OTHER_HEX));
    const { host, outboxPersistence } = await newHost(desktopApplication);
    const signingAuthority = fakeSigningAuthorityControlling(0, CONTROLLED_HEX);
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("post-2"),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
      nostrAccountIndex: 0,
    });

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    expect(result.outcome).toBe("outbox-partial-failure");
    if (result.outcome !== "outbox-partial-failure") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "ineligible" }]);
    expect(outboxPersistence.listIntents()).toHaveLength(0);
    expect(host.board()?.findPost(result.post.id)).not.toBeNull();
  });

  it("3. anonymous local-only (no outboundTargets) still succeeds, unaffected by any Binding Authority", async () => {
    const { host } = await newHost(new DesktopApplication());
    const signingAuthority = fakeSigningAuthorityControlling(0, CONTROLLED_HEX);
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("post-3"),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
    });

    const result = await runtime.createPublicThread({ boardId: "board-a", body: "local only" });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.outbox).toEqual([]);
  });

  it("4. anonymous author + nostr target stays ineligible -- an anonymous-local author can never bind (protocol is 'fedos', not 'nostr')", async () => {
    const { host, outboxPersistence } = await newHost(new DesktopApplication());
    const signingAuthority = fakeSigningAuthorityControlling(0, CONTROLLED_HEX);
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("post-4"),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
      nostrAccountIndex: 0,
    });

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "anon",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    expect(result.outcome).toBe("outbox-partial-failure");
    expect(outboxPersistence.listIntents()).toHaveLength(0);
  });

  it("5. no Binding Authority configured at all preserves the pre-Alpha-681 fail-closed default (identical to test 6 in secure_runtime_alpha_633)", async () => {
    const desktopApplication = new DesktopApplication(readerResolvingToNostr(CONTROLLED_HEX));
    const { host, outboxPersistence } = await newHost(desktopApplication);
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("post-5") });

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    expect(result.outcome).toBe("outbox-partial-failure");
    expect(outboxPersistence.listIntents()).toHaveLength(0);
  });

  it("6. no partial persistence: an ineligible target never leaves a dangling Outbox intent, even across multiple requested targets", async () => {
    const desktopApplication = new DesktopApplication(readerResolvingToNostr(CONTROLLED_HEX));
    const { host, outboxPersistence } = await newHost(desktopApplication);
    const signingAuthority = fakeSigningAuthorityControlling(0, CONTROLLED_HEX);
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("post-6"),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
      nostrAccountIndex: 0,
    });

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello",
      outboundTargets: [
        { protocol: "nostr", destination: null },
        { protocol: "activitypub", destination: null },
      ],
    });

    expect(result.outcome).toBe("outbox-partial-failure");
    if (result.outcome !== "outbox-partial-failure") throw new Error("unreachable");
    expect(result.outbox).toEqual([
      { target: { protocol: "nostr", destination: null }, result: "inserted" },
      { target: { protocol: "activitypub", destination: null }, result: "ineligible" },
    ]);
    expect(outboxPersistence.listIntents()).toHaveLength(1);
  });
});
