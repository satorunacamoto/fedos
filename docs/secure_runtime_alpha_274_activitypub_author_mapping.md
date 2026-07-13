# Secure Runtime Alpha 274 — ActivityPub Author Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedActivityPubPostToBoardPostInput` at Alpha 277.** Stage 4 of
the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.

## 1. Why now

`FedosBoardAuthorReference` (Alpha 254) was already fixed by the
Canonical Board Model Arc. This Stage fixes exactly how
`FedosValidatedActivityPubPost.actorId` populates it — mirroring Alpha
262's own Nostr author-mapping decision, restated for ActivityPub's own
vocabulary.

## 2. The mapping

```
post.actorId    ->  FedosBoardAuthorReference.publicIdentifier   (verbatim)
"activitypub"   ->  FedosBoardAuthorReference.protocol            (fixed constant)
null            ->  FedosBoardAuthorReference.identityId          (fixed, this Arc)
```

## 3. `identityId` — always `null` this Arc

No local-identity-linking logic exists anywhere in this repository yet
— the SAME reasoning Alpha 262 §4 already established for Nostr applies
identically here. Every `FedosBoardPost` this adapter produces carries
`author.identityId === null`, unconditionally.

## 4. Explicitly excluded — no profile resolution, no network

Per this Arc's own instruction, verbatim: "Do not fetch profile data. Do
not resolve: preferredUsername, name, icon, image, summary, followers,
following. No network calls." Confirmed structurally:

- `FedosValidatedActivityPubPost` (Alpha 272) has no field for any of
  `preferredUsername`/`name`/`icon`/`image`/`summary`/`followers`/
  `following` — there is nothing to resolve INTO even if the adapter
  wanted to; the type itself makes the prohibition structural, not just
  a matter of adapter discipline.
- No Actor object, Actor fetch, or Actor cache of any kind is referenced
  anywhere in `src/board/activitypub/`.
- `mapValidatedActivityPubPostToBoardPostInput` (Alpha 277) is
  synchronous — no `async function`, no `Promise`, no `await` — so no
  network call could occur even by accident.
- **"Display profile data belongs to a separate profile-resolution
  layer."** Exactly the same separation Alpha 254 §3 already fixed for
  `displayName`/`avatar` at the Canonical Board Model layer — this Stage
  does not reopen or weaken that decision; it confirms ActivityPub gives
  no reason to.

## 5. Permanent prohibitions (verbatim from this Arc's own instruction)

None of the following may ever appear on `FedosBoardAuthorReference` via
this mapping, and none does — confirmed structurally, since
`FedosValidatedActivityPubPost` (Alpha 272) carries no field for any of
them in the first place:

- HTTP Signature private key
- OAuth token
- bearer token
- session cookie
- Mastodon application secret
- Actor private metadata

## 6. See also

- `docs/secure_runtime_alpha_272_normalized_activitypub_post_model.md`
- `docs/secure_runtime_alpha_254_canonical_board_author.md`
- `docs/secure_runtime_alpha_262_nostr_author_mapping.md`
