/**
 * Secure Runtime Alpha 7561–7640 ("FedOS Conversation Outbox Restart
 * Hydration and Scheduler Scalability Arc") — Phase C.
 *
 * `hydrateFedosConversationTransportDeliveryRecoveryState()` derives
 * `FedosConversationTransportScheduler`'s own startup recovery state
 * (`initialDelivered`/`initialAbandoned`, the SAME optional constructor
 * seam that class has declared since Alpha 1471–1540 but that its one
 * production construction site — `FedosPrivateTransport`
 * (`./fedos_private_transport.ts`) — has never populated) FROM the
 * EXISTING durable Delivery Observation history alone
 * (`FedosDeliveryRetryQuery.historyFor()`, Alpha 528, UNCHANGED). This
 * file introduces NO new persistence backend, NO new schema, and NO new
 * npm dependency. It reads; it never writes.
 *
 * Ports `hydrateFedosDeliveryRecoveryState()`'s own proven pattern
 * (`../../desktop/host/fedos_delivery_recovery_hydration.ts`, Alpha
 * 585) — same read boundary (`FedosDeliveryRetryQuery`), same
 * per-subject classification rule (latest attempt `"accepted"` ->
 * delivered; latest attempt `isFinal` and not accepted -> abandoned;
 * otherwise left pending), same fail-closed-per-intent discipline. It
 * is NOT a byte-for-byte copy: Board's own version additionally derives
 * `completedAttempts`/`nextAttemptCountBySubject` to seed
 * `FedosPublishScheduler`'s `initialCompletedAttempts` seam and
 * `FedosDeliveryRetryRegistry.hydrateAttemptCount()` — neither seam
 * exists on `FedosConversationTransportScheduler` today (it has no
 * `abandonmentPolicy` concept to consume an attempt count, unlike
 * Board's Scheduler+Controller split — see that class's own header).
 * Per this Arc's own Phase A reconciliation report (§11, §7 — "Decisions
 * this report makes"), adding an unconsumed constructor field purely to
 * mirror Board's shape would be scope creep beyond "port the proven
 * pattern; preserve durability and delivery semantics" — attempt-count
 * reset on restart is a pre-existing, cosmetic (non-correctness-
 * affecting) characteristic of the ALREADY-SHIPPED pattern this file
 * ports, named here rather than silently carried over unexamined.
 *
 * HARD GUARDRAILS (mirrors Alpha 585):
 *   - `hydrateFedosConversationTransportDeliveryRecoveryState` is the
 *     ONLY export.
 *   - Read-only against Persistence/Query — this file performs NO write
 *     of any kind, anywhere.
 *   - Never throws for a single intent's own unreadable/absent history —
 *     an unreadable history is treated as "no recorded history," the
 *     SAME conservative fallback an intent that was never attempted at
 *     all already gets. (A malformed/corrupt Outbox LOG ITSELF is a
 *     separate matter — see "Fail Closed" below.)
 *   - No Publisher, Relay, Nostr, protocol-specific, p2p, or GUI import
 *     of any kind.
 *
 * Fail Closed, restated precisely (identical to Alpha 585's own rule):
 * a delivery-history read failure for one intent NEVER marks that
 * intent delivered or abandoned — it is left exactly as if no history
 * existed, so the Scheduler treats it as still pending and retries it.
 * Marking an unread intent "delivered" or "abandoned" would be the
 * UNSAFE direction (silent data loss or silent stuck intent); leaving
 * it pending costs, at most, one redundant-but-safe extra attempt.
 *
 * Corrupt-LOG handling, an explicit, deliberate scope boundary (Phase A
 * report §13): `outboxPersistence.listIntents()` itself is deliberately
 * NOT wrapped in a try/catch here. `AppendOnlyFedosConversationTransportOutboxPersistence`
 * already fails closed on a corrupt/conflicting log line — it THROWS,
 * uncaught, out of `listIntents()` — and this function must not soften
 * that into a silent empty/all-pending hydration result, which would be
 * the unsafe direction (a corrupted log silently treated as "nothing
 * pending yet" could suppress genuinely pending retries). A caller that
 * wants graceful startup behavior in the face of a corrupt log must
 * handle that at a layer ABOVE this one; this file's own contract is
 * "read the durable facts as they are, or propagate the same failure
 * the persistence layer itself already raises" — never invent a third
 * behavior.
 */

import type { FedosConversationTransportOutboxPersistence } from "./fedos_conversation_transport_outbox_persistence.js";
import { toFedosDeliveryObservationSubjectId, type FedosDeliveryObservationSubjectId } from "../../board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryQuery, type FedosDeliveryRetryAttemptState } from "../../board/observation/fedos_delivery_retry_query.js";

export interface FedosConversationTransportDeliveryRecoveryState {
  /** Outbox record ids whose latest recorded attempt is `"accepted"` — i.e. a Relay accepted it. Never a claim about recipient import (see this file's own header). */
  readonly delivered: ReadonlySet<string>;
  /** Outbox record ids whose latest recorded attempt is terminal (`isFinal`) but NOT `"accepted"` — a Publisher-`"never"` retry directive. */
  readonly abandoned: ReadonlySet<string>;
}

/**
 * Mirrors Alpha 585's own `historyForSafe()` exactly: a read failure for
 * ONE subject's own attempt history (e.g. a corrupt Delivery Observation
 * record affecting that subject) is treated as "no recorded history" —
 * never propagated, never allowed to void recovery for any OTHER
 * subject. This is the safe direction because Observation history is
 * only ever used to UPGRADE an intent from the default (pending) — its
 * absence simply leaves that one intent pending, not lost. This is
 * deliberately distinct from a corrupt OUTBOX log itself (see this
 * file's own header, "Fail Closed" / "Corrupt-LOG handling"), which is
 * never caught here.
 */
function historyForSafe(
  retryQuery: FedosDeliveryRetryQuery,
  subjectId: FedosDeliveryObservationSubjectId,
): readonly FedosDeliveryRetryAttemptState[] {
  try {
    return retryQuery.historyFor(subjectId);
  } catch {
    return [];
  }
}

/**
 * Hydrates `FedosConversationTransportScheduler`'s own
 * `initialDelivered`/`initialAbandoned` startup seed from the already-
 * durable Delivery Observation history alone. Pure — takes a
 * `FedosDeliveryRetryQuery` the caller already owns (mirrors
 * `FedosPrivateTransport`'s own existing construction of a
 * `FedosDeliveryObservationQuery` at Scheduler-construction time; this
 * function adds no new dependency the caller does not already build).
 */
export function hydrateFedosConversationTransportDeliveryRecoveryState(
  outboxPersistence: FedosConversationTransportOutboxPersistence,
  retryQuery: FedosDeliveryRetryQuery,
): FedosConversationTransportDeliveryRecoveryState {
  const delivered = new Set<string>();
  const abandoned = new Set<string>();

  for (const intent of outboxPersistence.listIntents()) {
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id);
    if (subjectId === null) continue;

    const history = historyForSafe(retryQuery, subjectId);
    if (history.length === 0) continue;

    const latest = history[history.length - 1]!;
    if (latest.state === "accepted") {
      delivered.add(intent.id);
      continue;
    }
    if (latest.isFinal) {
      abandoned.add(intent.id);
    }
  }

  return { delivered, abandoned };
}
