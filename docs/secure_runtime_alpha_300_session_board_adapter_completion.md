# Secure Runtime Alpha 300 — Session Board Adapter Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha 291–300
Session Canonical Board Gateway Adapter Arc — and the closing Stage of
the whole four-Arc Canonical Board Adapter series (Alpha 261–300).**

## 1. Why now

Alpha 291 inventoried and confirmed no Session-messenger code existed
(and flagged the unrelated `session_boundary.ts` naming collision);
Alpha 292 fixed the normalized input model; Alpha 293–296 fixed author/
body/thread/source mapping; Alpha 297 implemented the adapter; Alpha 298
reviewed the Gateway boundary; Alpha 299 verified the full required
fixture matrix and confirmed all three existing adapters stayed
untouched. This Stage issues the Arc's own closing Completion
Declaration.

## 2. The mapping, frozen

```
FedosValidatedSessionPost                    FedosBoardPost
  messageId      ────────────────────────►    id
  messageId      ────────────────────────►    source.reference
  sessionId      ─────(read, never copied)     (never appears on FedosBoardPost)
  authorId       ────────────────────────►    author.publicIdentifier
  createdAt      ────────────────────────►    createdAt
  body (plain text, no rich-content shape) ─►  body
  replyTo === null                  ────────►  threadId = messageId, replyTo = null
  replyTo !== null                  ────────►  threadId = replyTo, replyTo = replyTo
                                                 (Gateway contract -- no
                                                  inference beyond the
                                                  direct parent, Alpha 295)
  (caller-supplied)                 ────────►  boardId
  "session" (fixed)                 ────────►  author.protocol, source.protocol
  null (fixed, this Arc)            ────────►  author.identityId

        mapValidatedSessionPostToBoardPostInput()  ->  FedosBoardPostInput | null
                              |
                    validateFedosBoardPost()  (Alpha 257, unmodified)
                              |
                              v
                validateSessionBoardPost()  ->  FedosBoardPost | null

-- verified against the full required fixture matrix (Alpha 299),
   verified protocol-neutral in shape against Nostr-, ActivityPub-, and
   AT-Protocol-produced FedosBoardPost, verified all three existing
   adapters' own observable behavior is unchanged --
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
`package.json`'s own `dependencies` count stays fixed at 2, unchanged
across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. The FOURTH and FINAL
Protocol Adapter now exists: `validateSessionBoardPost`
(`src/board/session/fedos_session_board_adapter.ts`) converts an
already-Gateway-verified, already-normalized `FedosValidatedSessionPost`
into a `FedosBoardPost`, one-way only, using exclusively the decisions
this Arc's own Alpha 292–296 fixed — fail closed, deterministic, and
touching no Session network, Oxen connection, private key, encryption/
decryption, DM retrieval, Storage, Runtime, Relay, Desktop, Worker, GUI,
or Observation state.**

The following are now declared complete, exactly as this Arc's own
instruction requires:

- **Normalized Session post boundary** — Alpha 292,
  `FedosValidatedSessionPost`, six fields exactly (`messageId`,
  `sessionId`, `authorId`, `body`, `createdAt`, `replyTo`), no
  Attachment/Group/Reaction/Voice/Typing field, immutable, validated
  upstream by convention.
- **Author mapping** — Alpha 293, `authorId` → `publicIdentifier`
  verbatim, `identityId` fixed `null`, no identity resolution, no
  profile fetch, no network.
- **Body mapping** — Alpha 294, `body` → `body` verbatim, no
  processing/Markdown/HTML/Emoji conversion of any kind.
- **Thread mapping** — Alpha 295, the adopted Gateway contract (no
  `replyTo` → root; `replyTo` present → `threadId = replyTo`), no
  inference beyond the direct parent, an honestly-documented limitation
  compared to the other three protocols' own root-preserving `threadId`.
- **Source mapping** — Alpha 296, `messageId` → `source.reference`,
  `source.protocol` fixed to `"session"`, `sessionId` confirmed never
  leaking in.
- **Pure Session → Board Adapter** — Alpha 297,
  `mapValidatedSessionPostToBoardPostInput` +
  `validateSessionBoardPost`, following the established two-step
  pattern, composing with (never duplicating) `validateFedosBoardPost`.
- **Gateway Boundary Review** — Alpha 298, confirmed by import-list
  inspection: the adapter's only non-type-only dependency is the Board
  model's own validation boundary; zero reach into Storage, Runtime,
  Relay, Desktop, Worker, GUI, Observation, or Network.
- **Protocol-neutral Board output** — Alpha 299, confirmed by the
  required fixture matrix and a direct shape comparison against all
  three other protocols' own `FedosBoardPost` output.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Session network implementation, Oxen connection — no such code exists
  anywhere in `src/board/session/`.
- Private keys, encryption, decryption — no cryptographic operation of
  any kind is performed anywhere in `src/board/session/` (Alpha 298 §4).
- DM retrieval, storage sync — no such capability exists; this Arc's
  own scope begins strictly AFTER a Gateway has already produced a
  `FedosValidatedSessionPost`.
- Board Repository, Board Index, Board Feed, persistence, moderation
  implementation, GUI — none is built; `src/storage/*`/`src/render/*`
  untouched.

## 5. Next Arc recommendation

**Board Repository, Board Index, and Board Feed** — named together as
this Arc's own required recommendation, verbatim, not a single Arc name
like the prior three completions each gave.

Reason: with FOUR structurally different Protocol Adapters now
converging on the identical `FedosBoardPost` shape (a flat tag-based
reply shape for Nostr, a single-optional-root shape requiring an
upstream resolver for ActivityPub, a fully-explicit root+parent shape
for AT Protocol, and a Gateway-contracted direct-parent-only shape for
Session), the Canonical Board Model's own INPUT side is now proven
across every target protocol this whole four-Arc series set out to
cover (Alpha 251–260 §"Core Direction"). The next genuine gap is no
longer "can another protocol map in" — it is that NOTHING YET STORES,
INDEXES, or SERVES a `FedosBoardPost` once produced: every adapter's own
output today is discarded the moment a test or caller stops holding a
reference to it. A Board Repository (persistence for `FedosBoardPost`
values), a Board Index (query/lookup structure, echoing
`src/query/thread_query.ts`'s own existing precedent but for the
protocol-neutral model instead of raw Nostr events), and a Board Feed
(read-facing composition of stored posts into a rankable/orderable view)
are the three concerns that turn "four adapters that can each produce a
`FedosBoardPost`" into an actual, usable board.

**Relay Pool is explicitly NOT recommended.** This Arc's own instruction
states this directly, and the reasoning already fixed by Alpha 240 §3
and reconfirmed by Alpha 250 §3 (Nostr Inbound Event Validation Arc,
long before this four-Arc series began) still holds: a Relay Pool
multiplies TRANSPORT complexity, and transport was never this series'
own concern (`Nostr Board Adapter`, `ActivityPub Board Adapter`,
`AT Protocol Board Adapter`, and `Session Board Adapter` all explicitly
consume ALREADY-VALIDATED input, never raw transport). Storage and
retrieval of the Canonical Board Model itself is the genuinely
unaddressed gap now, not a second Nostr connection.

## 6. What this Stage does NOT do

- Does **not** modify `fedos_validated_session_post.ts` or
  `fedos_session_board_adapter.ts` beyond what Alpha 292–297 already
  landed — no further production code change.
- Does **not** implement a Board Repository, Board Index, Board Feed,
  Session network, Oxen connection, or a GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
  `src/runtime/*`, `src/desktop/*`, `src/identity/*`, `src/worker.ts`,
  `src/board/fedos_board_nostr_adapter.ts`,
  `src/board/activitypub/fedos_activitypub_board_adapter.ts`,
  `src/board/atproto/fedos_atproto_board_adapter.ts`, Storage,
  Observation, Relay transport, or Nostr validation.

## 7. See also

- `docs/secure_runtime_alpha_299_session_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_298_session_gateway_boundary_review.md`
- `docs/secure_runtime_alpha_297_session_board_adapter.md`
- `docs/secure_runtime_alpha_296_session_source_mapping.md`
- `docs/secure_runtime_alpha_295_session_thread_mapping.md`
- `docs/secure_runtime_alpha_294_session_body_mapping.md`
- `docs/secure_runtime_alpha_293_session_author_mapping.md`
- `docs/secure_runtime_alpha_292_normalized_session_post_model.md`
- `docs/secure_runtime_alpha_291_existing_session_inventory.md`
- `docs/secure_runtime_alpha_290_atproto_board_adapter_completion.md`
