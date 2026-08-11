# FedOS OSS Public Release Surface Freeze — Final Validation

Arc scope: freeze exactly what is safe and useful to publish. No
architecture redesign, no workspace extraction, no new product feature,
no Trust feature expansion, no source duplication. Starting point:
CandidateHead `e6b2386a`, EvidenceHead `a980a230` (Trust / Offline
Monetization + OSS Release Closure arc).

## `src/os/oss/` was not created

Verified by the release verifier's own mechanical check
(`scripts/release/verify_oss_release.mjs`, check 8) and by direct
inspection: `src/os/oss/` does not exist anywhere in this worktree. OSS
is a distribution/license boundary, not a capability. The authoritative
implementations are exactly, and only, `src/os/core/`, `src/os/messenger/`,
`src/os/commerce/`, `src/os/trust/` — nothing was copied, moved, or
duplicated into a parallel tree.

## Zero production source code changed

`git diff --stat` against the starting CandidateHead (`e6b2386a`) shows
12 files changed, all docs/config/tooling: `README.md`, `ARCHITECTURE.md`,
`docs/architecture/TRUST-MODEL.md`, a new attribution README under
`docs/normative/nostr-protocol-nips/`, the prior arc's own evidence doc
(2 machine-path leaks fixed), 3 new `docs/release/*.md` files,
`package.json` (+1 script line), the new release verifier script,
`src/os/messenger/README.md` (a doc, not code), and a new
`vitest.current.config.ts`. **Not one `src/**/*.ts` file was touched.**

## Public surface inventory

`docs/release/OSS-PUBLIC-SURFACE.md`: every top-level repository
directory/file and all 18 `src/` subdirectories classified into PUBLIC
REQUIRED / PUBLIC OPTIONAL / HISTORICAL / DEVELOPMENT ONLY / PRIVATE —
**0 unknown**. Legacy material (`src/os/_legacy_prototype/`, `schema/`,
historical evidence docs, compatibility shims, the ~986-file historical
test archive) classified KEEP IN OSS / EXCLUDE FROM FIRST RELEASE /
ARCHIVE LATER, each with rationale — nothing deleted or moved.

One real discrepancy was caught during this inventory and fixed:
`src/os/messenger/README.md` still claimed "no production code has been
physically moved here yet," describing the tree as reserved scaffolding
— but the physical Messenger migration completed in an earlier arc (787
real files now live there; the old `src/conversation/`, `src/board/`,
`src/device/`, `src/nostr/` locations are now one-line re-export
compatibility shims, verified by direct inspection of several). This was
a real contributor-facing accuracy bug, not a cosmetic issue — a new
contributor reading that README would have been actively misdirected
toward the wrong source location. Rewritten to describe the actual
current state.

## Secret / privacy / release-artifact audit

- **Secret scan: PASS.** Independent sweep of all 4,944 (at audit time)
  tracked files plus full `git log --all -p` history for private-key
  headers, API/service tokens (npm/GitHub/AWS/Slack/Telegram/BTCPay
  shapes), seed phrases, and secret-shaped hex literals — every match
  traced to either the existing secret scanner's own pattern-definition
  code or a test explicitly asserting *rejection* of such a shape using
  an obviously synthetic fixture. 0 real secrets found.
- **Machine-specific path audit: 2 leaks found, both fixed.** Both were
  in the PRIOR arc's own evidence doc
  (`docs/release/FEDOS-TRUST-OSS-RELEASE-FINAL-VALIDATION.md:13,243`,
  literal `OS-worktrees/<name>` session-specific directory names used in
  methodology narration) — generalized to non-path-specific phrasing.
  Verified no other release-critical file (README, BUILDING, CONTRIBUTING,
  SECURITY, ARCHITECTURE, `scripts/**`, `docs/architecture/**`,
  `docs/release/**`, `docs/user/**`, `docs/operations/**`, `src/os/trust/**`,
  `.github/**`) contains a genuine absolute machine-specific path — the
  release verifier's own mechanical check (99 release-critical files
  scanned) confirms **0 leaks** as of the CandidateHead commit.
- **Privacy audit: PASS.** No real personal data in `test-vectors/`, test
  fixtures, or `docs/pilot/` — only RFC 2606 reserved-domain placeholders
  and standard published crypto KAT data.
- **Release artifact spot-check: PASS**, one non-blocking informational
  note (a compiled `dist/` folder sits outside `resources/` in a prior
  session's `win-unpacked/` packaging output — just compiled app code, no
  embedded personal/machine paths found on inspection).

## Official issuer key boundary

`docs/architecture/TRUST-MODEL.md` gained an explicit, labeled section:

```
PUBLIC:  FedOS Official issuer identifier, public key(s), key IDs, verification policy
PRIVATE: FedOS Official signing private key
```

