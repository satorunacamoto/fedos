# Secure Runtime Alpha 260 — Canonical Board Model Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change of
any kind. This is Stage 10, the closing Stage, of the Alpha 251–260
Canonical Board Model Foundation Arc.**

## 1. Why now

Alpha 251 inventoried the existing repository and confirmed no canonical
board model existed and none of this repository's existing label-only
descriptors was reusable; Alpha 252–255 built the identifier,
provenance, author, and post types; Alpha 256–258 fixed thread/reply
semantics, the validation boundary, and the moderation-separation
decision; Alpha 259 verified all four target protocols map onto the same
model by real fixture construction. This Stage issues the Arc's own
closing Completion Declaration.

## 2. The Foundation, confirmed complete

```
FedosBoardId / FedosThreadId /              FedosBoardSourceReference
FedosBoardPostId / FedosExternalReference     { protocol, reference }
  (Alpha 252, branded, no free                  (Alpha 253, explicit
   interchange, no auto-generation)              provenance, no inference)
        \                                              /
         \                                            /
          v                                          v
                    FedosBoardAuthorReference
              { identityId, protocol, publicIdentifier }
         (Alpha 254, "Option D", no displayName/avatar snapshot)
                              |
                              v
                       FedosBoardPost
        { id, boardId, threadId, replyTo, author,
          body, createdAt, source }
     (Alpha 255, immutable, 8 fields, no transport object)
                              |
              threadId = root / replyTo = direct parent
                    (Alpha 256, "Option C")
                              |
                              v
                validateFedosBoardPost(input) -> FedosBoardPost | null
        (Alpha 257, typed builder, fail-closed, deep-copy + freeze)
                              |
                              v
              FedosBoardModerationRecord (SEPARATE, inert)
           { postId, state, reasonCode, moderatorId, appliedAt }
                    (Alpha 258, "Option B", no deleted bool)

-- verified against real fixtures for Nostr, ActivityPub, AT Protocol,
   and Session, all constructing through the SAME validator, no real
   network call (Alpha 259) --
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
confirmed by `package.json`'s own `dependencies` count staying fixed at
2, unchanged across this whole Arc (matching Alpha 241 §3.6's own
precedent for the prior Arc).

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. A protocol-independent
Canonical Board Model now exists under `src/board/`: an immutable
`FedosBoardPost`, constructible ONLY through a fail-closed validation
boundary, carrying explicit provenance and an author reference that never
embeds a transport object, a stale profile snapshot, or a secret of any
kind — verified, by real fixture construction, to honestly represent
Nostr, ActivityPub, AT Protocol, and Session gateway content without any
protocol-specific field.**

The following are now declared complete, exactly as this Arc's own Alpha
260 instruction lists:

- **Canonical board identifiers** — `FedosBoardId`/`FedosThreadId`/
  `FedosBoardPostId`/`FedosExternalReference`, Alpha 252, "Option C"
  adopted, no free interchange, no random generation.
- **Provenance model** — `FedosBoardSourceReference`, Alpha 253, a
  closed five-protocol union, explicit duplicate-identity key
  (`fedosBoardSourceKey`), no secret/token/credential field.
- **Author reference** — `FedosBoardAuthorReference`, Alpha 254,
  "Option D" adopted, `displayName`/`avatar` deliberately excluded to
  avoid a stale profile snapshot on an immutable type.
- **Immutable board-post model** — `FedosBoardPost`, Alpha 255, eight
  fields, `readonly` throughout, no transport object, no speculative
  field, plain-text `body` only.
- **Thread/root/direct-parent semantics** — Alpha 256, "Option C"
  adopted (`threadId` = root, `replyTo` = direct parent), every required
  invariant assigned to the layer that can actually check it, missing-
  parent handling explicitly defined (orphan reply, Board Application
  Logic's own responsibility).
- **Validation boundary** — `validateFedosBoardPost`, Alpha 257, "Option
  B" typed builder adopted, fail-closed, no exception, deep-copy +
  freeze, zero cryptographic/network/storage call.
- **Moderation separation** — `FedosBoardModerationRecord`, Alpha 258,
  "Option B" adopted, kept entirely separate from `FedosBoardPost`, no
  `deleted` boolean, source-deletion vs. local-deletion distinction
  preserved as two separate reason codes, file inert (types + label
  constants only).
- **Protocol-neutral representation** — Alpha 259, confirmed by real
  fixture construction for all four target protocols through the same
  validator, no adapter module added anywhere.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Nostr adapter — no file maps a `FedosValidatedNostrEvent` into a
  `FedosBoardPost` in production code; Alpha 259's own mapping exists
  only inline inside a test file.
- ActivityPub adapter — same; no production mapping exists.
- ATProto adapter — same.
- Session gateway — same; no production mapping, no gateway client.
- Persistence — no `src/board/` file imports `src/storage/`.
- Search, ranking, likes, reposts, notifications — no such field or
  function exists anywhere in `src/board/`.
- Attachments, images — no byte-carrying or attachment-reference field
  exists on `FedosBoardPost`.
- HTML sanitization — no HTML-aware code exists anywhere in `src/board/`.
- Moderation implementation — `FedosBoardModerationRecord` (Alpha 258)
  is a type only; no function reads, writes, or enforces it.
- GUI — no rendering code was added; `src/render/` is untouched by this
  Arc.
- Relay Pool — untouched; `src/desktop/fedos_relay.ts` and
  `websocket_relay.ts` carry zero reference to `src/board/`.

## 5. Next Arc recommendation

**Nostr Canonical Board Adapter Arc.**

Reason (verbatim from this Arc's own required recommendation): Nostr is
the first implemented and validated protocol path — `FedosValidatedNostrEvent`
(Alpha 242) already exists, cryptographically verified, end to end,
through a real `WebSocketRelay` (Alpha 248–249) — so it should become the
REFERENCE adapter from `FedosValidatedNostrEvent` into `FedosBoardPost`
before other bridges (ActivityPub, AT Protocol, Session) are added.
Alpha 259's own inline fixture mapping (§3 of that Stage's doc) is
deliberately NOT promoted to production code by this Arc — writing the
real, tested, production `src/board/` (or a new `src/board/adapters/`)
Nostr adapter module is exactly the next Arc's own Objective, not this
one's.

## 6. What this Stage does NOT do

- Does **not** modify `fedos_board_identifiers.ts`, `fedos_board_source.ts`,
  `fedos_board_author.ts`, `fedos_board_post.ts`,
  `fedos_board_post_validator.ts`, or `fedos_board_moderation.ts` beyond
  what Alpha 252–258 already landed — no further production code change.
- Does **not** implement a Nostr/ActivityPub/ATProto/Session adapter, a
  Relay Pool, storage, moderation enforcement, ranking, notifications, a
  DM path, or a GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
  `src/runtime/*`, `src/desktop/*`, `src/identity/*`, `src/worker.ts`,
  Storage, Observation, Relay transport, or Nostr validation.

## 7. See also

- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_258_moderation_deletion_boundary.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_254_canonical_board_author.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_252_canonical_board_identifiers.md`
- `docs/secure_runtime_alpha_251_existing_board_model_inventory.md`
- `docs/secure_runtime_alpha_250_inbound_validation_completion.md`
