import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { validateFedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference_validator.js";
import { validateFedosConversationMembership } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_validator.js";
import {
  serializeFedosConversationMembership,
  deserializeFedosConversationMembership,
} from "../src/os/messenger/conversations/membership/persistence/fedos_conversation_membership_codec.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import type { FedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/fedos_conversation_membership_persistence.js";

const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-a")!);
const alice = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1alice", identityId: null })!;
const bob = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1bob", identityId: null })!;

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fedos-membership-persistence-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("Secure Runtime Alpha 825-826 -- Persisted Membership Record V1 and Codec", () => {
  it("1. validateFedosConversationMembership -- endedAt must be null iff state is active", () => {
    const validActive = validateFedosConversationMembership({
      id: "conv-a::nostr::npub1alice",
      conversationId,
      participant: alice,
      role: "member",
      state: "active",
      joinedAt: 1_700_000_000,
      endedAt: null,
    });
    expect(validActive).not.toBeNull();

    const invalidActiveWithEndedAt = validateFedosConversationMembership({
      id: "conv-a::nostr::npub1alice",
      conversationId,
      participant: alice,
      role: "member",
      state: "active",
      joinedAt: 1_700_000_000,
      endedAt: 1_700_001_000,
    });
    expect(invalidActiveWithEndedAt).toBeNull();

    const invalidRevokedWithoutEndedAt = validateFedosConversationMembership({
      id: "conv-a::nostr::npub1alice",
      conversationId,
      participant: alice,
      role: "member",
      state: "revoked",
      joinedAt: 1_700_000_000,
      endedAt: null,
    });
    expect(invalidRevokedWithoutEndedAt).toBeNull();
  });

  it("2. round-trip equality -- serialize then deserialize reproduces the original membership field-for-field", () => {
    const membership = validateFedosConversationMembership({
      id: "conv-a::nostr::npub1alice",
      conversationId,
      participant: alice,
      role: "moderator",
      state: "active",
      joinedAt: 1_700_000_000,
      endedAt: null,
    })!;
    const wire = serializeFedosConversationMembership(membership);
    const roundTripped = deserializeFedosConversationMembership(wire);
    expect(roundTripped).toEqual(membership);
  });

  it("3. deserialize fails closed on unknown schemaVersion, unknown field, and malformed input -- never throws", () => {
    expect(deserializeFedosConversationMembership({ schemaVersion: 2 })).toBeNull();
    expect(
      deserializeFedosConversationMembership({
        schemaVersion: 1,
        id: "x",
        conversationId: "y",
        participantAuthority: "nostr",
        participantPublicIdentifier: "npub1",
        participantIdentityId: null,
        role: "member",
        state: "active",
        joinedAt: 1_700_000_000,
        endedAt: null,
        extraField: "unexpected",
      }),
    ).toBeNull();
    expect(() => deserializeFedosConversationMembership(null)).not.toThrow();
    expect(() => deserializeFedosConversationMembership("not an object")).not.toThrow();
    expect(deserializeFedosConversationMembership(null)).toBeNull();
  });
});

function runPersistenceContract(name: string, makePersistence: () => FedosConversationMembershipPersistence) {
  describe(`Secure Runtime Alpha 827-830 -- Membership Persistence Port + Authority (${name})`, () => {
    it("1. admit -- durable, observable via a fresh Authority over the SAME backend", () => {
      const persistence = makePersistence();
      const authority = new PersistedFedosConversationMembershipAuthority(persistence);
      const result = authority.admit(conversationId, alice, "member", 1_700_000_000);
      expect(result.outcome).toBe("admitted");

      const freshAuthority = new PersistedFedosConversationMembershipAuthority(persistence);
      const found = freshAuthority.findMembership(conversationId, alice);
      expect(found?.state).toBe("active");
      expect(found?.role).toBe("member");
    });

    it("2. admit -- idempotent for an identical (conversation, participant, role) triple", () => {
      const authority = new PersistedFedosConversationMembershipAuthority(makePersistence());
      authority.admit(conversationId, alice, "member", 1_700_000_000);
      const second = authority.admit(conversationId, alice, "member", 1_700_000_500);
      expect(second.outcome).toBe("already-present");
    });

    it("3. admit -- conflicting role on an already-active membership is a real conflict", () => {
      const authority = new PersistedFedosConversationMembershipAuthority(makePersistence());
      authority.admit(conversationId, alice, "member", 1_700_000_000);
      expect(authority.admit(conversationId, alice, "owner", 1_700_000_500)).toEqual({ outcome: "conflict" });
    });

    it("4. revoke/leave -- durable, and preserved across a fresh Authority instance", () => {
      const persistence = makePersistence();
      const authority = new PersistedFedosConversationMembershipAuthority(persistence);
      authority.admit(conversationId, alice, "member", 1_700_000_000);
      const revoked = authority.revoke(conversationId, alice, 1_700_001_000);
      expect(revoked.outcome).toBe("revoked");

      const freshAuthority = new PersistedFedosConversationMembershipAuthority(persistence);
      expect(freshAuthority.findMembership(conversationId, alice)?.state).toBe("revoked");
    });

    it("5. invalid resurrection -- revoked never reactivates, even via a fresh Authority instance", () => {
      const persistence = makePersistence();
      const authority = new PersistedFedosConversationMembershipAuthority(persistence);
      authority.admit(conversationId, alice, "member", 1_700_000_000);
      authority.revoke(conversationId, alice, 1_700_001_000);

      const freshAuthority = new PersistedFedosConversationMembershipAuthority(persistence);
      expect(freshAuthority.admit(conversationId, alice, "member", 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
      expect(freshAuthority.revoke(conversationId, alice, 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
      expect(freshAuthority.leave(conversationId, alice, 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
    });

    it("6. two distinct participants persist and hydrate independently", () => {
      const persistence = makePersistence();
      const authority = new PersistedFedosConversationMembershipAuthority(persistence);
      authority.admit(conversationId, alice, "member", 1_700_000_000);
      authority.admit(conversationId, bob, "moderator", 1_700_000_100);

      const freshAuthority = new PersistedFedosConversationMembershipAuthority(persistence);
      const list = freshAuthority.listMemberships(conversationId);
      expect(list).toHaveLength(2);
      expect(list.map((m) => m.role).sort()).toEqual(["member", "moderator"]);
    });

    it("7. revoke on a not-found membership -- not-found, never throws", () => {
      const authority = new PersistedFedosConversationMembershipAuthority(makePersistence());
      expect(authority.revoke(conversationId, alice, 1_700_000_000)).toEqual({ outcome: "not-found" });
    });

    it("8. previewAdmission -- would-admit, then already-active, then blocked after revocation, all restart-stable", () => {
      const persistence = makePersistence();
      const authority = new PersistedFedosConversationMembershipAuthority(persistence);
      expect(authority.previewAdmission(conversationId, alice)).toEqual({ outcome: "would-admit" });
      authority.admit(conversationId, alice, "member", 1_700_000_000);
      expect(new PersistedFedosConversationMembershipAuthority(persistence).previewAdmission(conversationId, alice)).toEqual({
        outcome: "already-active",
      });
      authority.revoke(conversationId, alice, 1_700_001_000);
      expect(new PersistedFedosConversationMembershipAuthority(persistence).previewAdmission(conversationId, alice)).toEqual({
        outcome: "blocked",
        reason: "invalid-transition",
      });
    });
  });
}

runPersistenceContract("in-memory", () => new InMemoryFedosConversationMembershipPersistence());
runPersistenceContract("append-only", () => new AppendOnlyFedosConversationMembershipPersistence(join(tmpDir, "membership.ndjson")));

describe("Secure Runtime Alpha 829/831/832 -- Append-Only Backend Corruption and Hydration", () => {
  it("1. missing file reads as an empty, freshly-started log -- not corruption", () => {
    const persistence = new AppendOnlyFedosConversationMembershipPersistence(join(tmpDir, "does-not-exist.ndjson"));
    expect(persistence.listMemberships()).toEqual([]);
    expect(persistence.getMembership("anything")).toBeNull();
  });

  it("2. a malformed line fails closed -- replay throws, never silently repairs", () => {
    const filePath = join(tmpDir, "corrupt.ndjson");
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosConversationMembershipPersistence(filePath);
    expect(() => persistence.listMemberships()).toThrow();
  });

  it("3. hydration -- a fresh Authority over an independently-populated append-only file preserves active/revoked/left, roles, and timestamps", () => {
    const filePath = join(tmpDir, "hydration.ndjson");
    const writerAuthority = new PersistedFedosConversationMembershipAuthority(new AppendOnlyFedosConversationMembershipPersistence(filePath));
    writerAuthority.admit(conversationId, alice, "owner", 1_700_000_000);
    writerAuthority.admit(conversationId, bob, "member", 1_700_000_100);
    writerAuthority.revoke(conversationId, bob, 1_700_000_200);

    const readerAuthority = new PersistedFedosConversationMembershipAuthority(new AppendOnlyFedosConversationMembershipPersistence(filePath));
    const aliceMembership = readerAuthority.findMembership(conversationId, alice);
    expect(aliceMembership?.state).toBe("active");
    expect(aliceMembership?.role).toBe("owner");
    expect(aliceMembership?.joinedAt).toBe(1_700_000_000);

    const bobMembership = readerAuthority.findMembership(conversationId, bob);
    expect(bobMembership?.state).toBe("revoked");
    expect(bobMembership?.endedAt).toBe(1_700_000_200);

    expect(readerAuthority.admit(conversationId, bob, "member", 1_700_000_300)).toEqual({ outcome: "invalid-transition" });
  });

  it("4. independent instances over DIFFERENT files never share state", () => {
    const persistenceA = new AppendOnlyFedosConversationMembershipPersistence(join(tmpDir, "a.ndjson"));
    const persistenceB = new AppendOnlyFedosConversationMembershipPersistence(join(tmpDir, "b.ndjson"));
    new PersistedFedosConversationMembershipAuthority(persistenceA).admit(conversationId, alice, "member", 1_700_000_000);
    expect(new PersistedFedosConversationMembershipAuthority(persistenceB).findMembership(conversationId, alice)).toBeNull();
  });
});
