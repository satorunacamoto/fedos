# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 3 — read-only demo render.** Ingest + thread building + a
> static HTML view served from a fixed in-memory sample. No signing, no key
> storage, no live relay, no posting, no commerce, no ads. The Nostr transport
> is an adapter (`RelayAdapter`); only an in-memory implementation ships today.

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
- `src/worker.ts` — minimal Cloudflare Workers entry that renders the fixed
  sample read-only, honoring `?sort=&q=&author=&minReplies=&since=&until=&limit=&offset=`.
  **No live relay connection.**

## Security scope (read before trusting anything here)

This codebase makes **no** confidentiality or authorship guarantees yet.

- **Signature verification is NOT implemented.** `verifyEventId` only checks
  that an event's `id` is a consistent SHA-256 of its serialization — it does
  **not** prove the author. Schnorr/secp256k1 verification is a later adapter.
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
4. Query / sort / filter policy ✓ ← you are here
5. Read-only real relay WebSocket adapter (+ signature verification adapter)
6. Web reply posting (NIP-07 / external signer)
7. Community / Channel (admin-post) / Group (open)
8. Creator / digital-content hooks
9. Ads / promotion hooks
10. Vault / encrypted identity layer (AEAD, external signer)
