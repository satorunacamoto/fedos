# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 32 — MeshKV browser lifecycle boundary.** Bringing a MeshKV
> node online is now an explicit, separate step in `src/asset/meshkv_lifecycle.ts`,
> kept OUT of `createRuntime` and the Worker. `MeshKVLifecycle`
> (`MeshKVBrowserLifecycle` / `createMeshKVLifecycle(node, initOptions?)`) drives a
> node through `idle → prepared → online → offline` (or `error`): the
> **constructor does nothing**, `prepare()` only wires the node (`init`, no
> socket), `goOnline()` is the FIRST call that may open signaling / join the WebRTC
> peer mesh (`startSignaling`), and `goOffline()` tears it down (`stop`). Every
> step is idempotent (double-calls are safe) and a failed step lands in `error`
> with the cause recorded (`getLastError`) instead of throwing. **Nothing is
> auto-wired**: `createRuntime` and the Worker never call the lifecycle, so
> WebRTC / signaling / peer discovery begin only when a caller explicitly invokes
> `goOnline()`. This adds no cache, policy, or data path and no guarantees; MeshKV
> still carries PUBLIC/unlisted bytes only. Prior status:
>
> **Stage 31 — MeshKV runtime opt-in wiring.** `createRuntime` can now
> build a `MeshKVBrowserClient` (over the `packages/meshkv` boundary) and slot it
> into the asset cache, but **only behind an explicit opt-in**:
> `ENABLE_MESHKV_ASSET_CACHE` must be truthy AND a `MeshKVApi` supplied (via
> `MESHKV_API` or `overrides.meshKVApi`). `selectMeshKVClient(env, overrides?)`
> resolves the client — `overrides.meshKVClient` > the legacy
> `MESHKV_ASSET_CACHE` binding > the opt-in browser client — and
> `selectAssetCache` composes it (R2 + MeshKV → `CompositeAssetCache`; MeshKV only
> → `MeshKVAssetCache`; neither → in-memory). **Opting in only SELECTS the
> adapter — it starts NO MeshKV network**: constructing the client calls no
> `init`/`connect`/`startSignaling`, so no signaling socket, WebRTC link, or peer
> discovery begins; `createRuntime` runs no asset op and issues no `fetch`, and
> `env` is never mutated. The **Worker does not auto-wire it** (no
> `ENABLE_MESHKV_ASSET_CACHE` handling), so default behavior is unchanged. MeshKV
> still carries PUBLIC/unlisted bytes only — private/paid/secret/DM/payment/
> entitlement data is refused by `canCacheAsset` before it can reach the mesh, and
> there are no signed URLs, downloads, or payment. Real WebRTC/signaling will be a
> separate explicit lifecycle boundary in a later stage. Prior status:
>
> **Stage 30 — Product / Chat / Space unified directory page.** The
> default (no-param) board now arranges the read-only Space, Product, and Chat
> directories into ONE section via `src/render/directory.ts`'s
> `renderUnifiedDirectory` (reusing the existing per-type helpers and their
> `?space=`/`?product=`/`?chat=` routes; product/chat sections are sample-mode
> only). It is pure presentation: **no new data lookup, no network, no new route,
> and no change to the Product/Chat/Space types** — the Stage 29 MeshKV boundary,
> the runtime, and every other boundary are untouched. Prior status:
>
> **Stage 29 — MeshKV boundary wired to the imported implementation.** The
> real MeshKV browser project has been imported (an external, git-ignored checkout
> whose runtime is a namespace module exporting `init`/`get`/`put`/`load`/`remove`,
> backed by IndexedDB + WebRTC). `packages/meshkv` is now the typed boundary for
> that runtime: `MeshKVApi` mirrors the real exports, an `index.ts` entry point is
> the stable import surface, and a browser-free reference node (`MeshKV` /
> `createMeshKV`) lets the host typecheck/test against the contract without a
> browser. The `MeshKVBrowserClient` adapter was retargeted to the **real** API —
> `put(key, bytes, contentType)`, `remove` for delete, `has` derived from `get`,
> and no bulk `clear` (the real MeshKV exposes none) — and still clones bytes
> across the boundary. **Constructing the adapter or a node starts no network** —
> no signaling socket, no WebRTC, no peer discovery; going online is an explicit
> step (`startSignaling()` here / `signal.connect()` in the browser runtime) the
> adapter never calls. **The runtime, `selectAssetCache`, the `AssetCache`
> interface, `MeshKVAssetCache`, the Worker, promotion, and the product/chat routes
> are all unchanged.** MeshKV carries PUBLIC bytes only; private/paid/secret content
> is refused by `canCacheAsset` before it reaches the package. Base below unchanged.
>
> Ingest, thread building, query
> policy, an HTML view, a NIP-01 read-only WebSocket adapter, an `EventCache`
> boundary (in-memory + Cloudflare KV), a real BIP-340 Schnorr `SignatureVerifier`
> (@noble), a community/channel/group policy model, a NIP-07 `EventSigner`
> boundary, read-only space directory + landing pages (`?space=`/`?actor=`), a
> `RelayPublisher` write-path boundary, a **preview-only** compose panel
> (`?compose=1`), a `MetadataIndex` boundary (in-memory + Cloudflare D1), a D1
> space directory adapter, a chat / DM model boundary, a creator commerce model
> boundary, a promotion integration boundary, an edge-rec promotion adapter,
> read-only promotion placeholders, a runtime integration layer (`createRuntime`),
> an asset cache boundary (`AssetCache` for PUBLIC media), a MeshKV asset cache
> adapter (peer cache), and now an **R2 asset cache adapter** (origin storage):
> `R2AssetCache implements AssetCache` over a minimal `R2LikeBucket` (with a
> `MockR2Bucket`), which the runtime prefers when an R2 bucket is bound (R2 →
> MeshKV → in-memory). Metadata/`cachedAt`/`expiresAt` round-trip through R2
> `customMetadata`; content type through `httpMetadata`. **Every write is gated by
> `canCacheAsset`** — public/unlisted, non-sensitive media only; private/paid,
> DMs, secrets, key material, and payment/entitlement data are refused. **No
> signed URLs, download delivery, payment, or DRM** — R2 is origin storage for
> public previews, not a delivery/entitlement path. `clear()` is a deliberate
> no-op (no safe bulk wipe), and the adapter does no external `fetch` of its own.

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
  space's `canRead` for `canOpenChatFromSpace`. `directory.ts` adds the read-only
  directory/lookup layer: a `ChatDirectory` (`InMemoryChatDirectory`) plus pure
  `findChatById`, `listReadableChats` (filters by `canReadChat`), and
  `getChatMessages` (selects a chat's messages by `chatId`). `sample_chats.ts`
  ships fixed `SAMPLE_CHATS`/`SAMPLE_CHAT_MESSAGES` (an open group, a channel-like
  broadcast group, a private members group, and a one-to-one DM; one message
  carries HTML-special characters to prove escaping). **Nothing is sent and no DM
  is encrypted** — NIP-04/NIP-44 are out of scope; `ChatMessage.content` is
  plaintext as supplied. The Stage 27 UI is read-only labels only.
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
  who may post in the space). `directory.ts` adds the read-only directory/lookup
  layer: a `ProductDirectory` (`InMemoryProductDirectory`) plus pure helpers
  `findProductById`, `listViewableProducts` (filters by `canViewProduct`),
  `getProductAssets` (selects a product's assets by `assetIds`), and a
  `ProductAsset` (an asset id paired with its PREVIEW `AssetMetadata` — no bytes).
  `sample_products.ts` ships fixed `SAMPLE_PRODUCTS`/`SAMPLE_GRANTS`/
  `SAMPLE_ASSET_METADATA` (a public guide, a private grant-gated pack, a
  creator-only draft; each mixes public/unlisted previews with a hidden `paid`
  original). **No money moves and nothing is delivered** — no payment, checkout,
  download serving, inventory, or real Stripe/crypto/R2/D1; `priceCents` is
  display-only and there is no DRM. The Stage 25 UI is read-only PREVIEW only.
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
  `renderProductPromotionPlaceholder` (an EMPTY `product_sidebar` slot). Stage 25
  adds the directory/page surface: `renderProductDirectory` (lists viewable
  products, each linking to its `?product=<id>` page), `renderProductPage`
  (summary + view-decision reason + asset previews + an EMPTY promotion slot),
  `renderAssetPreviewList` (PUBLIC/UNLISTED asset metadata labels only —
  kind/visibility/contentType/size/source/checksum/tags; `private`/`paid` are
  filtered out, with no bytes and no download/link/button), `renderProductNotFound`,
  and `renderProductAccessDenied`. `chat.ts` (Stage 27) adds read-only chat views —
  `renderChatLabel` (kind + id), `renderChatDirectory` (lists readable chats, each
  linking to its `?chat=<id>` room), `renderChatRoom` (label + view-policy + read/
  post hints + plaintext messages), `renderChatMessage` (author + timestamp +
  escaped plaintext content), `renderChatNotFound`, and `renderChatAccessDenied`.
  The chat views render **no send form/button, no socket, and no message
  delivery**, and they never describe a chat as "secure"/"encrypted" — a private
  chat is labeled "participant-only view policy" only.
  `promotion.ts`'s `renderPromotionPlaceholder` shows a disclosure label and the
  placement's own (escaped) label only. **No placeholder renders an ad candidate,
  destination link, price-to-pay, or download**, and none of these helpers call a
  promotion provider or the network.
  `directory.ts` (Stage 30) arranges those Space/Product/Chat directories into one
  read-only section: `renderUnifiedDirectory(view)` renders a Spaces + Products +
  Chats block (each section toggleable via `showSpaces`/`showProducts`/`showChats`,
  all default true; an empty state when none are shown), reusing
  `renderSpaceDirectory`/`renderProductDirectory`/`renderChatDirectory` and linking
  only to the existing `?space=`/`?product=`/`?chat=` routes. `renderDirectorySection`
  wraps a helper's (pre-escaped) body under an escaped title, and
  `renderDirectoryEmptyState` is the "nothing to browse" notice. It adds **no new
  data lookup, no network, no new route** — it only orders already-built fragments,
  escaping the titles/actor text it introduces and trusting the helpers' escaping.
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
  `?actor=<pubkey>` (viewer identity; guest when absent). `?product=<id>` renders
  a read-only product page over the fixed sample products — summary plus
  PUBLIC/UNLISTED asset PREVIEW metadata only, gated by `canViewProduct` (unknown
  → not found, denied → access denied). `?chat=<id>` renders a read-only chat room
  over the fixed sample chats, gated by `canReadChat` (unknown → not found, denied
  → access denied, allowed → room + plaintext messages + a `canPostChat` hint).
  The default (no-param) board surfaces a **unified directory** (`renderUnifiedDirectory`)
  that combines the readable-space, viewable-product, and readable-chat listings into
  one section; the product and chat sections are sample-mode only (the live read-only
  path shows just the spaces and adds no new data lookup). Chat messages are plaintext
  labels only — **nothing is sent,
  nothing is encrypted, and there is no send form/button or message delivery**. No
  asset bytes, signed URLs, downloads, or payment paths are introduced. On a
  readable space,
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
  `meshkv_asset_cache.ts` is the first such adapter: `MeshKVAssetCache implements
  AssetCache` over a `MeshKVClient` (`get`/`put`/`has`/`delete`/optional `clear`),
  with an in-process `MockMeshKVClient` (no peers). It gates every `put` through
  `canCacheAsset`, clones bytes (`ArrayBuffer.slice`) and normalizes metadata
  before handing them to the client, keeps metadata + expiry in a local
  side-table (the client stores only bytes), and honors expiry on `get`/`has`.
  **No real WebRTC/signaling/peer discovery / network** — boundary + mock only;
  it is a public-media cache, not access control, payment, entitlement, or DRM.
  `meshkv_browser_client.ts` is the adapter that plugs the standalone
  `packages/meshkv` package into `MeshKVClient`: `MeshKVBrowserClient implements
  MeshKVClient` forwards each call to the package's `MeshKVApi` — `get→get`,
  `put→put(key, bytes, metadata.contentType)`, `has→get≠null`, `delete→remove` —
  cloning bytes across the boundary. It omits the optional `clear` because the real
  MeshKV exposes no bulk clear. It is the only file in `src/` that reaches the
  package at RUNTIME (forwards `MeshKVClient` calls); a few others take type-only
  imports (`runtime/types.ts`, `meshkv_lifecycle.ts`). It adds no caching/policy/
  transport, and **starts no network** — constructing it calls no `init()`/
  `startSignaling()`, so no signaling/WebRTC/peer discovery begins.
  `meshkv_lifecycle.ts` (Stage 32) is the explicit ONLINE/OFFLINE boundary,
  separate from selection: `MeshKVLifecycle` (`MeshKVBrowserLifecycle` /
  `createMeshKVLifecycle(node, initOptions?)`) drives a lifecycle-capable node
  (`init` + `startSignaling` + `stop`, satisfied by the reference `MeshKV`) through
  `idle → prepared → online → offline` (or `error`). The **constructor does
  nothing**; `prepare()` wires only (`init`); `goOnline()` is the first call that
  may open signaling / join the peer mesh (`startSignaling`); `goOffline()` calls
  `stop`. Steps are idempotent and failures set `error` (cause via `getLastError`)
  rather than throwing. It is **not wired into the runtime or Worker** — WebRTC /
  signaling / peer discovery begin only through an explicit `goOnline()`. It adds
  no cache, policy, or data path, and makes no security guarantee.
  `r2_asset_cache.ts` is the origin-storage adapter: `R2AssetCache implements
  AssetCache` over a minimal `R2LikeBucket`/`R2LikeObject` (and a `MockR2Bucket`).
  It gates every `put` through `canCacheAsset`, clones bytes and normalizes
  metadata, and round-trips `cachedAt`/`expiresAt`/the metadata JSON through R2
  `customMetadata` (content type via `httpMetadata`), restoring them on `get`/`has`
  and treating malformed metadata as a miss. `clear()` is a deliberate no-op — R2
  has no safe atomic bulk wipe and the bucket may hold objects this adapter did not
  write. **No signed URLs, download delivery, payment, or DRM, and no external
  `fetch`** — origin storage for public previews only.
  `composite_asset_cache.ts` composes the three into one: `CompositeAssetCache
  implements AssetCache` over an ordered list of `AssetCacheLayer`s
  (`{ name, cache, writable, volatile }`). `get` falls through the layers and
  returns the first hit; a `CompositeReadStrategy` of `"warm-fill"` (default)
  back-populates the preceding writable layers (each re-checked by `canCacheAsset`,
  failures swallowed), `"fallback"` skips that. `put` is policy-gated **before any
  layer is touched**, then a `CompositeWriteStrategy` writes the first writable
  layer (`"first-writable"`, default) or every writable layer (`"all-writable"`).
  `delete` fans out to all layers; `has` is true if any layer has the key;
  `clear()` defaults to a **no-op** (`"none"`) and the opt-in `"volatile"` strategy
  clears only volatile layers so a durable origin (R2) is never bulk-wiped. The
  composite stores no bytes itself, mutates no input, opens no connection, and
  issues no `fetch` — it is a cache hierarchy, NOT access control, payment,
  entitlement, or DRM, and **private/paid/secret/key/payment/entitlement bytes are
  refused at the gate** (warm-fill included).
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
  `NobleSignatureVerifier`). `selectMeshKVClient(env, overrides?)` resolves the
  MeshKV client the asset cache writes through — `overrides.meshKVClient` first,
  then the legacy already-built `MESHKV_ASSET_CACHE` binding, then (Stage 31) an
  **explicit opt-in** `MeshKVBrowserClient`: built ONLY when
  `ENABLE_MESHKV_ASSET_CACHE` is truthy (`true`/`"1"`/`"true"`/`"yes"`/`"on"`) AND
  a `MeshKVApi` is supplied (`MESHKV_API` or `overrides.meshKVApi`); without the
  flag the browser client is never constructed. `selectAssetCache(env, overrides?)`
  then composes a `CompositeAssetCache` (R2 origin → MeshKV peer → in-memory
  fallback) when **both** an `NOSTR_ASSET_R2` bucket and a MeshKV client are
  present, else a plain `R2AssetCache` (R2 only), else a `MeshKVAssetCache` (mesh
  only), else the shared in-memory cache. `overrides` win over `env`.
  **Constructing a runtime starts no external work**: no socket, no `fetch`, no
  publish, no signer, no asset/mesh/R2 I/O, and **no MeshKV lifecycle** — building
  the opt-in `MeshKVBrowserClient` calls no `init`/`connect`/`startSignaling`, so
  no signaling/WebRTC/peer discovery begins; selecting the EdgeRec, MeshKV, or R2
  adapter (or composing the chain) only makes it *ready* to call out behind its
  injected client. The runtime never reaches for a global `fetch`, and the Worker
  does not auto-wire the MeshKV opt-in.
