# 06 — Windows SmartScreen and Reputation

## Honest statements (this review makes no stronger claim than these)

- **Signing does not automatically guarantee no SmartScreen warning.**
  SmartScreen's "unrecognized app" warning is driven by reputation —
  Microsoft's own aggregate telemetry about how many users have run a
  given binary/certificate combination — not solely by the presence of a
  valid signature.
- **Unsigned applications may show a warning on every first run, for
  every user, indefinitely** — reputation cannot accrue for something
  that is never chained to a stable identity.
- **Reputation is external and platform-controlled.** Neither this
  project nor this review can inspect, predict, or set a specific
  binary's current SmartScreen reputation score; Microsoft does not
  publish this as a queryable value.
- **A standard or EV certificate may change reputation behavior over
  time, but is not itself a security proof.** A signed-and-warned binary
  and a signed-and-not-warned binary can both be equally safe or equally
  malicious; the warning tracks reputation, not correctness.
- **Beta users must receive an honest warning before installing.** The
  release notes and any installation instructions must state plainly
  that Windows may show a "Windows protected your PC" / SmartScreen
  prompt, that this is expected for an unsigned Beta, and must never
  instruct a user to disable SmartScreen, Defender, or any OS protection
  to proceed.

## Acceptable public-Beta warning/installation procedure

1. Release notes state, verbatim in substance: "FedOS Desktop Beta is
   currently unsigned. Windows SmartScreen will likely show a warning
   the first time you run the installer or the application. This is
   expected for unsigned software and does not indicate a specific
   problem with this release — verify the SHA-256 checksum (`07`) before
   proceeding if you want additional assurance."
2. If a user chooses to proceed past the warning, the accepted path is
   Windows's own "More info" → "Run anyway" flow — the review does not
   invent or recommend any alternative bypass.
3. The release notes must link to (or embed) the published checksum
   (`07`) so a user can verify the exact bytes they downloaded before
   choosing to proceed.
4. The release notes must NOT claim the application is "verified",
   "trusted", or "safe" in a way that overstates what an unsigned binary
   can honestly claim — only that it matches the published checksum from
   the stated canonical source (`16`).

## What this review does not, and will not, claim

- This review does not claim SmartScreen can be disabled or bypassed
  safely — it can be, by the user, via Windows's own settings, but this
  review never instructs that as a distribution-side workaround.
- This review does not claim any specific certificate tier (standard or
  EV) will eliminate warnings — only that unsigned software is
  categorically more likely to warn, and that reputation, once accrued,
  is not something this project controls or can predict a timeline for.
