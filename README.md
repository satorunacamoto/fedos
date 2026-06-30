# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 21 — runtime integration layer.** Ingest, thread building,
> query policy, an HTML view, a NIP-01 read-only WebSocket adapter, an
> `EventCache` boundary (in-memory + Cloudflare KV), a real BIP-340 Schnorr
> `SignatureVerifier` (@noble), a community/channel/group policy model, a NIP-07
> `EventSigner` boundary, read-only space directory + landing pages
> (`?space=`/`?actor=`), a `RelayPublisher` write-path boundary, a
> **preview-only** compose panel (`?compose=1`), a `MetadataIndex` boundary
> (in-memory + Cloudflare D1) for search/listing/space navigation, a D1 space
> directory adapter for Community/Channel/Group definitions, a chat / DM model
> boundary, a creator commerce model boundary, a promotion integration boundary,
> an edge-rec promotion adapter, read-only promotion placeholders, a runtime
> integration layer (`createRuntime`), and now an **asset cache boundary**: an
> `AssetCache` interface for PUBLIC media (previews, thumbnails, images, audio,
> video segments) with an in-memory implementation and a pure policy that only
> ever allows `public`/`unlisted`, non-sensitive assets. **Private/paid content,
> DMs, secrets, key material, and payment/entitlement data are rejected** — the
> in-memory cache enforces the policy on `put`. The runtime now selects an
> `assetCache` (always in-memory in this stage). MeshKV and an R2 adapter are NOT
> implemented yet; this `AssetCache` interface is the seam they will plug into.

## What is implemented

- `src/nostr/types.ts` — NIP-01 event types.
- `src/nostr/event.ts` — pure structural validation + canonical id computation
  and id verification (via an injected hasher).
- `src/nostr/crypto.ts` — default WebCrypto SHA-256 (Workers + Node compatible).
- `src/nostr/relay.ts` — `RelayAdapter` interface, filter matching, in-memory adapter.
- `src/ingest/*` — pure validate → dedupe → normalize pipeline.
- `src/thread/*` — pure NIP-10 thread builder (reply graph → sorted trees).
- `src/query/*` — pure query policy: sort (new/old/top/hot), filters
  (author/text/minReplies/since/until) and pagination over root threads.
- `src/community/*` — pure space model: `Community`/`Channel`/`Group` types,
  role + read/post/moderate/admin policy decisions, event→space classification,
  and a `SpaceDirectory` (in-memory) with readable-space and event-filtering
  helpers. `directory.ts` also defines `AsyncSpaceDirectory`, the persisted
  counterpart of the sync interface (a backing store cannot satisfy synchronous
  reads). `d1_directory.ts` implements it as `D1SpaceDirectory` (Cloudflare D1):
  it persists space DEFINITIONS and (pubkey, role) members through prepared
  statements. `spaceToRows`/`rowsToSpace` map between a `Space` and its rows —
  members are normalized to the highest role per pubkey (`listMemberships`),
  "guest" is never stored, unknown member roles are ignored on read, and an
  invalid space-level enum is rejected rather than silently defaulted. D1 is the
  storage location for definitions only, **not** an access-control oracle;
  permission checks remain the pure policy layer's job. Schema:
  `schema/d1_space_directory.sql`. No storage of keys, no posting, and no
  membership/admin/creation/join-approval UI.
- `src/chat/*` — pure chat / DM model boundary toward LINE/Telegram-style
  conversations. `types.ts` defines `ChatRoom` (`DMThread` | `GroupChat`),
  `ChatMessage`, `ChatVisibility`, `ChatPostPolicy`, and `ChatDecision`.
  `policy.ts` decides `canReadChat`/`canPostChat`/`isChatParticipant` purely over
  participant/admin lists and the chat's visibility/postPolicy (DM = participants
  only; open group = guests may post; private group = participants; channel-like
  = owners/admins only). `classify.ts` reads chat references from an event's tags
  (`["chat", "<id>"]` / `["t", "chat:<id>"]`; malformed/unknown ignored) via
  `getChatTags`/`eventMatchesChat`/`classifyEventToChats`. `space_bridge.ts`
  derives a `GroupChat` from a Stage 9 space (`chatFromGroupSpace`) and reuses the
  space's `canRead` for `canOpenChatFromSpace`. **Nothing is sent and no DM is
  encrypted** — NIP-04/NIP-44 are out of scope; `ChatMessage.content` is plaintext
  as supplied. No chat UI yet.
