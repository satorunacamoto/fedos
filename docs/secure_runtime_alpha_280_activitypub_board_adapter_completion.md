# Secure Runtime Alpha 280 — ActivityPub Canonical Board Adapter Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha 271–280
ActivityPub Canonical Board Adapter Arc.**

## 1. Why now

Alpha 271 inventoried and confirmed no ActivityPub code existed; Alpha
272 fixed the normalized input model and its plain-text content
contract; Alpha 273–276 fixed provenance/author/body/thread mapping;
Alpha 277 implemented the adapter; Alpha 278 formally separated
Create/Update/Delete responsibility; Alpha 279 verified the full
required fixture matrix and confirmed the Nostr Adapter stayed
untouched. This Stage issues the Arc's own closing Completion
Declaration.

## 2. The mapping, frozen

```
FedosValidatedActivityPubPost                FedosBoardPost
  objectId       ────────────────────────►    id
  objectId       ────────────────────────►    source.reference
  actorId        ────────────────────────►    author.publicIdentifier
  published      ────────────────────────►    createdAt
  content (already plain text, no <>)  ──►    body
  inReplyTo === null              ────────►   threadId = objectId, replyTo = null
  inReplyTo !== null,
    conversationRoot !== null     ────────►   threadId = conversationRoot,
                                                replyTo = inReplyTo
  inReplyTo !== null,
    conversationRoot === null     ────────►   REJECTED (Option C, Alpha 276 §4)
  (caller-supplied)               ────────►   boardId
  "activitypub" (fixed)           ────────►   author.protocol, source.protocol
  null (fixed, this Arc)          ────────►   author.identityId

        mapValidatedActivityPubPostToBoardPostInput()  ->  FedosBoardPostInput | null
                              |
                    validateFedosBoardPost()  (Alpha 257, unmodified)
                              |
                              v
                validateActivityPubBoardPost()  ->  FedosBoardPost | null

-- verified against a 12-case required fixture matrix, verified
   protocol-neutral in shape against a Nostr-produced FedosBoardPost,
   verified the Nostr Adapter's own observable behavior is unchanged
   (Alpha 279) --
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
`package.json`'s own `dependencies` count stays fixed at 2, unchanged
across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. The SECOND Protocol
Adapter now exists: `validateActivityPubBoardPost`
(`src/board/activitypub/fedos_activitypub_board_adapter.ts`) converts an
already-normalized `FedosValidatedActivityPubPost` into a
`FedosBoardPost`, one-way only, using exclusively the decisions this
Arc's own Alpha 272–276 fixed — fail closed, deterministic, and touching
no HTTP, network, Runtime, Storage, GUI, Worker, or Desktop state.**

The following are now declared complete, exactly as this Arc's own
instruction requires:

- **Normalized ActivityPub post boundary** — Alpha 272,
  `FedosValidatedActivityPubPost`, six fields, content contractually
  plain text (Option A), immutable, validated upstream by convention.
- **ActivityPub provenance mapping** — Alpha 273, Object id (not Create
  Activity id) as `source.reference`, no relay/inbox/instance/signature/
  request/IP/transport/token field, duplicate-import identity reused
  from `fedosBoardSourceKey` (Alpha 253) unmodified.
- **Author mapping** — Alpha 274, `actorId` → `publicIdentifier`
  verbatim, `identityId` fixed `null`, no profile resolution, no
  network calls.
- **Plain-text content policy** — Alpha 275, Option B adopted
  (normalize upstream, map verbatim), a minimal non-parsing fail-closed
  markup guard as the required backstop given no safe normalizer exists
  yet, the required upstream normalization boundary named explicitly.
- **Root/reply mapping** — Alpha 276, "Option C" for the
  reply-without-root case (require an upstream resolver; the adapter
  itself rejects), every required invariant assigned to the layer that
  can actually enforce it.
- **Pure ActivityPub → Board adapter** — Alpha 277,
  `mapValidatedActivityPubPostToBoardPostInput` +
  `validateActivityPubBoardPost`, following the Nostr Adapter's own
  pattern, composing with (never duplicating) `validateFedosBoardPost`.
- **Create/Update/Delete responsibility separation** — Alpha 278,
  `FedosActivityPubMutationObservation`, a minimal inert type, never
  wired into the adapter, `FedosBoardPost` gains no boolean of any kind.
- **Protocol-neutral Board output** — Alpha 279, confirmed by a
  12-case fixture matrix and a direct shape comparison against a
  Nostr-produced `FedosBoardPost`.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- ActivityPub HTTP server, inbox, outbox — no HTTP-capable code exists
  anywhere in `src/board/activitypub/`.
- WebFinger, NodeInfo, Actor hosting, Actor discovery — none referenced.
- HTTP Signatures — no signature verification code of any kind.
- Profile resolution — `FedosValidatedActivityPubPost` carries no
  `preferredUsername`/`name`/`icon`/`image`/`summary`/`followers`/
  `following` field to resolve into.
- Attachment fetching — no attachment field exists on any type this Arc
  introduces.
- `Update`/`Delete` application — `FedosActivityPubMutationObservation`
  (Alpha 278) is never constructed anywhere in this Arc.
- Federation delivery — this Arc is one-way only, confirmed (Alpha 277
  §3): no function accepts a `FedosBoardPost` and returns anything
  ActivityPub-shaped.
- Mastodon OAuth — no token, secret, or credential field exists
  anywhere in `src/board/activitypub/`.
- GUI, storage, moderation implementation — `src/render/*`,
  `src/storage/*` untouched; `FedosActivityPubMutationObservation`
  enforces nothing.

## 5. Next Arc recommendation

**AT Protocol Canonical Board Adapter Arc.**

Reason (verbatim from this Arc's own required recommendation): Nostr and
ActivityPub now provide two STRUCTURALLY DIFFERENT verified inputs
(Nostr's flat, tag-based NIP-10 reply shape vs. ActivityPub's two-field
`inReplyTo`/`conversationRoot` shape) that both map into the SAME
Canonical Board Model through the SAME two-step
`map<Protocol>PostToBoardPostInput` → `validateFedosBoardPost`
composition pattern — proving the adapter architecture generalizes
BEFORE adding Bluesky/AT Protocol, the third of the four target entry
paths named since Alpha 251–260 §"Core Direction."

## 6. What this Stage does NOT do

- Does **not** modify `fedos_validated_activitypub_post.ts`,
  `fedos_activitypub_board_adapter.ts`, or
  `fedos_activitypub_mutation_boundary.ts` beyond what Alpha 272–278
  already landed — no further production code change.
- Does **not** implement an AT Protocol/Session adapter, an ActivityPub
  HTTP server, storage, or a GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
  `src/runtime/*`, `src/desktop/*`, `src/identity/*`, `src/worker.ts`,
  `src/board/fedos_board_nostr_adapter.ts`, Storage, Observation, Relay
  transport, or Nostr validation.

## 7. See also

- `docs/secure_runtime_alpha_279_activitypub_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_278_activitypub_mutation_boundary.md`
- `docs/secure_runtime_alpha_277_activitypub_board_adapter.md`
- `docs/secure_runtime_alpha_276_activitypub_thread_reply_mapping.md`
- `docs/secure_runtime_alpha_275_activitypub_body_mapping.md`
- `docs/secure_runtime_alpha_274_activitypub_author_mapping.md`
- `docs/secure_runtime_alpha_273_activitypub_source_provenance.md`
- `docs/secure_runtime_alpha_272_normalized_activitypub_post_model.md`
- `docs/secure_runtime_alpha_271_existing_activitypub_inventory.md`
- `docs/secure_runtime_alpha_270_nostr_board_adapter_completion.md`
