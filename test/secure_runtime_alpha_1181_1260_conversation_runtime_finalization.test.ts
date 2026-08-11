/**
 * Secure Runtime Alpha 1181–1260 — Conversation Runtime Finalization Arc.
 *
 * Phase A/B review (documented, no code change required): `FedosConversationRuntime`'s
 * public API (`docs/secure_runtime_alpha_1111_1180_completion_declaration.md`
 * §6, re-verified here by direct source inspection) already exposes ONLY
 * narrow, application-safe methods — no persistence port, encryption
 * handle, WASM handle, account-index resolver, counterparty raw-key
 * resolver, bearer verifier, or coordination store anywhere in its public
 * surface (Alpha 1144). `FedosRunningDesktopRuntime.conversationRuntime()`
 * already throws after `stop()` (Alpha 923, unchanged) — "no use after
 * stop" (Alpha 1145) already holds. A repository-wide search for
 * `TODO`/`FIXME`/`temporary`/`placeholder` across `src/conversation/` and
 * `src/desktop/` found no scaffolding of that kind anywhere — the only
 * "temporary" occurrences are the reviewed, permanent
 * `"temporary-capability"` participant-authority enum value (Alpha 762),
 * not adapter scaffolding. Phase B's "eliminate remaining temporary
 * adapters" therefore has nothing to remove: this Arc's real, additive
 * contribution is Phase C — the corruption matrix (Alpha 1156) and
 * restart-identity-stability (Alpha 1163) / independent-runtime-isolation
 * (Alpha 1167) coverage the prior Arc's own completion declaration named
 * as not individually exercised.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppendOnlyFedosConversationActivationPersistence } from "../src/os/messenger/conversations/activation/append_only_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/append_only_fedos_conversation_draft_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { AppendOnlyFedosConversationEncryptionCoordinationPersistence } from "../src/os/messenger/conversations/encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { FedosConversationEncryptionCoordinator } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_coordinator.js";
import { FedosConversationDecryptionCoordinator } from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_coordinator.js";
import { FedosConversationDirectMessagingCoordinator } from "../src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.js";
import { DelegatingFedosConversationIdentityResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_key_resolver.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";

const CONVERSATION_ID = "private-draft::direct::alpha-1181" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const MALLORY: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "mallory-local", identityId: null };
const NOW = 1_714_000_000;

function fakeMarker(request: { localAccountIndex: number; counterpartyPublicKeyHex: string }): Uint8Array {
  return new TextEncoder().encode(`FAKE:${request.localAccountIndex}:${request.counterpartyPublicKeyHex}:`);
}
class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    const marker = fakeMarker(request);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    const marker = fakeMarker(request);
    if (request.ciphertext.length < marker.length) return { outcome: "failed" };
    for (let i = 0; i < marker.length; i += 1) {
      if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    }
    return { outcome: "decrypted", plaintext: request.ciphertext.subarray(marker.length) };
  }
}

function activeDraftRecord(id: string, creator: FedosConversationParticipantReference): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode: "direct",
    lifecycleState: "draft",
    policyReference: "direct-draft-v1",
    creatorAuthority: creator.authority,
    creatorPublicIdentifier: creator.publicIdentifier,
    creatorIdentityId: creator.identityId,
    createdAt: NOW,
  };
}

// ---------------------------------------------------------------------------
// Phase C -- corruption matrix over the NEW Activation log.
// ---------------------------------------------------------------------------

describe("Alpha 1156/1181 -- Activation log corruption fails closed", () => {
  it("1. a malformed (non-JSON) line throws on replay -- no false active state, no silent recovery", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-activation-corrupt-"));
    const file = join(dir, "activation.log");
    const persistence = new AppendOnlyFedosConversationActivationPersistence(file);
    const activationId = fedosConversationActivationId(CONVERSATION_ID);
    persistence.putActivationFact({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "prepared", startedAt: NOW, updatedAt: NOW });

    appendFileSync(file, "{not valid json at all\n", "utf8");

    const reopened = new AppendOnlyFedosConversationActivationPersistence(file);
    expect(() => reopened.getActivation(activationId)).toThrow();
  });

  it("2. two conflicting records for the SAME (activationId, phase) key throw on replay -- an irreconcilable log conflict, never silently resolved", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-activation-conflict-"));
    const file = join(dir, "activation.log");
    const activationId = fedosConversationActivationId(CONVERSATION_ID);
    appendFileSync(
      file,
      JSON.stringify({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW }) + "\n",
      "utf8",
    );
    appendFileSync(
      file,
      JSON.stringify({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW + 999 }) + "\n",
      "utf8",
    );

    const persistence = new AppendOnlyFedosConversationActivationPersistence(file);
    expect(() => persistence.getActivation(activationId)).toThrow();
  });

  it("3. corruption in the Activation log propagates through the real messaging path as a thrown error, never a silent 'active' or 'inactive' answer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-activation-corrupt-messaging-"));
    const activationLogPath = join(dir, "activation.log");
    const draftPersistence = new AppendOnlyFedosConversationDraftPersistence(join(dir, "draft.log"));
    draftPersistence.putDraft(activeDraftRecord(CONVERSATION_ID, ALICE));
    const membershipAuthority = new PersistedFedosConversationMembershipAuthority(
      new AppendOnlyFedosConversationMembershipPersistence(join(dir, "membership.log")),
    );
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);

    // Corrupt the activation log directly (never touched by any coordinator).
    appendFileSync(activationLogPath, "{{{ garbage\n", "utf8");
    const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(activationLogPath);

    const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
    const keyResolver = new FedosConversationKeyResolver({
      identityResolver,
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
    });
    const envelopePersistence = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(dir, "envelope.log"));
    const payloadStorage = new AppendOnlyFedosConversationPayloadStorage(join(dir, "payload.log"), 1_000_000);
    const retentionAuthority = new FedosPayloadRetentionAuthority({
      retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
      payloadStorage,
      clock: () => NOW,
    });
    const encryptionCoordinator = new FedosConversationEncryptionCoordinator({
      draftPersistence,
      activationPersistence,
      membershipAuthority,
      identityResolver,
      keyResolver,
      encryptionAuthority: new FakeEncryptionAuthority(),
      envelopePersistence,
      payloadStorage,
      coordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(dir, "encryption-coordination.log")),
      envelopeIdGenerator: { generateEnvelopeId: () => "corrupt-envelope-1" },
      payloadIdGenerator: { generatePayloadId: () => "corrupt-payload-1" },
      idempotencyKeyGenerator: { generateIdempotencyKey: () => "corrupt-idem-1" },
      clock: () => NOW,
    });
    const decryptionCoordinator = new FedosConversationDecryptionCoordinator({
      draftPersistence,
      activationPersistence,
      membershipAuthority,
      identityResolver,
      keyResolver,
      decryptionAuthority: new FakeDecryptionAuthority(),
      envelopePersistence,
      payloadStorage,
    });
    const coordinator = new FedosConversationDirectMessagingCoordinator({
      draftPersistence,
      activationPersistence,
      membershipAuthority,
      identityResolver,
      envelopePersistence,
      retentionAuthority,
      encryptionCoordinator,
      decryptionCoordinator,
    });

    // Fail closed means an exception, never a plaintext send/read and never
    // a silently-wrong "conversation-not-active" masking real corruption.
    await expect(coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "should never send", replyToEnvelopeId: null })).rejects.toThrow();
    await expect(coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: "irrelevant" })).rejects.toThrow();
  });
});

describe("Alpha 1156/1181 -- Envelope log corruption fails closed", () => {
  it("1. a malformed Envelope log line throws on replay -- listDirectMessages()/readDirectMessage() never silently drop or fabricate an Envelope", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-envelope-corrupt-"));
    const file = join(dir, "envelope.log");
    const persistence = new AppendOnlyFedosConversationMessageEnvelopePersistence(file);
    persistence.putEnvelope({
      schemaVersion: 1,
      id: "env-1",
      conversationId: CONVERSATION_ID,
      senderMembershipId: "sender-1",
      payloadId: "payload-1",
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: NOW,
      replyToEnvelopeId: null,
    });
    appendFileSync(file, "not json\n", "utf8");

    const reopened = new AppendOnlyFedosConversationMessageEnvelopePersistence(file);
    expect(() => reopened.listConversationEnvelopes(CONVERSATION_ID)).toThrow();
    expect(() => reopened.getEnvelope("env-1")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phase C -- restart validation combined with a corrupted durable state:
// the failure is a property of the DATA, not of one process's in-memory
// state -- a wholly independent, later "restart" hits the identical
// fail-closed outcome.
// ---------------------------------------------------------------------------

describe("Alpha 1124/1156 -- corruption survives restart identically (fail-closed is a durable-data property, not process-local state)", () => {
  it("1. a corrupted Activation log throws for every independent Coordinator instance opened over it, restart after restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-activation-corrupt-restart-"));
    const file = join(dir, "activation.log");
    const activationId = fedosConversationActivationId(CONVERSATION_ID);
    appendFileSync(file, JSON.stringify({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "prepared", startedAt: NOW, updatedAt: NOW }) + "\n", "utf8");
    appendFileSync(file, "{{{ still garbage after a real record\n", "utf8");

    for (let restart = 0; restart < 3; restart += 1) {
      const instance = new AppendOnlyFedosConversationActivationPersistence(file);
      expect(() => instance.getActivation(activationId)).toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Phase A -- Alpha 1167 Independent Runtime Isolation.
// ---------------------------------------------------------------------------

describe("Alpha 1167 -- independent Runtime/backend sets never share state", () => {
  it("1. a message sent through one in-memory backend set is invisible to a wholly independent second set, even for the SAME Conversation id", async () => {
    function buildIsolated() {
      const draftPersistence = new AppendOnlyFedosConversationDraftPersistence(join(mkdtempSync(join(tmpdir(), "fedos-iso-")), "draft.log"));
      draftPersistence.putDraft(activeDraftRecord(CONVERSATION_ID, ALICE));
      const membershipAuthority = new PersistedFedosConversationMembershipAuthority(
        new AppendOnlyFedosConversationMembershipPersistence(join(mkdtempSync(join(tmpdir(), "fedos-iso-")), "membership.log")),
      );
      membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
      membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
      const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(join(mkdtempSync(join(tmpdir(), "fedos-iso-")), "activation.log"));
      const activationId = fedosConversationActivationId(CONVERSATION_ID);
      activationPersistence.putActivationFact({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW });
      const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
      const keyResolver = new FedosConversationKeyResolver({
        identityResolver,
        participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
        accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
      });
      const envelopePersistence = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(mkdtempSync(join(tmpdir(), "fedos-iso-")), "envelope.log"));
      const payloadStorage = new AppendOnlyFedosConversationPayloadStorage(join(mkdtempSync(join(tmpdir(), "fedos-iso-")), "payload.log"), 1_000_000);
      const retentionAuthority = new FedosPayloadRetentionAuthority({
        retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
        payloadStorage,
        clock: () => NOW,
      });
      const encryptionCoordinator = new FedosConversationEncryptionCoordinator({
        draftPersistence,
        activationPersistence,
        membershipAuthority,
        identityResolver,
        keyResolver,
        encryptionAuthority: new FakeEncryptionAuthority(),
        envelopePersistence,
        payloadStorage,
        coordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(mkdtempSync(join(tmpdir(), "fedos-iso-")), "enc-coord.log")),
        envelopeIdGenerator: { generateEnvelopeId: () => `iso-env-${Math.random().toString(36).slice(2)}` },
        payloadIdGenerator: { generatePayloadId: () => `iso-payload-${Math.random().toString(36).slice(2)}` },
        idempotencyKeyGenerator: { generateIdempotencyKey: () => `iso-idem-${Math.random().toString(36).slice(2)}` },
        clock: () => NOW,
      });
      const decryptionCoordinator = new FedosConversationDecryptionCoordinator({
        draftPersistence,
        activationPersistence,
        membershipAuthority,
        identityResolver,
        keyResolver,
        decryptionAuthority: new FakeDecryptionAuthority(),
        envelopePersistence,
        payloadStorage,
      });
      return new FedosConversationDirectMessagingCoordinator({
        draftPersistence,
        activationPersistence,
        membershipAuthority,
        identityResolver,
        envelopePersistence,
        retentionAuthority,
        encryptionCoordinator,
        decryptionCoordinator,
      });
    }

    const runtimeA = buildIsolated();
    const runtimeB = buildIsolated();

    const sent = await runtimeA.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "only in A", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");

    expect(runtimeA.listDirectMessages(CONVERSATION_ID)).toHaveLength(1);
    expect(runtimeB.listDirectMessages(CONVERSATION_ID)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase C -- Alpha 1163 Restart Identity Stability.
// ---------------------------------------------------------------------------

describe("Alpha 1163 -- restart identity stability", () => {
  function buildOverFiles(dir: string, identity: FedosConversationParticipantReference) {
    const draftPersistence = new AppendOnlyFedosConversationDraftPersistence(join(dir, "draft.log"));
    const membershipAuthority = new PersistedFedosConversationMembershipAuthority(
      new AppendOnlyFedosConversationMembershipPersistence(join(dir, "membership.log")),
    );
    const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(join(dir, "activation.log"));
    const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(identity));
    const keyResolver = new FedosConversationKeyResolver({
      identityResolver,
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
    });
    const envelopePersistence = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(dir, "envelope.log"));
    const payloadStorage = new AppendOnlyFedosConversationPayloadStorage(join(dir, "payload.log"), 1_000_000);
    const retentionAuthority = new FedosPayloadRetentionAuthority({
      retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
      payloadStorage,
      clock: () => NOW,
    });
    const encryptionCoordinator = new FedosConversationEncryptionCoordinator({
      draftPersistence,
      activationPersistence,
      membershipAuthority,
      identityResolver,
      keyResolver,
      encryptionAuthority: new FakeEncryptionAuthority(),
      envelopePersistence,
      payloadStorage,
      coordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(dir, "enc-coord.log")),
      envelopeIdGenerator: { generateEnvelopeId: () => "stable-envelope-1" },
      payloadIdGenerator: { generatePayloadId: () => "stable-payload-1" },
      idempotencyKeyGenerator: { generateIdempotencyKey: () => "stable-idem-1" },
      clock: () => NOW,
    });
    const decryptionCoordinator = new FedosConversationDecryptionCoordinator({
      draftPersistence,
      activationPersistence,
      membershipAuthority,
      identityResolver,
      keyResolver,
      decryptionAuthority: new FakeDecryptionAuthority(),
      envelopePersistence,
      payloadStorage,
    });
    const coordinator = new FedosConversationDirectMessagingCoordinator({
      draftPersistence,
      activationPersistence,
      membershipAuthority,
      identityResolver,
      envelopePersistence,
      retentionAuthority,
      encryptionCoordinator,
      decryptionCoordinator,
    });
    return { draftPersistence, membershipAuthority, activationPersistence, coordinator };
  }

  it("1. the SAME identity authority across a restart resolves the SAME Membership and decrypts existing payloads", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-identity-stable-"));
    const before = buildOverFiles(dir, ALICE);
    before.draftPersistence.putDraft(activeDraftRecord(CONVERSATION_ID, ALICE));
    before.membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    before.membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
    const activationId = fedosConversationActivationId(CONVERSATION_ID);
    before.activationPersistence.putActivationFact({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW });

    const sent = await before.coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "stable identity", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    // Restart with the SAME identity (ALICE) -- resolves the identical, deterministic Membership id and can decrypt.
    const restartedSame = buildOverFiles(dir, ALICE);
    const readSame = await restartedSame.coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId });
    expect(readSame.outcome).toBe("decrypted");

    // Restart with a DIFFERENT local identity (MALLORY, never admitted) -- fails.
    const restartedDifferent = buildOverFiles(dir, MALLORY);
    const readDifferent = await restartedDifferent.coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId });
    expect(readDifferent.outcome).toBe("unauthorized");
  });
});
