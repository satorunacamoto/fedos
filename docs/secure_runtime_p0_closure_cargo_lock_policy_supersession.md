# P0 Closure — Cargo.lock Policy Supersession (Agent R scope, mandate task #48-51)

**Supersedes:** `docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`
("Option B — keep `Cargo.lock` untracked, pin the exact resolved
dependency graph and its hash in release provenance"). That doc is left
unedited as the historical record of the earlier decision; this doc
records the new decision and why it changed.

**New decision: commit `Cargo.lock`.** Frozen by
`docs/reviews/fedos-peer-device-discovery-current/10_P0_CLOSURE_COORDINATOR_FREEZE.md`
§3 ("Release integrity").

## Why Option B no longer holds

Option B's entire bet was that *documenting* a pinned resolved-dependency
graph, without a committed lockfile to structurally enforce it, would be
adequate assurance for this crate. That bet has now measurably failed —
the graph has already drifted once between the doc's recorded snapshot
and what is actually on disk today:

| | Recorded in the Option B doc | Actually on disk now |
| --- | --- | --- |
| `Cargo.lock` SHA-256 | `6bbdadb710b65b517ceb8d671f2bdbf37283d7373a73d0ed8debc1d895368155` | `945dc235495567b47b79aa7ca4f37b7b30c372cb5775785f8a1a751a358f4f88` |
| `wasm-bindgen` version | `0.2.126` | `0.2.127` |
| Resolved package count | 82 | 82 |

(Both hashes computed the same way: `sha256sum packages/fedos-core-rust/Cargo.lock`.)

The package count is unchanged and this specific drift (a patch-level
`wasm-bindgen` bump) is not evidence of anything having gone wrong — but
it is direct, first-party proof that an untracked, merely-documented
lockfile does not stay in sync with reality on its own. A documentation
snapshot cannot be relied on as the actual build input; only a tracked
file that `cargo build --locked` reads and enforces can be. This crate
now ships real, embedded, cryptographic WASM in every release artifact
(the "Stage 69 skeleton" the old `.gitignore` comment described no
longer describes what this crate is), which is exactly the situation
Option B's own "Honest limitation" section flagged as the trigger for
revisiting the decision: *"a future Arc should commit `Cargo.lock` if
this becomes a real point of drift."* It has.

## What changed (mechanical)

1. `packages/fedos-core-rust/.gitignore` — removed the `Cargo.lock` ignore
   line; the file's rationale comment was rewritten to point here instead
   of citing the stale "Stage 69 skeleton" reasoning.
2. `packages/fedos-core-rust/Cargo.lock` — `git add`ed (staged, not
   committed by this stream; a human/Coordinator commit finalizes it).
3. Root `package.json`'s `build:wasm` script now runs
   `cargo build ... --locked`, so any future drift between the tracked
   lockfile and what Cargo would otherwise resolve fails the build loudly
   instead of silently re-resolving and shipping a different graph.
4. Verified: `npm run build:wasm` was actually re-run against the now-
   tracked lockfile with `--locked` in place, and passed (see the
   Agent R report for this arc for the exact command/output).

## What this does NOT change

- The Option B doc's own recorded 82-package resolved graph and its
  provenance narrative remain historically accurate for the build they
  describe; they are not retroactively wrong, just superseded as
  *policy* going forward.
- No generator script (`generate_release_manifest.mjs`,
  `generate_release_checksums.mjs`, `release_identity.mjs`) needed any
  change — they were already confirmed correct and never hardcoded an
  artifact filename or lockfile assumption.
- This doc did not itself update the pre-existing structural-guard tests
  (across `test/fedos_core_rust_*.test.ts`,
  `test/runtime_wasm_artifact_generation_fix.test.ts`,
  `test/runtime_wasm_bindgen_version.test.ts`, and others) that asserted
  `Cargo.lock` is never committed. That follow-up pass has since landed,
  touching 36 affected files, but did so unevenly. Only 2 files
  (`test/runtime_wasm_artifact_generation_fix.test.ts`,
  `test/runtime_wasm_bindgen_version.test.ts`) correctly *inverted* their
  assertion (`.toMatch` → `.not.toMatch`, on the package's `.gitignore`
  content) to positively prove `Cargo.lock` is no longer ignored. The
  other 34 files (`test/fedos_core_adapter.test.ts`,
  `test/fedos_core_rust_dependency.test.ts`,
  `test/fedos_core_wasm_loader.test.ts`, and 31 more
  `test/fedos_core_rust_*.test.ts` files) merely *deleted* their old
  `expect(/\/Cargo\.lock$/i.test(path)).toBe(false)` line (or equivalent
  forbidden-pattern check) and left an explanatory comment in its place,
  with no replacement positive assertion — so those 34 files never
  actually failed (nothing false was left to trip them), but they also
  never proved the new policy held: a test suite that only deletes a
  negative check is not evidence the positive fact is true. A second
  follow-up pass closed that gap: each of the 34 files now also asserts,
  via the same `fedosCoreRustGitTrackedPaths()` / `git ls-files` helper
  they already used, that `packages/fedos-core-rust/Cargo.lock`
  genuinely appears in the tracked-paths list (e.g.
  `expect(paths.some((path) => path.endsWith("/Cargo.lock"))).toBe(true)`).
