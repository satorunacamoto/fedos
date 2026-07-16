import { describe, it, expect } from "vitest";
import {
  FEDOS_PAYLOAD_DELETION_MEANINGS,
  FEDOS_PAYLOAD_DELETION_MEANINGS_V1_ENFORCEABLE,
} from "../src/conversation/retention/fedos_payload_retention_state.js";
import { fedosPayloadRetentionDecisionKey } from "../src/conversation/retention/fedos_payload_retention_decision.js";
import {
  validateFedosPayloadRetentionDecision,
  type FedosPayloadRetentionDecisionInput,
} from "../src/conversation/retention/fedos_payload_retention_decision_validator.js";
import {
  serializeFedosPayloadRetentionDecision,
  deserializeFedosPayloadRetentionDecision,
} from "../src/conversation/retention/fedos_payload_retention_decision_codec.js";

const VALID: FedosPayloadRetentionDecisionInput = {
  payloadId: "payload-1",
  action: "tombstoned",
  decidedAt: 1_700_000_000,
  authorityReference: null,
  reasonCode: "test_placeholder",
};

/**
 * Secure Runtime Alpha 792 ("Deletion Meaning Vocabulary") / Alpha 794
 * ("Retention State Model") / Alpha 795 ("Retention Decision Record") --
 * Stages 2/4/5 of the Alpha 791-820 Conversation Retention & Private
 * Payload Storage Boundary Foundation Arc.
 */
describe("Secure Runtime Alpha 795 -- Payload Retention Decision", () => {
  it("1. exactly 8 deletion meanings are named, no generic 'deleted' boolean vocabulary", () => {
    expect(FEDOS_PAYLOAD_DELETION_MEANINGS).toHaveLength(8);
    expect(new Set(FEDOS_PAYLOAD_DELETION_MEANINGS).size).toBe(8);
  });

  it("2. exactly 3 meanings are marked V1-enforceable: application-hidden, logically-tombstoned, local-payload-removed", () => {
    expect([...FEDOS_PAYLOAD_DELETION_MEANINGS_V1_ENFORCEABLE].sort()).toEqual(
      ["application-hidden", "local-payload-removed", "logically-tombstoned"].sort(),
    );
  });

  it("3. every V1-enforceable meaning is a subset of the full 8", () => {
    for (const meaning of FEDOS_PAYLOAD_DELETION_MEANINGS_V1_ENFORCEABLE) {
      expect(FEDOS_PAYLOAD_DELETION_MEANINGS).toContain(meaning);
    }
  });

  it("4. deterministic key: same (payloadId, action) always produces the identical key", () => {
    expect(fedosPayloadRetentionDecisionKey("p1" as any, "tombstoned")).toBe(
      fedosPayloadRetentionDecisionKey("p1" as any, "tombstoned"),
    );
    expect(fedosPayloadRetentionDecisionKey("p1" as any, "tombstoned")).toBe("p1::tombstoned");
  });

  it("5. two different (payloadId, action) pairs never collide", () => {
    expect(fedosPayloadRetentionDecisionKey("p1" as any, "tombstoned")).not.toBe(
      fedosPayloadRetentionDecisionKey("p1" as any, "payload-removed"),
    );
    expect(fedosPayloadRetentionDecisionKey("p1" as any, "tombstoned")).not.toBe(
      fedosPayloadRetentionDecisionKey("p2" as any, "tombstoned"),
    );
  });

  it("6. validator accepts a well-formed candidate", () => {
    const decision = validateFedosPayloadRetentionDecision(VALID);
    expect(decision).not.toBeNull();
    expect(decision?.action).toBe("tombstoned");
  });

  it("7. validator rejects an action outside the closed vocabulary (no 'active' record -- see this file's own header)", () => {
    expect(validateFedosPayloadRetentionDecision({ ...VALID, action: "active" })).toBeNull();
    expect(validateFedosPayloadRetentionDecision({ ...VALID, action: "bogus" })).toBeNull();
  });

  it("8. validator rejects a free-form reasonCode -- closed vocabulary only", () => {
    expect(validateFedosPayloadRetentionDecision({ ...VALID, reasonCode: "because I said so" })).toBeNull();
  });

  it("9. validator rejects an unknown/extra field and a missing field", () => {
    expect(validateFedosPayloadRetentionDecision({ ...VALID, extra: "nope" } as any)).toBeNull();
    const { reasonCode: _reasonCode, ...withoutReasonCode } = VALID;
    expect(validateFedosPayloadRetentionDecision(withoutReasonCode as any)).toBeNull();
  });

  it("10. validator never throws for malformed/non-object input", () => {
    expect(() => validateFedosPayloadRetentionDecision(null as any)).not.toThrow();
    expect(validateFedosPayloadRetentionDecision(null as any)).toBeNull();
  });

  it("11. round-trip: serialize then deserialize reproduces a structurally identical decision", () => {
    const decision = validateFedosPayloadRetentionDecision(VALID)!;
    const persisted = serializeFedosPayloadRetentionDecision(decision);
    expect(persisted.id).toBe("payload-1::tombstoned");
    expect(deserializeFedosPayloadRetentionDecision(persisted)).toEqual(decision);
  });

  it("12. deserialize rejects a record whose id does not match its own deterministic key", () => {
    const decision = validateFedosPayloadRetentionDecision(VALID)!;
    const persisted = serializeFedosPayloadRetentionDecision(decision);
    expect(deserializeFedosPayloadRetentionDecision({ ...persisted, id: "wrong-key" })).toBeNull();
  });

  it("13. deserialize fails closed on schemaVersion !== 1 and never throws", () => {
    const decision = validateFedosPayloadRetentionDecision(VALID)!;
    const persisted = serializeFedosPayloadRetentionDecision(decision);
    expect(deserializeFedosPayloadRetentionDecision({ ...persisted, schemaVersion: 2 })).toBeNull();
    expect(() => deserializeFedosPayloadRetentionDecision("garbage")).not.toThrow();
  });
});
