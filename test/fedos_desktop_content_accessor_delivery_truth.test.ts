/**
 * FedOS Message Delivery Truth arc — targeted unit coverage for the ONE
 * real defect this arc fixes: `FedosDesktopConversationContentAccessor
 * .sendMessage()` used to hardcode `fanout: "not-applicable"` on every
 * Direct send and silently discard `sendDirectMessage()`'s own already-
 * correct `result.delivery`/`result.route` — meaning a real, reported
 * lower-layer failure (`crypto-unavailable`, `route-unavailable`, etc.)
 * was indistinguishable from genuine success to every caller above this
 * file. This suite proves the fix at the exact boundary the bug lived in,
 * using a minimal fake `conversationRuntime` (only the 3 methods
 * `sendMessage()` actually calls) rather than the full Electron Runtime —
 * cheap, deterministic, no real crypto/network required, since the real
 * crypto/transport layers are already covered by the Direct Ratchet
 * regression suite and this fix touches neither.
 */
import { describe, it, expect } from "vitest";
import { FedosDesktopConversationContentAccessor } from "../src/os/messenger/desktop/content_accessor/fedos_desktop_conversation_content_accessor.js";
import type { FedosConversationRuntime } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime.js";
import type { FedosConversationDirectMessageSendResult } from "../src/os/messenger/conversations/messaging/fedos_conversation_direct_message_send_result.js";
import type { FedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.js";

const CONVERSATION_ID = "conv-delivery-truth-unit";
const ENVELOPE_ID = "envelope-delivery-truth-unit";

function fakeEnvelope(): FedosConversationMessageEnvelope {
  return {
    id: ENVELOPE_ID,
    conversationId: CONVERSATION_ID,
    senderMembershipId: "member-alice",
    payloadId: "payload-1" as unknown as FedosConversationMessageEnvelope["payloadId"],
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000_000,
    replyToEnvelopeId: null,
  } as unknown as FedosConversationMessageEnvelope;
}

function makeAccessor(sendResult: FedosConversationDirectMessageSendResult): FedosDesktopConversationContentAccessor {
  const fakeRuntime = {
    findConversation: () => ({ mode: "direct" }),
    sendDirectMessage: async () => sendResult,
    getConversationMessageEnvelope: () => fakeEnvelope(),
    createSearchIndex: () => ({ indexEnvelope: () => undefined }),
  } as unknown as FedosConversationRuntime;

  return new FedosDesktopConversationContentAccessor({
    conversationRuntime: fakeRuntime,
    archiveRuntime: null,
    isRuntimeRunning: () => true,
  });
}

describe("FedosDesktopConversationContentAccessor.sendMessage() -- Direct delivery truth", () => {
  it("no delivery dependency configured -- delivery is honestly absent, never fabricated as queued/success", async () => {
    const accessor = makeAccessor({ outcome: "sent-locally", envelopeId: ENVELOPE_ID });
    const result = await accessor.sendMessage(CONVERSATION_ID, "hello", null);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.value.fanout).toBe("not-applicable");
    expect(result.value.delivery).toBeUndefined();
  });

  it("NO FALSE NEGATIVE (mandate section 33): direct-ratchet route genuinely queues -- delivery reflects real success, route correctly attributed", async () => {
    const accessor = makeAccessor({
      outcome: "sent-locally",
      envelopeId: ENVELOPE_ID,
      route: "direct-ratchet",
      delivery: { outcome: "queued", sessionId: "session-1" as never, queue: { outcome: "queued", envelopeId: ENVELOPE_ID } },
    });
    const result = await accessor.sendMessage(CONVERSATION_ID, "hello", null);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.value.delivery).toEqual({ route: "direct-ratchet", state: "queued" });
  });

  it("NO FALSE POSITIVE (mandate section 32): direct-ratchet crypto failure is faithfully reported, never silently upgraded to success -- THIS is the exact defect this arc fixes", async () => {
    const accessor = makeAccessor({
      outcome: "sent-locally",
      envelopeId: ENVELOPE_ID,
      route: "direct-ratchet",
      delivery: { outcome: "crypto-unavailable" },
    });
    const result = await accessor.sendMessage(CONVERSATION_ID, "hello", null);
    expect(result.outcome, "the send itself is still 'ok' -- local storage genuinely succeeded, a SEPARATE fact from delivery").toBe("ok");
    if (result.outcome !== "ok") return;
    expect(
      result.value.delivery,
      "before this arc's fix, this real failure was silently discarded and the caller had no way to know the message never reached a real transport attempt",
    ).toEqual({ route: "direct-ratchet", state: "unavailable", reason: "crypto-unavailable" });
  });

  it("legacy NIP-17 route genuinely queues -- delivery reflects real success with the correct route label", async () => {
    const accessor = makeAccessor({
      outcome: "sent-locally",
      envelopeId: ENVELOPE_ID,
      route: "legacy-nip17",
      delivery: { outcome: "queued", envelopeId: ENVELOPE_ID },
    });
    const result = await accessor.sendMessage(CONVERSATION_ID, "hello", null);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.value.delivery).toEqual({ route: "legacy-nip17", state: "queued" });
  });

  it("legacy NIP-17 route-unavailable is faithfully reported, never silently upgraded to success", async () => {
    const accessor = makeAccessor({
      outcome: "sent-locally",
      envelopeId: ENVELOPE_ID,
      route: "legacy-nip17",
      delivery: { outcome: "route-unavailable" },
    });
    const result = await accessor.sendMessage(CONVERSATION_ID, "hello", null);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.value.delivery).toEqual({ route: "legacy-nip17", state: "route-unavailable", reason: "route-unavailable" });
  });

  it("STRUCTURAL GUARD (mandate section 31): sendMessage() never returns delivery: { state: 'queued' } unless the underlying result actually reported a queued outcome -- exhaustive over every real failure outcome the Runtime coordinator can return", async () => {
    const failureOutcomes: ReadonlyArray<FedosConversationDirectMessageSendResult> = [
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "direct-ratchet", delivery: { outcome: "route-unavailable", reason: "session-initialization-required" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "direct-ratchet", delivery: { outcome: "persistence-failed" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "direct-ratchet", delivery: { outcome: "not-direct" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "direct-ratchet", delivery: { outcome: "identity-unavailable" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "legacy-nip17", delivery: { outcome: "identity-unavailable" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "legacy-nip17", delivery: { outcome: "unauthorized" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "legacy-nip17", delivery: { outcome: "crypto-unavailable" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "legacy-nip17", delivery: { outcome: "unsupported-recipient" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "legacy-nip17", delivery: { outcome: "invalid-input" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "legacy-nip17", delivery: { outcome: "persistence-failed" } },
      { outcome: "sent-locally", envelopeId: ENVELOPE_ID, route: "legacy-nip17", delivery: { outcome: "failed" } },
    ];
    for (const sendResult of failureOutcomes) {
      const accessor = makeAccessor(sendResult);
      const result = await accessor.sendMessage(CONVERSATION_ID, "hello", null);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") continue;
      expect(result.value.delivery?.state, JSON.stringify(sendResult)).not.toBe("queued");
    }
  });
});
