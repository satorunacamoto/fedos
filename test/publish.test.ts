import { describe, it, expect } from "vitest";
import {
  MockRelayPublisher,
  WebSocketRelayPublisher,
  parseOkMessage,
  validateBeforePublish,
} from "../src/os/messenger/adapters/nostr/protocol/publish.js";
import { NobleSignatureVerifier } from "../src/os/messenger/adapters/nostr/protocol/noble_signature.js";
import {
  canPublishToSpace,
  preparePublishDecision,
} from "../src/os/_legacy_prototype/sign/publish_flow.js";
import type {
  RelaySocketEvent,
  RelaySocketEventType,
  RelaySocketLike,
} from "../src/os/messenger/adapters/nostr/protocol/ws_relay.js";
import type { SignedNostrEvent } from "../src/os/_legacy_prototype/sign/types.js";
import type { ChannelSpace, CommunitySpace } from "../src/os/_legacy_prototype/community/types.js";

/**
 * Known-good NIP-01 event (same @noble vector used by noble_signature.test.ts;
 * produced by a throwaway script — no signing code lives in the library).
 */
const VALID_EVENT: SignedNostrEvent = {
  id: "54e612edddef0b67e2e46b6cbe0c70368f4cc55a7a4efd774c08066bc74b7f0b",
  pubkey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  created_at: 1700000000,
  kind: 1,
  tags: [],
  content: "hello nostr — Stage 8 vector",
  sig: "9fafd52912c74d10ea33a981cc4e3d43789add77daaf31ed62b02c2760caa96d9b6393a007ad885810e75239cc87cbc859574fbfbc64d2ea795f1c097bfced59",
};

function signedEvent(idChar: string): SignedNostrEvent {
  return {
    id: idChar.repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: `note-${idChar}`,
    sig: "b".repeat(128),
  };
}

/** A scriptable mock socket — no network. */
class MockSocket implements RelaySocketLike {
  sent: string[] = [];
  closed = false;
  #listeners: Partial<Record<RelaySocketEventType, ((ev: RelaySocketEvent) => void)[]>> = {};
  onSend?: (data: string, socket: MockSocket) => void;

