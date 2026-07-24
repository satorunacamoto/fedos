import { describe, it, expect } from "vitest";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { assessFedosLocalPayloadDeletion } from "../src/conversation/deletion/fedos_deletion_assessment.js";
import { buildFedosLocalPayloadDeletionPlan } from "../src/conversation/deletion/fedos_deletion_plan.js";

const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
const PAYLOAD_ID = toFedosConversationPayloadId("payload-assess-1")!;

function makeFixture() {
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
  payloadStorage.putPayload(
    { id: PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: 3, createdAt: 1_700_000_000 },
    new Uint8Array([1, 2, 3]),
  );
  const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: () => 1_700_000_100 });
  return { payloadStorage, retentionAuthority };
}

describe("Secure Runtime Alpha 5401-5480 -- read-only assessment never mutates state", () => {
  it("1. assessing a present payload reports 'present' for local-payload/local-envelope/local-index, no blocker", () => {
    const { retentionAuthority } = makeFixture();
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    expect(assessment.targetExists).toBe(true);
    expect(assessment.blocker).toBe("none");
    expect(assessment.observations).toEqual(
      expect.arrayContaining([
        { target: "local-payload", status: "present" },
        { target: "local-envelope", status: "present" },
        { target: "local-index", status: "present" },
      ]),
    );
    // Assessment must be read-only -- the underlying retention state must be untouched.
    expect(retentionAuthority.evaluatePayloadAccess(PAYLOAD_ID)).toEqual({ outcome: "allowed" });
  });

  it("2. assessing an unknown payload id reports not-found, no operations offered", () => {
    const { retentionAuthority } = makeFixture();
    const unknown = toFedosConversationPayloadId("no-such-payload")!;
    const assessment = assessFedosLocalPayloadDeletion(unknown, { retentionAuthority });
    expect(assessment.targetExists).toBe(false);
    expect(assessment.blocker).toBe("not-found");
    expect(assessment.availableOperations).toEqual([]);
  });

  it("3. assessing an already-removed payload reports already-terminal and offers no further operations", () => {
    const { retentionAuthority } = makeFixture();
    retentionAuthority.tombstonePayload(PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(PAYLOAD_ID, null, "user_requested_placeholder");
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    expect(assessment.blocker).toBe("already-terminal");
    expect(assessment.availableOperations).toEqual([]);
    expect(assessment.observations[0]).toEqual({ target: "local-payload", status: "local-payload-deleted" });
  });

  it("4. assessment always includes the remote-copy and backup non-guarantee warnings for a payload target", () => {
    const { retentionAuthority } = makeFixture();
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    expect(assessment.backupWarning).toBe(true);
    expect(assessment.remoteCopyWarning).toBe(true);
    expect(assessment.warnings).toEqual(expect.arrayContaining(["backup-may-remain", "remote-device-may-remain"]));
  });
});

describe("Secure Runtime Alpha 5401-5480 -- deterministic plan", () => {
  it("5. the SAME assessment always produces the SAME plan (pure function, no hidden state)", () => {
    const { retentionAuthority } = makeFixture();
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    const planA = buildFedosLocalPayloadDeletionPlan("plan-1", PAYLOAD_ID, assessment);
    const planB = buildFedosLocalPayloadDeletionPlan("plan-1", PAYLOAD_ID, assessment);
    expect(planA).toEqual(planB);
  });

  it("6. a plan for an active payload's first step is 'tombstone', never 'logical-delete'", () => {
    const { retentionAuthority } = makeFixture();
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-2", PAYLOAD_ID, assessment);
    expect(plan.steps[0]).toEqual({ kind: "retention-transition", target: "local-payload", operation: "tombstone" });
    expect(plan.steps[1]).toEqual({ kind: "purge-index", target: "local-index", operation: "purge-index" });
    expect(plan.requiresExplicitConfirmation).toBe(true);
  });

  it("7. a plan for an already-tombstoned payload's next step is 'logical-delete', never re-tombstoning", () => {
    const { retentionAuthority } = makeFixture();
    retentionAuthority.tombstonePayload(PAYLOAD_ID, null, "user_requested_placeholder");
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-3", PAYLOAD_ID, assessment);
    expect(plan.steps[0]?.operation).toBe("logical-delete");
  });

  it("8. a plan for an already-removed (terminal) payload has zero steps and does not require confirmation", () => {
    const { retentionAuthority } = makeFixture();
    retentionAuthority.tombstonePayload(PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(PAYLOAD_ID, null, "user_requested_placeholder");
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-4", PAYLOAD_ID, assessment);
    expect(plan.steps).toEqual([]);
    expect(plan.requiresExplicitConfirmation).toBe(false);
  });

  it("9. a plan never bundles an Archive-file removal step alongside a payload-deletion step", () => {
    const { retentionAuthority } = makeFixture();
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-5", PAYLOAD_ID, assessment);
    expect(plan.steps.some((s) => s.kind === "remove-archive-file")).toBe(false);
  });
});
