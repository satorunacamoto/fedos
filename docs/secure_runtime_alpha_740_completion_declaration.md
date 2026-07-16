# Secure Runtime Alpha 740 — Completion Declaration

Stage 20 — the final gate of the Alpha 721–740 Nostr Relay ACK Semantics
& Permanent Rejection Arc.

## Declared complete, proven by real execution

- **Honest Relay ACK correlation** — unchanged from Alpha 710/711
  (already correct), now exposed through a canonical, three-way result.
- **Permanent rejection semantics** — a genuine `accepted: false` OK now
  produces `{ outcome: "rejected", ... }`, mapped to a terminal
  `"rejected"` Observation, never retried (Alpha 736, the headline
  criterion, proven with real Scheduler ticks and a real runtime
  restart).
- **Canonical Publisher result** — `FedosOutboundPublishResult` (Alpha
  492, reused verbatim, no new type) now reaches the Scheduler directly
  via `FedosOutcomeAwareNostrBoardPublisherAdapter`, with no lossy
  boolean intermediate step.
- **Rejected terminal Observation** — confirmed via the pre-existing,
  unchanged transition graph and `FedosDeliveryRetryQuery`.
- **No retry after Relay rejection** — confirmed across ~15 Scheduler
  ticks (Alpha 736) and across a full runtime restart.
- **Transient failure still retryable** — timeout, disconnect, socket
  throw, signer unavailable, and malformed-event-mapping all still
  produce `"failed"`, still subject to the existing, unchanged retry/
  abandonment policy (Alpha 737).
- **Listener/timer cleanup** — verified directly, 10 dedicated tests
  (Alpha 730), including fake-timer-based timeout-cancellation
  verification.
- **Reconnect/stale-socket safety** — a superseded Publisher/Relay
  generation's own late callback cannot resolve a different generation's
  live publish (Alpha 732).
- **Scheduler protocol neutrality** — `FedosPublishScheduler`'s own
  source contains no Nostr import, confirmed structurally; the file was
  not modified by this Arc at all.
- **Restart-stable terminal behavior** — proven for accepted (Alpha 735)
  and rejected (Alpha 736) alike.

## Still out of scope (unchanged)

Relay Pool; multi-relay result aggregation; manual resend of rejected
events; a protocol-specific reason taxonomy (Alpha 726: no classifier was
introduced without a real consumer); ActivityPub/AT Protocol/Session
outbound; private conversations; GUI; Worker; Ontology; AI.

## Verification summary

- `npm run typecheck`: clean except one pre-existing, unrelated failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
  already broken on the base commit before this Arc).
- `npm test`: a rigorous `git stash`-based before/after diff of the full
  suite (854 test files; 8 new this Arc:
  `test/secure_runtime_alpha_730/731/732/733/736/737/739_*.test.ts`)
  confirms **zero new regressions** — the only differences between the
  true baseline and the final run are the three pre-existing, expected
  live-`git-status` checks (`secure_runtime_alpha_531/532/539`), which
  necessarily flag this Arc's own in-progress, not-yet-committed diff
  under `src/board/` until the final commit lands, exactly as they did
  for the prior Arc's own WIP state.
- **Rust unchanged** — confirmed via `git diff --stat packages/fedos-core-rust/`
  (empty). Per this Arc's own explicit instruction, `cargo` was
  therefore never run.
- `package.json`/`Cargo.toml` unchanged — confirmed via `git diff --stat`
  (both empty). No new dependency of any kind.
- `p2p/` untouched — this dedicated worktree does not contain it at all
  (it is untracked, local-only content in the main worktree, never
  committed to any branch this worktree was created from) — the main
  worktree itself was never touched.
- No `dist/`/temporary build artifact was ever created this Arc (no Rust/
  WASM rebuild was needed).

## Recommended next Arc

**Canonical Conversation Foundation Package A Arc** — the task's own
preferred recommendation. With Nostr identity binding (Alpha 681–720) and
honest, permanently-terminal delivery semantics (Alpha 721–740) both now
real and verified, the next productive direction is the Conversation
model itself (private-group/direct policy foundations), rather than
further hardening an already-correct outbound pipeline.
