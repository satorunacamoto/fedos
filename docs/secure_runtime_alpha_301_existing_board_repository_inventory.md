# Secure Runtime Alpha 301 — Existing Board Repository / Index / Feed Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 301–310
Canonical Board Repository, Index & Feed Foundation Arc. It inspects the
actual repository before any implementation, exactly as every prior
Board-layer Arc's own opening Stage did (Alpha 251, 261, 271, 281, 291).

## 1. Why now

Alpha 300 closed the Session Canonical Board Gateway Adapter Arc,
completing all four Protocol Adapters, and recommended exactly this Arc
next: "NOTHING YET STORES, INDEXES, or SERVES a `FedosBoardPost` once
produced — every adapter's own output today is discarded the moment a
test or caller stops holding a reference to it." This Stage inspects
the repository before that first Board Application layer is built.

## 2. Inventory method

Direct inspection of `src/board/*`, `src/thread/*`, `src/social/*`,
`src/query/*`, `src/indexer/*`, `src/cache/*`, `src/storage/*`,
`src/community/directory.ts`, and the four completed Board Adapters —
no code executed, no file modified. `p2p/` was inspected ONLY at the
top-level directory-listing and `README.md` level, per this Arc's own
instruction ("confirm it is a separate Ontology Engine repository and
not an implementation target for this Arc") — no deeper file inside it
was read, and nothing inside it was treated as implementation input.

## 3. Findings, answering all ten required questions

### 3.1 Whether a Board Repository already exists

**No.** No class or interface named `*Repository*` (or an equivalent
container keyed by `FedosBoardPostId`) exists anywhere in `src/board/`.
`grep`-ing this repository's entire `src/` tree for `Repository`
matches nothing related to board posts.

### 3.2 Whether a thread index already exists

**Only a Nostr-specific, non-reusable precedent.**
`src/thread/thread.ts`'s `buildThreads` (Stage 2) builds a `ThreadNode`
TREE (parent/child links, cycle-breaking, depth assignment) directly
over raw `NostrEvent[]` — every node embeds the actual Nostr wire event.
`src/indexer/memory_index.ts`'s `InMemoryMetadataIndex.queryThreads`
(Stage 14) additionally rolls threads up into `IndexedThread` rows
(`rootId`, `rootPubkey`, `replyCount`, `lastReplyAt`) — also
Nostr-specific (`rootPubkey`), also `Promise`-returning (mirrors a
future D1-backed implementation behind the same interface). NEITHER
operates on `FedosBoardPost`, NEITHER is protocol-neutral, and NEITHER
is reused as code — Alpha 305 builds a genuinely new, ID-only index. The
ORDERING CONVENTION both already use — "primary field DESC, then id
ASC" as a deterministic tie-break — IS reused as a pattern (§3.4).

### 3.3 Whether a chronological feed already exists

**Only a Nostr-specific, RANKED precedent — not reusable as-is.**
`src/query/thread_query.ts`'s `queryThreads` (Stage 4) already
implements four sort modes (`new`/`old`/`top`/`hot`) with pagination,
operating on `ThreadBuildResult`/`ThreadNode` (Nostr-specific, embeds
raw `NostrEvent`). Critically, its `top`/`hot` modes apply REAL RANKING
(`scoreThread`: descendant count × 10 + direct children × 3 + max
depth) — this Arc's own instruction explicitly forbids ranking of any
kind ("no ranking... no engagement score"). This existing ranked feed is
NEITHER reused NOR modified: it remains a separate, Nostr-specific,
already-shipped feature this Arc does not touch. Alpha 308 builds a
genuinely new, protocol-neutral, chronological-ONLY feed with no ranking
mode of any kind.

### 3.4 Which Map/container conventions are reusable

Two existing precedents establish the SAME container shape this Arc's
own repository/index classes should follow:

- **`InMemorySpaceDirectory`** (`src/community/directory.ts`, Stage 11)
  — a private `#`-prefixed field, a synchronous interface, a
  constructor that only copies its input (`[...spaces]`), no side
  effects.
- **`InMemoryEventCache`** (`src/cache/event_cache.ts`, Stage 6) — a
  private `#store` `Map`, synchronous key-based `get`/`set`/`delete`.

Both are reused as the STRUCTURAL PATTERN (private-field `Map`-backed
class, defensive copying, no constructor side effects), not as code —
neither is imported by this Arc.

The **deterministic tie-break comparator convention** — "primary field
DESC (or ASC), then id ASC" — appears independently in
`src/thread/thread.ts` (`rootOrder`/`childOrder`) AND
`src/indexer/memory_index.ts` (`eventOrder`/`threadOrder`): both compare
a primary field first, falling back to lexicographic id comparison only
on a tie. Alpha 308's own chronological feed reuses this EXACT
convention (`createdAt` DESC, then `FedosBoardPostId` ASC on a tie) —
the pattern, not the code, since both existing implementations are
Nostr-specific.

### 3.5 Whether persistence is already abstracted

**Yes, but as an entirely inert placeholder — not usable as real
persistence, and out of this Arc's own scope regardless.**
`StorageBackend` (`src/storage/types.ts`, Stage 107) is a
"future-facing seam" whose own doc comment states plainly: "This file
defines shapes ONLY — it performs no real storage... nothing is
persisted because nothing runs." No implementation of it performs real
storage. This Arc's own Absolute Prohibitions forbid "Storage Layer
changes" and "persistent database" regardless — confirming the
in-memory-only design this Arc's own instruction already requires is
correct, not merely convenient.

### 3.6 Whether any current feed applies ranking

**Yes — `queryThreads`'s `top`/`hot` modes (§3.3), confirmed NOT reused
and NOT modified.** This is the clearest evidence this Arc's own
"no ranking" requirement is achievable without regressing an existing
feature: the ranked feed remains a separate, working, Nostr-specific
capability; Alpha 308 adds an entirely separate, protocol-neutral,
unranked one.

### 3.7 Whether any current model mixes protocol wire data with Board
application state

**Yes — `ThreadNode` and `IndexedEvent`/`IndexedThread`, confirmed NOT
reused.** `ThreadNode.event` is a raw `NostrEvent`; `IndexedEvent`
carries `pubkey`/`kind`/`contentPreview`/`relayUrl` directly. Both
predate the Canonical Board Model (Alpha 251–260) and were never
redesigned to consume it — this Arc's own repository/index classes
consume ONLY `FedosBoardPost` (Alpha 255) and its own branded
identifiers (Alpha 252), never a protocol-specific field of any kind,
completing the separation the Canonical Board Model Arc itself began.

### 3.8 Whether source-provenance deduplication exists

**No implementation — but the identity RULE already exists and is
reused.** `fedosBoardSourceKey` (`src/board/fedos_board_source.ts`,
Alpha 253) already computes a stable `protocol:reference` key from a
`FedosBoardSourceReference` — reused DIRECTLY, unmodified, by all three
adapters that named a "duplicate-import identity" decision (Alpha 253
§5, Alpha 273 §5, Alpha 283 §6, Alpha 296 §5). No INDEX keyed by it
exists yet anywhere — Alpha 304 is the first Stage to build one.

### 3.9 Whether post-ID collision handling exists

**No.** No existing container in this repository is keyed by
`FedosBoardPostId` at all — there is nothing to collide with yet. Alpha
303 is the first Stage to introduce such a container.

### 3.10 Whether `p2p/` exposes any stable adapter boundary relevant
only to future work

**`p2p/` is confirmed, at the boundary level only, to be a WHOLLY
UNRELATED, pre-existing, independent repository** — its own `README.md`
identifies it as "Global Imbalance Radar," a real-time cryptocurrency
market-microstructure analysis platform (Python, Binance WebSocket
ingestion, Nostr/Lightning Zap payment via NIP-57) — not an "Ontology
Engine" in any sense this Arc's own architecture diagram describes, and
not a board/thread/post concept of any kind. Regardless of what `p2p/`
actually contains, this Arc's own Absolute Prohibitions make the
correct handling identical either way: it is not staged, not modified,
not imported, and not inspected beyond this top-level confirmation. No
"stable adapter boundary relevant to future work" was found or looked
for beyond this directory-listing/README check — a genuine future
Board→Ontology projection contract (this Arc's own recommended
`docs/`-level future concern, Alpha 310 §5) would need its own,
separately-scoped review, not performed here.

## 4. Conclusion

No existing honest abstraction is duplicated by this Arc. Two
Nostr-specific precedents (`src/thread/thread.ts`'s thread builder,
`src/query/thread_query.ts`'s ranked feed, and `src/indexer/`'s
metadata index) remain untouched, unmodified, and un-imported — they
solve a DIFFERENT problem (Nostr-native, ranked, or D1-oriented) than
this Arc's own protocol-neutral, unranked, in-memory scope. Two
container-shape precedents (`InMemorySpaceDirectory`,
`InMemoryEventCache`) and one comparator convention (primary-field +
id-tie-break ordering) are reused as PATTERNS. `fedosBoardSourceKey`
(Alpha 253) is reused DIRECTLY as the one piece of already-shipped code
this Arc's own Source Index (Alpha 304) depends on. `p2p/` is confirmed
unrelated and untouched. New files are placed under
`src/board/repository/` (this Arc's own required directory) — no
existing location in this repository was found to be a better fit.

## 5. See also

- `docs/secure_runtime_alpha_300_session_board_adapter_completion.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_251_existing_board_model_inventory.md`