- `src/commerce/*` — pure creator / EC (digital-content) model boundary from a
  board/space/chat toward a creator's digital goods. `types.ts` defines `Product`
  (`kind` = pdf/zip/template/software/link/other, `status` = draft/active/archived,
  `visibility` = public/unlisted/private, linked space/event/asset ids),
  `DigitalAsset` (opaque `storageRef`, no bytes), `PurchaseGrant` (an external
  entitlement result with an optional `revokedAt`), and `AccessDecision`.
  `policy.ts` decides `canViewProduct`/`canEditProduct`/`canAccessAsset`/
  `hasPurchaseGrant` purely over status, visibility, the creator pubkey, and the
  supplied grants (public/unlisted active → anyone; private → creator or a valid
  grant holder; draft/archived → creator only; edit → creator only; asset access
  → creator or valid grant). `classify.ts` reads product references from an
  event's tags (`["product", "<id>"]` / `["t", "product:<id>"]`; malformed/unknown
  ignored) via `getProductTags`/`eventMatchesProduct`/`classifyEventToProducts`.
  `bridge.ts` builds a draft product from a Stage 9 space (`productFromSpace`) or a
  Nostr event (`productFromEvent`) and decides `canPromoteProductInSpace` (creator
  who may post in the space). **No money moves and nothing is delivered** — no
  payment, checkout, download serving, inventory, or real Stripe/crypto/R2/D1;
  `priceCents` is display-only and there is no DRM. No commerce UI yet.
- `src/promotion/*` — pure INTEGRATION BOUNDARY toward the existing Cloudflare ad
  system (edge-rec-middleware / recommendation-rewriter); it is NOT an ad engine.
  `types.ts` defines `PlacementType` (11 slots across thread/space/chat/product/
  search), `PlacementContext`, `Placement`, `PromotionRequest`, `PromotionCandidate`,
  `PromotionDecision`, and `PromotionReason`. `policy.ts` purely resolves a slot
  (`resolvePlacement`), assembles a request (`buildPromotionRequest`), strips
  context ids irrelevant to a slot (`filterPromotionContext`), and gates on a
  positive limit (`canShowPromotion`). `bridge.ts` maps a surface to a normalized
  request: `buildThreadPlacement`/`buildSpacePlacement`/`buildChatPlacement`/
  `buildProductPlacement`/`buildSearchPlacement`. `adapter.ts` defines the
  `PromotionProvider`/`RecommendationProvider` seams plus `MockPromotionProvider`
  (returns fixed candidates, NO network). `edge_rec_adapter.ts` connects those
  seams to the existing Cloudflare ad system: `EdgeRecPromotionProvider` posts an
  `EdgeRecAdapterOptions.endpoint` through an INJECTED `EdgeRecFetchLike` client
  (never the global `fetch`) and adapts the reply. The mapping is pure and split
  out as `mapPromotionRequestToEdgeRec` (re-filters context, attaches the viewer
  only on opt-in), `mapEdgeRecResponseToDecision` (stamps `metadata.provider =
  "edge-rec"`), and the `isEdgeRecResponseLike` guard; a malformed body, non-200,
  rejection, or timeout all resolve to a `provider_error` decision. It duplicates
  no ad logic — no ranking, auction, CTR, click tracking, or billing — and the
  viewer pubkey is omitted unless a caller opts in (raw via `sendViewerPubkey`, or
  opaque via `hashViewerPubkey`). `src/render/promotion.ts`'s
  `renderPromotionPlaceholder` emits a labeled "Sponsored" placeholder only — it
  renders no candidate title/image/`destination` and links nothing. **This layer
  does not select, rank, auction, serve, or track ads, charge money, call
  Stripe/Telegram, or rewrite HTML** — it only hands requests to an injected
  provider, and only ever reaches the network through that injected client.
- `src/sign/*` — signer boundary: an `EventSigner` interface, a `Nip07EventSigner`
  adapter over an injected NIP-07 provider, and pure builders for **unsigned**
  events (`buildUnsignedTextNote`, reply/space tags, `prepareSpacePost`). The app
  never holds, generates, or stores a private key, and never publishes; signing
  is delegated to the external signer.
