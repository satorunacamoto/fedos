# Secure Runtime Alpha 384 — Host Query Access Boundary

**Status: this Stage implements code.** Stage 4 of the Alpha 381–390
Canonical Board Query Host Integration & Startup Failure Closure Arc.
Adds `query()` to `FedosDesktopHost`.

## 1. Candidates compared

- **Option A — `query(): FedosBoardQuery | null`.** Matches the
  existing `desktop()`/`board()` ownership access pattern exactly
  (Alpha 336).
- **Option B — Host-level delegated read methods only.** Would require
  duplicating `FedosBoardQuery`'s own two methods
  (`recentFeed()`/`thread()`) as pass-through wrappers on
  `FedosDesktopHost` — Alpha 386 reviews and rejects this shape for
  Host-level delegation generally.
- **Option C — an immutable read context containing Query and selected
  Desktop readers.** Would introduce a THIRD accessor type beyond
  `desktop()`/`board()`, carrying no capability Options A/B don't
  already provide, and complicates the ready/stopped/failed
  fail-closed check by requiring the context object itself to be
  nullable instead of each accessor independently — the SAME reasoning
  Alpha 336 §3 already used to reject an analogous "Option C" for
  `desktop()`/`board()`.
- **Option D — make `board()` return a new combined façade.** Would
  change `board()`'s own EXISTING return type
  (`FedosBoardService | null`) — a genuine breaking change to an
  already-shipped public method, forbidden outright by this Arc's own
  "preserve every public interface" Absolute Requirement.

## 2. Precondition confirmed: `FedosBoardQuery` has no mutating method

Per this Arc's own instruction: "If Query has any mutating method,
Option A must be rejected." Alpha 381 §7 already confirmed, by direct
inspection of `src/board/query/fedos_board_query.ts` and
`fedos_board_query_types.ts`: `FedosBoardQuery`'s ENTIRE public
surface is `recentFeed()` and `thread()`, both pure reads, returning a
plain `FedosBoardQueryResult` value — zero mutating method exists.
**The rejection condition does not trigger; Option A is adopted.**

## 3. Decision

**Option A**, matching `desktop()`/`board()`'s own established shape
exactly:

```ts
query(): FedosBoardQuery | null {
  return this.#state === "ready" ? this.#boardQuery : null;
}
```

## 4. Required behavior, confirmed

- **`null` before ready** — `state()` is `"constructed"` or
  `"starting"`; `#boardQuery` has never been assigned a non-`null`
  value yet (Alpha 383 §4).
- **Query instance while ready** — the ONLY state this accessor
  returns non-`null`.
- **`null` after stopped** — `stop()` (Alpha 337, extended by Alpha
  382/383) explicitly nulls `#boardQuery` before `state → "stopped"`.
- **`null` after failed** — Alpha 382's own `catch` block
  unconditionally nulls `#boardQuery` before `state → "failed"`.
- **No throw** — a plain ternary read of `#state`, structurally
  identical to `desktop()`/`board()`; there is no code path in this
  method capable of throwing.
- **Never exposes Persistence** — `FedosBoardQuery` itself holds no
  `FedosBoardPersistence` reference of any kind (Alpha 373, confirmed
  unmodified); `query()` cannot leak what the returned object does
  not itself hold.
- **Never exposes indexes directly** — `FedosBoardQuery`'s own
  `#source` field is `FedosBoardQuerySource`-typed (a two-method
  structural interface), never `FedosBoardIndex`/`FedosBoardSourceIndex`
  directly.
- **Never exposes protocol adapters** — no Protocol Adapter reference
  exists anywhere in `src/board/query/` (confirmed unchanged from
  Alpha 372's own guardrail).
- **Never exposes the Ontology engine** — no `p2p/` reference exists
  anywhere in `src/board/query/` or `src/desktop/host/` (confirmed by
  this Arc's own regression tests).
- **Never exposes mutable Host state** — `query()` returns the SAME
  `FedosBoardQuery` reference every call while ready (no cloning, no
  fresh wrapper per call) — but since `FedosBoardQuery` itself is
  read-only (§2), returning the SAME instance repeatedly carries no
  mutation risk; a caller holding a stale reference across a `stop()`
  call simply holds a Query object that still works (it reads through
  to the SAME, now-orphaned `FedosBoardService` it was built over) but
  can never reach it again via `query()` itself, matching
  `board()`/`desktop()`'s own identical stale-reference behavior,
  unchanged by this Arc.

## 5. Conclusion

`query()` is added, matching `desktop()`/`board()`'s own exact shape
and fail-closed discipline — Option A, confirmed adopted rather than
rejected because `FedosBoardQuery` is confirmed read-only, with every
required access-boundary property verified against the actual
implementation.

## 6. See also

- `docs/secure_runtime_alpha_383_host_owned_query_construction.md`
- `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md`
- `docs/secure_runtime_alpha_381_host_query_integration_inventory.md`
