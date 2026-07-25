# FedOS — OSS Readiness Report

Point-in-time publication-readiness check for making this repository
public on GitHub. Written 2026-07-26.

**Checked against:** `master` at `4bd79d11`, and
`release-prep/fedos-oss-closed-pilot` at `637721cf`.
**Fixes landed on:** `oss-readiness/publication-fixes` (from `637721cf`).

---

## The one thing that decides everything

**`master` is not publishable, and the fix already exists on another
branch.**

`master` today has **no `LICENSE` file** — under default copyright that
is all-rights-reserved, so nobody may legally fork, use, or contribute.
It also has **no `.github/` directory at all** (no issue templates, so a
vulnerability report would default to a world-readable public Issue) and
a **11,886-line README** that is an append-only development changelog.

Every one of those is already fixed on
`release-prep/fedos-oss-closed-pilot`, which is 5 commits ahead of
`master` and is the real publication candidate.

**Action: merge `release-prep/fedos-oss-closed-pilot` (plus the fixes in
this report) into `master` before publishing.** Publishing `master` as
it stands would ship an all-rights-reserved repository that invites
public vulnerability disclosure.

---

## Checklist

| # | Item | On `master` | On prep branch | Verdict |
|---|---|---|---|---|
| 1 | **README** | 11,886-line changelog | 249 lines, first-visitor oriented, honest non-guarantees table | ✅ (after fix F2) |
| 2 | **BUILDING** | present | 210 lines; pinned Node 24.x / npm 11.12.1 / Rust 1.95.0 / wasm-bindgen 0.2.126 | ✅ |
| 3 | **SECURITY** | present | 289 lines; routes reports to GitHub Private Vulnerability Reporting, refuses to print an unmonitored email | ✅ (after fix F2) |
| 4 | **CONTRIBUTING** | present | 203 lines; MPL-2.0 inbound=outbound, **no CLA, no DCO** | ✅ |
| 5 | **LICENSE** | ❌ **absent** | MPL-2.0, official text verified against Mozilla + SPDX | ✅ on prep only |
| 6 | **THIRD_PARTY_NOTICES** | present | 522 lines, regenerable via script | ✅ |
| 7 | **Issue Templates** | ❌ absent | `bug_report.yml`, `feature_request.yml`, `config.yml` (`blank_issues_enabled: false`), plus PR template and `dependabot.yml` | ⚠️ see O1 |
| 8 | **GitHub Discussions** | n/a — repo setting | documented in README/CONTRIBUTING | ⚠️ owner action O2 |
| 9 | **Private Vulnerability Reporting** | n/a — repo setting | documented, with an explicit "off by default" warning in README | ⚠️ owner action O2 |
| 10 | **Code Owners** | absent | absent | ➖ not needed — see below |
| 11 | **Release Assets** | build pipeline real | unsigned NSIS + ZIP + manifest + SHA256SUMS, allowlist- and secret-scanned; deliberately **not** published in-repo | ⚠️ owner decision O3 |

Also checked: no secrets, keys, or personal contact data in tracked
files (only a test fixture string); `CODE_OF_CONDUCT.md` present (100
lines); no broken relative links in any root document.

---

## Fixes applied

Only where a third party would be actively misled or blocked. Three
edits, all documentation.

### F1 — `KNOWN_LIMITATIONS.md` contradicted `LICENSE` (blocking)

Item 28 still read *"No open-source (or other) license has been selected
… all rights reserved … This blocks Public Beta"* — while `LICENSE`,
`README.md`, `CONTRIBUTING.md`, `LICENSE_STATUS.md`, both
`package.json` files and `Cargo.toml` all declare MPL-2.0. The prep
branch updated everything except this one file, and the README points
first-time readers straight at it as *"the complete, maintained list"*.

A third party doing basic licence diligence would have found the
repository's own canonical limitations document telling them they have
no permission to use the code. Rewritten to state MPL-2.0 and its two
carve-outs (dependencies, `test-vectors/`).

### F2 — README and SECURITY.md overclaimed the Double Ratchet (high)

The README opened with *"with a Double Ratchet session per
conversation"* and listed it under *"implemented and exercised by the
test suite — not planned."* SECURITY.md said *"Only Direct (pairwise)
conversations use the real production Ratchet."*

Verified through the real production call chain in this worktree:

