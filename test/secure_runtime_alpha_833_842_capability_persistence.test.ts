import { describe, it, expect, beforeEach, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { validateFedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference_validator.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import {
  toFedosConversationCapabilityBearerSecret,
  fedosConversationCapabilityBearerSecretsMatch,
  type FedosConversationCapabilityBearerSecret,
} from "../src/os/messenger/conversations/capability/fedos_conversation_capability_bearer_secret.js";
import {
  createFedosConversationCapabilityBearerVerifier,
  fedosConversationCapabilityBearerVerifierMatches,
} from "../src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_bearer_verifier.js";
import {
  serializeFedosConversationCapabilityIssuedEvent,
  deserializeFedosConversationCapabilityIssuedEvent,
  serializeFedosConversationCapabilityRedeemedEvent,
  deserializeFedosConversationCapabilityRedeemedEvent,
} from "../src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_codec.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import { PersistedFedosConversationCapabilityAuthority } from "../src/os/messenger/conversations/capability/persistence/persisted_fedos_conversation_capability_authority.js";
import type { FedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosConversationCapabilityIdGenerator } from "../src/os/messenger/conversations/capability/in_memory_fedos_conversation_capability_authority.js";
import type { FedosConversationCapabilitySecretGenerator } from "../src/os/messenger/conversations/capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_authority.js";

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

function makeDurableAuthority(
  persistence: FedosConversationCapabilityPersistence,
  membershipAuthority: FedosConversationMembershipAuthority,
  secret = "s3cret-bearer-value",
) {
  return new PersistedFedosConversationCapabilityAuthority({
    persistence,
    idGenerator: sequentialIdGenerator(),
    secretGenerator: fixedSecretGenerator(secret),
    existenceCheck: alwaysExists,
    authorizationCheck: alwaysAuthorized,
    membershipAuthority,
  });
}

let tmpDir: string;
beforeEach(() => {
  capabilityCounter = 0;
  tmpDir = mkdtempSync(join(tmpdir(), "fedos-capability-persistence-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("Secure Runtime Alpha 834-835 -- Bearer Verifier Boundary", () => {
  it("1. a verifier is one-way -- it never equals the raw secret and cannot be used as a bearer secret", () => {
    const secret = toFedosConversationCapabilityBearerSecret("raw-secret-value")!;
    const verifier = createFedosConversationCapabilityBearerVerifier(secret);
    expect(verifier).not.toEqual(secret);
    expect(fedosConversationCapabilityBearerVerifierMatches(verifier, secret)).toBe(true);
  });

  it("2. matchesVerifier -- rejects the wrong secret, deterministic for the same secret", () => {
    const secret = toFedosConversationCapabilityBearerSecret("raw-secret-value")!;
    const wrong = toFedosConversationCapabilityBearerSecret("wrong-secret-value")!;
    const verifier = createFedosConversationCapabilityBearerVerifier(secret);
    expect(fedosConversationCapabilityBearerVerifierMatches(verifier, wrong)).toBe(false);
    expect(createFedosConversationCapabilityBearerVerifier(secret)).toEqual(verifier);
  });

  it("3. fedosConversationCapabilityBearerSecretsMatch -- constant-time-shaped, still correct for equal/unequal", () => {
    const a = toFedosConversationCapabilityBearerSecret("same")!;
    const b = toFedosConversationCapabilityBearerSecret("same")!;
    const c = toFedosConversationCapabilityBearerSecret("different")!;
    expect(fedosConversationCapabilityBearerSecretsMatch(a, b)).toBe(true);
    expect(fedosConversationCapabilityBearerSecretsMatch(a, c)).toBe(false);
  });
});

describe("Secure Runtime Alpha 836 -- Capability Codec V1", () => {
  it("1. issued event round-trips field-for-field, never carries a raw bearer secret", () => {
    const secret = toFedosConversationCapabilityBearerSecret("raw-secret-value")!;
    const verifier = createFedosConversationCapabilityBearerVerifier(secret);
    const descriptor = {
      capabilityId: "capability-1" as any,
      conversationId,
      action: "join-conversation" as const,
      issuer: alice,
      intendedRecipient: bob,
      maxUses: 1,
      expiresAt: null,
      issuedAt: 1_700_000_000,
    };
    const wire = serializeFedosConversationCapabilityIssuedEvent(descriptor, verifier);
    expect(JSON.stringify(wire)).not.toContain("raw-secret-value");
    const decoded = deserializeFedosConversationCapabilityIssuedEvent(wire);
    expect(decoded?.descriptor).toEqual(descriptor);
    expect(decoded?.bearerVerifier).toEqual(verifier);
  });

  it("2. redeemed event round-trips field-for-field", () => {
    const wire = serializeFedosConversationCapabilityRedeemedEvent("capability-1", bob, 1_700_000_100);
    const decoded = deserializeFedosConversationCapabilityRedeemedEvent(wire);
    expect(decoded).toEqual({ capabilityId: "capability-1", redeemer: bob, redeemedAt: 1_700_000_100 });
  });

  it("3. both deserializers fail closed on unknown schemaVersion, unknown field, malformed input -- never throw", () => {
    expect(deserializeFedosConversationCapabilityIssuedEvent({ schemaVersion: 2 })).toBeNull();
    expect(deserializeFedosConversationCapabilityRedeemedEvent({ schemaVersion: 2 })).toBeNull();
    expect(() => deserializeFedosConversationCapabilityIssuedEvent(null)).not.toThrow();
    expect(() => deserializeFedosConversationCapabilityRedeemedEvent("not an object")).not.toThrow();
    expect(deserializeFedosConversationCapabilityIssuedEvent(null)).toBeNull();
  });
});

function runPersistenceContract(name: string, makePersistence: () => FedosConversationCapabilityPersistence) {
  describe(`Secure Runtime Alpha 837-841 -- Capability Persistence Port + Durable Authority (${name})`, () => {
    it("1. issue -- durable, observable via a fresh Authority over the SAME backend", () => {
      const persistence = makePersistence();
      const membership = new InMemoryFedosConversationMembershipAuthority();
      const authority = makeDurableAuthority(persistence, membership);
      const result = authority.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 2, expiresAt: null },
        1_700_000_000,
      );
      expect(result.outcome).toBe("issued");
      if (result.outcome !== "issued") throw new Error("unreachable");

      const freshAuthority = makeDurableAuthority(persistence, membership);
      const descriptor = freshAuthority.inspectDescriptor(result.descriptor.capabilityId);
      expect(descriptor?.maxUses).toBe(2);
      expect(descriptor?.issuer).toEqual(alice);
    });

    it("2. redeem -- durable and restart-stable: a fresh Authority sees the same use count and Membership", () => {
      const persistence = makePersistence();
      const membershipPersistence = new InMemoryFedosConversationMembershipPersistence();
      const membership = new PersistedFedosConversationMembershipAuthority(membershipPersistence);
      const authority = makeDurableAuthority(persistence, membership);
      const issued = authority.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
        1_700_000_000,
      );
      if (issued.outcome !== "issued") throw new Error("unreachable");

      const redeemResult = authority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100);
      expect(redeemResult.outcome).toBe("redeemed");

      const freshAuthority = makeDurableAuthority(persistence, new PersistedFedosConversationMembershipAuthority(membershipPersistence));
      const freshDescriptor = freshAuthority.inspectDescriptor(issued.descriptor.capabilityId);
      expect(freshDescriptor).not.toBeNull();
      expect(
        freshAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: carol }, 1_700_000_200),
      ).toEqual({ outcome: "exhausted" });
    });

    it("3. redeem -- wrong bearer secret is rejected, indistinguishable from an unknown capability id", () => {
      const persistence = makePersistence();
      const authority = makeDurableAuthority(persistence, new InMemoryFedosConversationMembershipAuthority());
      const issued = authority.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
        1_700_000_000,
      );
      if (issued.outcome !== "issued") throw new Error("unreachable");

      const wrongSecret = toFedosConversationCapabilityBearerSecret("totally-wrong")! as FedosConversationCapabilityBearerSecret;
      expect(authority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: wrongSecret, redeemer: bob }, 1_700_000_100)).toEqual({
        outcome: "invalid-capability",
      });
      expect(
        authority.redeem({ capabilityId: "does-not-exist" as any, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_100),
      ).toEqual({ outcome: "invalid-capability" });
    });

    it("4. redeem -- expiry, recipient mismatch, and duplicate redemption by the same redeemer are all enforced durably", () => {
      const persistence = makePersistence();
      const authority = makeDurableAuthority(persistence, new InMemoryFedosConversationMembershipAuthority());

      const expiring = authority.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 5, expiresAt: 1_700_000_050 },
        1_700_000_000,
      );
      if (expiring.outcome !== "issued") throw new Error("unreachable");
      expect(
        authority.redeem({ capabilityId: expiring.descriptor.capabilityId, bearerSecret: expiring.bearerSecret, redeemer: bob }, 1_700_000_100),
      ).toEqual({ outcome: "expired" });

      const targeted = authority.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: bob, maxUses: 5, expiresAt: null },
        1_700_000_000,
      );
      if (targeted.outcome !== "issued") throw new Error("unreachable");
      expect(
        authority.redeem({ capabilityId: targeted.descriptor.capabilityId, bearerSecret: targeted.bearerSecret, redeemer: carol }, 1_700_000_100),
      ).toEqual({ outcome: "recipient-mismatch" });

      const open = authority.issueJoinCapability(
        { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 5, expiresAt: null },
        1_700_000_000,
      );
      if (open.outcome !== "issued") throw new Error("unreachable");
      const first = authority.redeem({ capabilityId: open.descriptor.capabilityId, bearerSecret: open.bearerSecret, redeemer: bob }, 1_700_000_100);
      expect(first.outcome).toBe("redeemed");
      const second = authority.redeem({ capabilityId: open.descriptor.capabilityId, bearerSecret: open.bearerSecret, redeemer: bob }, 1_700_000_200);
      expect(second).toEqual({ outcome: "already-redeemed" });
    });

    it("5. two capabilities for two different conversations persist and hydrate independently", () => {
      const persistence = makePersistence();
      const authority = makeDurableAuthority(persistence, new InMemoryFedosConversationMembershipAuthority());
      const otherConversationId = toFedosConversationId(toFedosBoardId("board-b")!, toFedosThreadId("thread-b")!);

      authority.issueJoinCapability({ conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null }, 1_700_000_000);
      authority.issueJoinCapability(
        { conversationId: otherConversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
        1_700_000_000,
      );

      const freshAuthority = makeDurableAuthority(persistence, new InMemoryFedosConversationMembershipAuthority());
      expect(freshAuthority).toBeDefined();
      expect(persistence.listConversationCapabilities(conversationId)).toHaveLength(1);
      expect(persistence.listConversationCapabilities(otherConversationId)).toHaveLength(1);
      expect(persistence.listCapabilities()).toHaveLength(2);
    });
  });
}

