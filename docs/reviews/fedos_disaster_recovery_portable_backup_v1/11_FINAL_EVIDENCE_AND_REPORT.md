# Disaster Recovery Reconciliation + Restore Coordinator — Final Evidence

## Head discipline

```
STARTING CANDIDATEHEAD (integrated):  c88a625b
RECOVERY CANDIDATEHEAD (round 1):     b194fe7d
RECOVERY CANDIDATEHEAD (round 2):     b93db7d2
FINAL EVIDENCEHEAD:                   this commit
```

Ancestry verified at each step (`git merge-base --is-ancestor`); worktree clean at every
checkpoint. Per the mandate's own explicit instruction, only the Coordinator created commits
this entire arc — the executing fork staged/left everything uncommitted at every round, and
its work was independently re-verified (not just trusted) before each commit.

## 0. Preliminary: unauthorized commit removed, content preserved

`e9dda98a` on `arc/fedos-disaster-recovery-portable-backup` (`C:/wt/disaster-recovery-portable-backup`)
was verified as the branch tip, never pushed, with no dependents, and removed via
`git reset --soft HEAD^` — all three of its files landed back in that worktree's index intact.
Confirmed via direct inspection, not just trusted.

## 1. Latest-lineage discovery and integration (mandate §2)

Using git topology (not timestamps), discovered the mandate's own premise was incomplete: my
own prior arc's EvidenceHead (`814e7c69`) was not actually the latest validated head. A
separate, independent session had run "Red-Team Reconciliation + True-P0 Closure"
(`14d9041a`), diverging from the same shared ancestor (`f57812a0`) and reaching its own real,
gate-passed EvidenceHead that never merged with mine. That session's own audit independently
confirmed the same "origin/main diverged and was never reconciled" finding already on record
in this session's own memory, and found a real, confirmed P0: the message-delivery-truth fix
from an earlier arc this session correctly plumbed the real outcome to the IPC boundary, but
the renderer's `onChatSend()` never read it.

Merged (`b9ecf58d`) with zero conflicts despite two overlapping composition-root files
(`fedos_electron_beta_main.cts`, `fedos_desktop_runtime.ts`); verified semantically sound (not
just textually non-conflicting) via typecheck, full regression, and direct confirmation both
lineages' critical fixes coexist in the merged files. One pre-existing test-guard failure
(structural guard tests 3/4/11) confirmed, via direct baseline comparison against the red-team
lineage's own pure tip, to predate the merge.

**INTEGRATED CandidateHead: `c88a625b`** — the true authoritative base for everything below.

## 2. Recovery implementation reconciliation (mandate §4-8)

The preserved Recovery Bundle implementation (container/header/manifest/data-part-codec/
profile-selection/encryption-authority) was built against a stale, origin/main-based
assumption set that predates hundreds of commits of real product work. Its own
`fresh-machine-restore-findings.md` doc classified Direct Ratchet, Commerce, and Tor as
"N/A — doesn't exist" — **false** on the authoritative lineage, where all three are real,
live, extensively-proven features. Flagged prominently rather than silently carried forward.

Closed a real gap the bundle format's own completeness guard caught: 5 `FedosLocalProfilePaths`
fields added by later arcs this session were unclassified. 4 correctly excluded as device-bound
(`directRatchetRemotePublicKeyLogFile`, `directRatchetLiveStateSnapshotLogFile`,
`peerDeviceAnnouncementIdentityLogFile` — which would carry the OLD device identity forward if
included — `deviceSyncJournalInboundDedupLogFile`); 1 correctly included
(`identityTransitionConversationContinuityLogFile`).

## 3. The Restore/Import Coordinator (mandate §9) and two closed fresh-profile hazards

`fedos_recovery_bundle_import_coordinator.ts` — `inspectFedosRecoveryBundle()` (pure plan, no
passphrase) + `restoreFedosRecoveryBundle()` (the real restore, fail-closed at every stage).
Beyond the already-documented `localDeviceId` hazard, found and closed two more: the
`profile-descriptor` entry also carries `sealedMasterSeedRef`/`dataDirectoryRoot` — absolute
paths on the SOURCE machine. The coordinator never writes these verbatim; it regenerates every
machine/device-specific field against the target's own real values, verbatim-copying only the
genuinely portable ones (`profileId`, `displayLabel`, `accountPublicIdentity`).

## 4. Round 2: three more real bugs found and fixed while building the Export Coordinator + real IPC proof

1. **Sealed Master Seed was never persisted to disk on restore** — only unsealed in-memory for
   the single restore call. Without this fix, every restored profile would have become
   permanently unrecoverable on the very next launch — a severe, ironic bug in the one feature
   meant to prevent exactly that. Fixed: atomic write of the verbatim envelope, refusing if the
   target already exists.
