# Secure Runtime Alpha 296 — Session Source Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedSessionPostToBoardPostInput` at Alpha 297.** Stage 6 of the
Alpha 291–300 Session Canonical Board Gateway Adapter Arc.

## 1. Why now

`FedosBoardSourceReference` (Alpha 253) already reserves `"session"` as
one of its five closed protocol values, with its own documented
convention (Alpha 291 §3.4): "a gateway-assigned reference to a
published board message." This Stage confirms `messageId` fills that
role and fixes what does NOT.

## 2. The mapping

```
"session"        ->  FedosBoardSourceReference.protocol    (fixed constant)
post.messageId   ->  FedosBoardSourceReference.reference    (verbatim)
```

Matches this Arc's own instruction exactly: `source.protocol` fixed to
the literal `"session"`, `messageId` → `source.reference`.

## 3. `sessionId` does not appear here — confirmed, by omission and by
construction

This Arc's own instruction, unlike Alpha 283 (AT Protocol) which
explicitly named a "CID does not leak into generic metadata" rule, does
not even mention `sessionId` in this Stage's own mapping — the omission
IS the decision, restated explicitly here for the same clarity Alpha
283 gave AT Protocol's `cid`: `post.sessionId` (Alpha 292 §3) is a
Gateway-ingestion-context reference, never copied onto
`FedosBoardSourceReference` or anywhere else on `FedosBoardPost`.
Confirmed structurally: `FedosBoardSourceReference` has exactly two
fields (`protocol`, `reference`, Alpha 253 §4, unmodified), and neither
this Stage nor Alpha 297 adds a third.

## 4. What is deliberately excluded, confirmed absent by construction

`FedosValidatedSessionPost` (Alpha 292) has exactly six fields — none of
the following exists ON THE TYPE, so none can leak into
`FedosBoardSourceReference` even by accident:

- **No Session network node/relay endpoint.**
- **No Oxen network address.**
- **No onion-routing hop metadata.**
- **No access/session credential of any kind** (`sessionId` is an
  opaque Gateway-scoped reference STRING, not a credential — Alpha 292
  §3).

## 5. Duplicate-import identity — reused, not reinvented

Two `FedosValidatedSessionPost` values sharing the same `messageId` key
to the SAME source identity via `fedosBoardSourceKey`
(`src/board/fedos_board_source.ts`, Alpha 253, unmodified) — the
IDENTICAL reuse Alpha 273 §5 and Alpha 283 §6 already established for
ActivityPub and AT Protocol:

```
fedosBoardSourceKey({ protocol: "session", reference: messageId })
  === fedosBoardSourceKey({ protocol: "session", reference: messageId })
```

No deduplication logic is implemented by this Arc.

## 6. See also

- `docs/secure_runtime_alpha_292_normalized_session_post_model.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_283_atproto_source_provenance.md`