runPersistenceContract("in-memory", () => new InMemoryFedosConversationCapabilityPersistence());
runPersistenceContract("append-only", () => new AppendOnlyFedosConversationCapabilityPersistence(join(tmpDir, "capability.ndjson")));

describe("Secure Runtime Alpha 840/842 -- Append-Only Capability Backend Corruption and Restart Verification", () => {
  it("1. missing file reads as an empty, freshly-started log -- not corruption", () => {
    const persistence = new AppendOnlyFedosConversationCapabilityPersistence(join(tmpDir, "does-not-exist.ndjson"));
    expect(persistence.listCapabilities()).toEqual([]);
    expect(persistence.getCapability("anything")).toBeNull();
    expect(persistence.hasRedeemedEvent("anything", "nostr", "npub1x")).toBe(false);
  });

  it("2. a malformed line fails closed -- replay throws, never silently repairs", () => {
    const filePath = join(tmpDir, "corrupt.ndjson");
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosConversationCapabilityPersistence(filePath);
    expect(() => persistence.listCapabilities()).toThrow();
  });

  it("3. full restart -- issue, redeem, then two independent fresh instances over the same backend agree on state and duplicate rejection", () => {
    const filePath = join(tmpDir, "restart.ndjson");
    const membershipPersistence = new InMemoryFedosConversationMembershipPersistence();

    const writerPersistence = new AppendOnlyFedosConversationCapabilityPersistence(filePath);
    const writerAuthority = makeDurableAuthority(writerPersistence, new PersistedFedosConversationMembershipAuthority(membershipPersistence));
    const issued = writerAuthority.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");
    const redeemed = writerAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob },
      1_700_000_100,
    );
    expect(redeemed.outcome).toBe("redeemed");

    const readerPersistence = new AppendOnlyFedosConversationCapabilityPersistence(filePath);
    const readerAuthority = makeDurableAuthority(readerPersistence, new PersistedFedosConversationMembershipAuthority(membershipPersistence));
    expect(readerAuthority.inspectDescriptor(issued.descriptor.capabilityId)?.maxUses).toBe(1);
    expect(
      readerAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_200),
    ).toEqual({ outcome: "already-redeemed" });
    expect(
      readerAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: carol }, 1_700_000_200),
    ).toEqual({ outcome: "exhausted" });

    const wrongAgain = new AppendOnlyFedosConversationCapabilityPersistence(filePath);
    const authorityAgain = makeDurableAuthority(wrongAgain, new PersistedFedosConversationMembershipAuthority(membershipPersistence));
    const wrongSecret = toFedosConversationCapabilityBearerSecret("nope")! as FedosConversationCapabilityBearerSecret;
    expect(
      authorityAgain.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: wrongSecret, redeemer: carol }, 1_700_000_300),
    ).toEqual({ outcome: "invalid-capability" });
  });

  it("4. no plaintext bearer secret ever appears on disk", () => {
    const filePath = join(tmpDir, "no-secret-leak.ndjson");
    const persistence = new AppendOnlyFedosConversationCapabilityPersistence(filePath);
    const authority = makeDurableAuthority(persistence, new InMemoryFedosConversationMembershipAuthority(), "super-secret-plaintext-value");
    authority.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    const raw = readFileSync(filePath, "utf8") as string;
    expect(raw).not.toContain("super-secret-plaintext-value");
  });

  it("5. independent instances over DIFFERENT files never share state", () => {
    const persistenceA = new AppendOnlyFedosConversationCapabilityPersistence(join(tmpDir, "a.ndjson"));
    const persistenceB = new AppendOnlyFedosConversationCapabilityPersistence(join(tmpDir, "b.ndjson"));
    const authorityA = makeDurableAuthority(persistenceA, new InMemoryFedosConversationMembershipAuthority());
    const issued = authorityA.issueJoinCapability(
      { conversationId, issuer: alice, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");
    const authorityB = makeDurableAuthority(persistenceB, new InMemoryFedosConversationMembershipAuthority());
    expect(authorityB.inspectDescriptor(issued.descriptor.capabilityId)).toBeNull();
  });
});