2. **Cross-WASM-instance opaque-handle mismatch** — the default encryption boundary used
   dev-only Runtime Service functions that each construct a fresh WASM module instance per
   call, different from the instance that produced the AEAD key handle. `encrypt()` failed
   closed silently in a real packaged Electron process (never throws), surfacing only as
   `{outcome:"failed"}` — while identical mocked-boundary unit tests passed. This exact failure
   mode was already diagnosed and fixed once before, for Conversation encryption (Alpha
   7161-7240) — this file had instead copied Sync Package's older, still-broken precedent.
   Fixed with a new boundary mirroring the proven Alpha 7161-7240 pattern exactly — no new
   cryptography, only correct wiring. **Flagged, not fixed: Sync Package's own encryption is
   suspected to carry the same latent bug in real packaged use** — a real follow-up item for a
   future arc.
3. **Commerce data and `settings.json` had no path into the bundle at all.** Commerce is nested
   under `profile/`, invisible to `FedosLocalProfilePaths`; `settings.json` is a sibling of
   `profile/`, missed by both the whole-directory-backup and curated-bundle approaches. Closed,
   including `payment_settlements` (verified via its own header to carry no credential
   material) found unclassified during re-verification.

Wired into real IPC (`fedos-profile:recovery-inspect`/`-restore`/`-export`), never sending
Master Seed/private keys to the renderer, minting a fresh Device identity mirroring
`createProfile()`'s own Phase 7. Fixed a real packaging gap in the same pass:
`tsconfig.beta-runtime.json`'s explicit module whitelist omitted the recovery modules — the
packaged app would have 404'd on the dynamic import at runtime.

## 5. Verification (coordinator's own independent re-runs, not self-reported)

- `npm run typecheck` (core + electron): clean, 2 pre-existing unrelated baseline errors only.
- `npm run test:current`: 197 files / 2880 tests, 0 failures (up from 193/2827 — 4 new recovery
  test files added to the allowlist).
- Recovery unit suites: `fedos_disaster_recovery_portable_backup_recovery_bundle.test.ts` 28/28,
  `..._import_coordinator.test.ts` 14/14, `..._export_coordinator.test.ts` 7/7.
- Real fresh-machine restore vertical slice with real WASM crypto (no mocks): 4/4, including a
  stale hardcoded included-logs count (20→21) the coordinator found and fixed directly.
- Real spawned-Electron IPC acceptance
  (`fedos_disaster_recovery_portable_backup_ipc_acceptance.test.ts`): 3/3 — Machine A
  creates+exports; Machine B (separate subprocess, fresh dataDir) restores via bundle bytes
  only, recovers the same account identity with a fresh Device identity, and a **third**
  relaunch does a plain unlock successfully, proving the sealed-master-seed persistence fix
  reaches disk, not just memory. Wrong-secret fails closed with no partial writes; restore
  refuses to clobber an existing profile.
- `cargo test --locked`: 652/653 (1 pre-existing, unrelated dependency-count guard).
- `npm run release:electron-beta`: **14/14 gates**, verdict `ready-for-human-publication`, real
  NSIS installer built from `gitCommit=b93db7d2` (sha256
  `95d5cac322db73ad76ef614df1cc862bf312e39bdd48c79ec1db99025f686aca`).
- Packaged binary smoke launch (the exact check that caught an earlier P0 this session): clean
  exit code 0, real step log written — confirms the new recovery module wiring does not
  regress packaged startup.
- Process hygiene: 8 lingering `node.exe` processes from verification runs found and cleaned up
  via `taskkill //PID //F //T`; confirmed zero remain.

## 6. Honestly disclosed remaining scope

1. **Real fresh-machine E2E through the actual NSIS-installed binary specifically** (as opposed
   to the dev Electron binary + compiled dist, which the existing IPC acceptance test already
   uses for a real cross-process/cross-dataDir proof) — not attempted. The dirty-tree guard in
   `release:beta` requires a clean detached worktree for this, a nontrivial separate operation.
2. **Onboarding UI screens** for restore/export — IPC-only today, no renderer surface.
3. **Sync Package's own suspected WASM-instance bug** — unconfirmed, flagged for its own
   investigation.
4. **Commerce signing-key files** (`media_grant_signing_keys` etc.) — deliberately excluded
   pending a real security sign-off, an explicit, disclosed decision from round 1, not
   revisited.

## 7. Final classification

- **RECOVERY BUNDLE**: substantially COMPLETE at the backend/coordinator/IPC layer; PARTIAL at
  the product-UX layer (no onboarding UI).
- **RESTORE COORDINATOR**: COMPLETE, real-proven via spawned-process IPC round trip.
- **FRESH DEVICE IDENTITY**: PASS — never read from the bundle, always caller-supplied fresh.
- **OLD DEVICE STATE**: EXCLUDED, verified structurally (session-ID binding + explicit
  exclusion list), never transferred.
- **P0 found and fixed this arc**: 1 (sealed-master-seed persistence — the most severe, since
  it would have silently defeated the whole feature's purpose).
- **P1 found and fixed this arc**: 2 (WASM cross-instance handle mismatch in production;
  Commerce/settings bundle coverage gap).
- **P1 flagged, not fixed**: 1 (Sync Package's own suspected same WASM-instance bug).
- **PRODUCT RELEASE READINESS**: unaffected, still COMPLETE for the non-Tor default — this
  arc's work is additive and did not touch any previously-validated code path outside the new
  recovery files and the 3 new IPC channels.
