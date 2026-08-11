import { describe, it, expect, beforeEach, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { validateFedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference_validator.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { toFedosConversationCapabilityBearerSecret, type FedosConversationCapabilityBearerSecret } from "../src/os/messenger/conversations/capability/fedos_conversation_capability_bearer_secret.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import { PersistedFedosConversationCapabilityAuthority } from "../src/os/messenger/conversations/capability/persistence/persisted_fedos_conversation_capability_authority.js";
import type { FedosConversationCapabilityIdGenerator } from "../src/os/messenger/conversations/capability/in_memory_fedos_conversation_capability_authority.js";
import type { FedosConversationCapabilitySecretGenerator } from "../src/os/messenger/conversations/capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/fedos_conversation_membership_persistence.js";
import {
  fedosConversationRedemptionCoordinationId,
  type FedosPersistedConversationRedemptionCoordinationV1,
} from "../src/os/messenger/conversations/capability/coordination/fedos_persisted_conversation_redemption_coordination_v1.js";
import { InMemoryFedosConversationRedemptionCoordinationPersistence } from "../src/os/messenger/conversations/capability/coordination/in_memory_fedos_conversation_redemption_coordination_persistence.js";
import { AppendOnlyFedosConversationRedemptionCoordinationPersistence } from "../src/os/messenger/conversations/capability/coordination/append_only_fedos_conversation_redemption_coordination_persistence.js";
import { FedosConversationDurableRedemptionCoordinator } from "../src/os/messenger/conversations/capability/coordination/fedos_conversation_durable_redemption_coordinator.js";
import type { FedosConversationRedemptionCoordinationPersistence } from "../src/os/messenger/conversations/capability/coordination/fedos_conversation_redemption_coordination_persistence.js";

const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-a")!);
const alice = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1alice", identityId: null })!;
const bob = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1bob", identityId: null })!;
const carol = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1carol", identityId: null })!;

let capabilityCounter = 0;
function sequentialIdGenerator(): FedosConversationCapabilityIdGenerator {
  return { generateCapabilityId: () => `capability-${(capabilityCounter += 1)}` };
}
function fixedSecretGenerator(secret: string): FedosConversationCapabilitySecretGenerator {
  return { generateBearerSecret: () => toFedosConversationCapabilityBearerSecret(secret)! };
}
const alwaysExists = () => true;
const alwaysAuthorized = () => true;

/** One coherent durable backend set: Capability + Membership + Coordination, all backed by real files. */
interface BackendSet {
  readonly capabilityFilePath: string;
  readonly membershipFilePath: string;
  readonly coordinationFilePath: string;
  freshCoordinator(): FedosConversationDurableRedemptionCoordinator;
  freshCapabilityAuthority(secret: string): PersistedFedosConversationCapabilityAuthority;
  freshMembershipAuthority(): PersistedFedosConversationMembershipAuthority;
  capabilityPersistence(): FedosConversationCapabilityPersistence;
  coordinationPersistence(): FedosConversationRedemptionCoordinationPersistence;
  membershipPersistence(): FedosConversationMembershipPersistence;
}

function makeBackendSet(tmpDir: string, suffix: string): BackendSet {
  const capabilityFilePath = join(tmpDir, `capability-${suffix}.ndjson`);
  const membershipFilePath = join(tmpDir, `membership-${suffix}.ndjson`);
  const coordinationFilePath = join(tmpDir, `coordination-${suffix}.ndjson`);
  return {
    capabilityFilePath,
    membershipFilePath,
    coordinationFilePath,
    capabilityPersistence: () => new AppendOnlyFedosConversationCapabilityPersistence(capabilityFilePath),
    coordinationPersistence: () => new AppendOnlyFedosConversationRedemptionCoordinationPersistence(coordinationFilePath),
    membershipPersistence: () => new AppendOnlyFedosConversationMembershipPersistence(membershipFilePath),
    freshMembershipAuthority(): PersistedFedosConversationMembershipAuthority {
      return new PersistedFedosConversationMembershipAuthority(this.membershipPersistence());
    },
    freshCapabilityAuthority(secret: string): PersistedFedosConversationCapabilityAuthority {
      return new PersistedFedosConversationCapabilityAuthority({
        persistence: this.capabilityPersistence(),
        idGenerator: sequentialIdGenerator(),
        secretGenerator: fixedSecretGenerator(secret),
        existenceCheck: alwaysExists,
        authorizationCheck: alwaysAuthorized,
        membershipAuthority: this.freshMembershipAuthority(),
      });
    },
    freshCoordinator(): FedosConversationDurableRedemptionCoordinator {
      return new FedosConversationDurableRedemptionCoordinator({
        capabilityPersistence: this.capabilityPersistence(),
        coordinationPersistence: this.coordinationPersistence(),
        membershipAuthority: this.freshMembershipAuthority(),
      });
    },
  };
}

let tmpDir: string;
beforeEach(() => {
  capabilityCounter = 0;
  tmpDir = mkdtempSync(join(tmpdir(), "fedos-redemption-coordination-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("Secure Runtime Alpha 843-844 -- Coordination Record and Persistence", () => {
  it("1. coordinationId is deterministic for (capabilityId, redeemer)", () => {
    const a = fedosConversationRedemptionCoordinationId("cap-1", "nostr", "npub1bob");
    const b = fedosConversationRedemptionCoordinationId("cap-1", "nostr", "npub1bob");
    expect(a).toBe(b);
    expect(fedosConversationRedemptionCoordinationId("cap-1", "nostr", "npub1carol")).not.toBe(a);
  });

  function runCoordinationPersistenceContract(name: string, make: () => FedosConversationRedemptionCoordinationPersistence) {
    describe(`contract (${name})`, () => {
      it("resolves the CURRENT (furthest-progressed) phase, restart-stable", () => {
        const persistence = make();
        const coordinationId = fedosConversationRedemptionCoordinationId("cap-1", "nostr", "npub1bob");
        const base: Omit<FedosPersistedConversationRedemptionCoordinationV1, "phase" | "updatedAt"> = {
          schemaVersion: 1,
          coordinationId,
          capabilityId: "cap-1",
          conversationId: "conv-1",
          redeemerAuthority: "nostr",
          redeemerPublicIdentifier: "npub1bob",
          redeemerIdentityId: null,
          startedAt: 1_700_000_000,
        };
        expect(persistence.putCoordinationFact({ ...base, phase: "prepared", updatedAt: 1_700_000_000 })).toBe("inserted");
        expect(persistence.getCoordination(coordinationId)?.phase).toBe("prepared");
        expect(persistence.putCoordinationFact({ ...base, phase: "capability-consumed", updatedAt: 1_700_000_010 })).toBe("inserted");
        expect(persistence.getCoordination(coordinationId)?.phase).toBe("capability-consumed");
        expect(persistence.putCoordinationFact({ ...base, phase: "membership-admitted", updatedAt: 1_700_000_020 })).toBe("inserted");
        expect(persistence.putCoordinationFact({ ...base, phase: "completed", updatedAt: 1_700_000_030 })).toBe("inserted");
        expect(persistence.getCoordination(coordinationId)?.phase).toBe("completed");
      });

      it("re-writing the identical fact is idempotent; a genuinely different fact at the same key conflicts", () => {
        const persistence = make();
        const record: FedosPersistedConversationRedemptionCoordinationV1 = {
          schemaVersion: 1,
          coordinationId: "coord-1",
          capabilityId: "cap-1",
          conversationId: "conv-1",
          redeemerAuthority: "nostr",
          redeemerPublicIdentifier: "npub1bob",
          redeemerIdentityId: null,
          phase: "prepared",
          startedAt: 1_700_000_000,
          updatedAt: 1_700_000_000,
        };
        expect(persistence.putCoordinationFact(record)).toBe("inserted");
        expect(persistence.putCoordinationFact(record)).toBe("already-present");
        expect(persistence.putCoordinationFact({ ...record, updatedAt: 1_700_000_999 })).toBe("conflict");
      });

      it("unknown coordination id resolves to null", () => {
        expect(make().getCoordination("does-not-exist")).toBeNull();
      });
    });
  }

  runCoordinationPersistenceContract("in-memory", () => new InMemoryFedosConversationRedemptionCoordinationPersistence());
  runCoordinationPersistenceContract("append-only", () => new AppendOnlyFedosConversationRedemptionCoordinationPersistence(join(tmpDir, "coord.ndjson")));

  it("append-only backend fails closed on a malformed log line", () => {
    const filePath = join(tmpDir, "corrupt-coord.ndjson");
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosConversationRedemptionCoordinationPersistence(filePath);
    expect(() => persistence.getCoordination("anything")).toThrow();
  });
});

describe("Secure Runtime Alpha 845 -- Durable Redemption Coordinator, happy path", () => {
  it("redeemAndAdmit -- issues, redeems, and admits Membership in one call, restart-stable", () => {
    const backends = makeBackendSet(tmpDir, "happy");
    const issuer = backends.freshCapabilityAuthority("secret-1");
    const issued = issuer.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const coordinator = backends.freshCoordinator();
    const result = coordinator.redeemAndAdmit(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob },
      1_700_000_100,
    );
    expect(result.outcome).toBe("redeemed");
    if (result.outcome !== "redeemed") throw new Error("unreachable");
    expect(result.membership.state).toBe("active");
    expect(result.membership.participant).toEqual(bob);

    const freshMembership = backends.freshMembershipAuthority();
    expect(freshMembership.findMembership(conversationId, bob)?.state).toBe("active");
  });
});

describe("Secure Runtime Alpha 846 -- Crash-Window Recovery", () => {
  function issueOne(backends: BackendSet, secret: string, maxUses = 1) {
    const issuer = backends.freshCapabilityAuthority(secret);
    const issued = issuer.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");
    return issued;
  }

  it("1. crash BEFORE any coordination fact -- a fresh coordinator runs the whole flow from scratch", () => {
    const backends = makeBackendSet(tmpDir, "before-prepared");
    const issued = issueOne(backends, "s1");
    const result = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100);
    expect(result.outcome).toBe("redeemed");
  });

  it("2. crash AFTER \"prepared\", BEFORE Capability consumption -- recovery re-validates and completes fresh", () => {
    const backends = makeBackendSet(tmpDir, "after-prepared");
    const issued = issueOne(backends, "s2");
    const coordinationId = fedosConversationRedemptionCoordinationId(issued.descriptor.capabilityId, bob.authority, bob.publicIdentifier);
    backends.coordinationPersistence().putCoordinationFact({
      schemaVersion: 1,
      coordinationId,
      capabilityId: issued.descriptor.capabilityId,
      conversationId,
      redeemerAuthority: bob.authority,
      redeemerPublicIdentifier: bob.publicIdentifier,
      redeemerIdentityId: bob.identityId,
      phase: "prepared",
      startedAt: 1_700_000_050,
      updatedAt: 1_700_000_050,
    });
    // Capability NOT yet consumed -- no redeemed event written.
    expect(backends.capabilityPersistence().hasRedeemedEvent(issued.descriptor.capabilityId, bob.authority, bob.publicIdentifier)).toBe(false);

    const result = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100);
    expect(result.outcome).toBe("redeemed");
    expect(backends.coordinationPersistence().getCoordination(coordinationId)?.phase).toBe("completed");
  });

  it("3. crash AFTER Capability consumption, BEFORE Membership admission -- recovery never re-validates, only moves forward", () => {
    const backends = makeBackendSet(tmpDir, "after-consumed");
    const issued = issueOne(backends, "s3");
    const coordinationId = fedosConversationRedemptionCoordinationId(issued.descriptor.capabilityId, bob.authority, bob.publicIdentifier);

    // Simulate exactly what step 5 leaves behind: Capability consumed durably...
    const capabilityPersistence = backends.capabilityPersistence();
    const record = capabilityPersistence.getCapability(issued.descriptor.capabilityId)!;
    capabilityPersistence.putEvent({
      schemaVersion: 1,
      eventType: "redeemed",
      capabilityId: record.capabilityId,
      redeemerAuthority: bob.authority,
      redeemerPublicIdentifier: bob.publicIdentifier,
      redeemerIdentityId: bob.identityId,
      redeemedAt: 1_700_000_100,
    });
    // ...and coordination phase persisted as "capability-consumed" -- Membership NOT yet admitted.
    backends.coordinationPersistence().putCoordinationFact({
      schemaVersion: 1,
      coordinationId,
      capabilityId: record.capabilityId,
      conversationId,
      redeemerAuthority: bob.authority,
      redeemerPublicIdentifier: bob.publicIdentifier,
      redeemerIdentityId: bob.identityId,
      phase: "capability-consumed",
      startedAt: 1_700_000_050,
      updatedAt: 1_700_000_100,
    });
    expect(backends.freshMembershipAuthority().findMembership(conversationId, bob)).toBeNull();

    const result = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_200);
    expect(result.outcome).toBe("redeemed");
    expect(backends.freshMembershipAuthority().findMembership(conversationId, bob)?.state).toBe("active");
    expect(backends.coordinationPersistence().getCoordination(coordinationId)?.phase).toBe("completed");
    // The capability is NOT re-consumed a second time -- exactly one redeemed event for bob.
    expect(capabilityPersistence.getCapability(record.capabilityId)?.currentUses).toBe(1);
  });

  it("4. crash AFTER Membership admission, BEFORE the completion marker -- recovery recognizes admission idempotently, no duplicate active Membership", () => {
    const backends = makeBackendSet(tmpDir, "after-admitted");
    const issued = issueOne(backends, "s4");
    const coordinationId = fedosConversationRedemptionCoordinationId(issued.descriptor.capabilityId, bob.authority, bob.publicIdentifier);

    const capabilityPersistence = backends.capabilityPersistence();
    const record = capabilityPersistence.getCapability(issued.descriptor.capabilityId)!;
    capabilityPersistence.putEvent({
      schemaVersion: 1,
      eventType: "redeemed",
      capabilityId: record.capabilityId,
      redeemerAuthority: bob.authority,
      redeemerPublicIdentifier: bob.publicIdentifier,
      redeemerIdentityId: bob.identityId,
      redeemedAt: 1_700_000_100,
    });
    backends.freshMembershipAuthority().admit(conversationId, bob, "member", 1_700_000_100);
    backends.coordinationPersistence().putCoordinationFact({
      schemaVersion: 1,
      coordinationId,
      capabilityId: record.capabilityId,
      conversationId,
      redeemerAuthority: bob.authority,
      redeemerPublicIdentifier: bob.publicIdentifier,
      redeemerIdentityId: bob.identityId,
      phase: "membership-admitted",
      startedAt: 1_700_000_050,
      updatedAt: 1_700_000_100,
    });

    const result = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_200);
    expect(result.outcome).toBe("redeemed");
    expect(backends.coordinationPersistence().getCoordination(coordinationId)?.phase).toBe("completed");
    expect(backends.freshMembershipAuthority().listMemberships(conversationId)).toHaveLength(1);
  });

  it("5. already \"completed\" -- a repeat call is a pure idempotent read, no further mutation", () => {
    const backends = makeBackendSet(tmpDir, "already-completed");
    const issued = issueOne(backends, "s5");
    const first = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100);
    expect(first.outcome).toBe("redeemed");

    const second = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_999);
    expect(second).toEqual(first);
    expect(backends.capabilityPersistence().getCapability(issued.descriptor.capabilityId)?.currentUses).toBe(1);
  });

  it("6. a \"terminal-failed\" fact with nothing consumed is safe to retry fully, exactly like no fact at all", () => {
    const backends = makeBackendSet(tmpDir, "terminal-failed");
    const issued = issueOne(backends, "s6");
    const coordinationId = fedosConversationRedemptionCoordinationId(issued.descriptor.capabilityId, bob.authority, bob.publicIdentifier);
    backends.coordinationPersistence().putCoordinationFact({
      schemaVersion: 1,
      coordinationId,
      capabilityId: issued.descriptor.capabilityId,
      conversationId,
      redeemerAuthority: bob.authority,
      redeemerPublicIdentifier: bob.publicIdentifier,
      redeemerIdentityId: bob.identityId,
      phase: "terminal-failed",
      startedAt: 1_700_000_050,
      updatedAt: 1_700_000_060,
    });

    const result = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_200);
    expect(result.outcome).toBe("redeemed");
  });

  it("7. corrupted coordination state fails closed rather than guessing", () => {
    const filePath = join(tmpDir, "corrupt-coordination.ndjson");
    writeFileSync(filePath, "{ not json\n", "utf8");
    const persistence = new AppendOnlyFedosConversationRedemptionCoordinationPersistence(filePath);
    expect(() => persistence.getCoordination("anything")).toThrow();
  });
});

