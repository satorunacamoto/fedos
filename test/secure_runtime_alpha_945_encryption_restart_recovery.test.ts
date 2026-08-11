/**
 * Secure Runtime Alpha 945 — Encryption Coordinator restart/crash
 * recovery, reusing `FedosConversationDurableRedemptionCoordinator`'s own
 * proven pattern (Alpha 845-847) and
 * `FedosPrivateConversationConstructionCoordinator`'s own restart test
 * style (`test/secure_runtime_alpha_911_920_construction_recovery.test.ts`,
 * Alpha 917/920).
 *
 * Every backend here is a REAL append-only NDJSON file under a fresh temp
 * directory — a "restart" is modeled the same way every other coordinator
 * restart test in this repository already models it: construct a SECOND,
 * fully independent Coordinator instance over the SAME files.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { FedosConversationEncryptionCoordinator } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_coordinator.js";
import { AppendOnlyFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/append_only_fedos_conversation_draft_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationEncryptionCoordinationPersistence } from "../src/os/messenger/conversations/encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.js";
import { fedosConversationEncryptionCoordinationId } from "../src/os/messenger/conversations/encryption/coordination/fedos_persisted_conversation_encryption_coordination_v1.js";
import { AppendOnlyFedosConversationActivationPersistence } from "../src/os/messenger/conversations/activation/append_only_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.js";
import { DelegatingFedosConversationIdentityResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_key_resolver.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js";

const CONVERSATION_ID = "private-draft::direct::alpha-945" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const NOW = 1_700_002_000;

class CountingFakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  calls = 0;
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    this.calls += 1;
    const marker = new TextEncoder().encode(`FAKE:${request.localAccountIndex}:${request.counterpartyPublicKeyHex}:`);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}

function tempPaths() {
  const dir = mkdtempSync(join(tmpdir(), "fedos-encryption-coordinator-"));
  return {
    draftLogPath: join(dir, "draft.log"),
    membershipLogPath: join(dir, "membership.log"),
    envelopeLogPath: join(dir, "envelope.log"),
    payloadLogPath: join(dir, "payload.log"),
    coordinationLogPath: join(dir, "coordination.log"),
    activationLogPath: join(dir, "activation.log"),
  };
}

/** Alpha 1111–1180 -- see `secure_runtime_alpha_931_990_failure_matrix.test.ts`'s own identical helper for why this replaces the draft record's own (now-ignored) `lifecycleState` field. */
function setupActivatedConversation(paths: ReturnType<typeof tempPaths>): void {
  const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(paths.activationLogPath);
  const activationId = fedosConversationActivationId(CONVERSATION_ID);
  activationPersistence.putActivationFact({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW });
}

function activeDraftRecord(): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id: CONVERSATION_ID,
    mode: "direct",
    lifecycleState: "active",
    policyReference: "direct-draft-v1",
    creatorAuthority: ALICE.authority,
    creatorPublicIdentifier: ALICE.publicIdentifier,
    creatorIdentityId: ALICE.identityId,
    createdAt: NOW,
  };
}

/** Builds a fresh Coordinator (and its own fake Authority instance) over the SAME durable file paths — a "restart" per this repository's own established test convention. */
function buildCoordinatorOverFiles(paths: ReturnType<typeof tempPaths>, encryptionAuthority: FedosConversationEncryptionAuthority) {
  const draftPersistence = new AppendOnlyFedosConversationDraftPersistence(paths.draftLogPath);
  const membershipAuthority = new PersistedFedosConversationMembershipAuthority(
    new AppendOnlyFedosConversationMembershipPersistence(paths.membershipLogPath),
  );
  const envelopePersistence = new AppendOnlyFedosConversationMessageEnvelopePersistence(paths.envelopeLogPath);
  const payloadStorage = new AppendOnlyFedosConversationPayloadStorage(paths.payloadLogPath, 1_000_000);
  const coordinationPersistence = new AppendOnlyFedosConversationEncryptionCoordinationPersistence(paths.coordinationLogPath);
  const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
  const keyResolver = new FedosConversationKeyResolver({
    identityResolver,
    participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
  });
  const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(paths.activationLogPath);
  const coordinator = new FedosConversationEncryptionCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    encryptionAuthority,
    envelopePersistence,
    payloadStorage,
    coordinationPersistence,
    envelopeIdGenerator: { generateEnvelopeId: () => "envelope-restart-1" },
    payloadIdGenerator: { generatePayloadId: () => "payload-restart-1" },
    idempotencyKeyGenerator: { generateIdempotencyKey: () => "idem-restart-1" },
    clock: () => NOW,
  });
  return { draftPersistence, membershipAuthority, envelopePersistence, payloadStorage, coordinationPersistence, coordinator };
}

