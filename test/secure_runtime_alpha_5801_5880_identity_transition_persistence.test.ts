import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error same as above.
import { tmpdir } from "node:os";
// @ts-expect-error same as above.
import { join } from "node:path";
import { InMemoryFedosIdentityTransitionFactPersistence } from "../src/os/messenger/conversations/identity_transition/persistence/in_memory_fedos_identity_transition_fact_persistence.js";
import { AppendOnlyFedosIdentityTransitionFactPersistence } from "../src/os/messenger/conversations/identity_transition/persistence/append_only_fedos_identity_transition_fact_persistence.js";
import type { FedosIdentityTransitionFactPersistence } from "../src/os/messenger/conversations/identity_transition/persistence/fedos_identity_transition_fact_persistence.js";
import type { FedosIdentityTransitionFactV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_fact.js";
import { isFedosIdentityTransitionFactSuperseded } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_fact_conflict_detection.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";

const OLD_ACCOUNT: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };

function fact(overrides: Partial<FedosIdentityTransitionFactV1> & { transitionId: string }): FedosIdentityTransitionFactV1 {
  return Object.freeze({
    schemaVersion: 1,
    bodyHash: "hash-" + overrides.transitionId,
    oldAccountIdentity: OLD_ACCOUNT,
    newAccountIdentity: { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null },
    oldNostrIdentity: OLD_ACCOUNT.publicIdentifier,
    newNostrIdentity: "b".repeat(64),
    revision: 0,
    previousTransitionId: null,
    evidenceOutcome: "locally-acceptable",
    conflictState: "none",
    supersededByTransitionId: null,
    recordedAt: 1_000,
    ...overrides,
  });
}

function id(n: number): string {
  return `fedos-identity-transition-${n.toString(16).padStart(32, "0")}`;
}

describe.each([
  ["in-memory", () => new InMemoryFedosIdentityTransitionFactPersistence()],
])("%s FedosIdentityTransitionFactPersistence", (_label, makePersistence) => {
  let persistence: FedosIdentityTransitionFactPersistence;
  beforeEach(() => {
    persistence = makePersistence();
  });

  it("inserts a fresh (revision 0) fact", () => {
    expect(persistence.putFact(fact({ transitionId: id(1) }))).toBe("inserted");
    expect(persistence.listFacts()).toHaveLength(1);
  });

  it("matching duplicate (same transitionId, identical content) is idempotent", () => {
    const f = fact({ transitionId: id(1) });
    expect(persistence.putFact(f)).toBe("inserted");
    expect(persistence.putFact(f)).toBe("already-present");
    expect(persistence.listFacts()).toHaveLength(1);
  });

  it("same transitionId, different content is a conflict", () => {
    expect(persistence.putFact(fact({ transitionId: id(1), evidenceOutcome: "locally-acceptable" }))).toBe("inserted");
    expect(persistence.putFact(fact({ transitionId: id(1), evidenceOutcome: "rejected" }))).toBe("conflict");
    expect(persistence.listFacts()).toHaveLength(1);
  });

  it("accepts a valid predecessor chain (revision 0 -> 1 -> 2)", () => {
    expect(persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }))).toBe("inserted");
    expect(persistence.putFact(fact({ transitionId: id(2), revision: 1, previousTransitionId: id(1) }))).toBe("inserted");
    expect(persistence.putFact(fact({ transitionId: id(3), revision: 2, previousTransitionId: id(2) }))).toBe("inserted");
    expect(persistence.listFacts()).toHaveLength(3);
  });

  it("rejects a broken predecessor reference (predecessor never recorded)", () => {
    expect(persistence.putFact(fact({ transitionId: id(2), revision: 1, previousTransitionId: id(99) }))).toBe("broken-predecessor");
  });

  it("rejects a non-contiguous predecessor (predecessor's own revision doesn't match)", () => {
    persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }));
    expect(persistence.putFact(fact({ transitionId: id(3), revision: 2, previousTransitionId: id(1) }))).toBe("broken-predecessor");
  });

  it("detects a revision rollback (new transitionId claims a revision <= the lineage's max)", () => {
    persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }));
    persistence.putFact(fact({ transitionId: id(2), revision: 1, previousTransitionId: id(1) }));
    expect(persistence.putFact(fact({ transitionId: id(3), revision: 1, previousTransitionId: id(1) }))).toBe("rollback-detected");
  });

  it("detects two competing replacement transitions (two different revision-0 facts for the same old identity)", () => {
    expect(persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }))).toBe("inserted");
    expect(persistence.putFact(fact({ transitionId: id(2), revision: 0, previousTransitionId: null }))).toBe("conflict");
  });

  it("detects two competing siblings extending the SAME predecessor", () => {
    persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }));
    expect(persistence.putFact(fact({ transitionId: id(2), revision: 1, previousTransitionId: id(1) }))).toBe("inserted");
    expect(persistence.putFact(fact({ transitionId: id(3), revision: 1, previousTransitionId: id(1) }))).toBe("rollback-detected");
  });

  it("a DIFFERENT old account identity starts an independent lineage (no false conflict)", () => {
    expect(persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }))).toBe("inserted");
    const otherOldAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "e".repeat(64), identityId: null };
    expect(
      persistence.putFact(
        fact({ transitionId: id(2), revision: 0, previousTransitionId: null, oldAccountIdentity: otherOldAccount, oldNostrIdentity: otherOldAccount.publicIdentifier }),
      ),
    ).toBe("inserted");
    expect(persistence.listFacts()).toHaveLength(2);
  });

  it("listLineage returns only facts for the requested old identity", () => {
    persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }));
    const otherOldAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "e".repeat(64), identityId: null };
    persistence.putFact(fact({ transitionId: id(2), revision: 0, previousTransitionId: null, oldAccountIdentity: otherOldAccount, oldNostrIdentity: otherOldAccount.publicIdentifier }));
    const lineage = persistence.listLineage(OLD_ACCOUNT.authority, OLD_ACCOUNT.publicIdentifier, OLD_ACCOUNT.identityId);
    expect(lineage).toHaveLength(1);
    expect(lineage[0]?.transitionId).toBe(id(1));
  });

  it("getFact returns null for an unknown transitionId", () => {
    expect(persistence.getFact(id(404))).toBeNull();
  });

  it("supersession is derived, never stored mutably: a higher-revision sibling supersedes an older one", () => {
    persistence.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }));
    persistence.putFact(fact({ transitionId: id(2), revision: 1, previousTransitionId: id(1) }));
    const lineage = persistence.listLineage(OLD_ACCOUNT.authority, OLD_ACCOUNT.publicIdentifier, OLD_ACCOUNT.identityId);
    const first = lineage.find((f) => f.transitionId === id(1))!;
    const second = lineage.find((f) => f.transitionId === id(2))!;
    expect(isFedosIdentityTransitionFactSuperseded(first, lineage)).toBe(true);
    expect(isFedosIdentityTransitionFactSuperseded(second, lineage)).toBe(false);
  });
});

