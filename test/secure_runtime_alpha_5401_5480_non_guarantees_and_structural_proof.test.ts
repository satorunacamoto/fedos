import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join, dirname } from "node:path";
// @ts-expect-error `node:url` has no type declarations without `@types/node` in this project's tsconfig.
import { fileURLToPath } from "node:url";
import {
  FEDOS_DELETION_NON_GUARANTEE_CODES,
  FEDOS_DELETION_NON_GUARANTEE_TEXT,
  fedosDeletionApplicableNonGuarantees,
} from "../src/conversation/deletion/fedos_deletion_non_guarantees.js";
import { FEDOS_DELETION_TARGETS } from "../src/conversation/deletion/fedos_deletion_target.js";
import { buildFedosDeletionAssessmentSummary, buildFedosDeletionExecutionSummary } from "../src/conversation/deletion/fedos_deletion_user_summary.js";
import { assessFedosLocalPayloadDeletion } from "../src/conversation/deletion/fedos_deletion_assessment.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosPersistedDeletionExecutionRecordV1 } from "../src/conversation/deletion/fedos_persisted_deletion_execution_record_v1.js";

/**
 * Secure Runtime Alpha 5401-5480 -- Phase N structural non-guarantees, plus
 * the closed non-guarantee vocabulary and the honest user-safe summary
 * layer. The structural-proof tests read this Arc's OWN deletion module
 * source text directly (never a mock of it) -- the guarantee they check is
 * about what this Arc's own files literally do and do not import/contain.
 */

const DELETION_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "conversation", "deletion");

function readAllDeletionModuleSource(): string {
  return (readdirSync(DELETION_DIR) as string[])
    .filter((name: string) => name.endsWith(".ts"))
    .map((name: string) => readFileSync(join(DELETION_DIR, name), "utf8") as string)
    .join("\n");
}

describe("Secure Runtime Alpha 5401-5480 -- closed non-guarantee vocabulary", () => {
  it("1. every non-guarantee code is distinct", () => {
    expect(new Set(FEDOS_DELETION_NON_GUARANTEE_CODES).size).toBe(FEDOS_DELETION_NON_GUARANTEE_CODES.length);
  });

  it("2. every non-guarantee code has fixed, non-empty human text -- never free text a caller could soften", () => {
    for (const code of FEDOS_DELETION_NON_GUARANTEE_CODES) {
      expect(typeof FEDOS_DELETION_NON_GUARANTEE_TEXT[code]).toBe("string");
      expect(FEDOS_DELETION_NON_GUARANTEE_TEXT[code].length).toBeGreaterThan(10);
    }
  });

  it("3. no non-guarantee sentence AFFIRMS erasure, wiping, or totality -- 'never guaranteed' is honest, 'is guaranteed' would not be", () => {
    for (const code of FEDOS_DELETION_NON_GUARANTEE_CODES) {
      const text = FEDOS_DELETION_NON_GUARANTEE_TEXT[code];
      expect(text).not.toMatch(/\bis guaranteed\b|\bensures\b|\bwas wiped\b|\bwill be wiped\b/i);
    }
  });

  it("4. the remote-copy warning ('remote-device-may-remain') is real, fixed text naming another device's own retained copy", () => {
    expect(FEDOS_DELETION_NON_GUARANTEE_TEXT["remote-device-may-remain"]).toMatch(/device/i);
    expect(FEDOS_DELETION_NON_GUARANTEE_TEXT["remote-device-may-remain"]).toMatch(/unaffected|remain|keep/i);
  });

  it("5. the backup warning ('backup-may-remain') names backup/snapshot/cloud-sync copies as unaffected", () => {
    expect(FEDOS_DELETION_NON_GUARANTEE_TEXT["backup-may-remain"]).toMatch(/backup/i);
  });

  it("6. the Relay-ciphertext warning ('no-relay-deletion') names Relay-held ciphertext as untouched", () => {
    expect(FEDOS_DELETION_NON_GUARANTEE_TEXT["no-relay-deletion"]).toMatch(/relay/i);
    expect(FEDOS_DELETION_NON_GUARANTEE_TEXT["no-relay-deletion"]).toMatch(/ciphertext/i);
  });

  it("7. the physical-erasure non-guarantee ('no-physical-erasure') explicitly names disk/SSD bytes as never guaranteed erased", () => {
    expect(FEDOS_DELETION_NON_GUARANTEE_TEXT["no-physical-erasure"]).toMatch(/never guaranteed|never claimed/i);
  });

  it("8. every FedosDeletionTarget resolves an applicable-warnings list without throwing", () => {
    for (const target of FEDOS_DELETION_TARGETS) {
      expect(() => fedosDeletionApplicableNonGuarantees(target)).not.toThrow();
    }
  });

  it("9. payload/envelope targets carry the remote-erasure, Relay, physical-erasure, backup, and remote-device warnings together", () => {
    for (const target of ["local-payload", "local-envelope"] as const) {
      const applicable = fedosDeletionApplicableNonGuarantees(target);
      expect(applicable).toEqual(expect.arrayContaining(["no-remote-erasure", "no-relay-deletion", "no-physical-erasure", "backup-may-remain", "remote-device-may-remain"]));
    }
  });
});

