# ProductMedia Sync Protocol — Design

**Agent M, FedOS "Commerce Product-Media Sync + Truthful Completion" mega-arc, Wave A.**

## What this closes

`docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`'s Blocker 1 and
its Addendum 2's "NEW limitation": a genuinely independent buyer process has
**no way to learn a Product has `ProductMedia` at all** — `ProductMedia`
never appears in any event shape, so `commerceProductMediaState()` on the
buyer's own process is always `[]` for a product it did not itself list.
Two consequences documented there, both real, both confirmed live:

1. `handleCommerceMediaGrantRedeem()` short-circuits to `"this product has no
   protected content"` **before ever attempting** the already-built
   `private-media-release-request` channel.
2. `evaluateDigitalContentDeliveryInvariantForOrderCompletion()` is satisfied
   **vacuously** on the buyer's own process, letting a digital Order reach
   `"completed"` — with a valid signed receipt and written reputation — while
   the buyer received zero bytes.

This document designs, and the accompanying code implements, the missing
piece: a **public** ProductMedia declaration/retraction that travels the
same way a Product's own `product-publication`/`product-update` already
does, so `ProductId -> {mediaId, classification, ...}` becomes real,
verified, ordered, replay-safe knowledge on a buyer's own process — **never**
the protected bytes or the decryption material themselves, which continue to
travel only over the already-built, already-tested
`private-media-release-request`/`private-media-release` channel, gated by
the (out-of-scope, disclosed) grant-issuance signing-key blocker.

**Out of scope, explicitly** (per mandate): fixing Blocker 5 (seller
grant-signing-key custody); Electron main-process wiring (Wave B); Rust/WASM.

---

## 1–9: The ten design questions

### 1. What ProductMedia metadata is public?

Everything a `product-publication` event already discloses is the bar: this
product's creator has already told the world it sells `productId` under
`creatorPubkey`, at a price, with a title/description. Declaring that this
same, already-public product *also* has a media entry with a given
`classification`/`role`/`contentType`/rough size/content-commitment adds
**no new disclosure about the buyer, the trade, or the plaintext** — it is
exactly as public as the product listing it's attached to. Concretely
public: `mediaId`, `productId`, `sellerPubkey` (== product's own
`creatorPubkey`, already public), `role`, `classification`, `contentType`,
`sizeClass` (bucketed — see §"resolved ambiguities" below), `checksum` +
`checksumSubject`, `altText`, `version`, `declaredAt`. The outer Nostr
event's own signature stands in for "the seller's signature over the
publication" — no separate signature field is carried in the JSON content,
mirroring `ProductPublicationEventDraft`'s own convention exactly.

### 2. What remains private?

Everything already private stays private, unconditionally, and is
**structurally impossible** to place on this declaration (not merely
omitted by convention): the decryption/content key, the
`MediaAccessGrant` envelope or its secret payload, the buyer's identity,
`Order`/`Payment`/`Delivery` details, the raw `storageRef` (an opaque
pointer into a `MediaStorePort` — publishing it would leak internal backend
layout for zero buyer benefit, exactly as `MediaManifestReferenceEventDraft`'s
own header already argued), and the plaintext itself. See the field-by-field
table below.

### 3. What does Alice need before purchase?

