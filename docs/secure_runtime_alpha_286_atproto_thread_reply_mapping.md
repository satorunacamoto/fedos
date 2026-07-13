# Secure Runtime Alpha 286 — AT Protocol Thread and Reply Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedAtprotoPostToBoardPostInput` at Alpha 287.** Stage 6 of the
Alpha 281–290 AT Protocol Canonical Board Adapter Arc.

## 1. Why now

`FedosBoardPost.threadId`/`.replyTo` (Alpha 256, "Option C": `threadId`
= root, `replyTo` = direct parent) are fixed and MUST NOT be redesigned.
This Stage decides how `FedosValidatedAtprotoPost`'s three relevant
fields (`uri`, `replyRootUri`, `replyParentUri`) populate them — the
THIRD time this exact decision has been made (Alpha 264 for Nostr, Alpha
276 for ActivityPub), and, unlike either prior protocol, AT Protocol
supplies BOTH root and parent explicitly, with no tag-parsing (Nostr) or
missing-root deferral (ActivityPub) needed.

## 2. Root post

```
replyRootUri === null && replyParentUri === null
  -> replyTo = null
  -> threadId = uri   (this post's own AT URI — mirroring Alpha 256 §1
                        and both prior adapters' identical convention,
                        Alpha 264 §4 / Alpha 276 §2)
```

## 3. Reply — root and parent both required, both used directly

```
replyRootUri !== null && replyParentUri !== null
  -> replyTo = replyParentUri
  -> threadId = replyRootUri
```

**"Unlike ActivityPub, AT Protocol supplies root and parent references
explicitly"** — this Arc's own instruction, verbatim. Alpha 276 §4 had
to decide a policy for ActivityPub's OPTIONAL `conversationRoot` because
ActivityPub's own `inReplyTo` alone never guarantees a resolved root.
AT Protocol's own `app.bsky.feed.post` Lexicon schema requires a REPLY
record to carry a `reply` object with BOTH a `root` strong reference AND
a `parent` strong reference, always together — there is no
"reply-without-root" case AT Protocol itself permits a conforming record
to represent. This Stage's own job is therefore simpler than Alpha 276's:
no "Option A/B/C" resolver-policy choice is needed — a direct, lossless
mapping of both fields is sufficient, with invalid COMBINATIONS (§4)
rejected fail-closed instead.

## 4. Invalid combinations — rejected fail-closed, checked only from
this post's own two fields

Per this Arc's own instruction, this Stage enumerates every invalid
combination and assigns each to the layer that can actually check it:

| Invalid combination | Checked by | How |
| --- | --- | --- |
| Root without parent | `mapValidatedAtprotoPostToBoardPostInput` (Alpha 287) | `replyRootUri !== null && replyParentUri === null` -> reject. Only the adapter can see BOTH raw fields before assembly. |
| Parent without root | `mapValidatedAtprotoPostToBoardPostInput` | `replyRootUri === null && replyParentUri !== null` -> reject. Same reasoning. |
| Self-parent | `validateFedosBoardPost` (Alpha 257), reused, NOT duplicated | Once `replyTo = replyParentUri` and `id = uri` are assembled, this is EXACTLY the `replyTo === id` self-reply check the composed boundary already performs — mirroring Alpha 276 §5's identical decision for ActivityPub's self-reply case (do not duplicate Board validation, Alpha 287's own explicit requirement). |
| Self-root for a reply where semantics become contradictory | `mapValidatedAtprotoPostToBoardPostInput` | `replyRootUri === uri && replyParentUri !== uri` (a post claiming to be its OWN thread's root while genuinely replying to a DIFFERENT post) -> reject. This is distinct from a normal direct-reply-to-root, where `replyRootUri === replyParentUri` (both point at the SAME real root post, entirely valid AT Protocol usage) — that case is NOT rejected; only the contradictory one (claiming self-as-root while the parent is someone else) is. |
| Malformed URI | `mapValidatedAtprotoPostToBoardPostInput` | Non-empty-string check only — the SAME scope limit Alpha 276 §5 already fixed for ActivityPub ("no inferred root from URL shape"); deeper AT-URI grammar validation belongs to the upstream "AT Protocol transport/validation" layer (this Arc's own Architecture Rules), never this adapter. |
| Inferred root from string shape | Confirmed absent, structurally | The mapper never inspects `uri`/`replyRootUri`/`replyParentUri` beyond `typeof`/non-empty/equality checks — no regex, no `did`/`collection`/`rkey` segment extraction, no substring parsing of any kind runs on any of the three (Alpha 283 §5's identical confirmation, restated for this Stage's own concern). |
| Cross-board inference | Trivial, by construction | `boardId` is a caller-supplied parameter (§5), never derived from `post` — the adapter has no board-inference logic to go wrong, the identical policy both prior adapters already established. |

## 5. `boardId` — same policy as Nostr and ActivityPub, restated

AT Protocol, like Nostr and ActivityPub, has no native "which local
board" concept. `boardId` remains a required, caller-supplied parameter
to both `mapValidatedAtprotoPostToBoardPostInput` and
`validateAtprotoBoardPost` (Alpha 287) — the identical policy Alpha 265
§4 and Alpha 276 §6 already fixed, restated here rather than re-decided.

## 6. No pretending an AT URI is a branded `FedosBoardPostId`

Per this Arc's own instruction: "Use application-level Board IDs
according to the Alpha 252 strategy; do not pretend an AT URI is itself
a branded `BoardPostId` without an explicit mapping function." Confirmed:
`mapValidatedAtprotoPostToBoardPostInput` returns a `FedosBoardPostInput`
whose `id`/`threadId`/`replyTo` fields are all PLAIN, unbranded strings
(matching `FedosBoardPostInput`'s own established shape, Alpha 257) — no
`as FedosBoardPostId` cast or equivalent appears anywhere in
`src/board/atproto/`. The ONLY place any AT URI is ever branded into a
`FedosBoardPostId`/`FedosThreadId` is inside `validateFedosBoardPost`
itself (Alpha 257's own `toFedosBoardPostId`/`toFedosThreadId` calls) —
the SAME "explicit mapping function" this instruction requires, already
built, reused rather than reinvented.

## 7. See also

- `docs/secure_runtime_alpha_282_normalized_atproto_post_model.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_264_nostr_thread_mapping.md`
- `docs/secure_runtime_alpha_276_activitypub_thread_reply_mapping.md`
- `docs/secure_runtime_alpha_287_atproto_board_adapter.md`
