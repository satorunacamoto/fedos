# FedOS OSS Publication Reconciliation Report

**Scope:** prepare the canonical repository and release candidate so the
repository owner can publish to GitHub and begin a small Closed Pilot.
**This report ends before push/publication. Nothing was pushed, tagged,
released, or announced.**

- **Prepared on:** 2026-07-26
- **Worktree:** `C:\wt\fedos-oss-closed-pilot-preparation`
- **Branch:** `release-prep/fedos-oss-closed-pilot`
- **Base commit:** `4bd79d11` (`master`)
- **Alpha range claimed:** **none** — see §9.

---

## 1. Canonical state, verified directly from Git

Every tip named in the task was checked against the repository rather
than assumed.

| Ref | Tip | Verified |
| --- | --- | --- |
| `master` | `4bd79d1103b3e89fdb17a17119180ff3cbeae06d` | ✅ matches |
| `release/fedos-desktop-beta-0.1` | `dbfe59811d013191a11ccbcf4e16801531b5343f` | ✅ matches |
| Final revalidation | `fb1849c5bfeca87020fdd6d3a6d028f126644b8f` | ✅ matches |
| Consolidation report | `649348d6cca79ba232614a05a7c66e45f53f8e4e` | ✅ matches |

**Ancestry** (`git merge-base --is-ancestor`):

- `master` **is** an ancestor of `release/fedos-desktop-beta-0.1`,
  `fb1849c5`, and `649348d6`.
- `649348d6` is **not** an ancestor of `fb1849c5` — they are two
  independent doc-only branches off `master`, not a chain.

**Content of each divergence** (all documentation-only; no source):

- `release/…beta-0.1` = `master` + 1 file (release notes, 209 lines).
- `fb1849c5` = `master` + 6 files (final revalidation, 511 lines).
- `649348d6` = `master` + consolidation report.

### Finding 1 — the two most recent governance documents are not on `master`

`fb1849c5` (Final Post-Governance Revalidation V1) and `649348d6`
(Alpha 8201–8400 Consolidation Report) are the current verdict of record
— they are what says *"Closed Pilot: CONDITIONAL GO, Public Beta:
NO-GO"* — yet **neither is reachable from `master`.** A visitor cloning
the published repository would not find them.

This repeats a pattern already recorded once before (external-audit-prep
documents orphaned on unmerged branches while a merged document cited
them as required reading).

**Recommendation, for the owner, before publishing:** fast-forward or
merge both doc-only branches into `master`. Both are additive
documentation with no source changes, so the merge is low-risk. **This
report does not do it** — altering `master` is outside this task's
commit policy.

## 2. Remotes and tags

- **`git remote -v` → empty.** No remote is configured. Nothing has ever
  been pushed anywhere.
- **`git tag -l` → empty.** Zero tags. No release has ever been tagged.

This is the expected state for a repository that has never been
published, and it means publication is genuinely a first-time event with
no prior public artifact to reconcile against.

## 3. History hygiene — secrets, keys, personal data

**No credential, private key, or signing material was found, in the
working tree or in the tracked history.** History was **not** rewritten,
and no rewrite is warranted.

| Check | Result |
| --- | --- |
| `BEGIN … PRIVATE KEY` / `BEGIN CERTIFICATE` blocks | **None.** The only 3 matches are a secret-*scanner's* own pattern list and two tests asserting such content is rejected. |
| `.pfx` / `.p12` / `.key` / `.pem` / `.jks` / `.gpg` files | **None tracked.** |
| AWS / GitHub / Slack token shapes | **None.** |
| `api_key` / `secret_key` / `password = "…"` assignments | **None** outside test/mock/example. |
| Local Windows username (`T126158`) | **Zero occurrences** in tracked content. |
| Personal email in tracked content | **None.** One doc records the author *name* as single-author evidence — legitimate attribution, retained. |
| Relay URLs | All `*.test` / `*.example` / `*.invalid` placeholders. The only real one is `wss://relay.damus.io` (3×), a well-known public relay — **not** a credential. |
| Tracked binaries / build output | **None.** No `.exe`, `.wasm`, `.zip`, `.dll`, `.node`, `pkg/`, `dist/`, `target/`. |
| Test profiles / databases | **None.** All `profile` matches are source files. |

### Finding 2 — the git author email becomes public on publication (HUMAN DECISION)

All 741 commits carry a single author:
`satoru.nacamoto.2008 <satoru.nacamoto.2008@gmail.com>`.

That address is **not** in any tracked file — it exists only in commit
metadata, where it is normal and expected. But **publishing the
repository publishes it**, permanently and irreversibly, to anyone who
clones.

**No action taken.** Removing it would require rewriting all 741
commits, which this task forbids and which would be disproportionate.
The owner should simply decide knowingly. Options: accept it (the
ordinary open-source outcome); or, before publishing, rewrite history
with an explicit separate authorisation. **Do not** discover this after
publication, when it can no longer be undone.

### Finding 3 — institution name appears in 3 tracked files (HUMAN DECISION)

The build-environment documentation names a specific university
(`OneDrive - 公立諏訪東京理科大学`) in:

- `docs/runtime_backend_risk_register.md:16`
- `docs/runtime_backend_verification_policy.md:16`
- `test/secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts:284`

These are legitimate technical records — a real, reproducible
Windows/OneDrive/non-ASCII path bug class — and the surrounding
documentation already uses `<user>` / `<org>` placeholders elsewhere.
But the institution name personally identifies the author.