- `packages/meshkv/*` — MeshKV as a **standalone external package**
  (`@nostr-window/meshkv`), the typed boundary for the imported browser runtime so
  the host depends only on its contract. `index.ts` is the stable entry point
  (exports `MeshKVApi` plus `MeshKV`/`createMeshKV`); `types.ts` defines
  `MeshKVApi` (`init`/`get`/`put`/`remove`, optional `load`) — mirroring the real
  module's exports — plus `MeshKVData`/`MeshKVInitOptions`/`MeshKVRecord`.
  `meshkv.ts` is a **browser-free reference node** with that same surface (backed
  by `local_cache.ts`; `peer_cache.ts`/`signaling.ts` are mesh/signaling
  boundaries with no real WebRTC or socket) so the host can typecheck/test without
  a browser; the production runtime is the imported browser MeshKV (git-ignored
  external checkout), and both satisfy `MeshKVApi`. Constructing a node opens **no
  connection**; `init()` only wires handlers, and going online is the explicit
  `startSignaling()` (browser: `signal.connect()`). The package imports only its
  own `./` siblings — it knows nothing of the host's asset/policy types; the host
  reaches it solely through the `src/asset/meshkv_browser_client.ts` adapter. It
  is a cache for PUBLIC bytes — not access control, payment, entitlement, or DRM.

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
- **The chat UI (Stage 27) is read-only labels.** The `?chat=<id>` route, the chat
  directory, and the room view only DISPLAY the Stage 16 model: a chat's id/kind,
  its `canReadChat`/`canPostChat` decisions, and its messages as escaped plaintext.
  There is **no send form, no send/publish button, no socket, no NIP-07 call, and
  no message delivery** — a `?chat=` request renders exactly like any other GET. A
  private chat is labeled **"participant-only view policy"** (an access note, not a
  cryptographic claim); the views deliberately avoid the words "secure"/"encrypted"
  because nothing here is. A readable-by-actor listing is a convenience filter, not
  an authorization guarantee.
