# Secure Runtime Alpha 380 — Canonical Board Query Foundation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
371–380 Canonical Board Query Foundation Arc.**

## 1. Why now

Alpha 371 inventoried every existing Board read path and found four
concrete gaps: no filtering, no offset pagination, no deterministic
thread order, no unified result shape. Alpha 372 fixed the contract
those gaps require. Alpha 373 implemented the recent feed query,
reimplementing (not reusing) `FedosBoardFeed`'s own ordering to avoid
a filter/pagination correctness bug a naive delegation would
introduce. Alpha 374 implemented the thread query, establishing a
brand NEW deterministic chronological order this repository never
had. Alpha 375 fixed the pagination Decision (offset/limit, no
cursor). Alpha 376 fixed the filter model (four dimensions, AND-only).
Alpha 377 verified every ordering claim by direct execution. Alpha
378 reviewed cost and found no performance-motivated change is
warranted. Alpha 379 verified the whole layer end to end with real
fixtures from all four Board Adapters. This Stage freezes the query
layer and issues the Arc's own closing Completion Declaration.

## 2. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.** The canonical
query layer for `FedosBoard` now exists —
`src/board/query/fedos_board_query_types.ts` (the contract) and
`src/board/query/fedos_board_query.ts` (`FedosBoardQuery`, Alpha
373–376) — defining HOW clients read Board data, with the Repository
(`FedosBoardRepository`, Alpha 302) and Persistence
(`FedosBoardPersistence`, Alpha 315) both confirmed byte-for-byte
UNCHANGED by direct inspection and by this Arc's own regression tests:

- **`recentFeed()`** — filtered, offset-paginated, `createdAt` DESC
  ordering, matching `FedosBoardFeed`'s own established direction.
- **`thread()`** — filtered, offset-paginated, `createdAt` ASC
  ordering — a genuinely NEW guarantee this repository never had.
- **A unified `FedosBoardQueryResult` shape** — `posts`/`total`/
  `offset`/`limit`/`hasMore` — identical across both methods.
- **A four-dimension filter model** — `protocol`/
  `authorPublicIdentifier`/`since`/`until`, AND-only, evaluated in
  exactly one shared function.
- **Offset/limit pagination**, no cursor, with numeric bounds matching
  this repository's own two existing precedents.
- **Determinism verified by direct execution**, not merely asserted.
- **Real, multi-protocol, end-to-end verification**, with zero adapter
  modification.

## 3. What this layer deliberately does NOT do

- **No caller wires it in yet.** `FedosBoardQuery` has, as of this
  Arc's own completion, NO production caller anywhere in this
  repository — `FedosDesktopHost` does not construct one, and
  `src/worker.ts` does not reference it. This mirrors Alpha 341 §3's
  own identical finding about `FedosBoardPersistence` before Alpha
  331–340 built `FedosDesktopHost` as its first real caller — a
  foundation layer, deliberately built and verified before any wiring
  decision is made.
- **No text search, no reply-count filter, no `identityId` filter, no
  `replyTo`/direct-children filter** — each explicitly reviewed and
  rejected in Alpha 376 §2, not merely omitted.
- **No cursor-based pagination** — explicitly rejected in Alpha 375
  §1.
- **No sort-order-aware index** — reviewed in Alpha 378 §3 and found
  premature ahead of any measured need.
- **No GUI, no Worker route, no Relay, no Protocol Adapter change, no
  Ontology integration** — confirmed absent by direct inspection.

## 4. Remaining limitations, named explicitly

- **No real caller** (§3) — the single largest gap this Arc leaves
  behind, by design.
- **No sort-order-aware index** (§3, Alpha 378 §3) — acceptable at
  today's scale (Alpha 368's own N=1,000 measurement, one Arc prior,
  remains the only real data point).
- **The `FedosDesktopHost.start()` hydration-exception gap remains
  UNFIXED** — named by Alpha 370 (Arc 361–370) as that Arc's own
  recommended next Arc, still outstanding; this Arc's own scope never
  touched `src/desktop/host/*` and did not revisit it.
- **No `replyTo`/direct-children filter** — a real, plausible future
  capability, explicitly deferred (Alpha 376 §2), not built.

## 5. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Relay changes, Protocol Adapter changes, Ontology integration, GUI,
  Worker changes — no reference anywhere in this Arc's own code.
- New package/dependency of any kind — `package.json`'s own
  `dependencies` count stays fixed at 2; no `Cargo.toml` change of any
  kind.
- Any change to `FedosBoardRepository` or `FedosBoardPersistence` —
  both carry zero diff from this Arc, confirmed by regression test.

## 6. Next Arc recommendation

**Secure Runtime Alpha 381–390: Canonical Board Query Host Integration
Arc.**

Reason: this Arc's own Objective ("this Arc defines how clients READ
board data") is now complete as a FOUNDATION, but — exactly as Alpha
341 found for Persistence before `FedosDesktopHost` existed —
`FedosBoardQuery` has no real caller yet. The natural, well-precedented
next step, matching this repository's own recurring "build the layer,
then a later Arc gives it a real caller" pattern (Board Repository →
Persistence → Backend Selection → Host → Append-only Backend), is
wiring `FedosBoardQuery` into `FedosDesktopHost` as a real, test-verified
caller — NOT yet a Worker route or GUI, both of which remain
separately out of scope until a Host-level caller exists first, mirroring
Alpha 341's own reasoning for Persistence exactly.

The still-outstanding `FedosDesktopHost.start()` hydration-exception fix
(§4) remains a valid, independent candidate a maintainer may choose to
prioritize instead — this Stage names Host Integration as the
recommendation most directly connected to THIS Arc's own unfinished
thread, without dismissing that alternative.

## 7. See also

- `docs/secure_runtime_alpha_379_four_protocol_query_verification.md`
- `docs/secure_runtime_alpha_378_performance_review.md`
- `docs/secure_runtime_alpha_377_deterministic_ordering_verification.md`
- `docs/secure_runtime_alpha_376_filter_model.md`
- `docs/secure_runtime_alpha_375_pagination_policy.md`
- `docs/secure_runtime_alpha_374_thread_query.md`
- `docs/secure_runtime_alpha_373_recent_feed_query.md`
- `docs/secure_runtime_alpha_372_canonical_board_query_contract.md`
- `docs/secure_runtime_alpha_371_existing_read_path_inventory.md`
- `docs/secure_runtime_alpha_341_host_capability_inventory.md`