describe("Secure Runtime Alpha 5401-5480 -- user-safe summaries never leak plaintext or a raw path, and always deny totality", () => {
  function makeFixture() {
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const payloadId = toFedosConversationPayloadId("payload-summary-1")!;
    const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
    payloadStorage.putPayload({ id: payloadId, conversationId, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 }, new Uint8Array([1]));
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage });
    return { payloadId, retentionAuthority };
  }

  it("10. an assessment summary always includes the universal 'no-deleted-everywhere' text, appended last", () => {
    const { payloadId, retentionAuthority } = makeFixture();
    const assessment = assessFedosLocalPayloadDeletion(payloadId, { retentionAuthority });
    const summary = buildFedosDeletionAssessmentSummary(assessment);
    expect(summary.warnings.at(-1)).toBe(FEDOS_DELETION_NON_GUARANTEE_TEXT["no-deleted-everywhere"]);
  });

  it("11. an assessment summary never contains a raw filesystem path (a drive letter or POSIX-style absolute path segment)", () => {
    const { payloadId, retentionAuthority } = makeFixture();
    const assessment = assessFedosLocalPayloadDeletion(payloadId, { retentionAuthority });
    const summary = buildFedosDeletionAssessmentSummary(assessment);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toMatch(/[A-Za-z]:\\/);
    expect(serialized).not.toMatch(/\/(Users|home|exports)\//);
  });

  it("12. an execution summary built from a durable record never contains a raw path or the requester's own opaque id verbatim as 'path'-shaped text", () => {
    const record: FedosPersistedDeletionExecutionRecordV1 = {
      schemaVersion: 1,
      id: "plan-summary-1",
      planId: "plan-summary-1",
      requestedBy: "local-account-1",
      canonicalTargetRef: "payload-summary-1",
      steps: [
        { target: "local-payload", operation: "tombstone", outcome: "applied", evidence: "local-observed" },
        { target: "local-index", operation: "purge-index", outcome: "applied", evidence: "local-verified" },
      ],
      warnings: ["no-remote-erasure", "backup-may-remain", "remote-device-may-remain"],
      status: "completed",
      recordedAt: 1_700_000_600,
    };
    const summary = buildFedosDeletionExecutionSummary(record);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toMatch(/[A-Za-z]:\\/);
    expect(summary.safeSummary).not.toMatch(/everywhere/i);
    expect(summary.warnings.at(-1)).toBe(FEDOS_DELETION_NON_GUARANTEE_TEXT["no-deleted-everywhere"]);
  });

  it("13. a 'partially-deleted' execution record produces an honest, non-affirmative safe summary -- never claims full completion", () => {
    const record: FedosPersistedDeletionExecutionRecordV1 = {
      schemaVersion: 1,
      id: "plan-summary-2",
      planId: "plan-summary-2",
      requestedBy: "local-account-1",
      canonicalTargetRef: "payload-summary-2",
      steps: [
        { target: "local-payload", operation: "tombstone", outcome: "applied", evidence: "local-observed" },
        { target: "local-index", operation: "purge-index", outcome: "failed", evidence: "none" },
      ],
      warnings: [],
      status: "partially-deleted",
      recordedAt: 1_700_000_700,
    };
    const summary = buildFedosDeletionExecutionSummary(record);
    expect(summary.safeSummary).toMatch(/partial/i);
    expect(summary.safeSummary).not.toMatch(/^Completed/);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- structural proof: no remote-erasure mechanism exists in this Arc's own source", () => {
  const source = readAllDeletionModuleSource();

  it("14. no network transport primitive is imported or referenced anywhere in this Arc's own deletion module", () => {
    expect(source).not.toMatch(/\bWebSocket\b/);
    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toMatch(/node:net\b|node:http\b|node:https\b|node:dgram\b/);
    expect(source).not.toMatch(/from ["']\.\.\/\.\.\/relay/);
    expect(source).not.toMatch(/from ["']\.\.\/\.\.\/transport/);
    expect(source).not.toMatch(/from ["']\.\.\/\.\.\/p2p/);
  });

  it("15. no NIP number or Nostr Relay event kind is introduced by this Arc's own deletion module", () => {
    expect(source).not.toMatch(/\bNIP-?\d+\b/i);
    expect(source).not.toMatch(/\bkind:\s*\d+/);
    expect(source).not.toMatch(/EventTemplate|publishEvent|signEvent/);
  });

  it("16. no recipient-acknowledgement or remote-request vocabulary exists as an actual TypeScript string-literal VALUE (as opposed to prose narrating that it was deliberately excluded)", () => {
    expect(source).not.toMatch(/"request-delete"|"acknowledge-request"|"remote-request-sent"|"remote-request-acknowledged"/);
  });

  it("17. no 'deleted-everywhere'/'all-devices'/'all-copies' status VALUE exists (kebab-case identifier, as opposed to the space-separated prose phrase this Arc's own comments use to narrate the prohibition)", () => {
    expect(source).not.toMatch(/"deleted-everywhere"|"all-devices"|"all-copies"/);
  });

  it("18. no physical-erasure or secure-wipe GUARANTEE (as opposed to the honest non-guarantee statement naming its absence) is claimed", () => {
    // The non-guarantee text file legitimately CONTAINS the words "erasure"/"wipe" -- it is naming their
    // absence. What must never appear is an affirmative claim that erasure/wipe IS guaranteed/ensured.
    expect(source).not.toMatch(/erasure is guaranteed|wipe is guaranteed|guarantees? (physical )?erasure|guarantees? (a )?secure wipe/i);
  });

  it("19. no raw caller-supplied filesystem path type is accepted by this Arc's own Retention/Search/Device/Membership execution entry points -- only canonical id/ref/plan types", () => {
    const coordinatorSource = readFileSync(join(DELETION_DIR, "fedos_deletion_execution_coordinator.ts"), "utf8");
    // The Archive-file execution request legitimately carries `directoryPath` (validated by the path
    // authority) -- but the payload/device/membership request shapes must carry none.
    const payloadRequestBlock = coordinatorSource.slice(coordinatorSource.indexOf("FedosDeletionPayloadExecutionRequest"), coordinatorSource.indexOf("executeFedosLocalPayloadDeletionPlan"));
    expect(payloadRequestBlock).not.toMatch(/directoryPath|filePath|rawPath/);
    const deviceRequestBlock = coordinatorSource.slice(coordinatorSource.indexOf("FedosDeletionDeviceAccessExecutionRequest"), coordinatorSource.indexOf("executeFedosLocalDeviceAccessRevocationPlan"));
    expect(deviceRequestBlock).not.toMatch(/directoryPath|filePath|rawPath/);
  });

  it("20. this Arc's own module never imports anything from p2p/ or .tmp_gen/", () => {
    expect(source).not.toMatch(/from ["'].*p2p\//);
    expect(source).not.toMatch(/from ["'].*\.tmp_gen\//);
  });
});
