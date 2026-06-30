# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 12 — relay publish boundary (boundary only).** Ingest, thread
> building, query policy, an HTML view, a NIP-01 read-only WebSocket adapter, an
> `EventCache` boundary (in-memory + Cloudflare KV), a real BIP-340 Schnorr
> `SignatureVerifier` (@noble), a community/channel/group policy model, a NIP-07
> `EventSigner` boundary, read-only space directory + landing pages
> (`?space=`/`?actor=`), and a `RelayPublisher` write-path boundary. **The
> publish path is a boundary only** — it is not wired into the UI or Worker,
> nothing auto-runs a NIP-07 signer, and no publish endpoint exists. Posting in
> the UI is still a disabled "coming soon" hint. No key generation/storage, no
> commerce, no ads.

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
  `?actor=<pubkey>` (viewer identity; guest when absent). Posting is only ever a
  disabled "coming soon" hint — never executed.

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
12. Relay publish boundary (no UI) ✓ ← you are here
13. Creator / digital-content hooks
14. Ads / promotion hooks
15. Vault / encrypted identity layer (AEAD, external signer)
