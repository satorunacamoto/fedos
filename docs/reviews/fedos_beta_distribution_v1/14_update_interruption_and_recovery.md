# 14 — Update Interruption and Recovery

This review threat-models interruption at every named stage. It
implements no update mechanics — it specifies what the next
implementation Arc (`19`) must PROVE before any update-related feature
(even the manual-download flow's own tooling) is considered complete.

## Interruption points and required atomicity

| Stage | What interruption looks like | Required atomicity/evidence |
|---|---|---|
| Download | connection drop mid-download; partial file on disk | the downloaded file must be checksum-verified (`07`) BEFORE it is treated as a valid artifact; a partial download will simply fail the checksum — no special handling needed beyond "always verify before use," already this review's own policy |
| Checksum verification | the verification step itself is interrupted (process killed) | re-run is always safe (checksum verification is read-only, idempotent, no state mutation) — no special recovery needed |
| Installer launch | the NSIS installer itself crashes/is killed mid-run | NSIS's own transactional install behavior applies (electron-builder's default NSIS template uses standard Windows installer conventions); this review does not independently verify NSIS's own atomicity claims — flagged as required evidence for the next Arc (an actual interrupted-install test, not assumed safe) |
| Application shutdown (before upgrade) | the user kills the process instead of a clean `lock()`/quit | the accepted Runtime's own crash-recovery discipline (Alpha 5061-5160/5161-5240's own Phase M testing, per the prior arcs) already covers "no duplicate Runtime, no false effective Settings, no corrupted profile" for an ABRUPT process kill — this is EXISTING evidence, not new; still, the upgrade PROCEDURE (`12`) instructs a clean shutdown first, since an abrupt kill during the specific moment of file replacement (below) is a distinct, less-tested scenario |
| File replacement (installer copying new files over old) | power loss / process kill mid-copy | this is squarely the installer TOOL's own responsibility (NSIS); the required evidence for the next Arc is a REAL interrupted-install test (e.g. kill the installer process mid-copy, relaunch, confirm the app either fully old, fully new, or the installer detects/repairs a partial state) — not asserted safe here without that test |
| First launch of the new version | the new version crashes on its very first launch after upgrade | the existing profile/Settings validation path (`detectProfileState()`, `12` step 7) already fails closed rather than corrupting the profile on a bad read; a crash in the NEW binary's own code before that point is a code-quality concern for that release, not an update-mechanism concern |
| Profile validation | validation itself is interrupted | validation is a read-only operation in the accepted lineage (confirmed: `detectProfileState()` reads before any write) — safe to re-run from scratch on next launch |
| Migration | interrupted mid-migration | **not applicable for Beta 0.1** — no migration code exists (`11`); this row exists only so a FUTURE Arc that adds real migration code is required to answer it before shipping that migration, per this document's own standing requirement |
| Rollback | interrupted mid-rollback | rollback (`13`) is either "reinstall an older binary" (subject to the same File-replacement-atomicity question above) or "restore a backup" (a plain file copy the user/tooling performs — interruption leaves either the old or the partially-restored state; the required evidence is that restore instructions tell the user to verify the profile is fully present before relaunching, not to assume a partial restore is safe) |

## What this review requires, not implements

The next implementation Arc must produce REAL evidence (not
assumption) for: (1) a genuine interrupted-NSIS-install test on a real
Windows machine, (2) a genuine kill-during-shutdown-then-relaunch test
specifically at the moment of an upgrade (distinct from the already-
covered ordinary crash-recovery evidence), and (3) explicit, tested
restore-from-backup instructions. This review does not claim any of
these three are currently proven — `01`'s own "prior execution evidence"
citations cover ordinary crash recovery, not update-specific
interruption.
