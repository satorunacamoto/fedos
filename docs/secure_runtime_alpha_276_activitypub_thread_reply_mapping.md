# Secure Runtime Alpha 276 — ActivityPub Thread and Reply Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedActivityPubPostToBoardPostInput` at Alpha 277.** Stage 6 of
the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.

## 1. Why now

`FedosBoardPost.threadId`/`.replyTo` (Alpha 256, "Option C": `threadId`
= root, `replyTo` = direct parent) are fixed and MUST NOT be redesigned.
This Stage decides how `FedosValidatedActivityPubPost`'s three relevant
fields (`objectId`, `inReplyTo`, `conversationRoot`) populate them.

## 2. Root post

```
inReplyTo === null
  -> replyTo = null
  -> threadId = objectId   (the canonical Board ID policy for objectId:
                             a root's threadId equals its own id,
                             mirroring Alpha 256 §1 and the Nostr
                             Adapter's identical convention, Alpha 264 §4)
```

## 3. Reply with a known root

```
inReplyTo !== null && conversationRoot !== null
  -> replyTo = inReplyTo
  -> threadId = conversationRoot
```

A direct, lossless mapping — ActivityPub's own two-field reply shape
(`inReplyTo` for the direct parent, and this Arc's own
`conversationRoot` for the thread root, populated by an upstream
resolver per §4) maps onto Alpha 256's "Option C" model with no
impedance mismatch, exactly as AT Protocol's native
`reply.root`/`reply.parent` shape already demonstrated it would (Alpha
259 §5, prior Arc's own fixture verification).

## 4. Reply without a known root — the three options and the adopted one

- **Option A — reject until root is resolved.** The adapter returns
  `null` whenever `conversationRoot` is missing for a reply.
- **Option B — use parent as provisional thread root.** `threadId`
  would fall back to `inReplyTo` when `conversationRoot` is absent.
- **Option C — require an upstream resolver to supply
  `conversationRoot`.** **Adopted**, exactly this Arc's own preferred
  candidate.

**Why Option C, and why it behaves like Option A at the adapter's own
boundary:** Option C names WHO is responsible for resolving a reply's
thread root — an upstream resolver, part of ActivityPub "content
normalization" in this Arc's own Architecture Rules, never the Board
Adapter itself. Resolving a reply's true root in general requires
walking the `inReplyTo` chain outward — which is exactly the "network
resolution" this Arc's own instruction forbids the adapter from ever
performing ("Do not perform network resolution in the adapter"). Since
the adapter cannot resolve it and must not guess (Option B would invent
semantics no source protocol asserts — an ActivityPub reply's declared
parent is NOT necessarily its thread's own root, unlike Nostr's
positional-tag fallback, which Alpha 264 §3 could adopt only because it
mirrors an ALREADY-established, ALREADY-tested precedent specific to
NIP-10), the OBSERVABLE adapter behavior for `inReplyTo !== null &&
conversationRoot === null` is: **reject (`null`)**. This is the same
outcome Option A names directly, but framed correctly: it is not "we
gave up trying," it is "a correctly normalized ActivityPub reply MUST
already carry a resolved `conversationRoot` — this input violates that
contract, so it is rejected the same way any other malformed input to
this adapter is."

```
inReplyTo !== null && conversationRoot === null
  -> mapValidatedActivityPubPostToBoardPostInput returns null
```

## 5. Required invariants — which layer enforces each

| Invariant | Enforced by | Why |
| --- | --- | --- |
| No self-reply | `validateFedosBoardPost` (Alpha 257), reused, NOT duplicated | The SAME composed boundary the Nostr Adapter already relies on (Alpha 266 §4) — re-implementing the check here would violate this Arc's own "do not duplicate Board validation" requirement (Alpha 277). |
| No cross-board assumption | Trivial, by construction | `boardId` is a caller-supplied parameter (§6, Alpha 273 §3), never derived from `post`; the adapter has no board-inference logic to go wrong. |
| No cycle construction | Trivial, by construction | The adapter processes exactly ONE post per call, with no access to any other post — the same per-event scope limit Alpha 256 §4/Alpha 264 §5 already assign to the Nostr Adapter. |
| No inferred root from URL shape | Confirmed structurally | The mapper never inspects `objectId`/`inReplyTo`/`conversationRoot` beyond a `typeof`/non-empty check — no regex, no URL parsing, no substring extraction of any kind runs on any of the three. |
| No Mastodon-specific status-id parsing | Confirmed structurally | Same evidence as above — nothing parses a Mastodon-shaped `/@user/12345` path or any other instance-specific URL convention. |
| No database access | Confirmed structurally | No import from `src/storage/` anywhere in `src/board/activitypub/`. |

## 6. `boardId` — same policy as Nostr, restated

ActivityPub, like Nostr, has no native "which local board" concept.
`boardId` remains a required, caller-supplied parameter to both
`mapValidatedActivityPubPostToBoardPostInput` and
`validateActivityPubBoardPost` (Alpha 277) — the identical policy Alpha
265 §4 already fixed for the Nostr Adapter, restated here rather than
re-decided, since nothing about ActivityPub changes the reasoning.

## 7. See also

- `docs/secure_runtime_alpha_272_normalized_activitypub_post_model.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_264_nostr_thread_mapping.md`
- `docs/secure_runtime_alpha_277_activitypub_board_adapter.md`
