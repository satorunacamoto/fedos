import { describe, it, expect } from "vitest";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversionSource from "../src/os/messenger/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import interfaceSource from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publisherSource from "../src/os/messenger/board/publish/nostr/fedos_relay_nostr_board_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/os/messenger/desktop/null_relay.ts?raw";

const NEW_SOURCES = [conversionSource, interfaceSource, publisherSource] as string[];

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("Secure Runtime Alpha 459 -- Publisher Security Regression Guards", () => {
  it("no Retry/Backoff/Observation/ACK/Pool vocabulary in code across every new file", () => {
    for (const source of NEW_SOURCES) {
      expect(codeOnly(source)).not.toMatch(/[Rr]etry|[Bb]ackoff|[Oo]bservation|\bACK\b|\bPool\b/);
    }
  });

  it("no reference to ActivityPub/AT Protocol/Session/Ontology/p2p in code (comment prose describing what's absent doesn't count, mirroring Alpha 449's own identical discipline)", () => {
    for (const source of NEW_SOURCES) {
      expect(codeOnly(source)).not.toMatch(/ActivityPub|ATProto|AtProto|\bSession\b|Ontology|p2p/i);
    }
  });

  it("FedosBoardOutboxPersistence still exposes exactly putIntent/getIntent/listIntents", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(persistence)).filter(
      (name) => name !== "constructor",
    );
    expect(publicMethods.sort()).toEqual(["getIntent", "listIntents", "putIntent"]);
  });

  it("FedosRelay/WebSocketRelay/NullRelay publish() contracts are byte-for-byte unchanged", () => {
    expect(relaySource).toMatch(/publish\(event: FedosEventDescriptor\): Promise<void>;/);
    expect(websocketRelaySource).toMatch(
      /async publish\(event: FedosEventDescriptor\): Promise<void> \{\s*\n\s*if \(!this\.#connected \|\| this\.#socket === undefined\) \{/,
    );
    expect(nullRelaySource).toMatch(
      /async publish\(event: FedosEventDescriptor\): Promise<void> \{\s*\n\s*if \(!this\.#connected\) \{/,
    );
  });

  it("publishOne() calls relay.publish() at most once -- no loop, no recursion, no timer of any kind in the publisher file", () => {
    expect(publisherSource).not.toMatch(/setTimeout|setInterval|while\s*\(|for\s*\(.*publish\(/);
    const publishOneBody = (publisherSource.match(/async publishOne\([\s\S]*?\n  \}/) ?? [])[0] ?? "";
    const relayPublishCalls = publishOneBody.match(/this\.#relay\.publish\(/g) ?? [];
    expect(relayPublishCalls).toHaveLength(1);
  });

  it("no new file references the stray, untracked, un-adopted Alpha 473 publisher path", () => {
    for (const source of NEW_SOURCES) {
      expect(source).not.toMatch(/fedos_board_outbox_publisher/);
    }
  });
});
