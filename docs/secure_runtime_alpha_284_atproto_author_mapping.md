# Secure Runtime Alpha 284 — AT Protocol Author Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedAtprotoPostToBoardPostInput` at Alpha 287.** Stage 4 of
the Alpha 281–290 AT Protocol Canonical Board Adapter Arc.

## 1. Why now

`FedosBoardAuthorReference` (Alpha 254) was already fixed by the
Canonical Board Model Arc. This Stage fixes exactly how
`FedosValidatedAtprotoPost.authorDid` populates it — mirroring Alpha 262
(Nostr) and Alpha 274 (ActivityPub)'s own author-mapping decisions,
restated for AT Protocol's own vocabulary.

## 2. The mapping

```
post.authorDid   ->  FedosBoardAuthorReference.publicIdentifier   (verbatim)
"atproto"        ->  FedosBoardAuthorReference.protocol            (fixed constant)
null             ->  FedosBoardAuthorReference.identityId          (fixed, this Arc)
```

## 3. `identityId` — always `null` this Arc

No local-identity-linking logic exists anywhere in this repository yet
— the SAME reasoning Alpha 262 §4 and Alpha 274 §3 already established
for Nostr and ActivityPub applies identically here. Every
`FedosBoardPost` this adapter produces carries `author.identityId ===
null`, unconditionally.

## 4. The DID is the identity — the handle is NOT

**"The stable DID is the author identifier. Handles are mutable
presentation data and must not be used as the canonical author
identity."** This Arc's own instruction states this explicitly, and it
matches AT Protocol's own design intent exactly: a `did:plc:...`/
`did:web:...` value is permanent for the account's lifetime, while a
`@handle.example` is a mutable, re-registerable DNS/well-known-backed
alias that can change at any time and is resolved TO a DID, never the
reverse. `FedosValidatedAtprotoPost` (Alpha 282) carries no `handle`
field at all — there is nothing for the adapter to even be tempted to
use instead of `authorDid`, structurally.

## 5. Explicitly excluded — no profile resolution, no network

Per this Arc's own instruction, verbatim: "No profile resolution. Do not
resolve or include: handle, displayName, avatar, description, labels,
followers, PDS endpoint, DID service entries, signing key, repository
metadata. No network access." Confirmed structurally:

- `FedosValidatedAtprotoPost` (Alpha 282) has no field for any of
  `handle`/`displayName`/`avatar`/`description`/`labels`/`followers`/
  `PDS endpoint`/`DID service entries`/`signing key`/`repository
  metadata` — there is nothing to resolve INTO even if the adapter
  wanted to, the identical structural guarantee Alpha 274 §4 already
  established for ActivityPub.
- No DID Document, DID resolution call, or PDS/App View client of any
  kind is referenced anywhere in `src/board/atproto/`.
- `mapValidatedAtprotoPostToBoardPostInput` (Alpha 287) is
  synchronous — no `async function`, no `Promise`, no `await` — so no
  network call could occur even by accident.
- **"Display profile data belongs to a separate profile-resolution
  layer."** The SAME separation Alpha 254 §3 fixed at the Canonical
  Board Model layer, and Alpha 274 §4 reconfirmed for ActivityPub — this
  Stage does not reopen or weaken that decision.

## 6. Permanent prohibitions (verbatim from this Arc's own instruction)

None of the following may ever appear on `FedosBoardAuthorReference` via
this mapping, and none does — confirmed structurally, since
`FedosValidatedAtprotoPost` (Alpha 282) carries no field for any of them
in the first place:

- app password
- access token
- refresh token
- OAuth token
- session credential
- private signing key

## 7. See also

- `docs/secure_runtime_alpha_282_normalized_atproto_post_model.md`
- `docs/secure_runtime_alpha_254_canonical_board_author.md`
- `docs/secure_runtime_alpha_274_activitypub_author_mapping.md`
