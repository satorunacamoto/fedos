import { describe, it, expect } from "vitest";
import {
  NoopSignatureVerifier,
  RejectAllSignatureVerifier,
} from "../src/nostr/signature.js";
import { ingestRawEvents } from "../src/ingest/ingest.js";
import type { NostrEvent } from "../src/nostr/types.js";

function validEvent(idChar = "1"): NostrEvent {
  return {
    id: idChar.repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "hi",
    sig: "b".repeat(128),
  };
}

const CTX = { relayUrl: "wss://relay.test", now: 1700000001000 };

describe("SignatureVerifier implementations", () => {
  it("NoopSignatureVerifier accepts any event", async () => {
    expect(await NoopSignatureVerifier.verify(validEvent())).toBe(true);
  });

  it("RejectAllSignatureVerifier rejects any event", async () => {
    expect(await RejectAllSignatureVerifier.verify(validEvent())).toBe(false);
  });
});

describe("ingestRawEvents with a verifier", () => {
  it("rejects events that fail verification (sig issue)", async () => {
    const result = await ingestRawEvents(
      [validEvent()],
      CTX,
      RejectAllSignatureVerifier,
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.issues[0]?.field).toBe("sig");
  });

  it("accepts events that pass verification", async () => {
    const result = await ingestRawEvents(
      [validEvent()],
      CTX,
      NoopSignatureVerifier,
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("still rejects structurally-invalid input before verifying", async () => {
    const result = await ingestRawEvents(
      [{ not: "an event" }],
      CTX,
      NoopSignatureVerifier,
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });

  it("keeps the synchronous (no-verifier) path returning a plain result", () => {
    const result = ingestRawEvents([validEvent()], CTX);
    // No `.then` — this is the sync overload.
    expect(result.accepted).toHaveLength(1);
  });
});
