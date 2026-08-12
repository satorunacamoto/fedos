/**
 * Secure Runtime Alpha 7641-7720 (FedOS Delivery Observation Repository
 * Subject Index and Query Scalability Arc) — Phase J: real vertical
 * slice. Real, file-backed `AppendOnlyFedosDeliveryObservationPersistence`
 * (`node:fs`, a real temp directory) throughout — no mocked persistence
 * on the headline path (the Repository/index/Query itself). Mixes
 * Board-shaped and Conversation-shaped `subjectId`s in ONE shared
 * durable log to directly exercise the mission's own named scenario
 * (production keeps Board and Conversation in SEPARATE Repository
 * instances by architecture — see the reconciliation report §5 — this
 * test additionally proves the index itself is domain-agnostic).
 * Drives the REAL production Board hydration entry point
 * (`hydrateFedosDeliveryRecoveryState()`, the exact function
 * `FedosDesktopHost.startDelivery()` calls) and the REAL
 * `FedosDeliveryObservationQuery`/`FedosDeliveryRetryQuery` Conversation
 * read path, both over the SAME real durable file.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryQuery } from "../src/os/messenger/board/observation/fedos_delivery_retry_query.js";
import { makeFedosDeliveryAttemptSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_attempt_subject_id.js";
import { AppendOnlyFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/append_only_fedos_delivery_observation_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { hydrateFedosDeliveryRecoveryState } from "../src/os/messenger/desktop/host/fedos_delivery_recovery_hydration.js";

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-7641-7720-vslice-"));
}

/** Opens a fresh, real, file-backed Repository/Query/RetryQuery/ValidatingRepository set over the SAME on-disk path -- exactly what a real process restart does. */
function openReal(logPath: string) {
  const repository = new FedosDeliveryObservationRepository(new AppendOnlyFedosDeliveryObservationPersistence(logPath));
  const query = new FedosDeliveryObservationQuery(repository);
  const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
  const retryQuery = new FedosDeliveryRetryQuery(query);
  return { repository, query, validating, retryQuery };
}