  send(data: string): void {
    this.sent.push(data);
    this.onSend?.(data, this);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.emit("close", {});
  }
  addEventListener(
    type: RelaySocketEventType,
    listener: (ev: RelaySocketEvent) => void,
  ): void {
    (this.#listeners[type] ??= []).push(listener);
  }
  emit(type: RelaySocketEventType, ev: RelaySocketEvent): void {
    for (const l of this.#listeners[type] ?? []) l(ev);
  }
  emitMessage(value: unknown): void {
    this.emit("message", { data: JSON.stringify(value) });
  }
  sentTypes(): string[] {
    return this.sent.map((s) => JSON.parse(s)[0] as string);
  }
}

function publisherWith(mock: MockSocket, timeoutMs = 1000): WebSocketRelayPublisher {
  return new WebSocketRelayPublisher("wss://relay.test", {
    factory: () => mock,
    timeoutMs,
  });
}

function community(overrides: Partial<CommunitySpace> = {}): CommunitySpace {
  return {
    id: "c1",
    type: "community",
    name: "Community One",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [],
    admins: [],
    moderators: [],
    members: [],
    ...overrides,
  };
}

function channel(overrides: Partial<ChannelSpace> = {}): ChannelSpace {
  return {
    id: "ch1",
    type: "channel",
    name: "Channel One",
    visibility: "public",
    membershipPolicy: "invite_only",
    postPolicy: "admins",
    owners: [],
    admins: [],
    moderators: [],
    members: [],
    ...overrides,
  };
}

describe("parseOkMessage", () => {
  it("1. parses a valid accepted OK", () => {
    const result = parseOkMessage(JSON.stringify(["OK", "abc", true, "stored"]));
    expect(result).toEqual({ eventId: "abc", accepted: true, message: "stored" });
  });

  it("2. parses a valid rejected OK", () => {
    const result = parseOkMessage(JSON.stringify(["OK", "abc", false, "blocked: spam"]));
    expect(result).toEqual({ eventId: "abc", accepted: false, message: "blocked: spam" });
  });

  it("3. returns null on invalid JSON", () => {
    expect(parseOkMessage("not json {")).toBeNull();
  });

  it("4. returns null on a malformed/unknown OK", () => {
    // Missing the boolean verdict.
    expect(parseOkMessage(JSON.stringify(["OK", "abc"]))).toBeNull();
    // Non-string event id.
    expect(parseOkMessage(JSON.stringify(["OK", 123, true, "x"]))).toBeNull();
    // Wrong label entirely.
    expect(parseOkMessage(JSON.stringify(["EVENT", "sub", {}]))).toBeNull();
    // Not even an array.
    expect(parseOkMessage(JSON.stringify({ ok: true }))).toBeNull();
  });

  it("defaults a missing message to an empty string", () => {
    expect(parseOkMessage(JSON.stringify(["OK", "abc", true]))).toEqual({
      eventId: "abc",
      accepted: true,
      message: "",
    });
  });
});

describe("MockRelayPublisher", () => {
  it("5. records the event and reports accepted", async () => {
    const publisher = new MockRelayPublisher({ accepted: true, message: "ok", relayUrl: "wss://r" });
    const event = signedEvent("1");
    const result = await publisher.publish(event);
    expect(result).toEqual({
      eventId: event.id,
      accepted: true,
      message: "ok",
      relayUrl: "wss://r",
    });
    expect(publisher.published).toEqual([event]);
  });

  it("6. reports rejected when configured", async () => {
    const publisher = new MockRelayPublisher({ accepted: false, message: "no" });
    const result = await publisher.publish(signedEvent("2"));
    expect(result.accepted).toBe(false);
    expect(result.message).toBe("no");
    expect(result).not.toHaveProperty("relayUrl");
  });
});

describe("WebSocketRelayPublisher", () => {
  it("7. sends ['EVENT', signedEvent]", async () => {
    const mock = new MockSocket();
    const event = signedEvent("1");
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "EVENT") socket.emitMessage(["OK", event.id, true, ""]);
    };
    await publisherWith(mock).publish(event);
    const sent = JSON.parse(mock.sent[0]!);
    expect(sent[0]).toBe("EVENT");
    expect(sent[1]).toEqual(event);
  });

  it("8. resolves with the matching OK", async () => {
    const mock = new MockSocket();
    const event = signedEvent("1");
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "EVENT") {
        socket.emitMessage(["OK", "other-event", true, "ignored"]); // not ours
        socket.emitMessage(["NOTICE", "hi"]); // ignored
        socket.emitMessage(["OK", event.id, true, "stored"]); // ours
      }
    };
    const result = await publisherWith(mock).publish(event);
    expect(result).toEqual({
      eventId: event.id,
      accepted: true,
      message: "stored",
      relayUrl: "wss://relay.test",
    });
  });

  it("9. resolves not-accepted on timeout when no OK arrives", async () => {
    const mock = new MockSocket();
    // never responds to EVENT
    const result = await publisherWith(mock, 25).publish(signedEvent("1"));
    expect(result.accepted).toBe(false);
    expect(result.message).toMatch(/timed out/);
    expect(mock.closed).toBe(true);
  });

  it("10. closes the socket after finishing", async () => {
    const mock = new MockSocket();
    const event = signedEvent("1");
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "EVENT") socket.emitMessage(["OK", event.id, true, ""]);
    };
    await publisherWith(mock).publish(event);
    expect(mock.closed).toBe(true);
  });

  it("does not crash on a relay socket error", async () => {
    const mock = new MockSocket();
    mock.onSend = (_data, socket) => socket.emit("error", {});
    const result = await publisherWith(mock).publish(signedEvent("1"));
    expect(result.accepted).toBe(false);
    expect(result.message).toBe("relay socket error");
  });
});

describe("validateBeforePublish", () => {
  it("11. allows a valid signed event", async () => {
    const decision = await validateBeforePublish(VALID_EVENT, NobleSignatureVerifier);
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.event.id).toBe(VALID_EVENT.id);
  });

  it("12. denies an event with an invalid signature", async () => {
    const tampered = { ...VALID_EVENT, content: "tampered" };
    const decision = await validateBeforePublish(tampered, NobleSignatureVerifier);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toMatch(/signature/);
  });

  it("13. denies a structurally malformed event", async () => {
    const decision = await validateBeforePublish(
      { id: "nope", pubkey: "x", content: 5 },
      NobleSignatureVerifier,
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toMatch(/signed event/);
  });
});

describe("publish_flow policy helpers", () => {
  it("14. allows an authorized space post (open community)", () => {
    const decision = canPublishToSpace(VALID_EVENT.pubkey, community({ postPolicy: "open" }), VALID_EVENT);
    expect(decision.allowed).toBe(true);
  });

  it("15. denies an unauthorized channel post (admins-only)", () => {
    const decision = canPublishToSpace(VALID_EVENT.pubkey, channel({ postPolicy: "admins" }), VALID_EVENT);
    expect(decision.allowed).toBe(false);
  });

  it("denies when the actor pubkey does not match the signed event", () => {
    const decision = canPublishToSpace("f".repeat(64), community({ postPolicy: "open" }), VALID_EVENT);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/does not match/);
  });

  it("preparePublishDecision combines the signature gate and space policy", async () => {
    const ok = await preparePublishDecision({
      event: VALID_EVENT,
      verifier: NobleSignatureVerifier,
      space: community({ postPolicy: "open" }),
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.space?.allowed).toBe(true);

    const denied = await preparePublishDecision({
      event: VALID_EVENT,
      verifier: NobleSignatureVerifier,
      space: channel({ postPolicy: "admins" }),
    });
    expect(denied.ok).toBe(false);
  });
});
