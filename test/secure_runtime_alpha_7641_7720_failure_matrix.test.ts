/**
 * Secure Runtime Alpha 7641-7720 (FedOS Delivery Observation Repository
 * Subject Index and Query Scalability Arc) — Phase K: failure matrix.
 *
 * This file covers the scenarios named by the mission NOT already
 * exhaustively proven elsewhere:
 *   invalid subject shape, canonical-key collision attempt, corrupt
 *   MIDDLE line (distinct from a truncated TAIL), failed append (via a
 *   fake persistence, since the real backend only fails on a genuine fs
 *   error), crash-window impossibility (synchronous single-call proof),
 *   concurrent append same/different subject (single-threaded JS —
 *   "concurrent" reduces to rapid sequential calls; proven no lost
 *   update), query during append, restart against a log missing only its
 *   final trailing newline (valid, NOT corruption — distinguished from
 *   genuine truncation), resource-limit exhaustion (no artificial cap
 *   exists), and a stale repository instance never seeing another
 *   instance's later writes until reconstructed.
 *
 * Already exhaustively proven elsewhere, cited rather than duplicated:
 *   empty log / one fact / one-subject-many-facts / many-subjects-one-
 *   fact-each / mixed Board+Conversation domains / duplicate fact /
 *   conflicting fact / rollback-revision / truncated tail / five restart
 *   cycles — `secure_runtime_alpha_7641_7720_subject_index_rebuild_restart.test.ts`
 *   (Phase F) and `secure_runtime_alpha_7641_7720_real_vertical_slice.test.ts`
 *   (Phase J); 100,000-fact scale — `secure_runtime_alpha_7641_7720_benchmark_methodology_and_results.md`
 *   (Phase H, measured directly, not derived).
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { AppendOnlyFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/append_only_fedos_delivery_observation_persistence.js";
import type {
  FedosDeliveryObservationPersistence,
  FedosDeliveryObservationPersistenceWriteResult,
} from "../src/os/messenger/board/observation/fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "../src/os/messenger/board/observation/fedos_delivery_observation_codec.js";

const subjectA = toFedosDeliveryObservationSubjectId("subject-a")!;
const subjectB = toFedosDeliveryObservationSubjectId("subject-b")!;

/** A deterministic, always-fails persistence double -- used ONLY to prove the index is never updated on a failed write; this is not the headline path (which is real, file-backed, elsewhere in this Arc). */
class AlwaysFailingPersistence implements FedosDeliveryObservationPersistence {
  putObservation(_record: FedosPersistedDeliveryObservationRecordV1): FedosDeliveryObservationPersistenceWriteResult {
    return "failed";
  }
  getObservation(_id: string): FedosPersistedDeliveryObservationRecordV1 | null {
    return null;
  }
  listObservations(): readonly FedosPersistedDeliveryObservationRecordV1[] {
    return [];
  }
}

