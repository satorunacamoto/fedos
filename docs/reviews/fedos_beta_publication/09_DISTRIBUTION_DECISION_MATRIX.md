# Distribution Decision Matrix — FedOS Desktop Beta 0.1.0-beta.1

Nothing on this page is invented infrastructure. Every option below is either infrastructure that
already exists (confirmed via a read-only GitHub API check) or infrastructure the project has
already designed for itself in `docs/pilot/` — no new channel is proposed.

## Repository reality check (Section 5) — independently confirmed this pass

```
Repository:                    satorunacamoto/fedos
Visibility:                    PUBLIC (confirmed: GET /repos/satorunacamoto/fedos -> "private": false)
Default branch:                main
Issues enabled:                true
Discussions enabled:           false (confirmed: /discussions -> HTTP 404; API "has_discussions": false)
Existing Releases:              0 (GET /repos/.../releases -> empty array)
Existing tags:                  0 (GET /repos/.../tags -> empty array)
Private Vulnerability Reporting: reports ENABLED per GET /repos/.../private-vulnerability-reporting
                                 -> {"enabled": true} (unauthenticated read). This is a positive
                                 change since the last publication pass, where SECURITY.md itself
                                 disclosed it as not yet enabled. NOTE: the unauthenticated fetch of
                                 the actual "Report a vulnerability" form redirected to a GitHub
                                 sign-in wall (expected — that page always requires auth), so this
                                 could not be visually confirmed end-to-end without a human signed
                                 in. Treat as ENABLED (per API), HUMAN CONFIRMATION RECOMMENDED
                                 before relying on it for a real report.
Local repo remote configured:  yes (origin = https://github.com/satorunacamoto/fedos.git)
Credentials/push access:       UNKNOWN — not tested (would require a real push/auth check, out of
                                scope for a read-only dry run; no attempt was made)
```

## Existing first-party infrastructure found (not invented)

`docs/pilot/` already contains a complete, ready-to-use **Closed Pilot** apparatus:
`CLOSED_PILOT.md`, `INSTALLATION.md`, `KNOWN_RISKS.md`, `FEEDBACK.md`, `RESULTS_TEMPLATE.md`,
`STOP_USE_CRITERIA.md`, `TEST_SCENARIOS.md`, `RECRUITMENT_DRAFT.md`. `CLOSED_PILOT.md` itself
contains a pre-written **"Before inviting anyone" checklist** (enable Private Vulnerability
Reporting, verify the advisory link, replace `OWNER/REPO` placeholders, enable Discussions if
wanted, publish checksums independently of the download, choose participants, send invitations).
This is real, already-designed limited-cohort distribution readiness — not something this review
invented.

No project website, GitHub Pages, or other static-hosting infrastructure exists (`git branch -a`
has no `gh-pages`; no `CNAME`; no `homepage` field in `package.json`).

## Decision table

| Option | Setup effort | User trust | Discoverability | Version history | Checksum presentation | Release-note presentation | Rollback/old versions | Operator complexity | Privacy | Cohort restriction | Security-reporting integration | Automation potential | Cost | Exists today? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A. GitHub Releases** | ACCEPTABLE — repo exists, public, 0 releases/tags to conflict with | ACCEPTABLE — public repo with real commit history, not a fresh throwaway | STRONG once public; WEAK/none while kept as an unlisted draft | STRONG — built-in, every release keeps its assets and notes | STRONG — `SHA256SUMS.txt` + manifest can ship as release assets | STRONG — native Markdown release body | STRONG — old releases stay listed and downloadable | STRONG — no new infra, `gh`/web UI only | ACCEPTABLE — public repo already exposes commit history/author email (pre-existing, not new) | STRONG — a draft release has a private, unlisted link shareable only with invited testers | STRONG — same repo's Issues/Advisories, already wired | STRONG — natural fit for future CI-driven releases | UNKNOWN/likely free (public repo, no indication of a paid plan requirement) | **YES** |
| **B. Project website / first-party static download** | UNAVAILABLE — no hosting, no domain, no Pages branch, no CNAME configured | UNKNOWN — would depend entirely on execution | UNKNOWN | WEAK unless purpose-built | UNKNOWN | UNKNOWN | WEAK unless purpose-built | WEAK — new infrastructure to stand up and maintain | UNKNOWN | ACCEPTABLE — could be made invite-gated | WEAK — would need its own wiring to Issues/Advisories | UNKNOWN | UNKNOWN — likely nonzero (hosting, domain) | **NO — does not exist** |
| **C. Private/limited Beta distribution (the project's own Closed Pilot process)** | ACCEPTABLE — `docs/pilot/` already fully written; only the pre-invite checklist items remain | STRONG — a known, invited cohort, individually onboarded with `KNOWN_RISKS.md`/`STOP_USE_CRITERIA.md` read first | WEAK by design — intentionally not publicly discoverable | Depends on the underlying artifact host (works well paired with Option A as an unlisted/draft release) | STRONG — `INSTALLATION.md` already documents a checksum-first flow | STRONG — `CLOSED_PILOT.md`/`RECRUITMENT_DRAFT.md` already written | Depends on underlying host | ACCEPTABLE — recruitment/invitation is manual work, but the docs are done | STRONG — smallest, most controllable exposure | STRONG — this is the entire point of the mechanism | STRONG — same checklist item as A | WEAK — manual invitation does not scale | Effectively free (uses whichever host from A) | **YES — fully designed, not yet executed** |
| **D. Other existing first-party mechanism** | — | — | — | — | — | — | — | — | — | — | — | — | — | **NONE found beyond A/C** — no package registry, no auto-updater channel, no existing CDN/bucket reference anywhere in the repo |

## Reading the table

Option A (GitHub Releases) and Option C (the project's own Closed Pilot process) are not actually
competing alternatives — **Option C is a cohort/visibility policy that is naturally implemented on
top of Option A's hosting mechanism** (a GitHub Release kept in draft, whose link is shared only
with invited participants, is exactly the Closed Pilot's own described flow). Option B does not
exist and would require standing up new infrastructure the mandate says not to invent. Option D
turned up nothing beyond A/C.

See `10_GITHUB_RELEASE_DRY_RUN.md` for the concrete dry run and `13_FINAL_HUMAN_ACTION_QUEUE.md`
for the resulting human decisions.
