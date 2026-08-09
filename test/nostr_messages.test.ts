import { describe, it, expect } from "vitest";
import {
  parseRelayMessage,
  isEventMessage,
  isEoseMessage,
  isNoticeMessage,
} from "../src/os/messenger/adapters/nostr/protocol/messages.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";

function validEvent(): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "hi",
    sig: "b".repeat(128),
  };
}

describe("parseRelayMessage", () => {
  it("parses a valid EVENT", () => {
    const event = validEvent();
    const msg = parseRelayMessage(JSON.stringify(["EVENT", "sub1", event]));
    expect(isEventMessage(msg)).toBe(true);
    if (isEventMessage(msg)) {
      expect(msg.subscriptionId).toBe("sub1");
      expect(msg.event.id).toBe(event.id);
    }
  });

  it("parses a valid EOSE", () => {
    const msg = parseRelayMessage(JSON.stringify(["EOSE", "sub1"]));
    expect(isEoseMessage(msg)).toBe(true);
    if (isEoseMessage(msg)) expect(msg.subscriptionId).toBe("sub1");
  });

  it("parses a valid NOTICE", () => {
    const msg = parseRelayMessage(JSON.stringify(["NOTICE", "rate limited"]));
    expect(isNoticeMessage(msg)).toBe(true);
    if (isNoticeMessage(msg)) expect(msg.message).toBe("rate limited");
  });

  it("returns invalid for non-JSON", () => {
    const msg = parseRelayMessage("not json {");
    expect(msg.kind).toBe("invalid");
  });

  it("returns unknown for an unrecognized message type", () => {
    const msg = parseRelayMessage(JSON.stringify(["AUTH", "challenge"]));
    expect(msg.kind).toBe("unknown");
    if (msg.kind === "unknown") expect(msg.label).toBe("AUTH");
  });

  it("returns invalid for a malformed EVENT payload", () => {
    const msg = parseRelayMessage(
      JSON.stringify(["EVENT", "sub1", { id: "tooshort" }]),
    );
    expect(msg.kind).toBe("invalid");
  });

  it("returns invalid for EVENT with a non-string subscription id", () => {
    const msg = parseRelayMessage(JSON.stringify(["EVENT", 5, validEvent()]));
    expect(msg.kind).toBe("invalid");
  });

  it("returns invalid for an empty array", () => {
    expect(parseRelayMessage("[]").kind).toBe("invalid");
  });
});
