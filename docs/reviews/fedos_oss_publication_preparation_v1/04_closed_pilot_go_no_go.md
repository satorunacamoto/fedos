# Closed Pilot — Final Go / No-Go

**Scope: Closed Pilot readiness only.** Public Beta is evaluated in §4
and its status is unchanged.

---

## Verdict

> # CONDITIONAL GO
>
> Every technical and documentary precondition for a Closed Pilot is
> **met**. The remaining conditions are **human setup actions that
> cannot be performed from inside the repository** — chief among them
> enabling GitHub Private Vulnerability Reporting, without which the
> pilot's only sanctioned channel for a sensitive report does not
> exist.

This is the *same verdict wording* the project already carried, but the
blocker has changed. The prior CONDITIONAL GO was blocked on **"assigning
a real contact/reporting channel"** — an open design question. That
question is now **answered and implemented**: GitHub Private
Vulnerability Reporting, wired through `SECURITY.md`, `README.md`, the
issue-template chooser, `CONTRIBUTING.md`, and the pilot package. What
remains is **flipping one switch in repository settings**, which no
amount of repository work can do.

## 1. Required PASS criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | MPL-2.0 correctly installed | ✅ **PASS** | Official text byte-identical to Mozilla's, cross-verified against SPDX. All 4 manifests agree. No copyright holder invented. |
| 2 | Unresolved test-vector provenance safely handled | ✅ **PASS** | NIP-44 vectors re-verified from primary sources, retained on evidence, **explicitly excluded** from the MPL grant in 4 places. Caveat recorded, not buried. |
| 3 | README current | ✅ **PASS** | Rewritten, 788 KB → 10 KB. Chronology moved verbatim to `docs/ALPHA_HISTORY.md`. |
| 4 | BUILDING reproducible | ✅ **PASS** | Followed end-to-end from a clean worktree: `npm ci` → WASM → typecheck → tests → installer + ZIP. Exact commands in [`03`](03_release_candidate_manifest.md) §9. |
| 5 | SECURITY reporting instructions complete | ✅ **PASS** | Private reporting, safe first-report checklist, prohibited-content list, severity vocabulary, no fabricated SLA. |
| 6 | Private vulnerability reporting identified as mandatory setup | ✅ **PASS** | Stated in `SECURITY.md`, `README.md`, `CLOSED_PILOT.md`, and [`02`](02_github_repository_setup.md) §9 — each saying the channel is **not live** until enabled. |
| 7 | Issue templates complete | ✅ **PASS** | Bug, feature, chooser config with blank issues disabled, PR template. All validated. |
| 8 | Pilot documents complete | ✅ **PASS** | All 7 required documents, plus an unposted recruitment draft. |
| 9 | Release artifacts build | ✅ **PASS** | Unsigned NSIS installer + portable ZIP, from a verified-clean tree. |
| 10 | Checksums verify | ✅ **PASS** | Pipeline-verified **and independently recomputed**. |
| 11 | Unsigned status disclosed | ✅ **PASS** | Measured `NotSigned`; disclosed in README, KNOWN_RISKS, INSTALLATION, package metadata, and the manifest. |
| 12 | Secret / path scan clean | ✅ **PASS** | No keys, certificates, tokens, credentials, local usernames, or tracked binaries — working tree **or** history. Release scan: 751 files, 0 findings. |
| 13 | No known open production correctness defect | ✅ **PASS** | None introduced or found. The single `cargo test` failure is a pre-existing dependency-**count guard**, proven by A/B; it tests no product behaviour. |
| 14 | No Public Beta claim | ✅ **PASS** | README states "Not reached"; every pilot document says Closed Pilot, not public beta. |

**14 / 14 PASS.**

## 2. Conditions — human setup, before announcing

None can be done from the repository.

| # | Action | Why it blocks |
| --- | --- | --- |
| **C1** | **Enable Private Vulnerability Reporting** (Settings → Security) | **Hard blocker.** Off by default. Until enabled the reporting link 404s and there is **no sanctioned channel for a sensitive report**. Verify signed out or from a second account. |
| **C2** | Create and publish the repository | Nothing is public yet; no remote is configured. |
| **C3** | Replace `OWNER/REPO` in `.github/ISSUE_TEMPLATE/config.yml` | 3 placeholder URLs would 404 in the chooser. |
| **C4** | Decide the git-author-email question | Becomes permanently public on push. **Irreversible.** [`00`](00_publication_reconciliation.md) Finding 2. |
| **C5** | Distribute artifacts + checksums out of band | Not committed by policy; publish checksums independently of the download. |
| C6 | Rename default branch to `main`, or fix `blob/main/` links | Cosmetic, but the links break otherwise. |
| C7 | Enable Discussions | Documentation routes support there to keep it out of the security channel. |
| C8 | Choose participants and send the invitation | The pilot itself. |