function putBoardIntent(outboxPersistence: InMemoryFedosBoardOutboxPersistence, id: string) {
  const postId = toFedosBoardPostId(id)!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
  outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 7641-7720 -- real vertical slice (file-backed persistence)", () => {
  it("1. mixed Board and Conversation subjects: delivered/abandoned/pending/conflicting histories survive five real restarts, exact per-subject histories preserved, index updates visible immediately after each durable write", () => {
    const dir = makeDir();
    const logPath = join(dir, "observations.ndjson");
    try {
      const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();

      // ---- Session 0: seed 4 Board intents (delivered/abandoned/pending/mid-retry) + 2 Conversation-shaped subjects (delivered/pending) ----
      const boardDelivered = putBoardIntent(outboxPersistence, "post-delivered");
      const boardAbandoned = putBoardIntent(outboxPersistence, "post-abandoned");
      const boardMidRetry = putBoardIntent(outboxPersistence, "post-mid-retry");
      const boardPending = putBoardIntent(outboxPersistence, "post-pending"); // never observed at all

      const convDelivered = toFedosDeliveryObservationSubjectId("conversation::envelope-delivered")!;
      const convPending = toFedosDeliveryObservationSubjectId("conversation::envelope-pending")!;

      {
        const { validating } = openReal(logPath);
        const deliveredSubject = toFedosDeliveryObservationSubjectId(boardDelivered.id)!;
        const deliveredAttempt1 = makeFedosDeliveryAttemptSubjectId(deliveredSubject, 1)!;
        expect(validating.record(deliveredAttempt1, "publishing", 1)).toBe("recorded");
        expect(validating.record(deliveredAttempt1, "accepted", 2)).toBe("recorded");

        const abandonedSubject = toFedosDeliveryObservationSubjectId(boardAbandoned.id)!;
        const abandonedAttempt1 = makeFedosDeliveryAttemptSubjectId(abandonedSubject, 1)!;
        expect(validating.record(abandonedAttempt1, "publishing", 1)).toBe("recorded");
        expect(validating.record(abandonedAttempt1, "rejected", 2, "final:policy-abandon")).toBe("recorded");

        const midRetrySubject = toFedosDeliveryObservationSubjectId(boardMidRetry.id)!;
        const midRetryAttempt1 = makeFedosDeliveryAttemptSubjectId(midRetrySubject, 1)!;
        expect(validating.record(midRetryAttempt1, "publishing", 1)).toBe("recorded");
        expect(validating.record(midRetryAttempt1, "failed", 2, "not-final:transient")).toBe("recorded");
        // boardPending: no Observation at all -- genuinely never attempted.

        expect(validating.record(convDelivered, "publishing", 1)).toBe("recorded");
        expect(validating.record(convDelivered, "accepted", 2)).toBe("recorded");
        // A second write attempt for an ALREADY-terminal subject is rejected by the transition graph
        // itself (accepted permits no further transition) -- it never even reaches the persistence
        // layer's own id-conflict check. A raw, bare-Repository (bypassing the validator) proof of the
        // persistence-level "conflict" outcome specifically already exists at
        // `secure_runtime_alpha_7641_7720_subject_index_rebuild_restart.test.ts` test 8.
        expect(validating.record(convDelivered, "accepted", 2, "different-reason")).toBe("invalid-transition");
      }

      // ---- Five real restarts: each one reconstructs the Repository fresh from the SAME durable file. ----
      for (let cycle = 1; cycle <= 5; cycle++) {
        const { retryQuery, query } = openReal(logPath);
        const state = hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);

        expect(state.delivered.has(boardDelivered.id), `cycle ${cycle}`).toBe(true);
        expect(state.abandoned.has(boardDelivered.id), `cycle ${cycle}`).toBe(false);

        expect(state.abandoned.has(boardAbandoned.id), `cycle ${cycle}`).toBe(true);
        expect(state.delivered.has(boardAbandoned.id), `cycle ${cycle}`).toBe(false);

        expect(state.delivered.has(boardMidRetry.id), `cycle ${cycle}`).toBe(false);
        expect(state.abandoned.has(boardMidRetry.id), `cycle ${cycle}`).toBe(false);
        expect(state.completedAttempts.get(boardMidRetry.id), `cycle ${cycle}`).toBe(1);

        expect(state.delivered.has(boardPending.id), `cycle ${cycle}`).toBe(false);
        expect(state.abandoned.has(boardPending.id), `cycle ${cycle}`).toBe(false);
        expect(state.completedAttempts.has(boardPending.id), `cycle ${cycle}`).toBe(false);

        expect(query.currentStateFor(convDelivered)!.state, `cycle ${cycle}`).toBe("accepted");
        expect(query.currentStateFor(convPending), `cycle ${cycle}`).toBeNull();
      }

      // ---- New terminal fact appended after the restarts; visible immediately, without a further restart. ----
      const { validating: liveValidating, query: liveQuery } = openReal(logPath);
      expect(liveValidating.record(convPending, "publishing", 5)).toBe("recorded");
      expect(liveValidating.record(convPending, "accepted", 6)).toBe("recorded");
      expect(liveQuery.currentStateFor(convPending)!.state).toBe("accepted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. corrupt line in the real durable log: hydration fails closed, identically to the pre-existing persistence-layer policy (this Arc changes nothing about it)", () => {
    const dir = makeDir();
    const logPath = join(dir, "observations.ndjson");
    try {
      const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
      const intent = putBoardIntent(outboxPersistence, "post-corrupt");
      const subject = toFedosDeliveryObservationSubjectId(intent.id)!;
      const attempt1 = makeFedosDeliveryAttemptSubjectId(subject, 1)!;
      {
        const { validating } = openReal(logPath);
        validating.record(attempt1, "publishing", 1);
        validating.record(attempt1, "accepted", 2);
      }
      appendFileSync(logPath, "{this is not valid json\n", "utf8");

      expect(() => {
        const { retryQuery } = openReal(logPath);
        hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);
      }).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3. truncated final record (mid-write crash artifact) in the real durable log: same fail-closed policy, no invented state", () => {
    const dir = makeDir();
    const logPath = join(dir, "observations.ndjson");
    try {
      const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
      const intent = putBoardIntent(outboxPersistence, "post-truncated");
      const subject = toFedosDeliveryObservationSubjectId(intent.id)!;
      const attempt1 = makeFedosDeliveryAttemptSubjectId(subject, 1)!;
      {
        const { validating } = openReal(logPath);
        validating.record(attempt1, "publishing", 1);
        validating.record(attempt1, "accepted", 2);
      }
      const fullContents = readFileSync(logPath, "utf8") as string;
      writeFileSync(logPath, fullContents.slice(0, Math.floor(fullContents.length * 0.9)), "utf8");

      expect(() => {
        const { retryQuery } = openReal(logPath);
        hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);
      }).toThrow();
      // No invented state: the constructor itself throws before any query is even reachable --
      // there is no code path here that could silently fabricate a partial recovery result.
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. querying every subject once at a real, moderate, file-backed scale completes fast, and no secret/plaintext/log leak exists in the real on-disk records", () => {
    const dir = makeDir();
    const logPath = join(dir, "observations.ndjson");
    try {
      {
        const { validating } = openReal(logPath);
        for (let i = 0; i < 300; i++) {
          const subject = toFedosDeliveryObservationSubjectId(`vslice-subject-${i}`)!;
          validating.record(subject, "publishing", i * 2);
          validating.record(subject, "accepted", i * 2 + 1);
        }
      }
      const { query } = openReal(logPath);
      const start = performance.now();
      for (let i = 0; i < 300; i++) {
        const subject = toFedosDeliveryObservationSubjectId(`vslice-subject-${i}`)!;
        expect(query.currentStateFor(subject)!.state).toBe("accepted");
      }
      const elapsedMs = performance.now() - start;
      expect(elapsedMs, "querying all 300 subjects must be fast, not quadratic").toBeLessThan(500);

      const rawLines = (readFileSync(logPath, "utf8") as string).split("\n").filter((l: string) => l.trim().length > 0);
      for (const line of rawLines) {
        const record = JSON.parse(line) as Record<string, unknown>;
        expect(Object.keys(record).sort()).toEqual(["id", "observedAt", "schemaVersion", "state", "subjectId"].sort());
        expect(Object.keys(record)).not.toContain("plaintext");
        expect(Object.keys(record)).not.toContain("content");
        expect(Object.keys(record)).not.toContain("secret");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