- `src/render/*` — pure HTML render layer (every event-derived string is
  HTML-escaped before output). `space.ts` renders the read-only space directory
  and landing pages and, by default, brackets a landing with EMPTY
  `space_header`/`space_footer` promotion placeholders (toggle via
  `renderSpaceLanding`'s `{ promotions }` option). `product.ts` adds read-only
  product views — `renderProductLabel` (kind + title), `renderProductSummary`
  (price/currency/status/visibility/linked spaces, no links or actions), and
  `renderProductPromotionPlaceholder` (an EMPTY `product_sidebar` slot).
  `promotion.ts`'s `renderPromotionPlaceholder` shows a disclosure label and the
  placement's own (escaped) label only. **No placeholder renders an ad candidate,
  destination link, price-to-pay, or download**, and none of these helpers call a
  promotion provider or the network.
- `src/nostr/messages.ts` — pure NIP-01 relay-message parser (EVENT/EOSE/NOTICE).
- `src/nostr/signature.ts` — `SignatureVerifier` interface + `Noop`/`RejectAll`
  implementations.
- `src/nostr/noble_signature.ts` — `NobleSignatureVerifier`: real BIP-340 Schnorr
  verification via `@noble/curves` + `@noble/hashes`. Verify-only; no signing.
- `src/nostr/ws_relay.ts` — read-only WebSocket relay adapter (REQ → collect →
  EOSE/timeout → CLOSE) with an injectable `WebSocketFactory`. Read-only: it
  never publishes events.
- `src/nostr/publish.ts` — relay **write-path** boundary, kept separate from the
  read-only adapter above. `RelayPublisher` sends `["EVENT", signedEvent]` and
  awaits the NIP-20 `["OK", id, accepted, message]`; `parseOkMessage` is a pure,
  total parser (malformed/unknown → `null`). `WebSocketRelayPublisher` is a
  distinct class (its own injected `WebSocketFactory`) with timeout, socket
  cleanup, and relay-error tolerance (errors resolve `accepted:false`, never
  throw). `MockRelayPublisher` records events and returns a configured verdict
  with no network. `validateBeforePublish` gates a publish on `isSignedEventLike`
  **plus** a real `SignatureVerifier.verify`. **Nothing here is auto-wired** —
  it is a boundary to compose and test, not an executed action.
- `src/sign/publish_flow.ts` — pure glue to the Stage 9 space policy:
  `canPublishToSpace` runs `canPost` for the **signed event's own** pubkey (and
  denies if a supplied `actorPubkey` disagrees), and `preparePublishDecision`
  combines the signature gate with the space policy. Returns allowed/denied
  decisions only; the actual send stays in the `RelayPublisher` layer.
- `src/indexer/*` — lightweight **metadata/index** boundary for discovery
  (search, listing, space navigation), kept entirely separate from the event
  cache. `types.ts` defines `IndexedEvent`/`IndexedThread`/`IndexedSpaceRef` and
  the `MetadataIndex` interface (`putEvents`/`putThreads`/`putSpaceRefs`,
  `queryEvents`/`queryThreads`, `getEvent`/`deleteEvent`). `build.ts` has pure
  projectors (`buildIndexedEvents`/`buildIndexedThreads`/`buildIndexedSpaceRefs`)
  that truncate content to a short preview (≤280 chars) and reuse the NIP-10
  resolvers + Stage 9 classifier. Two implementations ship: `InMemoryMetadataIndex`
  (**process-local, lost on restart**) and `D1MetadataIndex` (Cloudflare D1). The
  D1 adapter stores only derived metadata (no raw bodies/sigs) and runs every
  query through prepared-statement bindings (no user input in SQL text). Schema:
  `schema/d1_index.sql`. Not wired into the Worker yet.
- `src/render/publish.ts` — **mock-only** compose prototype (render layer).
  `buildPublishPrototypeView` consults `canPost` and `prepareSpacePost` to build
  an UNSIGNED event for display; `renderPublishPrototype` /
  `renderUnsignedEventPreview` / `renderPublishDenied` format it (all event text
  HTML-escaped). It never signs, never calls a signer, never calls a
  `RelayPublisher`. A missing actor is treated as a denial (you must name a
  candidate author). The publish button is always disabled and mock-only.
- `src/cache/*` — `EventCache` boundary + deterministic cache keys + a get-or-
  fetch policy (hit / miss / stale fallback / bypass). Two implementations ship:
  `InMemoryEventCache` (**process-local, lost on every isolate/process restart**)
  and `KvEventCache` (Cloudflare Workers KV). KV is **eventually consistent** and
  a cache — not a verified or durable store.
