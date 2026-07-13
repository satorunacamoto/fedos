# Secure Runtime Alpha 277 — ActivityPub Board Adapter Implementation

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/activitypub/fedos_activitypub_board_adapter.ts`.** Stage 7
of the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.

## 1. Why now

Alpha 272–276 fixed every mapping decision (normalized input shape,
provenance, author, body, thread). This Stage assembles them into the
adapter itself, following the Nostr Adapter's own pattern
(`src/board/fedos_board_nostr_adapter.ts`, Alpha 266) "where honest."

## 2. The two exported functions

```ts
export function mapValidatedActivityPubPostToBoardPostInput(
  post: FedosValidatedActivityPubPost,
  boardId: string,
): FedosBoardPostInput | null

export function validateActivityPubBoardPost(
  post: FedosValidatedActivityPubPost,
  boardId: string,
): FedosBoardPost | null
```

`validateActivityPubBoardPost` composes
`mapValidatedActivityPubPostToBoardPostInput` (this file, ALL
ActivityPub-specific interpretation) with `validateFedosBoardPost`
(`../fedos_board_post_validator.js`, Alpha 257, unmodified) — the
IDENTICAL two-step shape `validateNostrBoardPost` already established
(Alpha 266 §2), confirming the pattern generalizes to a second protocol
exactly as Alpha 269 §4 (prior Arc) predicted.

**`boardId: string`, not `boardId: FedosBoardId`.** This Arc's own
candidate signature suggested a branded `FedosBoardId` parameter; this
Stage instead matches the Nostr Adapter's own actual, shipped signature
(`boardId: string`) exactly — "follow the Nostr Adapter pattern where
honest" (this Arc's own instruction) is read here as prioritizing
CONSISTENCY between the two adapters over exact adherence to a
`candidate` (explicitly labeled non-binding) signature. Branding still
happens exactly once, inside `validateFedosBoardPost`, for both
protocols identically.

## 3. One-way only, confirmed

Per this Arc's own instruction: "This Arc is one-way only... Do not
implement outbound federation in this Arc." Confirmed by direct
inspection: no function in this file accepts a `FedosBoardPost` and
returns anything ActivityPub-shaped; no function constructs a `Note`,
an `Activity` envelope, or any object resembling
`FedosValidatedActivityPubPost` from a `FedosBoardPost`. The single data
flow is `FedosValidatedActivityPubPost -> FedosBoardPostInput ->
FedosBoardPost`, never reversed.

## 4. Fail-closed, confirmed field by field

Every guard returns `null`, never throws (confirmed structurally — this
file contains zero `throw` statements):

- `post` not an object -> `null`.
- `post.objectId`/`post.actorId` not a non-empty string -> `null`.
- `post.content` not a `string` -> `null`.
- `post.published` not a `number` -> `null` (the seconds-domain check
  itself happens downstream in `validateFedosBoardPost`, Alpha 257, not
  duplicated here — same discipline as the Nostr Adapter, Alpha 266 §4).
- `post.inReplyTo`/`post.conversationRoot`, when non-null, not a
  non-empty string -> `null`.
- `boardId` not a non-empty string -> `null`.
- `post.content` contains a raw `<` or `>` character -> `null` (Alpha
  275 §4's fail-closed backstop — not an HTML parser).
- `post.inReplyTo !== null && post.conversationRoot === null` -> `null`
  (Alpha 276 §4, Option C).
- Once a `FedosBoardPostInput` is built, `validateFedosBoardPost` runs
  its own full battery of checks (non-empty ids, self-reply rejection,
  body length, timestamp domain, provenance shape) — a rejection there
  also surfaces as `validateActivityPubBoardPost` returning `null`.

## 5. No mutation, no network, no storage, no Runtime/Desktop/Worker/HTTP
access — confirmed

- `post` is only ever READ, field by field; no property of `post` is
  ever assigned.
- No `import` from `src/storage/`, `src/runtime/`, `src/desktop/*`
  (other than a type-only reference — none exists here at all, since
  `FedosValidatedActivityPubPost` lives inside `src/board/activitypub/`
  itself), or `src/worker.ts`.
- No `fetch`, no `WebSocket`, no HTTP client of any kind, no async
  function — the whole file is synchronous, matching the Nostr Adapter's
  own boundary purity (Alpha 268) exactly.

## 6. Composition, not duplication

`mapValidatedActivityPubPostToBoardPostInput` performs NO check
`validateFedosBoardPost` already performs on the ASSEMBLED
`FedosBoardPostInput` (self-reply rejection, body length ceiling, id
non-emptiness on the FINAL branded values, timestamp domain) — it only
performs checks specific to INTERPRETING the ActivityPub-shaped input
BEFORE that assembly (markup-character detection, the
conversationRoot-required-for-replies rule). This mirrors the Nostr
Adapter's own division of labor exactly (Alpha 266 §4).

## 7. See also

- `docs/secure_runtime_alpha_273_activitypub_source_provenance.md`
- `docs/secure_runtime_alpha_274_activitypub_author_mapping.md`
- `docs/secure_runtime_alpha_275_activitypub_body_mapping.md`
- `docs/secure_runtime_alpha_276_activitypub_thread_reply_mapping.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
