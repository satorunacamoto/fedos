# Secure Runtime Alpha 267 — Nostr Adapter Determinism Verification

**Status: this Stage VERIFIES. It adds NO new production file — it is
backed by real, executed tests
(`test/secure_runtime_alpha_267_nostr_adapter_determinism.test.ts`)
confirming determinism by actual repeated calls, not by assertion
alone.** Stage 7 of the Alpha 261–270 Nostr Canonical Board Adapter Arc.

## 1. Why now

Alpha 266 shipped the adapter. Before declaring it complete, this Stage
confirms it behaves as a PURE function: no hidden clock read, no random
id, no external state read that could make two calls with the same input
diverge.

## 2. Property 1 — same event -> same BoardPost, every time

`mapValidatedNostrEventToBoardPostInput(event, boardId)` and
`validateNostrBoardPost(event, boardId)`, called twice with the exact
same arguments, produce deeply-equal results both times. Verified for:

- A root post (no `e` tags).
- A reply post (marked `root` + `reply` tags).
- A positional (unmarked) single-`e`-tag post.
- Ten consecutive calls in a row, not just two — ruling out any
  once-per-process memoization bug that could mask non-determinism on a
  second call while still being present on a later one.

Structurally, determinism follows from the function bodies themselves:
`mapValidatedNostrEventToBoardPostInput` (Alpha 266) reads only its own
two arguments and calls no non-deterministic primitive — no
`Math.random`, no `Date.now()`/`new Date()`, no `crypto.getRandomValues`,
confirmed absent by direct inspection (also checked structurally by this
Stage's own test).

## 3. Property 2 — different event ids -> different BoardPosts

Two otherwise-identical fixture events differing ONLY in `id` (and,
consequently, `sig`, since a real signature is bound to the id — the
fixture models this by using two distinct opaque hex strings for both)
produce `FedosBoardPost` values with different `.id` AND different
`.source.reference`. Verified additionally for a difference in `pubkey`
alone (different `.author.publicIdentifier`) and a difference in
`content` alone (different `.body`), confirming the mapping is
INJECTIVE on each of these fields independently, not merely "different
somewhere."

## 4. What determinism does NOT claim

- It does not claim the SAME real-world Nostr event, re-delivered by two
  different relays, produces the SAME `FedosBoardPost.boardId` — that
  field is caller-supplied (Alpha 265 §4), not derived from `event`, so
  it is trivially whatever the caller passes both times; this Stage's
  own tests hold `boardId` fixed across repeated calls specifically to
  isolate the EVENT-derived fields' own determinism.
- It does not claim two DIFFERENT events can never collide on
  `threadId` — that is expected and correct when they are genuinely
  replies within the same thread (Alpha 256's own nested-reply model).

## 5. See also

- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
