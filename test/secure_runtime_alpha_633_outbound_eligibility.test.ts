import { describe, it, expect, beforeEach } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/os/messenger/board/runtime/fedos_board_runtime_id_generator.js";
import {
  FEDOS_BOARD_RUNTIME_PUBLIC_ELIGIBLE_PROTOCOLS,
  isEligibleForPublicOutboundTarget,
} from "../src/os/messenger/board/runtime/fedos_board_runtime_outbound_eligibility.js";
import { anonymousLocalAuthorReference } from "../src/os/messenger/board/runtime/fedos_board_runtime_author_authority.js";
import type { FedosPublicIdentityReader } from "../src/os/messenger/desktop/fedos_public_identity_reader.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

function readerResolvingToNostr(publicIdentifier: string): FedosPublicIdentityReader {
  return { readPublicIdentity: async () => ({ id: "id-1", provider: "nostr", publicIdentifier }) };
}

/**
 * Secure Runtime Alpha 633 ("Outbound Eligibility V1") / Alpha 635
 * ("Nostr Outbound Behavior") -- Stages 13/15 of the Alpha 621-640
 * Public Board Runtime Application API Foundation Arc.
 */
describe("Secure Runtime Alpha 633 -- Outbound Eligibility V1", () => {
  it("1. session is never eligible for public fan-out, for any author", async () => {
    const anon = anonymousLocalAuthorReference();
    expect(isEligibleForPublicOutboundTarget(anon, { protocol: "session", destination: null })).toBe(false);
    expect(
      isEligibleForPublicOutboundTarget(
        { identityId: "x", protocol: "nostr", publicIdentifier: "npub1x" },
        { protocol: "session", destination: null },
      ),
    ).toBe(false);
  });

  it("2. an anonymous-local author is never eligible for ANY outbound target -- no real identity to sign under", async () => {
    const anon = anonymousLocalAuthorReference();
    for (const protocol of FEDOS_BOARD_RUNTIME_PUBLIC_ELIGIBLE_PROTOCOLS) {
      expect(isEligibleForPublicOutboundTarget(anon, { protocol, destination: null })).toBe(false);
    }
  });

  it("3. a real nostr-protocol author is eligible for a nostr target", async () => {
    const author = { identityId: "id-1", protocol: "nostr" as const, publicIdentifier: "npub1x" };
    expect(isEligibleForPublicOutboundTarget(author, { protocol: "nostr", destination: null })).toBe(true);
  });

  it("4. a real nostr-protocol author is NOT eligible for activitypub/atproto targets -- no identity resolution exists for those protocols yet, impersonation guard", async () => {
    const author = { identityId: "id-1", protocol: "nostr" as const, publicIdentifier: "npub1x" };
    expect(isEligibleForPublicOutboundTarget(author, { protocol: "activitypub", destination: null })).toBe(false);
    expect(isEligibleForPublicOutboundTarget(author, { protocol: "atproto", destination: null })).toBe(false);
  });

  it("5. end to end: an anonymous-author public post with an explicit nostr target produces an 'ineligible' outbox entry, never an Outbox intent write", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
    });
    await host.start();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("post-1") });

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    // The post write itself succeeds, but the sole requested target was
    // ineligible -- Alpha 636's own "partial successを隠さない" requirement
    // means this must surface as outbox-partial-failure, never a bare "created"
    // that would silently hide the fact federation did not happen.
    expect(result.outcome).toBe("outbox-partial-failure");
    if (result.outcome !== "outbox-partial-failure") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "ineligible" }]);
    expect(outboxPersistence.listIntents()).toHaveLength(0);
  });

  it("6. end to end (updated, Alpha 667/Phase C): a real nostr-identity author's public post with an explicit nostr target is now ALSO ineligible -- Phase C's own signing-authority key-control check (Alpha 649/665) has no safe way to confirm this account controls that identity, so it fails closed, unlike Alpha 633's own original, less-strict protocol-match-only check", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const desktopApplication = new DesktopApplication(readerResolvingToNostr("npub1realauthor"));
    const host = new FedosDesktopHost({
      desktopApplication,
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
    });
    await host.start();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("post-2") });

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello nostr",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    expect(result.outcome).toBe("outbox-partial-failure");
    if (result.outcome !== "outbox-partial-failure") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "ineligible" }]);
    expect(outboxPersistence.listIntents()).toHaveLength(0);
  });

  it("7. the eligibility gate never reads FedosBoardPost.source -- its own signature takes no post parameter at all", async () => {
    expect(isEligibleForPublicOutboundTarget.length).toBe(2);
  });

  it("8. Runtime itself never calls a Publisher -- it only writes an Outbox intent via Host's existing submitPostWithOutbox()", async () => {
    let publishCalls = 0;
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const desktopApplication = new DesktopApplication(readerResolvingToNostr("npub1realauthor"));
    const host = new FedosDesktopHost({
      desktopApplication,
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: {
        publish: async () => {
          publishCalls++;
          return { outcome: "delivered", retryPolicy: "never" };
        },
      },
    });
    await host.start();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("post-3") });
    await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    // No startDelivery() call -- Runtime alone must never trigger a publish.
    expect(publishCalls).toBe(0);
  });
});
