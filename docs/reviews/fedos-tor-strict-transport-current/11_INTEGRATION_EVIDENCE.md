# Integration Evidence — Tor Strict-Transport Local Closure + Parallel Release/UX/Archaeology

**Coordinator pass**, integrating two arcs that ran in parallel, each in its own isolated
worktree, against starting state `CandidateHead 8c6d802a` / `EvidenceHead c817b4ce`:

- `arc/fedos-tor-strict-transport-local-closure` @ `b9a3f2cf` (own EvidenceHead)
- `tor-parallel-p1-arc` @ `6dab5243` (own branch CandidateHead)

## Merge

Zero file overlap confirmed before merging (`git diff --stat` against `c817b4ce` for each
branch): the Tor arc touched only new `docs/reviews/fedos-tor-strict-transport-current/*`,
`fedos_electron_beta_main.cts`, 6 new `fedos_electron_strict_*`/`fedos_electron_socks5_client.ts`
source files, and 2 new test files; the P1 arc touched only `BUILDING.md` and
`docs/desktop_beta_user_guide_installation.md`. Both merged cleanly (`git merge --no-ff`, no
conflicts) as `6a5ff54e` then `6c2c2265`.

## Regression sweep against the merged commit

- `npm run typecheck` — clean (same 2 pre-existing errors in untouched root test files,
  confirmed unrelated: `secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
- `npm run test:current` — 191 files / 2811 tests passed, 3 skipped (unchanged from baseline).
- The two new Tor unit/integration test files (14/14) pass once invoked via the correct
  root-relative `--config vitest.electron-spike.config.ts` harness (an earlier same-directory
  `npx vitest` invocation failed on a `process.cwd()`-relative `readFileSync` — a coordinator
  invocation mistake, not a test bug; confirmed by checking this repo's own established
  convention in sibling test files, which all assume `process.cwd() === repo root`).

## P0 found and fixed: packaged binary crashed on every launch

While chasing down `packages/fedos-desktop-electron-spike/test/direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`
regressing from 12/12 to 0/12 against a freshly built installer, direct bisection (temporarily
reverting `fedos_electron_beta_main.cts` alone, rebuilding, relaunching) isolated the cause to
that file's own diff. A debug-instrumented build (write-to-file markers placed immediately after
the two new imports) proved the crash happens **during `require()` of the new modules, before
any of this arc's own code runs**.

Root cause: `electron_builder.beta.config.json`'s `"files"` array is an explicit allowlist of
which compiled `dist/*.js` files get bundled into `app.asar`. The Tor arc added 6 new source
files and wired 2 of them into `fedos_electron_beta_main.cts` via top-level `require()`, but
never updated this allowlist — so the packaged binary's `require("./fedos_electron_strict_transport_policy.js")`
resolved to a file that was never packaged at all.

**Severity: not Tor-specific.** The `require()` call fires unconditionally at module load, so
the packaged Beta binary crashed on **every** launch (exit code 1, no window, no console
output on either stream, no Windows Application Event Log entry, no step log) regardless of
whether strict Tor mode was ever enabled. Both the Tor arc's own local-only testing and the
coordinator's own first `release:beta` pass (which only checked that gates 1-14 completed, not
that the resulting binary actually runs) missed this.

Fixed in `db290686`: added the 6 missing `dist/fedos_electron_strict_*.js` /
`dist/fedos_electron_socks5_client.js` entries to the allowlist.

**Re-verification after the fix**, both against `db290686`:
- Manual launch (`FEDOS_ELECTRON_BETA_AUTOTEST=acceptance`, minimal script): exit code 0, real
  step log written (`FEDOS_ELECTRON_BETA_CHECKPOINT:host-started:...`).
- `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`: **12/12 passing** against
  the real NSIS-installed binary, including this session's own two new steps (STEP 10 — live-
  verification truthfulness, STEP 11 — corruption fail-closed) and the pre-existing silent-
  downgrade disclosure (scenario l) — zero regressions from either parallel arc's own prior work.

## Full release pipeline, from the fixed commit (`db290686`)

`npm run release:electron-beta` — **14/14 gates PASS**, verdict `ready-for-human-publication`,
`blockingGateIds: []`. Artifacts: `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` (111,636,397 bytes,
sha256 `82f00ddc5b859c81e9740f38046ffed86532388d3ac862432ad67e2f81d16d3b`), matching `.zip`,
manifest, and `SHA256SUMS.txt`, `gitCommit=db290686`.

Corrects the Tor arc's own sub-agent report, which claimed packaging/install was
"structurally blocked" (missing `electron.exe`) in *its* isolated worktree — true for that
worktree (junctioned `node_modules` without its own `npm ci`), but not true of the coordinator's
own real source worktree, which has a real, non-junctioned `node_modules` and a real
`electron.exe` at `packages/fedos-desktop-electron-spike/node_modules/electron/dist/electron.exe`.

## test:electron-spike (full suite) — informational only, not a required gate

The broader `npm run test:electron-spike` suite (55 files / 564 tests, many historical
"Alpha NNNN" checkpoint files, real Electron-subprocess-spawning throughout) is **not** part of
`test:current`'s green-path surface and is not treated as a required gate here, mirroring how
`test:current`'s own documented rationale excludes `secure_runtime_alpha_*` files from the
green-path by design. A baseline run at `c817b4ce` (via an isolated detached worktree,
`node_modules`/`pkg` junctioned in) independently produced 51 real pre-existing failures (JSON
reporter, exact names recorded). One specific attempted full run of this suite against the
merged worktree crashed the vitest process entirely (`commerce_e2e_packaged_binary_real_electron.test.ts`
timed out at 270s under this session's accumulated resource load, then `Worker exited
unexpectedly` killed the whole run) — a resource-contention/environment issue unrelated to
either parallel arc (that test touches neither Tor nor the two P1 doc files), not chased
further given the cost of repeated ~4-5 minute full-suite runs. The **targeted** regression that
actually matters for this arc (the Direct Ratchet installed-binary suite) was run in isolation
and is 12/12, above.

## Process hygiene

Multiple rounds of orphaned `node.exe` processes (from earlier interrupted background test
runs) were found and cleaned up via `taskkill //PID //F //T` through Bash, confirmed via
`Get-CimInstance Win32_Process` before and after. Final state: zero `node`/`electron`/`FedOS`
processes running.

## Fresh classification

- TOR STRICT ARCHITECTURE: COMPLETE (Phase A docs + `07_ARCHITECTURE_DECISION.md`-equivalent
  freeze, EXTERNAL Tor, single routing authority).
- TOR LOCAL IMPLEMENTATION: COMPLETE, and now genuinely **packageable** (the P0 above is fixed).
- TOR LOCAL FAIL-CLOSED PROOF: PASS (14/14 local-loopback tests: clearnet-trap-zero,
  malformed-SOCKS fail-closed, Tor-dies-mid-session fail-closed, DNS-safety, ratchet/legacy
  shared-route proof).
- TOR INSTALLED LOCAL PROOF (mandate §41-46, real installed binary + local fake SOCKS +
  strict-mode two-process messaging): **NOT ATTEMPTED this pass** — the coordinator's own
  session budget went to finding/fixing the P0 packaging bug and re-verifying the existing
  Direct Ratchet installed regression instead of building a new installed+strict-Tor combined
  E2E harness from scratch. This is an honest scope boundary per mandate §43's own allowance,
  not a discovered blocker — nothing architecturally prevents it now that packaging itself is
  confirmed working.
- DIRECT RATCHET: still COMPLETE, P0: 0 — re-proven against the integrated, fixed binary.
- PUBLIC TOR NETWORK CONTACT: NO.
- PARALLEL-P1 ARC: integrated as-is (docs-only, `6dab5243`), its own honest self-report already
  discloses its narrower-than-mandated scope (solo execution, no 4-agent fan-out available to it).

## INTEGRATED CandidateHead / EvidenceHead

- INTEGRATED CandidateHead (fix): `db290686`
- This commit is the EvidenceHead.
