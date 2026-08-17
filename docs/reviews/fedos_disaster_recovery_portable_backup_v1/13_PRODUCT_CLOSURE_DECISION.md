# Product Closure — Coordinator Decision

Starting HEAD verified: `50e03e8d`, worktree clean, ancestry confirmed (this is the tip of
`arc/fedos-installed-startup-root-cause`, which already includes the integrated
Red-Team-Reconciliation + Own-Device-Sync-Final-Closure lineage at `c88a625b`, plus two rounds
of Disaster Recovery work at `b194fe7d`/`b93db7d2`, plus the round-2 EvidenceHead `50e03e8d`).

Phase A ran as 4 parallel read-only investigations (fresh general-purpose agents, not forks —
`fork` was unavailable this session turn; each was briefed with an equivalent self-contained
context to what a fork would have inherited). All 4 confirmed clean (no file changes, no
commits) before and after.

## A. Sync Package WASM-handle audit — **CONFIRMED**

`src/os/messenger/device/sync_journal_transport/fedos_device_sync_journal_package_encryption.ts`
(the LIVE, production-wired path — confirmed via `fedos_desktop_runtime.ts:1733` →
`fedos_profile_initialization_coordinator.ts:1025` → `fedos_electron_beta_main.cts`) has the
exact same cross-WASM-instance opaque-handle defect already found and fixed twice this session
(Conversation encryption, Recovery Bundle encryption). No production runtime-boundary override
exists for this path at all — unlike Conversation and Recovery Bundle, which both got a
`FedosProduction*RuntimeBoundary` class wired in via a same-shaped guard.

The sibling `src/os/messenger/device/sync_package/fedos_device_sync_package_encryption.ts`
(older, Alpha 3321-3400) carries the identical defect but is confirmed DEAD CODE in
production today (zero construction sites outside test fixtures) — flagged for a future fix
before it's ever activated, not fixed this pass (no live risk today).

**Critical methodological finding, confirmed by direct reproduction attempt**: a real-WASM
Node/vitest test CANNOT catch this bug class — Node's own module/WASM-instance caching
appears to alias "two different loader instances" within one process, producing a false
negative. Every one of this bug's three real occurrences this session was only ever caught by
a real spawned-Electron-process IPC acceptance test. This must be treated as a standing
methodological rule for the rest of this arc and beyond: **a Node-only real-WASM test passing
is not sufficient evidence this bug class is absent; only a real spawned-process proof is.**

**Decision: IMPLEMENT_NOW.** Mirror the two existing, proven fixes exactly (no new crypto, no
new design decision) — a new `FedosProductionDeviceSyncJournalPackageEncryptionRuntimeBoundary`
class delegating to `FedosProductionMasterSeedAuthority`'s own `encryptAead`/`decryptAead`/
`serializeAeadCiphertext`/`deserializeAeadCiphertext`, wired in at `fedos_desktop_runtime.ts`
behind the same production-authority-detection guard shape already used twice. Coordinator
implements directly (small, well-precedented, high file-ownership-conflict risk if delegated
alongside other tracks touching the same composition-root file).

## D. Start-Over / Recovery identity-boundary red team — **CURRENT_CONFIRMED, live-reproduced**

Real, live-reproduced identity-boundary violation: after "Start Over" (`resetCorruptReadyProfile()`
in `fedos_profile_initialization_coordinator.ts`), a new identity created in the same profile
directory can — and, in a real reproduction using this codebase's own established real-Runtime
test pattern, DID — read the old identity's own private data (a board post) through its own
normal, legitimate read API. Root cause: reset deletes only 2 of ~35 durable files
(`profile.json`, `master-seed.sealed.json`); `detectProfileState()`'s own definition of "fresh"
checks only those same two files; `createProfile()`'s overwrite guard trusts that same narrow
check.

The identical root cause independently affects Recovery Bundle restore: its own
`target-not-fresh` refusal (`restoreFedosRecoveryBundle()`) and the IPC handler's
`presence !== "absent"` gate both derive from the same narrow `detectProfileState()`.

**Decision: IMPLEMENT_NOW — this is the single highest-priority fix in this entire arc.** A
real, reproducible cross-identity private-data leak is a P0-class defect regardless of how the
rest of the mandate's scope is prioritized. Widen the freshness definition (Agent D's option
(b): `detectProfileState()`/an equivalent pre-create/pre-restore guard verifies no other
durable leaf is present, refusing with a typed outcome rather than silently proceeding) rather
than widening deletion scope (Agent D's option (a) would be destructive and harder to bound
safely under the mandate's own explicit "never delete more than necessary" constraint — a
refuse-and-inform design is strictly safer than a delete-more design for this specific defect).
Coordinator implements directly, same file-ownership-conflict reasoning as above.

## B. Recovery UI — minimal real product-complete surface, design accepted

Agent B's design is accepted as-is: reuses this codebase's own established Settings/
confirmation-dialog/Start-Over-screen patterns, grounded in the real current IPC contract
(`recovery-inspect`/`recovery-restore`/`recovery-export`), with truthful per-outcome copy for
every real backend result variant (never a generic "something went wrong"), an explicit
plan-before-mutation step surfacing the backend's own real `inspectFedosRecoveryBundle()` data,
and an explicit fresh-device/reestablishment-required disclosure in plain language.

One real backend gap flagged: `profile-recovery-export` currently only returns bytes
(`bundleBase64`) with no dedicated "save to file" IPC channel — needed for a real Export
screen to actually let a user choose where the file goes, using Electron's native save dialog.

