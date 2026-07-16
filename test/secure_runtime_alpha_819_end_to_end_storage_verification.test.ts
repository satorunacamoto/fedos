import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readdirSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { validateFedosConversationRecord } from "../src/conversation/fedos_conversation_record_validator.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";

import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { validateFedosConversationPayloadDescriptor } from "../src/conversation/payload_storage/fedos_conversation_payload_descriptor_validator.js";
import { FedosSecureRandomConversationPayloadIdGenerator } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";

import { AppendOnlyFedosPayloadRetentionPersistence } from "../src/conversation/retention/append_only_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "a819-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Secure Runtime Alpha 810 ("Storage Read Semantics") / Alpha 812
 * ("Restart and Recovery") / Alpha 817 ("Performance and Limits
 * Review") / Alpha 819 ("End-to-End Storage Verification") -- Stages
 * 20/22/27/29 of the Alpha 791-820 Conversation Retention & Private
 * Payload Storage Boundary Foundation Arc.
 *
 * Domain-local path only -- this does NOT create a private message.
 * The Conversation Record fixture below uses the REAL, UNCHANGED
 * `validateFedosConversationRecord` (Alpha 748) -- confirming real
 * integration with the existing, frozen Conversation layer without
 * modifying it.
 */
describe("Secure Runtime Alpha 819 -- End-to-End Storage Verification", () => {
  it("1-10. create Conversation fixture -> store -> read -> restart -> read -> tombstone -> denied -> remove -> restart -> state preserved", () => {
    const dir = freshDir();
    const payloadLogPath = join(dir, "payload.ndjson");
    const retentionLogPath = join(dir, "retention.ndjson");

    // 1. an existing, real public Conversation Record (Alpha 745/748, unmodified).
    const boardId = toFedosBoardId("board-819")!;
    const threadId = toFedosThreadId("root-819")!;
    const conversationRecord = validateFedosConversationRecord({
      id: toFedosConversationId(boardId, threadId),
      mode: "public",
      boardId: "board-819",
      rootThreadId: "root-819",
      rootPostId: "root-819",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    })!;
    expect(conversationRecord).not.toBeNull();

    // 2. store an opaque payload referencing that real Conversation id.
    const idGenerator = new FedosSecureRandomConversationPayloadIdGenerator();
    const payloadId = idGenerator.generatePayloadId();
    const bytes = new TextEncoder().encode("opaque bytes, not interpreted");
    const descriptor = validateFedosConversationPayloadDescriptor({
      id: payloadId,
      conversationId: conversationRecord.id,
      mediaType: "application/octet-stream",
      byteLength: bytes.length,
      createdAt: 1_700_000_100,
    })!;

    let payloadStorage = new AppendOnlyFedosConversationPayloadStorage(payloadLogPath, 1_000_000);
    let retentionPersistence = new AppendOnlyFedosPayloadRetentionPersistence(retentionLogPath);
    let authority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: () => 1_700_000_200 });

    expect(payloadStorage.putPayload(descriptor, bytes)).toBe("inserted");

    // 3. read an exact defensive copy.
    const firstRead = authority.readPayload(descriptor.id);
    expect(firstRead.outcome).toBe("found");
    if (firstRead.outcome !== "found") throw new Error("unreachable");
    expect(firstRead.payload.bytes).toEqual(bytes);
    firstRead.payload.bytes[0] = 255; // mutate the returned copy
    const rereadAfterMutation = authority.readPayload(descriptor.id);
    expect(rereadAfterMutation.outcome).toBe("found");
    if (rereadAfterMutation.outcome !== "found") throw new Error("unreachable");
    expect(rereadAfterMutation.payload.bytes).toEqual(bytes); // unaffected by the caller's own mutation

    // 4. restart -- fresh instances over the SAME durable paths.
    payloadStorage = new AppendOnlyFedosConversationPayloadStorage(payloadLogPath, 1_000_000);
    retentionPersistence = new AppendOnlyFedosPayloadRetentionPersistence(retentionLogPath);
    authority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: () => 1_700_000_300 });

    // 5. read again -- state survived the restart.
    const secondRead = authority.readPayload(descriptor.id);
    expect(secondRead.outcome).toBe("found");
    if (secondRead.outcome !== "found") throw new Error("unreachable");
    expect(secondRead.payload.bytes).toEqual(bytes);

    // 6. tombstone.
    expect(authority.tombstonePayload(descriptor.id, null, "test_placeholder")).toEqual({ outcome: "tombstoned" });

    // 7. normal read denied.
    expect(authority.readPayload(descriptor.id)).toEqual({ outcome: "denied", state: "tombstoned" });

    // 8. remove local payload (supported: tombstoned -> payload-removed).
    expect(authority.removeLocalPayload(descriptor.id, null, "test_placeholder")).toEqual({ outcome: "payload-removed" });
    expect(authority.readPayload(descriptor.id)).toEqual({ outcome: "denied", state: "payload-removed" });

    // 9. restart again.
    payloadStorage = new AppendOnlyFedosConversationPayloadStorage(payloadLogPath, 1_000_000);
    retentionPersistence = new AppendOnlyFedosPayloadRetentionPersistence(retentionLogPath);
    authority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: () => 1_700_000_400 });

    // 10. state preserved: still denied, still payload-removed, never silently reactivated.
    expect(authority.readPayload(descriptor.id)).toEqual({ outcome: "denied", state: "payload-removed" });
    expect(authority.evaluatePayloadAccess(descriptor.id)).toEqual({ outcome: "denied", state: "payload-removed" });

    // This did not create a private message: no FedosConversationMessage
    // or Envelope type exists anywhere in this Arc's own source.
    const payloadStorageFiles = readdirSync("src/conversation/payload_storage") as string[];
    expect(payloadStorageFiles.some((name) => /message|envelope/i.test(name))).toBe(false);
  });

  it("11. corrupt payload log fails closed at restart -- never silently drops or repairs a corrupt record", () => {
    const dir = freshDir();
    const payloadLogPath = join(dir, "payload.ndjson");
    appendFileSync(payloadLogPath, "{not valid json\n", "utf8");
    const storage = new AppendOnlyFedosConversationPayloadStorage(payloadLogPath, 1_000_000);
    expect(() => storage.listConversationPayloads("board-819::root-819" as any)).toThrow();
  });

  it("12. performance/limits: 100 payloads round-trip correctly through the real append-only backend (current complexity: O(n) replay per read, stated honestly, not benchmarked at scale)", () => {
    const dir = freshDir();
    const payloadLogPath = join(dir, "payload.ndjson");
    const storage = new AppendOnlyFedosConversationPayloadStorage(payloadLogPath, 1_000_000);
    const conversationId = "board-bulk::thread-1";
    for (let i = 0; i < 100; i += 1) {
      const descriptor = validateFedosConversationPayloadDescriptor({
        id: `payload-${i}`,
        conversationId,
        mediaType: "application/octet-stream",
        byteLength: 1,
        createdAt: 1_700_000_000,
      })!;
      expect(storage.putPayload(descriptor, new Uint8Array([i % 256]))).toBe("inserted");
    }
    expect(storage.listConversationPayloads(conversationId as any)).toHaveLength(100);
    expect(storage.getPayload("payload-50" as any)?.bytes).toEqual(new Uint8Array([50]));
  });
});
