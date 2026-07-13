# Secure Runtime Alpha 289 — AT Protocol Protocol Neutrality and Fixture Verification

**Status: this Stage VERIFIES. It adds NO new production file — it is
backed by real, executed fixture tests
(`test/secure_runtime_alpha_289_atproto_protocol_neutrality_verification.test.ts`)
covering every case this Arc's own instruction names, plus byte-for-byte
unchanged checks on BOTH existing adapters.** Stage 9 of the Alpha
281–290 AT Protocol Canonical Board Adapter Arc.

## 1. Why now

Alpha 287 shipped the adapter. This Stage confirms it behaves correctly
across the full required fixture matrix, confirms the resulting
`FedosBoardPost` is genuinely protocol-neutral, and confirms neither
existing adapter (Nostr, ActivityPub) was touched in the process.

## 2. Required fixture matrix — all seventeen cases, real and executed

1. **Bluesky-style root `app.bsky.feed.post`, normalized upstream** — a
   fixture whose `uri`/`authorDid` are shaped like real Bluesky AT URIs
   and DIDs (`at://did:plc:.../app.bsky.feed.post/...`,
   `did:plc:...`), demonstrating this Arc's own type makes no assumption
   about that shape (no parsing occurs).
2. **Bluesky-style nested reply** — `replyRootUri`/`replyParentUri` both
   present and DIFFERENT (a genuine nested reply, not a direct reply to
   root).
3. **Generic AT Protocol normalized post** — a fixture with non-Bluesky-
   collection-shaped, opaque identifiers, confirming no
   Bluesky-app-specific behavior differs.
4. **Root post** — both reply fields `null` -> `replyTo: null`,
   `threadId === uri`.
5. **Reply with root + parent** — both present, direct reply to root
   (`replyRootUri === replyParentUri`) -> mapped directly, NOT rejected
   by the self-root guard (Alpha 286 §4's own confirmed non-rejection of
   this legitimate case).
6. **Missing root** — `replyParentUri` present, `replyRootUri: null` ->
   rejected (`null`).
7. **Missing parent** — `replyRootUri` present, `replyParentUri: null`
   -> rejected (`null`).
8. **Self-parent** — `replyParentUri === uri` -> rejected by the
   composed `validateFedosBoardPost` boundary (its own `replyTo === id`
   check, Alpha 257), NOT by adapter-local logic — confirming Alpha 286
   §4's own "reused, NOT duplicated" decision holds in practice.
9. **Unicode text** — multi-script, combining-character, and emoji text
   mapped verbatim into `body`, confirming no encoding/normalization
   side effect.
10. **Empty text rejection** — `text: ""` -> rejected by the composed
    `validateFedosBoardPost` boundary, not special-cased by the adapter.
11. **Oversized body rejection** — `text` one character over
    `FEDOS_BOARD_POST_MAX_BODY_LENGTH` -> rejected by the same composed
    boundary.
12. **Malformed DID** — an empty `authorDid` -> rejected. Per Alpha 286
    §4's own confirmed scope limit ("inferred root from string shape"
    confirmed absent), this adapter does not validate DID SYNTAX at all
    (that belongs to the upstream normalizer, out of scope) —
    "malformed" is tested at the boundary this Arc actually owns:
    emptiness, matching Alpha 279's own identical precedent for
    ActivityPub's "malformed actor/object URI" cases.
13. **Malformed AT URI** — an empty `uri` -> rejected, same reasoning as
    case 12.
14. **Malformed CID** — an empty `cid` -> rejected, same reasoning.
15. **Deterministic repeated mapping** — the same fixture, mapped ten
    times in a row, produces ten deeply-equal results.
16. **Same URI with different CID — behavior documented** — two
    fixtures sharing the same `uri` but differing `cid` produce
    `FedosBoardPost` values with the SAME `id`/`source.reference` (CID
    plays no role in identity, confirming Alpha 283 §3/§6's own
    "Option C" decision) — this is the DOCUMENTED behavior, not a bug:
    per Alpha 283 §6, both key to the SAME `fedosBoardSourceKey`.
17. **Different URI — separation confirmed** — two fixtures with
    different `uri` values produce `FedosBoardPost` values with
    different `id`/`source.reference`/`threadId` (for two roots).

## 3. Resulting `FedosBoardPost` — verified protocol-neutral

- **Exact same canonical shape as Nostr- and ActivityPub-produced
  `FedosBoardPost`.** An AT-Protocol-produced value's own key set
  (`id, boardId, threadId, replyTo, author, body, createdAt, source`)
  is identical, key-for-key, to both other protocols' — verified by
  direct `Object.keys` comparison against a Nostr fixture AND an
  ActivityPub fixture in the same test run.
- **No AT Protocol record object, no Lexicon object, no facets, no
  embed, no DID document, no PDS/App View/Relay endpoint, no token, no
  Bluesky-specific field outside source provenance.** None of `$type`,
  `facets`, `embed`, `didDoc`, `pds`, `service`, `accessJwt`,
  `refreshJwt`, or any Bluesky-app-specific field appears anywhere on
  the result — confirmed by serializing the value and asserting none of
  those substrings appears. `cid` itself is confirmed absent from the
  serialized result too (Alpha 287 §7's own structural claim,
  re-verified here by actual construction).

## 4. Both existing adapters — confirmed byte-for-byte unchanged

Neither `src/board/fedos_board_nostr_adapter.ts` (Alpha 266) nor
`src/board/activitypub/fedos_activitypub_board_adapter.ts` (Alpha 277)
is modified by this Arc — confirmed by `git diff --stat` showing zero
changes to either file (verification step, not this Stage's own test)
and, within this Stage's own test, by re-running `validateNostrBoardPost`
and `validateActivityPubBoardPost` against the SAME fixtures used in
their own respective Arc's determinism/neutrality checks (Alpha 267,
Alpha 279) and confirming IDENTICAL results — the strongest evidence a
test file itself can offer that neither adapter's own observable
behavior changed.

## 5. See also

- `docs/secure_runtime_alpha_287_atproto_board_adapter.md`
- `docs/secure_runtime_alpha_279_activitypub_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
