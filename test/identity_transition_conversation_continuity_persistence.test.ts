import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppendOnlyFedosIdentityTransitionConversationContinuityPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_conversation_continuity_persistence.js";
import type { FedosIdentityTransitionConversationContinuityRecordV1 } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";

/**
 * Verified Secure Session UI mega-arc (Coordinator) — this class had ZERO
 * test coverage anywhere in the repo before this file, despite being real
 * production code (`FedosIdentityTransitionPeerRuntime.getConversationContinuity()`/
 * `recordConversationContinuity()` both depend on it) — and despite the
 * Desktop Runtime composition (`fedos_desktop_runtime.ts`) never having
 * wired it to a durable path, silently falling back to the non-durable
 * in-memory default in every real process (see this same arc's fix to
 * `fedos_local_profile_paths.ts`/`fedos_desktop_runtime.ts`/
 * `fedos_profile_initialization_coordinator.ts`). This file proves the
 * class ITSELF is genuinely restart-durable, mirroring every sibling
 * append-only backend's own established restart-recovery discipline.
 */

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshFile(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-identity-transition-continuity-"));
  dir = d;
  return join(d, "identity-transition-conversation-continuity.ndjson");
}

function record(overrides: Partial<FedosIdentityTransitionConversationContinuityRecordV1> = {}): FedosIdentityTransitionConversationContinuityRecordV1 {
  return {
    schemaVersion: 1,
    localDeviceRef: "bob-desktop",
    conversationId: "conv-1",
    oldAccountIdentity: { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null },
    newAccountIdentity: { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null },
    transitionId: `fedos-identity-transition-${"1".repeat(32)}`,
    revision: 0,
    evidenceLevel: "accepted",
    verificationMethod: null,
    acceptedAt: 1_700_000_000,
    newSessionRequired: false,
    ...overrides,
  };
}

describe("AppendOnlyFedosIdentityTransitionConversationContinuityPersistence", () => {
  it("putRecord then getCurrentForConversation returns the exact record", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.putRecord(record())).toBe("inserted");
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-1")).toEqual(record());
  });

  it("getCurrentForConversation is null for an unknown (localDeviceRef, conversationId) pair", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-x")).toBeNull();
  });

  it("RESTART SURVIVAL: a fresh instance over the SAME file sees a record written by an earlier instance -- the exact gap this fix closes", () => {
    const filePath = freshFile();
    const first = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(filePath);
    expect(first.putRecord(record())).toBe("inserted");

    // Simulate a real process restart: a brand-new instance, no shared in-memory state.
    const second = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(filePath);
    expect(second.getCurrentForConversation("bob-desktop", "conv-1")).toEqual(record());
  });

  it("a byte-identical re-put of the same key is 'already-present', never duplicated", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.putRecord(record())).toBe("inserted");
    expect(persistence.putRecord(record())).toBe("already-present");
  });

  it("a DIFFERENT record for the same (localDeviceRef, conversationId, transitionId) key is a 'conflict', never silently overwritten", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.putRecord(record())).toBe("inserted");
    const conflicting = record({ newSessionRequired: true });
    expect(persistence.putRecord(conflicting)).toBe("conflict");
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-1")).toEqual(record());
  });

  const TRANSITION_ID_1 = `fedos-identity-transition-${"1".repeat(32)}`;
  const TRANSITION_ID_2 = `fedos-identity-transition-${"2".repeat(32)}`;
  const TRANSITION_ID_0 = `fedos-identity-transition-${"0".repeat(32)}`;

  it("a higher revision for the same lineage supersedes and getCurrentForConversation returns the latest revision", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.putRecord(record({ revision: 0, transitionId: TRANSITION_ID_1 }))).toBe("inserted");
    expect(persistence.putRecord(record({ revision: 1, transitionId: TRANSITION_ID_2 }))).toBe("inserted");
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-1")).toEqual(record({ revision: 1, transitionId: TRANSITION_ID_2 }));
  });

  it("a lower/equal revision re-submitted for the same lineage under a different transitionId is 'rollback-detected'", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.putRecord(record({ revision: 1, transitionId: TRANSITION_ID_2 }))).toBe("inserted");
    expect(persistence.putRecord(record({ revision: 0, transitionId: TRANSITION_ID_0 }))).toBe("rollback-detected");
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-1")).toEqual(record({ revision: 1, transitionId: TRANSITION_ID_2 }));
  });

  it("WRONG-BINDING: different (localDeviceRef, conversationId) pairs are independent lineages -- never cross-contaminate", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.putRecord(record())).toBe("inserted");
    expect(persistence.putRecord(record({ conversationId: "conv-2" }))).toBe("inserted");
    expect(persistence.putRecord(record({ localDeviceRef: "alice-desktop" }))).toBe("inserted");
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-1")).toEqual(record());
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-2")).toEqual(record({ conversationId: "conv-2" }));
    expect(persistence.getCurrentForConversation("alice-desktop", "conv-1")).toEqual(record({ localDeviceRef: "alice-desktop" }));
    // Cross-lookups never see another lineage's record.
    expect(persistence.getCurrentForConversation("bob-desktop", "conv-1")).not.toEqual(record({ conversationId: "conv-2" }));
  });

  it("a corrupt log line throws on read (fail-closed on corruption, mirrors every sibling append-only backend)", () => {
    const filePath = freshFile();
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(filePath);
    persistence.putRecord(record());
    appendFileSync(filePath, "not-json-at-all\n", "utf8");
    expect(() => persistence.getCurrentForConversation("bob-desktop", "conv-1")).toThrow();
  });

  it("a missing log file (never written to) is an honest empty state, not a throw", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(freshFile());
    expect(persistence.listRecords()).toEqual([]);
  });
});
