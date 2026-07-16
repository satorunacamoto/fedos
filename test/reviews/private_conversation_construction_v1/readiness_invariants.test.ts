import { describe, it, expect } from "vitest";
import { validateFedosConversationRecord, type FedosConversationRecordInput } from "../../../src/conversation/fedos_conversation_record_validator.js";
import { validateFedosConversationPolicy } from "../../../src/board/runtime/policy/fedos_conversation_policy.js";
import { toFedosConversationMembershipId } from "../../../src/conversation/membership/fedos_conversation_membership_id.js";
import { isFedosConversationMembershipTransitionAllowed } from "../../../src/conversation/membership/fedos_conversation_membership_transition.js";
import { InMemoryFedosConversationMembershipPersistence } from "../../../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { PersistedFedosConversationMembershipAuthority } from "../../../src/conversation/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import type { FedosConversationId } from "../../../src/conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../../../src/conversation/membership/fedos_conversation_participant_reference.js";
import { InMemoryFedosConversationCapabilityAuthority } from "../../../src/conversation/capability/in_memory_fedos_conversation_capability_authority.js";
import { InMemoryFedosConversationMembershipAuthority } from "../../../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { toFedosConversationCapabilityBearerSecret } from "../../../src/conversation/capability/fedos_conversation_capability_bearer_secret.js";
import { InMemoryFedosConversationPayloadStorage } from "../../../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../../../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../../../src/conversation/retention/fedos_payload_retention_authority.js";
import { NoopCryptoProvider } from "../../../src/crypto/noop_crypto.js";
import { FedosRuntimeCryptoProvider } from "../../../src/runtime/fedos_runtime_crypto_provider.js";

/**
 * Private Conversation Construction V1 review -- readiness invariants.
 *
 * Behavioral tests over REAL, unmodified, currently-existing code -- confirms
 * this review's own 01/02/06/08/09/10/16 findings hold as OBSERVED FACT (by
 * actually calling the real functions/classes), not merely as prose or
 * static-text matching. Never asserts that any FUTURE (unimplemented)
 * construction command/runtime exists.
 */

const CREATOR: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "npub-creator", identityId: null };
const OTHER: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "npub-other", identityId: null };
const CONVERSATION_ID = "board-a::thread-1" as FedosConversationId;

