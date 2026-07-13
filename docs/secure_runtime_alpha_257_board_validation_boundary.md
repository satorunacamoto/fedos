# Secure Runtime Alpha 257 — Canonical Board Validation Boundary

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/fedos_board_post_validator.ts`.** Stage 7 of the Alpha
251–260 Canonical Board Model Foundation Arc.

## 1. Why now

Alpha 252–256 fixed every field and invariant `FedosBoardPost` (Alpha
255) needs. This Stage builds the ONE function permitted to construct a
value of that type — the boundary a future Protocol Adapter (out of
scope this Arc) will call after its own protocol-specific verification
already ran.

## 2. Boundary shape — the three options and the adopted one

- **Option A — `unknown`-input parser.** `validateFedosBoardPost(input:
  unknown): FedosBoardPost | null`.
- **Option B — typed builder.** A specific input interface, not
  `unknown`.
- **Option C — both.**

**Adopted: Option B**, "the smallest boundary needed by future protocol
adapters," per this Arc's own instruction. Rationale: a future Protocol
Adapter (Alpha 260's own recommended next Arc, for Nostr specifically)
always starts from an ALREADY-TYPED, already-verified native object — a
`FedosValidatedNostrEvent` (Alpha 242), a verified ActivityPub object, an
AT Protocol record, a Session gateway message. Nothing in this Arc's own
scope ever hands this boundary a raw `unknown` (a JSON blob straight off
the wire, unparsed) — that parsing step is each protocol's own concern,
already solved for Nostr by `FedosNostrWireEvent`
(`src/desktop/fedos_nostr_wire_event.ts`, Alpha 234) and
`validateInboundNostrEvent` (`src/desktop/combined_inbound_event_validator.ts`,
Alpha 245) upstream of where a board adapter would ever begin. An
`unknown`-input parser here would duplicate work every real caller has
already done, for no caller this Arc actually has.

## 3. The typed input shape

```ts
export interface FedosBoardPostInput {
  readonly id: string;
  readonly boardId: string;
  readonly threadId: string;
  readonly replyTo: string | null;
  readonly author: {
    readonly identityId: string | null;
    readonly protocol: string;
    readonly publicIdentifier: string;
  };
  readonly body: string;
  readonly createdAt: number;
  readonly source: {
    readonly protocol: string;
    readonly reference: string;
  };
}
```

Every field is a PLAIN, UNBRANDED primitive — `protocol` is a plain
`string` here (not yet `FedosBoardSourceProtocol`), because the whole
point of this boundary is to be the ONE place that checks and brands
every field; a caller that already had a `FedosBoardSourceProtocol`
value would gain nothing from this boundary re-checking a value the type
system already guarantees, but a caller mapping from an untyped native
object (an ActivityPub JSON object, say) needs exactly this widened
"maybe correct" shape to hand over for checking.

## 4. `validateFedosBoardPost` — requirements confirmed

```ts
export function validateFedosBoardPost(
  input: FedosBoardPostInput,
): FedosBoardPost | null
```

- **Fail closed** — every rejection path returns `null`; there is no
  path that returns a partially-populated or best-effort value.
- **No implicit coercion** — `typeof` checks reject a wrong-typed field
  outright (e.g. a numeric `id` is rejected, never `String()`-coerced).
- **No thrown exception** — no `throw` appears anywhere in this file;
  every failure is a `return null`.
- **Non-empty IDs** — `id`, `boardId`, `threadId`, and (when present)
  `replyTo` must each be non-empty (post-trim) before being handed to
  `toFedosBoardPostId`/`toFedosBoardId`/`toFedosThreadId` (Alpha 252),
  which independently re-confirm non-emptiness.
- **Valid timestamp domain** — `createdAt` must be a finite integer
  within `[FEDOS_BOARD_POST_MIN_CREATED_AT, FEDOS_BOARD_POST_MAX_CREATED_AT]`
  (2020-01-01T00:00:00Z through year 3000, in Unix seconds — see Alpha
  251 §3.7 for why the ceiling is set to also reject an accidental
  milliseconds value).
- **Body size limit formally decided** — `FEDOS_BOARD_POST_MAX_BODY_LENGTH
  = 10_000` UTF-16 code units. Chosen as a generous ceiling well above a
  Nostr kind:1 text note's typical size (relays commonly cap far lower)
  while still bounding worst-case memory/storage cost for a single post;
  a `body` must also be non-empty (`length >= 1`) — an empty post carries
  no content and, with attachments out of scope this Arc, would be
  meaningless.
- **No title size limit** — no `title` field exists this Arc (Alpha 256
  §1), so there is nothing to bound.
- **Reply invariants checked** — the ONE invariant checkable from a
  single post's own fields (Alpha 256 §4): `replyTo !== id` (a post
  cannot reply to itself). The remaining invariants (same-board reply,
  cycle detection, missing-parent handling) are explicitly Board
  Application Logic's responsibility — see Alpha 256 §4–5 for the full
  per-invariant table.
- **Provenance checked** — both `author.protocol` and `source.protocol`
  are checked against `isFedosBoardSourceProtocol` (Alpha 253);
  `author.publicIdentifier` and `source.reference` must be non-empty.
- **Deep-copy mutable nested values** — the returned `author` and
  `source` objects are REBUILT field-by-field from `input`'s own nested
  objects, never returned by reference to `input.author`/`input.source`
  — mutating `input` after calling this function cannot affect the
  returned `FedosBoardPost`.
- **Freeze output** — the top-level `FedosBoardPost`, the nested
  `author`, and the nested `source` are each `Object.freeze`'d, matching
  `validateInboundNostrEvent`'s own convention
  (`src/desktop/combined_inbound_event_validator.ts`, Alpha 245).
- **No protocol-specific cryptographic verification** — no signature
  check, no event-id recomputation, no hashing of any kind appears in
  this file. "Protocol adapters must perform protocol verification
  before invoking this boundary" (this Arc's own instruction, verbatim)
  — confirmed by this file carrying zero import from `src/nostr/`,
  `src/desktop/`, or `src/crypto/`.
- **No network** — confirmed; no `fetch`, no WebSocket, no async
  function of any kind exists in this file (`validateFedosBoardPost`
  itself is synchronous).
- **No storage** — confirmed; no import from `src/storage/`, no
  persistence call of any kind.

## 5. See also

- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_245_combined_inbound_event_validator.md`
