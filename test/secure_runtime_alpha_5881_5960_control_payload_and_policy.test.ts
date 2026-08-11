import { describe, it, expect } from "vitest";
import {
  isWellFormedFedosDeletionRequestControlPayload,
  encodeFedosDeletionRequestControlPayload,
  decodeFedosDeletionRequestControlPayloadFromContent,
  FEDOS_DELETION_REQUEST_CONTROL_PAYLOAD_MAX_BYTES,
  type FedosDeletionRequestControlPayloadV1,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_control_payload.js";
import {
  FedosNobleTestNostrSigningAuthority,
  fedosTestSecretKeyFromSeed,
  signFedosDeletionRequestRecordV1,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_signing.js";
import type { FedosDeletionRequestRecordV1 } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_record.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import {
  evaluateFedosDeletionRecipientPolicy,
  isFedosDeletionRecipientPolicy,
  FEDOS_DELETION_RECIPIENT_POLICIES,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_recipient_policy.js";

const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);

function baseRecord(): FedosDeletionRequestRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    requesterAccountRef: "alice-account",
    requesterDeviceRef: null,
    recipientAccountRef: "bob-account",
    recipientDeviceRef: "bob-device-a",
    conversationId: CONVERSATION_ID,
    targetEnvelopeId: "envelope-1",
    scope: "local-history-and-index",
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_100_000,
    nonce: "b".repeat(32),
    capabilityVersion: 1,
    reasonCode: "sent-in-error",
  };
}

describe("Secure Runtime Alpha 5881-5960 -- deletion request control payload (Phase B)", () => {
  it("1. encodes and decodes a real signed request round-trip", async () => {
    const signingAuthority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: 0, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority, requesterAccountIndex: 0 });
    expect(signed).not.toBeNull();

    const payload: FedosDeletionRequestControlPayloadV1 = { schemaVersion: 1, kind: "deletion-request-v1", request: signed! };
    const encoded = encodeFedosDeletionRequestControlPayload(payload);
    const content = new TextDecoder().decode(encoded);
    const decoded = decodeFedosDeletionRequestControlPayloadFromContent(content);
    expect(decoded).toEqual(payload);
  });

  it("2. rejects an unknown discriminator (fails closed)", () => {
    const malformed = JSON.stringify({ schemaVersion: 1, kind: "some-other-kind", request: {} });
    expect(decodeFedosDeletionRequestControlPayloadFromContent(malformed)).toBeNull();
  });

  it("3. rejects an extra field on the envelope itself", () => {
    const malformed = JSON.stringify({ schemaVersion: 1, kind: "deletion-request-v1", request: {}, extra: "field" });
    expect(decodeFedosDeletionRequestControlPayloadFromContent(malformed)).toBeNull();
  });

  it("4. rejects malformed JSON", () => {
    expect(decodeFedosDeletionRequestControlPayloadFromContent("not json{")).toBeNull();
  });

  it("5. rejects an oversized payload before ever parsing", () => {
    const oversized = "a".repeat(FEDOS_DELETION_REQUEST_CONTROL_PAYLOAD_MAX_BYTES + 1);
    expect(decodeFedosDeletionRequestControlPayloadFromContent(oversized)).toBeNull();
  });

  it("6. rejects empty content", () => {
    expect(decodeFedosDeletionRequestControlPayloadFromContent("")).toBeNull();
  });

  it("7. isWellFormedFedosDeletionRequestControlPayload rejects a non-object", () => {
    expect(isWellFormedFedosDeletionRequestControlPayload("a string")).toBe(false);
    expect(isWellFormedFedosDeletionRequestControlPayload(null)).toBe(false);
  });

  it("8. rejects a signed request whose wireEvent is missing a required NIP-01 field", async () => {
    const signingAuthority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: 0, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority, requesterAccountIndex: 0 });
    const tampered = { ...signed!, wireEvent: { ...signed!.wireEvent, sig: undefined } };
    const payload = { schemaVersion: 1, kind: "deletion-request-v1", request: tampered };
    expect(decodeFedosDeletionRequestControlPayloadFromContent(JSON.stringify(payload))).toBeNull();
  });
});

describe("Secure Runtime Alpha 5881-5960 -- recipient policy (Phase E)", () => {
  it("9. deny/unavailable both refuse identically", () => {
    expect(evaluateFedosDeletionRecipientPolicy("deny", "local-history-and-index")).toEqual({ decision: "deny" });
    expect(evaluateFedosDeletionRecipientPolicy("unavailable", "local-history-and-index")).toEqual({ decision: "deny" });
  });

  it("10. always-review awaits, never grants", () => {
    expect(evaluateFedosDeletionRecipientPolicy("always-review", "local-history")).toEqual({ decision: "await-review" });
  });

  it("11. allow-local-history-only caps the grant even when a wider scope was requested", () => {
    expect(evaluateFedosDeletionRecipientPolicy("allow-local-history-only", "local-history-and-index")).toEqual({
      decision: "grant",
      grantedScope: "local-history",
    });
  });

  it("12. allow-local-history-and-index grants exactly the requested scope, never widening a narrower request", () => {
    expect(evaluateFedosDeletionRecipientPolicy("allow-local-history-and-index", "local-history")).toEqual({
      decision: "grant",
      grantedScope: "local-history",
    });
    expect(evaluateFedosDeletionRecipientPolicy("allow-local-history-and-index", "local-history-and-index")).toEqual({
      decision: "grant",
      grantedScope: "local-history-and-index",
    });
  });

  it("13. fails closed on an unrecognized policy/scope value", () => {
    expect(evaluateFedosDeletionRecipientPolicy("not-a-real-policy" as never, "local-history")).toEqual({ decision: "deny" });
    expect(evaluateFedosDeletionRecipientPolicy("always-review", "whole-conversation" as never)).toEqual({ decision: "deny" });
  });

  it("14. isFedosDeletionRecipientPolicy accepts exactly the five closed values", () => {
    for (const p of FEDOS_DELETION_RECIPIENT_POLICIES) expect(isFedosDeletionRecipientPolicy(p)).toBe(true);
    expect(isFedosDeletionRecipientPolicy("allow-everything")).toBe(false);
  });

  it("15. default is never unconditional automatic deletion -- 'allow-local-history-and-index' is never treated as a fallback default anywhere in this vocabulary's own evaluator (no default branch exists at all; every call must name a real policy)", () => {
    // Structural proof: evaluateFedosDeletionRecipientPolicy has no branch reachable without
    // an explicit, valid `policy` argument -- an invalid one denies (test 13), it never
    // silently substitutes a permissive default.
    expect(evaluateFedosDeletionRecipientPolicy(undefined as never, "local-history")).toEqual({ decision: "deny" });
  });
});