**Recommended before announcing, not blocking:** merge the two doc-only
branches carrying the current verdict of record into `master`
([`00`](00_publication_reconciliation.md) Finding 1) — otherwise a
visitor cloning the published repository cannot find them.

## 3. Why not an unconditional GO

Only because C1–C5 are genuinely outside the repository. **No technical
work is outstanding.** If those five were already done, this would be a
GO.

## 4. Public Beta — unchanged at NO-GO

**Public Beta remains NO-GO.** Closed Pilot readiness does not move it,
and nothing here was written to imply otherwise.

Its blockers are untouched by this work:

- **No independent security audit.** The single largest blocker, and it
  cannot be closed by internal effort.
- **No code signing.** Unsigned artifacts are tolerable for a small
  vetted cohort who verify checksums; they are not acceptable for
  general distribution.
- **Human and legal decisions outstanding** — privacy policy and terms
  remain unreviewed drafts.
- **No pilot feedback yet.** The pilot exists to produce the evidence a
  public beta decision needs. Deciding before that evidence exists would
  defeat the point.

Licensing was *one* Public Beta blocker and is now resolved. **Resolving
one blocker does not clear the gate.**

## 5. Residual risks accepted for the pilot

Each is disclosed to participants:

- **No audit** — the pilot's central caveat, stated everywhere.
- **Unsigned artifacts** — SmartScreen will warn; checksum verification
  is the only integrity control, and `INSTALLATION.md` walks through it.
- **Unpinned Rust dependencies** (`Cargo.lock` not committed) — affects
  build reproducibility, not the correctness of *these* artifacts, whose
  hashes are recorded.
- **No bit-for-bit reproducibility** — explicitly not claimed.
- **Dev-only npm advisories** — 0 in the shipped tree; they affect
  contributors running the test UI. Dependabot now surfaces them.
- **The NIP-44 vector caveat** — neither upstream repository carries a
  formal `LICENSE` file. Evidence is strong and documented; legal
  confirmation stays open with a contained remedy.

## 6. Structural guards — all verified

| Guard | Verified |
| --- | --- |
| MPL-2.0 text official and unmodified | ✅ two independent sources, byte-identical, 0 CR bytes |
| Owned package metadata agrees | ✅ 4/4 `MPL-2.0`, each re-parsed |
| Unresolved third-party material not falsely relicensed | ✅ excluded in 4 places, caveat recorded |
| Sensitive reports not directed to public Issues | ✅ blank issues disabled; chooser routes to private reporting |
| No fake contact | ✅ **zero** email addresses in any new or updated document |
| No external-audit claim | ✅ every mention is a denial |
| No signed-artifact claim | ✅ a false "signed release pipeline" claim was **found and removed** |
| No onion / anonymity claim | ✅ only as explicit non-goals |
| No Public Beta claim | ✅ "Not reached" |
| No crypto / protocol change | ✅ zero changes under `src/`, `packages/fedos-core-rust/src/` |
| No telemetry or auto-update | ✅ no `electron-updater`, `autoUpdater`, `crashReporter`, or analytics |
| No push / tag / publication | ✅ no remote configured, zero tags, nothing pushed |
| No secret / private profile / local path | ✅ clean in tree and history |
| No `p2p/` or `.tmp_gen/` change | ✅ untouched |

## 7. What changed, in one line each

- **5 commits**, no source behaviour change, **no Alpha range claimed**.
- `LICENSE` (MPL-2.0) added; license metadata in 3 manifests.
- NIP-44 vector provenance resolved and carved out of the MPL grant.
- README rewritten; 11,815 lines of chronology relocated verbatim.
- GitHub reporting surface created; `SECURITY.md` rewritten.
- 8 pilot documents added, including an **unposted** recruitment draft.
- License text and third-party notices now ship **inside** the app.
