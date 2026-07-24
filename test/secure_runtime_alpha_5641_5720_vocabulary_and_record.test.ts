import { describe, it, expect } from "vitest";
import { FEDOS_DELETION_REQUEST_SCOPES, isFedosDeletionRequestScope } from "../src/conversation/deletion_request/fedos_deletion_request_scope.js";
import { FEDOS_DELETION_REQUEST_TARGET_TYPES, isFedosDeletionRequestTargetType } from "../src/conversation/deletion_request/fedos_deletion_request_target_type.js";
import {
  FEDOS_DELETION_REQUEST_LIFECYCLE_STATES,
  isFedosDeletionRequestLifecycleState,
  isFedosDeletionRequestLifecycleTransitionReachableByThisArc,
} from "../src/conversation/deletion_request/fedos_deletion_request_lifecycle_state.js";
import { FEDOS_DELETION_RECIPIENT_DECISION_STATES, isFedosDeletionRecipientDecisionState } from "../src/conversation/deletion_request/fedos_deletion_recipient_decision_state.js";
import {
  FEDOS_DELETION_REQUEST_ACKNOWLEDGEMENT_OUTCOMES,
  isFedosDeletionRequestAcknowledgementOutcome,
} from "../src/conversation/deletion_request/fedos_deletion_request_acknowledgement_outcome.js";
import {
  FEDOS_DELETION_REQUEST_AUTHORIZATION_OUTCOMES,
  coarsenFedosDeletionRequestAuthorizationOutcome,
} from "../src/conversation/deletion_request/fedos_deletion_request_authorization_outcome.js";
import { generateFedosDeletionRequestId, isFedosDeletionRequestId } from "../src/conversation/deletion_request/fedos_deletion_request_id.js";
import { isWellFormedFedosDeletionRequestRecordV1, type FedosDeletionRequestRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_request_record.js";
import { canonicalizeFedosDeletionRequestRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_request_canonical_bytes.js";

/**
 * Secure Runtime Alpha 5641-5720 -- closed vocabularies, request record
 * strict validation, and canonical-bytes determinism/test-vectors.
 */

function baseRecord(overrides: Partial<FedosDeletionRequestRecordV1> = {}): FedosDeletionRequestRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    requesterAccountRef: "alice-account",
    requesterDeviceRef: null,
    recipientAccountRef: "bob-account",
    recipientDeviceRef: "bob-device-a",
    conversationId: "board-a::direct::thread-1",
    targetEnvelopeId: "envelope-1",
    scope: "local-history-and-index",
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_100_000,
    nonce: "b".repeat(32),
    capabilityVersion: 1,
    reasonCode: null,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 5641-5720 -- closed vocabularies", () => {
  it("1. request scope is exactly the two review-selected values", () => {
    expect([...FEDOS_DELETION_REQUEST_SCOPES].sort()).toEqual(["local-history", "local-history-and-index"]);
    expect(isFedosDeletionRequestScope("whole-conversation")).toBe(false);
    expect(isFedosDeletionRequestScope("archive")).toBe(false);
  });

  it("2. target type is exactly one value: direct-message", () => {
    expect(FEDOS_DELETION_REQUEST_TARGET_TYPES).toEqual(["direct-message"]);
    expect(isFedosDeletionRequestTargetType("group-message")).toBe(false);
    expect(isFedosDeletionRequestTargetType("attachment")).toBe(false);
  });

  it("3. lifecycle vocabulary has exactly ten values, no duplicates", () => {
    expect(new Set(FEDOS_DELETION_REQUEST_LIFECYCLE_STATES).size).toBe(10);
    expect(isFedosDeletionRequestLifecycleState("account-fully-deleted")).toBe(false);
  });

  it("4. lifecycle transitions this Arc can reach never include a live-transport-only value as a destination", () => {
    for (const state of FEDOS_DELETION_REQUEST_LIFECYCLE_STATES) {
      expect(isFedosDeletionRequestLifecycleTransitionReachableByThisArc("draft", state) || true).toBe(true); // sanity: never throws
    }
    expect(isFedosDeletionRequestLifecycleTransitionReachableByThisArc("draft", "delivered")).toBe(false);
    expect(isFedosDeletionRequestLifecycleTransitionReachableByThisArc("draft", "pending-delivery")).toBe(false);
    expect(isFedosDeletionRequestLifecycleTransitionReachableByThisArc("draft", "signed")).toBe(true);
  });

  it("5. recipient decision vocabulary normalizes onto b3b3a6d's own three-value terminal status", () => {
    expect(FEDOS_DELETION_RECIPIENT_DECISION_STATES).toContain("locally-applied");
    expect(FEDOS_DELETION_RECIPIENT_DECISION_STATES).toContain("partially-applied");
    expect(FEDOS_DELETION_RECIPIENT_DECISION_STATES).toContain("failed");
    expect(isFedosDeletionRecipientDecisionState("deleted-everywhere")).toBe(false);
  });

  it("6. acknowledgement outcome vocabulary matches the review's own closed set exactly (10 values)", () => {
    expect(FEDOS_DELETION_REQUEST_ACKNOWLEDGEMENT_OUTCOMES.length).toBe(10);
    expect(isFedosDeletionRequestAcknowledgementOutcome("account-wide-success")).toBe(false);
    expect(isFedosDeletionRequestAcknowledgementOutcome("deleted-everywhere")).toBe(false);
  });

  it("7. authorization outcome vocabulary coarsens the oracle-prone subset onto one 'unauthorized' signal", () => {
    expect(FEDOS_DELETION_REQUEST_AUTHORIZATION_OUTCOMES).toContain("target-unavailable");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome("target-unavailable")).toBe("unauthorized");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome("conversation-unavailable")).toBe("unauthorized");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome("requester-not-author")).toBe("unauthorized");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome("requester-not-member")).toBe("unauthorized");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome("authorized")).toBe("authorized");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome("expired")).toBe("expired");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- request identity", () => {
  it("8. generateFedosDeletionRequestId produces exactly 64 lowercase hex characters", () => {
    const id = generateFedosDeletionRequestId();
    expect(isFedosDeletionRequestId(id)).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("9. two generated ids are never equal", () => {
    expect(generateFedosDeletionRequestId()).not.toBe(generateFedosDeletionRequestId());
  });

  it("10. an injected deterministic random source produces a deterministic id, never derived from a reason string", () => {
    const fixedBytes = new Uint8Array(32).fill(7);
    const id = generateFedosDeletionRequestId(() => fixedBytes);
    expect(id).toBe("07".repeat(32));
  });
});

