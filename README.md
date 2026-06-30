# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 14 — D1 metadata/index adapter.** Ingest, thread building,
> query policy, an HTML view, a NIP-01 read-only WebSocket adapter, an
> `EventCache` boundary (in-memory + Cloudflare KV), a real BIP-340 Schnorr
> `SignatureVerifier` (@noble), a community/channel/group policy model, a NIP-07
> `EventSigner` boundary, read-only space directory + landing pages
> (`?space=`/`?actor=`), a `RelayPublisher` write-path boundary, a
> **preview-only** compose panel (`?compose=1`), and a `MetadataIndex` boundary
> (in-memory + Cloudflare D1) for search/listing/space navigation. **The D1
> index stores only small derived metadata** — never raw event bodies or
> signatures — and is a rebuildable convenience index, not an audit log or
> durable/authoritative store. **Nothing publishes** and no signer auto-runs. No
> key generation/storage, no commerce, no ads.

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
  helpers. No storage, no posting, no membership/admin UI.
- `src/sign/*` — signer boundary: an `EventSigner` interface, a `Nip07EventSigner`
  adapter over an injected NIP-07 provider, and pure builders for **unsigned**
  events (`buildUnsignedTextNote`, reply/space tags, `prepareSpacePost`). The app
  never holds, generates, or stores a private key, and never publishes; signing
  is delegated to the external signer.
- `src/render/*` — pure HTML render layer (every event-derived string is
  HTML-escaped before output).
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
  renders exactly like a GET).

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
- **The compose panel (`?compose=1`) is preview-only.** It builds and displays
  an UNSIGNED event (no `id`/`sig`) so a user can see what would be signed; it
  does not sign, does not call a signer, and does not call a `RelayPublisher`.
  The publish button is disabled. The `MockRelayPublisher` is referenced only in
  copy/tests and is never invoked from the request path — no network is touched.
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
14. D1 metadata/index adapter (discovery only) ✓ ← you are here
15. Creator / digital-content hooks
16. Ads / promotion hooks
17. Vault / encrypted identity layer (AEAD, external signer)
