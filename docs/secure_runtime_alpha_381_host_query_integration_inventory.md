# Secure Runtime Alpha 381 — Existing Host and Query Integration Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 381–390
Canonical Board Query Host Integration & Startup Failure Closure Arc,
following exactly the pattern every prior Arc's own opening Stage
already used.

## 1. Why now

Alpha 380 closed the Canonical Board Query Foundation Arc with two
named gaps: `FedosBoardQuery` has no real caller, and the
`FedosDesktopHost.start()` hydration-exception defect (first confirmed
in Alpha 361, Arc 361–370) remains unfixed. This Arc closes both.
Before writing a line of code, this Stage inspects the ACTUAL current
source of every file this Arc touches or depends on.

## 2. Current Host fields and public methods (Question 1)

`src/desktop/host/fedos_desktop_host.ts`, confirmed unchanged since
Alpha 337 (Arc 331–340): private fields `#desktopApplication`
(`readonly`), `#boardPersistence` (`readonly`), `#state`
(`FedosDesktopHostState`, initial `"constructed"`), `#boardService`
(`FedosBoardService | null`, initial `null`). Public methods:
`state()`, `start()`, `stop()`, `desktop()`, `board()`. No `query()`
method exists yet — this is the exact gap Alpha 383/384 close.

## 3. Exact location of the hydration-exception defect (Question 2)

`start()`'s own body, confirmed by direct execution (not merely code
reading): the hydration call,
`const hydration = hydrateFedosBoardService(this.#boardPersistence);`,
sits OUTSIDE any `try`/`catch` block. A RETURNED non-`"hydrated"`
outcome is handled by an explicit `if` check that itself sets
`state → "failed"` and throws — correct. But if
`hydrateFedosBoardService`'s own call to `persistence.listPosts()`
THROWS (rather than returning), nothing catches it: the exception
propagates directly out of `start()` (so the returned `Promise`
correctly rejects) WITHOUT the preceding `this.#state = "failed";`
line ever running — `#state` is left at `"starting"`, permanently,
confirmed by direct execution against a real
`AppendOnlyFedosBoardPersistence` pointed at a log containing a
malformed trailing line.

## 4. Which exceptions can escape hydration (Question 3)

Any exception `#boardPersistence.listPosts()` itself throws —
confirmed, by Alpha 357 (Arc 351–360), to include: a non-empty line
that fails `JSON.parse` (a truncated write or any other malformed
line), and two lines sharing the same `id` with different content (a
conflicting duplicate). `InMemoryFedosBoardPersistence.listPosts()`
can never throw (a `Map` read cannot fail) — confirming this defect
was unreachable before a real, throwing backend
(`AppendOnlyFedosBoardPersistence`, Alpha 353) existed to prove it.

## 5. Whether DesktopApplication.start() may throw/reject (Question 4)

**Yes, confirmed unchanged.** `DesktopApplication.start()` (Alpha
136) calls `bootstrap()` then `refreshPublicIdentity()`; the latter
delegates to the injected `FedosPublicIdentityReader.readPublicIdentity()`,
which a caller may supply as a throwing implementation (exactly as
this Arc's own test suite, and Alpha 339's before it, already does).
This path is ALREADY correctly handled today — Alpha 335's own inner
`try`/`catch` around this ONE call already sets `state → "failed"`
and rethrows. This Arc's own restructuring (Alpha 382) preserves this
behavior exactly, folding it into the SAME single `try`/`catch` every
other failure now shares.

## 6. Whether Query can be constructed solely from FedosBoardService (Question 5)

**Yes, confirmed by direct inspection.** `FedosBoardQuery`'s own
constructor (`src/board/query/fedos_board_query.ts`, Alpha 373)
accepts exactly one `FedosBoardQuerySource` — a two-method structural
interface (`listBoardPosts`/`listThreadPosts`) `FedosBoardService`
(Alpha 307) already satisfies verbatim, with no adapter, no explicit
`implements`, no additional dependency.

## 7. Whether Query requires mutation rights (Question 6)

**No.** `FedosBoardQuery`'s own entire public surface —
`recentFeed()`, `thread()` — is confirmed, by direct inspection of
`src/board/query/fedos_board_query.ts` and
`fedos_board_query_types.ts`, to contain ZERO mutating method. This
directly resolves Alpha 384's own stated condition ("If Query has any
mutating method, Option A must be rejected") — Option A is not
rejected.

## 8. Whether any real Host caller currently uses board() (Question 7)

**No.** Confirmed by direct search: every reference to
`FedosDesktopHost`/`createFedosDesktopHost`/`.board()` anywhere in
`test/*.test.ts` (Alpha 331–380's own combined test suite) is a TEST
constructing its own Host instance directly — `src/worker.ts` and
every file under `src/runtime/`/`src/identity/` carry zero reference
to `FedosDesktopHost` of any kind, confirmed unchanged since Alpha
341 §3 first found this.

## 9. Whether exposing BoardService remains necessary after Query integration (Question 8)

**Yes.** `FedosBoardQuery` is READ-ONLY (§7) — it has no
`registerPost()`/write method of any kind. `board()` remains the ONLY
Host-level path to `FedosBoardService.registerPost()`, the canonical
WRITE boundary. Removing `board()` after adding `query()` would
remove ALL write capability through the Host — Alpha 385 freezes this
distinction formally.

## 10. Expected ripple scope (Question 9)

Confirmed, by direct inspection of every file that imports
`fedos_desktop_host.ts` or asserts against its own raw source
(`?raw` imports across `test/secure_runtime_alpha_33*`/`35*`/`36*`/`37*`):
changing `start()`'s own internal structure (Alpha 382/383) requires
updating exactly THREE existing structural-regression tests that
assert the OLD internal statement adjacency
(`test/secure_runtime_alpha_335_board_hydration_ownership.test.ts`
§7) and TWO existing behavioral-regression tests that intentionally
reproduced the NOW-FIXED defect as a "confirmed limitation"
(`test/secure_runtime_alpha_360_...test.ts` §8,
`test/secure_runtime_alpha_361_...test.ts` §4, and
`test/secure_runtime_alpha_370_...test.ts` §5) — all five updated by
this Arc to assert the CORRECT, FIXED behavior, with an explicit
comment noting which Arc closed the original gap. No other file
requires modification.

## 11. Whether any public-interface change can remain additive (Question 10)

**Yes.** `query(): FedosBoardQuery | null` is a NEW public method,
added alongside `state()`/`start()`/`stop()`/`desktop()`/`board()` —
every EXISTING method's own signature is unchanged. `start()`'s own
signature (`(): Promise<void>`) and `stop()`'s own signature are both
unchanged — only their INTERNAL structure changes. This satisfies
"no public API removal" and "preserve every public interface"
simultaneously with closing the defect and adding Query ownership.

## 12. Conclusion

The hydration-exception defect is precisely located (§3), its
reachable exception set is precisely bounded (§4), `FedosBoardQuery`
is confirmed read-only and constructible solely from
`FedosBoardService` (§6/§7), `board()` remains necessary as the write
boundary (§9), and the full ripple scope is exactly five existing
test files (§10) — no other file in this repository requires
modification to implement Alpha 382–386.

## 13. See also

- `docs/secure_runtime_alpha_380_query_foundation_completion.md`
- `docs/secure_runtime_alpha_370_recovery_robustness_completion.md`
- `docs/secure_runtime_alpha_361_host_failure_inventory.md`
- `docs/secure_runtime_alpha_335_board_hydration_ownership.md`
- `docs/secure_runtime_alpha_372_canonical_board_query_contract.md`
