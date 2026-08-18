# Known Limitations for Beta Users — FedOS Desktop Beta 0.1.0-beta.1

Plain-language limitations, split by who needs to know them. Nothing here is invented — every item
is drawn from the shipped `KNOWN_LIMITATIONS.md`, `RELEASE_NOTES.md`, `README.md`, `SECURITY.md`, or
direct source inspection during this publication review.

## Things you (the user) should know before you rely on this Beta

- **This is Beta software.** Behavior and data formats may change before a stable release.
- **Your data is local.** Without your own backup, it can be lost if this device or the profile is
  damaged. See `05_RECOVERY_AND_BACKUP_GUIDE.md` for how to back up.
- **A forgotten passphrase is unrecoverable.** There is no password reset and no support-assisted
  recovery. If you lose your passphrase, the profile cannot be unlocked — ever.
- **No cloud account, no recovery service.** All recovery depends entirely on backups you make
  yourself.
- **Ordinary messages do not have forward secrecy by default.** FedOS has a Double Ratchet
  implementation, but ordinary Direct conversations use a plain encrypted route unless a build
  explicitly opts a conversation into the ratchet route. Every message is still end-to-end
  encrypted (relays cannot read contents) — but forward secrecy (limiting the damage if a key is
  later compromised) is not active by default in this Beta.
- **Relays can see metadata, not contents.** Who is talking to whom, roughly when, and roughly how
  much is visible to the relay operators your app connects to, even though message content is
  encrypted.
- **No Tor, no anonymity.** This release does not hide your IP address from relays and makes no
  anonymity claim.
- **No independent security audit has happened yet.** All verification so far is internal to this
  project.
- **Group messaging is not usable yet.** It exists at a technical level, but a recipient other than
  the sender cannot currently see a group's messages, so no group conversation screen is offered.
- **A disconnected relay does not reconnect on its own.** Lock and unlock again to reconnect; the
  status bar always shows current connectivity honestly.
- **Locking clears what's on screen, not guaranteed memory erasure.** The operating system could, in
  principle, have swapped sensitive data to disk while the app was unlocked — this Beta does not
  prevent that.
- **The installer is not code-signed.** See `03_DOWNLOAD_AND_CHECKSUM_GUIDE.md`.
- **Some settings need a restart, and a few are stored but not yet active** (language, auto-start,
  auto-lock) — this is disclosed, not a bug you need to report.
- **Upgrading across versions is not yet tested.** No prior installer version was available to test
  an in-place upgrade against during the Final RC seal. Installing over an existing version is
  expected to work for same-schema releases (see the schema-compatibility note in the release
  notes), but treat it as unproven until you have your own backup.
- **Commerce and Tor exist in this codebase but are out of scope for this release's public claims.**
  A tested Commerce flow (TEST/LOCAL payment simulator only, no real money) and a tested Tor
  strict-transport mode both exist internally, but neither is part of what this Beta cohort's
  release notes claim as available — do not rely on either being reachable in this build.

## Things a technically-minded user or an operator running this release should know

- **Signed Deletion and Identity Transition** are validated at the Node/IPC-contract level and
  through the full automated test suite, but do not yet have a dedicated real-installed-binary
  proof specific to those two capabilities (other capabilities do). Not a known defect — just a
  narrower evidence trail than the rest of the Final RC seal.
- **About 15-19 entries in the internal capability manifest remain unreconciled** against the full
  body of this project's own packaged-binary test evidence — they are unverified, not proven false.
  This does not affect any of the specific claims in this document, which were checked individually.
- **The auto-generated `RELEASE_NOTES.md` in the release-staging bundle says "14-real-gate release
  pipeline."** The real count is 13; see `02_PUBLIC_RELEASE_NOTES.md` for the correction and root
  cause.
- **`release-manifest.v1.json` and `publication-bundle.json` record a `gitCommit` one commit behind
  the actual sealed EvidenceHead** (both are the prior EvidenceHead, itself a docs-only commit
  directly on the source CandidateHead — no source drift). Worth a release-engineering sanity note,
  not a user-facing concern.

## Internal-only (not surfaced here, and correctly so)

Engineering-process details — which specific test suite covered which code path, internal P1/P2
tracking labels, which commit fixed which internal finding — are not repeated here. They live in
`docs/reviews/fedos_final_rc_seal/01_FINAL_RC_REPORT.md` for anyone who wants the full engineering
evidence trail.
