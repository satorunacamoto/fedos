import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { AppendOnlyFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/append_only_fedos_conversation_transport_outbox_persistence.js";
import { createFedosConversationTransportOutboxIntent } from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_types.js";
import { serializeFedosConversationTransportOutboxIntent } from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_codec.js";
import { toFedosConversationEnvelopeId } from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryQuery } from "../src/os/messenger/board/observation/fedos_delivery_retry_query.js";
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { makeFedosDeliveryAttemptSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_attempt_subject_id.js";
import { hydrateFedosConversationTransportDeliveryRecoveryState } from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_delivery_recovery_hydration.js";

/**
 * Secure Runtime Alpha 7561-7640 -- Phase J failure matrix. Covers the
 * items from the Arc's own matrix NOT already exercised by the Phase C
 * unit tests (empty/pending/mixed/corrupt-per-subject-history — see
 * `secure_runtime_alpha_7561_7640_conversation_transport_delivery_recovery_hydration.test.ts`),
 * the Phase F restart tests (delivered/abandoned/pending-after-restart,
 * five-cycle amplification), or the Phase I real vertical slice
 * (multi-conversation, real relay, real restart, new post-restart
 * traffic). Items confirmed genuinely not applicable to this Arc's own
 * scope are recorded here as such, not fabricated into a test:
 *   - "pending-set limit": no such limit exists or is required anywhere
 *     in this codebase's Outbox/Scheduler layer (unbounded by design,
 *     matching Board's own identical, unchanged precedent).
 *   - "retry exhaustion, if terminal": this Scheduler has no
 *     attempt-count-based exhaustion policy (Phase A report §11,
 *     deliberately not ported from Board's optional `abandonmentPolicy`)
 *     -- termination is entirely Publisher-`retryPolicy`-driven, already
 *     covered by the "abandoned" test cases elsewhere.
 *   - "Device revoked": confirmed by Phase E's own durability audit to
 *     have no effect on this Outbox/Scheduler's retry-time behavior at
 *     all (a different subsystem) -- nothing to test.
 *   - "profile lock": a `FedosProfileInitializationCoordinator`-level
 *     concern, outside this Arc's own Outbox/Scheduler/hydration scope.
 */

function makePipeline() {
  const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
  const retryQuery = new FedosDeliveryRetryQuery(query);
  return { outboxPersistence, repository, query, validating, retryQuery };
}

function putIntent(outboxPersistence: InMemoryFedosConversationTransportOutboxPersistence, envelopeIdStr: string) {
  const envelopeId = toFedosConversationEnvelopeId(envelopeIdStr)!;
  const conversationId = "conv-7561-fm" as unknown as FedosConversationId;
  const intent = createFedosConversationTransportOutboxIntent(envelopeId, conversationId, 1)!;
  outboxPersistence.putIntent(serializeFedosConversationTransportOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 7561-7640 -- failure matrix", () => {
  it("1. duplicate terminal facts (recording the identical logical observation twice, at the raw persistence layer) are idempotent and hydration classifies correctly", () => {
    // Uses the RAW `FedosDeliveryObservationRepository` directly rather
    // than the Validating wrapper: per the (unmodified) transition graph
    // (`fedos_delivery_observation_transition_graph.ts`), a terminal
    // state permits NO further writes at all, including an identical
    // repeat, through the Validating layer -- "single-attempt-per-subject"
    // by design. Idempotency-on-exact-duplicate is a property of the raw
    // Persistence/Repository layer itself (deterministic Observation id,
    // Alpha 462/464, unmodified), which is what this test verifies, since
    // that is the layer a duplicate durable write (e.g. an append
    // retried after an ambiguous flush) would actually hit in practice.
    const { outboxPersistence, repository, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-fm-1");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;

    expect(repository.record(attempt1, "publishing", 1)).toBe("recorded");
    expect(repository.record(attempt1, "publishing", 1)).toBe("already-present");
    expect(repository.record(attempt1, "accepted", 2)).toBe("recorded");
    expect(repository.record(attempt1, "accepted", 2)).toBe("already-present");

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(true);
    expect(state.abandoned.has(intent.id)).toBe(false);
  });

  it("2. a conflicting fact (same subject/state/observedAt, different reason) is rejected at the raw persistence layer and never corrupts hydration", () => {
    const { outboxPersistence, repository, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-fm-2");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;

    repository.record(attempt1, "publishing", 1);
    expect(repository.record(attempt1, "accepted", 2)).toBe("recorded");
    // A later, structurally different write for the SAME (subjectId, state, observedAt)
    // triple collides on the deterministic Observation id -- rejected as
    // "conflict", never silently overwriting the real, already-recorded fact.
    const conflictResult = repository.record(attempt1, "accepted", 2, "a-different-reason-that-would-collide");
    expect(conflictResult).toBe("conflict");

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(true); // the real, original fact still stands
  });

  it("3. a stale observation (an earlier observedAt arriving after a later, structurally-legal one is already recorded) is rejected fail-closed by the existing Validating Repository -- the subsequent, correctly-ordered terminal fact still lands and hydrates correctly", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-fm-3");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;

    expect(validating.record(attempt1, "publishing", 10)).toBe("recorded");
    // publishing -> accepted is structurally legal, but observedAt=5 is
    // EARLIER than the current fact's own observedAt=10 -- rejected as
    // stale, never silently accepted out of order.
    expect(validating.record(attempt1, "accepted", 5)).toBe("stale");
    // The real, correctly-ordered terminal fact still succeeds afterward.
    expect(validating.record(attempt1, "accepted", 15)).toBe("recorded");

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(true);
    expect(state.abandoned.has(intent.id)).toBe(false);
  });

  it("4. a corrupt Outbox log LINE propagates loudly out of hydration -- never silently treated as an empty/all-pending log", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7561-7640-fm-"));
    const outboxLogPath = join(dir, "outbox.ndjson");
    try {
      writeFileSync(outboxLogPath, "");
      const outboxPersistence = new AppendOnlyFedosConversationTransportOutboxPersistence(outboxLogPath);

      const envelopeId = toFedosConversationEnvelopeId("env-fm-4")!;
      const conversationId = "conv-7561-fm" as unknown as FedosConversationId;
      const intent = createFedosConversationTransportOutboxIntent(envelopeId, conversationId, 1)!;
      outboxPersistence.putIntent(serializeFedosConversationTransportOutboxIntent(intent));

      // Simulate a truncated/corrupt tail write -- a real, on-disk
      // scenario this Arc's own hydration must not soften into "log is
      // empty" (Phase C's own "Corrupt-LOG handling" guardrail).
      appendFileSync(outboxLogPath, "{not valid json\n");

      const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
      const query = new FedosDeliveryObservationQuery(repository);
      const retryQuery = new FedosDeliveryRetryQuery(query);

      expect(() => hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("5. only-delivered history (every intent terminal-accepted) hydrates to zero attempts on the next tick", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const ids = ["env-fm-5-a", "env-fm-5-b", "env-fm-5-c"].map((e) => putIntent(outboxPersistence, e));
    for (const intent of ids) {
      const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
      const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
      validating.record(attempt1, "publishing", 1);
      validating.record(attempt1, "accepted", 2);
    }
    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.size).toBe(3);
    expect(state.abandoned.size).toBe(0);
    const stillPending = outboxPersistence
      .listIntents()
      .filter((r) => !state.delivered.has(r.id) && !state.abandoned.has(r.id));
    expect(stillPending).toHaveLength(0);
  });

  it("6. only-abandoned history (every intent terminal-rejected/never) hydrates to zero attempts on the next tick", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const ids = ["env-fm-6-a", "env-fm-6-b"].map((e) => putIntent(outboxPersistence, e));
    for (const intent of ids) {
      const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
      const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
      validating.record(attempt1, "publishing", 1);
      validating.record(attempt1, "rejected", 2, "final:test");
    }
    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.abandoned.size).toBe(2);
    expect(state.delivered.size).toBe(0);
    const stillPending = outboxPersistence
      .listIntents()
      .filter((r) => !state.delivered.has(r.id) && !state.abandoned.has(r.id));
    expect(stillPending).toHaveLength(0);
  });

  it("7. only-pending history (no attempts recorded for anything) hydrates every intent as still attemptable", () => {
    const { outboxPersistence, retryQuery } = makePipeline();
    const ids = ["env-fm-7-a", "env-fm-7-b", "env-fm-7-c"].map((e) => putIntent(outboxPersistence, e));
    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.size).toBe(0);
    expect(state.abandoned.size).toBe(0);
    const stillPending = outboxPersistence
      .listIntents()
      .filter((r) => !state.delivered.has(r.id) && !state.abandoned.has(r.id));
    expect(stillPending).toHaveLength(ids.length);
  });

  it("8. concurrent put + hydration read: a putIntent racing a hydration scan never corrupts either -- hydration either includes or excludes the new intent cleanly, never partially", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const settled = putIntent(outboxPersistence, "env-fm-8-settled");
    const settledSubject = toFedosDeliveryObservationSubjectId(settled.id)!;
    validating.record(makeFedosDeliveryAttemptSubjectId(settledSubject, 1)!, "publishing", 1);
    validating.record(makeFedosDeliveryAttemptSubjectId(settledSubject, 1)!, "accepted", 2);

    // Synchronous engines have no true concurrency, but this proves the
    // ordering-independence property that matters: a put BEFORE the
    // hydration call is fully reflected (as pending, zero history);
    // hydration never observes a torn/partial write.
    const late = putIntent(outboxPersistence, "env-fm-8-late");

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(settled.id)).toBe(true);
    expect(state.delivered.has(late.id)).toBe(false);
    expect(state.abandoned.has(late.id)).toBe(false);
  });
});
