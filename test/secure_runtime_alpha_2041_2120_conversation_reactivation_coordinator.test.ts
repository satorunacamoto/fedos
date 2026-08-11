/**
 * Secure Runtime Alpha 2041–2120 ("Conversation Identity Restoration and
 * Reactivation Arc") — unit-level coverage for
 * `FedosConversationReactivationCoordinator` (`../src/conversation/activation/fedos_conversation_reactivation_coordinator.ts`),
 * exercised directly over in-memory ports (mirrors
 * `test/secure_runtime_alpha_1111_1180_direct_activation.test.ts`'s own
 * `buildFixture()` discipline exactly) to simulate "an archive restored
 * Membership/Generation/Path facts but never a Draft or Activation fact" --
 * the EXACT gap this Arc closes (see
 * `docs/secure_runtime_alpha_2041_2120_reconciliation_report.md`).
 *
 * `FakeEncryptionAuthority`/`FakeDecryptionAuthority` -- the SAME
 * marker-free, always-succeeds test doubles the referenced Alpha 1111-1180
 * test already uses; no real WASM artifact is built in this checked-out
 * tree.
 */
import { describe, it, expect } from "vitest";
import { FedosConversationReactivationCoordinator } from "../src/os/messenger/conversations/activation/fedos_conversation_reactivation_coordinator.js";
import { FedosConversationDirectActivationCoordinator } from "../src/os/messenger/conversations/activation/fedos_conversation_direct_activation_coordinator.js";
import { InMemoryFedosConversationActivationPersistence } from "../src/os/messenger/conversations/activation/in_memory_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { toFedosConversationMembershipId } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_id.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { DelegatingFedosConversationIdentityResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_key_resolver.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import { toFedosPrivateConversationId } from "../src/os/messenger/conversations/construction/fedos_private_conversation_id.js";
import { InMemoryFedosGroupGenerationPersistence } from "../src/os/messenger/conversations/group/in_memory_fedos_group_generation_persistence.js";
import { InMemoryFedosGroupDirectPathPersistence } from "../src/os/messenger/conversations/group/in_memory_fedos_group_direct_path_persistence.js";
import { validateFedosGroupGenerationRecord, toFedosGroupGenerationId } from "../src/os/messenger/conversations/group/fedos_group_generation.js";
import { toFedosGroupDirectPathId, type FedosGroupDirectPathRecord } from "../src/os/messenger/conversations/group/fedos_group_direct_path.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationIdentityResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_identity_resolver.js";

const NOW = 1_720_000_000;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };

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

/** Mirrors `test/secure_runtime_alpha_1111_1180_direct_activation.test.ts`'s own `buildFixture()`, adapted so multiple conversation ids (a Group id + its own children) can share ONE membership authority / activation coordinator graph -- exactly like a real `FedosConversationRuntime` shares one graph across `activateDirectConversation()` and `groupRuntime()`. */
function buildGraph(opts: { identityUnavailable?: boolean; localParticipant?: FedosConversationParticipantReference } = {}) {
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const activationPersistence = new InMemoryFedosConversationActivationPersistence();
  const groupGenerationPersistence = new InMemoryFedosGroupGenerationPersistence();
  const groupDirectPathPersistence = new InMemoryFedosGroupDirectPathPersistence();

  const localParticipant = opts.localParticipant ?? ALICE;
  const identityResolver: FedosConversationIdentityResolver = opts.identityUnavailable
    ? { resolveLocalParticipant: () => ({ outcome: "unavailable" as const }) }
    : new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(localParticipant));

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

  const activationCoordinator = new FedosConversationDirectActivationCoordinator({
    draftPersistence,
    membershipAuthority,
    activationPersistence,
    identityResolver,
    participantResolver,
    keyResolver,
    encryptionAuthority: new FakeEncryptionAuthority(),
    decryptionAuthority: new FakeDecryptionAuthority(),
    envelopePersistence,
    payloadStorage,
    retentionAuthority,
    clock: () => NOW,
  });

  const coordinator = new FedosConversationReactivationCoordinator({
    draftPersistence,
    membershipAuthority,
    identityResolver,
    groupGenerationPersistence,
    groupDirectPathPersistence,
    activationCoordinator,
  });

  return { coordinator, draftPersistence, membershipAuthority, activationPersistence, groupGenerationPersistence, groupDirectPathPersistence };
}

