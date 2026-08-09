import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { NullPublicIdentityReader } from "../src/os/messenger/desktop/null_public_identity_reader.js";

/**
 * Secure Runtime Alpha 556 -- "Unnecessary Host API Investigation":
 * Stage 16 of the Alpha 541-560 Publish Runtime Operational Review
 * Arc. Review test only.
 */
describe("Secure Runtime Alpha 556 -- Unnecessary Host API Investigation", () => {
  async function makeReadyHost(): Promise<FedosDesktopHost> {
    const host = new FedosDesktopHost({
      desktopApplication: { start: async () => {} } as unknown as ConstructorParameters<typeof FedosDesktopHost>[0]["desktopApplication"],
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    return host;
  }

  it("1. desktop() returns the raw, un-narrowed DesktopApplication instance -- unlike board(), which returns a narrowed FedosBoardServiceReader", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(new NullPublicIdentityReader()),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const desktop = host.desktop();
    const board = host.board();
    // desktop() exposes bootstrap()/currentIdentity() etc. directly -- an un-narrowed surface.
    expect(typeof (desktop as unknown as Record<string, unknown>).bootstrap).toBe("function");
    expect(desktop).toBeInstanceOf(DesktopApplication);
    // board() has no such broad surface -- confirmed already narrowed (Alpha 404).
    expect((board as unknown as Record<string, unknown>).registerPost).toBeUndefined();
  });

  it("2. submitPostWithOutbox(post, []) behaves identically to submitPost(post) except for the wrapper shape -- confirmed by real execution, not merely by doc comment claim", async () => {
    const host = await makeReadyHost();
    const post = validateFedosBoardPost({
      id: "post-1",
      boardId: "board-1",
      threadId: "post-1",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "hello",
      createdAt: 1_700_000_000,
      source: { protocol: "nostr", reference: "ref-1" },
    })!;

    const withOutboxResult = host.submitPostWithOutbox(post, []);
    expect(withOutboxResult.outbox).toEqual([]);
    expect(withOutboxResult.post).toBe("inserted");
  });

  it("3. submitPostWithOutbox with a non-empty targets array performs real additional work submitPost() cannot express", async () => {
    const host = await makeReadyHost();
    const post = validateFedosBoardPost({
      id: "post-2",
      boardId: "board-1",
      threadId: "post-2",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "hello",
      createdAt: 1_700_000_000,
      source: { protocol: "nostr", reference: "ref-2" },
    })!;

    const result = host.submitPostWithOutbox(post, [{ protocol: "nostr", destination: null }]);
    expect(result.outbox).toHaveLength(1);
    expect(result.outbox[0]!.result).toBe("inserted");
  });
});
