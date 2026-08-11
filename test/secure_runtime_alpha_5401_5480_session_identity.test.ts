/**
 * Secure Runtime Alpha 5401-5480 — Phase B: canonical Direct Ratchet
 * session identity. Covers test requirements 1 (canonical session
 * identity), 2 (Device-pair isolation), 3 (Conversation isolation), plus
 * malformed-session-id (Phase K).
 */
import { describe, it, expect } from "vitest";
import {
  toFedosDirectRatchetSessionId,
  isWellFormedFedosDirectRatchetSessionId,
  type FedosDirectRatchetSessionIdComponents,
} from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

function components(overrides: Partial<FedosDirectRatchetSessionIdComponents> = {}): FedosDirectRatchetSessionIdComponents {
  return {
    localAccountRef: "alice",
    localDeviceRef: "alice-device-1",
    remoteAccountRef: "bob",
    remoteDeviceRef: "bob-device-1",
    conversationId: "private-draft::direct::req-1" as FedosConversationId,
    suite: "fedos-direct-ratchet-v1",
    generation: 0,
    ...overrides,
  };
}

describe("Alpha 5401-5480 — canonical session identity", () => {
  it("1. is deterministic -- the same components always produce the identical id", () => {
    const a = toFedosDirectRatchetSessionId(components());
    const b = toFedosDirectRatchetSessionId(components());
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("1. is well-formed per its own structural pre-check", () => {
    const id = toFedosDirectRatchetSessionId(components());
    expect(isWellFormedFedosDirectRatchetSessionId(id)).toBe(true);
  });

  it("1. no ambiguous delimiter construction -- distinct component splits never collide", () => {
    const a = toFedosDirectRatchetSessionId(components({ localDeviceRef: "ab", remoteDeviceRef: "c" }));
    const b = toFedosDirectRatchetSessionId(components({ localDeviceRef: "a", remoteDeviceRef: "bc" }));
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it("1. rejects a component containing the delimiter", () => {
    expect(toFedosDirectRatchetSessionId(components({ localDeviceRef: "a##b" }))).toBeNull();
  });

  it("1. tolerates a component containing '::' -- a real FedosConversationId always does", () => {
    expect(toFedosDirectRatchetSessionId(components({ conversationId: "board-1::thread-1" as FedosConversationId }))).not.toBeNull();
  });

  it("1. rejects a component containing a path separator (no filesystem paths)", () => {
    expect(toFedosDirectRatchetSessionId(components({ localDeviceRef: "a/b" }))).toBeNull();
    expect(toFedosDirectRatchetSessionId(components({ localDeviceRef: "a\\b" }))).toBeNull();
  });

  it("1. rejects an empty component", () => {
    expect(toFedosDirectRatchetSessionId(components({ localDeviceRef: "" }))).toBeNull();
  });

  it("1. rejects a component exceeding the max length (strict length limits)", () => {
    expect(toFedosDirectRatchetSessionId(components({ localDeviceRef: "x".repeat(1000) }))).toBeNull();
  });

  it("1. rejects an unrecognized suite", () => {
    expect(
      toFedosDirectRatchetSessionId(components({ suite: "unknown-suite" as unknown as "fedos-direct-ratchet-v1" })),
    ).toBeNull();
  });

  it("1. rejects a malformed generation (negative, non-integer, overflow)", () => {
    expect(toFedosDirectRatchetSessionId(components({ generation: -1 }))).toBeNull();
    expect(toFedosDirectRatchetSessionId(components({ generation: 1.5 }))).toBeNull();
    expect(toFedosDirectRatchetSessionId(components({ generation: Number.NaN }))).toBeNull();
    expect(toFedosDirectRatchetSessionId(components({ generation: 0x100000000 }))).toBeNull();
  });

  it("2. Device-pair isolation -- a different remote Device yields a different session id", () => {
    const a = toFedosDirectRatchetSessionId(components());
    const b = toFedosDirectRatchetSessionId(components({ remoteDeviceRef: "bob-device-2" }));
    expect(a).not.toBe(b);
  });

  it("2. Device-pair isolation -- a different local Device yields a different session id", () => {
    const a = toFedosDirectRatchetSessionId(components());
    const b = toFedosDirectRatchetSessionId(components({ localDeviceRef: "alice-device-2" }));
    expect(a).not.toBe(b);
  });

  it("3. Conversation isolation -- a different Conversation id yields a different session id", () => {
    const a = toFedosDirectRatchetSessionId(components());
    const b = toFedosDirectRatchetSessionId(
      components({ conversationId: "private-draft::direct::req-2" as FedosConversationId }),
    );
    expect(a).not.toBe(b);
  });

  it("a different generation yields a different session id (independent generations never collide)", () => {
    const a = toFedosDirectRatchetSessionId(components({ generation: 0 }));
    const b = toFedosDirectRatchetSessionId(components({ generation: 1 }));
    expect(a).not.toBe(b);
  });

  it("malformed session ID -- structural pre-check rejects non-string, empty, oversized, and wrong-segment-count candidates", () => {
    expect(isWellFormedFedosDirectRatchetSessionId(42)).toBe(false);
    expect(isWellFormedFedosDirectRatchetSessionId("")).toBe(false);
    expect(isWellFormedFedosDirectRatchetSessionId("not-a-session-id")).toBe(false);
    expect(isWellFormedFedosDirectRatchetSessionId("direct-ratchet-v1##only##three##segments")).toBe(false);
    expect(isWellFormedFedosDirectRatchetSessionId("x".repeat(2000))).toBe(false);
  });
});
