# Secure Runtime Alpha 591–599 — Regression Review

Stages 11–19 (consolidated, per this Arc's own instruction grouping) of
the Alpha 581–600 Durable Retry Registry & Delivery Recovery Arc.

## Method

Identical discipline to the prior Arc's own Alpha 578: `npm run
typecheck` and a scoped `npm test` sweep, BEFORE this Arc's own edits
(`git stash`) and AFTER, diffed.

## `npm run typecheck`

Identical before and after: exactly one pre-existing, unrelated error
(`test/secure_runtime_alpha_477_...test.ts:121`, unchanged since Alpha
560/580). Zero new errors from this Arc's own changes.

## `npm test` — scoped sweep

`test/secure_runtime_alpha_4*` + `test/secure_runtime_alpha_5*`
(includes this Arc's own 5 new files): 170 files / 915 tests total at
this Arc's own final state, 157 files / 902 tests passing. The 13
failing files are the IDENTICAL 13 (by file and test name) confirmed
pre-existing at the START of this Arc, before any of its own edits —
the same environment-level (this worktree's own CRLF checkout
artifact, already characterized in the prior Arc's own Alpha 578)
failures, re-confirmed unchanged in count and identity across this
Arc's own two intermediate regression-isolation `git stash` checks
(used to distinguish "pre-existing" from "newly broken by this Arc's
own edits" for the three items below).

## Three genuine, in-scope regressions found in prior-Arc regression-guard tests — all fixed, not weakened

Isolated the same way as the prior Arc's own Alpha 578: diffing this
Arc's own full targeted run against a `git stash`-restored baseline.

- **Alpha 522** (`...retry_coordination_scope_decision`): its own line
  26 (`not.toMatch(/RetryQuery|AttemptSubjectId/)`) enforces that
  `fedos_desktop_host.ts`'s own source text never names attempt-level
  query internals. An early draft of this Arc's own hydration wiring
  violated it directly (and, once fixed at the call-site level, a
  LEFTOVER doc-comment inside `fedos_desktop_host.ts` itself ALSO
  contained the literal string `"FedosDeliveryRetryQuery"` and had to
  be reworded — found by re-running this exact test, not by manual
  review alone). Resolved by `createFedosDeliveryScheduler()` (Alpha
  585) — the Host's own source now names no such concept anywhere,
  confirmed by the SAME still-unweakened check.
- **Alpha 531** (`...ripple_review`): its own `accountedForSrc`
  allowlist (a live `git status`-based check) did not yet know about
  `src/board/observation/fedos_delivery_retry_registry.ts` — a file
  this Arc legitimately, additively modifies (`hydrateAttemptCount()`).
  Added to the allowlist with an explicit, dated comment, mirroring the
  prior Arc's own identical treatment of `fedos_publish_scheduler.ts`.
- **Alpha 539** (`...git_diff_confirmation`): its own "zero deleted
  lines" claim for `fedos_desktop_host.ts` held only through Alpha
  501–520; this Arc's own construction-site swap (Alpha 586) is a
  reviewed, bounded 2-line deletion (an import, and the inline
  `new FedosPublishScheduler({...})` call), not a behavior removal.
  Re-scoped to "as of Alpha 501–520," with a `<= 2` ceiling replacing
  the unconditional `=== 0`, so the check still catches an UNBOUNDED
  future deletion while permitting this Arc's own reviewed one.

## One prior-Arc test that FAILED because this Arc's own fix WORKED

`test/secure_runtime_alpha_574_host_lifecycle_verification.test.ts`'s
own cycling test previously asserted `calls === 6` as a DOCUMENTED,
honest limitation (Alpha 573/574, prior Arc). This Arc's own fix makes
that count `3` instead — the test failing was the intended, correct
signal that the limitation it documented is now closed; updated to
assert the new, correct count with a before/after comment, not a
weakened or removed assertion.

## Confirmed, per this Arc's own Absolute Requirements

- `git diff -- package.json` and `git diff -- packages/fedos-core-rust/Cargo.toml`:
  both empty — no new npm dependency, no Rust file touched (`cargo
  check` correctly NOT run, per this Arc's own instruction).
- `git status --porcelain | grep -i p2p`: no output — `p2p/` untouched.
- No file under Ontology Engine, Humanizer, AI, Runtime crypto, or
  Worker runtime paths appears anywhere in this Arc's own changed-file
  list (see `docs/secure_runtime_alpha_600_durable_retry_registry_completion.md`
  for the full list).

## See also

- `docs/secure_runtime_alpha_578_publish_runtime_compatibility_review.md`
  (the prior Arc's own identical-discipline predecessor)
- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
