# Secure Runtime Alpha 266 — Nostr Board Adapter Implementation

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/fedos_board_nostr_adapter.ts`.** Stage 6 of the Alpha
261–270 Nostr Canonical Board Adapter Arc.

## 1. Why now

Alpha 261–265 fixed every mapping decision (field table, author, body,
thread, source). This Stage assembles them into the one function this
Arc exists to deliver.

## 2. The two exported functions

```ts
export function mapValidatedNostrEventToBoardPostInput(
  event: FedosValidatedNostrEvent,
  boardId: string,
): FedosBoardPostInput | null

export function validateNostrBoardPost(
  event: FedosValidatedNostrEvent,
  boardId: string,
): FedosBoardPost | null
```

`validateNostrBoardPost` is the Arc's own required entry point
(instruction: "Implement `validateNostrBoardPost()` (or equivalent)").
It is a two-line composition:
`mapValidatedNostrEventToBoardPostInput` (this file, ALL Nostr-specific
interpretation) followed by `validateFedosBoardPost`
(`./fedos_board_post_validator.ts`, Alpha 257, protocol-neutral
validation) — the SAME two-step shape every future Protocol Adapter
(ActivityPub, AT Protocol, Session) will also compose, established here
as the pattern for the first time.

`mapValidatedNostrEventToBoardPostInput` is exported separately (not
kept private) so Alpha 267 (determinism) and Alpha 268 (boundary review)
can exercise the pure mapping step in isolation from Board-model
validation.

## 3. One-way only, confirmed

Per this Arc's own instruction: "The adapter is one-way only ...
Never the reverse." Confirmed by direct inspection: no function in this
file accepts a `FedosBoardPost` and returns anything Nostr-shaped; no
function constructs an unsigned/signed Nostr event, a `NostrTag` array
in wire form, or any object resembling `FedosNostrWireEvent`. The single
data flow is `FedosValidatedNostrEvent -> FedosBoardPostInput ->
FedosBoardPost`, never reversed.

## 4. Fail-closed, confirmed field by field

Every guard returns `null`, never throws (confirmed structurally —
this file contains zero `throw` statements):

- `event` not an object -> `null`.
- `event.id`/`event.pubkey` not a non-empty string -> `null`.
- `event.created_at` not a `number` -> `null` (the domain check itself —
  seconds range, not milliseconds — happens downstream in
  `validateFedosBoardPost`, Alpha 257, not duplicated here).
- `event.kind !== 1` -> `null` (Alpha 264 §2).
- `event.tags` not an array -> `null`.
- `event.content` not a `string` -> `null`.
- `boardId` not a non-empty string -> `null`.
- Any e-tag whose id is not exactly 64 lowercase hex characters is
  dropped, not rejected outright (Alpha 264 §3) — the EVENT is still
  processed, just that one malformed tag reference is ignored.
- Once a `FedosBoardPostInput` is built, `validateFedosBoardPost` runs
  its own full battery of checks (non-empty ids, self-reply rejection,
  body length, timestamp domain, provenance shape) — a rejection there
  also surfaces as `validateNostrBoardPost` returning `null`.

## 5. No mutation, no storage, no network — confirmed

- `event` is only ever READ, field by field; no property of `event` is
  ever assigned, and no method that could mutate it is ever called.
- No `import` from `src/storage/` anywhere in this file.
- No `fetch`, no `WebSocket`, no async function of any kind — the whole
  file is synchronous.

## 6. See also

- `docs/secure_runtime_alpha_262_nostr_author_mapping.md`
- `docs/secure_runtime_alpha_263_nostr_body_mapping.md`
- `docs/secure_runtime_alpha_264_nostr_thread_mapping.md`
- `docs/secure_runtime_alpha_265_nostr_source_reference.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
