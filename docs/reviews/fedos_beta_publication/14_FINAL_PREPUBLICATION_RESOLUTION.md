# Final Pre-Publication Resolution — FedOS Desktop Beta 0.1.0-beta.1

This pass resolves as much of the prior 11-item human-action queue as evidence allows, and converges
the rest to the smallest genuine human gate. Nothing was pushed, tagged, uploaded, or published.
No runtime/application source was touched.

## Authoritative heads (independently re-verified this pass)

```
RC SOURCE:            883e115b
RC EVIDENCE:          c4dfb6e7
PUBLICATION DOCS:     af940f69
DRY-RUN DOCS:         72c102e4  (= current HEAD at the start of this pass)
git status --short:   clean
Ancestry 883e115b -> c4dfb6e7 -> af940f69 -> 72c102e4:  confirmed via git log --oneline --decorate
```

## Artifact identity (recomputed a 4th time across this whole arc)

```
INSTALLER: a1c32889173a0ae9105724d8b708abaa9456f15a054085a20c29ccde3de6dee0  MATCH
ZIP:       9aa0f584fee09aa7341ec76624cdbaa1a85df05c10662526c2194391075df8a5  MATCH
```

## A. Git author email — RESOLVED, AUTO_RESOLVABLE_FROM_EVIDENCE

**Classification: `ALREADY_PUBLIC_NO_NEW_EXPOSURE`.** Independently confirmed twice (Coordinator +
one adversarial fork), without printing the address itself:

- The commit author's email is the **sole** author identity across all 769 commits currently on
  `origin/main` (`git log origin/main --format='%ae' | sort -u` = 1 unique value; that value appears
  769/769 times). It is a personal-looking address (not a GitHub `noreply`-style address), and the
  repository is confirmed public.
- It appears in all 245 of the currently-unpushed commits as well — the same identity, not a new one.
- **Pushing these 245 commits does not expose anything that is not already fully, identically
  exposed 769 times over in the repository's existing public history.** There is no privacy delta.

No history rewrite was performed or considered. This item is **closed** — it does not need to
appear in the mandatory human queue, per the mandate's own conditional ("privacy decision ONLY if
... would create new exposure").

## B. Push safety analysis — RESOLVED, AUTO_RESOLVABLE_FROM_EVIDENCE

Independently confirmed twice (Coordinator + one adversarial fork), read-only throughout:

```
PUSH_SHAPE:    FAST_FORWARD  (origin/main is a clean ancestor of HEAD; 245 ahead, 0 behind)
PUSH_PRIVACY:  PASS  (see A above)
PUSH_CONTENT:  PASS  (zero blobs >2MB in the new range — largest is ~778KB; zero gitignored
               release-output paths leaked into the diff; "secret"-named files found are genuine
               architecture/test source about sealed-secret handling, not leaked credentials —
               one file's own header explicitly states the real key material "must NEVER be
               committed to this repository"; no .env/.pem/.key/id_rsa/.p12/.pfx-pattern files)
APPROX PUSH SIZE: ~78.5 MB (measured via a scratch git bundle, deleted immediately after measuring)
```

No unexpected merge commits — this is a linear 245-commit range with no divergence to reconcile.

## C. Distribution and cohort — preserved from prior evidence, not re-litigated

```
ENGINEERING_RECOMMENDATION: GitHub Releases (kept as an unlisted DRAFT) + the project's existing
                             Closed Pilot apparatus (docs/pilot/)
COHORT_RECOMMENDATION:      LIMITED_BETA
```
No new evidence since `72c102e4` contradicts this. The one remaining human decision is a single
yes/no on the whole package (see Human Gates below) — not a re-run of the earlier abstract
distribution comparison.

## D. Tor / Commerce claim position — preserved, now made explicit in the release body

```
TOR:      EXCLUDE_FROM_INITIAL_BETA_CLAIMS
COMMERCE: EXCLUDE_FROM_INITIAL_BETA_CLAIMS
```
Rationale unchanged: both exist in the binary (nothing removed from code), but neither has a
finished, supported path through this specific packaged build's own screens for Tor, and Commerce's
real-but-TEST/LOCAL-only payment flow carries disproportionate support burden for a first small
cohort. **This pass added an explicit sentence to this effect directly in the release body** (see
`10_GITHUB_RELEASE_DRY_RUN.md`, "Not part of this release's claims") rather than leaving it as a
silent omission.

## E. Recovery guide pipeline issue — RESOLVED

