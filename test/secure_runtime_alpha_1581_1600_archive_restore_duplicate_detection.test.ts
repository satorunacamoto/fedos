import { describe, it, expect, beforeEach } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/conversation/archive/fedos_conversation_archive_bundle.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import { detectFedosConversationArchiveDuplicates } from "../src/conversation/archive/fedos_conversation_archive_duplicate_detection.js";
import { collectFedosConversationArchiveBundle } from "../src/conversation/archive/fedos_conversation_archive_collector.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

const CONVERSATION_ID = "board-a::thread-1" as FedosConversationId;

function makeBundle(): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: CONVERSATION_ID,
    exportedAt: 1_700_000_500,
    conversation: {
      schemaVersion: 1,
      id: CONVERSATION_ID,
      mode: "public",
      boardId: "board-a",
      rootThreadId: "thread-1",
      rootPostId: "thread-1",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    },
    memberships: [
      {
        schemaVersion: 1,
        id: `${CONVERSATION_ID}::fedos::alice`,
        conversationId: CONVERSATION_ID,
        participantAuthority: "fedos",
        participantPublicIdentifier: "alice",
        participantIdentityId: null,
        role: "owner",
        state: "active",
        joinedAt: 1_700_000_000,
        endedAt: null,
      },
    ],
    capabilityEvents: [
      {
        schemaVersion: 1,
        eventType: "issued",
        capabilityId: "cap-1",
        conversationId: CONVERSATION_ID,
        action: "join-conversation",
        issuerAuthority: "fedos",
        issuerPublicIdentifier: "alice",
        issuerIdentityId: null,
        intendedRecipientAuthority: null,
        intendedRecipientPublicIdentifier: null,
        intendedRecipientIdentityId: null,
        maxUses: 5,
        expiresAt: null,
        issuedAt: 1_700_000_000,
        bearerVerifier: "deadbeef",
      },
      {
        schemaVersion: 1,
        eventType: "redeemed",
        capabilityId: "cap-1",
        redeemerAuthority: "fedos",
        redeemerPublicIdentifier: "bob",
        redeemerIdentityId: null,
        redeemedAt: 1_700_000_050,
      },
    ],
    envelopes: [
      {
        schemaVersion: 1,
        id: "envelope-1",
        conversationId: CONVERSATION_ID,
        senderMembershipId: `${CONVERSATION_ID}::fedos::alice`,
        payloadId: "payload-1",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_700_000_010,
        replyToEnvelopeId: null,
      },
    ],
    payloads: [
      {
        schemaVersion: 1,
        id: "payload-1",
        conversationId: CONVERSATION_ID,
        mediaType: "application/octet-stream",
        byteLength: 5,
        createdAt: 1_700_000_010,
        bytesBase64: Buffer.from([1, 2, 3, 4, 5]).toString("base64"),
      },
    ],
  };
}

function makeDependencies(): FedosConversationArchiveRestoreDependencies {
  return {
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
  };
}

describe("Secure Runtime Alpha 1581-1600 -- Archive Collector", () => {
  it("1. collects every record already persisted for a conversation", () => {
    const deps = makeDependencies();
    const bundle = makeBundle();
    restoreFedosConversationArchiveBundle(bundle, deps);

    const collected = collectFedosConversationArchiveBundle(CONVERSATION_ID, deps, 1_700_000_999);
    expect(collected).not.toBeNull();
    expect(collected?.memberships.length).toBe(1);
    expect(collected?.capabilityEvents.length).toBe(2);
    expect(collected?.envelopes.length).toBe(1);
    expect(collected?.payloads.length).toBe(1);
    expect(collected?.payloads[0]?.bytesBase64).toBe(bundle.payloads[0]?.bytesBase64);
  });

  it("2. returns null for an unknown conversation", () => {
    const deps = makeDependencies();
    expect(collectFedosConversationArchiveBundle(CONVERSATION_ID, deps, 1_700_000_999)).toBeNull();
  });
});

