# Disaster Recovery / Portable Backup — Lineage Reconciliation + Import Coordinator

Written by the Coordinator's fork, reconciling the preserved Disaster Recovery work
(originally built against stale `origin/main`) against the authoritative product lineage
(`c88a625b`, itself the Coordinator's own merge of the Own-Device Sync Final Closure arc and
an independent Red-Team Reconciliation arc). **All source/doc changes described here remain
UNCOMMITTED** — per the user's own explicit instruction, only the Coordinator may commit.

## Doc classification table (mandate §21)

| Doc | Status | Notes |
|---|---|---|
| `00_gate_decision.md` | **CURRENT, authoritative** | The design-freeze record. Verified against current code — still accurate. |
| `01_recovery_bundle_format.md` | **CURRENT, authoritative** | Wire format. Verified — matches shipped code exactly. |
| `02_restore_import_coordinator_requirements.md` | **CURRENT, authoritative** | Gates this session's own new Import Coordinator; its requirements are now implemented (see below). |
| `02_red_team_and_asset_classification.md` | **CURRENT, authoritative** | Not read in full this pass (time-bounded); no conflict found with anything else read. |
| `03_asset_classification.md` | **CURRENT** | Exists (contrary to a stale `IMPLEMENTATION_STATUS_CHECK.md` claim that it was missing — it was created by the later `e9dda98a` commit content, now staged). |
| `03_operator_recovery_flow_ux.md` | **CURRENT** | UX flow draft; not implemented this pass (out of scope — see below). |
| `ux-recovery-flow.md` | **CURRENT, has a real open placeholder** | `IMPLEMENTATION_STATUS_CHECK.md`'s own finding stands: the post-restore summary's deletion-classification copy is still `{{DELETION_CLASSIFICATION}}`/`{{DELETION_CLASSIFICATION_DETAIL}}` placeholders, not resolved text. Not fixed this pass (renderer/UI work, out of scope — see below). |
| `rollback-identity-truth-red-team.md` | **CURRENT, authoritative** | Agent C's red-team findings; the P0 (payload-retention staleness) is honored by the new Import Coordinator's classification logic (`"partial"`, never `"recovered"`, for `conversation-payload-retention`). |
| `fresh-machine-restore-findings.md` | **STALE — do not trust its per-asset table** | Written against the OLD `origin/main`-based lineage. Its RATCHET/COMMERCE/TOR "N/A — doesn't exist" classifications are **wrong** for the authoritative lineage (all three are real, live, COMPLETE features proven extensively elsewhere this session). Its build-fix findings (tsconfig rootDir, missing legacy-module includes) are independently confirmed **already fixed** on the authoritative lineage (STALE_FIXED, not ported — see below). Kept as historical record, explicitly flagged, not deleted. |
| `IMPLEMENTATION_STATUS_CHECK.md` | **CURRENT as of its own writing, now partially superseded** | Its "no import coordinator exists" and "5 unaccounted `FedosLocalProfilePaths` fields" findings are now closed by this pass's own work. |
| `DESIGN.md`, `UX_FLOW_DRAFT.md`, `RED_TEAM.md`, `FRESH_MACHINE_RESTORE_TRACE.md` | **SUPERSEDED, historical only** | Confirmed by `IMPLEMENTATION_STATUS_CHECK.md`'s own analysis; not re-verified independently this pass, no reason found to disagree. Kept, not deleted — one specific finding in `RED_TEAM.md` (dead `FedosIdentityTransitionOutboundNotificationCoordinator` publish path) was not independently re-checked this pass. |

**Nothing deleted.** All docs kept per the mandate's own explicit instruction not to remove anything until content is mapped.

## Lineage reconciliation (mandate §2 — done by the Coordinator, not this fork)

The Coordinator's own commit `c88a625b` already merged a separate, independent "Red-Team
Reconciliation + True-P0 Closure" arc into the Own-Device Sync Final Closure lineage. That
merge, its verification (typecheck, test:current, direct confirmation both lineages' fixes
coexist), and its evidence are the Coordinator's own work, already done before this fork
started — not redone here.

