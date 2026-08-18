# Recovery and Backup Guide — FedOS Desktop Beta 0.1.0-beta.1

**This document did not exist anywhere in the shipped publication bundle before this review.**
FedOS Desktop Beta has a real, tested backup/restore feature (a "Recovery Bundle") reachable from
the app itself, but no publication document explained it before now — a reader would only learn
about it, and its safety-relevant scope limits, after already being mid-flow inside the app. This
guide closes that gap using only what this review directly confirmed in the app's own real
interface strings and its recovery source code — nothing here is invented.

## Where to find it

- **To back up:** Settings → "Backup (Disaster Recovery Bundle)" → **Export Backup…**
- **To restore:** the Welcome screen → **Restore from a backup**

## What a Recovery Bundle actually is

An encrypted export of your local profile — protected by a secret you control at export time —
that can later be imported on a fresh install to re-establish your identity and locally-held data.

## What it restores

Your account identity (the same `accountPublicIdentifier` you had before), your profile settings,
and the substantive local content the export was told to include (for example, conversation
content that isn't itself device-bound or session-bound state — see the exclusion list below).

## What it deliberately does NOT restore — read this before you rely on a backup

- **Your active Direct Ratchet sessions.** A restored device re-establishes ratchet sessions fresh,
  through the real protocol, with each contact — it does not clone a live secret session.
- **This device's trust relationships with your contacts (Device Registry / Device Pairing state).**
  Device trust is re-established, not blindly restored, on the new device.
- **Sync state, sync journals, and sync conflict history.**
- **Device-binding and peer-capability observation records, and conversation-transport observation
  logs.**
- **Local logs and session-only data.**

This is a deliberate design choice, not an oversight: device-bound and session-bound state
re-establishes safely through its own existing protocol path on the restoring device. Restoring it
directly from an old bundle would risk resurrecting stale device identity or session state instead
of a fresh, correctly-trusted one.

## Fresh-device semantics — what actually happens on restore

- A Recovery Bundle **can only restore into a completely empty location on this device** — it never
  merges into or overwrites an existing profile. If you want to test a restore, do it into a fresh
  profile location, not over your current one.
- The restoring device gets a **new, locally-generated device identity** — it never resurrects the
  old device's identity. This is intentional: restoring an old device identity onto new hardware
  would misrepresent which physical device your contacts are actually trusting.
- Because of the above, **your contacts will need to re-establish trust with this "new" device**
  through the normal pairing/first-message process — restoring a backup is not the same as
  continuing exactly where the old device left off from your contacts' point of view.

## Backups are a point-in-time snapshot

- A Recovery Bundle only contains what existed in your profile at the moment you exported it.
  Anything that happened after export — new messages, new settings, new trust relationships — is
  **not** in that bundle.
- Restoring an **older** backup can reintroduce older, since-superseded state (older settings, older
  conversation history) as your current state. If you have made a newer backup since, prefer it.
- **Make a fresh backup periodically**, and especially before anything risky (an uninstall, a major
  update, replacing your device) — not just once.

## Your backup's secret matters as much as the file itself

A Recovery Bundle is encrypted. **Keep the secret you used to protect it, together with the bundle
file itself, but never in the same place as each other or shared with anyone else** (the same
principle as your unlock passphrase — see `SECURITY_NOTICE.md`). If you lose either the bundle file
or its secret, that specific backup cannot be used to recover your profile.

**Losing your device, your Recovery Bundle, and its secret all at once is the one scenario this
Beta cannot recover you from.** There is no cloud copy and no support-assisted recovery — see
`04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md`.

## Recovery Bundle vs. "Start Over"

These are different, both real, both irreversible in their own way:

- **Restoring a Recovery Bundle** brings a profile back from a backup, into a fresh, empty location.
- **"Start Over"** (available in-app) permanently erases the remaining local profile data on *this*
  device. It does not create a backup for you first — any conversation history not already covered
  by a prior export is not recoverable after Start Over. Do not choose Start Over as a way to "clean
  up before backing up" — back up first if you want a copy.

## Replacing a machine

If you are moving to a new computer: export a Recovery Bundle on the old machine (with a secret you
will remember and store safely), install FedOS Desktop Beta on the new machine, and use "Restore
from a backup" on first run. Expect to re-establish device trust with your contacts afterward, per
the fresh-device semantics above.
