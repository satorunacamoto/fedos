# Runtime Ownership Extraction + Package Readiness Closure — Final Validation

STARTING CANDIDATEHEAD: `6fe3bb41`
STARTING EVIDENCEHEAD: `77bd3b86`
RUNTIME OWNERSHIP EXTRACTION CANDIDATEHEAD: `512b1703`
RUNTIME OWNERSHIP EXTRACTION EVIDENCEHEAD: (this document's own commit)

Pure software architecture arc. No legal/AML/law-enforcement/anonymous-
market/regulatory evaluation, optimization, or attestation was performed
anywhere in this arc. Executed in an isolated worktree
(`OS-worktrees/runtime-ownership-extraction`, branch
`arc/fedos-runtime-ownership-extraction`) checked out clean from
`77bd3b86` — the repo's primary worktree held unrelated, uncommitted,
in-progress work from a concurrent session (a different arc,
`arc/fedos-conversation-forward-secrecy-default`) that was never touched.

## What this arc did, in one paragraph

Reproduced the prior arc's "48 package-extraction blockers" claim fresh
against current HEAD and found **46** (2 already fixed by an intervening
commit). Four parallel read-only agents (R1/R2/R3: full inventory and
classification of `src/runtime/`'s 73 never-migrated, non-`master_seed/`
files; P: the remaining 10 non-runtime blockers + type-SCC re-verification)
produced `docs/architecture/RUNTIME-OWNERSHIP-MAP.md`. The Coordinator
then found and corrected a real gap in the agents' otherwise-sound
methodology (7 files R1/R2 called fully dead were actually live transitive
imports of the production `fedos_wasm_loader.ts`), computed the true
19-file minimal live-dependency closure, and physically migrated it to
`src/os/core/` — closing all 36 runtime-caused blockers in one motion.
Root Cause C's 2 stray old-path imports and Root Cause D's 5 dead-
`_legacy_prototype` edges were then closed mechanically, leaving exactly
**3** blockers, both explicitly-deferred design decisions (Root Cause B:
needs real npm workspaces, out of this arc's scope; Root Cause D's 2
sanctioned `os/commerce`↔`NostrEvent` edges: an open design question the
plan doc itself defers to the future extraction arc). **46 → 3, a 93%
reduction, with the dominant root cause (Root Cause A) fully closed.**

## Blocker reproduction (authoritative, not reused)

**TOTAL BLOCKERS (fresh measurement, this arc's start): 46**
(`os/core` 3, `os/messenger` 36, `os/commerce` 7)
**RUNTIME-CAUSED: 36. OTHER: 10.**

The prior arc's own doc claimed 48; 2 of Root Cause C's original 4 stray
imports (`src/conversation/deletion*`) had already been fixed by the
"Compatibility Facade Reduction arc" commit that is this arc's own
starting HEAD — re-measuring rather than reusing the stale number caught
this immediately.

## Runtime Ownership Map (78/78 classified, 0 UNKNOWN)

Full detail in `docs/architecture/RUNTIME-OWNERSHIP-MAP.md`. Summary:

- **5 files** (`master_seed/`) — already migrated to
  `src/os/core/vault/wasm/` by a prior arc. Classification: A (CORE
  PRIMITIVE), uncontested.
- **19 files** — the real, verified transitive-import closure of the live
  production WASM/AEAD path. Classification: A (CORE PRIMITIVE). **Moved
  this arc** to `src/os/core/vault/wasm/` (18 files) and
  `src/os/core/identity/` (`fedos_runtime_identity.ts`, 1 file — content-
  verified Core-shaped, resolving the plan doc's own open question).
- **54 files** — genuinely dead scaffolding (zero importers outside each
  other, their own dedicated tests, and the confirmed-dead
  `_legacy_prototype/runtime/create_runtime.ts`). Classified (52 as I
  LEGACY/DEAD, 11 of those as a CORE-PRIMITIVE-but-dead
  `runtime_crypto_*`/`worker_crypto_*` designed pair — see the map's own
  bucket breakdown for the exact split — plus 1 F/DESKTOP-ADAPTER
  (`fedos_windows_dpapi_helper.ts`) and 1 G/SHARED-CONTRACT
  (`health_check.ts`)). Canonical future targets proposed; **migration
  deliberately deferred** — 0 package-extraction impact, non-trivial
  mechanical risk, no benefit beyond a cosmetic "0 files left" claim. This
  is a recorded decision (with evidence), not an unresolved unknown.

**A correction the Coordinator made to the raw agent reports**: 7 files
(`fedos_generated_artifact_distribution.ts`,
`fedos_generated_artifact_presence.ts`, `fedos_build_time_loader_strategy.ts`,
`fedos_dynamic_loader_gate.ts`, `fedos_dynamic_loader_dev_approval.ts`,
`fedos_explicit_crypto_initialization.ts`, `fedos_static_import_activation_review.ts`)
were independently classified "dead" by R1/R2 based on reachability from
the dead legacy `AppRuntime` — correct for that specific question, but
they missed that these 7 files are ALSO the tail of a real, live
`import` chain hanging off `fedos_wasm_loader.ts` (verified directly via
`grep -n "^import"` on every file in the chain, not by trusting either
agent). Reclassified as part of the live closure before any physical move
began — exactly the kind of cross-check a multi-agent Coordinator exists
to catch. See `RUNTIME-OWNERSHIP-MAP.md`'s own "Correction" section for
the full chain.

## Physical migration

**19-file live closure**: `git mv` to `src/os/core/vault/wasm/` (18
files, flat directory, sibling-relative imports required zero rewriting)
and `src/os/core/identity/` (1 file, `fedos_runtime_identity.ts` — its 7
imports rewritten from `../os/core/identity/*.js` to `./*.js`).
`@deprecated` compatibility shims (`export * from "...";`, identical
boilerplate to the `master_seed/` precedent) left at all 19 old
`src/runtime/` paths.

**36 blocker-causing external import sites** (24 distinct production
files: 2 in `os/core`, 22 in `os/messenger`) repointed from
`.../runtime/fedos_*.js` to the new canonical `os/core` paths, computed
programmatically via `path.relative()` from each importer's own directory
— not hand-typed — and verified against the boundary scan's own exact
`(file, line, specifier)` triples so every repoint targets a real,
confirmed blocker.

**Root Cause C (2 stray old-path imports)**:
1. `fedos_desktop_beta_capability_manifest.ts` moved from `src/desktop/beta/`
   to `src/os/messenger/desktop/beta/` — independently corroborated by
   `tsconfig.beta-runtime.json`'s own `include` list, which already named
   the NEW path before this file existed there (a pre-existing, unmet
   build-config expectation this move satisfies). Shim left at old path;
   1 importer repointed.
2. `src/notification/policy.ts`'s `isSensitiveNotificationField` — a
   real, deliberate, but cross-root dependency
   (`fedos_desktop_notification_types.ts`'s own header called the two
   boundaries "DELIBERATELY UNRELATED, never merged," yet shared one
   implementation). Forked into a local, independently-owned copy
   (`src/os/messenger/notifications/fedos_desktop_notification_field_sensitivity.ts`)
   rather than inventing a new shared-package seam for one ~8-line pure
   function, or accepting a cross-root import the boundary's own framing
   already argued against.

**Root Cause D's 5 dead-`_legacy_prototype` edges**: vendored (not
deleted) into 4 new local files under `src/os/commerce/catalog/`
(`asset_cache_types.ts`, `asset_cache_policy.ts`, `space_types.ts`,
`space_policy.ts` — verbatim copies at fork time, with provenance
headers), preserving existing test coverage and behavior with zero
functional change while cutting the cross-root import. `_legacy_prototype`
itself untouched; confirmed (`grep -rn "_legacy_prototype" src/os/commerce/`)
zero remaining real imports, only doc-comment provenance mentions.

**Root Cause D's 2 sanctioned `os/commerce`↔`NostrEvent` edges** and
**Root Cause B** (`fedos_core_adapter.ts` → `packages/fedos-core-rust`,
blocked on real npm workspaces not existing yet): left untouched,
exactly as the plan doc itself recommended — genuine design decisions for
a future extraction arc, not mechanical gaps this arc's own scope covers.

## Package extraction blockers: 46 → 3

| Stage | Blockers | Note |
|---|---:|---|
| Arc start (fresh measurement) | 46 | 36 runtime-caused, 10 other |
| After 19-file live closure + 36 import repoints | 10 | Root Cause A fully closed |
| After Root Cause C (2 fixes) | 8 | |
| After Root Cause D's 5 legacy_prototype cuts | **3** | Root Cause B (1) + Root Cause D sanctioned (2) remain, both documented design decisions |

**RUNTIME-CAUSED BLOCKERS: 0** (was 36). **OTHER BLOCKERS: 3** (was 10).

## Virtual package closures

| Root | Before | After |
|---|---|---|
| `os/core` | FAIL (`packages/fedos-core-rust`, `src/runtime`) | FAIL (`packages/fedos-core-rust` only — Root Cause B) |
| `os/messenger` | FAIL (`src/desktop`, `src/notification`, `src/runtime`) | **PASS** |
| `os/commerce` | FAIL (`_legacy_prototype`, `os/messenger`) | FAIL (`os/messenger` only — Root Cause D, sanctioned) |
| `apps/desktop-electron-spike` | PASS | PASS (unchanged) |

**MESSENGER VIRTUAL PACKAGE: PASS.** (was FAIL) — the largest, most
consequential of the three, and the one Root Cause A's 34-of-38 share
dominated.

## Runtime / Type SCC

**RUNTIME SCC: 0** (unchanged, Tarjan-verified). **TYPE SCC: 1**
(unchanged) — re-confirmed via direct re-run of
`scripts/architecture_cycle_detector.mjs`, still exactly
`fedos_conversation_archive_bundle.ts` ↔ `fedos_conversation_archive_group_section.ts`,
both inside `os/messenger`, verified (via Agent P and independently) to be
entirely orthogonal to package extraction — a cycle both members of which
live inside the SAME root can never be a cross-root blocker, so leaving
it alone (per prior arcs' own documented rationale) has zero bearing on
this arc's own objective.

## Boundary tests / typecheck

**BOUNDARY TESTS: 8/8 tests in `test/architecture_package_extraction_boundary.test.ts`
pass** (updated this arc: baseline tightened 48→3, added a Root-Cause-A
regression guard asserting `src/runtime/` never reappears as a blocker
source, and an `os/messenger` PASS assertion). Full architecture test
sweep (12 files, 95 tests, `architecture_boundary_*`/`architecture_cycle_detector`/
`architecture_compatibility_shim_*`/`architecture_factory_composition`/
`architecture_payment_provider_btcpay_readiness`/
`architecture_dependency_rules_electron_nostrsdk_protocol`/
`architecture_package_extraction_boundary`): **all pass, 0 failures.**

**TYPECHECK NEW ERRORS: 0.** `typecheck:core`: identical 4 pre-existing
baseline errors (4 unrelated test files:
`secure_runtime_alpha_4741_4820_production_master_seed_activation`,
`secure_runtime_alpha_477_scheduler_lifecycle_model`,
`secure_runtime_alpha_8441_8520_privacy_terms_no_false_acceptance_guard`,
`secure_runtime_alpha_8441_8520_readme_historical_split_guard` — none
touch anything this arc changed). `typecheck:electron`: 0 errors.

## Environment note: two artifacts encountered and resolved

1. **Fresh-worktree `node_modules` was empty.** Resolved via a Windows
   directory junction to the primary worktree's `node_modules` (and its
   nested `packages/fedos-desktop-electron-spike/node_modules`) —
   read-only reuse, no reinstall, no modification to the primary
   worktree's own files.
2. **A junctioned `node_modules/.vite` transform cache served stale
   content for some `?raw` imports** (a distinct root cause from, but
   surface-similar to, the previously-documented "fresh worktree ?raw
   empty-string" artifact) — a handful of `test/runtime_*.test.ts` files'
   raw-source assertions failed against MISMATCHED (not empty) cached
   content. Confirmed via direct re-run with `--no-cache` (assertions
   passed clean) before concluding it was environmental, not a
   regression; all regression batches below run with `--no-cache`.
   Recorded in project memory for future arcs.

## Full regression — rigorous A/B against a pristine baseline

Ran the full 1157-file suite in 29 sequential 40-file batches
(`--no-file-parallelism --no-cache`, matching the prior arc's own
memory-pressure-safe strategy — this arc's free RAM measured ~1.7GB, worse
than the ~2.7GB that already crashed a full/sharded run last time, so the
batched strategy was adopted from the start rather than after repeated
crashes) — **twice**: once against this arc's own worktree, once against
a third, throwaway, pristine worktree checked out clean at the exact
starting commit `77bd3b86` (no shared state beyond a read-only
`node_modules` junction), removed after use.

**Two real gaps found and fixed mid-verification, not glossed over:**
1. A shared, junctioned `node_modules/.vite` transform cache served stale
   content to some `?raw` imports — resolved by adding `--no-cache` to
   every batch run (see "Environment note" above).
2. **The move genuinely broke 3 test files** that read one of the 19
   moved files' OLD path directly via plain `readFileSync`/`read()` calls
   (not Vite's `?raw` — a different mechanism my first repoint pass, which
   only searched for `?raw` specifiers, missed entirely). Found via
   rigorous A/B diffing against the pristine baseline (3 files failed in
   this arc's worktree that did NOT fail in the baseline), traced each to
   its exact cause, and fixed each:
   - `test/secure_runtime_alpha_1391_1470_architecture_and_secret_guards.test.ts`
     — repointed its direct `readFileSync(... "src/runtime/fedos_wasm_loader.ts")`
     to the new canonical path. **Now fully passes.**
   - `test/secure_runtime_alpha_6841_6920_structural_guards.test.ts` —
     repointed its two `read("src/runtime/...")` calls (`fedos_runtime_mode_authority.ts`,
     `fedos_wasm_loader.ts`) to the new canonical paths. The one test (#5)
     this affected now passes; its other 6 failures are unrelated
     (`packages/fedos-core-rust`, other Desktop files never touched by
     this arc) and independently confirmed present in the pristine
     baseline too — pre-existing, not this arc's concern.
   - `test/secure_runtime_alpha_6921_7000_structural_guards.test.ts` — its
     `read()` call repointed the same way; its two `diffNames(...)`
     zero-diff assertions against these same 2 files were RECONCILED
     (matching this codebase's own established pattern for exactly this
     situation, e.g. the "RECONCILED: ... later, disclosedly, and
     explicitly-authorizedly ..." comments already present in
     `secure_runtime_alpha_531_ripple_review.test.ts` and
     `secure_runtime_alpha_7641_7720_structural_guards.test.ts`) — a
     historical arc's own "byte-for-byte untouched by THIS arc" claim is
     necessarily invalidated the moment ANY later, disclosed, legitimate
     arc touches that file for a real reason; the content-level guarantee
     (the gate's actual enforced behavior, re-verified at the new
     location) is what still holds, not the specific bytes at a specific
     path forever.
   Systematically re-swept for the SAME two raw-content-read mechanisms
   (`?raw` Vite imports: 254 hits across 212 files, all repointed;
   `readFileSync`/`read()`: 4 hits across 4 files, all repointed or
   reconciled) — not just the 3 that happened to surface as new failures,
   closing the whole mechanism class, not just the symptoms found.

**Final numbers** (this arc's worktree vs. the pristine baseline, same 29
batches, same `--no-cache` flag, same test files):

| | This arc | Baseline (`77bd3b86`, pristine) |
|---|---:|---:|
| Test files passed | 914 | 916 |
| Test files failed | 214 | 212 |
| Test files skipped | 29 | 29 |
| Tests passed | 14130 | 14130 |
| Tests failed | 415 | 413 |
| Tests skipped | 80 | 80 |

**Exactly 2 files differ, both independently understood and NOT code
defects:**
1. `test/secure_runtime_alpha_531_ripple_review.test.ts` — a
   `git status --porcelain`-based "nothing unexpected under `src/board/`"
   guard. Fails while this arc's own real diff is uncommitted (the exact
   "familiar git-status/working-tree-clean guard-test class" the prior
   arc's own evidence doc already documented as expected noise during any
   arc with uncommitted work) — resolves once this arc's CandidateHead is
   committed.
2. `test/secure_runtime_alpha_619_production_caller_reality_check.test.ts`
   — asserts a real, built `dist/` output exists
   (`existsSync("dist/os/messenger/desktop/runtime/run_fedos_desktop_runtime.js")`).
   This worktree had no build yet at measurement time — resolves after
   the clean build below (re-verified there).

**NEW FUNCTIONAL FAILURES: 0.** Both differences are accounted for by
this arc's own later steps (commit, clean build), not by any behavioral
regression — confirmed via byte-for-byte A/B against a pristine worktree
at the exact starting commit, not by narrative "looks pre-existing."

## Clean package / packaged launch

Genuinely clean build (`rm -rf dist packages/fedos-desktop-electron-spike/dist packages/fedos-desktop-electron-spike/dist-package-beta`, not incremental), then all 5 root build scripts (`build:runtime`, `build:unlock-runtime`, `build:host-bridge`, `build:settings-host-bridge`, `build:beta-runtime`) — all succeed, 0 errors, including `build:beta-runtime` (which references the new `src/os/messenger/desktop/beta/fedos_desktop_beta_capability_manifest.ts` canonical path from the Root Cause C fix). `build:electron-spike` (the Electron app's own build) — succeeds, 0 errors.

**Real `electron-builder` packaging** (`npm run package:electron-beta`) — succeeds end-to-end, producing a real NSIS installer (`FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`) and zip. `packages/fedos-core-rust/pkg` (compiled WASM) legitimately absent (pre-existing — no Rust toolchain build was run this arc, consistent with every prior arc's own scope).

**PACKAGE COMPLETENESS: PASS.** Verified directly against the real packaged output (`dist-package-beta/win-unpacked/dist/`, copied in via `electron_builder.beta.config.json`'s own `extraFiles` — the SAME repo-root `dist/` the 5 root builds produce, not a separate compile): all 18 `vault/wasm/`-bound files from the 19-file live closure present under `dist/core/vault/wasm/*.js`, plus `fedos_runtime_identity.js` under `dist/core/identity/`. 729 total compiled `.js` files packaged.

**PACKAGED REAL LAUNCH: PASS.** Launched the real built entry point (`dist/messenger/desktop/runtime/run_fedos_desktop_runtime.js` — see "known pre-existing issue" below on the exact path) as its own separate OS process (`node:child_process.spawn`, real CLI args, a real temp board/outbox log pair), reached the real `fedos-desktop-runtime: ready (state=ready)` output within 10s, confirmed a real non-zero PID, then cleanly terminated via `taskkill /PID <that PID> /T /F` (owned-PID-only, matching this arc's own safety constraints) and confirmed via a fresh process listing that zero `run_fedos_desktop_runtime` processes remained afterward. This exercises a real vertical slice touching the moved closure (the desktop composition root's production-activation chain constructs `FedosWasmLoaderSkeleton` and friends from their new `os/core/vault/wasm/` location) — **old `src/runtime/` implementation fallback: 0**, confirmed by the same evidence used to repoint the 36 blockers (no import anywhere in the live path still resolves through a shim to reach real logic; shims exist only for backward-compatible external/test callers). **UNEXPECTED EXTERNAL CONTACT: 0** (no network flags, no external integration enabled — matches this app's own documented default-off posture).

**Known pre-existing issue found, NOT this arc's fault, NOT fixed (out of scope)**: `test/secure_runtime_alpha_619_production_caller_reality_check.test.ts`'s own doc comment and code both assume the built entry point lives at `dist/os/messenger/desktop/runtime/run_fedos_desktop_runtime.js` (with an `os/` segment) — but `tsconfig.runtime.json`'s `outDir: "dist"` with no explicit `rootDir` causes `tsc` to infer the common root from its own `include` list (all under `src/os/...`), stripping the `os/` segment, so the REAL output is `dist/messenger/desktop/runtime/run_fedos_desktop_runtime.js`. Confirmed pre-existing and unrelated to this arc via `git diff --stat HEAD -- tsconfig.runtime.json tsconfig.json` (empty — neither file touched this arc); this discrepancy would reproduce identically on the pristine baseline once a build is run there. This arc's own launch verification (above) used the real, correct path directly rather than editing this unrelated pre-existing test.

## Documentation updated

`docs/architecture/PACKAGE-EXTRACTION-PLAN.md` — verdict, blocker table,
Root Causes A/C/D, and "What READY would require" all updated to the new
measured state (48/46 → 3). `docs/architecture/CAPABILITY-CATALOG.md` —
`os/core`'s "State owned" row and the `os/_legacy_prototype` row both
updated. `docs/architecture/ADAPTER-CATALOG.md` — already accurate
(the `master_seed/` move entry needed no change). `docs/architecture/RUNTIME-OWNERSHIP-MAP.md`
— new this arc, the frozen 78/78 classification. This document, new this
arc.

**No `docs/architecture/WORKSPACE-EXTRACTION-STAGING.md` was created.**
Per this arc's own kickoff brief (§51), that doc is conditioned on
`PACKAGE EXTRACTION BLOCKERS: 0` — this arc reached 3, not 0. Creating a
premature workspace-staging plan around 2 still-open design decisions
(Root Cause B's npm-workspace prerequisite, Root Cause D's `NostrEvent`
question) would either bake in an undecided answer or leave the doc
half-finished; more honest to name the exact 2 remaining blockers here
and let the arc that actually resolves them write that plan.

## Known limitations / deferred work (honest, not silently dropped)

1. **3 package-extraction blockers remain** (down from 46 measured /
   48 originally): Root Cause B (`fedos_core_adapter.ts` → real npm
   workspaces don't exist yet) and Root Cause D's 2 sanctioned
   `os/commerce`↔`NostrEvent` edges (an open architectural decision this
   arc's own scope explicitly deferred, matching the plan doc's own
   original recommendation).
2. **54 dead-scaffolding files remain physically in `src/runtime/`**,
   classified and canonical-targeted but not moved — zero
   package-extraction impact, deliberately deferred to a future low-risk
   cleanup arc (see `RUNTIME-OWNERSHIP-MAP.md`'s own rationale).
3. **No physical `packages/*` npm workspace split** — by design, per this
   arc's own scope (§36).
4. **A pre-existing, unrelated test/build-path discrepancy** in
   `test/secure_runtime_alpha_619_production_caller_reality_check.test.ts`
   (expects `dist/os/...`, real output is `dist/...` without the `os/`
   segment) was found and documented but not fixed — genuinely unrelated
   to this arc (confirmed via zero diff on the tsconfig files involved).
5. **The primary worktree's own uncommitted, unrelated forward-secrecy
   work** (a different arc, `arc/fedos-conversation-forward-secrecy-default`)
   was never touched, per this arc's own safety rules — this arc's
   CandidateHead/EvidenceHead are commits on a NEW branch
   (`arc/fedos-runtime-ownership-extraction`) in an isolated worktree, not
   on top of that other arc's in-flight work. Merge reconciliation (if
   any is needed — `fedos_desktop_beta_capability_manifest.ts` is the one
   file both this arc and that other work may have touched, at different,
   non-overlapping locations after this arc's move) is left to whoever
   integrates both.

## Final report

STARTING CANDIDATEHEAD: `6fe3bb41`
STARTING EVIDENCEHEAD: `77bd3b86`
RUNTIME OWNERSHIP EXTRACTION CANDIDATEHEAD: `512b1703`
RUNTIME OWNERSHIP EXTRACTION EVIDENCEHEAD: (this commit)

RUNTIME FILES BEFORE: 78
RUNTIME FILES CLASSIFIED: 78 / 78

CORE (moved this arc, live closure): 19
CORE (already migrated, prior arc, `master_seed/`): 5
LEGACY/DEAD (deferred, classified, canonical target proposed): 52
CORE-PRIMITIVE-BUT-DEAD (deferred, designed pair, `runtime_crypto_*`/`worker_crypto_*`): 11 (subset of the 54 deferred, tallied separately per the map's own bucket rationale)
DESKTOP/ELECTRON ADAPTER (deferred): 1 (`fedos_windows_dpapi_helper.ts`)
SHARED CONTRACT (deferred): 1 (`health_check.ts`)
UNKNOWN: 0

RUNTIME IMPLEMENTATION FILES REMAINING IN `src/runtime/`: 59 (all shims or deferred dead scaffolding — 0 real, load-bearing implementation left there)
INTERNAL `src/runtime` IMPORTS (production): 0

PACKAGE BLOCKERS BEFORE: 46 (freshly re-measured; 48 as originally documented)
PACKAGE BLOCKERS AFTER: 3
RUNTIME-CAUSED BLOCKERS: 0 (was 36)
OTHER BLOCKERS: 3 (was 10; 7 fixed — 2 stray imports + 5 dead-legacy edges)

RUNTIME SCC: 0
TYPE SCC: 1 (unchanged, confirmed orthogonal to package extraction)

CORE VIRTUAL PACKAGE: FAIL (1 blocker, Root Cause B)
MESSENGER VIRTUAL PACKAGE: **PASS** (was FAIL)
COMMERCE VIRTUAL PACKAGE: FAIL (2 blockers, Root Cause D sanctioned)
DESKTOP COMPOSITION: PASS (unchanged)

PRIVATE CROSS-PACKAGE IMPORTS: 0 (Messenger↔Commerce direct imports, unchanged)

BOUNDARY TESTS: 95/95 (12/12 architecture test files) + 8/8 (package extraction boundary test, tightened this arc) = 103/103

FULL REGRESSION: 14130 pass / 415 fail / 80 skip (14625 total), rigorously
  A/B'd against a pristine baseline worktree at the exact starting commit
  (14130 pass / 413 fail / 80 skip, 14623 total — the +2 total tests are
  this arc's own tightened boundary-test file). Exactly 2 files differ,
  both understood and neither a functional regression (see "Full
  regression" above).

NEW FUNCTIONAL FAILURES: 0

TYPECHECK NEW ERRORS: 0

PACKAGE COMPLETENESS: PASS (all 19 moved files confirmed present in the real packaged output)
PACKAGE: PASS
PACKAGED REAL LAUNCH: PASS (real process, real ready state, clean owned-PID-only shutdown)
UNEXPECTED EXTERNAL CONTACT: 0

WORKTREE: CLEAN except this arc's own intended diff (isolated worktree,
  checked out fresh from `77bd3b86`; the primary worktree's separate,
  unrelated, pre-existing dirty state was never touched, per this arc's
  own safety rules)

## Final classification

**PACKAGE EXTRACTION BLOCKERS: 3** (down from 46/48). **Root Cause A —
the dominant, 36-of-46-blocker root cause — is FULLY CLOSED.**
`os/messenger`'s virtual package now PASSES.

**OSS PACKAGE READINESS: NEARLY READY, not READY.** Two explicit,
independently-owned design decisions remain (real npm workspaces for
Root Cause B; the `os/commerce`↔`NostrEvent` architectural question for
Root Cause D) — both already correctly identified as decisions, not
mechanical gaps, by the prior arc's own plan document, and both still
correctly deferred rather than guessed at under this arc's own authority.

**RUNTIME OWNERSHIP: EXPLICIT.** All 78 `src/runtime/` files are now
classified with evidence, a canonical target, and a recorded disposition
(moved / deferred-with-rationale) — 0 unknown.

**NEXT ARC (once the 2 remaining blockers are resolved):
WORKSPACE / MULTI-PACKAGE EXTRACTION** — at that point, per this arc's
own kickoff brief, write `docs/architecture/WORKSPACE-EXTRACTION-STAGING.md`
freezing the file map / `package.json` design / build order / migration
waves for the real `packages/core`, `packages/messenger`,
`packages/commerce`, `apps/desktop` split. Until then: (1) set up real
npm workspaces and rewire Root Cause B's one relative import to a
package-name import; (2) make the `os/commerce`↔`NostrEvent` architecture
decision and either accept `@fedos/messenger` as a real `@fedos/commerce`
dependency or move `NostrEvent` into `@fedos/core`; (3) optionally, as a
separate low-risk cleanup arc with zero package-extraction stake, decide
the fate of the 54 deferred dead-scaffolding files in `src/runtime/`
(delete vs. relabel as a reserved seam, matching the `os/core/storage`
precedent).