## `FedosLocalProfilePaths` reconciliation (real gap found and closed)

Five fields exist on the authoritative lineage's `FedosLocalProfilePaths` that did not exist
when the Recovery Bundle's profile-selection table was originally authored — confirmed via
the existing test suite's own completeness guard (`fedos_disaster_recovery_portable_backup_recovery_bundle.test.ts`
test 27), which failed with exactly these 5 unaccounted fields before this pass's fix:

| Field | Classification | Reasoning |
|---|---|---|
| `directRatchetRemotePublicKeyLogFile` | **EXCLUDED** | Direct Ratchet Live-State Durability arc — device-bound, same reasoning as the other `direct-ratchet-*` exclusions. |
| `directRatchetLiveStateSnapshotLogFile` | **EXCLUDED** | Same arc — sealed under a device-bound key, cryptographically inert on a new device, same reasoning as `directRatchetSealedSecretLogFile`. |
| `peerDeviceAnnouncementIdentityLogFile` | **EXCLUDED** | Peer Device Discovery arc — THIS device's own identity descriptor. Including it would carry the OLD device identity forward, directly violating the mandate's own §6/§20 fresh-device-identity requirement. |
| `identityTransitionConversationContinuityLogFile` | **INCLUDED** | Same category as the two sibling identity-transition logs already included; restoring it preserves real, protective continuity history and does not reopen any rollback hole (an absent/stale record already reads as honest `unknown`, never a false `good`, per this codebase's own established Security State discipline). |
| `deviceSyncJournalInboundDedupLogFile` | **EXCLUDED** | Own-Device Sync Protocol Final Closure arc — Own-Device Sync's own fact/snapshot model, same hard boundary as its 3 sibling `sync-*` exclusions. |

Fixed in `fedos_recovery_bundle_profile_selection.ts`. Test 27 now passes; full file 28/28.

## Commerce and Tor re-audit against current code (mandate §19/§20 — real, not reused stale claims)

**Commerce**: `fresh-machine-restore-findings.md`'s "N/A — doesn't exist" classification is
**stale and wrong** on the authoritative lineage — Commerce is COMPLETE with real durable
Order/Payment/Delivery/Receipt/Reputation state, extensively proven elsewhere this session.
Traced its actual storage: `commerceDurableFilePath(name)` in `fedos_electron_beta_main.cts`
resolves to `<dataDir()>/commerce/<name>.ndjson` — and `dataDir()` itself is
`<profile-root>/profile` (confirmed: `planFedosLocalProfilePaths(dataDir())`), so Commerce
data genuinely IS nested inside the profile directory a whole-directory copy would capture.
**However**, Commerce does NOT participate in the `FedosLocalProfilePaths` interface at all —
it uses its own dynamically-constructed path scheme — so the CURATED Recovery Bundle's Data
Part, which is entirely keyed off `FedosLocalProfilePaths` fields, has **no structural way to
include Commerce today**. This is a real, disclosed gap, not fixed this pass (would require
either adding named Commerce fields to `FedosLocalProfilePaths` or a second, parallel
selection mechanism — a real design decision, not a quick port, correctly deferred rather
than rushed).

**Tor**: strict-transport mode is currently configured entirely via environment variables
(`FEDOS_BETA_STRICT_TOR_ENABLED`/`_SOCKS_HOST`/`_SOCKS_PORT` in `fedos_electron_beta_main.cts`)
— confirmed via direct grep, no `settings.json` field exists for it. So "Tor settings" has
nothing durable to back up TODAY, for a currently-accurate reason (env-var/session
configuration, not because the feature doesn't exist) — the design doc's own "no live Tor
Ready state ever restored" requirement is trivially satisfied since there is no persisted Tor
state of any kind yet.

**A second real, disclosed gap found along the way**: `settingsFilePath()` resolves to
`<profile-root>/settings.json` — a SIBLING of `profile/`, not nested inside it. Neither the
whole-directory-backup recommendation from an earlier arc this session, nor the curated
Recovery Bundle (which only ever reads `FedosLocalProfilePaths` fields, all rooted under
`profile/`), captures `settings.json` (relay list, theme, language, notification/auto-lock
preferences). Lower severity than identity/message loss (settings are reconfigurable, not
security-critical), but real and worth a named follow-up.

## `tsconfig.beta-runtime.json` (mandate §22)

**STALE_FIXED, not ported.** Directly verified against the authoritative lineage: `rootDir: "src"`
is already set, and all 3 previously-missing legacy module includes
(`src/desktop/beta/...`, `src/device/sync_events/...`, `src/runtime/master_seed/...`) are
already present in the `include` array, and all 3 target files genuinely exist on disk. The
old worktree's own staged fix for this exact file is superseded by independent work already
on the authoritative lineage — not applied.

## Import/Restore Coordinator — mandate §9, the arc's own stated major missing piece

**Built**: `fedos_recovery_bundle_import_coordinator.ts` — `inspectFedosRecoveryBundle()` (pure,
no passphrase, the mandate's own §11 "validated plan before mutation") and
`restoreFedosRecoveryBundle()` (the actual restore, composing the already-real
`FedosRecoveryBundleEncryptionAuthority` + `fedosRecoveryBundleDestinationPathFor`).

**Two real fresh-profile hazards found and closed, beyond the already-documented
`localDeviceId` one**: the `profile-descriptor` Data Part entry also carries
`sealedMasterSeedRef` and `dataDirectoryRoot` — both absolute path strings on the SOURCE
machine's own filesystem. Writing that entry verbatim to a restored profile would silently
point the descriptor at a nonexistent path on the target machine. The coordinator never writes
`profile-descriptor` verbatim: it parses the restored bytes, keeps only the genuinely portable
fields (`profileId`, `displayLabel`, `accountPublicIdentity`), and regenerates
`localDeviceId`/`sealedMasterSeedRef`/`dataDirectoryRoot`/`createdAt`/`lastOpenedAt`/
`initializationState` against the caller-supplied TARGET values, via the existing, unmodified
`createFedosLocalProfileDescriptorV1()`.

**Tested**: `fedos_disaster_recovery_portable_backup_import_coordinator.test.ts`, 8/8 passing,
including a real filesystem round trip (temp source + temp target directories, real
`atomicWrite`) directly asserting the restored descriptor's `localDeviceId` differs from the
source's and `sealedMasterSeedRef`/`dataDirectoryRoot` point at the target, never the source —
the mandate's own §38 test-matrix item 1 requirement, proven, not just described.

**Explicitly NOT done this pass, disclosed rather than rushed**: full onboarding-coordinator
integration (a "restore" sibling to `createProfile()` in
`fedos_profile_initialization_coordinator.ts`, which owns Device-keypair generation, Device
Registry bootstrap, and Desktop Runtime start/bootstrap — a large, stateful class this pass
did not have budget to safely extend), IPC surface (mandate §10), the operator UX flow's
unresolved placeholder copy (mandate §21/`ux-recovery-flow.md`'s own open gap), the real
fresh-machine E2E on the installed binary (mandate §24-26), and the Commerce/`settings.json`
gaps named above. All are real, well-scoped follow-up items, not silently dropped — see the
Coordinator's own final report for the full disclosure.

## Verification run by this fork

- `npm run typecheck` (core + electron): clean, same 2 pre-existing baseline errors only.
- `npm run test:current`: 193 files / 2827 tests, unchanged from before this pass — zero
  regression from the profile-selection reclassification.
- New test files (not yet part of `test:current`'s own allowlist — a Coordinator decision,
  not made here): `fedos_disaster_recovery_portable_backup_recovery_bundle.test.ts` 28/28,
  `fedos_disaster_recovery_portable_backup_import_coordinator.test.ts` 8/8. The pre-existing
  `fedos_disaster_recovery_portable_backup_fresh_machine_restore_real_vertical_slice.test.ts`
  and the electron-spike package's own
  `fedos_disaster_recovery_fresh_machine_restore.test.ts` were NOT re-run this pass (both need
  real WASM/Electron binaries and non-trivial run time; time-bounded out per this pass's own
  scope decision).
