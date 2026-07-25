# Contributing to FedOS

Thanks for looking. FedOS is in **Closed Pilot** — early, unaudited, and
deliberately narrow in scope. Contributions are welcome, and the fastest
way to have one accepted is to read this section first.

## Start here (outside contributors)

### Licensing

This project is licensed under the **Mozilla Public License 2.0**
(MPL-2.0) — see [`LICENSE`](LICENSE) for the full text and
[`LICENSE_STATUS.md`](LICENSE_STATUS.md) for the decision record and a
plain-language summary of what MPL-2.0 actually requires.

**By opening a pull request you are submitting your contribution under
MPL-2.0**, on the ordinary inbound=outbound convention, and confirming
you have the right to do so. There is no CLA and no DCO sign-off
requirement.

Two consequences worth knowing up front:

- MPL-2.0 is a **file-level** copyleft. If you modify an existing
  MPL-covered file, that file stays MPL-2.0. Files you add are yours to
  license as you choose, though matching the project keeps things
  simple.
- If you bring in **third-party code or data**, its origin and license
  must be recorded alongside it, not left implicit.
  [`LICENSE_STATUS.md`](LICENSE_STATUS.md) §4 shows how the existing
  third-party test vectors are handled — that is the standard to match.

### Reporting things

- **Security vulnerability** — **never** a public Issue or PR. Use
  GitHub Private Vulnerability Reporting; read
  [`SECURITY.md`](SECURITY.md) first, including its safe-first-report
  checklist. If you are unsure whether something is sensitive, treat it
  as sensitive.
- **Ordinary bug** — a public Issue, using the bug report template.
- **Question, idea, or design discussion** — Discussions.

Never put a private key, `nsec`, Master Seed, passphrase, profile
directory, Archive export, message plaintext, or personal relay
credential into **any** of those channels.

### Before you write code

- **Open an Issue or Discussion first** for anything substantial. This
  project declines features for scope reasons fairly often — see
  [`ROADMAP.md`](ROADMAP.md) and
  [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) — and it is better to
  learn that before you build it than after. Small, focused fixes do
  not need prior discussion.
- **Read [`BUILDING.md`](BUILDING.md)** and get a build working first.
- **Cryptography and protocol changes face a deliberately high bar.**
  Expect a slow, sceptical review, and expect to be asked for
  test-vector evidence. That is not distrust of you; it is how a
  messenger avoids shipping a confident mistake.

### Absolutely do not

- Add telemetry, analytics, crash reporting, or auto-update.
- Add a claim about a security property that the repository does not
  already demonstrate to be true.
- Commit secrets, real profile data, local absolute paths, or personal
  information.

See "Absolute prohibitions" below for the full, repository-wide list.

---

## How this repository organizes work (Arc conventions)

The rest of this document describes the internal working conventions
this repository has followed across its history. **You do not need to
follow the Arc process to contribute a bug fix.** It is documented so
the commit history and branch layout make sense to you, and so larger
pieces of work stay consistent with what came before.

This repository's work is organized into **Arcs** — focused, single-
purpose units of work, each on its own dedicated `git worktree` and
branch, each claiming a reserved numeric range ("Secure Runtime Alpha
NNNN-MMMM") in its own commit title. This document codifies the
conventions this repository has consistently followed across its
history, so a new contributor (human or agent) doesn't have to
reverse-engineer them from `README.md`'s own multi-thousand-line status
history.

## Before starting an Arc

1. Inspect current branch tips (`git branch -a`) and confirm `master`'s
   real tip — it is frequently many commits/Arc-ranges behind the
   furthest-landed work on unmerged branches. Verify via
   `git merge-base` before assuming a starting point.
2. Inspect `docs/ALPHA_HISTORY.md`'s newest-first status-blurb stack
   (prepended, not appended — the most recent Arc's blurb is always
   closest to the top of the file) to see what's actually landed on
   `master`. This chronology previously lived in `README.md` and was
   moved, unmodified, when the repository was prepared for publication.
3. Reserve an Alpha number range only after confirming it's free (search
   `git log --all --oneline | grep -i "Alpha <range>"`); record the
   historical Alpha 5401-5480 collision (two unrelated Arcs once claimed
   the same range) as the reason this check matters.
4. Use a dedicated worktree (`git worktree add C:\wt\<name> -b arc/<name> <base>`),
   never the primary checkout, unless the task is explicitly a
   master-landing or release-branch operation.
5. Set up `node_modules` via a directory junction from a sibling
   worktree with a matching `package-lock.json` rather than a full
   `npm install` — see `BUILDING.md`.

## During an Arc

