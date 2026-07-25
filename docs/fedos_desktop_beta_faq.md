# FedOS Desktop Beta — FAQ

## What is FedOS Desktop?

A focused, end-to-end encrypted Direct-message secure messenger, built
on the Nostr protocol (NIP-17), currently in Closed Beta. See
`README.md` and `ARCHITECTURE.md` for the full picture, including this
project's original, much broader vision (not what's shipped today).

## Is it audited?

**No.** No independent, external security audit has been performed as
of this Beta. See `SECURITY.md`.

## Is my data encrypted?

Direct (1:1) conversation contents are end-to-end encrypted using a
real Double-Ratchet session per conversation (this codebase's own
implementation — not the Signal Protocol library, not interoperable
with Signal). A Relay operator can still see WHO you're messaging and
WHEN, even though it can't read WHAT you're saying — see `SECURITY.md`'s
metadata-correlation disclosure.

## Can I use Group Messaging?

**Not in this pilot, on purpose.** The underlying transport can't yet
let a recipient see a group thread — only the sender's own device can.
Rather than ship a UI that would misrepresent this as working, no Group
Conversation screen is exposed. See `KNOWN_LIMITATIONS.md`.

## What happens if I forget my passphrase?

Your data is permanently unrecoverable. There is no passphrase-reset,
no recovery code, and no account-recovery service. Your Master Seed is
sealed by your passphrase and never stored anywhere in recoverable form.
See the Recovery Guide.

## How do I back up my data?

See the Backup Guide. In short: back up your entire profile directory
before upgrading, uninstalling, or moving to a new machine — there is
currently no automated migration or cloud backup.

## Can I use FedOS on multiple devices?

Yes, via **Device Pairing** — see
`docs/desktop_beta_user_guide_device_pairing.md`. Each Device keeps its
own separate local profile; pairing establishes trust between Devices,
it doesn't merge or share message history between them.

## Is the installer signed?

**No, it is genuinely unsigned.** Expect a Windows SmartScreen warning
on first run. Checksums (published alongside each release) verify the
file wasn't corrupted in transit — they don't verify who published it.
See `SECURITY.md` and `BUILDING.md`.

## Does FedOS collect analytics or telemetry?

No. See the Privacy Policy draft — this application does not report
usage data anywhere; everything stays on your device except the
encrypted messages you send through Relays you configure.

## Can I search my messages?

Yes, but only messages you've actually opened, using a local plaintext
keyword index — not an encrypted blind index. See the Search Guide.

## What's Safety Center?

A single screen showing this build's own honest, per-subsystem
self-report, plus your Identity Replacement and Signed Deletion inboxes.
It is not an external audit result. See the Safety Center Guide.

## Someone's claiming to be a contact under a new identity — what do I do?

Review it carefully in Safety Center's Identity Replacement inbox before
accepting. See the Identity Replacement Guide — when in doubt, use
**Defer** and verify with your contact through a separate channel first.

## Is there onion routing / anonymous transport?

No — extensively designed across this repository's history, but not
implemented. Treat any claim otherwise as inaccurate. See `ROADMAP.md`.

## Can I roll back to an older version?

**Not with a tested, supported path.** No committed `Cargo.lock`, no
schema-migration code. Back up your profile before every upgrade. See
the Migration Guide.

## How do I give feedback or report a bug?

See the Feedback Guide. Security issues specifically should go through
`SECURITY.md`'s own private reporting channel, not the ordinary
feedback channel.

## Where can I read the full list of known limitations?

`KNOWN_LIMITATIONS.md` (deliberate design/security boundaries) and
`docs/fedos_desktop_beta_known_issues.md` (day-to-day rough edges) —
they cover different things and are both worth reading.

## Will there be a Public Beta / stable release?

Not decided by this document. The current, honest status is Closed Beta
only — see `README.md`'s Status section and `ROADMAP.md` for what's
being considered before any wider release, including commissioning the
independent security audit this FAQ mentions above.
