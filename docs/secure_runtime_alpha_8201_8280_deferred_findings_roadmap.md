# Secure Runtime Alpha 8201-8280 — Deferred Findings Roadmap

Reconciles four parallel, read-only reviews against this Arc's own landed
work (master `d8387b71`). Per this Arc's own instructions: **nothing
below was implemented.** Two small, verified, closed-beta-relevant
documentation gaps these reviews found were folded directly into
`SECURITY.md` and `docs/desktop_beta_known_limitations.md` (see those
files' own change history); everything else is recorded here as future
work, explicitly not attempted in this Arc. No review branch was merged.

Reviewed:

- **B** — `review/fedos-dead-runtime-production-path-v1` (`ad3c400e`)
- **C** — `review/fedos-technical-debt-performance-v1` (`1e4d68d4`)
- **D** — `review/fedos-original-vision-expected-behavior-v2` (`09140dd5`)
- **E** — `review/fedos-closed-beta-operations-audit-readiness-v1` (`600157b9`)

All four branched from `739fb3e8` (this Arc's own starting point) and
therefore never saw this Arc's changes. Where a finding is now stale
because of this Arc's own work, that is noted explicitly below — the
review documents themselves are unmodified (not this Arc's branches to
edit).

## Findings now stale (already resolved by this Arc — no action needed)

- **B, C:** "Device Pairing UI: renderer has zero calls to the four
  pairing methods" / "Devices screen... no create-offer/accept-offer
  control." Resolved — see `docs/desktop_beta_known_limitations.md` item
  17.
- **C's own "Recommended next Arc B"** ("renderer screen driving the
  already-exposed `devicePairingCreate/Inspect/Approve/Complete`
  bridge") is now half-done — the Device Pairing UI half is complete;
  the Group Messaging UI half remains correctly NOT done (see item 19,
  deliberate).
- **D:** "README never got a status blurb for the newest landed Arc."
  Superseded — this Arc rewrote `README.md`'s own opening substantially
  (see the "Original project vision" section it added).
- **E:** its own reconciliation table's "Device Pairing: backend exists,
  no confirmed complete workflow — unchanged" line is now false on
  master; not fixable by this Arc since it lives on review E's own
  unmerged branch, noted here only for whoever next reconciles that
  branch.

## Findings folded into this Arc's own docs (implemented, doc-only)

- **D:** `SECURITY.md` was silent on Relay/network-observer metadata
  correlation (who messages whom, when) despite this being the largest
  gap between the project's original privacy ambition and current
  reality. Added a disclosure bullet to `SECURITY.md`.
- **D:** the orphaned Sender-Key prototype (Alpha 2121-2200, `01fef390`,
  continued through `41da82d9`) is more developed than "a design review,
  never adopted" — added a correction/nuance to
  `docs/desktop_beta_known_limitations.md` item 19 (Group Messaging).
- **E:** version rollback during the pilot is blocked by a real
  structural fact (no committed `Cargo.lock`, no schema-migration code),
  not a process gap — added as `docs/desktop_beta_known_limitations.md`
  item 20.

## Deferred — engineering/architecture (from review B)

Not implemented; explicitly recommended by the review itself as future,
separately-scoped work, and this Arc's own mission forbids protocol/
Rust changes and broad refactors:

1. Narrow-blast-radius cleanup: remove the redundant, zero-external-reader
   `assembleFedosConversationProductionCryptoGraph()` /
   `FedosWasmLoaderSkeleton` call in `fedos_desktop_runtime.ts:898` (dead
   at runtime, executes on every startup with no observable effect).
2. A product decision (not a code decision) on `src/worker.ts`'s
   Cloudflare Worker fate — restore a real deploy path, or formally
   archive it.
3. Narrowing `FedosDesktopHost`'s dependency on `DesktopApplication` /
   evaluating removal of the Board-era `src/desktop/desktop_application.ts`
   tree — gated on (2).
4. Renaming `package.json`'s `"name"` (`"nostr-window"`) and the
   `packages/fedos-desktop-electron-spike` package scope — real,
   mechanical, but a breaking change requiring its own dedicated Arc.
5. **Explicitly recommended AGAINST:** deleting `create_runtime.ts` /
   `AppRuntime` / the Planning-era crypto chain. Review B's own
   conclusion, which this Arc did not revisit: a narrow
   naming/discoverability fix, not deletion.

## Deferred — performance/persistence (from review C)

No P0 found by the review; all P1-P3, forward-looking. Not implemented —
this Arc's own mission is UI/product-gap closure, not backend
performance work:

- **Recommended next Arc A** — Append-Only Persistence Index Backport +
  Pagination (the `#ensureIndex()` pattern already proven in one backend,
  `AppendOnlyFedosDeliveryObservationPersistence`, ported to the other
  ~52 append-only backends repo-wide; measured real cost 8.35/95.62/
  648.32ms per full replay at n=1k/10k/100k).
- **Recommended next Arc C** — Crash-Safe Append-Only Recovery + Recovery
  Screen Completion (an append-only backend that crash-brick-on-corruption
  is a real P1, and the Recovery screen has no real "restore from
  Archive" action despite its own copy implying otherwise — this Arc
  fixed the copy's overclaim, not the underlying capability gap).
- Duplicate-code map (22 Conversation-domain copies + Board/Device/Relay
  equivalents) and general test/environment-artifact debt — cleanup-class,
  not urgent.

## Deferred — vision/positioning (from review D)

- `SECURITY.md` line 19's "Group messaging... not implemented" wording
  could read as implying nothing exists, when a real 21-file local
  pairwise-fanout backend does. Flagged by the review as "low-priority
  wording tightening, not a correction" — not changed this Arc; a future
  documentation pass can tighten it alongside the roadmap items above.
- Full `package.json`/package-scope migration from `nostr-window` to a
  FedOS-branded name (see review B's own item 4 above — same
  finding, independently reached by both reviews).

## Deferred — pilot operations and audit readiness (from review E)

None of the following are code fixes; none are attempted here:

- **Do NOT auto-merge:** the review recommends merging two OTHER
  already-existing, already-reviewed, docs-only commits
  (`8e730f25` — external security audit preparation package; `6873d24f`
  — its Alpha 8041-8120 delta) from their own separate unmerged review
  branches into master. This Arc's own instructions are explicit: do not
  merge other sessions' branches automatically. Left for a human
  decision or a future integration Arc.
- Building the actual pilot operational package this review's docs
  describe in the abstract (participant consent/eligibility text,
  feedback/bug/security-report templates, diagnostic collection
  tooling, incident severity triage automation) — all named as
  "READY WITH HUMAN INPUT" by the review itself (names, dates, vendor
  choices this Arc cannot fabricate), not technical gaps.
- `SECURITY.md`'s vulnerability-reporting contact fields remain an
  intentional placeholder (unchanged this Arc) — filling them requires a
  real contact channel a human must designate, not invented content.
- The review's own readiness-matrix tally (15/9/6/9/1) does not
  reconcile against its own itemized 45-row table (actual: 17 READY + 3
  READY-channel-BLOCKED + 10 TECHNICAL FIX + 6 HUMAN INPUT + 8 BLOCKED +
  1 NOT REQUIRED = 45); noted here for whoever next works from that
  review, not fixed (not this Arc's branch to edit).

## Recommended next action (unchanged from this Arc's own Completion Declaration)

Run the Closed Beta pilot and commission an independent security audit.
Before doing either, a human should decide: (1) whether to merge
`8e730f25`/`6873d24f` into master, (2) who owns the pilot's human-input
operational items (E's BLOCKED list), (3) whether the Sender-Key
prototype's CSPRNG flaw makes it worth reviving for a future Arc or
whether MLS/a different approach is preferred for real group messaging.
