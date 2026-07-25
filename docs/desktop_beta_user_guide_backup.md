# FedOS Desktop Beta — Backup Guide

## There is no cloud backup or account-recovery service

FedOS Desktop stores everything locally. There is no server-side backup,
no cloud sync of your profile, and no account-recovery service of any
kind. If your local profile is lost and you have no backup of your own,
your conversation history and identity for that profile are gone. This
is a deliberate design property (see `SECURITY.md`), not a missing
feature.

## What to back up

Your profile lives under this Electron application's own `userData`
directory, on Windows normally somewhere under
`%APPDATA%\<application folder>\profile`. **This Beta does not yet
display its own exact profile path anywhere in the UI** — a real,
disclosed gap (see `docs/fedos_desktop_beta_known_issues.md`). To find
it on your machine: check `%APPDATA%` for a folder matching this
application shortly after you first create a profile (its exact name is
derived from the packaged app's own identity and has not been
independently re-verified for this document — do not assume a specific
folder name without checking). If you set the
`FEDOS_ELECTRON_BETA_DATA_DIR` environment variable (a development/
advanced option — see `BUILDING.md`), your profile lives there instead.

Back up the **entire profile directory**, not individual files inside
it — this app's own persistence format is not documented as safe to
partially copy.

## When to back up

- Before upgrading to a new Beta build. **Version rollback has no tested
  path** (no committed `Cargo.lock`, no schema-migration code — see
  `KNOWN_LIMITATIONS.md` and `docs/fedos_desktop_beta_migration_guide.md`),
  so a fresh backup immediately before upgrading is your only real
  safety net if a new version doesn't work as expected.
- Before uninstalling or reinstalling.
- Before moving to a new computer.
- Periodically, if you're relying on this Beta for anything you'd mind
  losing — remember this is Beta software (see `KNOWN_LIMITATIONS.md`).

## Restoring a profile directory backup

Copy your saved profile directory back into the same `userData` location
on a fresh install of the **same or compatible** Beta version. There is
no guided restore flow for this — it is a manual file-copy operation,
and mixing profile-directory contents across meaningfully different
Beta versions is untested (see the Migration Guide).

## A different, narrower backup: Archive export

Separately from a full profile-directory backup, the **Archive** screen
lets you export a single Direct Conversation's history to a file you
choose, and later restore it — either onto the same profile or onto a
different one. This is not a substitute for backing up your whole
profile (it does not include your account identity/keys, Device trust
state, or other conversations), but it is useful for preserving one
conversation's history independently. See
`docs/desktop_beta_user_guide_archive_and_deletion.md` for the exact
steps, and note: restoring an Archive applies your CURRENT
retention/suppression state at restore time, so some previously-deleted
content may come back marked as redacted/tombstoned rather than fully
restored, by design.

## What backing up does NOT protect against

A backup of your local profile directory is only as safe as the storage
you keep it on. It contains your sealed (passphrase-protected) Master
Seed material and your local message history — treat a backup copy with
the same care as the original: do not upload it to an untrusted location,
and remember your passphrase is what protects it (there is no separate
backup-specific recovery code).
