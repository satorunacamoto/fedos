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

---

## Addendum (BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc, Agent A) — blockers 1/2/3 CLOSED

This arc built exactly the protocol this doc's own "smallest honest version"
section named: a fourth private-sync channel,
`private-media-release-request` (buyer -> seller) /
`private-media-release` (seller -> buyer), reusing
`wrapMediaAccessGrantRelease()`/`unwrapMediaAccessGrantRelease()` unchanged.
Verified by direct source inspection and by
`test/commerce_private_media_release_end_to_end.test.ts` (real Order state
machine, real grant issuance, real `evaluateMediaAccessGrant()`, a
directional fake-NIP-44 authority standing in for the real WASM primitive
— the same modeling convention every other private-sync bridge test in this
repo already uses):

- **Blocker 1 (no byte transport)** — CLOSED for this one channel, within
  its inherited 64 KiB cap (`MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES`).
  Bytes now travel as `PrivateMediaReleaseReleasedPayload.wireCiphertext`
  over the real relay, exactly like the other three private-sync channels.
  `IpfsMediaStore`/`InMemoryIpfsTransport` remain irrelevant to the
  cross-process story, as this doc predicted — they are only ever consulted
  by the SELLER's own process, to decrypt its own already-stored ciphertext
  before re-wrapping the plaintext for the buyer.
- **Blocker 2 (no per-counterparty content key)** — closed the SAME way
  `media_access_grant_key_release.ts` already did for the single-process
  case: no per-media key is minted (still structurally impossible without a
  new Rust/WASM raw-key-import primitive — untouched, per this arc's own
  crypto guardrail); the release payload itself is grant-gated,
  buyer-specific re-encryption via `encryptNip44Wire()`.
- **Blocker 3 (wrap/unwrap counterparty mismatch)** — CLOSED. The wrap now
  genuinely happens in the seller's own process
  (`buildOutboundPrivateMediaReleaseResponse()`,
  `src/os/commerce/events/commerce_private_media_release_apply.ts`) and the
  unwrap in the buyer's own, different process
  (`applyInboundPrivateMediaReleaseResponse()`, same file), each against its
  own real, independently-unlocked `FedosMasterSeedAuthority` — no longer a
  single-process stand-in. `fedos_electron_beta_main.cts`'s
  `handleCommerceMediaGrantRedeem()` no longer calls
  `wrapMediaAccessGrantRelease()`/`evaluateMediaAccessGrant()`/
  `commerceMediaStoreFor().getProtected()` directly at all — those only run
  inside the seller-side request handler now, gated on the real,
  cryptographically-verified requesting buyer's identity.

**Blockers 4 and 5 are UNCHANGED, and are the reason this channel still
cannot succeed end-to-end in the shipped app today**, even though the
transport/crypto/protocol gap above is closed:

- **Blocker 4** (`commerceMediaStoreFor()` hard-codes `"local-only"` to
  `IpfsMediaStore`'s constructor, independent of the real
  `commerceNetworkProfile`) is still live — re-verified by direct source
  read this arc. `getProtected()` still unconditionally returns `null` for
  any real product, so the seller-side response handler still answers
  every real request with `outcome: "denied", reason: "content-unavailable"`.
  This is store/catalog territory this arc's mandate did not include.
