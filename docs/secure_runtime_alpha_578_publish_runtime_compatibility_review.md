# Secure Runtime Alpha 578 — Compatibility Review

Stage 18 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Method

Ran `npm run typecheck` and the full `test/` suite BEFORE any of this
Arc's own edits (via `git stash`) to establish a baseline, then again
AFTER, and diffed the two result sets — the same discipline this
repository's own prior Arcs (Alpha 478 §4, Alpha 532) already used, now
applied to this Arc's own changes specifically rather than restated
from a prior Stage.

## `npm run typecheck`

Identical before and after this Arc's own edits: exactly one
pre-existing, unrelated error
(`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
`handlers[0]()` possibly-undefined array access) — the SAME error
`docs/secure_runtime_alpha_560_publish_runtime_operational_review_completion.md`
already documented as pre-existing before this Arc began. This Arc
introduces zero new typecheck errors.

## `npm test` — environment-level pre-existing failures, confirmed unrelated to this Arc

The freshly-created `arc/scheduler-hardening` worktree exhibits ~220
failing test files with NO edits applied at all (confirmed via `git
stash` + re-run before writing any of this Arc's own code). Root cause,
confirmed by direct byte inspection: `packages/fedos-core-rust/Cargo.toml`
(and other files) were checked out with CRLF line endings in this
worktree (`core.autocrlf=true`) while the main worktree's own copy of
the SAME file, checked out earlier, has LF — byte-identical content
after CRLF normalization (`tr -d '\r'`), confirmed directly, not
assumed. This is a pre-existing checkout artifact of THIS worktree's
own creation, not a code defect, not something this Arc's own Absolute
Prohibitions permit fixing (no `Cargo.toml` change, no global git
config change). A scoped run limited to the files this Arc's own
Objective actually touches (`test/secure_runtime_alpha_4*`,
`test/secure_runtime_alpha_5*`) shows exactly 13 failing files both
BEFORE and AFTER this Arc's own edits — the SAME 13, unchanged in
count or identity, all doc-content/CRLF-sensitive assertions unrelated
to Scheduler/Controller code (e.g. Alpha 400/402/405/409/410/472/473/
478/480/532/537/539/543's own "the design doc recommends..." checks).

## Five prior-Arc regression-guard tests genuinely broken by this Arc's OWN intentional changes — all updated, all now passing

Isolated by diffing the SAME 18-file targeted run against the `git
stash`-restored baseline (13 pre-existing + 5 newly broken = 18):

- **Alpha 479 / Alpha 486** (`...scope_and_security_regression_guards`,
  `...scheduler_protocol_agnosticism_review`): both enforce an
  import-naming convention — every sibling import under
  `src/board/outbox/` must match `^\./fedos_board_outbox_`. This Arc's
  new file was originally named `fedos_delivery_abandonment_policy.ts`,
  violating that convention; renamed to
  `fedos_board_outbox_abandonment_policy.ts` to match every existing
  sibling in that directory, rather than weakening the guard.
- **Alpha 512 / Alpha 519** (`...security_regression_guards`,
  `...git_diff_confirmation`): both asserted the EXACT literal string
  `"async tick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {"`
  as a structural spot-check that the Scheduler was untouched BY THEIR
  OWN ARC (Alpha 501–520). Alpha 563 (this Arc) legitimately changes
  that exact signature (`async` removed — `tick()` now returns an
  already-in-flight `Promise` directly). Both updated to the new
  signature string, with an added comment scoping their own original
  claim to "as of Alpha 501–520," not permanently.
- **Alpha 531** (`...ripple_review`): asserts, via a LIVE
  `execSync("git status --porcelain")` call, that no file under
  `src/board/outbox/` or matching `fedos_publish_scheduler.ts$` appears
  modified — a guard against THAT Arc's own scope creep, which by
  construction re-evaluates against WHATEVER is currently uncommitted,
  forever. Updated with an explicit, commented exception for exactly
  the two files this Arc legitimately touches
  (`fedos_publish_scheduler.ts`, the new `*_abandonment_policy.ts`),
  following the SAME pattern that test file already used to exempt
  later same-Arc doc/test growth from ITS OWN original accounting.

None of the five required loosening what they actually guard against —
each now encodes "as of Arc X" or "except for Arc Y's own named files"
precisely, the same honest-scoping discipline Alpha 531's own
pre-existing comment already modeled for docs/tests growth, now
extended once, explicitly, to source files.

## Two RIPPLE-updated tests from the ORIGINAL Alpha 549/550 reproduction — now asserting the fixed behavior

`test/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.test.ts`
§1 and `test/secure_runtime_alpha_550_publish_runtime_observation_consistency_audit.test.ts`
§1 originally proved the double-publish race BY REPRODUCING IT (2
Publisher calls, 2 `"delivered"` observations). Both updated to assert
the CLOSED behavior (1 call, 1 observation, and — Alpha 549 specifically
— that the second `tick()` call returns the identical `Promise`
reference), with each file's own header comment updated to record which
Arc changed the assertion and why, rather than silently rewriting
history.

## See also

- `docs/secure_runtime_alpha_561_scheduler_concurrency_inventory.md`
- `docs/secure_runtime_alpha_563_single_flight_implementation.md`
