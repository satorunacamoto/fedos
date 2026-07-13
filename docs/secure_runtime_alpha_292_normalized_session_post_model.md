# Secure Runtime Alpha 292 — Normalized Session Post Model

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/session/fedos_validated_session_post.ts`.** Stage 2 of the
Alpha 291–300 Session Canonical Board Gateway Adapter Arc.

## 1. Why now

Alpha 291's own inventory confirmed no normalized Session type exists
anywhere in this repository, and confirmed `FedosBoardSourceProtocol`
already anticipates a Gateway-shaped `"session"` reference. This Stage
fixes the smallest immutable normalized input model the Session Board
Adapter (Alpha 297) will consume.

## 2. The shape

```ts
export interface FedosValidatedSessionPost {
  readonly messageId: string;
  readonly sessionId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: number;
  readonly replyTo: string | null;
}
```

Exactly the six fields this Arc's own instruction names — no more.

## 3. `sessionId` vs. `authorId` — two different identifiers, not a
redundancy

This Arc's own instruction maps `authorId` → `FedosBoardAuthorReference.publicIdentifier`
(Alpha 293) and `messageId` → `FedosBoardSourceReference.reference`
(Alpha 296) — it names no destination for `sessionId` at all. This is
deliberate, not an omission: `sessionId` is retained on the input type
for the SAME reason AT Protocol's `cid` was (Alpha 282 §4, Alpha 283
§2/§7, prior Arc) — a piece of Gateway-side provenance context worth
carrying on the validated input, checked for basic well-formedness, but
never copied onto `FedosBoardPost` or `FedosBoardSourceReference`. It
names the Gateway-scoped session under which this message was ingested
(the Gateway's OWN connection/ingestion session — a transport-adjacent
fact the Gateway already knows), distinct from `authorId` (the
message's actual publisher identity, per Alpha 293). Mirroring AT
Protocol's identity/content-version split, this Arc keeps
identity (`authorId`) and Gateway-ingestion-context (`sessionId`)
structurally separate on the input type, even though only the former
crosses into the Canonical Board Model.

## 4. Prohibited fields — reviewed and rejected

Per this Arc's own instruction, verbatim: Attachment, Group, Reaction,
Voice, and Typing fields are ALL prohibited. None is added — none was a
candidate to begin with (this Arc's own instruction lists the type's
COMPLETE field set as exactly six, with no "optional fields" clause of
the kind Alpha 272/282 (ActivityPub/AT Protocol) were given). This
matches `FedosBoardPost`'s own established discipline (Alpha 255 §3):
no speculative field is added merely because the source protocol/app
might support it.

## 5. Minimum guarantees, confirmed by direct inspection

- **Immutable** — every field `readonly`.
- **No raw Session/Oxen protocol object** — no onion-routing envelope,
  no Oxen network message frame, no arbitrary payload bag.
- **No auth/session credential of any kind** — no key, token, or
  credential field; `sessionId` (§3) is an opaque Gateway-scoped
  reference STRING, never a credential.
- **No mutable arrays by reference** — no array-typed field at all this
  Arc.
- **Unix-seconds `createdAt`** — matching `FedosBoardPost.createdAt`'s
  own established convention (Alpha 251 §3.7) exactly.
- **Plain-text `body`** — no rich content shape; see Alpha 294.
- **Validated upstream by convention and module placement** — like
  `FedosValidatedNostrEvent`, `FedosValidatedActivityPubPost`, and
  `FedosValidatedAtprotoPost`, this file defines a TYPE ONLY; it is not
  this Stage's job (and not this Arc's job at all — this Arc has NO
  responsibility before the Gateway, per Alpha 291 §4's own conclusion)
  to construct real values of it from live Session traffic.

## 6. See also

- `docs/secure_runtime_alpha_291_existing_session_inventory.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_282_normalized_atproto_post_model.md`
- `docs/secure_runtime_alpha_296_session_source_mapping.md`
