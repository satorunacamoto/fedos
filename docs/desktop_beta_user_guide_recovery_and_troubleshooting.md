# FedOS Desktop Beta — Recovery and Troubleshooting Guide

## Wrong passphrase

You see "Unlock failed." Click **Try again** and re-enter your passphrase
carefully. There is no way to recover a forgotten passphrase — your Master
Seed is sealed by it and never stored anywhere in recoverable form.

## "This profile could not be unlocked normally"

You are on the Recovery screen. It shows a short diagnostic code:

- `recovery-required` / `corrupt` — the locally stored profile data
  appears corrupted.
- `seed-unavailable` — the compiled cryptography module is missing from
  this build. Reinstall or rebuild the application.
- `unsupported-version` — this profile was created by an incompatible
  schema version (e.g. a much older or newer build).

From here you can:

- **Retry unlock** — safe to try again if you think the problem may have
  been transient.
- **Copy diagnostic code** — copies a short, non-secret code you can share
  with support; it never contains your passphrase or any key material.
- **Lock/Quit** — leave the app in its current state and come back later.

There is no Master Seed recovery code of any kind. If your profile is
genuinely unrecoverable, your only path back to your conversation history
is restoring a previously-exported Archive (see the Archive guide) onto a
fresh profile.

## The app won't start at all

Check that the real WASM cryptography artifact was built (see the
Installation Guide) — a source checkout without it fails closed rather
than falling back to a placeholder.

## A Relay seems offline

Open Settings and confirm the Relay URL is correct. One unreachable Relay
does not block the rest of the app — other configured Relays keep
working, and features requiring connectivity will recover automatically
once the Relay is reachable again.