**No change made**, because the test file uses it as a genuine
long-non-ASCII-path fixture and editing it is a source change outside
this task's scope. The fix is small and safe if wanted: substitute any
other long non-ASCII path (the property under test is the *shape*, not
the name). **Recommended, not applied.**

## 4. Naming and metadata

- **Root package is still named `nostr-window`** — the pre-pivot name.
- **The Electron package is `@nostr-window/fedos-desktop-electron-spike`**
  and is *not* a spike; its own description says so.

Renaming touches every `--prefix` script site and is already documented
as its own separately-scoped work. **Not renamed here.** The README now
explains the historical name plainly, so a visitor is not confused.

### Fixed — a false code-signing claim in package metadata

The Electron `package.json` description read *"The real FedOS Desktop
Beta Electron app and **its signed release pipeline**…"*. **The pipeline
produces unsigned artifacts** and no Authenticode signing is configured
anywhere. Corrected to state the unsigned status explicitly.

## 5. `.gitignore` / `.gitattributes` / large files

- **`.gitattributes`** — `* text=auto eol=lf`, with a well-documented
  rationale. Correct, and it means the new `LICENSE` is committed
  LF-only.
- **`.gitignore`** — covers `node_modules/`, `dist/`, packaging output,
  and (in the crate's own file) `/target/`, `/pkg/`, `*.wasm`. **The
  WASM build performed for this report produced no trackable file.**
  Verified: `git status` stayed clean of build output throughout.
- **Largest tracked files** are all documentation or source, the biggest
  being `docs/fedos_original_prototype_reference_historical.md`
  (1.36 MB) and `packages/fedos-core-rust/src/lib.rs` (755 KB). Large,
  but legitimate and text. **No binary blobs.**

### Finding 4 — `Cargo.lock` is git-ignored (RECOMMENDATION)

`packages/fedos-core-rust/.gitignore` excludes `Cargo.lock`. For a
**library** that is conventional; for an **application** — especially a
cryptographic one — it is the wrong default. Without a committed
lockfile:

- builds are not version-pinned, so two people building "the same
  commit" can get different dependency versions;
- supply-chain auditing is weaker, since there is no record of exactly
  what was built;
- rollback to a known-good dependency set is not possible.

`package-lock.json` **is** committed for both npm packages, so this
inconsistency applies only to the Rust crate. **Not changed here** —
build policy is the owner's call and this task adds no source changes.
Recommended as a follow-up.

## 6. Third-party notices

`THIRD_PARTY_NOTICES.md` is generated and deterministic
(`node scripts/generate_third_party_notices.mjs`), covering 313 npm
packages and 82 Rust crates. **Preserved unmodified.** Adopting MPL-2.0
required no change to it, and none was made. §4 of `LICENSE_STATUS.md`
now states explicitly that the project license does not extend to any
dependency.

## 7. Dependency advisories

`npm audit` reports **5 advisories: 1 critical, 1 high, 3 moderate** —
all in `vitest` / `vite` / `esbuild`.

**`npm audit --omit=dev` reports 0 vulnerabilities.** Every advisory is
in dev-only tooling; **nothing in the shipped dependency tree is
affected.** The shipped runtime dependencies are `@noble/curves` and
`@noble/hashes` only.

They should still be updated — the critical one (Vitest UI server
arbitrary file read/execute) matters to any contributor running the test
UI. `.github/dependabot.yml` is now configured to surface these weekly.

## 8. Documents inspected

`LICENSE_STATUS.md`, `SECURITY.md`, `README.md`, `BUILDING.md`,
`CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md`, `KNOWN_LIMITATIONS.md`,
`ROADMAP.md`, `ARCHITECTURE.md`, `test-vectors/README.md`,
`docs/crypto_vector_sources.md`, and the `docs/reviews/` set. Findings
are folded into the sections above and into
[`01_license_and_provenance.md`](01_license_and_provenance.md).

## 9. On claiming an Alpha range — deliberately none

This work claims **no Secure Runtime Alpha range**, and that is a
considered decision rather than an omission.

The repository's Arc convention exists to sequence **product and runtime
work** — each Arc claims a numeric range in its commit title and lands a
status blurb in the chronology. This task is **publication and
repository preparation**: a license file, GitHub templates, a README
rewrite, pilot documentation, and a build verification. It adds **no
product feature, no source behaviour change, and no runtime capability.**

Assigning an Alpha range would misrepresent documentation work as
runtime progress and would consume a range that real work should have.
The repository already contains doc-only and review-only work that
correctly claimed no range (the audit and review branches), so this
follows existing precedent rather than inventing an exception.

**Next free range, for whoever does claim one:** the highest claimed
range is **8441–8520** (`master`'s tip). **8521 onward is free.**

---

## 10. Summary of findings

| # | Finding | Severity | Action |
| --- | --- | --- | --- |
| 1 | Latest governance/revalidation docs not merged into `master` | **Medium** | Owner should merge before publishing |
| 2 | Author email becomes public on publication | **Human decision** | Decide knowingly; not reversible after |
| 3 | Institution name in 3 tracked files | **Low / human decision** | Optional 3-line fix, not applied |
| 4 | `Cargo.lock` git-ignored | **Medium** | Recommended follow-up |
| — | False "signed release pipeline" claim | **Fixed** | Corrected in this branch |
| — | No secrets, keys, or credentials anywhere | **Clean** | No action |
| — | All 5 npm advisories are dev-only | **Informational** | Dependabot added |
