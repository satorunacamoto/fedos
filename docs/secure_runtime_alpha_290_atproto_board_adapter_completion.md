# Secure Runtime Alpha 290 — AT Protocol Canonical Board Adapter Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha 281–290
AT Protocol Canonical Board Adapter Arc.**

## 1. Why now

Alpha 281 inventoried and confirmed no AT Protocol code existed; Alpha
282 fixed the normalized input model; Alpha 283–286 fixed provenance/
author/body/thread mapping; Alpha 287 implemented the adapter; Alpha 288
formally separated update/delete responsibility; Alpha 289 verified the
full required fixture matrix and confirmed BOTH existing adapters stayed
untouched. This Stage issues the Arc's own closing Completion
Declaration.

## 2. The mapping, frozen

```
FedosValidatedAtprotoPost                    FedosBoardPost
  uri            ────────────────────────►    id
  uri            ────────────────────────►    source.reference
  cid            ─────(read, never copied)     (never appears on FedosBoardPost)
  authorDid      ────────────────────────►    author.publicIdentifier
  createdAt      ────────────────────────►    createdAt
  text (plain UTF-8 by Lexicon design)  ──►    body
  replyRootUri === null &&
    replyParentUri === null         ────────►  threadId = uri, replyTo = null
  replyRootUri !== null &&
    replyParentUri !== null,
    NOT self-root-contradictory     ────────►  threadId = replyRootUri,
                                                 replyTo = replyParentUri
  exactly one of the two is null    ────────►  REJECTED (invalid combination)
  replyRootUri === uri &&
    replyParentUri !== uri          ────────►  REJECTED (self-root contradiction)
  (caller-supplied)                 ────────►  boardId
  "atproto" (fixed)                 ────────►  author.protocol, source.protocol
  null (fixed, this Arc)            ────────►  author.identityId

        mapValidatedAtprotoPostToBoardPostInput()  ->  FedosBoardPostInput | null
                              |
                    validateFedosBoardPost()  (Alpha 257, unmodified)
                              |
                              v
                validateAtprotoBoardPost()  ->  FedosBoardPost | null

-- verified against a 17-case required fixture matrix, verified
   protocol-neutral in shape against BOTH a Nostr-produced and an
   ActivityPub-produced FedosBoardPost, verified both existing adapters'
   own observable behavior is unchanged (Alpha 289) --
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
`package.json`'s own `dependencies` count stays fixed at 2, unchanged
across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. The THIRD Protocol
Adapter now exists: `validateAtprotoBoardPost`
(`src/board/atproto/fedos_atproto_board_adapter.ts`) converts an
already-validated, already-normalized `FedosValidatedAtprotoPost` into a
`FedosBoardPost`, one-way only, using exclusively the decisions this
Arc's own Alpha 282–286 fixed — fail closed, deterministic, and touching
no XRPC, network, Runtime, Storage, GUI, Worker, or Desktop state.**

The following are now declared complete, exactly as this Arc's own
instruction requires:

- **Normalized AT Protocol post boundary** — Alpha 282,
  `FedosValidatedAtprotoPost`, seven fields, plain UTF-8 text by Lexicon
  design, immutable, validated upstream by convention.
- **AT URI/CID responsibility split** — Alpha 283, "Option C" adopted:
  AT URI as `source.reference` (record identity), CID retained
  separately on the input type only (content version), never leaking
  onto `FedosBoardPost`; duplicate-import identity reused from
  `fedosBoardSourceKey` (Alpha 253) unmodified.
- **DID author mapping** — Alpha 284, `authorDid` → `publicIdentifier`
  verbatim, `identityId` fixed `null`, the stable DID (never a mutable
  handle) as canonical identity, no profile resolution, no network
  calls.
- **Plain-text body mapping** — Alpha 285, `text` → `body` verbatim, no
  markup guard needed (unlike ActivityPub) since AT Protocol text is
  plain by protocol design, facets/embeds structurally excluded.
- **Root/parent reply mapping** — Alpha 286, a direct, lossless mapping
  (AT Protocol supplies both explicitly, unlike ActivityPub), invalid
  combinations (root-without-parent, parent-without-root, self-root
  contradiction) rejected fail-closed at the adapter, self-parent reused
  from `validateFedosBoardPost` not duplicated.
- **Pure AT Protocol → Board Adapter** — Alpha 287,
  `mapValidatedAtprotoPostToBoardPostInput` +
  `validateAtprotoBoardPost`, following the established two-step
  pattern, composing with (never duplicating) `validateFedosBoardPost`.
- **Update/delete responsibility separation** — Alpha 288,
  `FedosAtprotoRecordObservation`, a minimal inert type carrying both
  `uri` and `cid`, never wired into the adapter, `FedosBoardPost` gains
  no boolean of any kind.
- **Protocol-neutral Board output** — Alpha 289, confirmed by a
  17-case fixture matrix and a direct shape comparison against BOTH a
  Nostr-produced and an ActivityPub-produced `FedosBoardPost`.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- XRPC client, OAuth, app passwords, PDS login — no HTTP-capable or
  credential-handling code exists anywhere in `src/board/atproto/`.
- Repository writes, firehose, Jetstream, Relay/App View integration —
  none referenced.
- DID resolution, handle resolution — `FedosValidatedAtprotoPost`
  carries no `handle` field, and no DID Document/resolution code exists.
- Blob fetching — no blob-reference field exists on any type this Arc
  introduces.
- Rich-text rendering, facets, embeds — no such field exists on
  `FedosValidatedAtprotoPost` (Alpha 282 §3).
- Record updates, record deletion — `FedosAtprotoRecordObservation`
  (Alpha 288) is never constructed anywhere in this Arc.
- Storage, moderation implementation, GUI — `src/storage/*`,
  `src/render/*` untouched; `FedosAtprotoRecordObservation` enforces
  nothing.

## 5. Next Arc recommendation

**Session Canonical Board Gateway Adapter Arc.**

Reason (verbatim from this Arc's own required recommendation): Nostr,
ActivityPub, and AT Protocol now prove THREE structurally different
public/federated protocols can map into the same Canonical Board Model
— a flat tag-based reply shape (Nostr), a single-optional-root reply
shape requiring an upstream resolver (ActivityPub), and a fully-explicit
root+parent reply shape with its own identity/content-version split (AT
Protocol) — all three converging on the identical
`map<Protocol>PostToBoardPostInput` → `validateFedosBoardPost`
composition pattern. Session should be integrated LAST, through an
explicit opt-in Gateway boundary, because it is fundamentally a
PRIVATE-MESSAGING system, not a public-post protocol — a categorically
different trust and consent model than any of the three protocols this
Arc and its two predecessors already handled, and the one requiring the
most careful, explicit scoping before any code is written.

## 6. What this Stage does NOT do

- Does **not** modify `fedos_validated_atproto_post.ts`,
  `fedos_atproto_board_adapter.ts`, or
  `fedos_atproto_mutation_boundary.ts` beyond what Alpha 282–288
  already landed — no further production code change.
- Does **not** implement a Session Gateway adapter, an AT Protocol
  XRPC client, storage, or a GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
  `src/runtime/*`, `src/desktop/*`, `src/identity/*`, `src/worker.ts`,
  `src/board/fedos_board_nostr_adapter.ts`,
  `src/board/activitypub/fedos_activitypub_board_adapter.ts`, Storage,
  Observation, Relay transport, or Nostr validation.

## 7. See also

- `docs/secure_runtime_alpha_289_atproto_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_288_atproto_mutation_boundary.md`
- `docs/secure_runtime_alpha_287_atproto_board_adapter.md`
- `docs/secure_runtime_alpha_286_atproto_thread_reply_mapping.md`
- `docs/secure_runtime_alpha_285_atproto_body_mapping.md`
- `docs/secure_runtime_alpha_284_atproto_author_mapping.md`
- `docs/secure_runtime_alpha_283_atproto_source_provenance.md`
- `docs/secure_runtime_alpha_282_normalized_atproto_post_model.md`
- `docs/secure_runtime_alpha_281_existing_atproto_inventory.md`
- `docs/secure_runtime_alpha_280_activitypub_board_adapter_completion.md`
