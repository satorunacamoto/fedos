# FedOS Desktop Beta — Migration Guide

## The honest current state: there is no automated migration path

**This Beta has no schema-migration code for the on-disk profile,
settings, or archive formats, and `Cargo.lock` is deliberately not
committed** (see `KNOWN_LIMITATIONS.md`, `ARCHITECTURE.md`). In plain
terms: there is currently no tested, automatic way to move a profile
created by one version of this Beta forward (or backward) to a
meaningfully different version. This is a real structural fact, not an
oversight this document is glossing over — treat "upgrade forward only,
with a fresh backup first" as the real constraint until a future Arc
builds real migration tooling (see `ROADMAP.md`).

## Recommended practice for now

1. **Back up your profile directory before installing a new version**
   (see the Backup Guide). This is your real safety net.
2. Install the new version.
3. Launch it and confirm it can unlock your existing profile normally.
   If it can, the on-disk format was compatible and no migration was
   needed — most incremental Beta updates fall into this category.
4. **If it cannot** (you land on the Recovery screen with an
   `unsupported-version` diagnostic code), do not attempt to force it.
   Reinstall the previous version, confirm your backed-up profile still
   works there, and wait for a version explicitly documented as
   supporting migration from your profile's schema version before
   upgrading again.

## Moving between machines

The same profile-directory backup/restore process used for version
upgrades works for moving to a new computer, as long as you install a
**matching** Beta version on the new machine first. See the Backup
Guide for exactly what to copy.

## Moving between Beta and any future stable release

No stable release exists yet, and no migration path from Beta to a
future stable release has been built or tested. Do not assume Beta
profiles will carry forward automatically when a stable release ships —
this document will be updated once that path is real and tested, not
before.

## What this means for the pilot

If you're participating in the Closed Beta pilot and a new build is
distributed to you mid-pilot: **back up your profile first**, every
time, with no exceptions, even for what looks like a small update.
