# Secure Runtime Alpha 272 — Normalized ActivityPub Post Model

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/activitypub/fedos_validated_activitypub_post.ts`.** Stage 2
of the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.

## 1. Why now

Alpha 271's own inventory confirmed no normalized ActivityPub type
exists anywhere in this repository, and confirmed this repository has
NO HTML sanitization capability of any kind (§3.5). This Stage fixes
the smallest immutable normalized input model the ActivityPub Board
Adapter (Alpha 277) will consume, and fixes the content-format question
this Arc's own instruction requires an explicit answer to.

## 2. The shape

```ts
export interface FedosValidatedActivityPubPost {
  readonly objectId: string;
  readonly actorId: string;
  readonly content: string;
  readonly published: number;
  readonly inReplyTo: string | null;
  readonly conversationRoot: string | null;
}
```

Exactly the six fields this Arc's own candidate names — no more.

## 3. Optional fields — reviewed and rejected

`summary`, `sensitive`, `language`, attachment references, and `updated`
were all named as CANDIDATES, conditional on inventory proving they are
"already validated and needed." Alpha 271 found ZERO existing
ActivityPub validation code of any kind (§3.1–§3.4) — nothing in this
repository already validates any of these five fields, so none is
added. This also matches `FedosBoardPost`'s own established discipline
(Alpha 255 §3): no speculative field is added merely because one source
protocol supports it. A future Stage may add any of these once a real
upstream normalizer exists to actually populate them safely.

## 4. The content-format decision — Option A adopted

This Arc's own instruction requires stating explicitly whether `content`
is:

- **A. sanitized plain text**
- B. sanitized HTML
- C. original HTML

**Adopted: Option A — sanitized plain text.** This is the ONLY option
consistent with `FedosBoardPost.body`'s own existing, unmodified
contract (Alpha 255: "`body` is plain text ONLY for this Arc... HTML
ingestion is out of scope") and with this Arc's own Absolute
Prohibitions ("HTML parser addition," "HTML sanitizer addition" are both
forbidden). Options B and C would require either shipping an HTML
sanitizer (prohibited) or accepting raw HTML onto a field the Canonical
Board Model has never supported (would require redesigning
`FedosBoardPost`, itself prohibited — "Already complete and MUST NOT be
redesigned").

`FedosValidatedActivityPubPost.content`'s contract is therefore: THE
CALLER MUST supply already-plain-text, HTML-free content — the SAME
"validated upstream by convention and module placement" discipline
`FedosValidatedNostrEvent` already established (Alpha 242), extended
here to cover HTML normalization specifically, which Nostr never needed
(NIP-01 `content` is plain text by protocol design; ActivityPub `Note.content`
is HTML by protocol design, so an ActivityPub-specific normalization
step is unavoidable — but it happens BEFORE this type is constructed,
never inside `src/board/`).

## 5. No safe upstream normalizer exists yet — the required consequence

Per this Arc's own instruction: "If no safe upstream plain-text
normalizer exists: implement no HTML parser here, fail closed for
unsanitized HTML input, document the required upstream normalization
boundary." Alpha 271 §3.5 confirmed none exists. Consequently:

- This file adds NO HTML parsing, stripping, or sanitization logic of
  any kind — it is a TYPE ONLY, exactly like `FedosValidatedNostrEvent`.
- The ActivityPub Board Adapter (Alpha 277) adds ONE minimal, explicitly
  non-parsing guard — see Alpha 275 §4 — as a fail-closed backstop, not
  a sanitizer.
- **The required upstream normalization boundary, named explicitly:** a
  future, separate layer (out of scope this Arc, living ABOVE `src/board/`
  per this Arc's own Architecture Rules — "ActivityPub transport/
  validation: ... content normalization") MUST convert `Note.content`'s
  real HTML into plain text (e.g. stripping tags, decoding entities,
  preserving line breaks as newlines) BEFORE ever constructing a
  `FedosValidatedActivityPubPost`. Until that layer exists, no real
  ActivityPub content can safely reach this Arc's own adapter — this Arc
  ships the CONTRACT and the CONSUMER of that future normalizer's
  output, not the normalizer itself.

## 6. Minimum guarantees, confirmed by direct inspection

- **No raw Activity object** — no `Create`/`Update`/`Delete`/`type`
  field of any kind.
- **No raw HTTP headers, no HTTP Signature object** — no field named or
  shaped like either.
- **No OAuth token, no access token, no session cookie** — none present.
- **No arbitrary JSON-LD graph** — no `@context`, no nested object
  graph; every field is a primitive (`string`, `string | null`, or
  `number`).
- **No mutable arrays** — no array-typed field at all this Arc.
- **No metadata bag** — no `Record<string, unknown>`, no index
  signature.
- **Unix-seconds timestamp** — `published: number`, matching
  `FedosBoardPost.createdAt`'s own established convention (Alpha 251
  §3.7) exactly; no millisecond or ISO-string form.
- **Immutable** — every field `readonly`.
- **Validated upstream by convention and module placement** — like
  `FedosValidatedNostrEvent`, this file defines a TYPE ONLY; it is not
  this Stage's job (and not this Arc's job at all) to construct real
  values of it from live ActivityPub traffic.

## 7. See also

- `docs/secure_runtime_alpha_271_existing_activitypub_inventory.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_242_validated_nostr_event_model.md`
- `docs/secure_runtime_alpha_275_activitypub_body_mapping.md`