- **The commerce model is advisory; no money moves and nothing is delivered.**
  `canViewProduct`/`canEditProduct`/`canAccessAsset` are pure decisions over a
  product's status/visibility/creator and the supplied grants; they do not charge,
  refund, gate a download, or serve a file. A `PurchaseGrant` records an EXTERNAL
  entitlement result only — issuing one does not take payment and `source:
  "payment"` does not mean this layer charged anyone. `priceCents` is display
  metadata; there is no checkout, inventory, R2/D1 storage, or DRM, and
  `canAccessAsset` is NOT content protection. Do not describe products here as
  "purchased", "protected", or "DRM-secured". The Stage 25 `?product=<id>` route
  and product render helpers are **read-only PREVIEW only**: the asset preview
  list shows descriptive `AssetMetadata` (kind/contentType/size/source/checksum/
  tags) for `public`/`unlisted` assets ONLY — `private`/`paid` assets are filtered
  out and never labeled. No asset bytes are embedded in the HTML, and there is no
  download link, signed URL, payment affordance, or real R2/MeshKV byte lookup.
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
- **The MeshKV runtime opt-in wires an adapter, not a network.** `createRuntime`
  builds a `MeshKVBrowserClient` ONLY when `ENABLE_MESHKV_ASSET_CACHE` is truthy
  AND a `MeshKVApi` is supplied (`MESHKV_API`/`overrides.meshKVApi`); the legacy
  `MESHKV_ASSET_CACHE` binding and `overrides.meshKVClient` still work as before.
  Opting in only SELECTS the asset-cache layer — it starts **no** MeshKV network:
  no `init`, `connect`, `startSignaling`, WebRTC, or peer discovery is called from
  the runtime, and `createRuntime` performs no asset `get`/`put`/`has`. Bringing a
  node online stays an explicit caller step for a future lifecycle stage. The
  Worker does **not** auto-wire this opt-in, so its default behavior is unchanged,
  and MeshKV still holds public/unlisted bytes only (private/paid/secret/DM/
  payment/entitlement data is refused by `canCacheAsset`; no signed URLs,
  downloads, or payment).