Enough to make an informed buy decision and to set correct expectations:
that the product **has** protected content (so "buy now, get nothing" isn't
a live possibility she can't detect), its `role`/`contentType`/coarse size,
and whether a public preview/sample exists she can inspect first. She does
**not** need — and must never receive — the bytes, the checksum's plaintext
meaning beyond "a commitment exists," or anything that would let her verify
content *before* paying (that would defeat the point of gating it behind
payment).

### 4. What does Alice learn only after authorized delivery?

The actual bytes and their real, verified content — via the pre-existing
`private-media-release-request`/`private-media-release` channel, which this
protocol does not touch or need to touch. This declaration never carries
enough to reconstruct or verify plaintext; it only lets her *ask* for
delivery, and later cross-check that what she received matches the
`checksum` she already knew about (a real end-to-end integrity check that
does not currently exist — see "resolved ambiguities").

### 5. How is content identity bound to Product identity?

Two independent checks, mirroring `CommerceNostrProductReadModel`'s own
`product-update` discipline exactly:

- **Structural**: `ProductMediaDeclaration.productId` is a plain field: the
  declaration says which product it belongs to.
- **Cryptographic**: the read model only accepts a declaration if (a) the
  declaration's own `sellerPubkey` equals the **real, already-established**
  creator of `productId` (from a previously-applied `product-publication`),
  and (b) the outer Nostr event's real, verified signer
  (`envelope.authorPubkeyHex`) equals that same `sellerPubkey`. Either
  mismatch is rejected before any state mutation. A media declaration for a
  product this process has never seen a `product-publication` for is
  rejected outright (`"unknown-product"`) — media metadata can never precede
  the product it describes, exactly like `product-update`.

This is the direct fix for "product binding (wrong Product rejected)": an
attacker cannot attach their own protected-content advertisement to
someone else's real product, because they cannot forge either check.

### 6. How are updates ordered?

An explicit, monotonic `version: number` per `mediaId` — **not** a raw
timestamp watermark. This deliberately departs from
`product-publication`/`product-update`'s own `publishedAt`/`updatedAt`
watermark convention: those fields are wall-clock, caller-supplied, and can
collide at one-second resolution; `MediaAccessGrantPayload.grantVersion`
(`media_access_grant_issuance.ts`: "grantVersion = previous known + 1,
never...") already establishes the precedent this codebase uses exactly
where duplicate-in-the-same-second issuance is a real risk (grant re-issue
on order re-processing). Product-media declarations can plausibly be
attached/edited in rapid succession by a seller UI (attach several files
back to back), so the same reasoning applies. `declaredAt`/`retractedAt`
remain present as informational unix-seconds timestamps (structurally
validated) but are **never** the ordering authority — only `version` is.
A later `version` for the same `mediaId` strictly must exceed the
highest version ever applied (declaration OR retraction) for that id, or it
is rejected as stale, without mutating state.

### 7. How is unpublish/removal represented?

A **second, sibling category**, `product-media-retraction` — not a status
field on the declaration itself (`ProductMedia` the domain type has no
`status`/lifecycle field to mirror; a media entry is either attached or
removed by the seller, there is no "archived-but-still-listed" state for a
single media item the way there is for a whole `Product`). A retraction
carries `mediaId`/`productId`/`sellerPubkey`/`version`/`retractedAt` and,
once applied, both marks the media id retracted (buyer UI must show
"unavailable", not silently keep showing stale public/protected metadata)
and — critically — **advances that mediaId's version watermark**, so any
older, stale declaration event replayed after the retraction (e.g. by a
relay redelivering old events, or a malicious replay) is rejected as stale,
never resurrecting removed metadata. Retraction is idempotent: a duplicate
retraction (same event id) is a no-op; a second, later-version retraction
for an already-retracted id is accepted (no-op observable effect, but not
rejected — a seller may legitimately re-affirm removal).

### 8. How are stale/replayed events rejected?

Three independent, composable checks, all mirroring
`CommerceNostrProductReadModel`'s own established discipline:

1. **Event-id dedup** (`"duplicate"`) — the exact same signed event replayed
   (e.g. by a relay's REQ/EOSE re-delivering already-seen events on every
   query, per `commerce_offline_reconnect_discovery.test.ts`'s own header)
   is a true no-op, not re-applied.
2. **Version watermark** (`"stale-version"`) — a declaration or retraction
   whose `version` does not strictly exceed the highest version already
   applied for that `mediaId` is rejected without mutating state. This
   covers both "duplicate publication replay" (same version resent under a
   different event id — rejected, safe/idempotent, no double effect) and
   "stale-after-newer-version replay" (an old version replayed after a newer
   one already applied).
3. **Post-retraction replay** — falls out of (2) for free: retraction
   advances the watermark, so any declaration event with `version` at or
   below the retraction's own version — which every version that existed
   *before* the retraction necessarily satisfies — is rejected as stale.
   No separate "is this mediaId retracted" special case is needed for this
   specific rule (retraction status is tracked separately only for buyer
   *display* purposes, e.g. "removed by seller" vs. "never existed").

### 9. How does Bob prove a protected artifact belongs to this Product?

The same cryptographic binding as §5: Bob's real Nostr signing key signs the
outer event; the read model verifies that signer equals the declaration's
own `sellerPubkey`, and that `sellerPubkey` equals the already-established
creator of `productId`. No new crypto primitive, no new key. This is
sufficient to prove *authorship/binding* of the **declaration** (the fact
that content with a given classification/checksum exists for this product).
It deliberately does **not** attempt to prove the *bytes themselves* belong
to the product before Alice actually receives them — that's what
`checksum`/`checksumSubject` plus the buyer's own post-receipt verification
(§"resolved ambiguities") is for, and full possession-proof of
not-yet-transferred bytes is out of scope (would require the transport
Blocker-1 already closed by the `private-media-release` channel to be the
vehicle, which it already is).

### 10. How does Alice distinguish public preview / protected purchased content / sample / unavailable content?

Directly from already-existing, reused vocabulary — no new taxonomy
invented:

- **public preview** — `classification: "public"`, any `role` (commonly
  `"primary"`/`"gallery"`/`"thumbnail"`/`"video_preview"`).
- **sample** — `role: "sample"` (already a `ProductMediaRole` value,
  independent of `classification` — a seller could plausibly mark a sample
  either public or protected; both are structurally valid, this protocol
  takes no new position on that).
- **protected purchased content** — `classification: "protected"`, not
  retracted; buyer's UI knows a real release must come from the
  `private-media-release` channel before bytes exist locally.
  `checksumSubject` is always `"ciphertext"` for these, enforced by
  `validateProductMediaDeclaration()` (same rule
  `validateProductMedia()` already enforces on the seller side).
  `evaluateDigitalContentDeliveryInvariantForOrderCompletion()`'s own
  `MediaReleaseRequestMediaLike` shape (`id`, `productId`,
  `classification`) is directly satisfiable from this read model's views —
  see "Coordinator integration point" below.
- **unavailable** — a `mediaId` this process has seen a **retraction** for
  (`ProductMediaSyncReadModel.isRetracted(mediaId)`), or — the honest,
  distinct "we don't know yet" case — a `mediaId` this process has simply
  never received a declaration for (indistinguishable, on this process
  alone, from "genuinely was never attached"; the UI-level fix for
  collapsing "no protected content" and "protected content exists but we
  haven't synced it yet" into one false-positive state was already the
  bug this arc exists to close for the **known** case — a media id this
  process legitimately never heard of at all is a separate, honest "we
  don't know" state, not a lie, and is out of this protocol's ability to
  resolve by itself: it is bounded by whether the buyer's process ever
  successfully queried a relay Bob also published to).

---

## Privacy classification (every wire field)

Legend: **PUBLIC** (safe on an open relay), **COUNTERPARTY-PRIVATE** (never
appears here — travels only on an encrypted, addressed private-sync
channel), **LOCAL-ONLY** (never serialized to the wire at all), **SECRET**
(never appears here, full stop).

### `ProductMediaDeclarationEventDraft` (wire, `category: "product-media-declaration"`)

| Field | Classification | Why |
| --- | --- | --- |
| `category`, `formatVersion` | PUBLIC | Fixed protocol framing, same as every sibling draft. |
| `mediaId` | PUBLIC | A stable, opaque id — reveals nothing about content or parties. |
| `productId` | PUBLIC | Already public via the product's own `product-publication`. |
| `sellerPubkey` | PUBLIC | Already public — it's the same `creatorPubkey` the product listing itself discloses; not a new disclosure. |
| `role` | PUBLIC | Presentation metadata (`primary`/`gallery`/`sample`/…), same sensitivity as a storefront's own "this is the cover photo" label. |
| `classification` | PUBLIC | The whole point of this protocol — "has protected content" must be knowable pre-purchase, per the mandate's own explicit allow-list. |
| `contentType` | PUBLIC | MIME category — already routinely public for any downloadable listing (e.g. "this is a PDF"). |
| `sizeClass` | PUBLIC | Bucketed, not exact `sizeBytes` — see "resolved ambiguities" for why. |
| `checksum` | PUBLIC | For `protected` media this is a hash of **ciphertext** (enforced below) — reveals nothing about plaintext, per `checksumSubject`'s own existing invariant. For `public` media the plaintext is public anyway. |
| `checksumSubject` | PUBLIC | Says what `checksum` was computed over — itself reveals nothing secret. |
| `altText` | PUBLIC | Caption text describing an already-public listing's media, same sensitivity class as `Product.description` (already public). Resolved, not guessed — see below. |
| `version` | PUBLIC | Ordering metadata, no different in sensitivity from `publishedAt`/`updatedAt` on the sibling product events. |
| `declaredAt` | PUBLIC | Informational timestamp, same as `publishedAt`. |

**Structurally absent — cannot be constructed as a field of this
interface, and the allowlist validator rejects any attempt to smuggle one
in as an extra key:** decryption key / content key, `MediaAccessGrant` or
any of its secret payload, buyer identity/pubkey, `orderId` or any Order
field, payment evidence, private Delivery evidence, Master Seed, any
private key, any raw authorization token, `storageRef` (excluded
deliberately — see §2), exact byte-for-byte `sizeBytes`.

### `ProductMediaRetractionEventDraft` (wire, `category: "product-media-retraction"`)

| Field | Classification | Why |
| --- | --- | --- |
| `category`, `formatVersion` | PUBLIC | Framing. |
| `mediaId`, `productId`, `sellerPubkey` | PUBLIC | Same reasoning as the declaration — identifies WHICH already-public media entry is being withdrawn, nothing new. |
| `version` | PUBLIC | Ordering/replay-rejection watermark — see §6/§8. |
| `retractedAt` | PUBLIC | Informational timestamp. |

### Domain type `ProductMediaDeclaration` / `ProductMediaRetraction` (in-process, pre-wire)

Same fields, same classifications as their wire counterparts — this
protocol deliberately keeps the domain type and the wire type
field-for-field aligned in **content** (not in TypeScript identity — they
remain two separate interfaces, per the mandate's "wire representation is
an adapter concern, do not make a Nostr event shape the canonical domain
model" instruction) precisely because every field in this declaration is
already public; there is no private domain-only superset to strip before
the wire boundary, unlike (say) `PrivateMediaReleasePayload`, which
legitimately carries fields (`wireCiphertext`) that only make sense
encrypted-and-addressed.

### `CommerceReadModelProductMediaView` (derived, buyer-side, LOCAL-ONLY bookkeeping fields called out)

All fields mirror the declaration's own PUBLIC classification, **except**:
`lastEventId` (LOCAL-ONLY — this instance's own bookkeeping, never
published), `retracted: boolean` (LOCAL-ONLY — derived state, never itself
a wire field).

### Fields that MUST NEVER appear anywhere in this protocol (re-verified against the actual codebase, not assumed)

- **Decryption key / `AeadKeyHandle`** — confirmed no accessor exists to
  serialize one to a string at all (`media_access_grant_key_release.ts`);
  structurally impossible to place on a JSON draft even if someone tried.
- **`MediaAccessGrant` secret payload** — lives only in
  `media_access_grant_issuance.ts`/`media_access_grant_key_release.ts`;
  this file imports neither.
- **Buyer identity** — no field on either draft can hold a buyer pubkey;
  the allowlist rejects any extra key, tested directly (see test file).
- **Order / Payment / Delivery details** — no `orderId`/`paymentId`/
  `deliveryId` field exists on either draft.
- **Master Seed / private key / raw authorization token** — none of this
  protocol's code imports `FedosMasterSeedAuthority` or any key-material
  type at all; it only imports `ProductMedia`'s already-public-safe field
  *shape* from `product_media_types.ts`.

---

## Architecture: Domain / Port / Adapter

```
                 ┌───────────────────────────────────────────┐
                 │  DOMAIN (pure, no Nostr, no I/O)           │
                 │  product_media_declaration_types.ts        │
                 │    ProductMediaDeclaration/Retraction       │
                 │    validate*() / deriveProductMediaDecl...  │
                 │    productMediaSizeClassFor()               │
                 │                                              │
                 │  product_media_sync_read_model.ts           │
                 │    ProductMediaSyncReadModel                │
                 │    (ordering, replay-rejection, product      │
                 │     binding — operates on a generic          │
                 │     verified-envelope shape, never a         │
                 │     NostrEvent)                              │
                 └───────────────────────────────────────────┘
                                   ▲
                                   │ pure function calls, no imports back down
                 ┌───────────────────────────────────────────┐
                 │  PORT (interface only)                      │
                 │  product_media_sync_port.ts                 │
                 │    ProductMediaSyncPort                      │
                 │      publishDeclaration()/publishRetraction()│
                 └───────────────────────────────────────────┘
                                   ▲ implements
                 ┌───────────────────────────────────────────┐
                 │  ADAPTER (Nostr-specific, wire shape)        │
                 │  events/commerce_nostr_event_drafts.ts       │
                 │    + ProductMediaDeclarationEventDraft        │
                 │    + ProductMediaRetractionEventDraft         │
                 │  events/commerce_nostr_event_read_model.ts   │
                 │    CommerceNostrProductReadModel.ingest()     │
                 │    (extended: 2 new categories, delegates     │
                 │     to ProductMediaSyncReadModel + its own    │
                 │     #products map for the binding check)      │
                 │  catalog/adapters/nostr/                      │
                 │    product_media_sync_bridge.ts                │
                 │      NostrProductMediaSyncPort                 │
                 │      (implements ProductMediaSyncPort by       │
                 │       building drafts + delegating to the      │
                 │       EXISTING, unmodified CommerceNostrEventPort│
                 │       — no new transport, no new signing path) │
                 └───────────────────────────────────────────┘
```

**Reused, unmodified**: `CommerceNostrEventPort`/`CommerceNostrEventPortImpl`
(publish-side dedup/network-gating), `RealCommerceNostrEventTransport` /
`buildCommerceNostrUnsignedEventRequest` (real signing, kind:1, `t` tag
convention), `verifyAndBuildInboundCommerceNostrEnvelope` (real Schnorr
verification) — all of these are already fully generic over
`CommerceNostrEventDraft`'s category union, so adding two new categories to
that union required **zero** changes to any of them. This is the concrete
proof that "reuse the existing PUBLIC read-model path" was the right call:
the entire outbound signing/publish and inbound verification pipeline
Product publication already uses now carries ProductMedia declarations for
free.

### Why `MediaManifestReferenceEventDraft` was NOT reused

Checked directly against every one of this protocol's own requirements — it
fails on five independent grounds, not one: no `classification` field (the
single most important fact this whole protocol exists to carry), no
`checksumSubject` (so the protected-implies-ciphertext-hash invariant is
unenforceable), no `role`, no ordering/version field at all (so replay
rejection is impossible to implement), and no seller/signer-binding field
(so "wrong Product rejected" cannot be checked — its own `assetId`/
`contentHashHex` shape has nothing to authenticate against a product
creator). Retrofitting all five onto it would not be "reuse," it would be a
silent redesign of a type six other files' worth of scaffolding headers
describe by its current (correct, minimal, dead) shape. It is left
untouched, still dead code, exactly as it was found.

---

## Ordering & replay: worked example

```
1. Bob publishes product "prod-1"                         -> applied
2. Bob declares media "img-1", classification: public,
   version: 1                                              -> applied
3. Bob declares media "doc-1", classification: protected,
   version: 1, checksumSubject: ciphertext                 -> applied
4. Relay redelivers event from step 3 (same event id)      -> "duplicate", no-op
5. Bob retracts "img-1", version: 2                        -> applied, img-1 retracted
6. A stale copy of step 2's declaration (version: 1)
   is replayed with a NEW event id (e.g. a hostile relay
   trying to resurrect it)                                 -> "stale-version" (1 <= 2), REJECTED
7. Bob re-declares "img-1" with version: 3 (legitimate
   re-list)                                                -> applied, img-1 no longer retracted*

* retraction is a watermark + a display flag, not a permanent tombstone —
  a seller MAY legitimately re-attach the same mediaId at a higher version;
  this mirrors Product's own status lifecycle ("archived" is not a
  permanent dead end either — see `product-update`'s own `status` field).
```

---

## Coordinator integration point (Wave B — not built by this agent)

**Buyer-side read** (fixes both Addendum-2 gaps):

```ts
// CommerceNostrProductReadModel — new accessor, mirrors listProducts()
readModel.listProductMedia(productId: string): readonly CommerceReadModelProductMediaView[]
readModel.getProductMedia(mediaId: string): CommerceReadModelProductMediaView | undefined
readModel.isProductMediaRetracted(mediaId: string): boolean
```

Wherever `fedos_electron_beta_main.cts` constructs/consults
`commerceProductMediaState()` (a `LocalProductMediaRepository`) for a
**buyer's own** view of a product it did not itself list, it should also
consult `commerceNostrReadModelFor().listProductMedia(productId)` and merge
the two (seller's own process: local repository is authoritative and richer
— it has real `storageRef`; buyer's own process: the Nostr-read-model view
is the ONLY source of truth it has, and is intentionally missing
`storageRef`/plaintext-adjacent fields it was never supposed to have before
authorization). Each `ProductMediaSyncView` already carries exactly the
three fields `MediaReleaseRequestMediaLike`
(`media_access_grant_release_channel_policy.ts`) needs — `mediaId` (rename
to `id`), `productId`, `classification` — so **no further shape
translation is needed** beyond that one field rename to feed
`evaluateDigitalContentDeliveryInvariantForOrderCompletion()` for real on a
buyer's process, and `handleCommerceMediaGrantRedeem()`'s short-circuit
lookup can be changed from "local-only `commerceProductMediaState()`" to
"local repository OR this read-model view", so it stops answering
"not-found" before ever attempting `sendPrivateMediaReleaseRequestNonFatal()`.

**This dovetails exactly with Agent C's own already-landed
`productMediaKnowledge` hook** (found already present in this worktree at
`media_access_grant_release_channel_policy.ts` — the "Truthful Completion"
sibling half of this same mega-arc, not built by this agent, reviewed here
only to integrate correctly with it): on a buyer's process, the Coordinator
should pass `productMediaKnowledge: "unsynced"` alongside the merged
`productMedia` list, even once this protocol supplies real data — a
successful sync of everything this process has SEEN is still not a proof
that it has seen everything Bob ever published (a relay it never queried,
an event it missed while offline). `"authoritative"` remains correctly
reserved for a process's own self-populated `LocalProductMediaRepository`
view (the seller's own process). This is precisely the distinction
`deriveDigitalContentDeliveryDisplayState()`
(`media_grant/digital_content_delivery_display_state.ts`, also Agent C) was
built to render as `"availability-unknown"` rather than a false
`"no-digital-deliverable"` — this protocol is what makes that state
reachable with REAL data instead of only a structural placeholder.

**Seller-side publish** (net-new production caller, mirrors the existing
`handleCommerceProductPublish()`/`handleCommerceProductUpdate()` call sites
exactly):

```ts
const port = new NostrProductMediaSyncPort(commerceNostrOutboundPortFor());
// on a real classification:"protected"/"public" attach success:
const declaration = deriveProductMediaDeclaration(media /* the real ProductMedia the attach handler just created */, sellerPubkey, nextVersionFor(media.id), nowUnixSeconds());
await port.publishDeclaration(declaration);
// on remove/detach:
const retraction = buildProductMediaRetraction(media.productId, media.id, sellerPubkey, nextVersionFor(media.id), nowUnixSeconds());
await port.publishRetraction(retraction);
```

`nextVersionFor()` is a small piece of Wave B/C bookkeeping this agent
deliberately does not build (no durable per-mediaId version counter exists
yet anywhere in the composition root) — the domain layer only requires
"strictly greater than the last version this process itself last
published for this id," which the seller's own process can track in
memory or durably however Wave B's own persistence conventions dictate;
this is explicitly flagged as a Wave B decision, not a design gap in this
protocol (the protocol only specifies the invariant the version must
satisfy, not who mints it).

---

## Resolved ambiguities (flagged, not guessed silently)

1. **`altText`** — not on the mandate's explicit allow-list nor its
   forbidden-list. Resolved as PUBLIC: it is caption text on already-public
   listing media, the same sensitivity class as `Product.description`
   (already a public field on `product-publication`). Low risk, directly
   analogous existing precedent — not stopped on.
2. **`sizeBytes` vs. a bucketed `sizeClass`** — the mandate's own allowed
   list says *"a bounded size class"*, distinct wording from
   `ProductMedia.sizeBytes`'s own exact-integer field. Resolved: expose a
   5-bucket `ProductMediaSizeClass` (`tiny`/`small`/`medium`/`large`/
   `xlarge`) computed from the real `sizeBytes`, never the exact byte count,
   uniformly for both classifications (not just protected) — simpler than a
   split rule, and removes an unnecessary few bits of fingerprinting
   precision for public media too at no real buyer cost (the bucket is
   still plenty to convey "small PDF" vs. "large video"). This is a
   deliberate, documented design choice, not the only defensible one — a
   future arc could decide exact `sizeBytes` for `public` media is fine
   (the plaintext itself is public) and only bucket `protected` sizes; not
   done here to keep one rule instead of two.
3. **Post-receipt content integrity** — this protocol's `checksum` gives
   Alice a value she can eventually check the released bytes against, but
   no code path in this arc's scope (nor Blocker-1's already-closed
   channel) currently performs that comparison automatically. Left as an
   explicit Wave B/C follow-up, not built here (it lives naturally next to
   `PrivateMediaReleaseReleasedPayload.contentDigest`, which is a *separate*
   digest already computed at wrap time — the two digests are not
   currently cross-checked against each other, and probably should be by
   whichever wave wires the buyer-side redeem UI; flagged, not fixed).
4. **`checksum` presence on a `protected`-classification declaration before
   any grant exists** — is publishing a ciphertext hash before a buyer has
   ever paid a problem? Resolved NO: `checksumSubject: "ciphertext"` is
   already the existing, reviewed invariant
   (`validateProductMedia()`/`product_media_types.ts`'s own header) for
   exactly this reason — a hash of ciphertext under a key nobody but the
   seller (and, later, an authorized buyer) holds is not distinguishable
   from random noise without that key, so publishing it early reveals
   nothing about plaintext. Not a new judgment call, just re-confirmed
   against the existing invariant.

No field in this design was left genuinely unresolved — every ambiguity
found was closeable by direct analogy to an existing, already-reviewed
convention in this codebase, which is recorded above so it can be
re-checked rather than trusted.
