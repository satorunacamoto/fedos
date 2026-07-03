# Federation Boundary (docs only — describes the Stage 110 type-only skeleton)

**Status: this document describes the `FederationProvider` seam shipped in
`src/federation/types.ts` and `src/federation/noop_federation.ts` (Stage
110). It adds NO relay connection, NO WebSocket, NO HTTP call, NO OAuth
flow, NO AT Protocol implementation, NO Nostr signing, and NO event
publish/subscribe.** `FederationProvider` exists so FedOS's board/thread
rendering can eventually be written against ONE seam instead of coupling
directly to any single social protocol's client library.

---

## 1. Why a federation boundary

FedOS aims to eventually read from and post to more than one social
protocol/app ecosystem — for example:

- **Nostr** (and Nostr-based clients like Damus, Primal, Amethyst)
- **Bluesky** (AT Protocol)
- **Threads** (ActivityPub-adjacent / Meta's API)
- **RSS** (read-only syndication, for e.g. blogs/newsletters)
- **FedOS's own local store**, for content that never leaves the app

Coupling board/thread rendering directly to any one of these (e.g. writing
every render function against `NostrEvent` shapes) makes adding the next
protocol a rewrite instead of a new adapter. `FederationProvider` names the
seam every future protocol adapter would implement, so the rest of the app
depends on the seam, not the protocol.

---

## 2. What each adapter is responsible for (role, not implementation)

Every future adapter behind `FederationProvider` — a Nostr adapter, a
Bluesky adapter, a Threads adapter, an RSS adapter, or FedOS's own local
adapter — has the SAME narrow job:

- **Read** — fetch/subscribe to that protocol's content (`fetchPlaceholder`
  today; a real `fetch()`/subscription in a future stage).
- **Write** — post new content to that protocol (`publishPlaceholder`
  today; a real signed publish in a future stage).
- **Reply** — post a reply/comment linked to existing content on that
  protocol (also behind `publishPlaceholder`'s `FederationCapability` set
  today).

That is the full scope. An adapter is NOT responsible for anything below.

---

## 3. What a federation adapter is explicitly NOT responsible for

`FederationProvider` is deliberately narrow so a future real adapter cannot
grow into a second Storage/Crypto/Identity layer:

- **Storage.** An adapter never decides where bytes live. That is
  `StorageBackend`'s job (`src/storage/`) — see
  `docs/storage_metadata_policy.md`. A federation adapter reads/writes
  protocol content; it does not persist it.
- **Cryptography.** An adapter never signs, encrypts, or decrypts anything
  itself. Signing a Nostr event, or authenticating an AT Protocol session,
  is `CryptoProvider`'s (`src/crypto/`) and identity's
  (`src/identity/`) job — a federation adapter receives an
  already-signed/authenticated request; it does not produce one.
- **Identity.** An adapter never manages login, unlock, or a credential.
  `WebAuthnProvider`/passkey/vault boundaries own that.
- **Consent/privacy policy.** A federation adapter does not decide whether
  a user consented to sharing something (see `docs/nearby_consent_policy.md`
  for the analogous pattern in Nearby Discovery) — that is a separate gate
  evaluated before a request ever reaches this seam.

This separation is the whole point: swapping or adding a protocol adapter
must never require touching storage, crypto, or identity code, and adding a
storage backend or crypto provider must never require touching a federation
adapter.

---

## 4. The `FederationProvider` seam, in prose

- `status()` — a pure, synchronous read of the current
  `FederationStatus` (a `FederationDescriptor` — kind, advertised
  capabilities, display label — plus a connection `state` and reason).
- `connect()` / `disconnect()` — ask to open/close a session. In this
  stage NEITHER opens or closes anything real; `connect()` never moves the
  state past `"disconnected"` (see §5).
- `publishPlaceholder(request)` — ask to (eventually) publish. Evaluates a
  decision only; nothing is sent to any relay/API. `request.eventRef` is an
  OPAQUE reference to a `SocialEventDescriptor` (`src/social/event.ts`) —
  never the event's content or a signed event.
- `fetchPlaceholder(request)` — ask to (eventually) fetch. `items` is
  ALWAYS empty in this stage. `request.targetRef` is an OPAQUE reference
  (e.g. a board/topic label) — never a URL or protocol query.

---

## 5. Why the shipped provider never reaches `connected_placeholder`

Every other boundary in this codebase ships a `Placeholder*` variant that
models an "accepted"/"connected"-looking state for a policy-clean input
(e.g. `PlaceholderPaymentProvider` returns `accepted_placeholder`,
`PlaceholderStorageBackend.put` returns `accepted_placeholder`).
`NoopFederationProvider` — the ONLY implementation this stage ships — does
NOT follow that pattern: `connect()` always resolves `"disconnected"`.

This is deliberate. A payment/storage placeholder accepting a clean request
still stores/charges nothing, so "accepted" safely means "policy-clean, not
real". A federation provider claiming `"connected_placeholder"` would imply
a session exists — closer to the Nearby consent boundary's decision (see
`docs/nearby_consent_policy.md`) never to claim `granted` without a real
flow. `connected_placeholder` remains in the type as a label future
adapters may reach once they do real work; nothing in Stage 110 reaches it.

---

## 6. What this document / this stage does NOT implement

- A real Nostr relay connection (no WebSocket, no NIP-01/NIP-11 handshake)
- A real Bluesky/AT Protocol session (no OAuth, no PDS call)
- A real Threads/ActivityPub call
- A real RSS fetch/parse
- Any `fetch`, `EventSource`, or WebSocket of any kind
- Event signing (NIP-44/NIP-17 or otherwise), publish, or subscribe
- A connection to `StorageBackend` or any `CryptoProvider`
- Any Runtime wiring beyond selecting `NoopFederationProvider`
- Any Worker route or handler

---

## 7. Preconditions before a real adapter is implemented

If a real protocol adapter (Nostr, Bluesky, Threads, RSS, or otherwise) is
ever built behind this seam, it first requires:

- A concrete transport decision reviewed on its own (WebSocket library for
  Nostr, an AT Protocol SDK for Bluesky, etc.) — not silently introduced as
  a side effect of another stage.
- The signing/authentication step supplied by `CryptoProvider`/identity
  boundaries, never reimplemented inside the adapter.
- The storage decision (if any content is cached/persisted) routed through
  `StorageBackend`, never a bespoke store inside the adapter.
- A defined error/rate-limit/timeout policy so a real network call cannot
  hang or crash a caller — mirroring how `EdgeRecPromotionProvider`
  (`src/promotion/edge_rec_adapter.ts`) already isolates its `fetch` behind
  an injected client with a clamped timeout.

---

## 8. Conclusion

- `FederationProvider` is a naming/shape boundary only — no protocol is
  connected to, no event is signed or sent, and no content is fetched.
- `NoopFederationProvider` is the only implementation, and the only one
  `createRuntime` selects; it is permanently `disconnected`.
- Storage, cryptography, and identity remain separate boundaries a real
  adapter would depend on, never reimplement.
