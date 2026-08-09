/**
 * Secure Runtime Alpha 7641-7720 (FedOS Delivery Observation Repository
 * Subject Index and Query Scalability Arc) — Phase F: rebuild/restart
 * proofs for the new `#bySubject` derived index inside
 * `FedosDeliveryObservationRepository`.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { AppendOnlyFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/append_only_fedos_delivery_observation_persistence.js";

const subjectA = toFedosDeliveryObservationSubjectId("subject-a")!;
const subjectB = toFedosDeliveryObservationSubjectId("subject-b")!;
const subjectC = toFedosDeliveryObservationSubjectId("subject-c")!;

describe("Secure Runtime Alpha 7641-7720 -- subject index rebuild/restart proofs", () => {
  it("1. empty repository rebuild -- listForSubject/historyFor return empty for any subject, no error", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    expect(repository.listForSubject(subjectA)).toEqual([]);
    expect(query.historyFor(subjectA)).toEqual([]);
    expect(query.currentStateFor(subjectA)).toBeNull();
  });

  it("2. one-subject rebuild -- a fresh Repository over an already-populated persistence recovers the exact history", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    const seed = new FedosDeliveryObservationRepository(persistence);
    seed.record(subjectA, "queued", 1);
    seed.record(subjectA, "publishing", 2);
    seed.record(subjectA, "accepted", 3);

    const rebuilt = new FedosDeliveryObservationRepository(persistence);
    const query = new FedosDeliveryObservationQuery(rebuilt);
    expect(query.historyFor(subjectA).map((o) => o.state)).toEqual(["queued", "publishing", "accepted"]);
  });

  it("3. many-subject rebuild -- each subject's own index bucket is independent and correctly populated", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    const seed = new FedosDeliveryObservationRepository(persistence);
    for (let i = 0; i < 50; i++) {
      const subject = toFedosDeliveryObservationSubjectId(`subject-${i}`)!;
      seed.record(subject, "queued", 1);
      seed.record(subject, "accepted", 2);
    }
    const rebuilt = new FedosDeliveryObservationRepository(persistence);
    const query = new FedosDeliveryObservationQuery(rebuilt);
    for (let i = 0; i < 50; i++) {
      const subject = toFedosDeliveryObservationSubjectId(`subject-${i}`)!;
      expect(query.historyFor(subject).map((o) => o.state)).toEqual(["queued", "accepted"]);
    }
    // No cross-subject leakage.
    expect(query.historyFor(toFedosDeliveryObservationSubjectId("subject-999")!)).toEqual([]);
  });

  it("4. mixed-subject-namespace rebuild -- Board-shaped and Conversation-shaped subject ids coexist in one index without collision (real domains use SEPARATE Repository instances; this proves the index itself is domain-agnostic and never conflates two distinct subjectId strings)", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    const seed = new FedosDeliveryObservationRepository(persistence);
    const boardShaped = toFedosDeliveryObservationSubjectId("board::post-1::relay-a")!;
    const conversationShaped = toFedosDeliveryObservationSubjectId("conversation::envelope-1")!;
    seed.record(boardShaped, "accepted", 1);
    seed.record(conversationShaped, "rejected", 1);

    const rebuilt = new FedosDeliveryObservationRepository(persistence);
    const query = new FedosDeliveryObservationQuery(rebuilt);
    expect(query.currentStateFor(boardShaped)!.state).toBe("accepted");
    expect(query.currentStateFor(conversationShaped)!.state).toBe("rejected");
  });

  it("5. corrupt line handling on rebuild -- an unparsable line in the real durable log throws at construction, identically to what list() already threw on its own first call before this Arc", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7641-index-"));
    const path = join(dir, "observations.log");
    try {
      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(path);
      const seed = new FedosDeliveryObservationRepository(persistence);
      seed.record(subjectA, "queued", 1);
      appendFileSync(path, "{not valid json\n", "utf8");
      expect(() => new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("6. truncated tail handling on rebuild -- a trailing partial line (mid-write crash artifact) follows the SAME pre-existing fail-closed policy as an ordinary corrupt line (no per-record isolation exists in the durable backend; this Arc changes nothing about that)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7641-index-"));
    const path = join(dir, "observations.log");
    try {
      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(path);
      const seed = new FedosDeliveryObservationRepository(persistence);
      seed.record(subjectA, "queued", 1);
      const fullLine = readFileSync(path, "utf8") as string;
      writeFileSync(path, fullLine.slice(0, Math.floor(fullLine.length / 2)), "utf8");
      expect(() => new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("7. duplicate fact is idempotent in the index -- recording the identical logical fact twice never creates a second index entry", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    expect(repository.record(subjectA, "queued", 1)).toBe("recorded");
    expect(repository.record(subjectA, "queued", 1)).toBe("already-present");
    expect(repository.listForSubject(subjectA)).toHaveLength(1);
  });

  it("8. conflicting fact never enters the index -- a same-id, different-content write is rejected and the index keeps only the original", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    expect(repository.record(subjectA, "queued", 1, "reason-one")).toBe("recorded");
    // Same subjectId/state/observedAt (same derived id) but different reason -- a genuine conflict.
    expect(repository.record(subjectA, "queued", 1, "reason-two")).toBe("conflict");
    expect(repository.listForSubject(subjectA)).toHaveLength(1);
    expect(repository.listForSubject(subjectA)[0]!.reason).toBe("reason-one");
  });

  it("9. rollback/revision facts remain visible to existing conflict logic -- an out-of-order (older observedAt after a newer one) recording is still stored as its own distinct fact, and currentStateFor derives correctly regardless of insertion order", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    repository.record(subjectA, "accepted", 10);
    repository.record(subjectA, "queued", 1);
    expect(query.currentStateFor(subjectA)!.state).toBe("accepted");
    expect(repository.listForSubject(subjectA)).toHaveLength(2);
  });

  it("10. five restart cycles -- exact query equivalence before/after each restart, over a real durable file-backed log", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7641-index-"));
    const path = join(dir, "observations.log");
    try {
      let clock = 1;
      for (let cycle = 1; cycle <= 5; cycle++) {
        const persistence = new AppendOnlyFedosDeliveryObservationPersistence(path);
        const repository = new FedosDeliveryObservationRepository(persistence);
        const query = new FedosDeliveryObservationQuery(repository);
        // Verify everything written in PRIOR cycles is still visible after this "restart".
        for (let i = 1; i < cycle; i++) {
          const subject = toFedosDeliveryObservationSubjectId(`restart-subject-${i}`)!;
          expect(query.currentStateFor(subject)!.state, `cycle ${cycle}: subject ${i} must survive restart`).toBe("accepted");
        }
        // Add one new subject's history this cycle.
        const newSubject = toFedosDeliveryObservationSubjectId(`restart-subject-${cycle}`)!;
        repository.record(newSubject, "queued", clock++);
        repository.record(newSubject, "accepted", clock++);
        expect(query.currentStateFor(newSubject)!.state).toBe("accepted");
      }
      // Final verification: a truly fresh Repository sees all 5 subjects' complete history.
      const finalRepository = new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path));
      const finalQuery = new FedosDeliveryObservationQuery(finalRepository);
      for (let i = 1; i <= 5; i++) {
        const subject = toFedosDeliveryObservationSubjectId(`restart-subject-${i}`)!;
        expect(finalQuery.historyFor(subject).map((o) => o.state)).toEqual(["queued", "accepted"]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("11. index never grows beyond durable valid facts -- a rejected write (invalid state) is never reflected in listForSubject", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    expect(repository.record(subjectA, "delivered" as never, 1)).toBe("invalid");
    expect(repository.listForSubject(subjectA)).toEqual([]);
  });

  it("12. listForSubject never returns the index's own backing array -- mutating the result never corrupts a later read", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    repository.record(subjectA, "queued", 1);
    const first = repository.listForSubject(subjectA) as unknown as unknown[];
    first.push("not-a-real-observation");
    expect(repository.listForSubject(subjectA)).toHaveLength(1);
  });

  it("13. querying every subject after a rebuild costs O(T + S), not O(S x T) -- a sanity smoke check (exact scaling is Phase H's own concern) that 200 distinct single-history subjects all resolve correctly from one rebuilt Repository", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    const seed = new FedosDeliveryObservationRepository(persistence);
    for (let i = 0; i < 200; i++) {
      seed.record(toFedosDeliveryObservationSubjectId(`smoke-${i}`)!, "accepted", i);
    }
    const rebuilt = new FedosDeliveryObservationRepository(persistence);
    const query = new FedosDeliveryObservationQuery(rebuilt);
    for (let i = 0; i < 200; i++) {
      expect(query.currentStateFor(toFedosDeliveryObservationSubjectId(`smoke-${i}`)!)!.state).toBe("accepted");
    }
  });

  it("14. subjectB and subjectC each retain independent history after subjectA's own history grows large -- proves per-subject isolation under load", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    for (let i = 0; i < 500; i++) {
      repository.record(subjectA, i % 2 === 0 ? "queued" : "publishing", i);
    }
    repository.record(subjectB, "accepted", 1);
    repository.record(subjectC, "rejected", 1);
    expect(query.historyFor(subjectA)).toHaveLength(500);
    expect(query.historyFor(subjectB)).toHaveLength(1);
    expect(query.historyFor(subjectC)).toHaveLength(1);
    expect(query.currentStateFor(subjectB)!.state).toBe("accepted");
    expect(query.currentStateFor(subjectC)!.state).toBe("rejected");
  });
});
