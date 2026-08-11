import { describe, it, expect } from "vitest";
import { FEDOS_DELETION_TARGETS, isFedosDeletionTarget } from "../src/os/messenger/conversations/deletion/fedos_deletion_target.js";
import { FEDOS_DELETION_OPERATIONS, isFedosDeletionOperation } from "../src/os/messenger/conversations/deletion/fedos_deletion_operation.js";
import { FEDOS_DELETION_EVIDENCE_LEVELS, isFedosDeletionEvidence } from "../src/os/messenger/conversations/deletion/fedos_deletion_evidence.js";
import { FEDOS_DELETION_STATUSES, isFedosDeletionStatus, fedosDeletionStatusFromPayloadDeletionMeaning } from "../src/os/messenger/conversations/deletion/fedos_deletion_status.js";
import {
  getFedosDeletionCapabilityDescriptor,
  resolveFedosDeletionCapabilityDescriptor,
} from "../src/os/messenger/conversations/deletion/fedos_deletion_capability_descriptor.js";
import { FEDOS_PAYLOAD_DELETION_MEANINGS } from "../src/os/messenger/conversations/retention/fedos_payload_retention_state.js";

describe("Secure Runtime Alpha 5401-5480 -- closed target vocabulary", () => {
  it("1. every target is a distinct string, no duplicates", () => {
    expect(new Set(FEDOS_DELETION_TARGETS).size).toBe(FEDOS_DELETION_TARGETS.length);
  });

  it("2. unknown target strings are rejected", () => {
    expect(isFedosDeletionTarget("remote-device-copy")).toBe(false);
    expect(isFedosDeletionTarget("relay-copy")).toBe(false);
    expect(isFedosDeletionTarget("recipient-copy")).toBe(false);
    expect(isFedosDeletionTarget("")).toBe(false);
    expect(isFedosDeletionTarget(42)).toBe(false);
  });

  it("3. every real target string is accepted", () => {
    for (const target of FEDOS_DELETION_TARGETS) expect(isFedosDeletionTarget(target)).toBe(true);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- closed operation vocabulary", () => {
  it("4. no remote-request-shaped operation exists in this Arc's vocabulary", () => {
    expect(isFedosDeletionOperation("request-delete")).toBe(false);
    expect(isFedosDeletionOperation("acknowledge-request")).toBe(false);
    expect(isFedosDeletionOperation("cryptographic-erase")).toBe(false);
  });

  it("5. every declared operation is distinct", () => {
    expect(new Set(FEDOS_DELETION_OPERATIONS).size).toBe(FEDOS_DELETION_OPERATIONS.length);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- closed evidence vocabulary (exactly 4 values)", () => {
  it("6. evidence levels are exactly none/local-observed/local-verified/unverifiable", () => {
    expect([...FEDOS_DELETION_EVIDENCE_LEVELS].sort()).toEqual(["local-observed", "local-verified", "none", "unverifiable"]);
  });

  it("7. no remote-shaped evidence level exists (peer-claimed/relay-claimed/cryptographically-proven)", () => {
    expect(isFedosDeletionEvidence("peer-claimed")).toBe(false);
    expect(isFedosDeletionEvidence("relay-claimed")).toBe(false);
    expect(isFedosDeletionEvidence("cryptographically-proven")).toBe(false);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- closed status vocabulary, never 'deleted everywhere'", () => {
  it("8. no status implies totality (no 'everywhere', 'all-devices', or 'all-copies' value)", () => {
    for (const status of FEDOS_DELETION_STATUSES) {
      expect(status).not.toMatch(/everywhere|all-copies|all-devices/i);
    }
  });

  it("9. remote-only statuses (remote-request-sent, recipient-claims-deleted, relay-claims-deleted) are excluded from this local-only Arc", () => {
    expect(isFedosDeletionStatus("remote-request-sent")).toBe(false);
    expect(isFedosDeletionStatus("recipient-claims-deleted")).toBe(false);
    expect(isFedosDeletionStatus("relay-claims-deleted")).toBe(false);
  });

  it("10. every V1-enforceable FedosPayloadDeletionMeaning maps onto a real FedosDeletionStatus", () => {
    expect(fedosDeletionStatusFromPayloadDeletionMeaning("application-hidden")).toBe("locally-hidden");
    expect(fedosDeletionStatusFromPayloadDeletionMeaning("logically-tombstoned")).toBe("locally-tombstoned");
    expect(fedosDeletionStatusFromPayloadDeletionMeaning("local-payload-removed")).toBe("local-payload-deleted");
  });

  it("11. non-implementable meanings (compacted-from-active-log, remotely-deleted, removed-from-backup) map to null -- never a fabricated status", () => {
    expect(fedosDeletionStatusFromPayloadDeletionMeaning("compacted-from-active-log")).toBeNull();
    expect(fedosDeletionStatusFromPayloadDeletionMeaning("remotely-deleted")).toBeNull();
    expect(fedosDeletionStatusFromPayloadDeletionMeaning("removed-from-backup")).toBeNull();
  });

  it("12. every existing FedosPayloadDeletionMeaning is handled by the mapping function (no missing case)", () => {
    for (const meaning of FEDOS_PAYLOAD_DELETION_MEANINGS) {
      expect(() => fedosDeletionStatusFromPayloadDeletionMeaning(meaning)).not.toThrow();
    }
  });
});

describe("Secure Runtime Alpha 5401-5480 -- capability descriptor is never a single boolean", () => {
  it("13. the descriptor for local-payload carries a full multi-field shape, not a bare boolean", () => {
    const descriptor = getFedosDeletionCapabilityDescriptor("local-payload");
    expect(typeof descriptor).toBe("object");
    expect(descriptor.target).toBe("local-payload");
    expect(Array.isArray(descriptor.supportedOperations)).toBe(true);
    expect(typeof descriptor.evidenceClass).toBe("string");
    expect(typeof descriptor.requiresExplicitConfirmation).toBe("boolean");
    expect(typeof descriptor.reversible).toBe("boolean");
  });

  it("14. three structurally different descriptors for local-index (real, local-verified) vs memory-reference (best-effort) vs local-cache (unsupported)", () => {
    const index = getFedosDeletionCapabilityDescriptor("local-index");
    const memory = getFedosDeletionCapabilityDescriptor("memory-reference");
    const cache = getFedosDeletionCapabilityDescriptor("local-cache");
    expect(index.evidenceClass).toBe("local-verified");
    expect(memory.evidenceClass).toBe("none");
    expect(cache.localSupport).toBe(false);
    expect(cache.supportedOperations).toEqual([]);
  });

  it("15. an unknown target string fails closed to null -- never a synthesized descriptor", () => {
    expect(resolveFedosDeletionCapabilityDescriptor("relay-copy")).toBeNull();
    expect(resolveFedosDeletionCapabilityDescriptor("not-a-real-target")).toBeNull();
    expect(resolveFedosDeletionCapabilityDescriptor(123)).toBeNull();
  });

  it("16. every real target resolves to a descriptor whose own 'target' field matches the lookup key", () => {
    for (const target of FEDOS_DELETION_TARGETS) {
      const descriptor = getFedosDeletionCapabilityDescriptor(target);
      expect(descriptor.target).toBe(target);
      expect(descriptor.schemaVersion).toBe(1);
    }
  });

  it("17. local-incremental-archive-file and local-notification-preview are honestly unsupported (zero real producer)", () => {
    expect(getFedosDeletionCapabilityDescriptor("local-incremental-archive-file").localSupport).toBe(false);
    expect(getFedosDeletionCapabilityDescriptor("local-notification-preview").localSupport).toBe(false);
  });

  it("18. the new local-archive-file capability is real and reachable today", () => {
    const descriptor = getFedosDeletionCapabilityDescriptor("local-archive-file");
    expect(descriptor.localSupport).toBe(true);
    expect(descriptor.reachableToday).toBe(true);
    expect(descriptor.supportedOperations).toContain("remove-file");
  });
});
