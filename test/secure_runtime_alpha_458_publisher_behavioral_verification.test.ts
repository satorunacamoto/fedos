import { describe, it, expect } from "vitest";
import { FedosRelayNostrBoardPublisher } from "../src/os/messenger/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import type { FedosNostrBoardPublishEntry } from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_458_publisher_behavioral_verification.md?raw";

describe("Secure Runtime Alpha 458 -- Publisher Behavioral Verification (end to end)", () => {
  it("Outbox intent + signed wire event -> conversion -> Relay: a full nostr-targeted post is delivered, a non-nostr post is not", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const publisher = new FedosRelayNostrBoardPublisher(relay);

    const postId1 = toFedosBoardPostId("post-e2e-1")!;
    const postId2 = toFedosBoardPostId("post-e2e-2")!;
    const postId3 = toFedosBoardPostId("post-e2e-3")!;

    const nostrIntent1 = createFedosBoardOutboxIntent(postId1, { protocol: "nostr", destination: null }, 1_700_000_001)!;
    const sessionIntent = createFedosBoardOutboxIntent(postId2, { protocol: "session", destination: null }, 1_700_000_002)!;
    const nostrIntent2 = createFedosBoardOutboxIntent(postId3, { protocol: "nostr", destination: "wss://alt.relay.test" }, 1_700_000_003)!;

    const event1: FedosNostrWireEvent = {
      id: "1".repeat(64),
      pubkey: "aa".repeat(32),
      created_at: 1_700_000_001,
      kind: 1,
      tags: [["p", "bb".repeat(32)]],
      content: "first canonical post",
      sig: "cc".repeat(64),
    };
    const event2: FedosNostrWireEvent = {
      id: "2".repeat(64),
      pubkey: "dd".repeat(32),
      created_at: 1_700_000_002,
      kind: 1,
      tags: [],
      content: "this one targets session, not nostr",
      sig: "ee".repeat(64),
    };
    const event3: FedosNostrWireEvent = {
      id: "3".repeat(64),
      pubkey: "ff".repeat(32),
      created_at: 1_700_000_003,
      kind: 1,
      tags: [["e", "11".repeat(32)]],
      content: "third canonical post",
      sig: "22".repeat(64),
    };

    const entries: FedosNostrBoardPublishEntry[] = [
      { intent: nostrIntent1, event: event1 },
      { intent: sessionIntent, event: event2 },
      { intent: nostrIntent2, event: event3 },
    ];

    const results = await publisher.publishBatch(entries);
    expect(results).toEqual([true, false, true]);

    expect(relay.published).toEqual([
      {
        id: event1.id,
        provider: "nostr",
        author: event1.pubkey,
        createdAt: event1.created_at,
        kind: event1.kind,
        tags: event1.tags,
        content: event1.content,
        signature: event1.sig,
      },
      {
        id: event3.id,
        provider: "nostr",
        author: event3.pubkey,
        createdAt: event3.created_at,
        kind: event3.kind,
        tags: event3.tags,
        content: event3.content,
        signature: event3.sig,
      },
    ]);
  });

  it("the doc reports the result of this verification", () => {
    expect(doc).toMatch(/All new tests pass/);
  });
});
