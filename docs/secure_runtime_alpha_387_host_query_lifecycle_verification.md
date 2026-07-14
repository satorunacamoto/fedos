# Secure Runtime Alpha 387 — Startup and Shutdown Lifecycle Verification

**Status: this Stage verifies existing, newly-implemented behavior by
real execution — no production code change.** Stage 7 of the Alpha
381–390 Canonical Board Query Host Integration & Startup Failure
Closure Arc.

## 1. Successful startup, verified

`FedosDesktopHost` starts at `"constructed"`; calling `start()`
transitions through `"starting"`; hydration completes (a real
`FedosBoardPersistence` pre-populated with fixtures);
`FedosBoardQuery` is constructed AFTER hydration (confirmed by
structural inspection of statement order, Alpha 382/383);
`DesktopApplication.start()` is called (confirmed via
`isBootstrapped()` reading `true` afterward); `state()` becomes
`"ready"`; `board()`, `query()`, and `desktop()` are ALL non-`null`;
`query()`'s own `recentFeed()`/`thread()` correctly read the
HYDRATED Board state — the exact posts persisted before `start()` was
ever called.

## 2. Hydration returned failure, verified

A persistence pre-populated with a structurally-corrupt (but
parseable) record produces `hydrateFedosBoardService`'s own
`"rejected-corrupt-record"` outcome. `start()` rejects. `state()`
reads `"failed"`. `board()`/`query()`/`desktop()` are ALL `null`.
`DesktopApplication.start()` is confirmed NEVER called — via
`isBootstrapped()` reading `false` on the injected `DesktopApplication`
afterward, since `bootstrap()` (the ONLY path that can ever set it
`true`) is never reached when the `try` block's own hydration-outcome
check throws before `await this.#desktopApplication.start()` is ever
evaluated.

## 3. Hydration thrown exception, verified

A persistence whose `listPosts()` itself throws (a real
`AppendOnlyFedosBoardPersistence` pointed at a log containing a
malformed trailing line) produces `start()` rejecting with the
ORIGINAL thrown error (confirmed via `.message`/`instanceof`
matching). `state()` reads `"failed"` — **the confirmed defect, fixed
(Alpha 382), verified here directly** — never `"starting"`.
`board()`/`query()` are both `null`. This is the SAME reproduction
scenario Alpha 361/370 each used to CONFIRM the defect; this Stage
re-runs the identical scenario and confirms the OPPOSITE, now-correct
outcome.

## 4. Desktop startup rejection, verified

A `DesktopApplication` constructed with a throwing
`FedosPublicIdentityReader`, paired with a persistence that hydrates
successfully. `start()` rejects with the ORIGINAL rejection from the
Reader. `state()` reads `"failed"`. `board()`/`query()` are both
`null` — confirming the ALREADY-hydrated `FedosBoardService`/
already-constructed `FedosBoardQuery` (both held only in LOCAL
variables at this point, Alpha 382/383) are correctly discarded,
never assigned to their respective fields, when this is the step that
fails.

## 5. Shutdown, verified

From `"ready"`: `stop()` transitions through `"stopping"` to
`"stopped"`. `board()`/`query()`/`desktop()` ALL become `null`
afterward. A second `start()` call on the stopped instance rejects
(no restart). A second `stop()` call rejects (no silent no-op, Alpha
337's own non-idempotency policy, unmodified). No dispose/close
method is called on any owned object — `stop()`'s own body performs
ONLY the two field-nulling assignments plus the two state
transitions, confirmed by structural inspection, unchanged from Alpha
337 except for the ADDED `#boardQuery` nulling.

## 6. Why this Stage re-verifies paths Alpha 339/361 already covered

Alpha 339 (Arc 331–340) verified the ORIGINAL five-accessor Host
without Query. Alpha 361 (Arc 361–370) verified the SAME lifecycle
but explicitly documented the hydration-throw path as A CONFIRMED
DEFECT, not a passing case. This Stage is the FIRST to verify the
FULL, CORRECTED lifecycle — including `query()` — end to end, with
every previously-defective path now asserting the FIXED outcome.

## 7. Conclusion

Every lifecycle transition this Arc's own Target Architecture names —
`constructed → starting → [hydrate → construct Query → start Desktop]
→ ready`, and every failure shape collapsing to `failed` — is verified
by direct execution, not merely asserted in source comments.

## 8. See also

- `docs/secure_runtime_alpha_382_host_startup_failure_closure.md`
- `docs/secure_runtime_alpha_383_host_owned_query_construction.md`
- `docs/secure_runtime_alpha_339_desktop_host_integration_verification.md`
- `docs/secure_runtime_alpha_361_host_failure_inventory.md`
