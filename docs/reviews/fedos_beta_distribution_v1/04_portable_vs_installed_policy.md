# 04 — Portable vs. Installed Policy

## Decisions

- **Portable is officially supported for Beta 0.1, but as a secondary,
  developer/advanced-user format only** (`03`) — not the format
  recommended to ordinary Beta testers in release announcements.
- **Portable uses the SAME standard user-data directory as the installed
  build, never data beside the executable.** `fedos_electron_beta_main.cts`'s
  own `dataDir()` calls `app.getPath("userData")` unconditionally (unless
  the test-only `FEDOS_ELECTRON_BETA_DATA_DIR` override is set) — this is
  unconditional on how the `.exe` itself was obtained (installed vs.
  extracted-from-ZIP-and-run), so there is no code path that would ever
  place profile data next to a portable executable. This is a proven
  current-source fact (`01`), not a new decision this review invents —
  the policy simply confirms and freezes it.
- **Installed and portable builds of the SAME version MAY open the same
  profile.** Since both resolve to the identical `app.getPath("userData")`
  path for the identical `productName`/`appId` (`com.fedos.desktop.beta`),
  a user who runs the ZIP build today and the NSIS-installed build
  tomorrow reaches the same durable profile root.
- **Concurrent access is NOT allowed and is not safely supported.**
  Nothing in the accepted Runtime/persistence lineage implements
  cross-process file locking for the profile root; `FedosProfileInitializationCoordinator`
  assumes exactly one live process per profile (`08548845`'s own Phase A
  ownership inventory — "one Runtime" is a single-PROCESS guarantee, not
  a cross-process lock). Running the installed build and a portable build
  against the SAME profile AT THE SAME TIME is undefined and must be
  documented as unsupported, not silently tolerated.
- **No profile migration step is needed between modes**, because both
  modes already resolve to the identical directory — "migration" would
  only be needed if portable used a different root, which it does not.
- Portable is **public-Beta-supported** (not developer-only) as a
  fallback/no-install-permission option, but release notes must state
  plainly: "the installer is the recommended way to run FedOS Desktop
  Beta; the portable ZIP is provided for users who cannot run an
  installer, and shares the same profile location — do not run both
  copies at the same time."

## Non-ambiguity statement

There is exactly one profile ownership rule for Beta 0.1: one
`app.getPath("userData")`-rooted profile per Windows user account,
regardless of which artifact format launched the process, with the
explicit constraint that only one FedOS Desktop process may hold that
profile open at a time (already enforced in spirit by the Coordinator's
own single-Runtime model, `01`/`08548845`, though no OS-level file lock
current exists to reject a second concurrent launch — noted as a real,
unresolved gap for the next implementation Arc, not invented as fixed
here).
