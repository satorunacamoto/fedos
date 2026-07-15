# Secure Runtime Alpha 398 — Atomicity Verification

**Status: this Stage is verification only — it makes NO production
code change of any kind.** Stage 8 of the Alpha 391–400 Desktop Host
Durable Write Coordination Arc. Proves, by direct execution, every
failure shape Alpha 394 named: duplicate, conflict, exception,
Persistence failure, and (structurally) Repository failure — no
partial success, in any case.

## 1. Why now

Alpha 394 named the policy; Alpha 395 implemented it. This Stage is
the real-execution proof — matching this repository's own established
rhythm of a design Stage followed by a real-execution verification
Stage (Alpha 356 "Conflict Handling" verified Alpha 353/354's own
design the same way).

## 2. Duplicate — verified

Submitting the SAME `FedosBoardPost` twice: first call returns
`"inserted"`, second returns `"already-present"`. `FedosBoardPersistence.listPosts()`
contains exactly ONE record for that `id` afterward — no duplicate log
line (`AppendOnlyFedosBoardPersistence`'s own Alpha 354 "append
semantics": an `"already-present"` `putPost()` call writes nothing).
`host.query()` shows exactly one post, not two.

## 3. Conflict — verified

Submitting a DIFFERENT `FedosBoardPost` sharing the same `id` as an
already-submitted one: `submitPost()` returns `"post-id-conflict"`.
`FedosBoardPersistence.listPosts()` and `host.board()!.findPost(id)`
BOTH still show the ORIGINAL post, byte-for-byte, confirming the
rejected write touched neither.

## 4. Exception — verified

A `FedosBoardPersistence` fake whose `putPost()` THROWS (rather than
returning a token): `submitPost()`'s own thrown error propagates
UNMODIFIED out of `submitPost()` — confirmed by asserting the exact
thrown value's own identity is preserved, matching `start()`'s own
established "never swallow, never wrap" convention (Alpha 382).
`host.state()` remains `"ready"` afterward (Alpha 394 §5's own explicit
decision) — the Host itself is fully usable for a SUBSEQUENT,
non-throwing `submitPost()` call, verified in the same test.

## 5. Persistence failure — verified

A REAL `AppendOnlyFedosBoardPersistence` pointed at a path whose parent
directory does not exist (the SAME technique Alpha 356's own test
suite already established): `submitPost()` returns
`"persistence-failed"`. `host.board()!.findPost(id)` returns `null`
afterward — Repository was never reached, confirming step 3 (Alpha
393) genuinely never runs when step 2 fails.

## 6. Repository failure after a successful Persistence write — structurally unreachable, confirmed by exhaustive case analysis

Alpha 394 §1 already argued this case cannot occur because
`previewRegistration()` (step 1) predicts `registerPost()`'s (step 3)
own outcome exactly, with no intervening mutation possible in this
repository's synchronous execution model. This Stage does not attempt
to force this case with an artificial fake — doing so would require
either monkey-patching `FedosBoardService` internals (piercing its own
private `#repository`/`#sourceIndex` fields, which no test anywhere in
this repository does) or introducing genuine concurrency (which this
repository's entire write path structurally excludes, Alpha 393 §2).
Forcing an admittedly-unreachable code path with an artificial seam
would not verify anything about `submitPost()`'s own real behavior —
it would only verify the defensive `throw` statement exists, which
direct source inspection already confirms (§7 below) more honestly
than a contrived test could.

## 7. Structural confirmation of the defensive guard

Direct inspection of `fedos_desktop_host.ts` confirms the invariant
check exists exactly once, immediately after the Repository call, and
throws rather than returning a token or silently proceeding — "never
silently repair" (this Arc's own Absolute Prohibition), applied to a
case that provably cannot occur today, kept as a guard against a
FUTURE change silently breaking the step-1/step-3 correspondence.

## 8. No partial success, confirmed across every case above

In EVERY case (§2–§6), after a rejected/failed `submitPost()` call,
`FedosBoardPersistence.listPosts()` and `host.board()!.findPost(id)`/
`host.query()!.recentFeed(...)` agree with each other exactly — never
a state where Persistence has a record Repository/Query does not, or
vice versa, for that specific rejected `id`.

## 9. Conclusion

Every failure shape this Arc's own instruction names is verified by
direct execution: duplicate and conflict behave exactly like the
pre-existing `FedosBoardPersistence`/`FedosBoardRepository` conventions
they reuse; a thrown exception propagates unmodified with no Host-state
side effect; a returned Persistence failure token stops the write
before Repository is ever reached; and the one theoretically-possible
partial-success shape is confirmed structurally unreachable rather than
force-tested through an artificial seam.

## 10. See also

- `docs/secure_runtime_alpha_394_write_failure_policy.md`
- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`
- `docs/secure_runtime_alpha_356_conflict_handling.md`
- `docs/secure_runtime_alpha_382_host_startup_failure_closure.md`
