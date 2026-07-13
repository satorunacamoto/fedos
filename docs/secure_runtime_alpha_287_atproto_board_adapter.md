# Secure Runtime Alpha 287 — AT Protocol Board Adapter Implementation

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/atproto/fedos_atproto_board_adapter.ts`.** Stage 7 of the
Alpha 281–290 AT Protocol Canonical Board Adapter Arc.

## 1. Why now

Alpha 282–286 fixed every mapping decision (normalized input shape,
provenance, author, body, thread). This Stage assembles them into the
adapter itself, following the established two-step pattern
(`fedos_board_nostr_adapter.ts`, Alpha 266;
`fedos_activitypub_board_adapter.ts`, Alpha 277) "where honest."

## 2. The two exported functions

```ts
export function mapValidatedAtprotoPostToBoardPostInput(
  post: FedosValidatedAtprotoPost,
  boardId: string,
): FedosBoardPostInput | null

export function validateAtprotoBoardPost(
  post: FedosValidatedAtprotoPost,
  boardId: string,
): FedosBoardPost | null
```

`validateAtprotoBoardPost` composes `mapValidatedAtprotoPostToBoardPostInput`
(this file, ALL AT-Protocol-specific interpretation) with
`validateFedosBoardPost` (`../fedos_board_post_validator.js`, Alpha 257,
unmodified) — the IDENTICAL two-step shape both `validateNostrBoardPost`
(Alpha 266) and `validateActivityPubBoardPost` (Alpha 277) already
established, confirming the pattern generalizes to a THIRD, structurally
different protocol.

**`boardId: string`, not `boardId: FedosBoardId`.** Matching both prior
adapters' own actual, shipped signatures exactly — the identical
consistency decision Alpha 277 §2 already made for ActivityPub, restated
here rather than re-decided.

## 3. One-way only, confirmed

Per this Arc's own instruction: "This Arc is one-way only... Do not
implement outbound repository writes or Bluesky networking in this
Arc." Confirmed by direct inspection: no function in this file accepts
a `FedosBoardPost` and returns anything AT-Protocol-shaped; no function
constructs an `app.bsky.feed.post` record, a repository write request,
or any object resembling `FedosValidatedAtprotoPost` from a
`FedosBoardPost`. The single data flow is `FedosValidatedAtprotoPost ->
FedosBoardPostInput -> FedosBoardPost`, never reversed.

## 4. Fail-closed, confirmed field by field

Every guard returns `null`, never throws (confirmed structurally — this
file contains zero `throw` statements):

- `post` not an object -> `null`.
- `post.uri`/`post.cid`/`post.authorDid` not a non-empty string ->
  `null`. (`cid`'s non-emptiness IS checked, per Alpha 282 §4 — it is
  simply never copied forward into the assembled `FedosBoardPostInput`.)
- `post.text` not a `string` -> `null`.
- `post.createdAt` not a `number` -> `null` (the seconds-domain check
  itself happens downstream in `validateFedosBoardPost`, Alpha 257, not
  duplicated here — same discipline as both prior adapters).
- `post.replyRootUri`/`post.replyParentUri`, when non-null, not a
  non-empty string -> `null`.
- `boardId` not a non-empty string -> `null`.
- Root-without-parent or parent-without-root -> `null` (Alpha 286 §4).
- Self-root contradiction (`replyRootUri === uri && replyParentUri !==
  uri`) -> `null` (Alpha 286 §4).
- Once a `FedosBoardPostInput` is built, `validateFedosBoardPost` runs
  its own full battery of checks (non-empty ids, self-reply/self-parent
  rejection, body length, timestamp domain, provenance shape) — a
  rejection there also surfaces as `validateAtprotoBoardPost` returning
  `null`.

## 5. No mutation, no network, no storage, no Runtime/Desktop/Worker/XRPC/repository access — confirmed

- `post` is only ever READ, field by field; no property of `post` is
  ever assigned.
- No `import` from `src/storage/`, `src/runtime/`, `src/desktop/*`, or
  `src/worker.ts`.
- No `fetch`, no `WebSocket`, no XRPC client of any kind, no async
  function — the whole file is synchronous, matching both prior
  adapters' own boundary purity exactly.

## 6. Composition, not duplication

`mapValidatedAtprotoPostToBoardPostInput` performs NO check
`validateFedosBoardPost` already performs on the ASSEMBLED
`FedosBoardPostInput` (self-reply/self-parent rejection, body length
ceiling, id non-emptiness on the FINAL branded values, timestamp
domain) — it only performs checks specific to INTERPRETING the
AT-Protocol-shaped input BEFORE that assembly (the root/parent pairing
rule, the self-root contradiction). This mirrors both prior adapters'
own division of labor exactly (Alpha 266 §4, Alpha 277 §6).

## 7. `cid` does not leak into generic metadata — confirmed

`cid` is read (for its own non-emptiness check, §4) but never appears in
the returned `FedosBoardPostInput` — confirmed by direct inspection: the
returned object literal has exactly the same eight
`id`/`boardId`/`threadId`/`replyTo`/`author`/`body`/`createdAt`/`source`
keys every other adapter's own return value has, with no ninth field of
any kind.

## 8. See also

- `docs/secure_runtime_alpha_283_atproto_source_provenance.md`
- `docs/secure_runtime_alpha_284_atproto_author_mapping.md`
- `docs/secure_runtime_alpha_285_atproto_body_mapping.md`
- `docs/secure_runtime_alpha_286_atproto_thread_reply_mapping.md`
- `docs/secure_runtime_alpha_277_activitypub_board_adapter.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
