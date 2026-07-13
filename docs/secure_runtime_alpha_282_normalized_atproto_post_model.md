# Secure Runtime Alpha 282 — Normalized AT Protocol Post Model

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/atproto/fedos_validated_atproto_post.ts`.** Stage 2 of the
Alpha 281–290 AT Protocol Canonical Board Adapter Arc.

## 1. Why now

Alpha 281's own inventory confirmed no normalized AT Protocol type
exists anywhere in this repository. This Stage fixes the smallest
immutable normalized input model the AT Protocol Board Adapter (Alpha
287) will consume.

## 2. The shape

```ts
export interface FedosValidatedAtprotoPost {
  readonly uri: string;
  readonly cid: string;
  readonly authorDid: string;
  readonly text: string;
  readonly createdAt: number;
  readonly replyRootUri: string | null;
  readonly replyParentUri: string | null;
}
```

Exactly the seven fields this Arc's own candidate names — no more.

## 3. Optional fields — reviewed and rejected

`langs`, `facets`, embed references, `labels`, record collection, and
record key were all named as CANDIDATES, conditional on inventory
proving them "already validated and needed." Alpha 281 found ZERO
existing AT Protocol validation code of any kind (§3.1–§3.9) — nothing
in this repository already validates any of these six fields. Per this
Arc's own explicit default rule — "Do not include optional fields merely
because Bluesky supports them" — none is added. This continues the
identical discipline `FedosValidatedActivityPubPost` already applied
(Alpha 272 §3) and `FedosBoardPost` itself established first (Alpha 255
§3).

## 4. `cid` — retained on the input type, never on `FedosBoardPost`

Unlike Nostr (no content-hash concept beyond the event id itself) and
ActivityPub (no content-hash concept at all in this Arc's scope), AT
Protocol's own record model separates IDENTITY (the AT URI, naming a
slot in a repository) from CONTENT VERSION (the CID, a hash of that
slot's current bytes). `cid` is retained on `FedosValidatedAtprotoPost`
because Alpha 283 needs it available for the provenance decision and
Alpha 288 needs it available for a future revision-observation model —
but it is NOT copied onto `FedosBoardSourceReference` or anywhere else
on `FedosBoardPost` (Alpha 283 §2 confirms this explicitly: "CID does
not leak into generic metadata").

## 5. Plain-text content — no HTML-normalization concern, unlike ActivityPub

`text` on `app.bsky.feed.post` is plain UTF-8 text by Lexicon schema
design — AT Protocol has no HTML-content field at all, unlike
ActivityPub's `Note.content` (Alpha 272 §4's own three-way
plain-text/HTML choice does not even arise here). `text`'s contract is
therefore the SAME simple one `FedosValidatedNostrEvent.content` already
carries (Alpha 242): validated upstream by convention, no
sanitization/normalization step required by protocol design. See Alpha
285 for the full body-mapping decision.

## 6. Minimum guarantees, confirmed by direct inspection

- **Immutable** — every field `readonly`.
- **No raw Lexicon object** — no `$type`, no nested record graph.
- **No XRPC response** — no HTTP status, no response envelope field.
- **No CAR block** — no repository block/proof field.
- **No repository proof** — none.
- **No auth token, no refresh token, no app password, no PDS session**
  — none present.
- **No arbitrary record bag** — no `Record<string, unknown>`, no index
  signature.
- **No mutable arrays by reference** — no array-typed field at all this
  Arc.
- **Unix-seconds `createdAt`** — matching `FedosBoardPost.createdAt`'s
  own established convention (Alpha 251 §3.7) exactly; no ISO-8601
  string (AT Protocol's own wire format) and no milliseconds.
- **Plain-text post content** — confirmed by §5.
- **Validated upstream by convention and module placement** — like
  `FedosValidatedNostrEvent` and `FedosValidatedActivityPubPost`, this
  file defines a TYPE ONLY; it is not this Stage's job (and not this
  Arc's job at all) to construct real values of it from live AT
  Protocol traffic.

## 7. The type represents only a verified `app.bsky.feed.post`-like input

Nothing about this type's own fields is Bluesky-app-specific — it names
exactly the shape any `app.bsky.feed.post`-COMPATIBLE record (Bluesky's
own client, or any other AT Protocol application publishing to that same
Lexicon) would normalize down to. No Bluesky-only field (e.g. a
Bluesky-specific label scheme) is present.

## 8. See also

- `docs/secure_runtime_alpha_281_existing_atproto_inventory.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_272_normalized_activitypub_post_model.md`
- `docs/secure_runtime_alpha_283_atproto_source_provenance.md`
