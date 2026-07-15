# Secure Runtime Alpha 393 — Write Transaction Order

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 3 of the Alpha 391–400 Desktop Host Durable Write
Coordination Arc. Fixes the exact step order `submitPost()` (Alpha
395) implements.

## 1. Why now

Alpha 392 decided the Host coordinates writes directly. Before writing
that coordination code, this Stage fixes the EXACT order of steps —
Alpha 391 §5 already confirmed `FedosBoardPersistence` has no delete
method, which makes step ORDER a correctness question, not a style
preference.

## 2. Candidate orders reviewed

- **Repository first, Persistence second.** Rejected. A post accepted
  into `FedosBoardService`'s in-memory Repository is IMMEDIATELY
  visible via `query()` (Alpha 391 §6) — if the subsequent Persistence
  write then fails, the caller has already observed a post that a
  restart will silently make disappear. This is the exact
  memory-only-write gap Alpha 367/389/390 already named as a problem;
  reordering the two steps this way would not fix it, it would just
  make it briefly LOOK fixed until the next restart.
- **Persistence first, Repository second.** Adopted (§3 below).
- **Both concurrently / "best effort".** Rejected outright — this
  repository's entire persistence layer (Alpha 315 §"Synchronous")
  and Repository layer (Alpha 302 §"Synchronous") are synchronous by
  contract; introducing concurrency here would require changing
  BOTH already-frozen ports, explicitly out of scope ("This Arc MUST
  NOT implement: ... Storage redesign").

## 3. Adopted order

```
Validate
    ↓
Persistence
    ↓
Repository
    ↓
Query visibility
    ↓
Success
```

1. **Validate** — `FedosBoardService.previewRegistration(post)` (Alpha
   395's own new pure-read method on `FedosBoardService`, added because
   no existing public method exposes enough of `FedosBoardService`'s
   own internal state — specifically `#sourceIndex`'s source-conflict
   check — for the Host to predict acceptance from outside).
   `previewRegistration()` returns `null` when `post` would be
   accepted, or the exact `FedosBoardRegistrationResult` rejection
   token otherwise. See §4 for why this step is NOT optional.
2. **Persistence** — `FedosBoardPersistence.putPost()`, the FIRST
   mutating call. Runs ONLY if step 1 returned `null`.
3. **Repository** — `FedosBoardService.registerPost()`, runs ONLY if
   step 2 returned `"inserted"` or `"already-present"`.
4. **Query visibility** — NOT a distinct call. `FedosBoardQuery`
   (constructed once, in `start()`, over the SAME `#boardService`
   instance) observes step 3's own mutation the moment it returns —
   confirmed structurally by Alpha 391 §6, verified behaviorally by
   Alpha 396.
5. **Success** — the token `registerPost()` itself returned
   (`"inserted"` or `"already-present"`) is `submitPost()`'s own
   return value.

## 4. Why Persistence must precede Repository, precisely

Persistence has no delete method (Alpha 391 §5). This makes the two
possible orderings NOT symmetric:

- **If Repository (step 3) fails AFTER Persistence (step 2) already
  succeeded:** the post is durable but not yet visible this session.
  Recoverable — the NEXT `hydrateFedosBoardService()` call (a fresh
  `start()`) replays `#boardPersistence.listPosts()` and re-registers
  the post into a fresh Repository. No data lost, ever.
- **If Persistence (step 2) fails AFTER Repository (step 3) already
  succeeded (the REJECTED ordering):** the post is visible via
  `query()` this session but is NEVER durable. A restart loses it
  silently — no error, no warning, nothing tells the caller. Worse:
  since Persistence cannot be un-written, a Repository-then-Persistence
  order gives NO WAY to undo the visible-but-not-durable state either.

Persistence-first is therefore not a stylistic choice — it is the
ONLY order under which every reachable failure remains recoverable by
a future restart rather than a silent, permanent, undetectable loss.

## 5. Why step 1 (Validate) must be genuine, not a state check

A shallower design might treat "Validate" as merely confirming
`host.state() === "ready"`, deferring all DOMAIN validation
(thread integrity, source conflict, post-id conflict) to step 3. This
was considered and rejected: if a domain-invalid post (for example,
one with `replyTo` pointing at a genuinely nonexistent parent) is
written to Persistence in step 2 and THEN rejected by Repository in
step 3, the post is now permanently stuck in the durable log with no
delete path. On the NEXT `hydrateFedosBoardService()` call,
`registerPostsInDependencyOrder()` (`src/board/persistence/fedos_board_hydration.ts`,
Alpha 318, unmodified) treats ANY non-`"inserted"`/`"already-present"`
result as contributing to `unresolvedCount`; if `unresolvedCount > 0`
after the bounded topological pass converges, hydration returns
`"rejected-unresolvable-thread-integrity"` with `service: null` —
which makes `FedosDesktopHost.start()` itself throw (Alpha 382,
unmodified), for EVERY future restart against that log, permanently.
One bad write would brick the Host forever. Step 1 exists specifically
to make this unreachable: `previewRegistration()` runs the SAME checks
`registerPost()` itself would run, as pure reads, so nothing that
would be rejected in step 3 is ever allowed to reach step 2.

## 6. Consistency guarantee this order produces

Because step 1 predicts step 3's own outcome exactly, and this
repository's entire write path is synchronous with no `await` between
steps 1 and 3 (JavaScript's single-threaded execution model — no other
code can run and mutate `#boardService` in between), "Repository
succeeds, Persistence fails" and "Persistence succeeds, Repository
fails for a reason step 1 should have caught" are BOTH structurally
unreachable, not merely handled by a recovery path. Alpha 394 names
the remaining reachable failure shapes precisely.

## 7. Conclusion

`Validate → Persistence → Repository → Query visibility → Success`,
with Validate implemented as a genuine pure-read prediction rather than
a state check, is the only order reviewed that keeps every reachable
failure recoverable by a future restart and makes the two dangerous
partial-success interleavings structurally impossible rather than
merely rare.

## 8. See also

- `docs/secure_runtime_alpha_392_write_coordination_ownership_decision.md`
- `docs/secure_runtime_alpha_391_desktop_host_write_coordination_inventory.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
