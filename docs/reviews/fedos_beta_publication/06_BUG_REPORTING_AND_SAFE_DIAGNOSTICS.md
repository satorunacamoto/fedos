# Bug Reporting and Safe Diagnostics — FedOS Desktop Beta 0.1.0-beta.1

## Where to report

FedOS is developed at `https://github.com/satorunacamoto/fedos` (confirmed via the repository's own
git remote). This is the real, already-existing route — nothing below is invented.

| What happened | Where to report |
|---|---|
| A **non-sensitive bug** (crash, UI glitch, delivery issue, install failure, Recovery issue with no security implication, Tor/Commerce issue) | A **public GitHub Issue**, using the Bug report template (`.github/ISSUE_TEMPLATE/bug_report.yml`) |
| A **security or privacy concern** (could let someone read messages they shouldn't, recover a key or Master Seed, impersonate you, or bypass unlock) | **GitHub Private Vulnerability Reporting** — repository → Security → Advisories → "Report a vulnerability", or `https://github.com/satorunacamoto/fedos/security/advisories/new` directly. **Do not** open a public Issue for this. |
| A question, setup help, or general feedback | GitHub Discussions on the same repository |

**Status of the private channel, disclosed honestly:** `SECURITY.md` states that GitHub Private
Vulnerability Reporting has not yet been enabled in this repository's Settings as of this review —
until it is, that link 404s. If you need to report something sensitive before it's enabled, open a
public Issue asking only for a private channel, with **no detail about the vulnerability itself**,
and a maintainer will arrange one. Enabling this is a required action before public Beta
announcement — see `08_FINAL_PUBLICATION_SIGNOFF.md`.

## Minimal bug-report template

If you're not using the GitHub form, include at least:

```
FedOS version / build:      (e.g. 0.1.0-beta.1, or `git rev-parse --short HEAD` if built from source)
Windows version:            (e.g. Windows 11 Pro 24H2)
How did you install:        NSIS installer / portable ZIP / built from source

What happened:
(what you observed, in your own words)

What you expected instead:
(what should have happened)

Steps to reproduce:
1.
2.
3.

Does restarting the app reproduce it?  yes / no / didn't try
How often does it happen?              every time / about half the time / saw it once

Logs / screenshots (optional, see safety rules below):
```

## Diagnostics safety — what to attach, and what never to attach

### NEVER share, under any circumstances

- Your **Master Seed** (any file named like `master-seed.sealed.json`, or its raw contents)
- Your **unlock passphrase**, or a Recovery Bundle's own secret
- Any **private key** (an `nsec`, a raw private key file, a signing-key file)
- Your **Recovery Bundle** file itself
- Your **profile directory**, an Archive export, or any database/`.ndjson` file from it
- Personal **relay credentials, auth tokens, or API keys**

Sharing any of the above in a public bug report cannot be undone once submitted — a public GitHub
Issue is world-readable immediately and is mirrored/indexed by third parties within minutes.
Deleting it afterward does not undo the exposure.

### Review before sharing

- Logs, console output, or screenshots — **redact first**: remove npubs (public keys), contact
  display names, and any message text before pasting or attaching.
- Anything containing a device ID or account identifier, unless it's specifically what you're
  reporting a bug about.

### Generally safe to share

- The version/build string, your Windows version, and a plain description of what happened and how
  to reproduce it.
- A screenshot of a UI element with no message content, contact names, or identifiers visible.

If you are not sure whether something is safe to share, treat it as unsafe and ask first (in
Discussions, or in the bug report itself, without attaching the material) rather than attaching it
and asking afterward.
