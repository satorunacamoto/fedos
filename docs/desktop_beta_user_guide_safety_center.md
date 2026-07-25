# FedOS Desktop Beta — Safety Center Guide

Open **Safety Center** from the navigation bar. It has three parts: an
overview list of independently-reported subsystem sections, an Identity
Replacement inbox, and a Signed Deletion requests inbox.

## Overview sections

Each section is reported **independently** — there is no single overall
security score. A partial or unavailable section does not mean the rest
of the application is unsafe, and a fully "supported" section is **not**
an independent external audit result; it is this build's own honest,
live self-report. See `SECURITY.md` and `KNOWN_LIMITATIONS.md` for what
"supported" does and doesn't guarantee for each area.

## Identity Replacement inbox

A pending item here means a contact's account **signed a NEW identity
claiming continuity** with an existing conversation — for example, they
say they've moved to a new device/key and want you to keep trusting
"them" under the new identity.

- **Never auto-accepted.** Every item requires your own explicit review.
- Open an item to see its detail, then choose **Accept**, **Reject**, or
  **Defer**. Accept trusts the new identity going forward; Reject refuses
  it; Defer leaves it pending for a later decision — none of the three
  buttons act until you click one, and all three are disabled together
  while a decision is in flight so a rapid double-click can't submit
  twice.
- An item with no resolvable peer-Device evidence pair is shown as
  **non-openable** rather than silently hidden or auto-decided — a
  disclosed boundary, not a bug (see `KNOWN_LIMITATIONS.md`).
- This is a **Replacement**, not a Rotation, model: the old identity is
  never mutated in place. If you Accept, the new identity is trusted
  going forward; it does not retroactively change how past messages from
  the old identity are shown.

## Signed Deletion requests inbox

A pending item here means someone sent a **signed request** asking you
to delete something locally.

- Open an item, then choose **Approve** or **Reject**. Both are disabled
  together while a decision is in flight, same double-submit protection
  as Identity Replacement.
- **Approving never guarantees removal from a Relay, another Device, or
  a foreign Archive copy** — it only affects your own local copy, and
  only after your own explicit review. This policy always requires a
  human decision; nothing is auto-approved.
- There is no return-acknowledgement protocol — once you approve, the
  requester has no way to confirm from your side that it actually
  happened, beyond whatever they can infer.

## What Safety Center is not

It is not a single "is this app secure" dashboard, not a vulnerability
scanner, and not a substitute for the independent external audit this
Beta has not yet had (see `SECURITY.md`). Treat every "supported" label
here as "this build's own code believes this works," not as third-party
verification.
