import { describe, it, expect } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { FedosArchiveSuppressionObservationAuthority } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_observation_authority.js";
import { InMemoryFedosArchiveSuppressionObservationPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_archive_suppression_observation_persistence.js";
import { createFedosArchiveSuppressionFact } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_fact.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";

/**
 * Secure Runtime Alpha 7721-7800 -- Phase H: Archive restore now consults
 * an OPTIONAL, additive `suppressionAuthority` (this Arc's own second
 * gate, alongside `feff676`'s own `retentionAuthority`). Mirrors
 * `test/secure_runtime_alpha_1581_1600_archive_restore_duplicate_detection.test.ts`'s
 * own lightweight, in-memory-only restore-fixture pattern.
 */

const CONVERSATION_ID = "board-a::thread-1" as FedosConversationId;
const ACCOUNT_REF: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };

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
    capabilityEvents: [],
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

function makeDependencies(
  suppressionAuthority?: FedosArchiveSuppressionObservationAuthority,
): FedosConversationArchiveRestoreDependencies {
  return {
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    // NOTE: `retentionAuthority` is intentionally OMITTED for these tests -- Phase H's own gate only calls
    // `suppressionAuthority` at all when `retentionAuthority !== undefined` (mirrors the exact conditional this
    // Arc's own edit preserves). We supply a permissive stand-in so ONLY the suppression gate is under test.
    retentionAuthority: { evaluateRetentionDecisionOnly: () => "active", evaluatePayloadAccess: () => ({ outcome: "allowed" }) } as never,
    suppressionAuthority,
  };
}

describe("Secure Runtime Alpha 7721-7800 -- Archive restore suppression integration (Phase H)", () => {
  it("1. omitted suppressionAuthority: restore behavior is BYTE-FOR-BYTE UNCHANGED (the envelope and payload both restore)", () => {
    const deps = makeDependencies(undefined);
    const result = restoreFedosConversationArchiveBundle(makeBundle(), deps);
    expect(result.envelopes.inserted).toBe(1);
    expect(result.payloads.inserted).toBe(1);
  });

  it("2. an IMPORTED suppression fact for payload-1 denies restore of BOTH the Envelope and the Payload -- even though this device's own local retention log knows nothing about it", () => {
    const authority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: "payload-1" as unknown as FedosConversationPayloadId,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(authority.recordImportedSuppression(fact, "account-only")).toBe("recorded");

    const deps = makeDependencies(authority);
    const result = restoreFedosConversationArchiveBundle(makeBundle(), deps);
    expect(result.envelopes.denied).toBe(1);
    expect(result.envelopes.inserted).toBe(0);
    expect(result.payloads.denied).toBe(1);
    expect(result.payloads.inserted).toBe(0);
  });

  it("3. repeated restore of the same suppressed bundle is idempotent -- still denied, no partial state", () => {
    const authority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: "payload-1" as unknown as FedosConversationPayloadId,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    authority.recordImportedSuppression(fact, "account-only");

    const deps = makeDependencies(authority);
    restoreFedosConversationArchiveBundle(makeBundle(), deps);
    const second = restoreFedosConversationArchiveBundle(makeBundle(), deps);
    expect(second.envelopes.denied).toBe(1);
    expect(second.payloads.denied).toBe(1);
  });

  it("4. an UNRELATED payload's record is unaffected by a suppression fact for a different subject", () => {
    const authority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: "payload-DIFFERENT" as unknown as FedosConversationPayloadId,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    authority.recordImportedSuppression(fact, "account-only");

    const deps = makeDependencies(authority);
    const result = restoreFedosConversationArchiveBundle(makeBundle(), deps);
    expect(result.envelopes.inserted).toBe(1);
    expect(result.payloads.inserted).toBe(1);
  });

  it("5. a suppression fact with evidenceLevel 'device-evidence-invalid' does NOT deny restore -- a tampered/misattributed fact never gains suppression power", () => {
    const authority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: "payload-1" as unknown as FedosConversationPayloadId,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    authority.recordImportedSuppression(fact, "device-evidence-invalid");

    const deps = makeDependencies(authority);
    const result = restoreFedosConversationArchiveBundle(makeBundle(), deps);
    expect(result.envelopes.inserted).toBe(1);
    expect(result.payloads.inserted).toBe(1);
  });
});
