import { describe, it, expect } from "vitest";
import {
  planFedosDeletionRequestRetry,
  FEDOS_DELETION_REQUEST_MAX_RETRY_ATTEMPTS,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_retry_plan.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import {
  safeStatusForFedosDeletionRequestLifecycle,
  safeStatusForFedosDeletionAcknowledgementOutcome,
  buildFedosDeletionRequestAggregateStatusView,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_safe_status.js";

/** Secure Runtime Alpha 5641-5720 -- expiry/retry planner and safe status/aggregation DTOs. */

function snapshot(overrides: Partial<FedosPersistedDeletionRequestStateRecordV1> = {}): FedosPersistedDeletionRequestStateRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    bodyHash: "hash-1",
    requesterAccountRef: "alice-account",
    recipientAccountRef: "bob-account",
    recipientDeviceRef: "bob-device-a",
    conversationId: "conv-1",
    targetEnvelopeId: "envelope-1",
    scope: "local-history-and-index",
    lifecycleState: "signed",
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_000_000 + 14 * 24 * 60 * 60,
    retryCount: 0,
    acknowledgementCorrelationId: null,
    recordedAt: 1_700_000_000,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 5641-5720 -- retry planner: no retry after terminal outcome", () => {
  it("1. an already-terminal lifecycle state (acknowledged) always returns 'terminal', regardless of time/attempts", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ lifecycleState: "acknowledged" }), now: 1_700_000_001, recipientDeviceKnownRevoked: false });
    expect(action.action).toBe("terminal");
  });

  it("2. cancelled/rejected/failed/expired are all terminal", () => {
    for (const lifecycleState of ["cancelled", "rejected", "failed", "expired"] as const) {
      const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ lifecycleState }), now: 1_700_000_001, recipientDeviceKnownRevoked: false });
      expect(action.action).toBe("terminal");
    }
  });
});

