# Secure Runtime Alpha 263 — Nostr Body Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedNostrEventToBoardPostInput` at Alpha 266.** Stage 3 of the
Alpha 261–270 Nostr Canonical Board Adapter Arc.

## 1. Why now

Alpha 261's own field mapping table named `content` → `body` as a
renamed, exact-value field. This Stage fixes exactly what "exact value"
means before Alpha 266 implements it.

## 2. The mapping

```
event.content  ->  FedosBoardPost.body   (verbatim string, no transformation)
```

## 3. Transport, not rendering

Per this Arc's own instruction, verbatim: "No Markdown conversion. No
HTML. No rendering. No formatting. Just transport." Confirmed:

- No Markdown parser or renderer is imported or invoked.
- No HTML sanitizer, escaper, or parser is imported or invoked (matching
  `FedosBoardPost.body`'s own standing guardrail, Alpha 255: "HTML
  ingestion is out of scope").
- No whitespace trimming, no case normalization, no Unicode
  normalization (NFC/NFKC/etc.) of any kind — `event.content` is copied
  character-for-character.
- No truncation performed BY THIS ADAPTER. The Canonical Board Model's
  own validation boundary (`validateFedosBoardPost`, Alpha 257) already
  enforces `FEDOS_BOARD_POST_MAX_BODY_LENGTH` (10,000 UTF-16 code units)
  and a non-empty minimum — this adapter does not duplicate, loosen, or
  tighten that check; it only forwards `content` and lets the existing
  Board-model boundary decide.

## 4. A named, honest limitation — not a silent one

A real Nostr kind:1 event's `content` has no length limit at the
protocol level (individual relays commonly impose their own caps, but
NIP-01 itself does not). `validateFedosBoardPost`'s 10,000-character
ceiling (Alpha 257, chosen "well above a Nostr kind:1 text note's
typical size") means an unusually long `content` value causes
`validateNostrBoardPost` to return `null` — the whole post is REJECTED,
not truncated. This is a deliberate consequence of composing with the
already-fixed Board-model boundary rather than inventing adapter-local
truncation logic (which this Arc's own instruction would treat as
"inventing semantics"); it is named here explicitly rather than
discovered as a surprise later.

## 5. Empty content

An `event.content` of `""` (the empty string) causes
`validateFedosBoardPost` to reject the post (its own minimum body length
is 1) — again, a consequence of composing with the existing boundary,
not special-cased by this adapter. A real kind:1 event with empty
content is unusual but protocol-legal; this Arc's own scope does not
special-case it into some alternate representation (e.g. a
content-warning-only post) — that would be inventing semantics this
Arc's own instruction forbids.

## 6. See also

- `docs/secure_runtime_alpha_261_nostr_board_field_inventory.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