- **Going online is an explicit lifecycle step, never automatic.**
  `MeshKVLifecycle` (`src/asset/meshkv_lifecycle.ts`) is the only place a MeshKV
  node is brought online. Constructing it does nothing; `prepare()` wires the node
  (`init`) without opening a socket; `goOnline()` is the FIRST call that may open
  signaling or join the WebRTC peer mesh (`startSignaling`); `goOffline()` calls
  `stop`. It is **not** wired into `createRuntime` or the Worker, so no signaling,
  WebRTC, or peer discovery begins unless a caller explicitly calls `goOnline()`.
  Steps are idempotent and failures set an `error` state rather than throwing. The
  boundary adds no cache, policy, delivery, or data path and makes **no** security
  or anonymity guarantee — it only sequences a node's online/offline transitions.
- **The asset cache holds PUBLIC media only.** `canCacheAsset` allows only
  `public`/`unlisted` assets with no sensitive tag, and `InMemoryAssetCache`
  enforces that on `put` — `private`/`paid` assets, DMs, secrets, key material,
  and payment/entitlement data are refused, never stored. It is a cache for
  previews/thumbnails/segments, NOT a delivery path: it fetches nothing, serves
  nothing, and never holds a purchased original. The in-memory cache is
  non-persistent.
- **The MeshKV adapter is a boundary + mock, not a mesh.** `MeshKVAssetCache`
  gates every write through `canCacheAsset`, so only public/unlisted, non-sensitive
  media can be written — private/paid content, DMs, secrets, key material, and
  payment/entitlement data are refused before they reach the client. It clones
  bytes/metadata so nothing live is shared. There is **NO real WebRTC, signaling
  server, peer discovery, or peer/network communication** in this stage — the only
  client shipped is the in-process `MockMeshKVClient`. MeshKV is a cache for public
  bytes; it is NOT access control, payment, entitlement, or DRM, and no purchased
  original is ever placed on it.
