# Secure Runtime Alpha 294 — Session Body Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedSessionPostToBoardPostInput` at Alpha 297.** Stage 4 of the
Alpha 291–300 Session Canonical Board Gateway Adapter Arc.

## 1. Why now

Alpha 292 §5 already established that `FedosValidatedSessionPost.body`
is plain text by this type's own contract — no rich-content shape of
any kind. This Stage fixes the remaining body-mapping rules and confirms
no ActivityPub-style markup guard is needed here, the same conclusion
already reached for Nostr (Alpha 263) and AT Protocol (Alpha 285).

## 2. The mapping

```
post.body  ->  FedosBoardPost.body   (verbatim string, no transformation)
```

A straight passthrough — the simplest possible body mapping, matching
Nostr's `content` → `body` (Alpha 263) and AT Protocol's `text` → `body`
(Alpha 285) in shape.

## 3. Rules confirmed, per this Arc's own instruction, verbatim

- **No processing of any kind ("加工禁止").**
- **No Markdown conversion ("Markdown禁止").**
- **No HTML conversion ("HTML禁止").**
- **No Emoji conversion ("Emoji変換禁止").**

Confirmed structurally: `mapValidatedSessionPostToBoardPostInput`
(Alpha 297) performs a direct field copy of `post.body` into the
returned `FedosBoardPostInput.body` — no string transformation function
of any kind is called on it anywhere in `src/board/session/`.

## 4. No markup guard — consistent with Nostr and AT Protocol, not
ActivityPub

Alpha 275 §4 (prior-prior-Arc) added ONE minimal, non-parsing guard to
the ActivityPub Adapter specifically because ActivityPub's `Note.content`
IS HTML by protocol design and no safe upstream normalizer existed at
the time. This Arc's own `FedosValidatedSessionPost.body` carries no
such risk — it is a plain-text field by this type's own contract (Alpha
292 §5), the SAME situation Nostr's `content` and AT Protocol's `text`
already were in. No markup-character guard is added here, matching
Alpha 285 §3's own identical reasoning for AT Protocol.

## 5. Board validation owns empty/size rejection — not duplicated

`validateFedosBoardPost` (Alpha 257, unmodified) enforces the non-empty
minimum and the 10,000-character ceiling; this adapter does not
duplicate, loosen, or tighten either check, matching all three prior
adapters' own established discipline exactly (Alpha 263 §3, Alpha 275
§4, Alpha 285 §4).

## 6. See also

- `docs/secure_runtime_alpha_292_normalized_session_post_model.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_263_nostr_body_mapping.md`
- `docs/secure_runtime_alpha_285_atproto_body_mapping.md`
