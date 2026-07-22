import { describe, it, expect } from "vitest";
import {
  fedosDeletionRequestDeviceStatus,
  fedosDeletionRequestAggregateAccountStatus,
  type FedosDeletionRequestPerDeviceRow,
} from "../src/desktop/presentation/deletion_request/fedos_deletion_request_device_status.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../src/conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import {
  fedosDeletionRequestInboxDisplayStatus,
  fedosDeletionRequestBuildInboxItem,
  fedosDeletionRequestSortInboxItems,
  fedosDeletionRequestTruncateInboxItems,
  fedosDeletionRequestBuildConsentDetail,
} from "../src/desktop/presentation/deletion_request/fedos_deletion_request_screen_model.js";
import type { FedosDeletionRequestInboxSummaryV1 } from "../src/conversation/deletion_request/fedos_deletion_request_inbox_summary.js";

function snapshot(overrides: Partial<FedosPersistedDeletionRequestStateRecordV1> = {}): FedosPersistedDeletionRequestStateRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    bodyHash: "hash",
    requesterAccountRef: "alice",
    recipientAccountRef: "bob",
    recipientDeviceRef: "bob-device-a",
    conversationId: "conv-1",
    targetEnvelopeId: "env-1",
    scope: "local-history-and-index",
    lifecycleState: "pending-delivery",
    issuedAt: 1000,
    expiresAt: 2000,
    retryCount: 0,
    acknowledgementCorrelationId: null,
    recordedAt: 1000,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 6041-6120 -- Phase B per-Device status", () => {
  it("1. revoked trust always wins, regardless of any request state", () => {
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "acknowledged" }), "applied-local-history-and-index", "revoked")).toBe("revoked-device");
  });

  it("2. not-in-registry -> unknown-device", () => {
    expect(fedosDeletionRequestDeviceStatus(null, null, "not-in-registry")).toBe("unknown-device");
  });

  it("3. no request at all -> not-requested", () => {
    expect(fedosDeletionRequestDeviceStatus(null, null, "trusted")).toBe("not-requested");
  });

  it("4. ack outcome takes priority over lifecycle state", () => {
    expect(fedosDeletionRequestDeviceStatus(snapshot(), "applied-local-history-and-index", "trusted")).toBe("applied-local-history-and-index");
    expect(fedosDeletionRequestDeviceStatus(snapshot(), "applied-partial", "trusted")).toBe("partially-applied");
    expect(fedosDeletionRequestDeviceStatus(snapshot(), "rejected-policy", "trusted")).toBe("rejected");
    expect(fedosDeletionRequestDeviceStatus(snapshot(), "expired", "trusted")).toBe("expired");
    expect(fedosDeletionRequestDeviceStatus(snapshot(), "failed", "trusted")).toBe("failed");
  });

  it("5. lifecycle-only mapping, no ack yet", () => {
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "draft" }), null, "trusted")).toBe("draft");
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "pending-delivery" }), null, "trusted")).toBe("pending-delivery");
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "delivered" }), null, "trusted")).toBe("relay-acknowledged");
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "recipient-evaluating" }), null, "trusted")).toBe("awaiting-recipient-decision");
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "expired" }), null, "trusted")).toBe("expired");
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "rejected" }), null, "trusted")).toBe("rejected");
    expect(fedosDeletionRequestDeviceStatus(snapshot({ lifecycleState: "failed" }), null, "trusted")).toBe("failed");
  });

  it("6. never produces a fabricated 'deleted-everywhere'-shaped value -- structural closure of the return type is the proof; spot-check a wide input sweep", () => {
    const forbidden = ["deleted-everywhere", "account-deleted", "all-copies-erased", "cryptographically-erased"];
    for (const trust of ["pending", "trusted", "revoked", "unavailable", "not-in-registry"] as const) {
      for (const req of [null, snapshot()]) {
        for (const ack of [null, "applied-local-history-and-index"] as const) {
          const result = fedosDeletionRequestDeviceStatus(req, ack, trust);
          expect(forbidden).not.toContain(result);
        }
      }
    }
  });
});

describe("Secure Runtime Alpha 6041-6120 -- Phase B account aggregate", () => {
  const row = (status: FedosDeletionRequestPerDeviceRow["status"], deviceId = "d1"): FedosDeletionRequestPerDeviceRow => ({ deviceId, status, requestId: null });

  it("7. empty -> no-device-requests", () => {
    expect(fedosDeletionRequestAggregateAccountStatus([])).toBe("no-device-requests");
  });

  it("8. all unknown/offline -> no-known-device-confirmed", () => {
    expect(fedosDeletionRequestAggregateAccountStatus([row("unknown-device"), row("offline-or-unobserved", "d2")])).toBe("no-known-device-confirmed");
  });

  it("9. one applied, one pending -> some-devices-applied (never a false 'complete')", () => {
    const result = fedosDeletionRequestAggregateAccountStatus([row("applied-local-history-and-index"), row("pending-delivery", "d2")]);
    expect(result).toBe("some-devices-applied");
    expect(result).not.toBe("all-known-devices-responded");
  });

  it("10. only pending -> some-devices-pending", () => {
    expect(fedosDeletionRequestAggregateAccountStatus([row("pending-delivery")])).toBe("some-devices-pending");
  });

  it("11. all terminal, same outcome -> all-known-devices-responded", () => {
    expect(fedosDeletionRequestAggregateAccountStatus([row("applied-local-history-and-index"), row("applied-local-history-and-index", "d2")])).toBe(
      "all-known-devices-responded",
    );
  });

  it("12. all terminal, mixed outcomes -> mixed-outcomes", () => {
    expect(fedosDeletionRequestAggregateAccountStatus([row("applied-local-history-and-index"), row("rejected", "d2")])).toBe("mixed-outcomes");
  });

  it("13. one Device applied never implies account-wide completion by itself", () => {
    const single = fedosDeletionRequestAggregateAccountStatus([row("applied-local-history-and-index")]);
    expect(single).toBe("all-known-devices-responded"); // honest: the only KNOWN device did respond -- never "deleted-everywhere"
    expect(["deleted-everywhere", "account-deleted"]).not.toContain(single);
  });

  it("14. revoked device counts as a known, terminal (never applied) row", () => {
    expect(fedosDeletionRequestAggregateAccountStatus([row("revoked-device")])).toBe("all-known-devices-responded");
  });
});