- **Write a Phase A reconciliation report before any source edit** for
  any Arc that starts from someone else's prior finding ("X is missing",
  "Y is broken") — re-verify directly against current source, don't
  trust prior review wording. Several real conflicts in this
  repository's history turned out to be "both true, about different
  things" (e.g. "a Devices UI exists" and "no Device Pairing workflow
  exists" were both correct simultaneously — the UI existed but only did
  list/revoke, not pairing).
- **Never claim more than the real, tested code supports.** If a
  capability is receive-blind, say so plainly rather than shipping a UI
  that would misrepresent it as working. Closed Beta readiness does not
  require every feature — a clearly disclosed absence is an acceptable
  outcome, a misleading UI is not.
- **Prove workflows through the real, packaged, visible-control path**
  wherever practical — driving actual DOM elements via `webContents.executeJavaScript()`
  (this repository's own `ui-script` autotest convention), not only an
  internal handler shortcut (`fedosAcceptance`-style). A test that only
  proves the backend method resolves is not the same as proving the
  screen works.
- **Never use `window.confirm()`/`window.alert()` for a real UI
  confirmation you also intend to test via automation** — Electron's own
  JS-dialog IPC round-trip has no programmatic answer path and will hang
  indefinitely under scripted control. Use a real inline two-step
  confirmation instead (see `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts`'s
  own Device Pairing approve flow for the pattern).
- **A test failing once, passing clean on immediate re-run with no code
  change, is very likely resource contention**, not a regression — this
  repository runs many concurrent real Electron subprocesses across
  parallel sessions/worktrees. Don't conclude a regression from a single
  failing run; A/B test against `git stash` on the unmodified base before
  reporting one.
- **Extending a prior Arc's own structural-guard test allowlist/count is
  expected when your Arc adds a new, legitimate entry** — not a
  violation of that guard's intent. Update the test alongside your
  change, following its own established per-Arc-addition pattern (see
  `test/secure_runtime_alpha_8121_8200_beta_limitations_reconciliation.test.ts`
  for the pattern: one new `it()` block per Arc, listing exactly what
  that Arc added).

## Absolute prohibitions (repository-wide, not Arc-specific)

- Never `git add -A` — stage files explicitly.
- Never push, tag, publish, or contact real users/pilot participants
  without explicit, in-scope authorization.
- Never invent a contact address, response SLA, audit vendor, date, or
  budget in `SECURITY.md` or pilot-operations docs — leave a real
  placeholder rather than fabricated content.
- Never claim an external audit occurred, or that a release is signed,
  when it is not.
- Never merge another session's or another review's branch without
  explicit instruction — read it, cite it, reconcile findings into your
  own docs, but leave the branch itself alone unless told to merge it.
- Never delete another session's uncommitted work; if you find
  unfamiliar in-progress state, investigate before touching it.

## Commit and completion conventions

- Full completion: `Add Secure Runtime Alpha <range>: <Arc name> Arc`.
- Honest partial: `Add Secure Runtime Alpha <range>: <Arc name> Arc
  (<exact blocker> honestly disclosed)`.
- Read-only reviews/audits/validation programs do not claim an Alpha
  range at all (see the many `review/*` branches in this repository's
  history) — they're commits like "Add <Review Name> V1", docs-only, no
  Alpha number, no source change.
- Write a Completion Declaration doc for any Arc of meaningful size,
  distinguishing "what was proven, not merely claimed" (tests that
  actually ran, artifacts that actually built) from what's asserted.
- Landing to `master`: fast-forward only (`git merge --ff-only`), done
  from the primary checkout, always merging your OWN worktree's actual
  tip — never the range's originally-named starting commit, which may be
  stale by the time you land.
- Landing to a release branch: merge `master` in with `--no-ff`, from
  that branch's own dedicated worktree; release-notes updates are a
  release-branch-only change, never duplicated onto `master`.

## Verification expected before calling an Arc complete

1. `npm run typecheck` (root + electron-spike package) clean.
2. `cargo test --release` (only if Rust/WASM-adjacent source changed).
3. The real, packaged visible-control acceptance test(s) for whatever
   the Arc touched, run serialized, passing repeatably (not just once).
4. A/B comparison against the unmodified base for any test that fails,
   before concluding it's a regression.
5. A secret/path/log scan of any new renderer code (no `innerHTML`, no
   raw secret in a log line, no `console.log` of user-entered secret
   material).
6. If the Arc changed anything in the real release/build pipeline: an
   actual `npm run release:beta` run producing real checksummed
   artifacts — not just a typecheck.

See `BUILDING.md` for the concrete commands.
