/**
 * Outbox Flush Reliability arc — closes the "no silent terminal state"
 * gap this arc's own root-cause investigation found: a message that
 * returns `queued` synchronously (already honest, see the Message
 * Delivery Truth arc, `50ffce50`) can be genuinely, permanently rejected
 * on its async background tick, with the outcome recorded ONLY into
 * `FedosDeliveryObservationRepository` via `FedosDeliveryRetryQuery` --
 * nowhere in this codebase's presentation/Shell layer did anything read
 * that fact back before this file existed (confirmed by a source-wide
 * search: zero references to `FedosDeliveryObservationQuery`/
 * `FedosDeliveryRetryQuery` outside `board/observation` and the
 * transport layer itself). This file is the ONE pure mapping from that
 * already-real, already-durable fact to a closed, presentation-safe
 * vocabulary a renderer can honestly show -- mirrors
 * `FedosDirectRatchetSafeStatus`'s own established "closed vocabulary,
 * never raw internals" precedent exactly.
 *
 * Deliberately conservative: `"not-yet-attempted"` covers BOTH "genuinely
 * never queued" and "queued but no attempt has been recorded yet" --
 * this file has no way to distinguish those two without also being
 * handed the raw Outbox persistence (out of scope for a pure status
 * mapper), so it never claims more than the Observation history alone
 * can prove.
 */
import type { FedosDeliveryRetryAttemptState } from "../../../board/observation/fedos_delivery_retry_query.js";

/**
 * Closed, safe, UI-facing vocabulary for "what actually happened to this
 * one logical send, as far as the real Delivery Observation history can
 * prove" -- never inferred from the synchronous enqueue result alone.
 */
export type FedosConversationDeliveryStatus =
  /** No attempt has been recorded yet for this subject -- either never queued, or queued but not yet ticked. */
  | "not-yet-attempted"
  /** An attempt is currently in flight (its own terminal outcome has not yet been recorded). */
  | "attempting"
  /** The most recent attempt was genuinely accepted by at least one relay. */
  | "delivered"
  /** The most recent attempt failed with a retryable outcome (timeout/connection failure/partial rejection) -- a later tick will retry it automatically. */
  | "retrying"
  /** Every relay explicitly, terminally rejected this event -- per this codebase's own Scheduler policy, it will NEVER be retried again. This is the exact state this arc's own root-cause investigation found was previously invisible to any caller. */
  | "rejected";

/**
 * The ONE mapper from `FedosDeliveryRetryQuery`'s own already-real latest-
 * attempt fact to the closed vocabulary above. `null` input means no
 * attempt has ever been recorded (mirrors `currentStateFor()`'s own `null`
 * contract) -- maps to `"not-yet-attempted"`, never fabricated as success.
 */
export function mapFedosDeliveryRetryStateToConversationDeliveryStatus(
  attempt: FedosDeliveryRetryAttemptState | null,
): FedosConversationDeliveryStatus {
  if (attempt === null) return "not-yet-attempted";
  if (attempt.state === "publishing" || attempt.state === "queued") return "attempting";
  if (attempt.state === "accepted") return "delivered";
  if (attempt.state === "rejected") return "rejected";
  // "failed" (timeout/connection failure/partial rejection) is always
  // retried per FedosConversationTransportScheduler's own documented
  // policy UNLESS it was independently marked final -- reflect that
  // exactly rather than assuming either way.
  return attempt.isFinal ? "rejected" : "retrying";
}