- `src/worker.ts` — Cloudflare Workers entry. Default = sample mode; `?relay=`
  switches to an **allowlisted** live read-only relay, served through the cache.
  Honors `?sort=&q=&author=&minReplies=&since=&until=&limit=&offset=`, plus
  `?timeout=`, `?ttl=` (seconds, capped at 300) and `?cache=0` (bypass). Also
  `?space=<id>` (read-only landing for one space, gated by `canRead`) and
  `?actor=<pubkey>` (viewer identity; guest when absent). On a readable space,
  `?compose=1` adds a **preview-only** compose panel; `?content=<text>` previews
  the unsigned event for the `?actor` candidate. Posting is only ever a disabled
  mock-only preview — never signed, never sent. There is no POST endpoint (a POST
  renders exactly like a GET). `selectDirectory(env)` picks the space directory
  backend — `D1SpaceDirectory` when `NOSTR_SPACE_DB` is bound, otherwise the
  in-memory sample directory — but the synchronous render path still uses the
  in-memory directory; D1 is not wired into request handling yet (Stage 15 ships
  the adapter + selection seam only). The default `fetch` now builds an
  `AppRuntime` via `createRuntime(env)` and uses its event cache; the other
  selected boundaries are not auto-wired (no real publish, no NIP-07, no
  auto-served ads).
- `src/asset/*` — public **asset cache boundary**, separate from the event cache.
  `types.ts` defines `AssetKind` (image/video_segment/audio/preview/thumbnail/
  html_fragment/other), `AssetVisibility` (public/unlisted/private/paid),
  `AssetMetadata`, `CachedAsset` (bytes as `ArrayBuffer`), `AssetCacheDecision`,
  and the async `AssetCache` interface (`get`/`put`/`has`/`delete`/`clear`, with
  injected `now` for deterministic expiry). `policy.ts` is pure:
  `canCacheAsset`/`isPublicCacheable` allow only public/unlisted assets with no
  sensitive tag (dm/secret/key/payment/entitlement); `normalizeAssetMetadata` and
  `createAssetKey` give a deterministic, order-independent (and checksum-addressed
  when available) key. `memory_asset_cache.ts`'s `InMemoryAssetCache` is dev/test
  only (non-persistent) and ENFORCES the policy on `put` by default — private,
  paid, and sensitive assets are refused. It only holds public media; **no
  purchased originals, DMs, secrets, keys, or payment/entitlement bytes**, and it
  fetches/serves nothing. R2/HTTP/MeshKV adapters slot in behind `AssetCache`.
- `src/runtime/*` — the runtime integration layer: the single place that picks
  every boundary. `createRuntime(env?, overrides?)` returns an `AppRuntime`
  (`eventCache`, `assetCache`, `spaceDirectory`, `metadataIndex`,
  `signatureVerifier`, `promotionProvider`, `recommendationProvider`,
  `relayPublisher`, plus a `mode`). Each `select*` prefers a real
  Cloudflare-backed adapter when its binding/config is present — `KvEventCache`
  (`NOSTR_EVENT_CACHE`), `D1SpaceDirectory` (`NOSTR_SPACE_DB`), `D1MetadataIndex`
  (`NOSTR_INDEX`), `EdgeRecPromotionProvider` (a
  `PROMOTION_ENDPOINT`/`RECOMMENDATION_ENDPOINT` **plus** an injected `fetch`) —
  and otherwise a test/local-safe in-memory or mock default (`InMemory*`,
  `MockPromotionProvider`/`MockRecommendationProvider`, `MockRelayPublisher`,
  `NobleSignatureVerifier`). `selectAssetCache` is always the in-memory cache in
  this stage (`NOSTR_ASSET_R2` is reserved for a future R2 adapter). `overrides`
  win over `env`. **Constructing a runtime starts no external work**: no socket,
  no `fetch`, no publish, no signer, no asset I/O — selecting the EdgeRec adapter
  only makes it *ready* to call out behind its injected client. The runtime never
  reaches for a global `fetch`. MeshKV is NOT implemented here; the `AssetCache`
  interface is the seam it will plug into.

## Security scope (read before trusting anything here)

This codebase verifies event signatures on the live path but makes **no**
confidentiality guarantees and is not a security audit of the wider system.