describe("Alpha 945 -- restart recovery, full happy-path attempt completed before the 'restart'", () => {
  it("1. a fresh Coordinator instance over the same files replays the SAME idempotency key to 'encrypted' with no duplicate Envelope/Payload and no second encrypt() call", async () => {
    const paths = tempPaths();

    const setupDraft = new AppendOnlyFedosConversationDraftPersistence(paths.draftLogPath);
    setupDraft.putDraft(activeDraftRecord());
    setupActivatedConversation(paths);
    const setupMembership = new PersistedFedosConversationMembershipAuthority(
      new AppendOnlyFedosConversationMembershipPersistence(paths.membershipLogPath),
    );
    setupMembership.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    setupMembership.admit(CONVERSATION_ID, BOB, "member", NOW);

    const authorityA = new CountingFakeEncryptionAuthority();
    const first = buildCoordinatorOverFiles(paths, authorityA);
    const resultA = await first.coordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext: new TextEncoder().encode("restart me"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
      idempotencyKey: "restart-key-1",
    });
    expect(resultA.outcome).toBe("encrypted");
    expect(authorityA.calls).toBe(1);

    // "Restart" -- a fully independent second Coordinator, fresh backend instances, same files.
    const authorityB = new CountingFakeEncryptionAuthority();
    const second = buildCoordinatorOverFiles(paths, authorityB);
    const resultB = await second.coordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext: new TextEncoder().encode("restart me"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
      idempotencyKey: "restart-key-1",
    });
    expect(resultB.outcome).toBe("encrypted");
    if (resultA.outcome !== "encrypted" || resultB.outcome !== "encrypted") return;
    expect(resultB.envelope.id).toBe(resultA.envelope.id);
    // The completed-phase replay re-reads the Envelope -- it never re-encrypts.
    expect(authorityB.calls).toBe(0);
    expect(second.envelopePersistence.listConversationEnvelopes(CONVERSATION_ID)).toHaveLength(1);
  });
});

