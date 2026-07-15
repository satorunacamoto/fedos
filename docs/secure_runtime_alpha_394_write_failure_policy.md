# Secure Runtime Alpha 394 — Write Failure Policy

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 4 of the Alpha 391–400 Desktop Host Durable Write
Coordination Arc. Names, for every failure shape this Arc's own
instruction lists, exactly what `submitPost()` (Alpha 395) does — no
silent repair, no invented recovery, fail closed always.

## 1. "Persistence succeeds, Repository fails"

**Structurally unreachable**, by the Alpha 393 order combined with
Alpha 395's own step 1 (`previewRegistration()`). Step 1 predicts
step 3's own outcome as a pure read; nothing runs between steps 1 and
3 that could invalidate that prediction (JavaScript's synchronous,
single-threaded execution model — no `await`, no other code path,
between the two). `submitPost()` still contains a defensive check
after step 3 (`registerResult !== "inserted" && registerResult !==
"already-present"`) — if this ever DID fire, it would mean step 1's
own prediction was wrong, which `submitPost()` treats as a fail-closed
invariant violation: it **throws**, rather than silently discarding
the mismatch or attempting to "fix" `#boardService`'s state. This is
never expected to fire in this repository as it exists today; it
exists so a future change that breaks the step-1/step-3 correspondence
fails LOUDLY instead of silently corrupting Repository/Persistence
consistency.

## 2. "Repository succeeds, Persistence fails"

**Structurally unreachable**, by construction — Persistence is step 2,
Repository is step 3 (Alpha 393). `submitPost()` returns immediately
after a failed/conflicting Persistence write (`"persistence-failed"`
or `"post-id-conflict"`) and NEVER calls `FedosBoardService.registerPost()`
in that case. Repository is never even attempted.

## 3. "Duplicate"

A post submitted twice, byte-for-byte identical: step 1
(`previewRegistration()`) finds the existing record structurally equal
via `fedosBoardPostsAreStructurallyEqual` (Alpha 302, unmodified) and
returns `null` (would be accepted) both times. Step 2
(`FedosBoardPersistence.putPost()`) returns `"already-present"` the
second time — its own pre-existing idempotent semantics (Alpha 315),
unmodified, nothing written to disk. Step 3
(`FedosBoardService.registerPost()`) likewise returns
`"already-present"` the second time. `submitPost()` returns
`"already-present"` — never an error, never a duplicate log line,
never a duplicate index entry (verified by Alpha 398).

## 4. "Conflict"

A post submitted with the SAME `id` as an existing, DIFFERENT post:
step 1 detects this via the SAME structural-equality check and returns
`"post-id-conflict"` immediately — Persistence and Repository are
BOTH left completely untouched. The original record, in both
Persistence and Repository, is preserved unmodified — matching this
repository's own established "fail closed, the original is preserved"
convention (Alpha 302 §"conflict", Alpha 315 §"conflict", both
unmodified, both still true after this Arc).

## 5. "Unexpected exception"

If `FedosBoardPersistence.putPost()` itself THROWS (rather than
returning a token — not reachable with either
`InMemoryFedosBoardPersistence` or `AppendOnlyFedosBoardPersistence`
today, both of which only ever return tokens, but not ruled out for a
FUTURE backend, exactly the same caveat Alpha 353's own header already
carries for `listPosts()`), `submitPost()` does **not** catch it. The
exception propagates out of `submitPost()` unmodified — fail closed,
matching `start()`'s own "never swallow the caught value" convention
(Alpha 382), applied here by NOT catching at all rather than
catching-and-rethrowing, since no cleanup is needed: step 3
(Repository) is never reached if step 2 throws, so no partial mutation
exists to undo. `host.state()` is deliberately left **unchanged**
(still `"ready"`) after a `submitPost()` exception — a single failed
write is a per-call outcome, not a Host-lifecycle event; forcing the
whole Host to `"failed"` over one rejected write would be inventing a
NEW recovery/failure semantic this Arc's own instruction never asks
for, and would make every subsequent legitimate write on the SAME Host
instance impossible for a cause unrelated to them.

## 6. "Persistence failure" (a returned `"failed"` token, not a throw)

`AppendOnlyFedosBoardPersistence.putPost()` can genuinely return
`"failed"` (Alpha 356, e.g. a missing parent directory) — REACHABLE
today, unlike §5. `submitPost()` maps this to `"persistence-failed"`
(Alpha 395's own one new token, `FedosDesktopHostSubmitPostResult`) and
returns immediately — Repository (step 3) is never reached. No log
line is written for a `"failed"` result (`AppendOnlyFedosBoardPersistence`'s
own Alpha 354 "append semantics": a non-`"inserted"` outcome writes
nothing).

## 7. "Repository failure" (a returned `"conflict"`/rejection token from `registerPost()`)

Already covered structurally by §1 above — step 1 prevents this from
ever reaching step 3 with a DIFFERENT outcome. If a caller instead
means "what if the domain-level Repository check itself rejects a
post" (i.e. `"missing-parent"`/`"invalid-thread"`/`"cross-board-reply"`/
`"source-conflict"`/`"post-id-conflict"`) — this is handled entirely at
step 1: `previewRegistration()` returns the exact rejection token,
`submitPost()` returns it immediately, and NEITHER Persistence NOR
Repository is ever touched. This is the common, expected, everyday
rejection path — not a Host-level failure of any kind, exactly
mirroring `FedosBoardService.registerPost()`'s own long-established
"no exceptions for normal rejection" convention (Alpha 307).

## 8. What this Stage explicitly declines to add

- **No automatic retry** of a failed `submitPost()` call — a caller
  that wants to retry a `"persistence-failed"` write must call
  `submitPost()` again itself.
- **No transaction rollback mechanism** — none is needed; §1/§2 show
  the two dangerous partial-success shapes are unreachable by
  ORDERING, not by a rollback that undoes a completed step.
- **No new Host state** (`"write-failed"` or similar) — `state()`
  (Alpha 333, unmodified) still only ever reports Host lifecycle, never
  per-write outcomes.
- **No closing of the residual `board()` bypass** named in Alpha 392
  §5 — a caller that ignores `submitPost()` and calls
  `board()!.registerPost()` directly still reproduces the ORIGINAL
  memory-only-write gap (Alpha 367/389/390) exactly as before. This
  Arc adds a correct write path; it does not remove the old one, per
  Alpha 391 §8 and Alpha 392 §5.

## 9. Conclusion

Every failure shape this Arc's own instruction names is either made
structurally unreachable by the Alpha 393 order (§1/§2), handled as an
established idempotent/fail-closed token (§3/§4/§6/§7), or propagated
unmodified with no Host-state side effect (§5). No case is silently
repaired; no case invents a new recovery mechanism. Alpha 398 verifies
every reachable case by direct execution.

## 10. See also

- `docs/secure_runtime_alpha_393_write_transaction_order.md`
- `docs/secure_runtime_alpha_392_write_coordination_ownership_decision.md`
- `docs/secure_runtime_alpha_356_conflict_handling.md`
- `docs/secure_runtime_alpha_382_host_startup_failure_closure.md`