- **Signature verification (live path).** `NobleSignatureVerifier` performs real
  BIP-340 Schnorr verification: it recomputes the id from the event body and
  checks `sig` against the author's x-only `pubkey`. Events that fail are dropped
  during ingest. This proves an event is **authentic and untampered** — it does
  NOT mean the content is true, safe, or endorsed, and it is not a guarantee
  that the rest of the pipeline is free of bugs. Avoid words like "tamper-proof"
  or "completely secure".
- **`verifyEventId` is a different check.** It only confirms an event's `id` is a
  consistent SHA-256 of its serialization (self-consistency), and does **not**
  prove authorship. Signature verification is the separate `SignatureVerifier`
  path.
- **Sample mode is unsigned.** The default demo events are not signed and are
  served with the Noop verifier; they exist only to exercise rendering.
- **Cache ≠ verification.** `KvEventCache`/`InMemoryEventCache` store whatever
  events were fetched. Caching does not re-verify; do not treat a cached entry as
  a verified or trusted record.
- The live relay path is **read-only** and limited to an allowlist; it never
  publishes events. Disallowed relays are rejected.
- **Space policy is advisory, not enforced.** `canPost`/`canRead`/etc. are pure
  decisions over pubkey allowlists; nothing posts or gates access yet, and the
  policy layer does not itself verify signatures (it assumes the caller passes
  pubkeys it already trusts). Treat it as a model, not an access-control system.
- No private keys are handled, generated, or stored. The signer boundary
  delegates to an external NIP-07 provider; the unsigned-event builders never
  sign. Signed events returned by a provider are structurally validated and
  checked against the signer's pubkey, but this app does not run a signer
  automatically.
- **Publishing is a boundary, not a wired action.** `RelayPublisher` /
  `WebSocketRelayPublisher` can send a signed event to a relay, but nothing in
  the UI or Worker calls them, there is no publish endpoint, and no NIP-07
  signer is auto-invoked. `validateBeforePublish` only gates what *would* be
  safe to publish (structure + a real signature check); it does not itself send,
  and a passing decision is not a guarantee the rest of the flow is bug-free.
- **The D1 metadata index is not durable, not authoritative, not an audit log.**
  `D1MetadataIndex` stores only small derived metadata (id, author, a truncated
  content preview, reply/root links, space refs) — never raw event bodies or
  signatures. It exists to make discovery fast and can be rebuilt from relays;
  rows may be stale, incomplete, or absent. Do not treat the presence of a row
  as proof an event is authentic — signature verification is a separate concern.
  All queries use prepared-statement bindings; user input is never interpolated
  into SQL text.
- **The D1 space directory stores definitions, not permissions.**
  `D1SpaceDirectory` persists what a space looks like (its type, settings, and
  (pubkey, role) members) so the model can outlive a process restart. It is
  **not** an authoritative permission oracle and **not** an audit log: a stored
  row is not proof anyone is actually authorized to read or post. `canRead`/
  `canPost` decisions stay in the pure Stage 9 policy layer, which the app must
  run itself. Only the four assignable roles are stored ("guest" is never
  written); all access uses prepared-statement bindings, never SQL string
  interpolation. There is no admin, creation, or join/approval flow yet.
- **The chat model is advisory and unencrypted.** `canReadChat`/`canPostChat`/
  `isChatParticipant` are pure decisions over participant/admin lists; nothing
  sends a message or gates a conversation. DMs are **not** encrypted — NIP-04 and
  NIP-44 are out of scope for this stage, and `ChatMessage.content` is plaintext
  as supplied. The space→chat bridge derives a chat definition only; it does not
  open a socket or publish. Do not describe chats here as private/secure in any
  cryptographic sense.
- **The commerce model is advisory; no money moves and nothing is delivered.**
  `canViewProduct`/`canEditProduct`/`canAccessAsset` are pure decisions over a
  product's status/visibility/creator and the supplied grants; they do not charge,
  refund, gate a download, or serve a file. A `PurchaseGrant` records an EXTERNAL
  entitlement result only — issuing one does not take payment and `source:
  "payment"` does not mean this layer charged anyone. `priceCents` is display
  metadata; there is no checkout, inventory, R2/D1 storage, or DRM, and
  `canAccessAsset` is NOT content protection. Do not describe products here as
  "purchased", "protected", or "DRM-secured".
