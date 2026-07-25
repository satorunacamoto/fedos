# GitHub Repository Setup — recommendations

Everything here is a **recommendation for the repository owner**. None
of it can be done from inside the repository, and none of it was done.

---

## 1. Repository name and description

**Suggested name:** `fedos-desktop`

The package is still called `nostr-window` internally (the pre-pivot
name) and the Electron package is still
`@nostr-window/fedos-desktop-electron-spike`. Renaming those touches
every `--prefix` script site and is separately scoped work — but the
**GitHub repository name is free of that constraint** and should reflect
the product. `README.md` now explains the historical name, so a visitor
who notices the mismatch gets an answer.

**Suggested description** (≤ 350 chars, GitHub's limit):

> End-to-end encrypted 1:1 desktop messenger built on Nostr (NIP-17)
> with a Double Ratchet session per conversation. Windows, Electron +
> Rust/WASM. Closed Pilot — experimental, unaudited, unsigned builds.

The last clause is deliberate. The description is the single most
repeated piece of text about the project — it appears in search results,
social cards, and forks — so the stage disclaimer belongs in it.

**Website field:** leave blank. There is no site, and pointing it at the
repository is noise.

## 2. Topics

Accurate and searchable, not aspirational:

```
nostr  nip17  end-to-end-encryption  double-ratchet  messenger
electron  rust  webassembly  privacy  cryptography  windows  desktop
```

**Do not add** `security`, `anonymous`, `private-messaging`, `signal`,
or `tor`. The first two overclaim, and the rest invite a comparison the
project explicitly disclaims.

## 3. Branches

- **Default branch: `main`.** The repository currently uses `master`.
  GitHub's default is `main`, all the new documentation links assume
  `main`, and the rename is a one-click operation that GitHub redirects
  for. Do it **before** publishing, when nobody has cloned yet.
  - If you keep `master`, update the `blob/main/` paths in
    `.github/ISSUE_TEMPLATE/config.yml` and the issue templates.
- **Release branch: `release/fedos-desktop-beta-0.1`.** Keep it.
- **Before publishing**, consider merging the two doc-only branches
  carrying the current verdict of record — see
  [`00_publication_reconciliation.md`](00_publication_reconciliation.md)
  §1, Finding 1.

### Branches NOT to publish

The repository has **~80 `arc/*` branches** plus review and worktree
branches. They are real history and there is no harm in them, but
pushing all of them makes the branch dropdown unusable for a newcomer.

**Recommendation:** push `main` (or `master`) and the release branch
first. Add others deliberately if someone asks. Nothing is lost —
they stay in the local repository.

## 4. Branch protection

Modest rules that match a solo-maintainer project. Over-strict
protection on a one-person repository mostly locks the maintainer out.

**On the default branch:**

- ☑ **Require a pull request before merging** — value here is the
  paper trail and the PR template's security checklist, not review
  gating.
  - Do **not** require approvals yet. With one maintainer, that is a
    self-lock. Turn it on when there is a second maintainer.
- ☑ **Require status checks to pass** — once CI exists (§5).
- ☑ **Require conversation resolution before merging.**
- ☑ **Block force pushes.** Important given that the history is
  published and immutable from users' perspective.
- ☑ **Do not allow deletions.**
- ☐ Do **not** include administrators yet — the maintainer needs an
  escape hatch while working alone.

**On `release/*`:** the same, plus block force pushes without exception.
A release branch that can be rewritten makes published checksums
meaningless.

## 5. Required status checks — no CI exists yet

**There is currently no CI workflow.** `.github/workflows/` does not
exist, which is why the Dependabot config includes a `github-actions`
ecosystem entry that is inert until one is added.

**Not added here**, deliberately: a workflow is executable
infrastructure with its own security surface (secrets, permissions,
third-party actions), and standing it up is its own scoped piece of
work rather than something to slip into a publication-prep commit.

When one is added, the checks worth gating on already exist as commands
and are known to behave:

| Check | Command | Current result |
| --- | --- | --- |
| Typecheck | `npm run typecheck:core` | 4 pre-existing errors, all in `test/` — see below |
| Rust tests | `cargo test --release --manifest-path packages/fedos-core-rust/Cargo.toml` | 639 pass, 1 known pre-existing failure |
| WASM build | `npm run build:wasm` | passes |
| Release build | `npm run release:electron-beta` | passes from a clean tree |

Two caveats to handle **before** making any of these blocking:

- **`cargo test` has one known pre-existing failure** — a dependency-count
  guard asserting exactly 10 production dependencies when the crate has
  11 (`wasm-bindgen` was adopted later and the guard was never updated).
  Confirmed pre-existing by A/B: it fails identically with this branch's
  changes reverted. Fix the guard, or the very first CI run is red for a
  reason unrelated to any contributor's change.
- **`npm run typecheck` short-circuits.** It is
  `typecheck:core && typecheck:electron`, and `typecheck:core` currently
  exits non-zero, so `typecheck:electron` **never runs**. Invoke the two
  separately in CI, or the Electron package is silently unchecked.

**Do not gate on the full `npx vitest run` suite** until it is
triaged — see §7.

## 6. CODEOWNERS — deliberately not added

Requires a real GitHub username or team. None is known, and inventing
one would create a file that silently fails to assign anyone. Add it
after publication:

```
* @<your-github-username>
```

## 7. A caveat about the review test suite

`test/reviews/` contains **point-in-time scope-lock tests** from past
reviews — assertions such as *"git working tree shows NO change under
`src/`, `README.md`, `package.json`, `Cargo.toml`"*.

These fail for **any** change to those paths, by construction. This
branch's license and README work triggers exactly 10 of them, verified
by A/B against a clean tree: 19 failures baseline → 29 with these
changes, and **every one of the 10 is a git-status scope assertion, not
a behavioural test.**

They are historical records of what a given review touched, and they are
working as designed. **Do not "fix" them** by loosening the assertions —
that would erase those reviews' own evidence. But **do not make the
suite a required CI check** until the scope-lock tests are separated
from the behavioural ones, or every future PR is red on arrival.

## 8. Other settings

- **Discussions:** enable. `SECURITY.md`, `CONTRIBUTING.md`, and the
  pilot documents route support and design questions there, specifically
  to keep them out of the security channel.
- **Wiki:** disable. Documentation lives in-repo and versions with the
  code.
- **Projects:** optional.
- **Private vulnerability reporting:** **enable — mandatory.** See §9.
- **Dependabot alerts and security updates:** enable. The config is
  already committed.
- **Secret scanning + push protection:** enable. Free on public
  repositories, and it is a genuine backstop against a future accidental
  commit. The current tree and history are clean.
- **Releases:** do not create one yet. Artifacts go to pilot
  participants directly, and a GitHub Release reads as a public
  distribution the project is not ready to make.
- **Sponsor button / funding:** leave off.

## 9. HUMAN ACTION REQUIRED — before announcing

> **Enable "Private vulnerability reporting"** in
> **Settings → Security → Reporting**.
>
> It is **off by default**. Until it is on, the reporting link in
> `SECURITY.md`, `README.md`, and `.github/ISSUE_TEMPLATE/config.yml`
> returns **404**, and the pilot's only sanctioned channel for a
> sensitive report **does not exist**.
>
> Verify it by opening
> `https://github.com/<owner>/<repo>/security/advisories/new` while
> signed out or from a second account.
>
> **Do not announce the Closed Pilot until this is confirmed working.**

Also before announcing:

- [ ] Replace `OWNER/REPO` in `.github/ISSUE_TEMPLATE/config.yml` with
      the real path (3 URLs).
- [ ] Rename the default branch to `main`, or fix the `blob/main/`
      links.
- [ ] Decide the git-author-email question — Finding 2 in
      [`00_publication_reconciliation.md`](00_publication_reconciliation.md).
      **It cannot be undone after publication.**
- [ ] Publish artifact SHA-256 checksums somewhere reachable
      independently of the download.