```
CURRENT_BETA_BLOCKER:    NO
FUTURE_PIPELINE_WORK:    YES
```
`05_RECOVERY_AND_BACKUP_GUIDE.md` can be attached directly at the GitHub Release distribution
surface (it's a release asset, independent of what's baked into the installer bytes) without
touching the sealed RC at all. Folding it into the pipeline's own auto-generated staging bundle so
future builds ship it automatically is legitimate, disclosed follow-up work — not a reason to
rebuild or delay this release.

## F. Private Vulnerability Reporting — RESOLVED

```
PRIVATE_VULNERABILITY_REPORTING: PASS_API_VERIFIED
```
Re-confirmed a third time this arc via the same read-only public API check
(`GET /repos/satorunacamoto/fedos/private-vulnerability-reporting` -> `{"enabled": true}`),
consistent every time it's been checked. A human signing in to visually confirm the "Report a
vulnerability" button in the GitHub UI remains available as `OPTIONAL_HUMAN_CONFIRMATION` — not
publication-blocking, since the API signal has now been consistent across three independent checks.

## G. Discussions — RESOLVED

```
DISCUSSIONS: NON_BLOCKING_OPTIONAL
```
Confirmed still disabled (`has_discussions: false`). Checked every publication document for a
required user flow that depends on it: the release body and `03`/`06` guides all lead primarily
with GitHub Issues (confirmed enabled and working) for bug reports and GitHub Security Advisories
for vulnerabilities — Discussions is mentioned in `06_BUG_REPORTING_AND_SAFE_DIAGNOSTICS.md` only
as a secondary "general feedback" option, with no hyperlink (so nothing actually 404s for a reader
of that doc; a reader who tries to find a non-existent Discussions tab on the repo itself would
simply not find one). Not required for launch. Enabling it remains a human's later choice — this
review did not enable it, per the mandate's own instruction.

## H. Final release specification (updated this pass)

See `10_GITHUB_RELEASE_DRY_RUN.md` for the full text — updated this pass to add:
1. An explicit "limited Beta cohort, don't share this link" notice at the top of the release body.
2. An explicit "Tor and Commerce are not part of this release's claims" sentence.

Both installer/ZIP hashes in the release body independently re-verified to match the freshly
recomputed hashes above.

```
TAG:          desktop-beta-v0.1.0-beta.1
TITLE:        FedOS Desktop Beta 0.1.0-beta.1
TARGET:       c4dfb6e7 (requires push first — see B above)
DRAFT:        YES
PRERELEASE:   YES
ATTACHMENTS:  7 required / 4 optional / 6 DO_NOT_PUBLISH categories (unchanged from
              12_PUBLICATION_ATTACHMENT_MANIFEST.md, independently re-confirmed present on disk
              this pass)
```

## Minimized mandatory human queue

Reduced from the prior 11-item list to **3 mandatory items**, using the evidence above:

1. **Approve the distribution package as a whole**: GitHub Releases (draft) + the existing Closed
   Pilot process + `LIMITED_BETA` cohort + Tor/Commerce excluded from claims + the exact release
   title/tag/body/attachments in `10`/`12`. One yes/no decision covering the whole package, since
   every sub-part is either unchanged since the prior review or has no contradicting new evidence.
2. **Perform the interactive SmartScreen/install check** (`11_INTERACTIVE_INSTALL_CHECKLIST.md`) —
   genuinely requires a human watching a real screen; no automated tool in this session can do this
   without fabricating an observation.
3. **Explicitly authorize the push** of this branch's 245 commits to `origin` (a clean, privacy-safe,
   content-safe fast-forward, independently confirmed twice this pass) — the literal prerequisite
   before any tag, draft release, or artifact upload can technically exist.

### Optional (not blocking, human's choice on timing)

- Visually confirm Private Vulnerability Reporting in the GitHub UI (API already confirms enabled,
  3 consecutive checks).
- Enable GitHub Discussions, if wanted as a secondary support channel.

### Future non-blocking work (do not gate this release on these)

- Fold `05_RECOVERY_AND_BACKUP_GUIDE.md` into the release pipeline's own generated staging bundle.
- Fix the "14-real-gate" wording at its source (`fedos_desktop_beta_capability_manifest.ts:378`) —
  explicitly deferred to a future CandidateHead per every prior mandate in this arc; not touched
  here either.
- Reconcile the ~15-19 remaining stale capability-manifest entries.

## Explicit statement

**Nothing was pushed. No tag was created. No artifact was uploaded. No GitHub Release (draft or
otherwise) was created. No announcement was made.** This document only resolves and documents
decisions from existing evidence; it authorizes none of the above actions itself.
