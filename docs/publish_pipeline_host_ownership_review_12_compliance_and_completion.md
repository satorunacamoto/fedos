# 12 — Prohibition Compliance and Completion

## Prohibitions re-verified

- **`src` change**: zero. This review adds files under `docs/` and
  `test/` only. No file under `src/` is created, modified, or deleted.
- **README shared-location change**: zero. `README.md` is not touched
  by this review at all (unlike the prior, implementation-adjacent
  review Arcs, which updated its Status banner — this review's own
  instruction explicitly excludes README from what may change, so its
  findings live only in these docs and in the commit message).
- **`git add`/commit reaching another worktree**: this review was
  performed inside its own isolated worktree/branch
  (`worktree-publish-pipeline-host-ownership-review`) from the start.
  One process error occurred and was corrected before any commit: this
  review's first drafting pass wrote all 14 files into the MAIN
  worktree by mistake (an absolute-path error, not a `git` operation) —
  caught before any `git add`/commit touched them, and fixed by moving
  every file into the correct worktree directory; the main worktree's
  own `git status --porcelain` was re-confirmed clean (only the
  pre-existing untracked `p2p/`) immediately after. No commit in
  EITHER worktree ever referenced the mistakenly-placed files.
- **Publisher/Observation/Scheduler type change**: zero. No `src/`
  file is touched (see above), so no TYPE anywhere in
  `FedosBoardOutboxPublisher`/`FedosNostrBoardPublisher`/
  `FedosDeliveryObservation`/`FedosBoardOutboxObservation`/
  `FedosPublishScheduler` is redefined, renamed, or extended by this
  review. `test/publish_pipeline_host_ownership_review_compliance.test.ts`
  §4 re-confirms no design doc even PROPOSES such a change.
- **`p2p/`**: not referenced by this review's own recommended design
  in any of docs 01–11 (`test/publish_pipeline_host_ownership_review_compliance.test.ts`
  §3).
- **GUI**: not referenced by this review's own recommended design in
  any of docs 01–11 (same test, §3) — one earlier draft sentence in doc
  05 mentioned "GUI" only as an illustrative aside about a hypothetical
  future caller, not as part of the design; caught by this review's own
  compliance test and rewritten to name no UI layer at all.
- **Relay Pool**: not referenced by this review's own recommended
  design in any of docs 01–11 (same test, §3).
- **New Dependency**: `package.json` carries the same two production
  dependencies (`@noble/curves`, `@noble/hashes`) before and after this
  review — confirmed directly by parsing the manifest
  (`test/publish_pipeline_host_ownership_review_compliance.test.ts`
  §1), not merely by claiming no `npm install` was run.

## Verification

- `npm run typecheck` — see this review's own commit message for the
  exact run performed immediately before commit (this doc is written
  before that final run so it cannot honestly restate a result not yet
  observed).
- Review tests only:
  `npx vitest run test/publish_pipeline_host_ownership_review_*` — run
  and confirmed before this doc was finalized; see the commit message
  for the exact pass count. No other test file in this worktree is run
  or modified by this review.

## Completion summary

This review answers all twelve confirmation items against the
CURRENT, real, committed state of `FedosDesktopHost`,
`FedosPublishScheduler`, both Publisher implementations, and both
Observation vocabularies — not a hypothetical or previously-assumed
state (e.g. §2's own finding that "Outbox/Observation hydration" as a
distinct startup step does not correspond to any real operation with
today's backends; §3's own finding that no flush/await exists in the
current `stop()` at all; §9's own finding that no visibility field
exists anywhere in the canonical post model today). It recommends:
Host owns the Publisher registry, Scheduler, and Observation Repository
(injecting Publisher instances and the Repository, constructing the
Scheduler itself, mirroring the EXISTING `FedosBoardQuery` precedent);
explicit (never automatic) delivery start; a narrow
`startDelivery()`/`stopDelivery()`/`deliveryStatus()` facade (Option B)
over direct Scheduler/Publisher exposure; Host-fatal failures confined
to the EXISTING startup-hydration boundary, with every delivery-layer
failure degrading a separate, narrower status signal instead; and names
five future implementation Arc candidates with an explicit dependency
order, including two concrete, previously-unnamed production gaps this
review's own analysis surfaced (a Scheduler in-flight-`tick()` accessor
for clean shutdown, and a `retryIntent()` escape hatch for manual
retry) that no prior review had named.

## See also

- `docs/publish_pipeline_host_ownership_review_00_index.md`
- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
  through `docs/publish_pipeline_host_ownership_review_11_deliverables_and_dependency_order.md`
