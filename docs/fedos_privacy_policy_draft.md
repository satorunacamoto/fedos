# FedOS Desktop Beta — Privacy Policy (DRAFT)

**This is a DRAFT, not a final, legally-reviewed Privacy Policy.** It has
not been reviewed by a lawyer, does not yet name a real legal entity as
data controller, and should not be published or presented to end users
as a final policy until a human with the authority to do so completes
that review. It is written to be factually accurate about what this
software actually does, verified against its current source, as a
starting point for that review — not a substitute for it.

## Summary

FedOS Desktop is designed to store your data **locally, on your own
device**, and to send only what's necessary to deliver encrypted
messages through Nostr Relays you choose to configure. It does not have
user accounts, does not run a backend server that stores your data, and
does not collect telemetry or usage analytics — verified directly
against this application's own source code, not merely a stated
intention.

## What is collected

**Nothing is collected by us.** There is no FedOS-operated server this
application reports to, no telemetry, no crash reporting service, no
usage analytics, and no advertising identifiers. This draft policy will
be updated immediately, before any such feature ships, if that ever
changes.

## What is stored, and where

- **Locally, on your device, inside this application's own profile
  directory**: your sealed (passphrase-encrypted) Master Seed and
  derived keys, your local message history, your Device Registry and
  trust decisions, Settings, and a local plaintext search index of
  messages you've opened. See `docs/desktop_beta_user_guide_backup.md`
  for the exact location.
- **Nothing is stored by FedOS in any cloud service.** There is no
  account-recovery service, no cloud backup, and no server-side copy of
  anything.

## What a Nostr Relay you connect to can see

This is the most important privacy fact this draft can state plainly:
**a Relay operator, or anyone observing traffic to a Relay you connect
through, can see who you are sending encrypted messages to and when**,
and can correlate that pattern over time (which accounts talk to which
other accounts, how often, message timing and size). Message *content*
is end-to-end encrypted and the Relay cannot read it — but this
metadata is not hidden by this Beta. There is no onion-style routing or
traffic-mixing in this codebase to hide it (see `SECURITY.md`,
`ARCHITECTURE.md`). If you connect through a public Relay, treat that
metadata as visible to that Relay's operator and to anyone with access
to its traffic.

## Sharing with third parties

We do not sell, rent, or share your data with third parties, because we
do not receive it in the first place — it never leaves your device
except as encrypted messages to Relays you yourself configure, and
Device Pairing data you yourself exchange with your own other Devices.

## Your choices

- You choose which Relay(s) to connect through, and can remove any of
  them at any time in Settings.
- You choose whether to pair additional Devices, and can revoke any
  Device's trust at any time.
- You can uninstall this application and delete your local profile
  directory at any time; nothing remains anywhere under our control
  once you do (we never had a copy to begin with).

## Children's privacy

This is Beta software intended for technically capable pilot
participants. It is not designed or marketed for use by children, and
this draft makes no specific children's-privacy compliance claim (e.g.
COPPA) — a real legal review should address this explicitly before
public release if the product's audience could include children.

## Changes to this policy

This is a Beta-stage draft and will change as the product changes and as
real legal review is completed. Once finalized, changes to a real
Privacy Policy would be dated and disclosed to users before taking
effect — that process does not yet exist for this draft.

## Contact

<!-- Contact details intentionally left as a placeholder, matching
SECURITY.md's own established convention: this draft does not invent a
privacy-contact email or legal entity name that does not yet exist. A
human with the authority to do so must fill this in, along with a real
legal review, before this document is published as a final policy. -->