describe("Secure Runtime Alpha 847 -- Exactly-Once Contract", () => {
  it("a maxUses:1 capability redeemed by the SAME redeemer across many retries never admits a duplicate or re-consumes", () => {
    const backends = makeBackendSet(tmpDir, "exactly-once-same-redeemer");
    const issued = (() => {
      const issuer = backends.freshCapabilityAuthority("s7");
      const result = issuer.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
        1_700_000_000,
      );
      if (result.outcome !== "issued") throw new Error("unreachable");
      return result;
    })();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = backends
        .freshCoordinator()
        .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100 + attempt);
      expect(result.outcome).toBe("redeemed");
    }

    expect(backends.capabilityPersistence().getCapability(issued.descriptor.capabilityId)?.currentUses).toBe(1);
    expect(backends.freshMembershipAuthority().listMemberships(conversationId)).toHaveLength(1);
  });

  it("a maxUses:1 capability is never redeemed by a SECOND distinct redeemer, even via a fresh coordinator", () => {
    const backends = makeBackendSet(tmpDir, "exactly-once-distinct-redeemers");
    const issuer = backends.freshCapabilityAuthority("s8");
    const issued = issuer.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const first = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100);
    expect(first.outcome).toBe("redeemed");

    const second = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: carol }, 1_700_000_200);
    expect(second).toEqual({ outcome: "exhausted" });
    expect(backends.freshMembershipAuthority().listMemberships(conversationId)).toHaveLength(1);
  });

  it("this guarantee holds only within one durable backend set -- a second, independent backend set knows nothing of the first", () => {
    const backendsA = makeBackendSet(tmpDir, "isolated-a");
    const backendsB = makeBackendSet(tmpDir, "isolated-b");
    const issued = (() => {
      const issuer = backendsA.freshCapabilityAuthority("s9");
      const result = issuer.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
        1_700_000_000,
      );
      if (result.outcome !== "issued") throw new Error("unreachable");
      return result;
    })();
    backendsA.freshCoordinator().redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100);

    expect(backendsB.capabilityPersistence().getCapability(issued.descriptor.capabilityId)).toBeNull();
    expect(backendsB.freshMembershipAuthority().findMembership(conversationId, bob)).toBeNull();
  });
});