describe("Alpha 945 -- restart recovery, crash simulated BETWEEN payload-persisted and envelope-persisted", () => {
  it("1. a fresh Coordinator instance completes forward from a durable 'payload-persisted' fact -- reuses the SAME payload, never calls encrypt() again", async () => {
    const paths = tempPaths();
    const setupDraft = new AppendOnlyFedosConversationDraftPersistence(paths.draftLogPath);
    setupDraft.putDraft(activeDraftRecord());
    setupActivatedConversation(paths);
    const setupMembership = new PersistedFedosConversationMembershipAuthority(
      new AppendOnlyFedosConversationMembershipPersistence(paths.membershipLogPath),
    );
    setupMembership.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    setupMembership.admit(CONVERSATION_ID, BOB, "member", NOW);

    // Manually seed durable state to exactly the "payload-persisted" crash window --
    // a "prepared" fact, a real Payload record, then a "payload-persisted" fact, but
    // deliberately NO Envelope written -- simulating a crash right after the payload
    // write succeeded but before the Envelope write ran.
    const payloadStorage = new AppendOnlyFedosConversationPayloadStorage(paths.payloadLogPath, 1_000_000);
    const marker = new TextEncoder().encode("FAKE:0:" + BOB.publicIdentifier + ":");
    const plaintext = new TextEncoder().encode("crash window message");
    const ciphertext = new Uint8Array(marker.length + plaintext.length);
    ciphertext.set(marker, 0);
    ciphertext.set(plaintext, marker.length);
    payloadStorage.putPayload(
      { id: "payload-restart-1" as any, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: ciphertext.length, createdAt: NOW },
      ciphertext,
    );
    const coordinationPersistence = new AppendOnlyFedosConversationEncryptionCoordinationPersistence(paths.coordinationLogPath);
    const coordinationId = fedosConversationEncryptionCoordinationId(CONVERSATION_ID, "restart-key-2");
    coordinationPersistence.putCoordinationFact({
      schemaVersion: 1,
      coordinationId,
      conversationId: CONVERSATION_ID,
      envelopeId: "envelope-restart-1",
      payloadId: "payload-restart-1",
      phase: "prepared",
      startedAt: NOW,
      updatedAt: NOW,
    });
    coordinationPersistence.putCoordinationFact({
      schemaVersion: 1,
      coordinationId,
      conversationId: CONVERSATION_ID,
      envelopeId: "envelope-restart-1",
      payloadId: "payload-restart-1",
      phase: "payload-persisted",
      startedAt: NOW,
      updatedAt: NOW,
    });

    // No Envelope exists yet -- exactly the "crashed after payload, before envelope" state.
    const envelopePersistenceBefore = new AppendOnlyFedosConversationMessageEnvelopePersistence(paths.envelopeLogPath);
    expect(envelopePersistenceBefore.getEnvelope("envelope-restart-1")).toBeNull();

    const authority = new CountingFakeEncryptionAuthority();
    const recovering = buildCoordinatorOverFiles(paths, authority);
    const result = await recovering.coordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext,
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
      idempotencyKey: "restart-key-2",
    });

    expect(result.outcome).toBe("encrypted");
    if (result.outcome !== "encrypted") return;
    expect(result.envelope.id).toBe("envelope-restart-1");
    expect(result.envelope.payloadId).toBe("payload-restart-1");
    // The ciphertext was already durable -- recovery must NEVER call encrypt() again.
    expect(authority.calls).toBe(0);
    expect(recovering.envelopePersistence.listConversationEnvelopes(CONVERSATION_ID)).toHaveLength(1);
    expect(recovering.payloadStorage.listConversationPayloads(CONVERSATION_ID)).toHaveLength(1);
  });
});

describe("Alpha 945 -- restart recovery, crash simulated at 'prepared' only (nothing durably written yet)", () => {
  it("1. a fresh Coordinator instance re-runs the full sequence from scratch, calling encrypt() exactly once", async () => {
    const paths = tempPaths();
    const setupDraft = new AppendOnlyFedosConversationDraftPersistence(paths.draftLogPath);
    setupDraft.putDraft(activeDraftRecord());
    setupActivatedConversation(paths);
    const setupMembership = new PersistedFedosConversationMembershipAuthority(
      new AppendOnlyFedosConversationMembershipPersistence(paths.membershipLogPath),
    );
    setupMembership.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    setupMembership.admit(CONVERSATION_ID, BOB, "member", NOW);

    const coordinationPersistence = new AppendOnlyFedosConversationEncryptionCoordinationPersistence(paths.coordinationLogPath);
    const coordinationId = fedosConversationEncryptionCoordinationId(CONVERSATION_ID, "restart-key-3");
    coordinationPersistence.putCoordinationFact({
      schemaVersion: 1,
      coordinationId,
      conversationId: CONVERSATION_ID,
      envelopeId: "envelope-restart-1",
      payloadId: "payload-restart-1",
      phase: "prepared",
      startedAt: NOW,
      updatedAt: NOW,
    });

    const authority = new CountingFakeEncryptionAuthority();
    const recovering = buildCoordinatorOverFiles(paths, authority);
    const result = await recovering.coordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext: new TextEncoder().encode("fresh from prepared-only"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
      idempotencyKey: "restart-key-3",
    });

    expect(result.outcome).toBe("encrypted");
    expect(authority.calls).toBe(1);
    expect(recovering.envelopePersistence.listConversationEnvelopes(CONVERSATION_ID)).toHaveLength(1);
  });
});
