# 12. Packaging

Per this review's own instruction: do not select a packaging tool without
evidence. No production decision is made here.

## Options compared

- **Unpackaged development run** — today's ACTUAL state (`npm run
  start:runtime`, or, for a future Electron main process, `electron .`
  during development). Zero packaging cost, not distributable to a
  non-technical end user.
- **Portable build** — a single folder (or zip) containing the Electron
  binary + app files, run directly, no installer, no registry/system
  changes. Smallest packaging surface of any distributable option.
- **Installer (NSIS/Squirrel.Windows)** — requires `electron-builder` or
  `electron-forge` plus a maker/target configuration; adds an
  install/uninstall flow, Start Menu entry, etc.
- **Per-user install** — installs under the current user's own profile,
  no admin rights required.
- **System-wide install** — installs under `Program Files`, requires
  admin rights, affects every user on the machine.
- **Windows packaging formats** — portable `.exe`, NSIS installer, MSI,
  or MSIX/Windows Store package — each with different signing,
  update, and enterprise-deployment implications.

## Why no tool is selected here

The evidence this decision needs — who the actual end users are (the
developer only? a small trusted group? a general public release?),
whether admin-rights install is acceptable in the target environment,
and whether Windows Store distribution is desired — does not exist in
this repository or in the conversation context this review was
commissioned under. Selecting `electron-builder` vs. `electron-forge`,
or NSIS vs. MSIX, without that evidence would be exactly the kind of
premature, unjustified choice this review's own instruction forbids.

## Recommendation

**If** Electron is adopted (`20`), the FIRST packaging milestone should be
the **portable build** — it requires the least additional tooling
decision-making, has no installer/signing/update surface to get wrong
first, and is sufficient to validate that a real, packaged app launches
and works at all (`18`'s own "packaging smoke test"). Installer format,
per-user vs. system-wide, and Windows Store distribution should all be
deferred to a LATER, separately-evidenced decision, once real users and a
real distribution channel are identified.
