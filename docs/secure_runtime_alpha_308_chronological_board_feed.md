# Secure Runtime Alpha 308 — Chronological Board Feed

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/repository/fedos_board_feed.ts`.** Stage 8 of the Alpha
301–310 Canonical Board Repository, Index & Feed Foundation Arc.

## 1. Why now

Alpha 301 §3.3/§3.6 confirmed this repository already ships a RANKED
feed (`src/query/thread_query.ts`'s `queryThreads`, Stage 4) — explicitly
NOT reused, since this Arc's own instruction forbids ranking of any
kind. This Stage builds a genuinely new, protocol-neutral, unranked,
chronological-only feed over `FedosBoardPost`.

## 2. The shape

```ts
export const FEDOS_BOARD_FEED_MIN_LIMIT = 1;
export const FEDOS_BOARD_FEED_MAX_LIMIT = 100;

export interface FedosBoardFeedSource {
  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[];
}

export class FedosBoardFeed {
  constructor(source: FedosBoardFeedSource);
  listRecentPosts(boardId: FedosBoardId, limit: number): readonly FedosBoardPost[];
}
```

**No `FedosBoardFeedEntry` wrapper** — this Arc's own instruction offers
one as a candidate "if no wrapper is justified" alternative applies. No
per-entry, feed-only metadata exists anywhere in this Arc's own scope
(no rank score, no cursor, no injected ad slot) — a bare
`readonly FedosBoardPost[]` is returned directly.

## 3. `FedosBoardFeedSource` — a minimal, decoupled interface, not a
`FedosBoardService` import

`FedosBoardFeed` depends on `FedosBoardFeedSource` — an interface naming
ONLY the one method (`listBoardPosts`) the feed actually needs — rather
than importing `FedosBoardService` (Alpha 307) directly. TypeScript's
structural typing means a `FedosBoardService` instance satisfies
`FedosBoardFeedSource` with NO explicit relationship declared and NO
import of `FedosBoardFeed` needed on `FedosBoardService`'s own side —
the feed stays genuinely decoupled from any one concrete service
implementation, matching this whole series' repeated "compose, don't
couple" discipline.

## 4. Required ordering — `createdAt` DESC, then `id` ASC, reusing an
established repository-wide convention

```ts
function compareIdAsc(a: FedosBoardPostId, b: FedosBoardPostId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function feedOrder(a: FedosBoardPost, b: FedosBoardPost): number {
  const dt = b.createdAt - a.createdAt;
  return dt !== 0 ? dt : compareIdAsc(a.id, b.id);
}
```

This is NOT a new convention: `src/thread/thread.ts`'s `rootOrder` and
`src/indexer/memory_index.ts`'s `eventOrder`/`threadOrder` (Alpha 301
§3.4, both Nostr-specific, neither reused as code) already established
the IDENTICAL "primary field DESC, then id ASC" tie-break shape. This
Stage reuses the PATTERN, applied to the protocol-neutral
`FedosBoardPost.createdAt`/`.id` instead of a Nostr-specific
`created_at`/event `id`.

**Tie-break direction, stated explicitly**: when two posts share the
exact same `createdAt`, the one with the LEXICOGRAPHICALLY SMALLER `id`
sorts FIRST (ascending). This is an arbitrary but fully deterministic
choice — any fixed rule would satisfy determinism; ascending was chosen
to match every existing tie-break in this repository (§ above), not
reinvented.

## 5. `listRecentPosts` — required API, confirmed

```ts
listRecentPosts(boardId: FedosBoardId, limit: number): readonly FedosBoardPost[] {
  const normalizedLimit = normalizeFeedLimit(limit);
  const posts = [...this.#source.listBoardPosts(boardId)];
  posts.sort(feedOrder);
  return posts.slice(0, normalizedLimit);
}
```

**Board-specific** — `boardId` is a required parameter; the feed never
mixes posts from different boards. **No mutation** — `[...source
.listBoardPosts(boardId)]` copies before sorting (defensive: `Array.sort`
mutates in place, and this guarantees the SOURCE's own returned array,
even if some future `FedosBoardFeedSource` implementation ever returned
a live reference, is never touched).

## 6. Limit policy — normalize, explicitly, not fail-closed

This Arc's own instruction offers a choice: "invalid limits fail closed
or normalize according to one documented policy." **Adopted: normalize**
— `listRecentPosts` always returns a (possibly empty) array, never
`null`/`undefined`, matching a LISTING operation's own natural shape
(unlike a validation gate, where fail-closed-via-`null` is this whole
series' own established convention). The exact, tested policy:

```ts
function normalizeFeedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return FEDOS_BOARD_FEED_MIN_LIMIT;
  const floored = Math.floor(limit);
  if (floored < FEDOS_BOARD_FEED_MIN_LIMIT) return FEDOS_BOARD_FEED_MIN_LIMIT;
  if (floored > FEDOS_BOARD_FEED_MAX_LIMIT) return FEDOS_BOARD_FEED_MAX_LIMIT;
  return floored;
}
```

- **Non-finite (`NaN`/`Infinity`/`-Infinity`)** → clamps to the MINIMUM
  (`1`), the smallest safe default — returning too little is always
  safer than guessing a large number for a malformed input.
- **Non-integer** → floored (`Math.floor`), matching
  `src/query/thread_query.ts`'s own existing `normalizeOptions`
  precedent (Stage 4, unmodified) for the identical "a limit may arrive
  as a non-integer" case.
- **`<= 0`** (after flooring) → clamps up to the minimum (`1`).
- **`> 100`** (after flooring) → clamps down to the maximum (`100`).

## 7. Bounds — fixed and tested

```ts
export const FEDOS_BOARD_FEED_MIN_LIMIT = 1;
export const FEDOS_BOARD_FEED_MAX_LIMIT = 100;
```

Matching this Arc's own suggested bounds exactly. Both constants are
exported (not private) so a caller — or a test — can reference the
fixed ceiling without hard-coding `100` a second time.

## 8. Explicitly excluded, per this Arc's own instruction, verbatim

- **No ranking, no personalization, no recommendations, no engagement
  score, no protocol priority, no author priority, no random order** —
  confirmed: `feedOrder` reads only `createdAt`/`id`; no field of
  `author`/`source`/`body` is ever consulted for ordering.
- **No pagination cursor** — none exists in this repository's own
  established convention for a comparable case that would require one
  here (`src/query/thread_query.ts`'s own `offset`-based pagination is
  Nostr-specific and not reused); this Stage adds none.

## 9. See also

- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`
- `docs/secure_runtime_alpha_309_four_protocol_board_integration.md`
