# 16 — Distribution Host and Mirror Policy

## Current evidence

`git remote -v` in this repository returns **nothing — no remote is
configured** (proven current source, this worktree). `package.json` has
no `repository` field. **This project currently has no evidenced
GitHub (or any other) hosted remote of any kind.** Any recommendation
naming a specific external service as "the" canonical host would be
unevidenced. The project's own README (first paragraph, unmodified,
read-only citation) states the target architecture is a "Nostr + own-DB
hybrid... targeting Cloudflare Workers + D1 + KV + R2" — this is the ONE
piece of actual, stated infrastructure intent this project has committed
to in its own accepted documentation, for the product overall (not
specifically for Beta binary distribution, but the closest evidenced
signal available).

## Comparison

| Option | Trust model | Evidenced today? | Cost/complexity | Fit |
|---|---|---|---|---|
| GitHub Releases | third-party (Microsoft/GitHub), widely trusted for OSS | **no** — no remote configured | low, once a repo exists there | strong default IF/WHEN a GitHub remote is adopted; not assumable now |
| Self-hosted HTTPS (e.g. Cloudflare Pages/R2, matching the README's own stated architecture) | first-party, full control | **partially** — R2/Workers is the project's OWN stated target architecture, but no evidence of an actual bucket/page configured for BINARY distribution specifically | medium (requires standing up hosting) | consistent with the project's own already-declared direction |
| Cloudflare R2 specifically | first-party, same as above | same partial evidence as above (README names it for the product's own data layer, not proven wired up for release binaries) | low once the project's own R2 usage exists for the main product anyway | a natural artifact-storage choice given the project's own architecture, once implemented |
| University-hosted page | first-party via an institutional affiliation | **no evidence** of such affiliation/hosting anywhere in this repository | unknown | not recommended without evidence |
| IPFS | decentralized, content-addressed | not evidenced/configured | real operational complexity (pinning, gateway reliability) for a small Beta audience | not recommended for V1 — real friction for ordinary Windows users unfamiliar with IPFS gateways |
| Nostr event announcements | decentralized, censorship-resistant ANNOUNCEMENT, not binary hosting | this project's own domain (it IS a Nostr-related product) — a natural fit for ANNOUNCING a release | low | **recommended as a secondary announcement channel only** — never as the actual binary host (Nostr events are not designed to carry large binary payloads reliably) |
| Multiple mirrors | resilience against one host's outage | not evidenced | adds a verification burden (`07`'s own "mirror verification" requirement) | worth adopting once a canonical host is stable; premature before one exists |

## Decision

**Primary/canonical source of truth for Beta 0.1: a self-hosted HTTPS
distribution page, consistent with this project's own already-stated
Cloudflare-based architecture (README).** This is a recommendation for
where the project SHOULD eventually publish, not a claim that such
hosting exists today — the next implementation Arc (`19`) must either
stand this up or make an explicit, evidence-based case for GitHub
Releases once a GitHub remote is actually adopted (in which case GitHub
Releases becomes an ACCEPTABLE alternative primary, re-evaluated at that
time, not decided here in advance).

- **Mirrors**: none for V1 (a single canonical host is simpler to reason
  about for a first Beta with a small audience; revisit once real
  download-volume/uptime data exists).
- **Release announcement channels**: the project's own future Nostr
  presence (consistent with its own domain) MAY announce "a new Beta is
  available, get it at `<canonical URL>`" — the announcement event
  itself never embeds the binary or claims to BE the distribution
  channel.
- **Checksum/signature location**: alongside the artifacts themselves at
  the canonical host (`07`) — never only inside an announcement message,
  which could itself be spoofed/replayed on a public relay network.
- **Anti-confusion policy**: exactly ONE URL is ever published as "the"
  download link in official release notes; any secondary/mirror link
  introduced later must be explicitly labeled as a mirror, never
  presented as equally canonical.
- **Compromised-mirror handling**: a mirror whose artifacts fail
  checksum verification against the canonical `SHA256SUMS` (`07`) must
  be immediately delisted from official release notes/announcements;
  this review does not (and cannot) implement automated mirror-integrity
  monitoring.
- **Takedown/revocation procedure**: if a release is found to be
  compromised or defective after publication, the canonical host's own
  release notes must be updated to state the release is WITHDRAWN,
  naming the reason, and pointing to either a fixed release or "no safe
  release currently available" — never silently deleted without
  explanation, since users who already downloaded it need to know why.

## Explicit non-confusion statement

Nostr's own decentralized, censorship-resistant announcement properties
are a genuine strength of this PROJECT's domain — but they are a
property of ANNOUNCEMENT (a small, human-readable message: "v0.1.0-beta.2
is out, get it at X, checksum Y"), never of TRUSTED BINARY DISTRIBUTION
itself. This review does not recommend, and would flag as a security
regression, any design that treats a Nostr event's own content as the
binary artifact or as a substitute for the checksum verification (`07`)
a user must perform against the actual downloaded bytes.
