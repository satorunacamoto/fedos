/**
 * Secure Runtime Alpha 566 ("Abandonment Policy Decision") / Alpha 568
 * ("Abandonment Enforcement") — Stages 6/8 of the Alpha 561–580 Publish
 * Scheduler Concurrency Safety & Abandonment Policy Arc.
 *
 * Closes Alpha 551's own finding (`docs/secure_runtime_alpha_551_publish_runtime_retry_semantics_audit.md`):
 * `FAILED_LATER_RESULT` is the sole fallback for a thrown/malformed
 * `Publisher.publish()` return, so a permanently-crashing `Publisher`
 * for one intent is retried forever — there is no "give up after N
 * failures" concept anywhere in `FedosPublishScheduler`, because that
 * decision does not belong to the `Publisher` (which only ever reports
 * `"immediate" | "later" | "never"` for ONE attempt, per
 * `docs/secure_runtime_alpha_474_retry_policy_model.md`) and must not be
 * invented inside the Publisher-result vocabulary itself.
 *
 * `FedosDeliveryAbandonmentPolicy` is a pure, OPTIONAL, injected
 * boundary `FedosPublishScheduler` consults only when a Publisher's own
 * result was NOT already `"never"` — never a replacement for it, always
 * an additional, independent check. Option E from Alpha 566's own
 * comparison (explicit policy injection, NO shipped default) was
 * chosen over a hardcoded max-attempts/max-elapsed-time/protocol-table
 * default: `docs/secure_runtime_alpha_559_publish_runtime_recommendations.md`
 * (the Arc that named this work) explicitly left "how many times" an
 * open question for THIS Arc to decide, and no prior Stage anywhere in
 * this repository's own history already commits to a specific number —
 * inventing one now (3, 5, or otherwise) would be exactly the
 * unjustified magic-number decision this Arc's own instruction forbids.
 * A production default, if one is ever adopted, belongs to whichever
 * future Arc actually wires a real caller (`FedosDesktopHost`/
 * `create_fedos_desktop_host.ts` — see
 * `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`).
 *
 * HARD GUARDRAILS:
 *   - No import from `../../nostr/*`, `../../desktop/*`, `../*` (Board
 *     core, including `../observation/*` and `../publish/*`), or any
 *     Relay/signing/transport/Ontology/p2p/GUI file anywhere in this
 *     file — mirrors `fedos_publish_scheduler.ts`'s own guardrail,
 *     since this policy boundary is consulted BY the Scheduler and must
 *     stay just as protocol/layer-neutral.
 *   - `evaluate()` is synchronous and pure — no `await`, no I/O, no
 *     mutation of its own input. A policy that needs durable history
 *     reads it BEFORE calling `evaluate()`, never inside it.
 *   - This file ships no default policy instance — only the contract
 *     and one example implementation (`createFedosMaxAttemptsAbandonmentPolicy`)
 *     callers may opt into explicitly; `FedosPublishScheduler` never
 *     constructs one itself.
 */

import type { FedosBoardOutboxId } from "./fedos_board_outbox_types.js";
import type { FedosBoardOutboxPublishOutcome } from "./fedos_board_outbox_publisher.js";

export type FedosDeliveryAbandonmentDecision = "retry" | "abandon";

export interface FedosDeliveryAbandonmentPolicyInput {
  readonly outboxId: FedosBoardOutboxId;
  /** Count of completed (non-`"delivered"`) logical attempts for this intent, ACROSS `tick()` calls — never counts the same-`tick()` `"immediate"` re-attempt as a second completed attempt (see `fedos_publish_scheduler.ts` `#attemptIntent()`). */
  readonly completedAttempts: number;
  readonly latestOutcome: FedosBoardOutboxPublishOutcome;
}

export interface FedosDeliveryAbandonmentPolicy {
  evaluate(input: FedosDeliveryAbandonmentPolicyInput): FedosDeliveryAbandonmentDecision;
}

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

/**
 * ONE example implementation, opt-in only — not this Arc's own
 * production recommendation, not constructed by default anywhere.
 * `maxAttempts` MUST be supplied explicitly by the caller; there is no
 * fallback value in this function's own signature, so a caller cannot
 * accidentally inherit an unjustified number by omission.
 */
export function createFedosMaxAttemptsAbandonmentPolicy(maxAttempts: number): FedosDeliveryAbandonmentPolicy {
  if (!isPositiveInteger(maxAttempts)) {
    throw new Error("createFedosMaxAttemptsAbandonmentPolicy requires a positive, finite integer maxAttempts.");
  }
  return {
    evaluate(input: FedosDeliveryAbandonmentPolicyInput): FedosDeliveryAbandonmentDecision {
      return input.completedAttempts >= maxAttempts ? "abandon" : "retry";
    },
  };
}
