# Secure Runtime Alpha 285 — AT Protocol Body Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedAtprotoPostToBoardPostInput` at Alpha 287.** Stage 5 of
the Alpha 281–290 AT Protocol Canonical Board Adapter Arc.

## 1. Why now

Alpha 282 §5 already established that `text` is plain UTF-8 by Lexicon
schema design — the HTML-normalization problem Alpha 275 had to solve
for ActivityPub simply does not arise for AT Protocol. This Stage fixes
the remaining body-mapping rules and confirms no ActivityPub-style
markup guard is needed here.

## 2. The mapping

```
post.text  ->  FedosBoardPost.body   (verbatim string, no transformation)
```

A straight passthrough, identical in shape to Nostr's `content` → `body`
mapping (Alpha 263) — the simplest of the three adapters' body mappings,
since AT Protocol's own `text` field was never HTML to begin with.

## 3. No ActivityPub-style markup guard — and why that is correct here

Alpha 275 §4 added ONE minimal, non-parsing guard to the ActivityPub
Adapter specifically because ActivityPub's `Note.content` IS HTML by
protocol design and no safe upstream normalizer exists yet in this
repository. `app.bsky.feed.post.text` carries no such risk: it is a
plain string field in the Lexicon schema itself — a conforming AT
Protocol client cannot legally populate it with markup meant to be
rendered as HTML (rich formatting is expressed separately, via
`facets` — byte-range annotations layered OVER the plain `text`, never
by embedding tags inside `text` itself). Adding a markup-character guard
here would be solving a problem AT Protocol's own protocol design
already prevents — this Stage explicitly declines to add one.

## 4. Rules confirmed, per this Arc's own instruction, verbatim

- **Plain text verbatim** — confirmed, §2.
- **No rich-text rendering.**
- **No facet expansion** — moot regardless: `FedosValidatedAtprotoPost`
  (Alpha 282 §3) carries no `facets` field at all, so there is nothing
  to expand even in principle.
- **No URL preview.**
- **No mention resolution.**
- **No hashtag extraction.**
- **No embed rendering** — moot regardless: no embed-reference field
  exists on the type (Alpha 282 §3).
- **No Markdown conversion.**
- **No HTML conversion.**
- **No Unicode normalization unless an existing repository-wide rule
  requires it** — none exists: neither the Nostr Adapter (Alpha 263) nor
  the ActivityPub Adapter (Alpha 275) performs any Unicode normalization
  (NFC/NFKC/etc.) of `body`, and this Stage introduces no new
  repository-wide rule that would require it here either.
- **Board validation owns empty/size rejection** — `validateFedosBoardPost`
  (Alpha 257, unmodified) enforces the non-empty minimum and the
  10,000-character ceiling; this adapter does not duplicate, loosen, or
  tighten either check, matching both prior adapters' own established
  discipline exactly (Alpha 263 §3, Alpha 275 §4).

## 5. Facets — reviewed, confirmed inert this Arc

"Facets may be reviewed as future presentation metadata, but they must
not alter the canonical body in this Arc." Confirmed: `facets` is not a
field on `FedosValidatedAtprotoPost` (Alpha 282 §3) — there is no
mechanism by which a facet COULD alter `body` even if one were supplied,
since the type this adapter consumes structurally excludes it. A future
Stage that wants to surface facet-derived presentation hints (e.g. "this
byte range is a link") would do so on a SEPARATE, presentation-layer
type — never by mutating or re-deriving `FedosBoardPost.body` itself.

## 6. No embedded-record or blob fetching

"Do not fetch embedded records or blobs." Confirmed by construction: no
embed-reference field exists on the input type to fetch FROM, and the
adapter performs no network call of any kind (Alpha 287 §5).

## 7. See also

- `docs/secure_runtime_alpha_282_normalized_atproto_post_model.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_263_nostr_body_mapping.md`
- `docs/secure_runtime_alpha_275_activitypub_body_mapping.md`