- **Blocker 5** (grant issuance requires a signing keypair whose public key
  equals `order.sellerPubkey` literally) is also still live, and this arc
  specifically investigated whether it is now fixable for a REAL (not
  demo-fixed) seller identity: `FedosNostrSigningAuthority` — the one
  signing surface a seller's real account identity actually exposes — is
  scoped to `signEvent(request: FedosNostrUnsignedEventRequest)` only (a
  whole, allowlisted Nostr event shape), never an arbitrary-bytes-sign
  primitive, and no accessor anywhere in
  `fedos_production_master_seed_authority.ts` exposes the account's raw
  secret key material (grepped directly, zero matches for
  `secretKeyBytes`/`SecretKey`/`privateKeyBytes`/`signBytes` in that file).
  Backing a `MediaAccessGrantSigningKeypair` for a real seller identity
  would therefore require EITHER a new raw-secret-exposing accessor (weakens
  key separation between the Nostr identity and the grant-signing purpose —
  exactly this arc's own "STOP and document" crypto guardrail) OR a redesign
  of `MediaAccessGrant`'s own sign/verify scheme to be Nostr-event-shaped
  instead of a raw canonical-bytes Schnorr signature (a real, cross-cutting
  design change, not a wiring fix). **Verdict: structurally blocked, not
  fixed, deliberately** — same disclosed-limitation posture this doc and
  `durable_media_grant_signing_key_store.ts`'s own header already document
  for the demo actors, now confirmed to extend to real seller identities
  too under the currently-exposed signing surface.

Since protected media can never actually be attached in the shipped app
today (the `classification: "public"` hard-code above, still in place),
none of this is reachable live yet — this addendum documents that the
transport/protocol half of the gap is closed and tested, while the
store-availability and seller-signing-capability halves remain the two
concrete blockers a future arc (or Agent M's sibling work landing first)
would need to close before a buyer can ever see real released bytes.

---

## Addendum 2 (Coordinator security review, post-integration) — corrections to Addendum 1, and one NEW limitation

Addendum 1 was written on Agent A's own branch, before Agent M's merged into
the same integration. Three of its closing statements are **no longer true of
the integrated branch** and are corrected here rather than left to mislead:

- **"Blocker 4 … is still live"** — CORRECTED. Agent M fixed it:
  `IpfsTransport` now declares a `requiresNetwork` self-report and
  `IpfsMediaStore.put()`/`get()` consult it instead of a hard-coded `true`
  (`src/os/commerce/catalog/ipfs_media_store.ts`). Independently re-verified:
  `InMemoryIpfsTransport` is still the ONLY implementation in the repository
  and honestly declares `false`; a transport declaring `true` is still refused
  under `"local-only"` (`test/commerce_ipfs_media_store.test.ts` 16/16b), and
  nothing in this store performs a real network call either way, so no genuine
  egress gate was relaxed. The read is now additionally FAIL-CLOSED (anything
  not literally `false` counts as network-requiring) because the store is
  constructed across an untyped composition-root boundary.
- **"protected media can never actually be attached in the shipped app"** —
  CORRECTED. `handleCommerceProductContentAttach()` /
  `fedos-app:commerce-product-content-attach` (Agent M) is a real, registered
  IPC path that writes `classification: "protected"` `ProductMedia` records.
- **Blocker 5 (`"seller-not-grant-capable"`)** — still live, unchanged, and its
  practical impact is now WORSE than when this doc was written, precisely
  because attach works: a real seller can now attach a purchased file, but
  `issueCommerceMediaAccessGrantsNonFatal()` still cannot mint a grant for a
  real seller identity, so the release channel answers every request with a
  denial and the buyer never receives bytes.

**NEW limitation this review found — the order-completion "digital content
delivery invariant" is PER-PROCESS, and therefore vacuous on the buyer's own
process.** `evaluateDigitalContentDeliveryInvariantForOrderCompletion()`
(`src/os/commerce/media_grant/media_access_grant_release_channel_policy.ts`) is
fed from `commerceProductMediaState()` — a per-process, in-memory
`LocalProductMediaRepository` that is populated ONLY by the two seller-side
attach handlers. No code path anywhere ingests `ProductMedia` from the network
(this doc's own Blocker 1 already established that `storageRef`/`ProductMedia`
appear in no event shape). Consequences on a genuinely two-process trade:

- On the **buyer's** process `listForProduct(order.productId)` is `[]`, so the
  invariant reports `satisfied: true` unconditionally and the buyer can
  complete an order whose protected content was never delivered. The same is
  true on any process after a restart (the media repository is in-memory).
- On the **seller's** process the invariant can never be satisfied at all — the
  release cache is only ever written by the BUYER-side apply path — so a seller
  can never complete a digital order locally.

That policy module's own header claim that `"completed"` "can no longer be
reached for an under-delivered digital Order", and the transitive reputation
claim built on it, therefore hold only in a single-process/tabletop topology.
A second, independent bypass existed even there: an inbound
`private-order-sync` payload with `status: "completed"`
(`PRIVATE_ORDER_SYNC_STATUS_ACTION.completed`, `actorKind: "either"`) reached
`applyOrderAction(order, { type: "complete" })` through
`applyInboundPrivateOrderSyncPayload()` without consulting the invariant at
all. **FIXED** (commit `6384eec0`, same review):
`applyInboundPrivateOrderSyncNonFatal()` now re-runs the same invariant check
before saving any inbound transition into `"completed"`, symmetrically with
the local path — see that function's own comment and
`media_access_grant_release_channel_policy.ts`'s own updated header. The
per-process vacuity above is NOT fixed by this — both call sites now enforce
the SAME check, and that check is still vacuous on a process that never
listed the product itself.

**The identical vacuity also blocks the buyer-facing redeem attempt itself,
not just the completion invariant.** `handleCommerceMediaGrantRedeem()`
(`fedos_electron_beta_main.cts`) short-circuits to `{outcome: "not-found",
reason: "this product has no protected content"}` from the SAME
`commerceProductMediaState().listForProduct(order.productId)` lookup, BEFORE
ever calling `sendPrivateMediaReleaseRequestNonFatal()` — confirmed by direct
inspection, not inference. So even with Blockers 4/5 both fixed and a real
seller identity, a genuinely independent buyer's process today reports "no
protected content" for a product that actually has some, without ever
attempting the cross-process request — this is INDISTINGUISHABLE in the UI
from the product genuinely having no protected media, which is also the
scenario the two-process E2E suite's own STEP 9 currently exercises (that
test's product never calls the protected-content attach path at all, so its
"no protected content" result is separately, truthfully correct for THAT
product — it does not exercise, and therefore cannot by itself disprove, this
vacuity). Making the invariant and the redeem attempt both real needs
cross-process `ProductMedia` metadata knowledge (id + classification, never
bytes) and a decision about which process owns completion authority, which is
protocol design, not wiring — the closest existing scaffold remains the
drafted-but-unwired `MediaManifestReferenceEventDraft` this doc's Blocker 1
section already names.

## Addendum 3 (Coordinator validation gate, live bug fix) — the encrypt/decrypt row above was true only in tests, never in a real launch

This doc's own "What genuinely already exists" table calls protected-media
encrypt/decrypt **"Real. Genuine Rust/WASM ChaCha20Poly1305 … round-trip
tested … wired as the store's constructor defaults."** Every clause of that
is literally true of the code and of the test suite, and the conclusion a
reader draws from it — "so a real seller can encrypt a real file" — was
nevertheless **false in every real launch of the app**, from the day
`WasmProductMediaEncryption` was written until this fix.

**Reproduced live, three times, 100% of attempts** (fresh profile, real
packaged and dev Electron, real unlocked Master Seed, real 1 KB `%PDF-1.4`
file, both draft and published products): the seller-facing
"Attach Purchased File" control answered `protected content storage failed:
failed`, with zero console output, zero main-process output, and an empty
`<userdata>/profile/logs/`.

**Root cause** (captured, not inferred — from instrumentation inside the
running app): `WasmProductMediaEncryption`'s DEFAULT dependencies were
`encrypt()`/`exportCiphertext()` from
`src/os/core/vault/wasm/fedos_runtime_encrypt.ts` /
`fedos_runtime_export_ciphertext.ts`. Those are **development-runtime
scaffolding**: each constructs its own fresh `FedosWasmLoader` per call and
reaches Rust only through `attemptDevOnly*` methods gated on
`NODE_ENV === "development"`. In the real app the gate reported

```
{ artifactsExist: false, developmentAllowed: false, reason: "UnknownRuntime",
  ready: false, importSucceeded: false, module: false, wasmInit: false }
-> attemptDevOnlyEncryptCall() = { attempted: false, succeeded: false,
                                   reason: "NotInitialized" }
```

so `encrypt_aead()` was **never called at all**. Everything on either side of
it was healthy: the real `FedosProductionMasterSeedAuthority` was present and
resolved a genuine `AeadKeyHandle` from `resolveCommerceMediaKey()`, and the
store's own `put()` succeeded on the same bytes via `putPublic()` — i.e.
Blocker 4's fix is genuinely good and was NOT the cause.

**This is a pre-existing defect of the underlying machinery, not of the
attach handler.** `fedos_production_conversation_encryption_runtime_boundary.ts`'s
own header had already documented this exact trap and already solved it for
Conversations (reach `FedosProductionMasterSeedAuthority`'s own
`encryptAead()`/`serializeAeadCiphertext()` — the same Rust exports, on the
same module instance that minted the key handle). Commerce media never got
that treatment, and nothing exercised it, because until this arc wired the
first real IPC caller there was no production caller at all. Every existing
test passed throughout: they all inject a fake `ProductMediaEncryptionPort`
or a fake `deps`, so the adapter's real default resolution was never crossed.

**Fixed** by making both Commerce media adapters prefer the injected
authority's own production AEAD bridge when it structurally offers one, and
fall back to the dev-only exports otherwise (structural duck-typing only —
`src/os/commerce/` still imports nothing from `src/os/messenger/**`). The
decrypt side was fixed identically; left alone it would have failed the
buyer's redeem for exactly the same reason.

**Two diagnosability defects fixed alongside it**, both of which are why this
took a live repro to find at all:

- `IpfsMediaStore.putProtected()` returned the bare `MediaStorePutResult`
  `{ outcome: "failed" }` for an encryption failure — the same value `put()`
  returns for a refused network profile or a transport failure. Its return
  type is now widened (never narrowed) with a protected-put-only
  `"encryption-unavailable"`; `MediaStorePort` itself is unchanged.
  `handleCommerceProductContentAttach()` maps each outcome to its own
  actionable seller sentence instead of one unactionable string.
- `<userdata>/profile/logs/` has been declared (`logsDirectory`) and created
  on every first run since Alpha 4661-4740, and — verified by direct search —
  **nothing in this repository had ever written a byte to it.** A narrow,
  append-only, non-secret NDJSON failure sink
  (`logs/commerce-diagnostics.ndjson`, mirrored to `console.error`) now
  records this failure class with its real outcome, product id, content type,
  size and unlock state.

**Also fixed, found while proving the above:** the seller's own
"what's attached" summary never rendered for ANY product, ever —
`refreshCommerceMerchantProductMediaSummary()` resolved its container by
`document.getElementById()` synchronously, before its first `await`, while
the row was still detached from the document, so the lookup always returned
`null`. And Windows' Chromium reports a `.zip` file's `File.type` as
`application/x-zip-compressed` (from `HKCR\.zip\Content Type`), which the
allowlist rejected; a tiny closed alias map now canonicalizes that (and
`application/x-zip`, `application/x-pdf`) to the already-allowed value, so no
new format is admitted and no second spelling ever reaches storage.

Live regression coverage:
`packages/fedos-desktop-electron-spike/test/commerce_protected_content_attach_real_electron.test.ts`
— a real Electron launch, real WASM, real unlocked profile, driving the real
DOM file picker via the `ui-script` harness's new `attachFile` action (the
one thing that harness could not previously do, and therefore the reason this
whole class of failure had no automated coverage).
