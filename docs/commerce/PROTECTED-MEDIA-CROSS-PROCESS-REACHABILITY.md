# Protected Product Media: cross-process reachability verdict

**Question asked** (FedOS Commerce Purchase Completion mega-arc, §10):
`handleCommerceProductImageAttach()` hard-codes `classification: "public"`,
so no product can ever carry protected media, so no `MediaAccessGrant` is
ever issued, so the buyer's real "Open Purchased Content" button can only
ever answer *"this product has no protected content"* — confirmed live,
before and after restart, by
`packages/fedos-desktop-electron-spike/test/commerce_e2e_two_process_real_electron.test.ts`
(STEP 9). Is removing that hard-code a bounded **wiring** job ("wire the
existing `MediaAccessGrant` / protected-media path into the buyer UI; do
NOT rebuild the entitlement system"), or a new feature build?

**Verdict: NOT BOUNDED. Deliberately left unbuilt.** Cross-process
protected content cannot be reached by wiring, because two of the three
things it needs do not exist anywhere in this repository and cannot be
created without real design decisions. It is *also* not bounded for the
same-process case, though that one is closer.

Every claim below was verified by direct source inspection at the commit
that introduced this file; each is cited so it can be re-checked rather
than trusted.

---

## What genuinely already exists (and is real, not scaffolding)

| Piece | Where | State |
| --- | --- | --- |
| Protected-media encrypt/decrypt | `src/os/commerce/catalog/wasm_product_media_encryption.ts`, `..._decryption.ts` | **Real.** Genuine Rust/WASM ChaCha20Poly1305 under the `CommerceMedia` AAD domain, fails closed to `null` at every step, round-trip tested (`test/commerce_wasm_product_media_encryption.test.ts`, `..._decryption.test.ts`, `test/commerce_ipfs_media_store.test.ts`). Wired as the store's constructor defaults. |
| A protected write/read path on the store | `src/os/commerce/catalog/ipfs_media_store.ts:355` `putProtected()`, `:388` `getProtected()`, `:370` `putPublic()` | **Real and already present.** `putProtected()` structurally cannot store plaintext. |
| Grant issuance | `src/os/commerce/media_grant/media_access_grant_issuance.ts:88` `issueMediaAccessGrantsForOrder()` | **Real**, with a production caller (`fedos_electron_beta_main.cts` `issueCommerceMediaAccessGrantsNonFatal()`, called on order transitions). |
| A redeem handler that goes all the way to bytes | `fedos_electron_beta_main.cts` `handleCommerceMediaGrantRedeem()` | **Real.** It is not merely an authorization verdict — it calls `getProtected()`, `wrapMediaAccessGrantRelease()`, then `decryptNip44Wire()`, and returns `contentBase64`. |

So the arc's premise ("the machinery exists, just wire it") is half right:
the *crypto* and the *entitlement decision* are genuinely built. What is
missing is everything between two processes.

---

## Blocker 1 — there is no byte transport between two processes. At all.

This is the headline. Verified exhaustively:

- **No IPFS client exists.** `kubo` / `helia` / `ipfs-http-client` /
  `gateway.ipfs`: zero matches across `src/`,
  `packages/fedos-desktop-electron-spike/src/`, and `package.json`.
- **Exactly one `IpfsTransport` implementation exists** —
  `ipfs_media_store.ts:149` `InMemoryIpfsTransport`, a
  `Map<string, Uint8Array>`. In-memory, per-process, per-instance, and
  discarded and rebuilt on every lock/unlock. `ipfs_media_store.ts`'s own
  header already says the Port is synchronous *precisely because* a real
  network transport cannot honestly satisfy it, and calls that an open
  design question it does not resolve.
- **No media-over-Nostr path.** No `storageRef`/`ProductMedia` reference
  appears anywhere in `src/os/commerce/events/`. The one media-adjacent
  event draft (`MediaManifestReferenceEventDraft`) documents that it
  carries a content hash and *never the bytes*, and has no production
  publisher.
- **No blob field on the three private-sync rails.** The order, delivery
  and payment-evidence payloads are fixed, allowlisted JSON shapes with no
  content or attachment field.
- **No file-on-disk media path.** `LocalProductMediaRepository` is a `Map`;
  there is no durable `ProductMedia` store.
- **No chunking.** The only size constant in this area is
  `MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES = 65_536`
  (`media_access_grant_key_release.ts`), a hard refuse — against a store
  limit of 8 MiB. No splitter, no reassembler.

There is nothing here to wire. A transport would have to be designed and
built.

## Blocker 2 — the content key is per-PROFILE, with no way to share or import one

`FedosMasterSeedAuthority` exposes:

```ts
resolveConversationKey(accountIndex: number, counterpartyPublicKeyHex: string): Promise<AeadKeyHandle | null>;
resolveCommerceMediaKey?(): Promise<AeadKeyHandle | null>;   // no accountIndex, no counterparty
```

The media key takes **no counterparty**. It is one key derived from that
process's own Master Seed, so ciphertext produced by the seller's process
is structurally undecryptable by any other profile — moving the bytes
would not help.

The obvious fix (mint a per-media content key and have the grant wrap it
for the buyer) is blocked one layer lower:
`media_access_grant_key_release.ts` states that `decrypt()` requires an
opaque `AeadKeyHandle` from `resolveCommerceMediaKey()` and that there is
**no "construct an `AeadKeyHandle` from raw bytes" entry point anywhere in
this codebase**. Adding one is a new Rust/WASM export plus a rebuilt WASM
artifact — a crypto-boundary change, explicitly out of scope for a wiring
task, and the same "per-merchant vs per-profile key scoping" question
`product_media_encryption.ts` already flags as open.

## Blocker 3 — the redeem handler is a single-process stand-in for a two-process protocol

In `handleCommerceMediaGrantRedeem()`:

```ts
const finalWrap = await m.Commerce.wrapMediaAccessGrantRelease({ ... merchantAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX, authority: activeMasterSeedAuthority, ... });
// wrapMediaAccessGrantRelease() internally encrypts to decision.grant.buyerPubkey
const unwrapped = await activeMasterSeedAuthority.decryptNip44Wire(COMMERCE_NOSTR_ACCOUNT_INDEX, order.sellerPubkey, finalWrap.wireCiphertext);
```

Same authority, same account index, but counterparty `buyerPubkey` on the
wrap and `sellerPubkey` on the unwrap. NIP-44 conversation keys are
`ECDH(self_priv, counterparty_pub)`, so these differ unless buyer ==
seller, and the unwrap returns `null` → `"wrap-unavailable"`. The wrap half
belongs in the seller's process and the unwrap half in the buyer's, with a
transport in between that does not exist.

## Blocker 4 (same-process too) — the store cannot store or retrieve anything today

`commerceMediaStoreFor()` constructs its `IpfsMediaStore` with the network
profile hard-coded to `"local-only"`, while `put()` and `get()` both gate
on `evaluateNetworkAccess(profile, /* requiresNetwork */ true)` — which
`"local-only"` denies. So every `put()` returns `failed` and every `get()`
returns `null`, unconditionally. This is not theoretical: it is already
logged as a reproducible P1 in
`docs/commerce/usability-v2/SELLER-TABLETOP-AFTER.md` ("image storage
failed: failed") and `COMMERCE-FRICTION-LEDGER-AFTER.md`.

## Blocker 5 — grant issuance can never return `"issued"` in the shipped app

`issueMediaAccessGrantsForOrder()` requires a grant-signing keypair whose
public key equals `order.sellerPubkey`.
`durable_media_grant_signing_key_store.ts`'s own header states that a
keypair it mints has a freshly-generated, cryptographically unrelated
public key that can never be forced to equal a given `subjectId` (that
would require solving the discrete log problem). Since no such keypair is
minted for the acting seller identity, issuance returns
`"seller-not-grant-capable"` unconditionally. Making sellers
grant-capable is Order/identity-model work, not media work.

---

## What the smallest honest version of the missing piece would be

Reuse the private-sync pattern this arc already built three times (order,
delivery, payment-evidence) to add a **fourth channel**: the buyer sends a
`private-media-release-request{orderId, mediaId}`; the **seller's** process
receives it, runs `getProtected()` + `wrapMediaAccessGrantRelease()`
against the buyer's real pubkey, and replies with
`private-media-release{wireCiphertext}`; the buyer calls
`unwrapMediaAccessGrantRelease()` (already written, currently unused).

That is a genuine new protocol — new event shapes, a request/response round
trip, its own replay/dedup rules — it inherits the hard **64 KiB** cap from
`MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES` so it could only ever ship
thumbnails and small documents, it requires blockers 4 and 5 fixed first,
and it makes `IpfsMediaStore` irrelevant to the cross-process story
entirely (bytes would travel over the relay, not the store). That is a
future arc's decision to take, not a wiring change.

## Why the `classification: "public"` hard-code was left in place

Flipping it alone would make things *worse*, not better: products would
start claiming protected media that the store cannot write (blocker 4),
that no grant can ever authorize (blocker 5), whose key no other process
could ever hold (blocker 2), whose bytes have no way to travel (blocker 1),
through a redeem path that decrypts against the wrong counterparty
(blocker 3). The honest state is the current one — the buyer's UI truthfully
says the product has no protected content — and it stays until a future arc
takes the protocol decision above.
