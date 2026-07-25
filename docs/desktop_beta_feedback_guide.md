# FedOS Desktop Beta — Feedback Guide

Thank you for testing FedOS Desktop Beta. This guide covers how to give
useful feedback, report a bug, and — separately — how to report a
possible security issue.

## Before reporting

1. Check `docs/fedos_desktop_beta_known_issues.md` — it may already be a
   known, disclosed rough edge rather than a new bug.
2. Check `KNOWN_LIMITATIONS.md` — some things that look like bugs are
   deliberate, disclosed design boundaries (for example: Group Messaging
   isn't exposed at all in this pilot, on purpose).
3. If it's genuinely new, keep reading.

## Ordinary bug / usability feedback

<!-- Contact channel intentionally left as a placeholder: this document
does not invent a feedback form, ticket tracker, or email address that
does not yet exist for this pilot. A pilot coordinator should fill this
in before distributing this guide to real participants. -->

Report through whatever channel the pilot's own operators currently
designate for this purpose. Include:

- What you were trying to do, in your own words.
- What actually happened, versus what you expected.
- The exact screen/button/action involved, if you can identify it.
- Whether it's reproducible (does it happen every time, or only once?).
- Your OS version and this Beta's version number (shown on the Ready
  screen's own disclosure panel).

**Do not include**: your passphrase, any Master Seed/recovery material,
raw message plaintext you don't want shared, or any other Device's or
contact's private information without their consent. If a screenshot
would reveal any of that, crop or redact it first.

## Diagnostic codes

If you land on the Recovery screen, it shows a short, **non-secret**
diagnostic code (never your passphrase or any key material). Use the
**Copy diagnostic code** button and include that code verbatim in your
report — it's the fastest way for anyone investigating to know what
actually happened.

## Reporting a possible security issue

**Do not report a security issue through the ordinary bug-feedback
channel above, and do not open a public issue for an unpatched
vulnerability.** See `SECURITY.md`'s own "Reporting a vulnerability"
section for the correct, private channel — which, like the feedback
channel above, is currently a placeholder a pilot coordinator must fill
in with a real contact before this Beta is distributed to real
participants.

## What happens after you report

This is a Closed Beta pilot with no committed response-time guarantee.
See the pilot's own operational documentation (where available) for any
specific commitments made to your particular pilot cohort — this guide
does not itself promise a specific response time, since none currently
exists to promise.

## Uninstalling / stopping participation

You can stop using this Beta and uninstall it at any time, for any
reason, with no obligation to provide feedback first. See the
Installation Guide's own uninstall notes for what is and isn't removed
by uninstalling (your profile directory is preserved by default unless
you delete it yourself — see the Backup Guide).