describe("Secure Runtime Alpha 7641-7720 -- failure matrix", () => {
  it("1. invalid subject shape -- an empty-string subjectId is rejected by the canonical brand function itself, never reaches record()", () => {
    expect(toFedosDeliveryObservationSubjectId("")).toBeNull();
    expect(toFedosDeliveryObservationSubjectId("   ")).toBeNull();
  });

  it("2. canonical-key collision attempt -- string-concatenation aliasing never causes two logically-distinct subjects to share an index bucket (Map key equality is exact string equality, not structural)", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    const s1 = toFedosDeliveryObservationSubjectId("a::b")!;
    const s2 = toFedosDeliveryObservationSubjectId("a:" + ":b")!; // same final string as s1, by construction
    const s3 = toFedosDeliveryObservationSubjectId("ab")!; // genuinely different string
    repository.record(s1, "accepted", 1);
    repository.record(s3, "rejected", 1);
    // s1 and s2 are the SAME string, so they legitimately share history (not a collision, correct identity).
    expect(query.currentStateFor(s2)!.state).toBe("accepted");
    // s3, a genuinely different string, must never see s1's history.
    expect(query.currentStateFor(s3)!.state).toBe("rejected");
    expect(query.historyFor(s3)).toHaveLength(1);
  });

  it("3. corrupt MIDDLE line (distinct from a truncated tail) -- an unparsable line anywhere in the file throws identically at construction", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7641-matrix-"));
    const path = join(dir, "observations.log");
    try {
      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(path);
      const seed = new FedosDeliveryObservationRepository(persistence);
      seed.record(subjectA, "queued", 1);
      seed.record(subjectA, "publishing", 2);
      seed.record(subjectB, "accepted", 1);
      const lines = (readFileSync(path, "utf8") as string).split("\n").filter((l: string) => l.trim().length > 0);
      // Insert a corrupt line BEFORE the last one -- genuinely in the middle, not the tail.
      const withCorruptMiddle = [lines[0], "{not valid json at all", lines[1], lines[2]].join("\n") + "\n";
      writeFileSync(path, withCorruptMiddle, "utf8");
      expect(() => new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. failed append -- when the underlying persistence reports 'failed', the index is never updated", () => {
    const repository = new FedosDeliveryObservationRepository(new AlwaysFailingPersistence());
    expect(repository.record(subjectA, "queued", 1)).toBe("failed");
    expect(repository.listForSubject(subjectA)).toEqual([]);
  });

  it("5. crash-window impossibility -- record()'s own durable-write-then-index-update sequence is one synchronous, non-yielding call; a caller can never observe a state where the write succeeded but the index has not yet reflected it", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const result = repository.record(subjectA, "queued", 1);
    // The very next synchronous statement already sees the update -- no microtask/await boundary exists between the two.
    expect(result).toBe("recorded");
    expect(repository.listForSubject(subjectA)).toHaveLength(1);
  });

  it("6. concurrent append, SAME subject -- rapid sequential record() calls (this codebase is single-threaded/synchronous; 'concurrent' reduces to rapid sequential) never lose an update -- the bare Repository (unlike the transition-validating wrapper) accepts any distinct (state, observedAt) pair, so 100 genuinely distinct facts for ONE subject all land", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    for (let i = 0; i < 100; i++) {
      expect(repository.record(subjectA, "accepted", i)).toBe("recorded");
    }
    expect(repository.listForSubject(subjectA)).toHaveLength(100);
  });

  it("7. concurrent append, DIFFERENT subjects -- interleaved record() calls across many subjects keep each subject's own index bucket correct and isolated", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    const subjects = Array.from({ length: 20 }, (_, i) => toFedosDeliveryObservationSubjectId(`interleaved-${i}`)!);
    // Interleave: subject 0 queued, subject 1 queued, ..., subject 0 accepted, subject 1 accepted, ...
    for (const s of subjects) repository.record(s, "queued", 1);
    for (const s of subjects) repository.record(s, "publishing", 2);
    for (const s of subjects) repository.record(s, "accepted", 3);
    for (const s of subjects) {
      expect(query.historyFor(s).map((o) => o.state)).toEqual(["queued", "publishing", "accepted"]);
    }
  });

  it("8. query during append -- historyFor() reflects exactly what has been durably recorded so far, never a partial or stale view, never something not yet written", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    repository.record(subjectA, "queued", 1);
    expect(query.historyFor(subjectA)).toHaveLength(1);
    repository.record(subjectA, "publishing", 2);
    expect(query.historyFor(subjectA)).toHaveLength(2);
    repository.record(subjectA, "accepted", 3);
    expect(query.historyFor(subjectA)).toHaveLength(3);
    expect(query.currentStateFor(subjectA)!.state).toBe("accepted");
  });

  it("9. restart against a log missing only its final trailing newline -- valid (not corruption); construction succeeds and the last record is read correctly", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7641-matrix-"));
    const path = join(dir, "observations.log");
    try {
      const seed = new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path));
      seed.record(subjectA, "queued", 1);
      const contents = readFileSync(path, "utf8") as string;
      expect(contents.endsWith("\n")).toBe(true);
      writeFileSync(path, contents.slice(0, -1), "utf8"); // remove ONLY the trailing newline, the JSON itself is untouched
      const rebuilt = new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path));
      const query = new FedosDeliveryObservationQuery(rebuilt);
      expect(query.currentStateFor(subjectA)!.state).toBe("queued");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10. resource-limit exhaustion -- no artificial cap exists; a moderately large distinct-subject count is never silently truncated", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    const COUNT = 5_000;
    for (let i = 0; i < COUNT; i++) {
      repository.record(toFedosDeliveryObservationSubjectId(`limit-subject-${i}`)!, "accepted", i);
    }
    let seen = 0;
    for (let i = 0; i < COUNT; i++) {
      if (query.currentStateFor(toFedosDeliveryObservationSubjectId(`limit-subject-${i}`)!) !== null) seen++;
    }
    expect(seen, "every one of the 5,000 distinct subjects must be resolvable -- no silent cap").toBe(COUNT);
  });

  it("11. stale repository instance -- an OLDER Repository instance never observes a write made through a DIFFERENT, newer instance sharing the same durable persistence, until it is itself reconstructed", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7641-matrix-"));
    const path = join(dir, "observations.log");
    try {
      const stale = new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path));
      const staleQuery = new FedosDeliveryObservationQuery(stale);
      expect(staleQuery.currentStateFor(subjectA)).toBeNull();

      // A SEPARATE, newer instance writes a fact to the SAME durable file.
      const newer = new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path));
      newer.record(subjectA, "accepted", 1);

      // The STALE instance's own in-memory index was built before this write -- it correctly does not see it.
      expect(staleQuery.currentStateFor(subjectA), "a stale instance must not silently see a write it never itself recorded or rebuilt from").toBeNull();

      // Reconstructing (the real "restart") DOES see it.
      const reconstructed = new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(path));
      expect(new FedosDeliveryObservationQuery(reconstructed).currentStateFor(subjectA)!.state).toBe("accepted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
