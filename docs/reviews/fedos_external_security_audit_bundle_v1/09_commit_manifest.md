# Commit Manifest

Exact commit identity for the codebase this bundle's own new documents
(`08_version_manifest.md` through `19_reviewer_checklist.md`) describe,
and how it relates to the rest of this bundle (`00`-`07`, assembled one
commit earlier) and the wider repository history.

## Commit under audit for this addendum

```
git rev-parse HEAD
68e7be168ec7ffd9a910b140c3cc9e272dd5a769

git log -1 --format="%H %ad %s" --date=iso HEAD
68e7be168ec7ffd9a910b140c3cc9e272dd5a769 2026-07-25 22:57:47 +0900 \
  FedOS Documentation Consolidation V1: unify nine reviews into seven canonical top-level docs

git symbolic-ref --short HEAD
master
```

**Important note on this bundle's own internal consistency**: documents
`00`-`07` of this bundle state their own cutoff as `master` @ `81305b37`
("Reconcile four parallel review findings into Closed-Beta docs, Alpha
8201-8280 follow-up"). This addendum (`08`-`19`) was assembled one commit
later, against `68e7be16`, which landed **while this exact bundle was
being built** — a live illustration of the "other sessions may commit to
this repository concurrently" risk this repository's own convention
already assumes. Verified via `git show --stat 68e7be16`: **docs-only**
(`README.md`, `SECURITY.md`, plus five new top-level files —
`ARCHITECTURE.md`, `ROADMAP.md`, `KNOWN_LIMITATIONS.md`, `BUILDING.md`,
`CONTRIBUTING.md`); zero files under `src/`, `packages/fedos-core-rust/`,
or `packages/fedos-desktop-electron-spike/src/` changed. Every
architecture/crypto/threat-model claim in `01_architecture.md`/
`02_threat_model.md` therefore remains valid unchanged — only the
canonical location of some equivalent prose moved (e.g.
`docs/desktop_beta_known_limitations.md` is now a short pointer stub to
the new root `KNOWN_LIMITATIONS.md`). An auditor should prefer the five
new root-level docs as the canonical narrative entry points going
forward; this bundle's own `00`-`07` remain valid as the deeper,
audit-specific inlining of the same underlying facts.

## Repository-wide statistics (measured directly, not cited from a prior report)

```
git rev-list --count HEAD          -> 723
git log --format="%an" | sort -u   -> satoru.nacamoto.2008   (single author)
git tag | wc -l                    -> 0                      (no tags)
git branch -a | wc -l              -> 164                    (local + remote-tracking refs)
git remote -v                      -> (empty — no remote configured in this checkout)
```

First commit: `9057dcd0`, 2026-06-30, "Initial Nostr ingest and thread
builder foundation" — the original "nostr-window" prototype seed this
repository grew from (see `README.md`'s own "Original project vision"
section and `ARCHITECTURE.md`'s historical-note section for how that
early scope relates to what actually shipped).

## Recent commit lineage on `master` (most recent 15, verbatim)

```
68e7be16 FedOS Documentation Consolidation V1: unify nine reviews into seven canonical top-level docs
81305b37 Reconcile four parallel review findings into Closed-Beta docs (Alpha 8201-8280 follow-up)
d8387b71 Add Secure Runtime Alpha 8201-8280: FedOS Desktop Closed-Beta Product Gap Closure and Final Polish Arc
739fb3e8 Add Secure Runtime Alpha 8121-8200: FedOS Desktop Beta UI Integration and Closed Pilot Candidate Arc
7493e8d7 Add Secure Runtime Alpha 8121-8200: security/reproducibility review reconciliation (Phases A-L)
7337759e Add Secure Runtime Alpha 8041-8120: FedOS Desktop Beta User-Facing Product UI Completion Arc
97f26f0f Add Secure Runtime Alpha 7961-8040: FedOS Secure Runtime Staged Master Landing and Desktop Beta Release Candidate Arc
aed09513 Add Secure Runtime Alpha 7961-8040 Stage 8: local master landing gate report (all conditions PASS)
c31c32ae Add Secure Runtime Alpha 7961-8040 Stage 7: documentation and security-claims reconciliation report
bfbe1641 Add Secure Runtime Alpha 7961-8040 Stage 6: release artifact verification report (real NSIS+ZIP built, checksums verified, 0 secret-scan findings)
096459b6 Add Secure Runtime Alpha 7961-8040 Stage 5: upgrade/downgrade/rollback compatibility report
fb3a02e1 Add Secure Runtime Alpha 7961-8040 Stage 4: real product acceptance report (34/35 criteria PASS, one named bounded gap)
7a7bb5de Add Secure Runtime Alpha 7961-8040 Stage 3: full integration verification report and Electron acceptance findings
9af179e1 Fix release-blocking defect: a single unreachable configured relay crashed the entire Runtime/profile creation
eec4a1af Fix release-blocking typecheck regression: cast execFileSync result explicitly in structural guard test 14
```

The lineage above is this repository's own primary integration line —
each entry with an "Alpha NNNN-NNNN" or "Stage N" title is a real,
previously-completed unit of work with its own dedicated report under
`docs/`; none are squashed or rewritten. Because there are no tags, "the
commit under audit" must always be named by full hash, never by a
version-like label alone (the `0.1.0-beta.1` string in
`08_version_manifest.md` is a product version, not a git tag or release
marker — `git tag` confirms zero tags exist).

## Unmerged review branches

164 branches exist locally; the overwhelming majority (~150+) are either
per-feature/protocol design-decision reviews (onion transport,
multi-device identity rotation, private-group-crypto, and similar — out
of scope for this bundle, see `docs/secure_runtime_documentation_consolidation_v1_review_index.md`'s
own explicit "not touched" list) or ephemeral worktree-support branches.
The specific `review/*` branches this bundle's own `04_evidence_index.md`
cites (audit-prep base/delta, Closed Beta Operations, Validation
V1/V2, Technical Debt, Dead Runtime, Architecture Conformance, UX,
Release, Performance) are enumerated there with their exact base
commits — this manifest does not repeat that list, only confirms none of
them are ancestors of `master` as of `68e7be16`
(`git merge-base --is-ancestor <hash> master` returns non-zero / "false"
for every one spot-checked, matching `04_evidence_index.md`'s own
"Status" column).

## What this manifest is not

This is not a changelog and does not attempt to summarize what changed
in each of the 723 commits — `README.md`'s own append-only Arc status
history already serves that purpose and is this repository's changelog
of record (per the Documentation Consolidation's own explicit scope
note). This manifest exists so a reader of this bundle can answer,
precisely and without ambiguity, "what exact commit does 'this bundle'
mean," including the one-commit drift this specific addendum discloses
above.