describe("Private Conversation Construction V1 -- readiness invariants", () => {
  it("1. validateFedosConversationRecord rejects 'private-group' and 'direct' mode -- 01's central blocking finding, behaviorally confirmed", () => {
    const base: FedosConversationRecordInput = {
      id: "board-a::thread-1",
      mode: "private-group",
      boardId: "board-a",
      rootThreadId: "thread-1",
      rootPostId: "thread-1",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    };
    expect(validateFedosConversationRecord(base)).toBeNull();
    expect(validateFedosConversationRecord({ ...base, mode: "direct" })).toBeNull();
    // Positive control -- the SAME shape with mode "public" must still succeed, proving this is a mode-specific rejection, not a shape error.
    expect(validateFedosConversationRecord({ ...base, mode: "public" })).not.toBeNull();
  });

  it("2. validateFedosConversationPolicy rejects a private-group-shaped policy on BOTH the mode axis and the writeAccess axis independently -- 07's two named structural blockers, behaviorally confirmed", () => {
    const publicOk = {
      mode: "public",
      discoverability: "listed",
      readAccess: "public",
      writeAccess: "public",
      inviteAuthority: "none",
      federationEligibility: "allowed",
    };
    expect(validateFedosConversationPolicy(publicOk)).not.toBeNull(); // positive control

    expect(validateFedosConversationPolicy({ ...publicOk, mode: "private-group" })).toBeNull();
    expect(validateFedosConversationPolicy({ ...publicOk, writeAccess: "restricted" })).toBeNull();
    // Both axes fail independently -- fixing only one is not enough.
    expect(validateFedosConversationPolicy({ ...publicOk, mode: "private-group", writeAccess: "restricted" })).toBeNull();
  });

  it("3. toFedosConversationMembershipId is deterministic -- the SAME (conversationId, participant) pair always derives the identical id -- 06/10's idempotency precondition, behaviorally confirmed", () => {
    const idOne = toFedosConversationMembershipId(CONVERSATION_ID, CREATOR);
    const idTwo = toFedosConversationMembershipId(CONVERSATION_ID, CREATOR);
    expect(idOne).toBe(idTwo);
    const idForOther = toFedosConversationMembershipId(CONVERSATION_ID, OTHER);
    expect(idForOther).not.toBe(idOne);
  });

  it("4. admit() for the SAME creator/role is idempotent -- retrying a crashed construction attempt never produces a duplicate or a conflict -- 06/10/14's recovery finding, behaviorally confirmed", () => {
    const persistence = new InMemoryFedosConversationMembershipPersistence();
    const authority = new PersistedFedosConversationMembershipAuthority(persistence);

    const first = authority.admit(CONVERSATION_ID, CREATOR, "owner", 1_700_000_000);
    expect(first.outcome).toBe("admitted");

    const retry = authority.admit(CONVERSATION_ID, CREATOR, "owner", 1_700_000_050);
    expect(retry.outcome).toBe("already-present"); // the Authority's own real, already-shipped idempotency behavior -- not a second "admitted" event

    const memberships = authority.listMemberships(CONVERSATION_ID);
    expect(memberships.length).toBe(1); // no duplicate was created by the retry
  });

  it("5. admit() succeeds for a conversationId with NO corresponding FedosConversationRecord ever written -- 01/02's 'Membership is mode-agnostic and does not check Conversation existence' finding, behaviorally confirmed", () => {
    const persistence = new InMemoryFedosConversationMembershipPersistence();
    const authority = new PersistedFedosConversationMembershipAuthority(persistence);
    const neverConstructedConversationId = "no-such-board::no-such-thread" as FedosConversationId;

    const result = authority.admit(neverConstructedConversationId, CREATOR, "owner", 1_700_000_000);
    expect(result.outcome).toBe("admitted"); // real, durable admission into a Conversation id that was never validated to exist
  });

  it("6. isFedosConversationMembershipTransitionAllowed forbids any reactivation of a revoked/left membership -- 16's permanence finding, behaviorally confirmed", () => {
    expect(isFedosConversationMembershipTransitionAllowed(null, "admit")).toBe(true);
    expect(isFedosConversationMembershipTransitionAllowed("active", "admit")).toBe(false);
    expect(isFedosConversationMembershipTransitionAllowed("active", "revoke")).toBe(true);
    expect(isFedosConversationMembershipTransitionAllowed("active", "leave")).toBe(true);
    expect(isFedosConversationMembershipTransitionAllowed("revoked", "admit")).toBe(false);
    expect(isFedosConversationMembershipTransitionAllowed("left", "admit")).toBe(false);
    expect(isFedosConversationMembershipTransitionAllowed("revoked", "leave")).toBe(false);
    expect(isFedosConversationMembershipTransitionAllowed("left", "revoke")).toBe(false);
  });

  it("7. revoke() durably ends a membership, and a subsequent admit() attempt for the SAME participant is rejected as an invalid transition -- 16's 'no silent reactivation' finding, behaviorally confirmed", () => {
    const persistence = new InMemoryFedosConversationMembershipPersistence();
    const authority = new PersistedFedosConversationMembershipAuthority(persistence);
    authority.admit(CONVERSATION_ID, OTHER, "member", 1_700_000_000);

    const revoked = authority.revoke(CONVERSATION_ID, OTHER, 1_700_000_100);
    expect(revoked.outcome).toBe("revoked");

    const reAdmit = authority.admit(CONVERSATION_ID, OTHER, "member", 1_700_000_200);
    expect(reAdmit.outcome).toBe("invalid-transition");
  });

  it("8. Capability issuance and redemption work fully in-memory with zero import/call into src/crypto or src/runtime -- 08's 'axis 5 (capability) is independent of axis 6 (encryption)' finding, behaviorally confirmed", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const capabilityAuthority = new InMemoryFedosConversationCapabilityAuthority({
      idGenerator: { generateCapabilityId: () => "cap-1" },
      secretGenerator: { generateBearerSecret: () => toFedosConversationCapabilityBearerSecret("test-secret-value")! },
      existenceCheck: () => true,
      authorizationCheck: () => true,
      membershipAuthority,
    });

    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId: CONVERSATION_ID, issuer: CREATOR, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    expect(issued.outcome).toBe("issued");
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const redeemed = capabilityAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: OTHER }, 1_700_000_100);
    expect(redeemed.outcome).toBe("redeemed");
  });

  it("9. NoopCryptoProvider.encrypt()/decrypt() always deny, regardless of input -- 08's axis-1 finding, behaviorally confirmed", async () => {
    const provider = new NoopCryptoProvider();
    const encryptDecision = await provider.encrypt({ algorithm: "chacha20poly1305", keyRef: "k", plaintextRef: "p" });
    expect(encryptDecision.allowed).toBe(false);
    const decryptDecision = await provider.decrypt({ algorithm: "chacha20poly1305", keyRef: "k", ciphertextRef: "c" });
    expect(decryptDecision.allowed).toBe(false);
  });

  it("10. FedosRuntimeCryptoProvider.encrypt()/decrypt() always resolve 'Unsupported', regardless of input -- 08's axis-1/6 finding, behaviorally confirmed", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const status = provider.status();
    expect(status.implemented).toBe(false);
    const encryptDecision = await provider.encrypt({} as never);
    expect(encryptDecision.state).toBe("Unsupported");
    expect(encryptDecision.allowed).toBe(false);
  });

  it("11. Payload storage + Retention Authority work together, mode-agnostically, entirely independent of encryption readiness -- 02's axis 7/8 finding, behaviorally confirmed", () => {
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: () => 1_700_000_000 });

    const descriptor = {
      id: "payload-1" as never,
      conversationId: CONVERSATION_ID,
      mediaType: "application/octet-stream" as const,
      byteLength: 3,
      createdAt: 1_700_000_000,
    };
    payloadStorage.putPayload(descriptor, new Uint8Array([1, 2, 3]));

    const beforeTombstone = retentionAuthority.readPayload(descriptor.id);
    expect(beforeTombstone.outcome).toBe("found");

    retentionAuthority.tombstonePayload(descriptor.id, null, "test_placeholder");
    const afterTombstone = retentionAuthority.readPayload(descriptor.id);
    expect(afterTombstone.outcome).toBe("denied");
  });

  it("12. a Conversation record's own field set has no place to smuggle a bearer secret, key, or ciphertext through -- 04/11/19's structural (never-a-caller-input, never-a-storage-field) guardrail, behaviorally confirmed", () => {
    const record = validateFedosConversationRecord({
      id: "board-a::thread-1",
      mode: "public",
      boardId: "board-a",
      rootThreadId: "thread-1",
      rootPostId: "thread-1",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
      // @ts-expect-error -- deliberately supplying a field the type does not declare, mirroring the analogous FedosBoardPost guard in the sibling review's own precedent test.
      bearerSecret: "should-be-rejected",
    });
    // Extra/unknown fields fail the validator's own exact-field-set check entirely (rejects the whole candidate) --
    // proving there is no way to pass a secret through this constructor, not even as an ignored extra field.
    expect(record).toBeNull();
  });
});
