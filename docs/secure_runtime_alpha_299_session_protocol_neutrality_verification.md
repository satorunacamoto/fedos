# Secure Runtime Alpha 299 — Session Protocol Neutrality and Fixture Verification

**Status: this Stage VERIFIES. It adds NO new production file — it is
backed by real, executed fixture tests
(`test/secure_runtime_alpha_299_session_protocol_neutrality_verification.test.ts`)
covering every case this Arc's own instruction names, plus byte-for-byte
unchanged checks on ALL THREE existing adapters.** Stage 9 of the Alpha
291–300 Session Canonical Board Gateway Adapter Arc.

## 1. Why now

Alpha 297 shipped the adapter. This Stage confirms it behaves correctly
across the full required fixture matrix, confirms the resulting
`FedosBoardPost` is genuinely protocol-neutral, and confirms none of the
three existing adapters (Nostr, ActivityPub, AT Protocol) was touched in
the process.

## 2. Required fixture matrix — all eight cases, real and executed

Per this Arc's own instruction, verbatim ("最低" — "at minimum"):

1. **Root** — `replyTo: null` -> `FedosBoardPost.replyTo === null`,
   `threadId === messageId`.
2. **Reply** — `replyTo` present -> `FedosBoardPost.replyTo === replyTo`,
   `threadId === replyTo` (the adopted Gateway contract, Alpha 295 §3).
3. **Unicode** — multi-script, combining-character, and emoji text
   mapped verbatim into `body`, confirming no encoding/normalization
   side effect (Alpha 294's own "no Emoji conversion" rule confirmed:
   an emoji character survives unmodified, not converted to a shortcode
   or stripped).
4. **長文 (long text)** — a `body` at exactly
   `FEDOS_BOARD_POST_MAX_BODY_LENGTH` validates; one character over is
   rejected by the composed `validateFedosBoardPost` boundary, not
   special-cased by the adapter.
5. **空本文 (empty body)** — `body: ""` -> rejected by the composed
   boundary, not special-cased by the adapter.
6. **不正Author (malformed author)** — an empty `authorId` -> rejected.
   Matching every prior adapter's own identical scope limit: this
   adapter validates non-emptiness only, never author-identifier FORMAT
   (that belongs to the Gateway layer, entirely out of this Arc's own
   scope).
7. **不正MessageId (malformed message id)** — an empty `messageId` ->
   rejected, same reasoning as case 6.
8. **Determinism** — the same fixture, mapped ten times in a row,
   produces ten deeply-equal results; two fixtures differing only in
   `messageId` produce different `FedosBoardPost` values.

## 3. Resulting `FedosBoardPost` — verified protocol-neutral

- **Exact same canonical shape as Nostr-, ActivityPub-, and
  AT-Protocol-produced `FedosBoardPost`.** A Session-produced value's
  own key set (`id, boardId, threadId, replyTo, author, body, createdAt,
  source`) is identical, key-for-key, to all three other protocols' —
  verified by direct `Object.keys` comparison against fixtures from all
  three prior adapters in the same test run.
- **No Session/Oxen protocol object, no onion-routing envelope, no
  `sessionId`, no auth/session credential appears anywhere on the
  result.** Confirmed by serializing the value and asserting the
  fixture's own `sessionId` string never appears in the output —
  re-confirming Alpha 296 §3/Alpha 297 §7's own structural claim by
  actual construction.

## 4. All three existing adapters — confirmed byte-for-byte unchanged

None of `src/board/fedos_board_nostr_adapter.ts` (Alpha 266),
`src/board/activitypub/fedos_activitypub_board_adapter.ts` (Alpha 277),
nor `src/board/atproto/fedos_atproto_board_adapter.ts` (Alpha 287) is
modified by this Arc — confirmed by `git diff --stat` showing zero
changes to any of the three (verification step, not this Stage's own
test) and, within this Stage's own test, by re-running
`validateNostrBoardPost`, `validateActivityPubBoardPost`, and
`validateAtprotoBoardPost` against fixtures matching their own
respective Arc's determinism/neutrality checks and confirming IDENTICAL
results — the strongest evidence a test file itself can offer that none
of the three adapters' own observable behavior changed.

## 5. See also

- `docs/secure_runtime_alpha_297_session_board_adapter.md`
- `docs/secure_runtime_alpha_289_atproto_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_279_activitypub_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