- **MeshKV is a browser package that starts nothing on its own.** `packages/meshkv`
  is an external, standalone package reached solely through the
  `MeshKVBrowserClient` adapter (`implements MeshKVClient`). The real runtime is an
  imported browser project (IndexedDB + WebRTC), kept as a git-ignored external
  checkout; the host builds against the typed `MeshKVApi` and a browser-free
  reference node. Constructing the adapter or a node performs **no network**: no
  signaling connection, no WebRTC, and no peer discovery are started — going online
  is an explicit step (`startSignaling()` / `signal.connect()`) the adapter never
  calls, and it is not auto-wired into the runtime or Worker. Note the real MeshKV
  `load()` performs an ORIGIN FETCH; the adapter deliberately never uses it (only
  the local-tier `get`/`put`/`remove`). The adapter clones bytes across the
  boundary so no live buffer is shared, and the package imports only its own
  siblings (a test asserts it never reaches into the host's `src/`). MeshKV carries
  PUBLIC assets only; private/paid/secret/DM/payment content is refused by
  `canCacheAsset` (in `MeshKVAssetCache`) before it could ever reach the package.
  There are still no signed URLs, downloads, or real asset delivery here.
- **The R2 adapter is origin storage for public media, not a delivery path.**
  `R2AssetCache` gates every write through `canCacheAsset`, so private/paid
  content, DMs, secrets, key material, and payment/entitlement data are refused
  before they reach the bucket. It clones bytes and normalizes metadata, and
  round-trips cache fields through R2 `customMetadata`/`httpMetadata`. There are
  **NO signed URLs, NO download/delivery endpoint, NO payment, and NO DRM** — R2
  holds public previews/thumbnails/segments only, never a purchased original. The
  adapter does no external `fetch` of its own (all I/O goes through the injected
  bucket), and `clear()` is a deliberate no-op because R2 has no safe atomic bulk
  wipe. A stored object is not proof of authorization — this is a cache, not an
  entitlement oracle.
- **The composite asset cache is a chain of the same gated layers — it weakens
  nothing.** `CompositeAssetCache` only orders/forwards to the layers it is given;
  it stores no bytes itself and adds no transport. Every write it performs — direct
  puts AND warm-fills — is gated by `canCacheAsset` first, so private/paid content,
  DMs, secrets, key material, and payment/entitlement data are refused before any
  layer is touched. **Warm-fill is a read-path optimization, not an authorization
  signal**: a key being present in (or copied into) a layer is not proof anyone is
  entitled to it. `clear()` defaults to a no-op and never bulk-wipes a durable
  origin (the opt-in `"volatile"` strategy clears local/peer layers only, never
  R2). There are still **no signed URLs, downloads, delivery, or payment**, and the
  composite opens no connection and issues no `fetch` of its own.
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
22. Asset cache boundary (public media only; R2/HTTP/local/MeshKV-swappable) ✓
23. MeshKV adapter boundary (public previews/thumbnails/segments only; mock client) ✓
24. R2 AssetCache adapter (origin storage for public media; no signed URLs/DRM) ✓
25. Product read-only directory/page route + public asset preview ✓
26. Asset cache composed fallback chain (R2 → MeshKV → in-memory) ✓
27. Chat read-only UI labels ✓
28. MeshKV external package boundary (`packages/meshkv` + browser-client adapter) ✓
29. MeshKV boundary wired to the imported implementation (real `MeshKVApi`) ✓
30. Product / Chat / Space unified directory page ✓
31. Runtime MeshKV explicit opt-in wiring (no auto network) ✓
32. MeshKV browser lifecycle boundary (explicit connect/startSignaling) ✓ ← you are here
33. Vault / encrypted identity layer (AEAD, external signer)

### Future candidate boundaries (design notes only — not scheduled)

These are **exploratory** layers sketched in
[`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md). Each is a
future, opt-in boundary kept OUT of the current core; nothing here is
implemented, and none carries a security guarantee. When picked up, each lands as
an interface + mock/no-op first, with its own review, respecting all existing
guardrails.

- **Vault Boundary** — local encrypted master-seed storage unlocked by an auth
  factor (Apple ID/Passkey as *unlock only*, never a key-derivation source). No
  key custody in the app.
- **Crypto Core Boundary** — a separate Rust crate (`packages/fedos-core-rust`,
  provisional) for AEAD + KDF + secret zeroing; managed-runtime memory-zeroing
  limits are documented, not hand-waved. AEAD mandatory, XOR forbidden.
- **Deniable Storage Research Boundary** — threat-model study of hidden/shadow
  vaults (TrueCrypt/VeraCrypt as *reference*), with leak vectors (size/padding/
  metadata/timestamp/access-pattern) named and **no production safety claim**.
- **IPFS Asset Adapter** — a future public-media adapter behind the existing
  `AssetCache` boundary (gateway/pinning, not an embedded node); non-deletability,
  liveness, and traffic-analysis risks documented. Public/unlisted bytes only.
- **Notification Bridge** — APNs/FCM/Telegram/LINE as contentless, opt-in
  notification pointers (no secrets in payloads; provider metadata leakage noted).
- **Payment / Lightning Boundary** — a future external, non-custodial payment
  seam (Breez SDK / Greenlight as investigation candidates); liquidity is the
  hard problem. No payment implemented or scheduled.