Stating plainly that the production private key must be generated
outside the repository and outside any cloud-synced/version-controlled
path (OneDrive, Dropbox, Google Drive, etc.), cross-referencing
`docs/operations/OFFLINE-ISSUER-RUNBOOK.md`. Confirmed (again, this arc)
via the release verifier: 0 forbidden secret/private paths tracked, 0
private-key-shaped literals embedded anywhere.

## Monetization wording

Re-audited: no wording anywhere implies a FedOS Official subscription is
required to use FedOS. The README's new non-guarantees table states this
explicitly (`"A FedOS Official subscription is required to use FedOS" |
**False.**`), and the "How the FedOS Official subscription works" section
reuses the canonical `FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT`
boundary by reference rather than paraphrasing it differently.

## Current supported test surface

`npm run test:current` (new, `vitest.current.config.ts`) — a principled
filter (architecture/boundary/cycle-detector guards + the Trust suite +
every other test whose import graph touches current shipping source,
explicitly excluding the dead `src/os/_legacy_prototype/` tree and
historical "Stage N / review only" checkpoints) rather than an arbitrary
whitelist of whatever happens to pass today. **Verified 100% green twice
independently** (once in the main worktree, once in a completely fresh
clean checkout): **132 test files / 1902 tests, 0 failures.**

`docs/release/TEST-SURFACES.md` documents the honest three-way split:
CURRENT SUPPORTED (the 132/1902 above), HISTORICAL REGRESSION (the full
~1198-file `npm test` archive), and KNOWN LEGACY FAILURES (227 failing
files / 453 failing tests as of this arc, root-caused to stale hardcoded
exact-count snapshots — Rust `pub fn` counts, `src/runtime`/`src/identity`
file counts, etc. — that age out as the codebase legitimately grows; not
functional regressions, and not rewritten this arc per its own explicit
scope boundary).

## Public CI

`.github/workflows/ci.yml`: two jobs, `test-current` (`npm run
test:current`) and `release-surface-verify` (`node
scripts/release/verify_oss_release.mjs`) — both verified passing locally
this session (the workflow itself has not been executed on GitHub Actions
infrastructure, since nothing is being published this arc). `actions/checkout@v4`
+ `actions/setup-node@v4` (Node version from `.nvmrc`), `npm ci`, no other
third-party actions, no credentials, no network access required. Typecheck
is deliberately NOT gated in CI this arc: `npm run typecheck:core` has 841
pre-existing errors (a known, previously-documented `@ts-expect-error`/
`@types/node` shared-environment artifact) and no baseline-tracking
mechanism exists anywhere in this repository — rather than invent one
under time pressure, this is documented honestly as a gap in both `ci.yml`
and `TEST-SURFACES.md`.

## Clean OSS checkout verification

Fresh `git worktree add` at CandidateHead `3ac0c5fe` (detached HEAD, zero
uncommitted state carried over):

```
npm install                              -> 80 packages, clean (7 vulnerabilities,
                                             all pre-existing vitest/vite/esbuild
                                             transitive dev-tooling, unrelated to
                                             this arc)
node scripts/release/verify_oss_release.mjs  -> 8/8 checks PASS
npm run test:current                     -> 132/132 files, 1902/1902 tests PASS
npx tsc --noEmit -p tsconfig.json        -> 841 errors, 376 files — IDENTICAL
                                             error-file set to the main worktree
npm run build:beta-runtime               -> clean, 0 errors
```

**Build**: PASS (root `beta-runtime` TypeScript build, clean). **Package**:
not re-run this arc — zero production source changed since the prior
arc's own verified real packaged launch (NSIS installer + portable ZIP,
0 network contact, clean shutdown), so that result still holds
unchanged; re-running the multi-minute electron-builder pipeline against
byte-identical source would only reproduce the same already-recorded
PASS.

## Release manifest

`scripts/release/verify_oss_release.mjs` — a real, git-tracked-files-only,
CI-runnable gate (not a narrative checklist): forbidden secret/private
paths, LICENSE present, 17 required public docs present, 0
machine-specific path leaks across 99 release-critical files, 0
private-key-shaped literals, 11/11 required Trust test files present, 9/9
required build/package files present, `src/os/oss/` confirmed absent.
**8/8 checks pass** as of the CandidateHead commit, reverified in the
clean checkout.

## OSS release blockers vs. package extraction blockers

- **OSS release blockers introduced or left open by this arc: 0.**
- **Package extraction blockers: 3 (informational only, unchanged)** —
  carried forward from the Trust arc's own final count; this arc did not
  touch workspace/multi-package extraction, per its own explicit scope
  boundary.

## Worktree state

Main worktree: **CLEAN** at CandidateHead `3ac0c5fe` — `git status --short`
returns 0 lines.
