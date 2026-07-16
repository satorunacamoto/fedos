# Secure Runtime Alpha 738 — Compatibility and Ripple Review

Stage 18. Reviewed the Alpha 451–720 test/doc surface most plausibly
affected by this Arc's own change (the Nostr publish/Scheduler/Observation
chain).

## Finding: zero ripple required

A rigorous `git stash`-based before/after diff of the FULL test suite
(this worktree's own true baseline vs. this Arc's final state) found
**zero new test failures** beyond the three pre-existing, expected "live
`git status`" checks (`secure_runtime_alpha_531/532/539`, which flag any
Arc's own uncommitted diff under `src/board/` until its final commit
lands — not a defect, self-resolving after commit, identical to the
prior Arc's own experience).

This is a direct, structural consequence of this Arc's own design
decision (Alpha 723): every existing, frozen contract
(`FedosNostrBoardPublisher`, `FedosRelayNostrBoardPublisher`,
`FedosNostrBoardPublisherAdapter`, `nostrPublishOneResultToOutboundPublishResult`,
`FedosPublishScheduler`, the Observation vocabulary/transition graph, the
Retry Registry, the Abandonment Policy) was left BYTE-FOR-BYTE unchanged.
`FedosRelayOkCorrelatedNostrBoardPublisher` (this Arc's own prior-Arc
file) was extended additively (a new method sharing the existing
correlation logic), never redesigned. Two entirely new files
(`fedos_nostr_board_publisher_with_outcome.ts`,
`fedos_outcome_aware_nostr_board_publisher_adapter.ts`) carry all of this
Arc's new capability.

## Historical facts preserved, durable invariant added

No historical Stage's own recorded fact (e.g. Alpha 497's own doc
recording "no OK-correlation mechanism anywhere," accurate for its own
time; Alpha 710/711's own doc recording "this class does NOT surface a
separate rejected outcome through `publishOne()`'s own boolean return,"
still accurate for THAT specific method) was edited or invalidated — each
remains true of the SPECIFIC contract it describes. This Arc's own new
durable invariant ("a genuine Relay rejection reaches `FedosOutboundPublishResult`
as `'rejected'`, and is never automatically retried") is asserted through
NEW files and NEW tests, layered alongside the old ones, not by loosening
any existing regex or assertion.

No existing structural regex was loosened; no code search in this Arc's
own new tests was written to match inside prose/doc comments (each new
structural check in
`test/secure_runtime_alpha_733_scheduler_and_runtime_compatibility.test.ts`
scopes its own pattern to `import` lines specifically, learning from the
prior Arc's own "own doc comment tripped its own guard" incidents).
