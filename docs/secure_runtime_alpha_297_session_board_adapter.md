# Secure Runtime Alpha 297 — Session Board Adapter Implementation

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/session/fedos_session_board_adapter.ts`.** Stage 7 of the
Alpha 291–300 Session Canonical Board Gateway Adapter Arc.

## 1. Why now

Alpha 292–296 fixed every mapping decision (normalized input shape,
author, body, thread, source). This Stage assembles them into the
adapter itself, following the established two-step pattern
(`fedos_board_nostr_adapter.ts`, Alpha 266;
`fedos_activitypub_board_adapter.ts`, Alpha 277;
`fedos_atproto_board_adapter.ts`, Alpha 287) for the fourth and final
time.

## 2. The two exported functions

```ts
export function mapValidatedSessionPostToBoardPostInput(
  post: FedosValidatedSessionPost,
  boardId: string,
): FedosBoardPostInput | null

export function validateSessionBoardPost(
  post: FedosValidatedSessionPost,
  boardId: string,
): FedosBoardPost | null
```

`validateSessionBoardPost` composes `mapValidatedSessionPostToBoardPostInput`
(this file, ALL Session-specific interpretation) with
`validateFedosBoardPost` (`../fedos_board_post_validator.js`, Alpha 257,
unmodified) — the IDENTICAL two-step shape all three prior adapters
already established. This Arc's own instruction states this explicitly:
"既存 `validateFedosBoardPost()` のみ利用" ("use ONLY the existing
`validateFedosBoardPost()`") — confirmed: no second validation function
of any kind is written.

`boardId: string`, matching every prior adapter's own actual, shipped
signature.

## 3. One-way only, confirmed

This Arc's own boundary diagram is explicit: `FedosValidatedSessionPost`
→ Session Board Adapter → `FedosBoardPost`, and nothing else. Confirmed
by direct inspection: no function in this file accepts a
`FedosBoardPost` and returns anything Session-shaped; no function
constructs a Session message, an Oxen network frame, or any object
resembling `FedosValidatedSessionPost` from a `FedosBoardPost`.

## 4. Fail-closed, confirmed field by field

Every guard returns `null`, never throws (confirmed structurally — this
file contains zero `throw` statements):

- `post` not an object -> `null`.
- `post.messageId`/`post.sessionId`/`post.authorId` not a non-empty
  string -> `null`. (`sessionId`'s non-emptiness IS checked, per Alpha
  292 §3 — it is simply never copied forward into the assembled
  `FedosBoardPostInput`, the identical treatment Alpha 287 §4 already
  gave AT Protocol's `cid`.)
- `post.body` not a `string` -> `null`.
- `post.createdAt` not a `number` -> `null` (the seconds-domain check
  itself happens downstream in `validateFedosBoardPost`, Alpha 257, not
  duplicated here — same discipline as every prior adapter).
- `post.replyTo`, when non-null, not a non-empty string -> `null`.
- `boardId` not a non-empty string -> `null`.
- Once a `FedosBoardPostInput` is built, `validateFedosBoardPost` runs
  its own full battery of checks (non-empty ids, self-reply rejection,
  body length, timestamp domain, provenance shape) — a rejection there
  also surfaces as `validateSessionBoardPost` returning `null`.

## 5. No mutation, no network, no storage, no Runtime/Desktop/Worker/GUI/Observation/Session-Oxen access — confirmed

Per this Arc's own Gateway Boundary Review requirement (Alpha 298),
verified here at the point of implementation:

- `post` is only ever READ, field by field; no property of `post` is
  ever assigned.
- No `import` from `src/storage/`, `src/runtime/`, `src/desktop/*`,
  `src/worker.ts`, `src/render/*`, or any Observation-related module.
- No `fetch`, no `WebSocket`, no Session/Oxen client of any kind, no
  async function — the whole file is synchronous, matching every prior
  adapter's own boundary purity exactly.

## 6. Composition, not duplication

`mapValidatedSessionPostToBoardPostInput` performs NO check
`validateFedosBoardPost` already performs on the ASSEMBLED
`FedosBoardPostInput` (self-reply rejection, body length ceiling, id
non-emptiness on the FINAL branded values, timestamp domain) — it only
performs checks specific to INTERPRETING the Session-shaped input BEFORE
that assembly (the root/reply Gateway contract, Alpha 295). This mirrors
every prior adapter's own division of labor exactly.

## 7. `sessionId` does not leak into generic metadata — confirmed

`sessionId` is read (for its own non-emptiness check, §4) but never
appears in the returned `FedosBoardPostInput` — confirmed by direct
inspection: the returned object literal has exactly the same eight
`id`/`boardId`/`threadId`/`replyTo`/`author`/`body`/`createdAt`/`source`
keys every other adapter's own return value has, with no ninth field of
any kind.

## 8. See also

- `docs/secure_runtime_alpha_293_session_author_mapping.md`
- `docs/secure_runtime_alpha_294_session_body_mapping.md`
- `docs/secure_runtime_alpha_295_session_thread_mapping.md`
- `docs/secure_runtime_alpha_296_session_source_mapping.md`
- `docs/secure_runtime_alpha_287_atproto_board_adapter.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
