# Secure Runtime Alpha 309 — Four-Protocol Board Integration Verification

**Status: this Stage VERIFIES. It adds NO new production file — it is
backed by real, executed integration tests
(`test/secure_runtime_alpha_309_four_protocol_board_integration.test.ts`)
that build fixtures through all FOUR real, unmodified Board Adapters and
register them through the SAME `FedosBoardService`.** Stage 9 of the
Alpha 301–310 Canonical Board Repository, Index & Feed Foundation Arc.

## 1. Why now

Alpha 302–308 built the Repository/Source Index/Board Index/Service/Feed
in isolation, exercised mostly with hand-built `FedosBoardPost` fixtures.
This Stage confirms the whole stack works with REAL adapter output —
`validateNostrBoardPost` (Alpha 266), `validateActivityPubBoardPost`
(Alpha 277), `validateAtprotoBoardPost` (Alpha 287), and
`validateSessionBoardPost` (Alpha 297) — none of which is modified by
this Arc.

## 2. Method

Four fixtures, one per protocol, are mapped through their OWN real,
unmodified adapter (imported directly from `src/board/*`, exactly as
Alpha 259/279/289/299's own prior fixture tests already did) into real
`FedosBoardPost` values, then registered through ONE shared
`FedosBoardService` instance and read back through `FedosBoardFeed`.

## 3. Verified, per this Arc's own required checklist

- **All four become `FedosBoardPost`** — each adapter call returns a
  non-null value with the Canonical Board Model's own eight-field
  shape.
- **All four register through the same `FedosBoardService`** — one
  `FedosBoardService` instance accepts all four `registerPost` calls,
  each returning `"inserted"`.
- **All four appear in one Board feed** — `FedosBoardFeed.listRecentPosts`
  returns all four posts for the shared `boardId`.
- **Thread replies from supported fixtures group correctly** — a
  Nostr reply and an AT Protocol reply (both protocols supply enough
  structure to build a real reply fixture without inventing semantics)
  are registered against their own already-registered roots and appear
  under the correct `threadId` via `FedosBoardService.listThreadPosts`.
- **Protocol origin does not affect ordering** — the feed's own order
  depends ONLY on `createdAt`/`id` (Alpha 308 §4); fixtures are
  constructed with deliberately INTERLEAVED `createdAt` values across
  protocols and the resulting feed order is verified against a plain
  chronological expectation, independent of which protocol produced
  which post.
- **Source deduplication works independently per protocol** —
  re-registering the SAME fixture (same adapter output, same `source`)
  a second time returns `"already-present"`, for each of the four
  protocols independently.
- **Same source is idempotent** — confirmed by the above; the Repository/
  Source Index/Board Index are all unchanged in size after the repeat
  call.
- **Source conflict fails closed** — a hand-built second post sharing
  one fixture's own `source` but a DIFFERENT `id` is rejected as
  `"source-conflict"`, and confirmed absent from the Repository
  afterward.
- **Post ID conflict fails closed** — a hand-built second post sharing
  one fixture's own `id` but different content is rejected as
  `"post-id-conflict"`, and the ORIGINAL fixture is confirmed unchanged
  in the Repository afterward.
- **Missing parent rejected** — a reply naming a `replyTo` that was
  never registered is rejected as `"missing-parent"`.
- **Cross-board reply rejected** — a reply whose real parent is
  registered under a DIFFERENT `boardId` is rejected as
  `"cross-board-reply"`.
- **Duplicate registration does not duplicate indexes** — after
  re-registering every fixture a second time, `listBoardPostIds`/
  `listThreadPostIds` each still report exactly one entry per post, not
  two.
- **Repository instances remain isolated** — two independently
  constructed `FedosBoardService`s (each with its own default,
  freshly-constructed components) do not observe each other's
  registrations.
- **Feed output is deterministic** — `listRecentPosts` called twice in a
  row on the same, unchanged state returns deeply-equal arrays.
- **No adapter is modified** — confirmed by `git diff --stat` showing
  zero changes to any of the four adapter files (verification step, not
  this Stage's own test) and, within this Stage's own test, by
  reproducing each adapter's own known-good fixture result from its own
  prior Arc's determinism test and confirming it is unchanged.

## 4. Also confirmed

- **No `p2p/` import** — confirmed: the test file itself imports nothing
  from `p2p/`, and none of `src/board/repository/*` does either
  (structural check against each production file's own source).
- **No Ontology Engine call** — trivially true; no such capability
  exists anywhere in this Arc's own code.
- **No Relay call, no network** — confirmed: no `fetch`, no `WebSocket`,
  no async function anywhere in `src/board/repository/*`.
- **No Storage** — confirmed: no import from `src/storage/` anywhere in
  `src/board/repository/*`.

## 5. See also

- `docs/secure_runtime_alpha_307_board_application_service.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`
- `docs/secure_runtime_alpha_299_session_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_289_atproto_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_279_activitypub_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review.md`
