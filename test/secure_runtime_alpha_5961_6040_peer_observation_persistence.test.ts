import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryFedosIdentityTransitionPeerObservationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.js";
import { AppendOnlyFedosIdentityTransitionPeerObservationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_peer_observation_persistence.js";
import type { FedosIdentityTransitionPeerObservationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/fedos_identity_transition_peer_observation_persistence.js";
import type { FedosIdentityTransitionPeerObservationV1 } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_observation.js";
import { isFedosIdentityTransitionPeerObservationSuperseded } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_observation_conflict_detection.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";

const OLD_ACCOUNT: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };

function id(n: number): string {
  return `fedos-identity-transition-${n.toString(16).padStart(32, "0")}`;
}

function observation(overrides: Partial<FedosIdentityTransitionPeerObservationV1> & { transitionId: string; peerDeviceRef?: string }): FedosIdentityTransitionPeerObservationV1 {
  return Object.freeze({
    schemaVersion: 1,
    localDeviceRef: "bob-device-a",
    peerAccountRef: OLD_ACCOUNT,
    peerDeviceRef: "alice-old-desktop",
    oldAccountIdentity: OLD_ACCOUNT,
    newAccountIdentity: { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null },
    oldNostrIdentity: OLD_ACCOUNT.publicIdentifier,
    newNostrIdentity: "b".repeat(64),
    revision: 0,
    previousTransitionId: null,
    sourceNotificationId: "notif-" + overrides.transitionId,
    evidenceOutcome: "locally-acceptable",
    acceptanceState: "accepted",
    conflictState: "none",
    observedAt: 1_000,
    expiresAt: 1_000_000,
    supersededByTransitionId: null,
    ...overrides,
  });
}

describe.each([["in-memory", () => new InMemoryFedosIdentityTransitionPeerObservationPersistence()]])(
  "%s FedosIdentityTransitionPeerObservationPersistence",
  (_label, makePersistence) => {
    let persistence: FedosIdentityTransitionPeerObservationPersistence;
    beforeEach(() => {
      persistence = makePersistence();
    });

    it("inserts a fresh observation", () => {
      expect(persistence.putObservation(observation({ transitionId: id(1) }))).toBe("inserted");
      expect(persistence.listObservations()).toHaveLength(1);
    });

    it("matching duplicate (same full key, identical content) is idempotent", () => {
      const o = observation({ transitionId: id(1) });
      expect(persistence.putObservation(o)).toBe("inserted");
      expect(persistence.putObservation(o)).toBe("already-present");
    });

    it("same key, different content is a conflict", () => {
      expect(persistence.putObservation(observation({ transitionId: id(1), evidenceOutcome: "locally-acceptable" }))).toBe("inserted");
      expect(persistence.putObservation(observation({ transitionId: id(1), evidenceOutcome: "rejected" }))).toBe("conflict");
    });

    it("TWO DIFFERENT peer Devices reporting the SAME transitionId are both recorded as distinct rows (per-Device corroboration remains distinct)", () => {
      expect(persistence.putObservation(observation({ transitionId: id(1), peerDeviceRef: "alice-old-desktop" }))).toBe("inserted");
      expect(persistence.putObservation(observation({ transitionId: id(1), peerDeviceRef: "alice-old-tablet" }))).toBe("inserted");
      expect(persistence.listObservations()).toHaveLength(2);
    });

    it("a valid predecessor chain (0 -> 1 -> 2) is accepted", () => {
      expect(persistence.putObservation(observation({ transitionId: id(1), revision: 0, previousTransitionId: null }))).toBe("inserted");
      expect(persistence.putObservation(observation({ transitionId: id(2), revision: 1, previousTransitionId: id(1) }))).toBe("inserted");
      expect(persistence.putObservation(observation({ transitionId: id(3), revision: 2, previousTransitionId: id(2) }))).toBe("inserted");
    });

    it("rejects a broken predecessor", () => {
      expect(persistence.putObservation(observation({ transitionId: id(2), revision: 1, previousTransitionId: id(99) }))).toBe("broken-predecessor");
    });

    it("detects a revision rollback", () => {
      persistence.putObservation(observation({ transitionId: id(1), revision: 0, previousTransitionId: null }));
      persistence.putObservation(observation({ transitionId: id(2), revision: 1, previousTransitionId: id(1) }));
      expect(persistence.putObservation(observation({ transitionId: id(3), revision: 1, previousTransitionId: id(1) }))).toBe("rollback-detected");
    });

    it("detects two competing replacement transitions (two revision-0 observations for the same lineage, different transitionId)", () => {
      expect(persistence.putObservation(observation({ transitionId: id(1), revision: 0, previousTransitionId: null }))).toBe("inserted");
      expect(persistence.putObservation(observation({ transitionId: id(2), revision: 0, previousTransitionId: null }))).toBe("conflict");
    });

    it("Bob Device B observes independently of Bob Device A (no cross-device lineage sharing)", () => {
      expect(persistence.putObservation(observation({ transitionId: id(1), revision: 0, previousTransitionId: null, localDeviceRef: "bob-device-a" }))).toBe(
        "inserted",
      );
      // A DIFFERENT competing revision-0 transition, observed by a DIFFERENT local Device — must NOT conflict with Device A's own observation.
      expect(
        persistence.putObservation(observation({ transitionId: id(2), revision: 0, previousTransitionId: null, localDeviceRef: "bob-device-b" })),
      ).toBe("inserted");
      expect(persistence.listObservations()).toHaveLength(2);
    });

    it("supersession is derived, never stored mutably", () => {
      persistence.putObservation(observation({ transitionId: id(1), revision: 0, previousTransitionId: null }));
      persistence.putObservation(observation({ transitionId: id(2), revision: 1, previousTransitionId: id(1) }));
      const lineage = persistence.listLineage("bob-device-a", OLD_ACCOUNT.authority, OLD_ACCOUNT.publicIdentifier, OLD_ACCOUNT.identityId);
      const first = lineage.find((o) => o.transitionId === id(1))!;
      const second = lineage.find((o) => o.transitionId === id(2))!;
      expect(isFedosIdentityTransitionPeerObservationSuperseded(first, lineage)).toBe(true);
      expect(isFedosIdentityTransitionPeerObservationSuperseded(second, lineage)).toBe(false);
    });

    it("getObservation returns null for an unknown key", () => {
      expect(persistence.getObservation("bob-device-a", OLD_ACCOUNT, "alice-old-desktop", id(404))).toBeNull();
    });
  },
);

describe("AppendOnlyFedosIdentityTransitionPeerObservationPersistence — restart/replay/corruption", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fedos-identity-transition-peer-obs-"));
    filePath = join(dir, "observations.ndjson");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists across a simulated restart", () => {
    const first = new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(filePath);
    expect(first.putObservation(observation({ transitionId: id(1) }))).toBe("inserted");
    const second = new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(filePath);
    expect(second.listObservations()).toHaveLength(1);
  });

  it("fails closed on a corrupt log line", () => {
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(filePath);
    expect(() => persistence.listObservations()).toThrow();
  });

  it("still enforces conflict detection across a restart boundary", () => {
    const first = new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(filePath);
    first.putObservation(observation({ transitionId: id(1), revision: 0, previousTransitionId: null }));
    const second = new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(filePath);
    expect(second.putObservation(observation({ transitionId: id(2), revision: 0, previousTransitionId: null }))).toBe("conflict");
  });
});