const DIRECT_ID = toFedosPrivateConversationId("direct", "reactivation-2041-direct") as FedosConversationId;

describe("Alpha 2041-2120 -- FedosConversationReactivationCoordinator (direct)", () => {
  it("1. reactivates a restored direct conversation -- Draft re-derived from the owner Membership, then genuinely activated", async () => {
    const { coordinator, draftPersistence, activationPersistence, membershipAuthority } = buildGraph();
    membershipAuthority.admit(DIRECT_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(DIRECT_ID, BOB, "member", NOW);
    expect(draftPersistence.getDraft(DIRECT_ID)).toBeNull();

    const result = await coordinator.reactivateRestoredConversation(DIRECT_ID);
    expect(result).toEqual({ outcome: "reactivated", mode: "direct" });

    const draft = draftPersistence.getDraft(DIRECT_ID);
    expect(draft?.mode).toBe("direct");
    expect(draft?.creatorAuthority).toBe(ALICE.authority);
    expect(draft?.creatorPublicIdentifier).toBe(ALICE.publicIdentifier);
    expect(activationPersistence.getActivation(fedosConversationActivationId(DIRECT_ID))?.phase).toBe("completed");
  });

  it("2. idempotent -- a second call reports already-active and writes nothing new", async () => {
    const { coordinator, draftPersistence, membershipAuthority } = buildGraph();
    membershipAuthority.admit(DIRECT_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(DIRECT_ID, BOB, "member", NOW);
    expect(await coordinator.reactivateRestoredConversation(DIRECT_ID)).toEqual({ outcome: "reactivated", mode: "direct" });
    expect(await coordinator.reactivateRestoredConversation(DIRECT_ID)).toEqual({ outcome: "already-active", mode: "direct" });
    expect(draftPersistence.listDrafts().length).toBe(1); // never duplicated.
  });

  it("3. unauthorized -- the local identity holds no active Membership on this conversation", async () => {
    const { coordinator, membershipAuthority, draftPersistence } = buildGraph({ localParticipant: CAROL });
    membershipAuthority.admit(DIRECT_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(DIRECT_ID, BOB, "member", NOW);
    const result = await coordinator.reactivateRestoredConversation(DIRECT_ID);
    expect(result).toEqual({ outcome: "unauthorized" });
    expect(draftPersistence.getDraft(DIRECT_ID)).toBeNull(); // never writes on a rejected caller.
  });

  it("4. conversation-not-found -- no Draft, no Group generation, no Membership at all for this id", async () => {
    const { coordinator } = buildGraph();
    const result = await coordinator.reactivateRestoredConversation("private-draft::direct::never-existed" as FedosConversationId);
    expect(result).toEqual({ outcome: "conversation-not-found" });
  });

  it("5. identity-unavailable -- the local identity resolver cannot resolve anyone", async () => {
    const { coordinator, membershipAuthority } = buildGraph({ identityUnavailable: true });
    membershipAuthority.admit(DIRECT_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(DIRECT_ID, BOB, "member", NOW);
    expect(await coordinator.reactivateRestoredConversation(DIRECT_ID)).toEqual({ outcome: "identity-unavailable" });
  });

  it("6. creator-unresolvable -- an active local Membership exists but no Membership carries role 'owner' (a genuinely malformed restore)", async () => {
    const { coordinator, membershipAuthority } = buildGraph();
    membershipAuthority.admit(DIRECT_ID, ALICE, "member", NOW); // never "owner".
    membershipAuthority.admit(DIRECT_ID, BOB, "member", NOW);
    expect(await coordinator.reactivateRestoredConversation(DIRECT_ID)).toEqual({ outcome: "creator-unresolvable" });
  });

  it("7. invalid-restored-state -- an existing but structurally corrupt Draft record fails closed rather than being silently re-derived over", async () => {
    const { coordinator, draftPersistence, membershipAuthority } = buildGraph();
    membershipAuthority.admit(DIRECT_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(DIRECT_ID, BOB, "member", NOW);
    draftPersistence.putDraft({
      schemaVersion: 1,
      id: DIRECT_ID,
      mode: "direct",
      lifecycleState: "not-a-real-lifecycle-state", // corrupt -- deserializer rejects this.
      policyReference: "direct-draft-v1",
      creatorAuthority: ALICE.authority,
      creatorPublicIdentifier: ALICE.publicIdentifier,
      creatorIdentityId: null,
      createdAt: NOW,
    });
    expect(await coordinator.reactivateRestoredConversation(DIRECT_ID)).toEqual({ outcome: "invalid-restored-state" });
  });

  it("8. an already-present, VALID Draft is trusted and never rewritten -- reactivation still proceeds to activation", async () => {
    const { coordinator, draftPersistence, membershipAuthority, activationPersistence } = buildGraph();
    membershipAuthority.admit(DIRECT_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(DIRECT_ID, BOB, "member", NOW);
    draftPersistence.putDraft({
      schemaVersion: 1,
      id: DIRECT_ID,
      mode: "direct",
      lifecycleState: "draft",
      policyReference: "direct-draft-v1",
      creatorAuthority: ALICE.authority,
      creatorPublicIdentifier: ALICE.publicIdentifier,
      creatorIdentityId: null,
      createdAt: NOW,
    });
    const result = await coordinator.reactivateRestoredConversation(DIRECT_ID);
    expect(result).toEqual({ outcome: "reactivated", mode: "direct" });
    expect(activationPersistence.getActivation(fedosConversationActivationId(DIRECT_ID))?.phase).toBe("completed");
  });
});

const GROUP_ID = toFedosPrivateConversationId("private-group", "reactivation-2041-group") as FedosConversationId;

/** Seeds a Group's own restored state (Generation + Path facts + Membership, EXACTLY what an archive restore leaves behind, no Draft/Activation) for a 3-member group (Alice/Bob/Carol) with two pairwise children (Alice<->Bob, Alice<->Carol). */
function seedRestoredGroup(graph: ReturnType<typeof buildGraph>): { readonly aliceBobId: FedosConversationId; readonly aliceCarolId: FedosConversationId } {
  graph.membershipAuthority.admit(GROUP_ID, ALICE, "owner", NOW);
  graph.membershipAuthority.admit(GROUP_ID, BOB, "member", NOW);
  graph.membershipAuthority.admit(GROUP_ID, CAROL, "member", NOW);

  const generationId = toFedosGroupGenerationId(GROUP_ID, 0);
  const aliceMembershipId = toFedosConversationMembershipId(GROUP_ID, ALICE) as string;
  const bobMembershipId = toFedosConversationMembershipId(GROUP_ID, BOB) as string;
  const carolMembershipId = toFedosConversationMembershipId(GROUP_ID, CAROL) as string;
  const generation = validateFedosGroupGenerationRecord({
    groupConversationId: GROUP_ID,
    generationId,
    generationNumber: 0,
    activeMemberMembershipIds: [aliceMembershipId, bobMembershipId, carolMembershipId].sort(),
    createdAt: NOW,
    previousGenerationId: null,
  });
  if (generation === null) throw new Error("test setup: generation failed to validate");
  graph.groupGenerationPersistence.putGeneration(generation);

  const aliceBobId = toFedosPrivateConversationId("direct", "reactivation-2041-group-pair-alice-bob") as FedosConversationId;
  const aliceCarolId = toFedosPrivateConversationId("direct", "reactivation-2041-group-pair-alice-carol") as FedosConversationId;

  const pathAB: FedosGroupDirectPathRecord = {
    pathId: toFedosGroupDirectPathId(GROUP_ID, generationId, aliceMembershipId, bobMembershipId),
    groupConversationId: GROUP_ID,
    generationId,
    senderMembershipId: aliceMembershipId,
    recipientMembershipId: bobMembershipId,
    directConversationId: aliceBobId,
    state: "ready",
    createdAt: NOW,
    updatedAt: NOW,
  };
  const pathAC: FedosGroupDirectPathRecord = {
    pathId: toFedosGroupDirectPathId(GROUP_ID, generationId, aliceMembershipId, carolMembershipId),
    groupConversationId: GROUP_ID,
    generationId,
    senderMembershipId: aliceMembershipId,
    recipientMembershipId: carolMembershipId,
    directConversationId: aliceCarolId,
    state: "ready",
    createdAt: NOW,
    updatedAt: NOW,
  };
  graph.groupDirectPathPersistence.putPathFact(pathAB);
  graph.groupDirectPathPersistence.putPathFact(pathAC);

  // Each child's own restored Membership (recursively restored by the archive, per Alpha 1921-1980).
  graph.membershipAuthority.admit(aliceBobId, ALICE, "owner", NOW);
  graph.membershipAuthority.admit(aliceBobId, BOB, "member", NOW);
  graph.membershipAuthority.admit(aliceCarolId, ALICE, "owner", NOW);
  graph.membershipAuthority.admit(aliceCarolId, CAROL, "member", NOW);

  return { aliceBobId, aliceCarolId };
}

describe("Alpha 2041-2120 -- FedosConversationReactivationCoordinator (private-group)", () => {
  it("1. reactivates a restored Group's own Draft AND every distinct pairwise child it references", async () => {
    const graph = buildGraph();
    const { aliceBobId, aliceCarolId } = seedRestoredGroup(graph);

    const result = await graph.coordinator.reactivateRestoredConversation(GROUP_ID);
    expect(result.outcome).toBe("reactivated");
    if (result.outcome !== "reactivated" || result.mode !== "private-group") throw new Error("expected private-group reactivation");
    expect(result.children.size).toBe(2);
    expect(result.children.get(aliceBobId)).toBe("reactivated");
    expect(result.children.get(aliceCarolId)).toBe("reactivated");

    expect(graph.draftPersistence.getDraft(GROUP_ID)?.mode).toBe("private-group");
    expect(graph.draftPersistence.getDraft(aliceBobId)?.mode).toBe("direct");
    expect(graph.draftPersistence.getDraft(aliceCarolId)?.mode).toBe("direct");
    expect(graph.activationPersistence.getActivation(fedosConversationActivationId(aliceBobId))?.phase).toBe("completed");
    expect(graph.activationPersistence.getActivation(fedosConversationActivationId(aliceCarolId))?.phase).toBe("completed");
    // The Group id ITSELF is never "activated" (Alpha 1123's own frozen gate) -- no Activation fact for it.
    expect(graph.activationPersistence.getActivation(fedosConversationActivationId(GROUP_ID))).toBeNull();
  });

  it("2. idempotent -- a second call over the same restored Group reports already-active per child, nothing duplicated", async () => {
    const graph = buildGraph();
    const { aliceBobId, aliceCarolId } = seedRestoredGroup(graph);
    await graph.coordinator.reactivateRestoredConversation(GROUP_ID);

    const second = await graph.coordinator.reactivateRestoredConversation(GROUP_ID);
    expect(second.outcome).toBe("reactivated");
    if (second.outcome !== "reactivated" || second.mode !== "private-group") throw new Error("expected private-group reactivation");
    expect(second.children.get(aliceBobId)).toBe("already-active");
    expect(second.children.get(aliceCarolId)).toBe("already-active");
    expect(graph.draftPersistence.listDrafts().length).toBe(3); // group + 2 children, never duplicated.
  });

  it("3. a child the local identity is no longer an active member of is skipped, never forced -- other children still reactivate", async () => {
    const graph = buildGraph();
    const { aliceBobId, aliceCarolId } = seedRestoredGroup(graph);
    // Simulate Alice having left/been removed from the Alice<->Bob pairwise child specifically
    // (independent of her own still-active Group Membership) -- a real, restorable state.
    graph.membershipAuthority.revoke(aliceBobId, ALICE, NOW + 1);

    const result = await graph.coordinator.reactivateRestoredConversation(GROUP_ID);
    expect(result.outcome).toBe("reactivated");
    if (result.outcome !== "reactivated" || result.mode !== "private-group") throw new Error("expected private-group reactivation");
    expect(result.children.get(aliceBobId)).toBe("not-member");
    expect(result.children.get(aliceCarolId)).toBe("reactivated");
    expect(graph.draftPersistence.getDraft(aliceBobId)).toBeNull(); // never touched.
  });

  it("4. unauthorized at the group level -- a caller who never held Group Membership cannot reactivate it or its children", async () => {
    const graph = buildGraph({ localParticipant: CAROL });
    seedRestoredGroup(graph);
    // Remove Carol's own restored Group Membership entirely for this scenario (only Alice/Bob remain valid members).
    graph.membershipAuthority.revoke(GROUP_ID, CAROL, NOW + 1);
    const result = await graph.coordinator.reactivateRestoredConversation(GROUP_ID);
    expect(result).toEqual({ outcome: "unauthorized" });
    expect(graph.draftPersistence.getDraft(GROUP_ID)).toBeNull();
  });
});