describe("Secure Runtime Alpha 849 -- End-to-End Durable Verification", () => {
  it("real filesystem-backed path: issue, redeem, restart, duplicate-reject, revoke, restart, revocation preserved", () => {
    const backends = makeBackendSet(tmpDir, "end-to-end");

    // 1-2. create a durable public Conversation fixture + durable issuer Membership.
    backends.freshMembershipAuthority().admit(conversationId, alice, "owner", 1_699_999_000);

    // 3. issue a join Capability.
    const issuer = backends.freshCapabilityAuthority("e2e-secret");
    const issued = issuer.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: bob, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    // 4. stop. 5. fresh authorities. 6. redeem capability for intended participant.
    const redemption = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100);
    // 7. Membership admitted.
    expect(redemption.outcome).toBe("redeemed");
    expect(backends.freshMembershipAuthority().findMembership(conversationId, bob)?.state).toBe("active");

    // 8. stop. 9. fresh authorities. 10. repeated redemption is rejected/idempotent.
    const repeated = backends
      .freshCoordinator()
      .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_500);
    expect(repeated).toEqual(redemption);

    // 11. revoke Membership.
    const revocation = backends.freshMembershipAuthority().revoke(conversationId, bob, 1_700_000_600);
    expect(revocation.outcome).toBe("revoked");

    // 12. restart. 13. revocation remains durable.
    expect(backends.freshMembershipAuthority().findMembership(conversationId, bob)?.state).toBe("revoked");
    // A revoked Membership can never silently resurrect via a stale Capability redemption.
    expect(
      backends
        .freshCoordinator()
        .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_700),
    ).toEqual({ outcome: "conflict" });

    // Additional required checks.
    // Wrong bearer.
    const wrongSecret = toFedosConversationCapabilityBearerSecret("nope")! as FedosConversationCapabilityBearerSecret;
    expect(
      backends
        .freshCoordinator()
        .redeemAndAdmit({ capabilityId: issued.descriptor.capabilityId, bearerSecret: wrongSecret, redeemer: carol }, 1_700_000_800),
    ).toEqual({ outcome: "invalid-capability" });

    // Recipient mismatch (capability was intended for bob only).
    const targeted = issuer.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: bob, maxUses: 1, expiresAt: null },
      1_700_001_000,
    );
    if (targeted.outcome !== "issued") throw new Error("unreachable");
    expect(
      backends
        .freshCoordinator()
        .redeemAndAdmit({ capabilityId: targeted.descriptor.capabilityId, bearerSecret: targeted.bearerSecret, redeemer: carol }, 1_700_001_100),
    ).toEqual({ outcome: "recipient-mismatch" });

    // Expiry.
    const expiring = issuer.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: 1_700_001_200 },
      1_700_001_000,
    );
    if (expiring.outcome !== "issued") throw new Error("unreachable");
    expect(
      backends
        .freshCoordinator()
        .redeemAndAdmit({ capabilityId: expiring.descriptor.capabilityId, bearerSecret: expiring.bearerSecret, redeemer: carol }, 1_700_001_300),
    ).toEqual({ outcome: "expired" });

    // Capability exhaustion.
    const single = issuer.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_001_400,
    );
    if (single.outcome !== "issued") throw new Error("unreachable");
    backends.freshCoordinator().redeemAndAdmit({ capabilityId: single.descriptor.capabilityId, bearerSecret: single.bearerSecret, redeemer: carol }, 1_700_001_500);
    const secondParticipant = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1dave", identityId: null })!;
    expect(
      backends
        .freshCoordinator()
        .redeemAndAdmit({ capabilityId: single.descriptor.capabilityId, bearerSecret: single.bearerSecret, redeemer: secondParticipant }, 1_700_001_600),
    ).toEqual({ outcome: "exhausted" });

    // Independent backend sets, no cross-contamination.
    const otherBackends = makeBackendSet(tmpDir, "end-to-end-other");
    expect(otherBackends.capabilityPersistence().getCapability(issued.descriptor.capabilityId)).toBeNull();
    expect(otherBackends.freshMembershipAuthority().findMembership(conversationId, bob)).toBeNull();
  });

});