describe("Secure Runtime Alpha 1581-1600 -- Archive Restore", () => {
  let deps: FedosConversationArchiveRestoreDependencies;

  beforeEach(() => {
    deps = makeDependencies();
  });

  it("1. a fresh restore inserts every record", () => {
    const result = restoreFedosConversationArchiveBundle(makeBundle(), deps);
    expect(result.conversation).toBe("inserted");
    expect(result.memberships).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
    expect(result.capabilityEvents).toEqual({ inserted: 2, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
    expect(result.envelopes).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
    expect(result.payloads).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
  });

  it("2. re-restoring the identical bundle reports every record as a duplicate (already-present)", () => {
    restoreFedosConversationArchiveBundle(makeBundle(), deps);
    const result = restoreFedosConversationArchiveBundle(makeBundle(), deps);
    expect(result.conversation).toBe("duplicate");
    expect(result.memberships.duplicate).toBe(1);
    expect(result.capabilityEvents.duplicate).toBe(2);
    expect(result.envelopes.duplicate).toBe(1);
    expect(result.payloads.duplicate).toBe(1);
  });

  it("3. restoring a SAME-id, DIFFERENT-content record reports a conflict", () => {
    restoreFedosConversationArchiveBundle(makeBundle(), deps);
    const base = makeBundle();
    const conflicting: FedosConversationArchiveBundleV1 = { ...base, conversation: { ...base.conversation, createdAt: base.conversation.createdAt + 1 } };
    const result = restoreFedosConversationArchiveBundle(conflicting, deps);
    expect(result.conversation).toBe("conflict");
  });

  it("4. a malformed nested record is tallied invalid and does not abort the rest of the restore", () => {
    const bundle = makeBundle();
    const malformed = { ...bundle.envelopes[0]!, keyEpoch: "not-a-number" as unknown as number };
    const withMalformedEnvelope: FedosConversationArchiveBundleV1 = { ...bundle, envelopes: [malformed] };
    const result = restoreFedosConversationArchiveBundle(withMalformedEnvelope, deps);
    expect(result.envelopes).toEqual({ inserted: 0, duplicate: 0, conflict: 0, failed: 0, invalid: 1 });
    expect(result.conversation).toBe("inserted");
    expect(result.memberships.inserted).toBe(1);
  });

  it("5. restored payload bytes are byte-for-byte recoverable from the target payload storage", () => {
    restoreFedosConversationArchiveBundle(makeBundle(), deps);
    const payload = deps.payloadStorage.getPayload("payload-1" as never);
    expect(payload).not.toBeNull();
    expect([...(payload?.bytes ?? [])]).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("Secure Runtime Alpha 1581-1600 -- Archive Duplicate Detection (read-only preflight)", () => {
  it("1. reports every record as new before anything is restored, and writes nothing", () => {
    const deps = makeDependencies();
    const bundle = makeBundle();
    const report = detectFedosConversationArchiveDuplicates(bundle, deps);
    expect(report.conversation).toBe("new");
    expect(report.memberships).toEqual({ new: 1, duplicate: 0, conflict: 0 });
    expect(report.capabilityEvents).toEqual({ new: 2, duplicate: 0, conflict: 0 });
    expect(report.envelopes).toEqual({ new: 1, duplicate: 0, conflict: 0 });
    expect(report.payloads).toEqual({ new: 1, duplicate: 0, conflict: 0 });
    expect(deps.conversationPersistence.listConversations().length).toBe(0);
  });

  it("2. reports duplicate after the identical bundle has already been restored", () => {
    const deps = makeDependencies();
    const bundle = makeBundle();
    restoreFedosConversationArchiveBundle(bundle, deps);
    const report = detectFedosConversationArchiveDuplicates(bundle, deps);
    expect(report.conversation).toBe("duplicate");
    expect(report.memberships.duplicate).toBe(1);
    expect(report.envelopes.duplicate).toBe(1);
    expect(report.payloads.duplicate).toBe(1);
  });

  it("3. reports conflict for a same-id, different-content record", () => {
    const deps = makeDependencies();
    restoreFedosConversationArchiveBundle(makeBundle(), deps);
    const base = makeBundle();
    const conflicting: FedosConversationArchiveBundleV1 = { ...base, conversation: { ...base.conversation, createdAt: base.conversation.createdAt + 1 } };
    const report = detectFedosConversationArchiveDuplicates(conflicting, deps);
    expect(report.conversation).toBe("conflict");
  });
});
