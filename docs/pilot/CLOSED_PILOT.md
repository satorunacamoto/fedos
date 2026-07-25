# FedOS Closed Pilot

**Status: preparing. Not yet launched.** This document defines what the
pilot is. It becomes live when the repository owner publishes the
repository and invites participants.

## What this is

A small, deliberately limited trial of **FedOS Desktop** — an
end-to-end encrypted 1:1 messenger for Windows built on Nostr (NIP-17)
with a Double Ratchet session per conversation.

The goal is narrow: **find out what breaks when real people use it.**
Not adoption, not growth, not publicity.

## What this is not

- **Not a public beta.** Public Beta remains **NO-GO** and is blocked on
  external security review and decisions the maintainers cannot make
  alone.
- **Not audited.** No independent security audit has ever been
  performed.
- **Not a product you should depend on.** See
  [`STOP_USE_CRITERIA.md`](STOP_USE_CRITERIA.md).

## Size and shape

- **Roughly 5–20 participants.** Small enough that every report gets a
  real response.
- **Technically capable users.** You should be comfortable verifying a
  SHA-256 checksum, reading a stack trace, and writing a reproducible
  bug report. This build has rough edges that a non-technical user
  cannot reasonably be asked to absorb.
- **Windows x64 only.** No macOS or Linux build exists.
- **Open-ended duration.** The pilot ends when the maintainers say it
  ends, or when a stop-use criterion fires.

### Who this is a good fit for

- Nostr users who already understand relays, npubs, and NIP-17.
- Privacy-oriented developers.
- Rust and Electron developers who might read the source.
- People from privacy-focused communities who are used to evaluating
  early tools critically.

### Who this is a bad fit for

- Anyone who needs a messenger they can rely on.
- Anyone whose threat model includes a capable adversary. **This build
  has not been audited and should not be trusted against one.**
- Anyone who cannot tolerate data loss.
- Journalists, activists, or anyone else for whom a confidentiality
  failure would cause serious harm. **Please do not use this build for
  that work.** We would rather have fewer participants than expose
  someone to real risk.

## What you are agreeing to

By participating you accept:

- **This software is experimental and unaudited.**
- **The Windows artifacts are unsigned.** SmartScreen will likely warn.
- **You will not use it for irreplaceable secrets or high-risk work.**
- **You will back up anything you care about**, outside FedOS.
- **You may lose data.** There is no passphrase recovery — if you lose
  your passphrase, your data is unrecoverable by anyone, including the
  maintainers.
- **You will report security issues privately**, not in a public Issue.

You are not agreeing to any NDA, any exclusivity, or any obligation to
keep using it. **You can leave at any time, for any reason, without
explaining yourself.**

## What we ask of you

1. **Install it** — [`INSTALLATION.md`](INSTALLATION.md).
2. **Read the risks** — [`KNOWN_RISKS.md`](KNOWN_RISKS.md).
3. **Work through the scenarios** — [`TEST_SCENARIOS.md`](TEST_SCENARIOS.md).
4. **Report what you find** — [`FEEDBACK.md`](FEEDBACK.md).
5. **Know when to stop** — [`STOP_USE_CRITERIA.md`](STOP_USE_CRITERIA.md).

Report results with [`RESULTS_TEMPLATE.md`](RESULTS_TEMPLATE.md).

**Negative results are the point.** "I could not get past step 3" is
more valuable than "seems fine." So is "the wording here made me think
it was more secure than it is" — misleading claims are treated as
defects.

## What you get

- Direct access to the maintainers.
- Honest answers, including "we don't know" and "that's broken."
- Credit in release notes, **only if you want it**. Say so; the default
  is no attribution.

## What we will not do

- Track you. **No telemetry, no analytics, no crash reporting, no
  auto-update.** The app talks to the relays you configure and nothing
  else.
- Share your reports publicly without asking.
- Ask you for your passphrase, Master Seed, or any private key. **Anyone
  who does is attacking you**, regardless of who they claim to be.

## Reporting: which channel

| What | Where |
| --- | --- |
| **Security vulnerability** | **GitHub Private Vulnerability Reporting** — never a public Issue. See [`SECURITY.md`](../../SECURITY.md). |
| Ordinary bug | Public GitHub Issue, bug report template |
| Question, setup help, design discussion | GitHub Discussions |
| Structured pilot results | [`RESULTS_TEMPLATE.md`](RESULTS_TEMPLATE.md) |

**If you are unsure whether something is sensitive, treat it as
sensitive.** Nobody will criticise you for over-reporting privately.

---

## Publication checklist (repository owner)

Before inviting anyone:

- [ ] **HUMAN ACTION REQUIRED: enable "Private vulnerability reporting"
      in GitHub repository Settings → Security.** It is **off by
      default**. Until it is on, the reporting link in `SECURITY.md`,
      `README.md`, and the issue templates returns a 404, and **the
      security channel this pilot depends on does not exist.** Do not
      announce the pilot before this is done.
- [ ] Verify the link works: open
      `https://github.com/<owner>/<repo>/security/advisories/new` while
      signed out, or from another account.
- [ ] Replace the `OWNER/REPO` placeholders in
      `.github/ISSUE_TEMPLATE/config.yml` with the real path.
- [ ] Enable Discussions, if you want the support channel.
- [ ] Enable private security advisories' draft workflow, and confirm
      you receive notifications.
- [ ] Build the release artifacts and publish their SHA-256 checksums
      somewhere participants can reach independently of the download.
- [ ] Decide whether to keep the git author email in the public history
      (see the publication reconciliation report).
- [ ] Choose participants and send the invitation.