describe("Secure Runtime Alpha 6041-6120 -- Phase D Inbox display", () => {
  it("15. decisionState -> display status mapping is total and closed", () => {
    expect(fedosDeletionRequestInboxDisplayStatus("received")).toBe("pending-review");
    expect(fedosDeletionRequestInboxDisplayStatus("policy-pending")).toBe("pending-review");
    expect(fedosDeletionRequestInboxDisplayStatus("policy-rejected")).toBe("policy-rejected");
    expect(fedosDeletionRequestInboxDisplayStatus("unauthorized")).toBe("authorization-failed");
    expect(fedosDeletionRequestInboxDisplayStatus("expired")).toBe("expired");
    expect(fedosDeletionRequestInboxDisplayStatus("local-plan-ready")).toBe("approved-executing");
    expect(fedosDeletionRequestInboxDisplayStatus("locally-applied")).toBe("applied");
    expect(fedosDeletionRequestInboxDisplayStatus("partially-applied")).toBe("partial");
    expect(fedosDeletionRequestInboxDisplayStatus("failed")).toBe("failed");
  });

  function summary(overrides: Partial<FedosDeletionRequestInboxSummaryV1> = {}): FedosDeletionRequestInboxSummaryV1 {
    return {
      schemaVersion: 1,
      requestId: "req-1",
      conversationId: "conv-1",
      targetEnvelopeId: "env-1",
      requesterAccountRef: "alice",
      requesterDeviceRef: null,
      recipientDeviceRef: "bob-device-a",
      scope: "local-history-and-index",
      issuedAt: 1000,
      expiresAt: 2000,
      reasonCode: null,
      recordedAt: 1000,
      ...overrides,
    };
  }

  it("16. only 'policy-pending' items are executable", () => {
    const pending = fedosDeletionRequestBuildInboxItem(summary(), "policy-pending");
    expect(pending.isExecutable).toBe(true);
    const applied = fedosDeletionRequestBuildInboxItem(summary(), "locally-applied");
    expect(applied.isExecutable).toBe(false);
    expect(applied.isDismissable).toBe(true);
  });

  it("17. deterministic ordering -- newest-issued-first, tie-broken by requestId", () => {
    const a = fedosDeletionRequestBuildInboxItem(summary({ requestId: "r-a", issuedAt: 100 }), null);
    const b = fedosDeletionRequestBuildInboxItem(summary({ requestId: "r-b", issuedAt: 200 }), null);
    const sorted = fedosDeletionRequestSortInboxItems([a, b]);
    expect(sorted.map((i) => i.requestId)).toEqual(["r-b", "r-a"]);
  });

  it("18. bounded list truncates deterministically", () => {
    const items = Array.from({ length: 5 }, (_, i) => fedosDeletionRequestBuildInboxItem(summary({ requestId: `r-${i}` }), null));
    const { items: truncated, truncated: wasTruncated } = fedosDeletionRequestTruncateInboxItems(items, 3);
    expect(truncated).toHaveLength(3);
    expect(wasTruncated).toBe(true);
  });

  it("19. consent detail is executable ONLY for policy-pending, never a terminal state", () => {
    const pendingDetail = fedosDeletionRequestBuildConsentDetail(summary(), "policy-pending", null);
    expect(pendingDetail.isExecutable).toBe(true);
    expect(pendingDetail.isTerminal).toBe(false);
    const appliedDetail = fedosDeletionRequestBuildConsentDetail(summary(), "locally-applied", null);
    expect(appliedDetail.isExecutable).toBe(false);
    expect(appliedDetail.isTerminal).toBe(true);
  });

  it("20. consent detail always carries the full standard warning set", () => {
    const detail = fedosDeletionRequestBuildConsentDetail(summary(), "policy-pending", null);
    expect(detail.warnings.length).toBeGreaterThanOrEqual(6);
    expect(detail.warnings).toContain("archive-backup-may-remain");
    expect(detail.warnings).toContain("relay-ciphertext-may-remain");
    expect(detail.warnings).toContain("not-physical-erasure-proof");
  });

  it("21. local scope options never exceed the requested scope's own ceiling", () => {
    const historyOnly = fedosDeletionRequestBuildConsentDetail(summary({ scope: "local-history" }), "policy-pending", null);
    expect(historyOnly.localScopeOptions).toEqual(["local-history"]);
    const both = fedosDeletionRequestBuildConsentDetail(summary({ scope: "local-history-and-index" }), "policy-pending", null);
    expect(both.localScopeOptions).toEqual(["local-history", "local-history-and-index"]);
  });
});
