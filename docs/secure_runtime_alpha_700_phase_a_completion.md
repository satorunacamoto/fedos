# Secure Runtime Alpha 700 — Phase A Completion Gate

Stage 20 of Phase A, the final gate before Phase B.

## Gate criteria

- **Derived public identity is non-secret.** `FedosNostrSigningPublicIdentity`
  (Alpha 683) carries only `accountIndex`/`publicKeyHex`. ✅
- **Binding is cryptographically rooted in the same authority.** Rust
  `public_key_hex_for_account()` reuses the identical derivation chain
  `sign_nostr_event()` uses; proven equal for the same account in both
  `cargo test` (Alpha 696) and the TypeScript binding authority tests. ✅
- **Account index is explicit.** `nostrAccountIndex` is an explicit
  Runtime/BoardRuntime configuration value, defaulting to `0`, never
  inferred (Alpha 689). ✅
- **Imported authors cannot bind accidentally.** `"author-not-nostr"` /
  `"public-key-mismatch"` cover every non-controlled case (Alpha 692). ✅
- **Nostr eligibility becomes reachable for a real controlled identity.**
  `test/secure_runtime_alpha_698_board_runtime_binding_verification.test.ts`
  test 1 proves it end to end, from `FedosBoardRuntime` to a durable
  Outbox intent. ✅
- **Anonymous behavior remains local-only.** Test 3/4 of the same file. ✅
- **No raw-secret regression.** Confirmed by Alpha 695's structural review
  and by every new method's own return type (`Option<String>` in Rust,
  `FedosNostrSigningPublicIdentity | null` in TypeScript). ✅

The identity graph was made coherent WITHOUT a larger identity redesign —
Phase A is declared complete.

## Verification summary

- `cargo test` (packages/fedos-core-rust): 533 passed, 1 pre-existing
  unrelated failure (`secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`
  — a stale dependency-count guard already broken before this Arc; this
  Arc added no Cargo dependency).
- `npm run typecheck`: clean except one pre-existing, unrelated failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
  already broken on the base commit before this Arc).
- `npm test`: no new regression beyond one intentional, reviewed, and
  fully-propagated ripple — this Arc's one new Rust `pub fn`
  (`public_key_hex_for_account`) shifted the crate's total public-function
  count from 44 to 45. ~280 pre-existing structural regression-guard test
  files across `test/` hardcode this exact count (and, in several files, an
  exact enumerated name list / allowlist Set) as a "public API surface
  unchanged" snapshot; every one of them was updated in lockstep
  (mechanical, reviewed, no behavior change) so the suite reflects the new,
  intentional total honestly rather than silently drifting stale.
- A rigorous before/after full-suite diff (`git stash` back to the base
  commit, re-run, diff failing-test titles) confirms zero other new
  regressions. The remaining differences are: (a) several much older,
  already-broken historical snapshot counts (27/36 `pub fn`, unrelated to
  this Arc, already failing before it), (b) a small number of flaky
  crypto-round-trip smoke tests observed only under full-suite parallel
  load (confirmed to pass reliably in isolation), and (c)
  `test/secure_runtime_alpha_531_ripple_review.test.ts`'s own live
  `git status` check, which necessarily observes this Arc's own
  in-progress uncommitted diff under `src/board/` until the final commit
  lands — expected, self-resolving noise for any Arc's own WIP state, not
  a defect.

Proceeding to Phase B.
