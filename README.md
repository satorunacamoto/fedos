# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 5 — read-only relay adapter + signature boundary.** Ingest,
> thread building, query policy, an HTML view, a NIP-01 read-only WebSocket
> adapter, and a `SignatureVerifier` interface. No posting, no key storage, no
> commerce, no ads. Default rendering still uses a fixed in-memory sample; the
> live relay path is opt-in and allowlisted.

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
- `src/render/*` — pure HTML render layer (every event-derived string is
  HTML-escaped before output).
- `src/nostr/messages.ts` — pure NIP-01 relay-message parser (EVENT/EOSE/NOTICE).
- `src/nostr/signature.ts` — `SignatureVerifier` interface + `Noop`/`RejectAll`
  implementations. **No real signature verification is implemented yet.**
- `src/nostr/ws_relay.ts` — read-only WebSocket relay adapter (REQ → collect →
  EOSE/timeout → CLOSE) with an injectable `WebSocketFactory`. Read-only: it
  never publishes events.
- `src/worker.ts` — Cloudflare Workers entry. Default = sample mode; `?relay=`
  switches to an **allowlisted** live read-only relay. Honors
  `?sort=&q=&author=&minReplies=&since=&until=&limit=&offset=` (and `?timeout=`).

## Security scope (read before trusting anything here)

This codebase makes **no** confidentiality or authorship guarantees yet.

- **Signature verification is NOT implemented.** There is a `SignatureVerifier`
  interface, but the only shipped implementations are `NoopSignatureVerifier`
  (accepts everything, no checking) and `RejectAllSignatureVerifier`. The live
  relay path uses Noop, so **events from a relay are NOT authenticated**.
  `verifyEventId` only checks that an event's `id` is a consistent SHA-256 of
  its serialization — it does **not** prove the author. Real schnorr/secp256k1
  verification is a later stage.
- The live relay path is **read-only** and limited to an allowlist; it never
  publishes events. Disallowed relays are rejected.
- No private keys are handled or stored. Web replies will use NIP-07 / browser
  signer / external signer in a later stage — keys stay client-side.
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

## Roadmap (stages)

1. Nostr event ingest ✓
2. Thread builder (NIP-10 reply graph → tree) ✓
3. Reddit-style read-only render ✓
4. Query / sort / filter policy ✓
5. Read-only relay WebSocket adapter + signature verifier boundary ✓ ← you are here
6. Web reply posting (NIP-07 / external signer)
7. Community / Channel (admin-post) / Group (open)
8. Creator / digital-content hooks
9. Ads / promotion hooks
10. Vault / encrypted identity layer (AEAD, external signer)