```
fedos-app:message-send
  → FedosDesktopComposeMessageViewModel.send()
  → FedosDesktopApplicationShell.sendMessage()          (:475-485)
  → conversationContentAccessor().sendMessage()         (:301-316)
  → conversationRuntime.sendDirectMessage()
  → FedosConversationDirectMessagingCoordinator          (:212-232)
        ratchetDelivery is OPTIONAL and undefined by default
```

`ratchetDelivery` is populated only when
`directRatchetMessageDeliveryRemoteDeviceRef` is supplied, and the
packaged app sources that value **solely** from the environment variable
`FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF`
(`fedos_electron_beta_main.cts:722`). That field's own doc comment says
so plainly: *"`sendMessage()` keeps using the legacy route until a
caller opts in"* (`fedos_desktop_runtime_config.ts:599`).

So for an ordinary pilot user, **every message goes over the plain
NIP-17 route, and forward secrecy / post-compromise recovery are not
active.** Message confidentiality is unaffected — NIP-44 v2 inside a
NIP-59 gift wrap, as claimed.

This is the kind of claim an OSS security project gets audited on
publicly. Both files now state the real position, and the README's
non-guarantees table gained a *"Forward secrecy for your messages —
not active by default"* row.

**Nothing in `src/` was changed.** Closing the gap in code (routing
ordinary sends through the ratchet) is real product work, out of scope
for a publication check — it is the near-term task recommended in
`docs/reviews/fedos_product_differentiation_layered_gift_wrap_v1/`.

### Verification

`npx vitest run` over the 8 test files that assert on README /
SECURITY.md / KNOWN_LIMITATIONS.md content: **99 tests, all passing.**

---

## Owner actions before publishing

Four items, none of which can be done from inside the repository.

**O1 — Replace the `OWNER/REPO` placeholders.** Three URLs in
`.github/ISSUE_TEMPLATE/config.yml` (lines 16, 25, 32) will 404 until
the real repository path is substituted. Already tracked as a checklist
item in `docs/pilot/CLOSED_PILOT.md:132`. Left in place deliberately:
GitHub's issue-chooser `contact_links` require absolute URLs, and
removing the security link to avoid a 404 would make private reporting
*less* visible, which is the opposite of that file's purpose.

**O2 — Enable two repository settings** (both off by default):
- **Settings → Security → Private vulnerability reporting.** Until this
  is on, the reporting channel every document points at does not exist.
- **Settings → General → Features → Discussions.**

**O3 — Decide on Release Assets.** The pipeline
(`npm run release:electron-beta`) produces an unsigned NSIS installer, a
portable ZIP, a release manifest and `SHA256SUMS`, with an artifact
allowlist check and a secret scan. Today they are distributed by the
pilot coordinator, not published — a defensible Closed Pilot choice. If
you attach them to a GitHub Release instead, the "unsigned / SmartScreen
will warn you" language must travel with them in the release notes.

**O4 — Confirm the repository name and default branch** before first
push. `.github/ISSUE_TEMPLATE/config.yml:32` assumes the default branch
is `main`; this repository uses `master`.

---

## Deliberately not done

**Code Owners.** A single-maintainer Closed Pilot does not need
`CODEOWNERS`; it only takes effect alongside branch protection with
required Code Owner review. A `CODEOWNERS` naming a placeholder account
renders as an error in GitHub's UI and blocks merges, so adding one
before the account is known would be worse than leaving it out. Add it
when there is more than one maintainer.

**Committing `Cargo.lock`.** `packages/fedos-core-rust/.gitignore:6`
excludes it, and that is a recorded policy documented in
`BUILDING.md:203-208` and `KNOWN_LIMITATIONS.md`. Worth knowing that it
is a real cost for outside contributors — Rust's own guidance is to
commit the lockfile for anything producing an end artifact, and without
it a fresh clone resolves crate versions afresh, so a future
semver-compatible upstream release can break a newcomer's first build.
This is a deliberate documented decision, not an oversight, so it is
reported rather than reversed.

**CI workflows.** No `.github/workflows/` exists. Not a publication
blocker, and adding a CI pipeline is engineering work, not a readiness
fix. Worth adding after publication so contributors get feedback on PRs.

---

## Verdict

**Publishable — from the prep branch, not from `master`, after O1–O4.**

The documentation set is unusually strong for a pre-1.0 project: an
honest non-guarantees table, a security policy that refuses to advertise
an unmonitored mailbox, an explicit no-CLA contribution rule, and a
licensing decision record with verified provenance. The two things that
would have caused real third-party harm — a licence contradiction and a
front-page cryptographic overclaim — are fixed above.

The remaining risk is not documentation. It is that `master` and the
publication candidate are still two different branches.
