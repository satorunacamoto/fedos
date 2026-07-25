# Giving Feedback — FedOS Closed Pilot

## Pick the right channel

| What you found | Where it goes |
| --- | --- |
| **Anything with security impact** | **GitHub Private Vulnerability Reporting.** Never a public Issue. |
| A reproducible bug, no security impact | Public GitHub Issue → bug report template |
| A question, or "is this supposed to work like this?" | GitHub Discussions |
| An idea or feature request | Public GitHub Issue → feature request template |
| Structured results from the test scenarios | [`RESULTS_TEMPLATE.md`](RESULTS_TEMPLATE.md), posted in Discussions |

### What counts as "security impact"

Report **privately** if what you found could let someone:

- read messages they should not be able to read;
- recover a key, Master Seed, or passphrase;
- impersonate another user, or forge a device pairing, identity
  replacement, or deletion;
- bypass the lock screen or reach data while locked;
- make the app leak secrets into a log, an error message, or the UI;
- defeat any protection [`../../SECURITY.md`](../../SECURITY.md) claims
  is real.

**If you are unsure, report it privately.** Over-reporting costs a
maintainer a few minutes. Under-reporting publishes a live weakness to
everyone at once, permanently. The asymmetry is not close.

## Never include, in any channel

Not in a public Issue, not in Discussions, **and not in a private
report** — a private advisory is still stored on someone else's servers
and may later be published:

- Your **passphrase**, **Master Seed**, recovery code, `nsec`, or any
  private key.
- Your **profile directory**, database files, or an **Archive export**.
- **Real message content**, yours or anyone else's.
- Anyone else's **personal information**.
- **Relay credentials**, auth tokens, or API keys.

**Redact screenshots and logs** before posting: npubs, contact names,
message text.

> No maintainer will ever ask you for your passphrase, Master Seed, or
> private key. **Anyone who does is attacking you**, whoever they claim
> to be. Report that as a security incident.

## What makes a report useful

The single most valuable thing is **something we can reproduce**.

**A good report has:**

1. **What you did** — numbered steps from a state you can describe.
2. **What happened** — the actual behaviour.
3. **What you expected** instead.
4. **How often** — every time, sometimes, saw it once.
5. **Your setup** — Windows version, FedOS version or commit, installer
   or ZIP or source build.
6. **Evidence** — redacted logs or screenshots.

**"It doesn't work"** is not actionable. **"After S6 step 4, my
partner's message never arrived; restarting made it appear; happened 3
of 5 times"** is immediately actionable.

### Things people wrongly assume are not worth reporting

Please report these. They are among the most valuable findings:

- **"The wording made me think it was more secure than it is."** That is
  a defect. Misleading claims are treated as security issues here.
- **"I got confused and could not finish."** Confusion is a real
  failure — you are the target audience.
- **"It worked, but the way it worked bothered me."**
- **"I think I lost data, but I am not certain."** Tell us anyway.
- **"This is probably my fault."** Report it. Often it is not, and even
  when it is, something made the mistake easy to make.

## What to expect back

- **No guaranteed response time.** This is a very small team without
  on-call coverage. Reports are read; silence is not dismissal.
- **Honest answers**, including "we don't know," "that's broken," and
  "we are not going to fix that, here's why."
- **Credit only if you want it.** The default is no attribution — tell
  us if you want to be named.
- **Your reports are not made public without asking you.**

## Leaving the pilot

Stop whenever you want, for any reason, without explaining. If you
choose to say why, that is itself useful feedback — especially if you
left because something felt untrustworthy.

To remove your data: uninstall, then delete the FedOS profile directory
under `%APPDATA%`. That is irreversible; export an Archive first if you
want to keep anything.
