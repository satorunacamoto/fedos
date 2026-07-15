# Secure Runtime Alpha 518 — Final Verification

Stage 18 of the Alpha 501–520 Durable Delivery Observation Wiring &
Host Delivery Lifecycle Arc.

## 1. `npm run typecheck`

GREEN for every file this Arc adds or touches. One pre-existing,
unrelated error remains
(`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`, an
Alpha 471–480 file, `noUncheckedIndexedAccess` array-index narrowing,
outside this Arc's own diff).

## 2. Focused tests

This Arc's own 20 new test files (`secure_runtime_alpha_501` through
`520`) plus the two ripple-fixed pre-existing files
(`secure_runtime_alpha_386`, `secure_runtime_alpha_488`) — **all
GREEN**.

## 3. Full-repository `npm test`

Run against this Arc's own actual current HEAD (not a number carried
over from an earlier session, per this Arc's own "既知失敗は現在の
HEADを基準に比較する" discipline, already established by Alpha
491–500): **210 failed files / 320 failed tests, out of 749 files /
10,959 tests.** Every failing file name cross-checked against this
Arc's own files (the 20 new plus the 2 ripple-fixed) — **zero
overlap**. Both ripple fixes (Alpha 511) are confirmed to no longer
appear in the failure list, re-run after the fix, not merely asserted.

The remaining failures are the SAME class already documented by every
recent Arc in this repository's own history — pre-existing structural-
drift/environment issues (a `Cargo.toml` comment-wrapping quirk
breaking a fragile dependency-count parser, `lib.rs` line-position
assertions, etc.) — none touching Host, Scheduler, Publisher, Outbox,
or Observation code this Arc's own diff includes.

## 4. Rust

No Rust file is touched by this Arc (`git diff --stat --
packages/fedos-core-rust/` is empty) — `cargo check` was not run, per
this Arc's own "Rust差分がなければcargo check不要" instruction.

## 5. Generated artifacts

`packages/fedos-core-rust/target/`, `Cargo.lock`, and `pkg/` — all
confirmed ABSENT from this worktree.

## 6. See also

- `docs/secure_runtime_alpha_511_host_ripple_review.md`
- `docs/secure_runtime_alpha_512_security_regression_guards.md`
- `docs/secure_runtime_alpha_519_git_diff_confirmation.md`
