/**
 * Secure Runtime Alpha 1111–1180 — Direct Activation Coordinator (Phase B).
 *
 * Covers Alpha 1122's own sequence, Alpha 1123's Private-Group Gate, Alpha
 * 1124's crash-recovery discipline, and Alpha 1160's "active cannot revert
 * to draft" requirement. Uses `FakeConversationEncryptionAuthority`/
 * `FakeConversationDecryptionAuthority` test doubles — the SAME pattern
 * `test/secure_runtime_alpha_943_946_encryption_decryption_coordinators.test.ts`
 * already established — never a real WASM artifact (none is built in this
 * checked-out tree; see the integrated inventory's own §5).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FedosConversationDirectActivationCoordinator } from "../src/os/messenger/conversations/activation/fedos_conversation_direct_activation_coordinator.js";
import { InMemoryFedosConversationActivationPersistence } from "../src/os/messenger/conversations/activation/in_memory_fedos_conversation_activation_persistence.js";
import { AppendOnlyFedosConversationActivationPersistence } from "../src/os/messenger/conversations/activation/append_only_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { DelegatingFedosConversationIdentityResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_key_resolver.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import { UnavailableFedosConversationEncryptionAuthority } from "../src/os/messenger/conversations/encryption/fedos_unavailable_conversation_encryption_authority.js";
import { UnavailableFedosConversationDecryptionAuthority } from "../src/os/messenger/conversations/encryption/fedos_unavailable_conversation_decryption_authority.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationActivationPersistence } from "../src/os/messenger/conversations/activation/fedos_conversation_activation_persistence.js";

const CONVERSATION_ID = "private-draft::direct::alpha-1122" as FedosConversationId;
const GROUP_CONVERSATION_ID = "private-draft::private-group::alpha-1122" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };
const NOW = 1_711_000_000;

class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(_request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    return { outcome: "encrypted", ciphertext: new Uint8Array([1]) };
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(_request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    return { outcome: "decrypted", plaintext: new Uint8Array([1]) };
  }
}

function draftRecord(id: string, mode: "direct" | "private-group", creator: FedosConversationParticipantReference): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode,
    lifecycleState: "draft",
    policyReference: mode === "direct" ? "direct-draft-v1" : "private-group-draft-v1",
    creatorAuthority: creator.authority,
    creatorPublicIdentifier: creator.publicIdentifier,
    creatorIdentityId: creator.identityId,
    createdAt: NOW,
  };
}

function buildFixture(opts: {
  members?: readonly FedosConversationParticipantReference[];
  identityUnavailable?: boolean;
  encryptionAuthority?: FedosConversationEncryptionAuthority;
  decryptionAuthority?: FedosConversationDecryptionAuthority;
  activationPersistence?: FedosConversationActivationPersistence;
  draftPersistence?: InMemoryFedosConversationDraftPersistence;
  membershipAuthority?: InMemoryFedosConversationMembershipAuthority;
  mode?: "direct" | "private-group";
  noDraft?: boolean;
}) {
  const mode = opts.mode ?? "direct";
  const id = mode === "direct" ? CONVERSATION_ID : GROUP_CONVERSATION_ID;
  const draftPersistence = opts.draftPersistence ?? new InMemoryFedosConversationDraftPersistence();
  if (opts.draftPersistence === undefined && !opts.noDraft) draftPersistence.putDraft(draftRecord(id, mode, ALICE));

  const membershipAuthority = opts.membershipAuthority ?? new InMemoryFedosConversationMembershipAuthority();
  if (opts.membershipAuthority === undefined) {
    for (const m of opts.members ?? [ALICE, BOB]) {
      membershipAuthority.admit(id, m, m === ALICE ? "owner" : "member", NOW);
    }
  }

  const identityResolver = opts.identityUnavailable
    ? { resolveLocalParticipant: () => ({ outcome: "unavailable" as const }) }
    : new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
  const participantResolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
  const keyResolver = new FedosConversationKeyResolver({
    identityResolver,
    participantResolver,
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
  });
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const retentionAuthority = new FedosPayloadRetentionAuthority({
    retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
    payloadStorage,
    clock: () => NOW,
  });
  const activationPersistence = opts.activationPersistence ?? new InMemoryFedosConversationActivationPersistence();

  const coordinator = new FedosConversationDirectActivationCoordinator({
    draftPersistence,
    membershipAuthority,
    activationPersistence,
    identityResolver,
    participantResolver,
    keyResolver,
    encryptionAuthority: opts.encryptionAuthority ?? new FakeEncryptionAuthority(),
    decryptionAuthority: opts.decryptionAuthority ?? new FakeDecryptionAuthority(),
    envelopePersistence,
    payloadStorage,
    retentionAuthority,
    clock: () => NOW,
  });

  return { coordinator, draftPersistence, membershipAuthority, activationPersistence, conversationId: id };
}

describe("Alpha 1122 -- FedosConversationDirectActivationCoordinator", () => {
  it("1. happy path -- a real direct draft with two active members and real crypto authorities activates", async () => {
    const { coordinator, conversationId, activationPersistence } = buildFixture({});
    const result = await coordinator.activateDirectConversation(conversationId);
    expect(result).toEqual({ outcome: "activated" });
    const fact = activationPersistence.getActivation(fedosConversationActivationId(conversationId));
    expect(fact?.phase).toBe("completed");
  });

  it("2. already-active -- a second call on an activated Conversation is a pure, non-mutating read", async () => {
    const { coordinator, conversationId } = buildFixture({});
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });
  });

  it("3. Alpha 1123 Private-Group Gate -- unsupported-mode, never activates, never invents a key", async () => {
    const { coordinator, conversationId } = buildFixture({ mode: "private-group", members: [ALICE, BOB] });
    const result = await coordinator.activateDirectConversation(conversationId);
    expect(result).toEqual({ outcome: "unsupported-mode" });
  });

  it("4. conversation-not-found -- no persisted draft at all", async () => {
    const { coordinator, conversationId } = buildFixture({ noDraft: true });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "conversation-not-found" });
  });

  it("5. identity-unavailable -- the local identity resolver reports unavailable", async () => {
    const { coordinator, conversationId } = buildFixture({ identityUnavailable: true });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "identity-unavailable" });
  });

  it("6. membership-invalid -- the local participant holds no Membership on this Conversation", async () => {
    const { coordinator, conversationId } = buildFixture({ members: [BOB] });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "membership-invalid" });
  });

  it("7. participant-unavailable -- local is the sole active member (recipient not yet admitted)", async () => {
    const { coordinator, conversationId } = buildFixture({ members: [ALICE] });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "participant-unavailable" });
  });

  it("8. participant-unavailable -- ambiguous counterparty (two other active members)", async () => {
    const { coordinator, conversationId } = buildFixture({ members: [ALICE, BOB, CAROL] });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "participant-unavailable" });
  });

  it("9. Alpha 1115 fail-closed default -- the Unavailable Encryption Authority denies activation", async () => {
    const { coordinator, conversationId } = buildFixture({ encryptionAuthority: new UnavailableFedosConversationEncryptionAuthority() });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "encryption-unavailable" });
  });

  it("10. Alpha 1115 fail-closed default -- the Unavailable Decryption Authority denies activation", async () => {
    const { coordinator, conversationId } = buildFixture({ decryptionAuthority: new UnavailableFedosConversationDecryptionAuthority() });
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "encryption-unavailable" });
  });

  it("11. Alpha 1160 -- once activated, a Membership revocation afterwards does NOT revert activation (no downgrade path exists)", async () => {
    const { coordinator, conversationId, membershipAuthority } = buildFixture({});
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
    membershipAuthority.revoke(conversationId, BOB, NOW + 1);
    // Re-validating readiness would now fail (BOB is no longer an active
    // counterparty) -- but the coordinator short-circuits on the durable
    // "completed" fact BEFORE ever re-running readiness, so the answer
    // stays "already-active", never a false "not-ready"/reversion to draft.
    expect(await coordinator.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });
  });

  it("12. Alpha 1124 crash recovery -- a fresh Coordinator instance over durable files converges a 'prepared'-only fact to a genuine activation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-activation-recovery-"));
    const activationLogPath = join(dir, "activation.log");

    // Manually seed the durable log to exactly the "prepared, nothing else" crash window.
    const seed = new AppendOnlyFedosConversationActivationPersistence(activationLogPath);
    const activationId = fedosConversationActivationId(CONVERSATION_ID);
    seed.putActivationFact({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "prepared", startedAt: NOW, updatedAt: NOW });

    const recovering = new AppendOnlyFedosConversationActivationPersistence(activationLogPath);
    const { coordinator } = buildFixture({ activationPersistence: recovering });
    const result = await coordinator.activateDirectConversation(CONVERSATION_ID);
    expect(result).toEqual({ outcome: "activated" });

    // Restart again -- a THIRD, fully independent instance over the same file confirms durability.
    const restarted = new AppendOnlyFedosConversationActivationPersistence(activationLogPath);
    expect(restarted.getActivation(activationId)?.phase).toBe("completed");
  });

  it("13. Alpha 1121 -- restart-stable: activate, build a fresh Coordinator over the SAME append-only file, confirm 'already-active'", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-activation-restart-"));
    const activationLogPath = join(dir, "activation.log");
    // Draft/Membership are durable-in-spirit-and-shared across both "restart"
    // instances too (real durability of THOSE domains is already covered by
    // their own dedicated Arcs' restart tests) -- this test isolates the
    // Activation log's own restart behavior specifically.
    const sharedDraftPersistence = new InMemoryFedosConversationDraftPersistence();
    const sharedMembershipAuthority = new InMemoryFedosConversationMembershipAuthority();

    const first = new AppendOnlyFedosConversationActivationPersistence(activationLogPath);
    const fixtureA = buildFixture({ activationPersistence: first, draftPersistence: sharedDraftPersistence, membershipAuthority: sharedMembershipAuthority });
    fixtureA.draftPersistence.putDraft(draftRecord(CONVERSATION_ID, "direct", ALICE));
    fixtureA.membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    fixtureA.membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
    expect(await fixtureA.coordinator.activateDirectConversation(CONVERSATION_ID)).toEqual({ outcome: "activated" });

    const second = new AppendOnlyFedosConversationActivationPersistence(activationLogPath);
    const fixtureB = buildFixture({ activationPersistence: second, draftPersistence: sharedDraftPersistence, membershipAuthority: sharedMembershipAuthority });
    expect(await fixtureB.coordinator.activateDirectConversation(CONVERSATION_ID)).toEqual({ outcome: "already-active" });
  });
});
