import { describe, it, expect } from "vitest";
import { FedosRelayNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import type { FedosNostrBoardPublishEntry } from "../src/board/publish/nostr/fedos_nostr_board_publisher.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts?raw";

const postId = toFedosBoardPostId("post-1")!;

function nostrEntry(suffix: string): FedosNostrBoardPublishEntry {
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: suffix }, 1_700_000_000)!;
  const event: FedosNostrWireEvent = {
    id: suffix.repeat(64).slice(0, 64),
    pubkey: "b".repeat(64),
    created_at: 1_700_000_000,
    kind: 1,
    tags: [],
    content: `hello ${suffix}`,
    sig: "d".repeat(128),
  };
  return { intent, event };
}

function activitypubEntry(suffix: string): FedosNostrBoardPublishEntry {
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "activitypub", destination: suffix }, 1_700_000_000)!;
  const event: FedosNostrWireEvent = {
    id: suffix.repeat(64).slice(0, 64),
    pubkey: "b".repeat(64),
    created_at: 1_700_000_000,
    kind: 1,
    tags: [],
    content: `hello ${suffix}`,
    sig: "d".repeat(128),
  };
  return { intent, event };
}

describe("Secure Runtime Alpha 457 -- FedosRelayNostrBoardPublisher: publishBatch", () => {
  it("returns booleans positionally aligned with the input entries, in order", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entries = [nostrEntry("1"), activitypubEntry("2"), nostrEntry("3")];
    await expect(publisher.publishBatch(entries)).resolves.toEqual([true, false, true]);
  });

  it("one entry's failure does not suppress a later entry's own publish attempt", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    // Deliberately NOT connected -- every entry fails, but every entry is still attempted.
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entries = [nostrEntry("1"), nostrEntry("2"), nostrEntry("3")];
    await expect(publisher.publishBatch(entries)).resolves.toEqual([false, false, false]);
  });

  it("calls relay.publish() exactly once per nostr-targeted entry, none for mismatched entries", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entries = [nostrEntry("1"), activitypubEntry("2"), nostrEntry("3")];
    await publisher.publishBatch(entries);
    expect(relay.published).toHaveLength(2);
  });

  it("an empty batch resolves to an empty array", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    await expect(publisher.publishBatch([])).resolves.toEqual([]);
  });

  it("structural: publishBatch() is a sequential for-loop -- no Promise.all/allSettled, no worker pool", () => {
    const body = (source.match(/async publishBatch\(entries: readonly FedosNostrBoardPublishEntry\[\]\): Promise<readonly boolean\[\]> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/for \(const entry of entries\)/);
    expect(body).toMatch(/await this\.publishOne\(entry\)/);
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/Promise\.all|Promise\.allSettled|Worker|concurrency/i);
  });
});
