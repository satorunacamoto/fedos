# FedOS Desktop Beta — Known Issues

This list is about specific, user-noticeable rough edges — things you
might actually run into while using the app. For the broader, deliberate
design/security limitations (what this Beta doesn't do and why), see
`KNOWN_LIMITATIONS.md` instead; this document doesn't repeat those.

## Interface

- **No in-app way to see where your profile is stored on disk.** If you
  need to back it up manually, you currently have to look under
  `%APPDATA%` yourself — see the Backup Guide.
- **New messages in an open conversation can take up to ~2 seconds to
  appear.** The chat view polls periodically rather than receiving a
  live push; this is a known, bounded delay, not a stuck conversation.
- **A dropped Relay connection does not reconnect on its own.** If the
  nav bar shows a Relay as disconnected, lock and unlock the app again
  to reconnect — there is currently no in-app "reconnect" button.
- **Settings has fields that are saved but not yet active**: archive
  directory, auto-start, and auto-lock timeout are stored when you save
  Settings, but no part of this Beta currently reads or applies them.
  Changing them has no visible effect yet.
- **The interface language selector in Settings does not change the
  interface language.** The preference is saved but not yet wired to
  any actual translation; the UI remains in English regardless of this
  setting.
- **The Recovery screen's only real actions are Retry, Copy diagnostic
  code, and Quit.** If none of those get you unstuck, your remaining
  option is restoring a previously-exported Archive onto a fresh
  profile (see the Recovery Guide) — there is no in-app repair tool.

## Search

- Only messages you've actually opened are searchable — see the Search
  Guide.
- Group messages (in the sense of this codebase's own pairwise-fanout
  "groups," which are not exposed in this pilot's UI at all) are
  deliberately excluded from search results.

## Devices

- **Device Pairing requires the new Device's app to stay open** between
  creating a pairing request and completing it — closing the app
  mid-pairing loses the in-progress request and you must start over.
- Revoking a Device is a local-only fact; it doesn't propagate
  automatically to other Devices, and doesn't confirm the revoked
  Device actually lost anything.

## Archive

- Restoring an Archive applies your CURRENT retention/suppression
  state, so some previously-deleted content may come back marked as
  redacted/tombstoned rather than fully restored — by design, but worth
  expecting.
- No return-acknowledgement exists for a Suppression fact reaching
  another Device — you can only confirm it reached a Relay, not that
  another Device applied it.

## Performance, at scale

- Very large message/device histories may cause slower Archive/Search/
  Sync operations over time (measured, real, not yet user-visible at
  typical pilot scale) — see `ROADMAP.md` for the underlying cause and
  planned fix.

## Distribution

- **Windows will show a SmartScreen "unrecognized publisher" warning**
  on first run — this build is genuinely unsigned, not a false positive
  to dismiss without understanding it (see `SECURITY.md`).
- Version rollback and cross-version migration have no tested path yet
  — see the Migration Guide before upgrading.

## Reporting a new issue

Found something not listed here? See the Feedback Guide for how to
report it.
