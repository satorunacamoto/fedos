# FedOS External Security Audit Bundle v1

> ⚠️ **AUDIT PREPARATION, NOT AN EXTERNAL AUDIT — point-in-time, frozen at
> the two commits named below, not revalidated since.** This finalization
> commit only moves this bundle's existing text into its own dedicated
> branch, unchanged; it does not add a review, re-run a claim, or update
> any finding. No independent third party has reviewed this codebase, and
> nothing in this bundle should be read as claiming otherwise. `LICENSE`
> and the `SECURITY.md` vulnerability-reporting contact remain unresolved
> **human decisions** this bundle deliberately does not fabricate (see
> `06_disclosure_policy.md` §7, `15_license_inventory.md`). `master` has
> already advanced past both of this bundle's own recorded cutoffs
> (`81305b37` for `00`-`07`, `68e7be16` for `08`-`19`) by the time of this
> finalization — re-run this bundle's own verification commands
> (`04_evidence_index.md`, `18_evidence_cross_reference.md`) against
> whatever commit is current before treating any specific claim below as
> still accurate.

**Purpose of this document:** this is the single entry point for an external
auditor (or any reader outside this project's own day-to-day development)
handed this repository for review. It consolidates material that previously
existed only as scattered internal review documents — several of them on
git branches never merged into `master` — into one self-contained package.
No source code was changed to produce this package; it is documentation
only, assembled from real, already-completed internal review work.

This package is **not itself an external security audit.** No independent
third party has reviewed this codebase. This is preparation material: what
an auditor needs in order to start, in what order, with what's already
known going in.

## What this bundle is built from

Every claim in this bundle traces to one of ~15 prior internal review
documents, each produced by a separate, independently-run review pass
against a specific commit of this repository. Some of those reviews live on
git branches that were never merged into `master` (a deliberate repo
convention for read-only review work — see
[`04_evidence_index.md`](04_evidence_index.md) for the full list and exact
location of each). This bundle inlines their load-bearing content directly,
so a reader with only a `master` checkout (plus this new directory) does not
need branch access to get the full picture. The full provenance — exact
file path or `git show <branch>:<path>` command, exact commit hash, exact
base commit the review ran against — is recorded in the Evidence Index so
every claim here remains independently checkable.

**Cutoff for this bundle:** assembled against `master` at commit `81305b37`
("Reconcile four parallel review findings into Closed-Beta docs, Alpha
8201-8280 follow-up"), 2026-07-25. Where a cited review ran against an
older commit, that is stated explicitly at the point of citation — several
older reviews (notably the Architecture Conformance Review, base `3eb9eadd`)
predate large amounts of now-merged work, and their "not present on master"
framing is historical, not current. Re-verify any specific line-level claim
against current `master` before relying on it for a live finding.

## What FedOS Desktop Beta is (for a reader with no prior context)

A desktop (Electron) end-to-end-encrypted messenger built on the Nostr
protocol (NIP-17 gift-wrapped direct messages) plus this project's own
additive extensions (a Double Ratchet session for Direct/1:1 conversations,
an authenticated route-binding field for same-peer multi-conversation
routing, Device pairing/trust, Signed Deletion Requests, Archive
export/restore, and a Search index). The product's original, broader vision
(a Reddit-style Nostr front end with communities/channels/commerce, on a
Cloudflare Workers backend) was abandoned early in the project's history in
favor of this focused Secure Messenger; `README.md`'s own "Original project
vision" section documents this explicitly as historical, not shipped. Group
messaging exists at the transport layer (independent pairwise fan-out) but
has **no UI and no receive-side implementation** — see
[`05_known_issues.md`](05_known_issues.md).

**Current internal readiness verdict** (Validation Program V1, `9b9ce274`,
`10_go_no_go_recommendation.md`, quoted verbatim): "Production Ready": **NO**
("not a close call"). "Closed Beta Ready": **YES**. "Public Beta Ready":
**NO, not yet** — blocked on (1) no independent audit performed, (2)
device-pairing/group-messaging UI gaps (since substantially closed — see
Known Issues), (3) unverified accessibility gaps. The recommended path,
independently reached by at least three separate reviews, is: run a closed
pilot, commission an independent external audit using this bundle, before
any public release.

## How this bundle is organized

| Document | Answers |
|---|---|
| [`01_architecture.md`](01_architecture.md) | What is the system, what are its layers/trust boundaries, where does a secret live at each point in its life |
| [`02_threat_model.md`](02_threat_model.md) | Who are the adversaries, what does FedOS defend against, what does it explicitly not attempt, what scenario tests already exist |
| [`03_review_order.md`](03_review_order.md) | Where should an external auditor's time go first, second, third |
| [`04_evidence_index.md`](04_evidence_index.md) | Every source *document* this bundle draws from — exact location, exact commit, merged/unmerged status |
| [`05_known_issues.md`](05_known_issues.md) | What is already known to be broken, incomplete, or deliberately out of scope — so a real finding can be told apart from a re-discovery |
| [`06_disclosure_policy.md`](06_disclosure_policy.md) | How to report a finding, what severity rubric to use, what is currently a placeholder awaiting a human decision |
| [`07_reproduction_guide.md`](07_reproduction_guide.md) | How to get a working build, run the real test suite, and reproduce every claim in this bundle from a clean checkout |
| [`08_version_manifest.md`](08_version_manifest.md) | Exact product/schema/toolchain version identity, source-of-truth file for each |
| [`09_commit_manifest.md`](09_commit_manifest.md) | Exact commit this addendum (`08`-`19`) describes, how it relates to `00`-`07`'s own one-commit-earlier cutoff, repo-wide commit/branch statistics |
| [`10_dependency_manifest.md`](10_dependency_manifest.md) | Every direct + resolved dependency, both npm projects and the Rust crate, with a real newly-closed open question (`@noble/curves` production usage) |
| [`11_build_manifest.md`](11_build_manifest.md) | Exactly which build steps were actually run this pass versus cited from a prior pass, and their real output |
| [`12_hashes.md`](12_hashes.md) | Every artifact hash this addendum independently, freshly reproduced — the WASM artifact (5th independent confirmation) and the Cargo dependency graph (2nd) |
| [`13_release_artifact_inventory.md`](13_release_artifact_inventory.md) | What the release pipeline produces, where it lands, what is and is not signed, and why signing/none exists today |
| [`14_sbom.md`](14_sbom.md) | A structured, manually-assembled Software Bill of Materials across all three package ecosystems (460 total resolved components) |
| [`15_license_inventory.md`](15_license_inventory.md) | Every dependency's license, and the one real gap: this project's own missing `LICENSE` declaration |
| [`16_third_party_inventory.md`](16_third_party_inventory.md) | Every third-party *service/runtime* (not code package) this product depends on at build or run time |
| [`17_crypto_inventory.md`](17_crypto_inventory.md) | Every cryptographic primitive and its exact production call site, including a second, previously-unlocated Schnorr implementation path |
| [`18_evidence_cross_reference.md`](18_evidence_cross_reference.md) | Every individual claim in `08`-`17`, mapped to the exact command/file that verifies it |
| [`19_reviewer_checklist.md`](19_reviewer_checklist.md) | The actionable, sign-off-ready checklist for whoever conducts the real engagement |

**Bundle completeness note**: documents `00`-`07` were assembled as one
pass (cutoff `master` @ `81305b37`); documents `08`-`19` were added as a
direct addendum, one commit later (`68e7be16` — a docs-only
consolidation landed in between; see
[`09_commit_manifest.md`](09_commit_manifest.md) for the full
reconciliation). Together, `00`-`19` are this bundle's full,
current scope.

## Top recommendations carried into this bundle (not acted on here — human decisions)

These are named consistently across multiple independent prior reviews and
are restated here, unchanged, as the highest-value actions before or during
an external audit. This bundle does not perform any of them — each requires
either a human decision this documentation cannot fabricate, or a merge
action outside this task's own scope (assembling this package).

1. **Merge the two orphaned audit-prep review commits into `master`** —
   `8e730f25` (base audit-prep package) and `6873d24f` (its delta). Both are
   docs-only, zero source change, zero risk, and this bundle already
   inlines their load-bearing content — but merging them would let a future
   reader reach the originals directly rather than through this bundle's
   synthesis. See Evidence Index for exact branches.
2. **Fill `SECURITY.md`'s vulnerability-reporting contact fields.** Currently
   an intentional placeholder (see [`06_disclosure_policy.md`](06_disclosure_policy.md)).
   This is the single most directly pilot-blocking gap named by the Closed
   Beta Operations and Audit Readiness review.
3. **Name the human roles** the Closed Beta Operations review left as
   placeholders: release approver, security reviewer, pilot coordinator,
   audit commissioner. Naming these resolves most of that review's
   remaining BLOCKED items.
4. **Decide the fate of the orphaned Sender-Key rotation prototype**
   (`rotateSenderKeyEpoch()`, Alpha 2121-2200 lineage, disclosed CSPRNG flaw,
   never merged, zero production callers) before any future Arc considers
   reviving it for real group messaging — see Known Issues item on Group
   Messaging.

Version rollback during a pilot is a separate, already-accepted structural
limitation (no committed `Cargo.lock`, no schema-migration code) — see
Known Issues; it is not on this recommendation list because it is not
closeable by documentation or a merge, only by future engineering work.
