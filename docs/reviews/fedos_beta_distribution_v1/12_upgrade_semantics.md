# 12 — Upgrade Semantics

## Decision: in-place upgrade IS supported for Beta 0.1, strictly limited to same-schema-version releases

Since (`11`) every persisted format's own `schemaVersion` has never left
its initial value anywhere in this accepted lineage, and no
migration code exists, the ONLY upgrade this review can respons­ibly
declare supported is: **a newer Beta 0.1.x build (`0.1.0-beta.N` →
`0.1.0-beta.N+1`) that does not change ANY schema version.** Any release
that WOULD change a schema version must instead follow `13`'s
restore-from-backup path, not this in-place flow.

## The supported flow

1. **Stop the application.** The user must fully exit FedOS Desktop
   (Beta's own `lock`/`quit` — `08548845`'s own ownership inventory
   confirms a clean shutdown path exists and is tested) before replacing
   any files.
2. **Back up the profile.** The user (or, in a future Arc, an
   installer/updater script) copies the entire `app.getPath("userData")`
   profile root to a separate location BEFORE installing the new
   version. This review does not implement automatic backup — it is a
   REQUIRED step in the documented upgrade procedure for V1, performed
   manually or by a future Arc's own tooling.
3. **Verify the new artifact** against its own published `SHA256SUMS`
   (`07`) before installing/extracting it.
4. **Install/replace the application** — run the new NSIS installer
   (which itself replaces the prior installed copy in place, standard
   NSIS behavior) or extract the new ZIP over/alongside the old one.
5. **Preserve the profile root** — untouched by the above, since
   `app.getPath("userData")` lives outside the application's own install
   directory (`04`, proven current source).
6. **Start the new version.**
7. **Validate schemas** — the FIRST real operation the new version's own
   Coordinator performs is `detectProfileState()`, which already reads
   and validates the profile descriptor and fails closed to
   `"recovery-required"` on anything unexpected (`11`) — this is
   EXISTING behavior, not new logic this review adds.
8. **Run migrations only if explicitly implemented** — for Beta 0.1,
   NONE are implemented (`11`); this step is a no-op today. A future Arc
   introducing an actual schema bump MUST implement and test a real
   migration before that bump ships, or must accept the "no in-place
   upgrade across that boundary" consequence documented in `13`.
9. **Fail closed on unsupported schema** — already the accepted behavior
   of every codec inspected (`11`); this review adds no new fail-closed
   logic, it confirms the existing one is suf­ficient for the ONLY
   upgrade case (`8`) this policy actually permits.
10. **Preserve the old application artifact where appropriate** — for the
    ZIP/portable format, the user naturally retains the old folder unless
    they delete it; for the NSIS-installed format, this review recommends
    (for the next Arc) that the installer NOT delete the previous
    version's own installer file from the user's Downloads folder (out
    of the installer's control anyway) and that release notes advise
    keeping the previous installer until the new version is confirmed
    working — a manual-rollback safety net (`13`).

## What is explicitly NOT supported for Beta 0.1

- Upgrading across any release that changes a Settings/Profile/Archive/
  Device-Registry/Sync-Journal schema version — no migration exists
  (`11`); such a release requires a fresh profile or a restore from a
  PRE-upgrade backup, communicated explicitly in that release's own notes.
- Any AUTOMATIC upgrade trigger — this is a manual, user-initiated
  procedure for V1 (`15`).
