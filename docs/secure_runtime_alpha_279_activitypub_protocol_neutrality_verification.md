# Secure Runtime Alpha 279 — ActivityPub Protocol Neutrality and Fixture Verification

**Status: this Stage VERIFIES. It adds NO new production file — it is
backed by real, executed fixture tests
(`test/secure_runtime_alpha_279_activitypub_protocol_neutrality_verification.test.ts`)
covering every case this Arc's own instruction names, plus a byte-for-byte
unchanged check on the Nostr Adapter.** Stage 9 of the Alpha 271–280
ActivityPub Canonical Board Adapter Arc.

## 1. Why now

Alpha 277 shipped the adapter. This Stage confirms it behaves correctly
across the full required fixture matrix, confirms the resulting
`FedosBoardPost` is genuinely protocol-neutral, and confirms the Nostr
Adapter (Alpha 261–270) was not touched in the process.

## 2. Required fixture matrix — all twelve cases, real and executed

1. **Mastodon-style `Create(Note)`, normalized upstream** — a fixture
   whose `objectId`/`actorId` are shaped like real Mastodon URLs
   (`https://instance.example/users/alice/statuses/123456789012345678`),
   demonstrating this Arc's own type makes no assumption about that
   shape (no parsing occurs).
2. **Generic ActivityPub `Note`** — a fixture with non-Mastodon-shaped,
   opaque URIs, confirming no Mastodon-specific behavior differs.
3. **Root post** — `inReplyTo: null` -> `replyTo: null`,
   `threadId === objectId`.
4. **Reply with explicit root** — `inReplyTo`/`conversationRoot` both
   present -> `replyTo === inReplyTo`, `threadId === conversationRoot`.
5. **Reply without root, per the adopted failure policy** —
   `inReplyTo` present, `conversationRoot: null` -> rejected (`null`),
   confirming Alpha 276 §4's "Option C" behavior exactly.
6. **Unicode text** — multi-script, combining-character, and emoji
   content mapped verbatim into `body`, confirming no
   encoding/normalization side effect.
7. **Empty content rejection** — `content: ""` -> rejected by the
   composed `validateFedosBoardPost` boundary (Alpha 257's own minimum
   body length), not special-cased by the adapter.
8. **Oversized body rejection** — `content` one character over
   `FEDOS_BOARD_POST_MAX_BODY_LENGTH` -> rejected by the same composed
   boundary.
9. **Malformed actor URI** — an empty `actorId` -> rejected. Per Alpha
   276 §5's own confirmed scope limit ("no inferred root from URL
   shape"), this adapter does not validate URI SYNTAX at all (that
   belongs to the upstream normalizer, out of scope) — "malformed" is
   therefore tested at the boundary this Arc actually owns: emptiness,
   not scheme/format correctness.
10. **Malformed object URI** — an empty `objectId` -> rejected, same
    reasoning as case 9.
11. **Self-reply** — `inReplyTo === objectId` (with a matching
    `conversationRoot`) -> rejected by the composed
    `validateFedosBoardPost` boundary (its own `replyTo === id` check,
    Alpha 257), NOT by adapter-local logic — confirming Alpha 276 §5's
    own "reused, NOT duplicated" decision holds in practice.
12. **Deterministic repeated mapping** — the same fixture, mapped ten
    times in a row, produces ten deeply-equal results; two fixtures
    differing only in `objectId` produce different `FedosBoardPost.id`
    values.

## 3. Resulting `FedosBoardPost` — verified protocol-neutral

- **Same shape as Nostr-produced `FedosBoardPost`.** An
  ActivityPub-produced value's own key set
  (`id, boardId, threadId, replyTo, author, body, createdAt, source`)
  is identical, key-for-key, to a Nostr-produced value's — verified by
  direct `Object.keys` comparison in the test, not merely by shared
  TypeScript typing.
- **No ActivityPub Activity, no JSON-LD context, no inbox/outbox, no
  HTTP Signature, no Mastodon-specific field.** None of `@context`,
  `type`, `actor`, `object`, `inbox`, `outbox`, `signature`, `keyId`, or
  any Mastodon-instance-shaped field appears anywhere on the result —
  confirmed by serializing the value and asserting none of those
  substrings appears.
- **No HTML**, confirmed given the plain-text content policy (Alpha 272
  §4): every fixture's `content` is genuinely HTML-free plain text, and
  the one fixture that DOES carry a raw `<`/`>` character is rejected
  outright (case covered alongside the required matrix, §2), never
  silently accepted with HTML intact.

## 4. The Nostr Board Adapter — confirmed byte-for-byte unchanged

`src/board/fedos_board_nostr_adapter.ts` (Alpha 266) is NOT modified by
this Arc — confirmed by `git diff --stat` showing zero changes to that
file (verification step, not this Stage's own test, since a test cannot
observe `git diff` directly) and, within this Stage's own test, by
re-running `validateNostrBoardPost` against the SAME fixture used in
Alpha 267 (prior Arc) and confirming an IDENTICAL result — the adapter's
own observable behavior is unchanged, which is the strongest evidence a
test file itself can offer that the underlying code was not touched.

## 5. See also

- `docs/secure_runtime_alpha_277_activitypub_board_adapter.md`
- `docs/secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
