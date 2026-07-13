# Secure Runtime Alpha 275 — ActivityPub Body Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedActivityPubPostToBoardPostInput` at Alpha 277.** Stage 5 of
the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.

## 1. Why now

Alpha 272 §4 already decided `FedosValidatedActivityPubPost.content`'s
CONTRACT (sanitized plain text, Option A). This Stage decides how the
Board Adapter itself must BEHAVE given that contract, and what to do
about the fact that this repository cannot currently verify the
contract was honored.

## 2. The four options and the adopted one

- **Option A — preserve sanitized HTML.** Rejected: `FedosBoardPost.body`
  has never supported HTML (Alpha 255) and this Arc may not redesign it.
- **Option B — convert to plain text upstream, then map verbatim.**
  **Adopted**, exactly this Arc's own preferred candidate.
- **Option C — strip HTML inside the Board Adapter.** Rejected: this
  Arc's own Absolute Prohibitions forbid "HTML parser addition" and
  "HTML sanitizer addition" — stripping HTML correctly (handling nested
  tags, entities, `<br>`-to-newline conversion, script/style exclusion)
  requires exactly the kind of parser this Arc may not add. "HTML
  parsing/sanitization must not be hidden inside a protocol adapter"
  (this Arc's own instruction, verbatim) — Option C is precisely that
  anti-pattern.
- **Option D — store original HTML directly.** Rejected: same reasoning
  as Option A, and additionally unsafe (raw HTML reaching a future
  render layer with no guaranteed escaping step would be an XSS risk —
  `src/render/html.ts`'s own `escapeHtml`, Stage 3, assumes its input is
  ALREADY plain text; feeding it real HTML would double-escape it,
  corrupting the very markup features Option D would exist to
  preserve, while STILL not rendering as real HTML).

## 3. The mapping

```
post.content  ->  FedosBoardPost.body   (verbatim string, no transformation)
```

Identical in shape to Alpha 263's own Nostr `content` → `body` mapping —
a straight passthrough. The DIFFERENCE from Nostr is entirely upstream
of this adapter: Nostr's `content` is plain text by protocol design
(NIP-01), so no normalization step was ever needed before Alpha 263;
ActivityPub's `Note.content` is HTML by protocol design, so Alpha 272's
own contract (content MUST already be plain text by the time it reaches
`FedosValidatedActivityPubPost`) carries the weight Nostr never needed.

## 4. No safe upstream normalizer exists — the fail-closed backstop

Alpha 271 §3.5 confirmed no HTML-to-plain-text normalizer exists
anywhere in this repository. Per this Arc's own instruction: "fail
closed for unsanitized HTML input." The adapter (Alpha 277) therefore
adds ONE minimal, explicitly-scoped guard:

```ts
function containsRawMarkupCharacter(content: string): boolean {
  return content.includes("<") || content.includes(">");
}
```

If `post.content` contains a literal `<` or `>` character, the WHOLE
mapping is rejected (`null`) — the adapter does not attempt to strip,
escape, or otherwise transform the content. This is deliberately **NOT**
an HTML parser or sanitizer:

- It performs no tokenization, no tag-tree construction, no attribute
  parsing, no entity decoding.
- It produces no transformed output — its only possible effects are
  "accept unchanged" or "reject."
- It is the same category of check `validateFedosBoardPost` (Alpha 257)
  already performs elsewhere (`body.length` bounds, non-empty checks) —
  a boolean predicate over a string, not a parser.

**A named, honest limitation, not a silent one:** this guard will also
reject legitimate plain text that happens to contain a literal `<` or
`>` character (e.g. "x < y", "see <this>", a code snippet). This is an
ACCEPTED tradeoff: given no safe normalizer exists to distinguish "real
markup that slipped through" from "plain text that happens to contain an
angle bracket," failing closed on BOTH is the only choice consistent
with this Arc's own instruction and its Absolute Prohibitions. A future
Stage that builds the real upstream normalizer (Alpha 272 §5) removes
the false-positive cost entirely, since correctly-normalized content
would never legitimately need a raw `<`/`>` (a real "less than" sign
would already be HTML-entity-decoded to a literal character by that
point — except that IS a literal `<` character, which is exactly why
this guard is a deliberately blunt, temporary backstop, not a permanent
design commitment).

## 5. Explicitly out of scope, confirmed absent (verbatim from this
Arc's own instruction)

- **No Markdown conversion.**
- **No rendering.**
- **No link preview.**
- **No emoji expansion.**
- **No attachment download.**

None of the five appears anywhere in `src/board/activitypub/` — the
adapter's entire body-handling logic is the one guard function above
plus a verbatim field copy.

## 6. See also

- `docs/secure_runtime_alpha_272_normalized_activitypub_post_model.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_263_nostr_body_mapping.md`
