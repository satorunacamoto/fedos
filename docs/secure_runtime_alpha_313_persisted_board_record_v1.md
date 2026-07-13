# Secure Runtime Alpha 313 — Persisted Board Record V1

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/persistence/fedos_persisted_board_post_v1.ts`.** Stage 3 of
the Alpha 311–320 Canonical Board Persistence Boundary Arc.

## 1. Why now

Alpha 312 adopted Option A: persist `FedosBoardPost` directly through a
dedicated boundary. This Stage fixes the STABLE WIRE SHAPE that boundary
persists — deliberately NOT the branded runtime `FedosBoardPost` type
itself, reviewed below.

## 2. The shape

```ts
export interface FedosPersistedBoardPostRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly boardId: string;
  readonly threadId: string;
  readonly replyTo: string | null;
  readonly author: {
    readonly identityId: string | null;
    readonly protocol: FedosBoardSourceProtocol;
    readonly publicIdentifier: string;
  };
  readonly body: string;
  readonly createdAt: number;
  readonly source: {
    readonly protocol: FedosBoardSourceProtocol;
    readonly reference: string;
  };
}
```

Exactly this Arc's own candidate shape.

## 3. Why NOT persist the branded runtime object blindly

This Arc's own instruction requires reviewing this explicitly, not
assuming it. `FedosBoardPost.id`/`.boardId`/`.threadId`/`.replyTo` are
BRANDED types (`FedosBoardPostId`/`FedosBoardId`/`FedosThreadId`, Alpha
252) — a nominal-typing device that exists PURELY at compile time
(`string & { readonly __brand: ... }`); at runtime, a branded value IS
just a plain string, and `JSON.stringify`/persistence round-tripping
would silently erase the brand anyway. Persisting the RUNTIME TYPE
directly (rather than a dedicated wire shape) would:

- Couple the persisted record's own stability to the Canonical Board
  Model's own TypeScript type definitions, which are free to evolve
  their internal representation (Alpha 252 itself reserves that
  freedom) without any wire-format promise.
- Offer no explicit `schemaVersion` field — `FedosBoardPost` was never
  designed as a wire format (Alpha 255 defines APPLICATION semantics,
  not persistence semantics).

A dedicated `FedosPersistedBoardPostRecordV1` decouples "what shape does
the application hold in memory" (Alpha 255, frozen, unmodified by this
Arc) from "what shape does the persistence layer write to a backend"
(this Stage) — the SAME kind of adapter-boundary discipline this whole
series already applied between protocol wire objects and
`FedosBoardPost` itself (Alpha 261–300).

## 4. Requirements, confirmed by construction

- **Explicit `schemaVersion`** — the literal numeric type `1`, not a
  widened `number` — a value of `2` (or any other number) is a TYPE
  ERROR at construction, not merely a runtime check (see Alpha 314 for
  the runtime-side check against unknown future values).
- **Plain serializable data only** — every field is a `string`,
  `number`, `null`, or a plain nested object of the same — confirmed:
  `JSON.stringify`/`JSON.parse` round-trips this shape losslessly with
  no custom reviver/replacer needed.
- **No branded-type implementation details** — `id`/`boardId`/`threadId`/
  `replyTo` are plain `string`/`string | null`, never
  `FedosBoardPostId`/`FedosBoardId`/`FedosThreadId` (§3).
- **No `Map`/`Set`** — none present.
- **No functions** — none present; this file defines a TYPE ONLY.
- **No class instances** — none present.
- **No protocol wire object** — no Nostr tag array, ActivityPub Activity
  envelope, AT Protocol record, or Session message object of any kind.
- **No secret** — every field is already-public board content, matching
  `FedosBoardPost`'s own guarantee (Alpha 255) exactly.
- **No mutable nested arrays** — no array-typed field at all.
- **No feed/index data** — no rank, no order position, no thread-child
  list.
- **No ontology data** — no reference to `p2p/` or any ontology concept.
- **No transport state** — no relay URL, no connection state, no HTTP
  metadata.

## 5. Moderation records — deferred, never embedded casually

This Arc's own instruction offers three options: (A) persisted in the
same record, (B) a separate persistence record, (C) deferred, with (B)
or (C) preferred. **Adopted: (C), deferred.** Alpha 311 §3.8 already
confirmed `FedosBoardModerationRecord` (Alpha 258) has never been
constructed anywhere in this repository — there is no real moderation
record IN USE yet to design a persisted shape FOR. Inventing one now,
with no real producer or consumer, would be exactly the kind of
speculative addition this whole series has repeatedly declined (Alpha
255 §3, Alpha 272 §3, Alpha 282 §3). A future Stage that actually builds
moderation enforcement (explicitly out of scope for this Arc and every
prior one) would design its own persisted shape at that time — as a
SEPARATE record (Option B), matching `FedosBoardModerationRecord`'s own
established separation from `FedosBoardPost`, never embedded into
`FedosPersistedBoardPostRecordV1`.

## 6. See also

- `docs/secure_runtime_alpha_312_board_persistence_responsibility_decision.md`
- `docs/secure_runtime_alpha_252_canonical_board_identifiers.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_258_moderation_deletion_boundary.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`