- **The promotion layer is a request boundary, not an ad system.** It builds and
  normalizes "place a promotion here" requests and hands them to an injected
  `PromotionProvider` — it does not select, rank, auction, or weight ads, run
  CTR/A-B tests, track clicks, charge money, or call Stripe/Telegram, and it does
  no HTMLRewriting. It adds no D1/KV and is not wired into the Worker. The pure
  layer (policy/bridge) and `MockPromotionProvider` touch no network at all;
  `renderPromotionPlaceholder` shows a "Sponsored" label only and never a real ad.
- **The edge-rec adapter only translates and transports.** `EdgeRecPromotionProvider`
  forwards a request to the existing edge-rec-middleware / recommendation-rewriter
  through an INJECTED fetch client (never the global `fetch`), then maps the reply
  back. It duplicates none of the ad engine: no ranking, auction, CTR, click
  tracking, or billing live here. The viewer pubkey is NOT sent unless a caller
  explicitly opts in (raw via `sendViewerPubkey`, or opaque via `hashViewerPubkey`),
  and any transport failure (rejection, non-200, malformed body, timeout) becomes
  a `provider_error` decision rather than throwing. Do not describe this as ad
  serving or measurement — the selection logic stays in the external system.
- **Promotion placeholders are empty disclosure slots, not ads.** The space
  landing (sample mode only) and the product render helpers emit
  `renderPromotionPlaceholder` markup that shows a "Sponsored"/"Promotion" label
  and the placement's name — never an ad candidate, destination link, image,
  price-to-pay, or download button. They are produced purely from the Stage 18
  `buildSpacePlacement`/`buildProductPlacement` bridges; the Worker constructs no
  promotion provider and adds no `fetch`. Product views likewise render no
  checkout/payment/download affordance. Do not describe these slots as serving,
  selecting, or measuring ads.
- **The compose panel (`?compose=1`) is preview-only.** It builds and displays
  an UNSIGNED event (no `id`/`sig`) so a user can see what would be signed; it
  does not sign, does not call a signer, and does not call a `RelayPublisher`.
  The publish button is disabled. The `MockRelayPublisher` is referenced only in
  copy/tests and is never invoked from the request path — no network is touched.
- **The runtime layer is selection/DI only — it starts nothing.** `createRuntime`
  constructs adapters but opens no socket, issues no `fetch`, publishes nothing,
  and invokes no signer; selecting `EdgeRecPromotionProvider` only makes it ready
  to call its INJECTED client (the runtime never uses a global `fetch`). The
  Worker uses the runtime's event cache but does not auto-wire the publisher,
  providers, or async directory — there is still no real publish, no NIP-07
  auto-run, and no auto-served ads. The default relay publisher is the mock.
- **The asset cache holds PUBLIC media only.** `canCacheAsset` allows only
  `public`/`unlisted` assets with no sensitive tag, and `InMemoryAssetCache`
  enforces that on `put` — `private`/`paid` assets, DMs, secrets, key material,
  and payment/entitlement data are refused, never stored. It is a cache for
  previews/thumbnails/segments, NOT a delivery path: it fetches nothing, serves
  nothing, and never holds a purchased original. The in-memory cache is
  non-persistent; MeshKV/R2 adapters are not implemented yet.
- No application-level encryption is provided; when added it will use a vetted
  AEAD library, never hand-rolled XOR.

These constraints are deliberate. Do not document guarantees the code does not
yet provide.

## Commands

```bash
npm install
npm run typecheck   # tsc --noEmit (strict)
npm test            # vitest run
```

## Cloudflare KV cache (optional)

The live relay path caches results through `EventCache`. Bind a KV namespace as
`NOSTR_EVENT_CACHE` and the Worker uses `KvEventCache`; without the binding it
falls back to the in-memory cache.

```toml
# wrangler.toml
name = "nostr-window"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "NOSTR_EVENT_CACHE"
id = "<your-kv-namespace-id>"
```

KV caveats (do not over-promise on these):

- **Eventually consistent.** Reads can briefly miss a recent write, and an
  entry may be evicted before its logical expiry.
- **TTL floor.** Cloudflare rejects `expirationTtl` below 60s, so logical TTLs
  under a minute are stored at 60s; `get` still reports them stale at the real
  `expiresAt`.
- **Size limits.** KV values are capped (256 KB at time of writing); very large
  batches will be rejected by KV.
- **Not a clear-all.** `KvEventCache.clear()` is a deliberate no-op — there is no
  safe atomic wipe of a shared namespace. Evict per key with `delete` or let
  `expirationTtl` expire entries.