**Decision: IMPLEMENT_NOW**, as its own track (Track 1), disjoint from Tracks 2/3's
composition-root edits — implemented via a fresh agent AFTER Tracks 2/3 land in the shared
`fedos_electron_beta_main.cts`/`fedos_desktop_runtime.ts` files, to avoid concurrent-edit
conflicts on those files. Scope: the new save-file IPC channel, the renderer screens, and the
page HTML — all genuinely disjoint files from Tracks 2/3's own edits once those are already
committed.

## C. Real NSIS fresh-machine proof — design accepted, sequenced last

Agent C's design is accepted as-is: single shared NSIS install (matching this codebase's own
established multi-dataDir-per-install convention), bundle transfer via bytes only (never a
directory copy, never network), real Board/Commerce/settings state seeded via the same
established `writeFileSync`-into-NDJSON-leaves pattern the existing vertical-slice test already
uses (no acceptance-IPC path exists to create this state any other way), the backend's own real
`assets` classification array used as the primary assertion surface, disk-level `existsSync`
negatives for every excluded category (the strongest possible proof, not an inference from an
API label), and a real Direct-Ratchet/device-trust non-portability sub-scenario reusing the
proven announce→establish→poll acceptance sequence.

Real finding folded in: tampered-manifest/tampered-ciphertext restore attempts leave a genuine
partial write (the sealed Master Seed lands on disk before Data Part validation completes) —
correctly non-silent (surfaces as a real failure outcome, never a false success) and correctly
routes into this arc's own pre-existing `recovery-required`/`resetInterruptedProfile()` state,
but the acceptance-mode command surface doesn't currently expose `fedos-profile:reset-interrupted`,
so the full tamper→refuse→reset→retry-succeeds cycle can't be proven end-to-end this pass —
accepted as a disclosed, honest boundary rather than blocking on adding that channel.

**Decision: IMPLEMENT_NOW, sequenced LAST** (Track 4) — this test should exercise the
INTEGRATED result of Tracks 2 and 3 (the Sync Package fix and, especially, the Start-Over
identity-boundary fix, since Recovery restore shares that exact root cause), not a pre-fix
snapshot. Split into the two files Agent C recommended: a fast core-proof file (Phases 1-3,
negatives) and a separate, explicitly slower Ratchet/device-trust file (Phase 3c) reusing the
same shared install.

## Track ownership (no two tracks touch the same file)

- **Coordinator, directly**: Track 2 (Sync Package fix: new file +
  `fedos_desktop_runtime.ts`) and Track 3 (Start-Over/Recovery freshness fix:
  `fedos_profile_initialization_coordinator.ts`, `fedos_recovery_bundle_import_coordinator.ts`,
  `fedos_electron_beta_main.cts`'s existing recovery-restore handler only).
- **Fresh agent, after Tracks 2/3 land**: Track 1 (Recovery UI: new save-file IPC handler in
  `fedos_electron_beta_main.cts` — additive, different region from Track 3's edit — plus
  renderer/page HTML, entirely new files/regions).
- **Fresh agent (or coordinator), after Track 1 lands**: Track 4 (the two new installed-binary
  test files — genuinely new files, no ownership conflict with anything).

No fork agent may commit. Coordinator reviews and commits every track's work after independent
re-verification, per the mandate's own explicit discipline.

## Addendum — Track 3 design corrected during implementation (empirical, not speculative)

The decision above chose "widen the freshness check only" over "widen deletion scope" for
safety. Implementing it exactly as written and testing it against this codebase's own existing
Phase S regression suite (`resetCorruptReadyProfile()` → fresh `createProfile()` at the same
root) proved that choice **incomplete**: a real `createProfile()` call durably writes well beyond
the 2 identity files during its own Device/Runtime bootstrap step (a local Device Registry entry,
at minimum). Reset-only-deletes-2-files + create-refuses-on-any-residue meant every legitimate
Start Over would refuse forever after reset, with no path forward — safe against the leak, but a
genuine functional regression (Start Over would never again be able to complete).

**Revised, empirically-verified design**: widen BOTH.
`resetCorruptReadyProfile()`/`resetInterruptedProfile()` now also call a new
`deleteResidualFedosProfileData()` (best-effort, after their existing 2-file `delete()` calls
succeed) that clears every other durable leaf `planFedosLocalProfilePaths()` names — so a
completed Start Over is genuinely, not just nominally, a fresh root. The widened freshness check
(`hasResidualFedosProfileData()`, unchanged from the original decision) stays in
`createProfile()`'s overwrite guard and `restoreFedosRecoveryBundle()`'s `target-not-fresh` check
as defense in depth for any path that reaches a profile root WITHOUT going through a reset at all
(a bug in reset itself, a manual/external filesystem restore, ...) — never as the only guard, and
never a substitute for reset actually clearing what it claims to reset.

Verified via `test/secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts` Phase T (new) and
`test/fedos_disaster_recovery_portable_backup_import_coordinator.test.ts` tests 14-15 (new): (1)
Start Over now genuinely clears a real board post before a fresh `createProfile()` succeeds at
the same root; (2) `createProfile()` and `restoreFedosRecoveryBundle()` still independently refuse
residual data that reaches a root some other way; (3) the existing Phase S "reset → fresh create
succeeds" regressions, which had broken under the refuse-only design, pass again unmodified.