describe("Secure Runtime Alpha 5641-5720 -- strict, closed request record validator", () => {
  it("11. a well-formed record is accepted", () => {
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord())).toBe(true);
  });

  it("12. an unknown extra field fails closed", () => {
    const withExtra = { ...baseRecord(), extraField: "not allowed" };
    expect(isWellFormedFedosDeletionRequestRecordV1(withExtra)).toBe(false);
  });

  it("13. a missing field fails closed", () => {
    const { reasonCode: _omit, ...withoutReasonCode } = baseRecord();
    expect(isWellFormedFedosDeletionRequestRecordV1(withoutReasonCode)).toBe(false);
  });

  it("14. expiresAt not strictly after issuedAt is rejected", () => {
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ expiresAt: 1_700_000_000 }))).toBe(false);
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ expiresAt: 1_699_999_999 }))).toBe(false);
  });

  it("15. a malformed nonce (wrong length, uppercase) is rejected", () => {
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ nonce: "AB".repeat(16) }))).toBe(false);
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ nonce: "b".repeat(31) }))).toBe(false);
  });

  it("16. a raw-path-shaped identifier is rejected", () => {
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ targetEnvelopeId: "../../etc/passwd" }))).toBe(false);
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ conversationId: "C:\\Users\\alice\\secret" }))).toBe(false);
  });

  it("17. an oversized identifier is rejected", () => {
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ requesterAccountRef: "a".repeat(257) }))).toBe(false);
  });

  it("18. a Group or attachment target type shape has no field to even express in this closed schema (structural, not a runtime check)", () => {
    // The record type itself has no `targetType` field at all (Phase C's own literal field
    // list) -- a caller cannot smuggle "group-message"/"attachment" through any real field.
    const record = baseRecord();
    expect(Object.keys(record)).not.toContain("targetType");
  });

  it("19. an unrecognized capabilityVersion/schemaVersion fails closed", () => {
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ capabilityVersion: 2 as 1 }))).toBe(false);
    expect(isWellFormedFedosDeletionRequestRecordV1(baseRecord({ schemaVersion: 2 as 1 }))).toBe(false);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- canonical serialization determinism and test vectors", () => {
  it("20. the SAME record always canonicalizes to the IDENTICAL string, regardless of key insertion order in the input object", () => {
    const a = baseRecord();
    const shuffled: FedosDeletionRequestRecordV1 = {
      reasonCode: a.reasonCode,
      capabilityVersion: a.capabilityVersion,
      nonce: a.nonce,
      expiresAt: a.expiresAt,
      issuedAt: a.issuedAt,
      scope: a.scope,
      targetEnvelopeId: a.targetEnvelopeId,
      conversationId: a.conversationId,
      recipientDeviceRef: a.recipientDeviceRef,
      recipientAccountRef: a.recipientAccountRef,
      requesterDeviceRef: a.requesterDeviceRef,
      requesterAccountRef: a.requesterAccountRef,
      requestId: a.requestId,
      schemaVersion: a.schemaVersion,
    };
    expect(canonicalizeFedosDeletionRequestRecordV1(a)).toBe(canonicalizeFedosDeletionRequestRecordV1(shuffled));
  });

  it("21. a KNOWN test vector canonicalizes to the EXACT expected string", () => {
    const record = baseRecord({ requesterDeviceRef: null, reasonCode: null });
    const expected =
      `{"schemaVersion":1,"requestId":"${"a".repeat(64)}","requesterAccountRef":"alice-account","requesterDeviceRef":null,` +
      `"recipientAccountRef":"bob-account","recipientDeviceRef":"bob-device-a","conversationId":"board-a::direct::thread-1",` +
      `"targetEnvelopeId":"envelope-1","scope":"local-history-and-index","issuedAt":1700000000,"expiresAt":1700100000,` +
      `"nonce":"${"b".repeat(32)}","capabilityVersion":1,"reasonCode":null}`;
    expect(canonicalizeFedosDeletionRequestRecordV1(record)).toBe(expected);
  });

  it("22. a ONE-CHARACTER mutation of any single field changes the canonical string", () => {
    const original = canonicalizeFedosDeletionRequestRecordV1(baseRecord());
    const mutated = canonicalizeFedosDeletionRequestRecordV1(baseRecord({ requesterAccountRef: "alice-accounu" })); // last char changed
    expect(mutated).not.toBe(original);
  });

  it("23. a one-SECOND mutation of issuedAt changes the canonical string", () => {
    const original = canonicalizeFedosDeletionRequestRecordV1(baseRecord());
    const mutated = canonicalizeFedosDeletionRequestRecordV1(baseRecord({ issuedAt: 1_700_000_001 }));
    expect(mutated).not.toBe(original);
  });

  it("24. reserved JSON-escape-class characters in an identifier are properly escaped, never breaking the canonical structure", () => {
    const record = baseRecord({ requesterAccountRef: 'quote"backslash\\newline\ntab\t' });
    const canonical = canonicalizeFedosDeletionRequestRecordV1(record);
    expect(() => JSON.parse(canonical)).not.toThrow();
    expect(JSON.parse(canonical).requesterAccountRef).toBe('quote"backslash\\newline\ntab\t');
  });
});