- **It's a cache, not an audit log.** KV here stores unverified relay events for
  speed; it is not durable, not authenticated, and not a security record.

## Cloudflare D1 metadata index (optional, not wired yet)

`MetadataIndex` is a discovery index (search/listing/space navigation) that is
**separate** from the event cache. Apply `schema/d1_index.sql` to a D1 database
and construct `D1MetadataIndex(db)`; in tests/dev use `InMemoryMetadataIndex`.
The Worker does not use it yet (Stage 14 ships the boundary + adapters only).

```toml
# wrangler.toml
[[d1_databases]]
binding = "NOSTR_INDEX"
database_name = "nostr-index"
database_id = "<your-d1-database-id>"
```

```bash
wrangler d1 execute nostr-index --file=schema/d1_index.sql
```

D1 caveats (do not over-promise on these):

- **Metadata only.** Stores derived fields (id, author, kind, a truncated
  content preview, reply/root links, space refs) — never raw event bodies or
  signatures.
- **Rebuildable, not authoritative.** It is a convenience index, not an audit
  log or durable source of truth; rows can be stale, incomplete, or rebuilt from
  relays. A row is not proof an event is authentic.
- **Bound parameters only.** Every query uses prepared-statement bindings; user
  input is never interpolated into SQL text.

## Cloudflare D1 space directory (optional, not wired yet)

`D1SpaceDirectory` persists Community/Channel/Group **definitions** and their
(pubkey, role) members behind the `AsyncSpaceDirectory` interface. Apply
`schema/d1_space_directory.sql` to a D1 database and construct
`D1SpaceDirectory({ db })`; in tests/dev use the in-memory `SpaceDirectory`. The
Worker selects it via `selectDirectory(env)` when `NOSTR_SPACE_DB` is bound, but
does not yet route requests through it (Stage 15 ships the adapter + seam only).

```toml
# wrangler.toml
[[d1_databases]]
binding = "NOSTR_SPACE_DB"
database_name = "nostr-spaces"
database_id = "<your-d1-database-id>"
```

```bash
wrangler d1 execute nostr-spaces --file=schema/d1_space_directory.sql
```

D1 space directory caveats (do not over-promise on these):

- **Definitions, not permissions.** A stored space/member row records what a
  space looks like; it is not proof anyone is authorized. `canRead`/`canPost`
  are decided by the pure policy layer, not by the presence of a row.
- **Not an audit log, not authoritative.** It is mutable storage for the current
  space model, not a tamper-evident history.
- **Stored roles only.** Just owner/admin/moderator/member are persisted; "guest"
  is the absence of a row. A pubkey is normalized to its highest role on write,
  and unknown roles are ignored on read.
- **Bound parameters only.** Every query uses prepared-statement bindings; user
  input is never interpolated into SQL text.

## Roadmap (stages)

1. Nostr event ingest ✓
2. Thread builder (NIP-10 reply graph → tree) ✓
3. Reddit-style read-only render ✓
4. Query / sort / filter policy ✓
5. Read-only relay WebSocket adapter + signature verifier boundary ✓
6. Relay event cache boundary (in-memory) ✓
7. Cloudflare KV cache adapter ✓
8. Real Schnorr signature verification ✓
9. Community / Channel / Group space model + policy ✓
10. NIP-07 signer boundary + unsigned-event builders ✓
11. Space directory / read-only landing pages ✓
12. Relay publish boundary (no UI) ✓
13. Mock-only publish UI prototype (preview only) ✓
14. D1 metadata/index adapter (discovery only) ✓
15. D1 space directory adapter (definitions only) ✓
16. Chat / DM model boundary (no send, no encryption) ✓
17. Creator commerce model boundary (no payment, no delivery) ✓
18. Promotion integration boundary (request seam only, no ad engine) ✓
19. edge-rec-middleware adapter (inject-only transport to the existing ad system) ✓
20. Read-only promotion placeholders + product render helpers ✓
21. Runtime integration layer (`createRuntime` selection/DI seam) ✓
22. Asset cache boundary (public media only; R2/HTTP/local/MeshKV-swappable) ✓ ← you are here
23. MeshKV adapter boundary (public previews/thumbnails/segments only)
24. Product read-only directory/page route
25. Chat read-only UI labels
26. Vault / encrypted identity layer (AEAD, external signer)