describe("Secure Runtime Alpha 848 -- Structural Guards (Absolute Prohibitions, real filesystem scan)", () => {
  const COORDINATION_DIR = "src/conversation/capability/coordination";

  function codeOnlyLines(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
      })
      .join("\n");
  }

  function arcFiles(dir: string): string[] {
    return (readdirSync(dir) as string[])
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => join(dir, name));
  }

  it("1. this Arc actually added files under src/conversation/capability/coordination/ -- sanity check the scan below is not vacuously trivial", () => {
    expect(arcFiles(COORDINATION_DIR).length).toBeGreaterThanOrEqual(4);
  });

  it("2. no p2p/ import anywhere in the new coordination directory", () => {
    for (const file of arcFiles(COORDINATION_DIR)) {
      expect(codeOnlyLines(readFileSync(file, "utf8") as string), file).not.toMatch(/p2p\//);
    }
  });

  it("3. no private-message/encryption/invitation-transport vocabulary anywhere in the coordination directory's code (Absolute Prohibitions)", () => {
    const forbidden = [
      "PrivateMessage",
      "MessageEnvelope",
      "encrypt(",
      "decrypt(",
      "KeyEpoch",
      "invitationUrl",
      "InvitationUrl",
      "QRCode",
      "ActivityPub",
      "AtProto",
    ];
    for (const file of arcFiles(COORDINATION_DIR)) {
      const code = codeOnlyLines(readFileSync(file, "utf8") as string);
      for (const term of forbidden) {
        expect(code, `${file} unexpectedly mentions "${term}"`).not.toContain(term);
      }
    }
  });

  it("4. the coordination record type never carries a bearer secret field", () => {
    const source = readFileSync(join(COORDINATION_DIR, "fedos_persisted_conversation_redemption_coordination_v1.ts"), "utf8") as string;
    const body = codeOnlyLines(source);
    const start = body.indexOf("export interface FedosPersistedConversationRedemptionCoordinationV1");
    const end = body.indexOf("}", start);
    const interfaceBody = body.slice(start, end).toLowerCase();
    expect(interfaceBody).not.toContain("secret");
    expect(interfaceBody).not.toContain("bearer");
  });
});
