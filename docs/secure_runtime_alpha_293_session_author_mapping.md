# Secure Runtime Alpha 293 — Session Author Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedSessionPostToBoardPostInput` at Alpha 297.** Stage 3 of the
Alpha 291–300 Session Canonical Board Gateway Adapter Arc.

## 1. Why now

`FedosBoardAuthorReference` (Alpha 254) was already fixed by the
Canonical Board Model Arc. This Stage fixes exactly how
`FedosValidatedSessionPost.authorId` populates it — the FOURTH and final
time this exact decision is made (Alpha 262 Nostr, Alpha 274
ActivityPub, Alpha 284 AT Protocol), restated for Session's own
vocabulary.

## 2. The mapping

```
post.authorId   ->  FedosBoardAuthorReference.publicIdentifier   (verbatim)
"session"       ->  FedosBoardAuthorReference.protocol            (fixed constant)
null            ->  FedosBoardAuthorReference.identityId          (fixed, this Arc)
```

`post.sessionId` (Alpha 292 §3) is NOT used here — it is a
Gateway-ingestion-context reference, not an author identifier; using it
in place of `authorId` would be exactly the kind of category error
Alpha 291 §3.1 already flagged for this repository's unrelated
`session_boundary.ts`.

## 3. `identityId` — always `null` this Arc

No local-identity-linking logic exists anywhere in this repository yet
— the SAME reasoning Alpha 262 §4, Alpha 274 §3, and Alpha 284 §3 already
established for Nostr, ActivityPub, and AT Protocol applies identically
here. Every `FedosBoardPost` this adapter produces carries
`author.identityId === null`, unconditionally.

## 4. Explicitly excluded — no identity resolution, no profile fetch, no
network

Per this Arc's own instruction, verbatim: "Identity解決禁止"
("identity resolution prohibited"), "プロフィール取得禁止" ("profile
fetching prohibited"), "ネットワーク禁止" ("network prohibited").
Confirmed structurally:

- `FedosValidatedSessionPost` (Alpha 292) has no field for a display
  name, avatar, or any other profile attribute — there is nothing to
  resolve INTO even if the adapter wanted to, the identical structural
  guarantee Alpha 274 §4 and Alpha 284 §5 already established for
  ActivityPub and AT Protocol.
- No Session network client, Oxen connection, or identity-resolution
  call of any kind is referenced anywhere in `src/board/session/`.
- `mapValidatedSessionPostToBoardPostInput` (Alpha 297) is
  synchronous — no `async function`, no `Promise`, no `await` — so no
  network call could occur even by accident.
- **Display profile data belongs to a separate profile-resolution
  layer.** The SAME separation Alpha 254 §3 fixed at the Canonical
  Board Model layer, reconfirmed by every one of this Arc's three
  predecessors — this Stage does not reopen or weaken that decision.

## 5. `authorId` is copied verbatim — no format assumption

`authorId` is treated as an OPAQUE string, exactly like `pubkey`
(Nostr), `actorId` (ActivityPub), and `authorDid` (AT Protocol) before
it — no format validation, no prefix check, no length assumption. This
Arc does not assume `authorId` is a real Session ID (the
`05`-prefixed, 66-hex-character account identifier Session's own
protocol uses) in any structural sense; it is validated only for
non-emptiness (Alpha 297 §4), matching every prior adapter's identical
scope limit.

## 6. See also

- `docs/secure_runtime_alpha_292_normalized_session_post_model.md`
- `docs/secure_runtime_alpha_254_canonical_board_author.md`
- `docs/secure_runtime_alpha_284_atproto_author_mapping.md`
