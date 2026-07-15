# Secure Runtime Alpha 416 — Persisted Outbox Record V1 and Codec

Stage 6 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc. Implements `src/board/outbox/fedos_board_outbox_codec.ts`.

## 1. Record shape

```ts
export interface FedosPersistedBoardOutboxRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly postId: string;
  readonly target: {
    readonly protocol: FedosBoardOutboundProtocol;
    readonly destination: string | null;
  };
  readonly createdAt: number;
}
```

Mirrors `FedosPersistedBoardPostRecordV1`'s own relationship to
`FedosBoardPost` (Alpha 313) exactly: a STABLE WIRE SHAPE, deliberately
NOT the branded runtime `FedosBoardOutboxIntent` itself — branding is a
compile-time-only device and was never meant to be persisted directly.

## 2. Codec behavior

- `serializeFedosBoardOutboxIntent(intent)` deep-copies `intent` into a
  fresh plain object (`intent.target` is rebuilt field-by-field, never
  referenced) — no JSON step (matching `fedos_board_post_codec.ts`'s
  own Alpha 314 discipline: JSON only ever happens one layer further
  out, in the append-only backend).
- `deserializeFedosBoardOutboxIntent(record)` **fails closed to `null`
  for anything malformed and never throws.** Exact checks:
  - `schemaVersion` must be the literal `1` — no other value, no guess,
    no migration.
  - Top-level keys are restricted to exactly `schemaVersion`, `id`,
    `postId`, `target`, `createdAt` — any additional key REJECTS the
    record. Nested `target` keys are restricted to exactly `protocol`,
    `destination` — same rule.
  - `postId` must brand successfully via `toFedosBoardPostId` (Alpha
    252) — a blank or non-string `postId` rejects.
  - `target.protocol` must be one of the four
    `FedosBoardOutboundProtocol` literals (Alpha 413) — anything else
    rejects, closing the same class of "malformed protocol accepted"
    gap Alpha 314's own `isFedosBoardSourceProtocol` guard closes for
    Board posts.
  - `createdAt` must be a finite, non-negative integer — an invalid
    timestamp rejects.
  - The final step reuses `createFedosBoardOutboxIntent` (Alpha 414,
    UNMODIFIED) rather than re-implementing its own validation — the
    same "one true constructor" discipline `fedos_board_post_codec.ts`
    already established by reusing `validateFedosBoardPost`.
  - **Extra defense beyond the Board-post codec's own precedent**: the
    record's own STORED `id` is re-checked against the id
    `createFedosBoardOutboxIntent` (via `makeFedosBoardOutboxId`,
    deterministic — Alpha 413) actually derives from `postId`/`target`.
    A hand-edited or corrupted log line whose `id` no longer matches
    its own `postId`/`target` is rejected, not silently trusted.

## 3. Unknown-fields policy (explicit decision)

**Rejected, not silently ignored** — matching `fedos_board_post_codec.ts`'s
own Alpha 314 decision (§5 of that Stage's own design doc) exactly, for
the identical reason: an unknown field on a persisted record is either
data loss waiting to happen (if silently dropped, a future schema
migration could not distinguish "field never set" from "field silently
stripped") or a sign of a genuinely different, incompatible schema
version masquerading as `1`.

## 4. No Board-body duplication

Confirmed by direct inspection: this record's only reference to the
Board post it targets is the opaque `postId` string. No `body`,
`author`, `threadId`, `boardId`, or `createdAt`-of-the-post field is
ever read or written here — `createdAt` on this record names the
Outbox intent's OWN creation time (see Alpha 419 for why this Arc
chooses to reuse the post's own `createdAt` value at the Host
coordination layer, a caller-side decision this codec has no opinion
about).

## 5. See also

- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`
- `docs/secure_runtime_alpha_413_outbox_identifier_target_model.md`
- `docs/secure_runtime_alpha_414_immutable_outbox_intent_model.md`
