# Reddit OSS Launch Drafts (NOT POSTED — drafts only)

**Status: DRAFT.** Nothing in this document has been posted anywhere.
These are prepared text for a human to review, edit, and post manually.
No automation posts to Reddit from this repository or this arc.

Repository: <https://github.com/satorunacamoto/fedos>

Each draft below targets a different audience and leads with a different
angle, deliberately — do not post identical copy across communities (see
the checklist at the bottom before posting any of them).

---

## A. r/opensource-style draft

**Suggested title:** FedOS — I open-sourced my Nostr-based messaging/trust toolkit (MPL-2.0)

Hi r/opensource,

I've been building FedOS for a while and just opened the source under
MPL-2.0: <https://github.com/satorunacamoto/fedos>

**What it is:** a local-first toolkit organized into four capabilities
(`src/os/core`, `messenger`, `commerce`, `trust`), at different stages of
readiness. The one actually-shipped application today is FedOS Desktop —
a direct (1:1) end-to-end encrypted messenger over Nostr (NIP-17). The
Trust capability (signed envelopes, pseudonymous credentials,
proof-of-possession, offline-verifiable entitlements, signed QR) is real
and test-covered but not yet wired into the desktop app — it's usable
today via its own CLI.

**Why I opened it:** I wanted the cryptography and the trust model to be
auditable by people who aren't me, and I'd rather get real code review
than keep building in private indefinitely. MPL-2.0 felt like the right
fit — file-level copyleft, no CLA, straightforward for anyone who wants
to fork a piece of it (e.g. the Trust capability standalone) without
being forced to open-source an entire downstream project.

**Where it actually stands:** Closed Pilot, not Public Beta. No
independent security audit has happened yet — that's the biggest gap I
know about and the main thing I'd want outside eyes on. Windows builds
are unsigned. The README and `KNOWN_LIMITATIONS.md` try to be specific
about what's implemented vs. what's just present-but-unwired, rather than
listing aspirational features as if they were done.

**What I'd love feedback on specifically:**
- Architecture/module-boundary review — is `core`/`messenger`/`commerce`/`trust`
  actually a sane seam, or does it just look like one?
- The Trust capability's envelope/verification design
  (`docs/architecture/TRUST-MODEL.md`) — I'd rather find a design flaw
  now than after more is built on top of it.
- Anything in the licensing setup that looks off for an MPL-2.0 project.

Happy to answer questions here. This is genuinely early and experimental
— I'm not claiming it's ready for anything sensitive yet, and I say that
in the repo itself.

---

## B. r/selfhosted-style draft

**Suggested title:** FedOS — local-first Nostr messenger + offline-verifiable trust toolkit, no server required (source now public)

Posting this here because "no mandatory server" is the part I think this
sub will actually care about most: <https://github.com/satorunacamoto/fedos>

**What actually runs locally, with nothing hosted by me:**
- The messenger (FedOS Desktop) talks to **Nostr relays you pick** — any
  public relay, or your own. There's no FedOS backend in that path at
  all.
- The Trust capability — signed credentials, proof-of-possession,
  subscription entitlements, signed QR codes — verifies **entirely
  offline**, no network call in the verification path, full stop. You
  can run your own issuer with a CLI (`npm run trust:issuer`) for
  yourself, your household, or a community, with zero involvement from
  me.
- There's an *optional* paid entitlement I can issue ("FedOS Official"),
  but it's issued by me running an offline signer after manually
  confirming payment — not an activation server, no phone-home, no
  recurring check. And it's entirely optional: everything free works
  fully without it, forever.

