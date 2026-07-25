# Closed Pilot Recruitment — DRAFT, NOT POSTED

**Nothing here has been published.** These are drafts for the repository
owner to review, edit, and post personally.

Before posting anything:

- [ ] The repository is public.
- [ ] **Private Vulnerability Reporting is enabled** (Settings →
      Security). Do not announce before this — the drafts point people
      at a channel that 404s until it is on.
- [ ] Placeholder URLs below are replaced with real ones.
- [ ] **Check each community's self-promotion rules.** Several
      privacy-focused subreddits restrict or ban project promotion, and
      some require prior moderator contact. Read the rules and honour
      them; a rule-breaking post damages the project more than the
      recruits are worth.

**Post in one or two places first, not everywhere at once.** The pilot
wants 5–20 people. Broad simultaneous posting is how you get 200
low-quality signups and a spam reputation.

---

## A. Nostr (first FedOS post / Primal)

> I'm opening a small Closed Pilot for **FedOS Desktop** — an
> end-to-end encrypted 1:1 messenger for Windows, built on Nostr NIP-17
> with a Double Ratchet session per conversation.
>
> Being direct about what this is:
>
> - **Experimental.** Closed Pilot, not a public beta.
> - **No independent security audit.** The crypto has been reviewed only
>   by its author.
> - **The Windows build is unsigned.** SmartScreen will warn you.
> - **Don't use it for anything that matters.** No irreplaceable
>   secrets, no high-risk work.
> - No anonymity, no onion routing, no group chat, no Signal
>   interoperability.
>
> What it does: 1:1 encrypted DMs, search, archive, multi-device,
> identity replacement, signed deletion. Source and build instructions
> are public — you can build it yourself instead of trusting my binary.
>
> Looking for ~5–20 technically capable testers who are comfortable
> verifying a checksum and writing a reproducible bug report. I
> especially want to hear what breaks and anything that oversells its
> own security.
>
> Source, docs, and how to join: <REPO_URL>
>
> #nostr #privacy #encryption

## B. GitHub Discussions (announcement post)

> ### FedOS Desktop — Closed Pilot, now accepting participants
>
> FedOS Desktop is an end-to-end encrypted 1:1 messenger for Windows,
> built on Nostr (NIP-17) with a Double Ratchet session per
> conversation. I'm opening a small pilot and would rather have 10
> careful testers than 200 casual ones.
>
> **Read these before deciding:**
> [What the pilot is](docs/pilot/CLOSED_PILOT.md) ·
> [Known risks](docs/pilot/KNOWN_RISKS.md) ·
> [Installation](docs/pilot/INSTALLATION.md)
>
> **The honest summary:**
>
> | | |
> | --- | --- |
> | Independent security audit | **None, ever** |
> | Code signing | **None** — artifacts are unsigned |
> | Anonymity / onion routing | **None** |
> | Group messaging | **Not exposed** |
> | Signal interoperability | **None** |
> | Passphrase recovery | **None** — lose it and your data is gone |
> | Public Beta readiness | **Not reached** |
>
> **What works today:** 1:1 encrypted conversations, invitations,
> search, archive export/restore, device pairing and revocation,
> identity replacement, signed deletion, relay configuration, Safety
> Center.
>
> **What I need:** Windows x64 users who can verify a SHA-256 checksum,
> follow [the test scenarios](docs/pilot/TEST_SCENARIOS.md), and write
> a bug report someone else can reproduce. Negative results are the
> point. So is "the wording made me think this was more secure than it
> is" — I treat that as a defect.
>
> **No telemetry, no analytics, no auto-update.** The app talks to the
> relays you configure and nowhere else.
>
> Security issues go through **private vulnerability reporting**, never
> a public Issue — see [SECURITY.md](SECURITY.md).
>
> Comment here or open a Discussion if you'd like in. You can leave at
> any time without explaining.

## C. Reddit (subject to each community's rules)

> **[Closed Pilot] FedOS — E2E encrypted 1:1 messenger on Nostr, looking for ~10 testers**
>
> I've built an end-to-end encrypted direct messenger for Windows on
> Nostr (NIP-17), with a Double Ratchet session per conversation, and
> I'm opening a small closed pilot.
>
> **Upfront, because you'd find out anyway:**
>
> - Experimental. Closed pilot, **not** a public beta.
> - **No independent security audit.** Reviewed only by me.
> - **Unsigned Windows binary** — SmartScreen will warn, legitimately.
> - **Do not use it for irreplaceable secrets or high-risk work.**
> - No anonymity, no onion routing, no group chat, no Signal interop.
> - No passphrase recovery. Lose it, lose everything.
>
> **What it actually does:** 1:1 encrypted messaging, invitations,
> local search, archive export/restore, multi-device with revocation,
> identity replacement, signed deletion.
>
> **Why I'm posting:** I want ~5–20 people who'll actually try to break
> it and tell me what happened. Especially interested in anything that
> claims more security than it delivers.
>
> Full source and build instructions are public — build it yourself
> rather than trusting my binary if you prefer. No telemetry, no
> analytics, no auto-update.
>
> Repo, docs, and known risks: <REPO_URL>
>
> Happy to answer technical questions in the comments.

**Candidate communities** — check rules first, and do not post to all of
them:

- Nostr-focused communities
- Privacy and encryption communities *(most restrict self-promotion —
  check, and contact moderators where required)*
- Rust and Electron developer communities *(frame it as a codebase to
  look at, not a product to adopt)*

---

## Rules for this copy

Every version must state: **Closed Pilot**, **experimental**,
**unsigned Windows build**, **no independent audit**, **not for
high-risk or irreplaceable secrets**, that **feedback and reproducible
bug reports are wanted**, and that **source and build instructions are
available**.

Never claim, in any version: an audit, code signing, anonymity, onion
routing, Signal interoperability, group messaging, remote deletion,
guaranteed RAM erasure, or public-beta readiness.

**Do not** add urgency, scarcity, growth framing, or comparisons
implying FedOS is safer than an audited messenger. If a sentence would
embarrass you in a post-incident write-up, cut it.
