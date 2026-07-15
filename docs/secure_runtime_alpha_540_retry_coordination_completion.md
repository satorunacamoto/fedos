# Secure Runtime Alpha 540 — Retry Coordination Completion Report

Stage 20 (final) of the Alpha 521–540 Durable Delivery Retry
Coordination Arc.

## 1. What this Arc delivers

Resolves the `invalid-transition` limitation the Alpha 501–520 Arc
discovered and honestly documented: Observation history can now
correctly express "1回目 → Retry → Retry → Final" for any single
delivery intent, with zero `invalid-transition` rejections, at any
retry-chain length.

## 2. Implementation targets, mapped to what was built

- **Observation Model**: reused, byte-for-byte unchanged (Alpha 462).
- **Retry Attempt**: `makeFedosDeliveryAttemptSubjectId()`/
  `parseFedosDeliveryAttemptSubjectId()`
  (`src/board/observation/fedos_delivery_attempt_subject_id.ts`,
  Alpha 525) — Attempt番号, as a subject-identity convention.
- **Retry History**: `FedosDeliveryRetryQuery.historyFor()`
  (`src/board/observation/fedos_delivery_retry_query.ts`, Alpha 528) —
  History保持, read across all attempts for one original subject.
- **Retry Counter**: `FedosDeliveryRetryRegistry`
  (`src/board/observation/fedos_delivery_retry_registry.ts`, Alpha
  527) — monotonically-increasing Attempt番号 allocation per subject,
  persisted for a Host instance's own lifetime (Alpha 531 fix).
- **Current State**: `FedosDeliveryRetryQuery.currentStateFor()` —
  CurrentState計算, the latest attempt's own state.
- **Validation**: reused, byte-for-byte unchanged (Alpha 494/495) —
  the fix lives entirely at the subject-identity layer, never the
  transition graph.
- **Observation Query**: reused, byte-for-byte unchanged (Alpha 466) —
  `FedosDeliveryRetryQuery` wraps it, never replaces it.

`Attempt開始`/`Attempt終了` are the bridged `publishing`/terminal
observation pair `FedosHostDeliveryController` records per attempt
(Alpha 529). `RetryReason`/`FinalState` are encoded via
`encodeFedosDeliveryRetryReason()`/`decodeFedosDeliveryRetryReason()`
(`src/board/observation/fedos_delivery_retry_reason_codec.ts`, Alpha
526) into the Observation's own pre-existing `reason` field.

## 3. Constraints honored

- **Scheduler変更最小**: `FedosPublishScheduler` — ZERO changes (the
  achievable minimum).
- **Publisher変更禁止**: every file under `src/board/publish/` — ZERO
  changes.
- **Outbox変更禁止**: every file under `src/board/outbox/` — ZERO
  changes.
- **Host API変更禁止**: `FedosDesktopHost`'s public API — byte-for-byte
  unchanged in shape (`start()`/`stop()`/`startDelivery()`/
  `stopDelivery()`/`deliveryStatus()`/`observationQuery()`); one
  PRIVATE field (`#deliveryRetryRegistry`) was added to fix a real bug
  found during ripple review (§5), which is internal state, not API.

## 4. 禁止 confirmed absent

Ontology, P2P, GUI, Cloudflare, Worker, and any new outbound protocol
— confirmed absent from every file this Arc touches (Alpha 532).

## 5. One real bug found and fixed, disclosed honestly

Ripple-testing the pre-existing Alpha 501–520 test suite against this
Arc's own new code surfaced a genuine, previously-latent bug:
`FedosDesktopHost.startDelivery()` constructed a fresh
`FedosDeliveryRetryRegistry` on every call, silently losing attempt
numbering across a `stopDelivery()`/`startDelivery()` cycle for a
still-pending intent. Fixed with one new private Host field,
persisted for the instance's own lifetime (Alpha 531). This was not
anticipated by the original design (Alpha 522) — the design doc itself
was corrected in place, honestly, rather than silently rewritten
(Alpha 522 §2 "Correction").

## 6. Verification — Verification（全ケース確認）

All three named case groups confirmed twice each — once with a
deterministic injected-clock unit test (Alpha 529), once through the
FULL real `FedosDesktopHost`/`FedosPublishScheduler`/real-wall-clock
pipeline (Alpha 533/534/535), and once more composed together under
concurrent multi-intent load with zero cross-contamination (Alpha
536):

- **accepted**: single first-attempt success, zero retries.
- **failed → retry → accepted**: one failure, one successful retry,
  exactly two attempts, the ORIGINAL scenario the Alpha 501–520 Arc
  found `invalid-transition` on — now resolved.
- **retry → failed → retry → retry → accepted** (a longer chain: three
  failures, each individually retried, then a final success): four
  attempts, strictly increasing, only the last final.

## 7. Final checks

- `npm run typecheck` (`npx tsc --noEmit -p .`): clean for every file
  this Arc touches; one unrelated, pre-existing error remains outside
  this Arc's own diff (Alpha 538 §1).
- This Arc's own focused batch (`test/secure_runtime_alpha_5[0-3][0-9]*.test.ts`):
  38 files, 145 tests, stable across five separate full runs (Alpha
  531 §5, Alpha 538 §2–3).
- Full repository suite: 210 pre-existing, unrelated files fail on
  stale hardcoded Rust/Cargo dependency-count assertions that pre-date
  this Arc and share zero file overlap with it — disclosed honestly,
  not hidden, not fixed (out of this Arc's own scope; Alpha 538 §4).
- `git status --porcelain`: 28 new files, 10 modified pre-existing
  files, all named and accounted for (Alpha 539).
- README updated (Alpha 537), nested beneath the prior Alpha 501–520
  status banner.

## 8. What was NOT done (intentionally, out of scope)

No backoff/delay scheduling algorithm (retry TIMING remains entirely
`FedosPublishScheduler`'s own, Alpha 476, unchanged). No maximum
retry-count cap (the design is unbounded by construction; whether to
add one is a future Arc's own decision). No UI/GUI surface for retry
history. No new persistence backend — `FedosDeliveryRetryRegistry` is
in-memory only, scoped to one Host instance's own process lifetime,
matching every other in-memory-first component this Arc touches.

## 9. Recommended next Arc

A future Arc could persist `FedosDeliveryRetryRegistry`'s own counts
durably (surviving process restart, not just `stopDelivery()`/
`startDelivery()` cycles within one process), if cross-restart retry
numbering continuity is ever required — not needed by anything this
Arc's own spec named, and explicitly out of scope here.

## 10. See also

- `docs/secure_runtime_alpha_521_retry_coordination_inventory.md`
- `docs/secure_runtime_alpha_529_controller_retry_rewiring.md`
- `docs/secure_runtime_alpha_531_ripple_review.md`
- `docs/secure_runtime_alpha_536_full_pipeline_verification.md`
- `docs/secure_runtime_alpha_539_git_diff_confirmation.md`
