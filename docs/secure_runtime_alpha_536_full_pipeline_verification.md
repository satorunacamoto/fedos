# Secure Runtime Alpha 536 — Full Pipeline Verification

Stage 16 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage VERIFIES only.** Combines all three named case
groups (Alpha 533/534/535) into ONE Host instance, ONE delivery run,
THREE independent intents — the same multi-intent, no-cross-contamination
shape Alpha 515 already established for the pre-retry-coordination
pipeline, now re-run against retry-coordinated Observation history.

## 1. What is being verified

That `FedosDeliveryRetryRegistry` (Alpha 527) and attempt-scoped
subject identity (Alpha 525) are keyed correctly per ORIGINAL subject —
three intents ticking through the SAME Scheduler, SAME interval timer,
SAME Host, at the SAME time, each accumulate their OWN independent
attempt history, with none of one intent's attempt numbers or terminal
states ever leaking into another's.

## 2. Scenario

Three intents registered on one Host, one `startDelivery()` run long
enough for the retry-chain intent to reach its own final attempt:

- Intent A: always succeeds — exactly 1 attempt, never failed.
- Intent B: fails once, then succeeds — exactly 2 attempts, `[1, 2]`,
  only the second final.
- Intent C: fails three times, then succeeds — at least 4 attempts,
  strictly increasing, only the last final.

## 3. Result

All three intents' own `FedosDeliveryRetryQuery.historyFor()` results
are independently correct and internally consistent (matching Alpha
533/534/535's own single-intent results exactly), confirming the
retry-coordination layer composes correctly under concurrent,
multi-intent load — the full Host → Scheduler → Publisher →
Observation Repository chain (Alpha 513) plus Retry Coordination
(Alpha 521–535) verified together, end to end, in one run.

## 4. See also

- `docs/secure_runtime_alpha_533_case_verification_single_success.md`
- `docs/secure_runtime_alpha_534_case_verification_failure_then_retry_then_success.md`
- `docs/secure_runtime_alpha_535_case_verification_longer_retry_chain.md`
- `docs/secure_runtime_alpha_515_multi_intent_consistency_verification.md`
