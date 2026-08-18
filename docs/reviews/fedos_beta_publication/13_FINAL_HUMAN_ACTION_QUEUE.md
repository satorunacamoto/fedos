# Final Human Action Queue — FedOS Desktop Beta 0.1.0-beta.1

Only actions that genuinely require a human decision or a human's hands. Nothing this review
completed automatically is repeated here. Ordered by what logically needs to happen first.

1. **Decide whether the git author email already exposed in the (confirmed-public)
   `satorunacamoto/fedos` repository's commit history is acceptable to keep, or should be
   addressed.** This is not a new finding — `docs/pilot/CLOSED_PILOT.md`'s own pre-existing
   "before inviting anyone" checklist already names this exact item. It's flagged with priority
   here because this review independently confirmed the repository **is already public today**, so
   this is a live, present-tense exposure, not a future one.

2. **Confirm the distribution decision**: approve (or override) the recommendation in
   `09_DISTRIBUTION_DECISION_MATRIX.md` — GitHub Releases as the hosting mechanism, kept as an
   unlisted **draft** release shared only with invited participants (Closed Pilot cohort), rather
   than a public announcement, for this first release.

3. **Confirm the cohort decision**: `LIMITED_BETA` via the project's own existing Closed Pilot
   process (`docs/pilot/`), not `PUBLIC_BETA`, for this first release — see reasoning in
   `09_DISTRIBUTION_DECISION_MATRIX.md` and Section 7 of this mandate's own reasoning below.

4. **Authorize pushing this arc's commits to `origin`** (a clean fast-forward of `origin/main` —
   244 commits ahead, 0 behind, independently verified this pass) or to a dedicated release branch.
   **A GitHub Release cannot be created until this happens** — the sealed EvidenceHead `c4dfb6e7`
   does not yet exist on the remote. This review did not push anything, per its own hard boundary.

5. **Sign in to GitHub and directly confirm Private Vulnerability Reporting is actually enabled.**
   This review's unauthenticated read of `GET /repos/satorunacamoto/fedos/private-vulnerability-reporting`
   returned `{"enabled": true}` — a positive change since the prior review found it explicitly
   disclosed as not-yet-enabled — but the actual "Report a vulnerability" page redirected to a
   sign-in wall for an unauthenticated fetch, so this could not be visually confirmed end-to-end.
   Recommend a human confirm directly in Settings → Security before relying on it, and update
   `SECURITY.md`'s own status callout once confirmed (a docs-only follow-up).

6. **Perform the interactive install/SmartScreen check** in `11_INTERACTIVE_INSTALL_CHECKLIST.md`
   — a real human, watching a real screen, on the exact sealed installer.

7. **Approve (or override) the Tor/Commerce public-positioning recommendation**: this review
   recommends `EXCLUDE_FROM_INITIAL_BETA_CLAIMS` for both (see Section 14 reasoning in
   `08_FINAL_PUBLICATION_SIGNOFF.md`'s companion analysis, restated here — Tor has no visible
   packaged-UI presence in any capability doc, so there is nothing coherent to claim yet; Commerce
   is real and packaged-reachable but TEST/LOCAL-payment-only, and carries disproportionate support
   burden for a first small cohort). Neither recommendation removes the underlying working code —
   only what's claimed publicly.

8. **Approve the exact release title, tag, body, and attachment list** in
   `10_GITHUB_RELEASE_DRY_RUN.md` / `12_PUBLICATION_ATTACHMENT_MANIFEST.md`, or request changes.

9. **Decide whether to fold `05_RECOVERY_AND_BACKUP_GUIDE.md` into the release pipeline's own
   generated staging bundle** so future builds ship it automatically (currently it exists only in
   this review's own docs folder) — a small future engineering task, not blocking this release if
   the guide is attached manually to the release itself in the meantime.

10. **Enable GitHub Discussions**, only if you want it as a support channel — currently disabled
    (confirmed via a 404 on `/discussions`); `.github/ISSUE_TEMPLATE/config.yml`'s "Ask a question"
    link will 404 until this is done. Optional — public Issues alone are sufficient to launch with.

11. **Give final, explicit authorization to actually push the tag, create the release (even as a
    draft), and share its link with Closed Pilot participants.** Nothing in this mandate or the
    prior one has done this. This is the literal "click Publish" moment the mandate reserves for a
    separately authorized next step.

Everything else discovered in this and prior publication passes (the stale "14-real-gate" wording,
the ~15-19 unreconciled capability-manifest entries, Signed Deletion/Identity Transition's narrower
validation scope) is disclosed, non-blocking, and does not require a decision before this queue —
see `04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md` and `08_FINAL_PUBLICATION_SIGNOFF.md`.
