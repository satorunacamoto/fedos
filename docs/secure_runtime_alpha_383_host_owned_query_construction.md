# Secure Runtime Alpha 383 — Host-Owned Query Construction

**Status: this Stage implements code.** Stage 3 of the Alpha 381–390
Canonical Board Query Host Integration & Startup Failure Closure Arc.
Adds Host ownership of exactly one `FedosBoardQuery`.

## 1. Construction point

```ts
const boardQuery = new FedosBoardQuery(hydration.service);
```

Inside `start()`'s own `try` block (Alpha 382), immediately after the
hydration-outcome check succeeds, BEFORE `DesktopApplication.start()`
is awaited. `hydration.service` is the SAME `FedosBoardService`
instance `#boardService` will eventually be assigned — Query is built
over the ALREADY-hydrated Service, never over `#boardPersistence`
directly, matching this Arc's own Required construction exactly:
"successful hydration → `FedosBoardService` → `new FedosBoardQuery(boardService)`."

## 2. No existing factory reused, because none exists

`FedosBoardQuery` has no `createFedosBoardQuery()`-style factory
function anywhere in `src/board/query/` — its own constructor takes
exactly one required argument with no sensible default (there is no
"default" Board to query), unlike `createDesktopApplication()`/
`createFedosDesktopHost()`, both of which default EVERY parameter.
Direct construction, `new FedosBoardQuery(...)`, is therefore already
the simplest, most direct expression — no factory is added by this
Stage.

## 3. Held locally until success, exactly like `hydration.service`

`boardQuery` is a LOCAL variable, not yet assigned to `#boardQuery`,
for the SAME reason `hydration.service` is held locally rather than
assigned to `#boardService` immediately (Alpha 335, unmodified
principle): if `DesktopApplication.start()` subsequently rejects, the
already-constructed `boardQuery` local simply goes out of scope,
discarded, never reachable through any accessor — "Query discarded on
startup failure" holds by CONSTRUCTION, not by an explicit
`this.#boardQuery = null` cleanup step for this specific path (Alpha
382's own `catch` block performs that unconditionally anyway, as a
second, redundant layer of the same guarantee).

## 4. Requirements confirmed satisfied

- **Query constructed exactly once per successful Host start** — the
  `new FedosBoardQuery(...)` call site appears exactly once in
  `start()`'s own body, reached at most once per instance (the
  leading `if (this.#state !== "constructed")` guard prevents a
  second `start()` call from ever reaching it again).
- **Query not constructed in the Host constructor** — confirmed:
  `FedosDesktopHost`'s own constructor performs ONLY the two existing
  field assignments plus `#state = "constructed"`; no
  `FedosBoardQuery` import is even reachable from that scope's own
  logic path.
- **Query not constructed before hydration succeeds** — the
  `new FedosBoardQuery(...)` line is textually and causally AFTER the
  hydration-outcome check's own `throw` — if hydration fails, that
  `throw` exits the `try` block before `FedosBoardQuery`'s own
  constructor is ever reached.
- **Query not exposed before Desktop startup succeeds** — `#boardQuery`
  is assigned a non-`null` value in EXACTLY ONE place, the method's
  own second-to-last statement, reached ONLY after
  `DesktopApplication.start()` has ALREADY resolved without throwing.
- **Query discarded on startup failure** — §3.
- **Query inaccessible after `stop()`** — Alpha 384's own `query()`
  accessor gates on `state() === "ready"`; `stop()` (Alpha 337,
  extended) also explicitly nulls `#boardQuery`.
- **No global singleton** — `#boardQuery` is an INSTANCE field; each
  `FedosDesktopHost` object owns its own.
- **Independent Hosts own independent Query instances** — a direct
  consequence of `new FedosBoardQuery(...)` being called fresh, per
  instance, inside `start()` — no module-level shared state of any
  kind exists anywhere in `fedos_desktop_host.ts`.
- **No Query persistence** — `FedosBoardQuery` itself holds no
  reference to `FedosBoardPersistence` of any kind (Alpha 373's own
  guardrail, unmodified) — the Host does not, and could not, persist
  a Query instance across restarts; a fresh Host always constructs a
  fresh Query.
- **No background work** — `new FedosBoardQuery(...)` is a
  synchronous, side-effect-free call (Alpha 373's own constructor,
  unmodified) — no `Promise`, no timer, no deferred work of any kind.

## 5. The Query implementation itself is untouched

`src/board/query/fedos_board_query.ts` and
`fedos_board_query_types.ts` carry ZERO diff from this Arc, confirmed
by regression test — this Stage integrates the EXISTING, frozen Query
implementation into the Host; it does not alter `recentFeed()`,
`thread()`, the filter model, or the pagination policy in any way.

## 6. Conclusion

Exactly one `FedosBoardQuery` is constructed per successful Host
start, over the already-hydrated `FedosBoardService`, held locally
until every remaining startup step succeeds, with no factory, no
singleton, and no modification to the Query implementation itself.

## 7. See also

- `docs/secure_runtime_alpha_382_host_startup_failure_closure.md`
- `docs/secure_runtime_alpha_372_canonical_board_query_contract.md`
- `docs/secure_runtime_alpha_335_board_hydration_ownership.md`
- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