**What you can self-host / run today:** the Electron desktop app (build
from source or use the unsigned installer/portable ZIP), and the Trust
issuer CLI, both fully locally. Two other capabilities in the repo
(`commerce`, and Trust's own desktop-app wiring) are real code but not
yet reachable from the packaged app — I didn't want to claim more than
what's actually wired.

**Limitations, stated plainly, because I'd rather this sub catch them
than find out the hard way:**
- No independent security audit yet.
- Forward secrecy (Double Ratchet) exists and is tested but is **not**
  the default delivery route for ordinary messages right now.
- No onion routing / IP protection — a relay operator can see metadata
  (who's talking to whom, roughly when).
- Windows builds are unsigned (expect a SmartScreen warning).
- This is Closed Pilot software, not a finished product. Data loss
  during the pilot is possible; back up anything you care about.

Full honest limitations list is in the repo's `KNOWN_LIMITATIONS.md` —
I'd rather over-disclose than have someone find a gap I didn't mention.

Genuinely interested in feedback from people who actually self-host
things for a living, especially on the relay-trust model and whether the
"no mandatory server" claim holds up under scrutiny.

---

## C. Nostr / privacy-oriented community draft

**Suggested title:** FedOS — a NIP-17 messenger + offline-verifiable signed-credential/QR toolkit, source now open

Sharing this here since it's built on Nostr and I'd like feedback from
people who actually work with the protocol: <https://github.com/satorunacamoto/fedos>

**The messenger:** direct (1:1) conversations over **NIP-17**, NIP-44 v2
encryption inside a NIP-59 gift wrap. A real Double Ratchet
implementation exists on top of that for forward secrecy /
post-compromise recovery on Direct conversations — it's test-covered,
but it is **not** the default delivery route yet, so I'm not claiming
forward secrecy is active for ordinary messages today. I'd rather say
that clearly than let people assume it from "Double Ratchet exists."

**Pseudonymous identity + local verification:** the Trust capability
(`src/os/trust/`) is a separate, standalone piece — signed envelopes,
pseudonymous credentials, proof-of-possession, capability grants, and
offline-verifiable subscription entitlements, plus signed-QR encode/
decode. Every verification happens locally; nothing calls out to a
server to check validity. You pick which issuer key(s) you trust — I
run one optional issuer ("FedOS Official"), but it's not privileged in
the design over anyone else running their own with the same CLI.

**What this is not:** anonymity software. FedOS does not hide your IP
from relays and does not attempt traffic-analysis resistance — a relay
operator can see who's exchanging events with whom, and when. If you
need that property, this isn't it, and I say so directly in the repo
rather than let the Nostr association imply otherwise.

**Status:** Closed Pilot, unaudited, MPL-2.0. I'm not asking anyone to
trust this with anything they can't afford to lose yet — I'm asking for
protocol-level and crypto-design feedback from people who'll actually
read the code, particularly around the NIP-17 gift-wrap usage and the
Trust envelope/verification model
(`docs/architecture/TRUST-MODEL.md`).

Open to hard questions.

---

## Before posting: rule checklist

Read and complete this checklist **separately for each subreddit, on the
day you actually post** — do not treat a pass on one subreddit as
covering another, and do not batch-post all three back to back.

- [ ] Re-read that specific subreddit's rules **on posting day** — rules
      and self-promotion policy can change between when this draft was
      written and when it's used.
- [ ] Confirm self-promotion / "I built this" posts are actually allowed
      there (some subs require a minimum account age, prior
      participation, or a specific day/thread for self-promo).
- [ ] Use the correct post flair, if the subreddit has one.
- [ ] Do not cross-post identical text rapidly across communities —
      each draft above is already differentiated; keep it that way, and
      space postings out rather than firing all three at once.
- [ ] Disclose project affiliation up front — every draft above already
      says "I built this" or equivalent; keep that in whatever you post.
- [ ] Plan to actually respond to technical criticism, including
      unfavorable comparisons to audited software — don't post and
      disappear.
- [ ] Do not ask for upvotes, and do not phrase anything as a call to
      action for votes/traffic.
- [ ] Do not use alternate accounts, friends' accounts, or any other
      means to amplify votes or comment counts.
- [ ] Do not claim anonymity, "uncensorable," "untraceable," or
      "revolutionary" — none of that language appears in the drafts
      above; keep it that way if you edit them.
- [ ] Do not claim FedOS is safer than, or a replacement for, an audited
      messenger (e.g. Signal) — the drafts above deliberately avoid this;
      preserve that framing.