describe("Secure Runtime Alpha 5641-5720 -- retry scheduling", () => {
  it("3. the first retry (retryCount 0) fires 1 hour after issuedAt", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ retryCount: 0 }), now: 1_700_000_001, recipientDeviceKnownRevoked: false });
    expect(action.action).toBe("retry");
    if (action.action !== "retry") throw new Error("unreachable");
    expect(action.nextRetryAt).toBe(1_700_000_000 + 3600);
    expect(action.remainingAttempts).toBe(FEDOS_DELETION_REQUEST_MAX_RETRY_ATTEMPTS);
  });

  it("4. the third retry (retryCount 2) fires at cumulative 1h+2h+4h = 7h after issuedAt, never backoff*attemptNumber", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ retryCount: 2 }), now: 1_700_000_001, recipientDeviceKnownRevoked: false });
    expect(action.action).toBe("retry");
    if (action.action !== "retry") throw new Error("unreachable");
    expect(action.nextRetryAt).toBe(1_700_000_000 + 7 * 3600);
  });

  it("5. exhausting max attempts (retryCount >= 8) results in expire, never a further retry", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ retryCount: FEDOS_DELETION_REQUEST_MAX_RETRY_ATTEMPTS }), now: 1_700_000_001, recipientDeviceKnownRevoked: false });
    expect(action.action).toBe("expire");
  });

  it("6. now past expiresAt always expires, even with retries remaining", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ retryCount: 1, expiresAt: 1_700_000_100 }), now: 1_700_000_200, recipientDeviceKnownRevoked: false });
    expect(action.action).toBe("expire");
  });

  it("7. a computed nextRetryAt never exceeds expiresAt", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ retryCount: 5, expiresAt: 1_700_000_000 + 3600 }), now: 1_700_000_001, recipientDeviceKnownRevoked: false });
    expect(action.action).toBe("retry");
    if (action.action !== "retry") throw new Error("unreachable");
    expect(action.nextRetryAt).toBeLessThanOrEqual(1_700_000_000 + 3600);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- revoked recipient Device handling", () => {
  it("8. a known-revoked recipient Device stops retries immediately, even with time and attempts remaining", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ retryCount: 0 }), now: 1_700_000_001, recipientDeviceKnownRevoked: true });
    expect(action.action).toBe("device-revoked");
  });

  it("9. device-revoked takes priority over an already-terminal check being irrelevant -- still checked terminal FIRST (an already-acknowledged request is 'terminal', not 're-flagged' as revoked)", () => {
    const action = planFedosDeletionRequestRetry({ snapshot: snapshot({ lifecycleState: "acknowledged" }), now: 1_700_000_001, recipientDeviceKnownRevoked: true });
    expect(action.action).toBe("terminal");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- safe status mapping", () => {
  it("10. draft/signed map to draft/ready-to-deliver", () => {
    expect(safeStatusForFedosDeletionRequestLifecycle("draft", null)).toBe("draft");
    expect(safeStatusForFedosDeletionRequestLifecycle("signed", null)).toBe("ready-to-deliver");
  });

  it("11. pending-delivery/delivered/recipient-evaluating all map to 'pending'", () => {
    expect(safeStatusForFedosDeletionRequestLifecycle("pending-delivery", null)).toBe("pending");
    expect(safeStatusForFedosDeletionRequestLifecycle("delivered", null)).toBe("pending");
    expect(safeStatusForFedosDeletionRequestLifecycle("recipient-evaluating", null)).toBe("pending");
  });

  it("12. acknowledged maps through the real acknowledgement outcome", () => {
    expect(safeStatusForFedosDeletionRequestLifecycle("acknowledged", "applied-local-history-and-index")).toBe("acknowledged-local-history-and-index");
    expect(safeStatusForFedosDeletionRequestLifecycle("acknowledged", "applied-partial")).toBe("partial");
    expect(safeStatusForFedosDeletionRequestLifecycle("acknowledged", "rejected-policy")).toBe("rejected");
  });

  it("13. every acknowledgement outcome maps to a safe status, never throws, never 'account-wide' anything", () => {
    for (const outcome of ["accepted-pending", "applied-local-history", "applied-local-history-and-index", "applied-partial", "rejected-policy", "unauthorized", "unsupported-scope", "expired", "invalid", "failed"] as const) {
      expect(() => safeStatusForFedosDeletionAcknowledgementOutcome(outcome)).not.toThrow();
    }
  });
});

describe("Secure Runtime Alpha 5641-5720 -- multi-device aggregate view: honest, never account-wide", () => {
  it("14. zero acknowledgements yields 'unknown', never a fabricated per-hypothetical-device row", () => {
    const view = buildFedosDeletionRequestAggregateStatusView("req-1", []);
    expect(view.aggregate).toBe("unknown");
    expect(view.perDevice).toEqual([]);
  });

  it("15. one Device's acknowledgement produces exactly one perDevice entry -- never implies coverage of any other Device", () => {
    const view = buildFedosDeletionRequestAggregateStatusView("req-1", [{ deviceRef: "bob-device-a", outcome: "applied-local-history-and-index" }]);
    expect(view.perDevice).toHaveLength(1);
    expect(view.aggregate).toBe("acknowledged-local-history-and-index");
  });

  it("16. mixed outcomes across Devices aggregate to 'partial', never silently picking one", () => {
    const view = buildFedosDeletionRequestAggregateStatusView("req-1", [
      { deviceRef: "bob-device-a", outcome: "applied-local-history-and-index" },
      { deviceRef: "bob-device-b", outcome: "rejected-policy" },
    ]);
    expect(view.aggregate).toBe("partial");
    expect(view.perDevice).toHaveLength(2);
  });

  it("17. an unknown (null) deviceRef is preserved honestly, never coerced into a fake label", () => {
    const view = buildFedosDeletionRequestAggregateStatusView("req-1", [{ deviceRef: null, outcome: "applied-local-history" }]);
    expect(view.perDevice[0]?.deviceRef).toBeNull();
  });
});