describe("AppendOnlyFedosIdentityTransitionFactPersistence — restart/replay/corruption", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fedos-identity-transition-"));
    filePath = join(dir, "facts.ndjson");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists across a simulated restart (new instance, same file)", () => {
    const first = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    expect(first.putFact(fact({ transitionId: id(1) }))).toBe("inserted");

    const second = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    expect(second.listFacts()).toHaveLength(1);
    expect(second.getFact(id(1))).not.toBeNull();
  });

  it("re-importing the exact same fact after restart is idempotent", () => {
    const first = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    const f = fact({ transitionId: id(1) });
    first.putFact(f);

    const second = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    expect(second.putFact(f)).toBe("already-present");
  });

  it("fails closed on a malformed line in the log file", () => {
    writeFileSync(filePath, "not valid json at all\n", "utf8");
    const persistence = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    expect(() => persistence.listFacts()).toThrow();
  });

  it("tolerates a genuinely empty trailing line (interrupted-append-safe) but not a partial non-empty one", () => {
    const f = fact({ transitionId: id(1) });
    writeFileSync(filePath, JSON.stringify(f) + "\n\n", "utf8");
    const persistence = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    expect(persistence.listFacts()).toHaveLength(1);

    writeFileSync(filePath, JSON.stringify(f) + "\n{\"schemaVersion\":1,\"transi", "utf8");
    const corrupted = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    expect(() => corrupted.listFacts()).toThrow();
  });

  it("a missing file resolves to an empty list rather than throwing", () => {
    const persistence = new AppendOnlyFedosIdentityTransitionFactPersistence(join(dir, "does-not-exist.ndjson"));
    expect(persistence.listFacts()).toEqual([]);
  });

  it("still enforces conflict/rollback detection across a restart boundary", () => {
    const first = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    first.putFact(fact({ transitionId: id(1), revision: 0, previousTransitionId: null }));

    const second = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    expect(second.putFact(fact({ transitionId: id(2), revision: 0, previousTransitionId: null }))).toBe("conflict");
  });
});
