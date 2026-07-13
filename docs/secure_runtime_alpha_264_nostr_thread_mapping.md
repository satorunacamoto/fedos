# Secure Runtime Alpha 264 — Nostr Thread Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`resolveNostrThreadRefs`/`mapValidatedNostrEventToBoardPostInput` at
Alpha 266.** Stage 4 of the Alpha 261–270 Nostr Canonical Board Adapter
Arc.

## 1. Why now

Alpha 261's own field mapping table marked `tags` "protocol-specific,
interpreted not embedded" and deferred the actual resolution rule to
this Stage. `FedosBoardPost.threadId`/`.replyTo` (Alpha 256, "Option C":
`threadId` = root, `replyTo` = direct parent) are the two fields this
Stage must populate.

## 2. Scope limit: kind `1` only

**Only NIP-01 `kind: 1` (text note) events are accepted.** This is the
ONLY kind this repository has established real reply/thread semantics
for — `src/thread/thread.ts`'s own `buildThreads` (Stage 2, unmodified)
restricts itself identically ("Only kind:1 text notes participate; other
kinds are excluded from the tree"). Mapping a different kind (kind:0
metadata, kind:7 reactions, kind:30023 long-form, ...) now, with no
established precedent for what its `threadId`/`replyTo` should even
mean, would be inventing semantics — explicitly forbidden by this Arc's
own instruction. `mapValidatedNostrEventToBoardPostInput` returns `null`
for any `event.kind !== 1`. Extending this adapter to other kinds is
named as future work, not attempted here.

## 3. The resolution rule — mirrored, not imported, from established precedent

This Stage reuses the EXACT SAME NIP-10 resolution rule
`src/thread/thread.ts`'s own `getRootTarget`/`getReplyTarget` already
implement and this repository already tests (Stage 2). The rule is
REIMPLEMENTED locally in the adapter (`resolveNostrThreadRefs`,
`src/board/fedos_board_nostr_adapter.ts`, Alpha 266) rather than
imported, to keep this per-event adapter decoupled from that
multi-event, array-oriented module (see Alpha 268's own boundary
review for why). "Never invent semantics" is satisfied by mirroring an
ALREADY-established, ALREADY-tested rule exactly, not by writing a new
one:

- A marked `["e", id, relay, "reply"]` tag names the direct parent.
- A marked `["e", id, relay, "root"]` tag names the thread root.
- When NO `e` tag carries a marker (the deprecated positional NIP-10
  form): exactly one `e` tag -> that id is both root and reply; multiple
  `e` tags -> the first is root, the last is reply.
- A malformed `e` tag (missing id, or an id not exactly 64 lowercase hex
  characters) is silently dropped — the SAME tolerance
  `src/thread/thread.ts`'s own `parseETags` already applies.

## 4. Mapping onto `threadId`/`replyTo`

```
resolved.reply === null   ->  replyTo = null;      threadId = event.id
                               (this post is its own thread root --
                                Alpha 256 §1 convention)

resolved.reply !== null   ->  replyTo = resolved.reply
                               threadId = resolved.root ?? resolved.reply
```

## 5. The deferred boundary — named explicitly, not invented around

Two situations cannot be FULLY resolved by this per-event adapter, and
are named here exactly as this Arc's own instruction requires ("record
the exact deferred boundary"):

- **A `"root"`-marked tag with no `"reply"`-marked tag.** Following
  `src/thread/thread.ts`'s own established precedent exactly (§3),
  `resolved.reply` is `null` in this case — the root reference is NOT
  used to populate `replyTo`, and this post becomes its own thread root
  (`threadId = event.id`), even though a root tag technically named a
  different thread. This mirrors, rather than diverges from, this
  repository's own existing behavior for the identical input shape; a
  future Stage that wants stricter NIP-10 conformance (treating a lone
  root-marked tag as an implicit direct reply) would need to revisit
  BOTH this adapter AND `src/thread/thread.ts` together, not just one.
- **A `"reply"`-marked tag with no `"root"`-marked tag** (technically
  malformed NIP-10, but not rejected outright). `threadId` falls back to
  `resolved.reply` (the direct parent) — the nearest KNOWN anchor. This
  is NOT necessarily the true thread root: finding the true root would
  require walking the parent chain through the rest of the board's post
  set, which a single-event adapter structurally cannot do (Alpha 256
  §4's own table already assigns cross-post graph work — same reasoning
  as "cycle detection," "same-board reply" — to a future Board
  Application Logic layer, not to `validateFedosBoardPost` and not to
  this adapter). This adapter's own `threadId` in this one case should
  be read as "best locally-known anchor," not "verified root" — a future
  Board Application Logic reconciliation pass may later correct it once
  it has visibility into the rest of the thread.

Both cases are recorded here, not silently absorbed into "looks close
enough" behavior — per this Arc's own instruction: "If the mapping
cannot yet be fully completed because higher-level Board Logic does not
exist, record the exact deferred boundary."

## 6. See also

- `docs/secure_runtime_alpha_261_nostr_board_field_inventory.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
