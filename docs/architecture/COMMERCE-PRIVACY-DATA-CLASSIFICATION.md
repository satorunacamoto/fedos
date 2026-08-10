# Commerce Privacy Data Classification

Status: **DESIGN ONLY — no source changed by this document.**
Parent: [COMMERCE-DECENTRALIZED-DATA-PLANE.md](./COMMERCE-DECENTRALIZED-DATA-PLANE.md)

Every candidate Commerce field, classified into exactly one of:

- **LOCAL ONLY** — never leaves the device, not even encrypted.
- **ENCRYPTED NOSTR** — travels over Nostr, but only as ciphertext (NIP-44-style, reusing the repo's live encrypted-DM stack), readable only by the intended counterparty.
- **PUBLIC NOSTR** — a small signed event, plaintext, intentionally public.
- **IPFS CIPHERTEXT** — large blob, always encrypted before content-addressing (see `COMMERCE-MEDIA-STORAGE.md` §5); the CID itself is public, the content is not.
- **OPTIONAL DISCLOSURE** — not sent anywhere by default; disclosed only via an explicit, scoped mechanism (`CapabilityGrant`-gated evidence, or a persona's own choice to reveal a `CarryOverClaim`).

## Product

| Field | Classification | Notes |
|---|---|---|
| `id` | PUBLIC NOSTR | Needed for discovery. |
| `title` | PUBLIC NOSTR | Storefront content. |
| `description` | PUBLIC NOSTR | Storefront content. |
| `price` / `priceCents` | PUBLIC NOSTR | A listed price is inherently public (it's an offer). |
| `currency` | PUBLIC NOSTR | — |
| `status` (draft/active/archived) | PUBLIC NOSTR (active/archived only) | `draft` products are never published — LOCAL ONLY until status changes. |
| `visibility` (public/unlisted/private) | Governs everything else | `unlisted`/`private` products should not be broadcast via `ProductPublication` at all — LOCAL ONLY or ENCRYPTED NOSTR (direct share link) instead. |
| media (see below) | see `COMMERCE-MEDIA-STORAGE.md` | manifest is PUBLIC NOSTR; bytes are IPFS CIPHERTEXT or LOCAL ONLY. |
| `linkedSpaceIds` / `linkedEventIds` | LOCAL ONLY | Internal cross-references, no public value in exposing them and they leak app-internal structure. |

## Merchant

| Field | Classification | Notes |
|---|---|---|
| Persona / display label | PUBLIC NOSTR | Pseudonymous by design (see `PERSONA-EPOCH-ROTATION.md`). |
| `creatorPubkey` (current signing key) | PUBLIC NOSTR | Needed to verify product/attestation signatures — this is the epoch-scoped persona key, not necessarily a real-world identity. |
| Real-world identity | LOCAL ONLY / OPTIONAL DISCLOSURE | Never published; disclosed only if the merchant chooses (e.g. for dispute resolution), and then only to the specific authorized party. |
| Reputation aggregate | PUBLIC NOSTR | Coarse bucket only — see `PSEUDONYMOUS-REPUTATION.md`. |
| Full trade history | **Never published** | Explicit non-goal; only bounded, signed attestations may be published, never a queryable ledger. |

## Buyer

| Field | Classification | Notes |
|---|---|---|
| Identity (pubkey) | ENCRYPTED NOSTR | Known only to the merchant, over the same encrypted channel as order details — never on the public plane. |
| Shipping/contact info | ENCRYPTED NOSTR or LOCAL ONLY | Only if delivery requires it; encrypted end-to-end to the merchant. |
| Purchase history (buyer's own) | LOCAL ONLY | A buyer's own device may retain this for their own UI; never published, never shared with anyone but themself. |
| Buyer-side `TradeCompletionAttestation` co-signature | ENCRYPTED NOSTR (exchange) → may become part of PUBLIC NOSTR attestation | The bilateral signing handshake happens privately; only the resulting bounded, counterparty-committed attestation (§2 of the reputation doc) may become public, and even then contains a *commitment*, not the buyer's raw pubkey. |

## Order (design-level field set — no `Order` type exists in the repo yet)

| Field | Classification | Notes |
|---|---|---|
| Order id / correlation id | LOCAL ONLY / ENCRYPTED NOSTR | Exists only between the two counterparties. |
| Product reference | ENCRYPTED NOSTR | Which product was ordered is private to the transaction, even though the product listing itself is public. |
| Quantity | ENCRYPTED NOSTR | — |
| Order status/timeline | LOCAL ONLY | Never a public state machine; only the eventual coarse `TradeCompletionAttestation` may become public, and only after completion. |

## Amount / Payment

| Field | Classification | Notes |
|---|---|---|
| Amount charged | ENCRYPTED NOSTR | Private to the transaction. |
| Payment method/rail | ENCRYPTED NOSTR / LOCAL ONLY | Never public — reveals financial infrastructure details. |
| Payment status (`PaymentStatus` today has no `"paid"` state) | ENCRYPTED NOSTR / LOCAL ONLY | — |
| Settlement callback data (`PlaceholderPaymentProvider.ingestCallback()`) | **LOCAL ONLY, and must remain unreachable from any network-facing surface** | Per the current audit finding, this callback accepts an unauthenticated payload; this classification does not change that finding, it only reiterates the field must never be network-reachable until it is authenticated. See the E2E audit and Phase 1 roadmap's explicit regression guard. |

## Delivery

| Field | Classification | Notes |
|---|---|---|
| Delivery proof (e.g. hash of a delivered artifact) | ENCRYPTED NOSTR | Private between counterparties; may later ground a `TradeCompletionAttestation` without itself being public. |
| Delivery address | ENCRYPTED NOSTR | Never public. |
| Delivery timestamp (coarse) | Contributes to PUBLIC NOSTR only via the epoch field of an attestation | Exact timestamps are never published; only the epoch a trade falls into. |

## Review

| Field | Classification | Notes |
|---|---|---|
| Free-text review content | **OPTIONAL DISCLOSURE, never PUBLIC NOSTR by default** | Free text is exactly the unbounded-field risk this repo has already flagged elsewhere (Merchant Passport tracks L/M/N found canonical-JSON determinism only on a bounded charset and specifically recommended removing an unbounded free-text `comment` field). This design carries that lesson forward: any review content field must be bounded/structured or kept off the public plane entirely, never a free-text public blob. |
| Star rating / coarse sentiment | PUBLIC NOSTR (bucketed) | Same bucketing discipline as reputation aggregates — coarse, not a fine-grained public number tied 1:1 to an individual trade. |
| Reviewer identity | Same as "Buyer" above | ENCRYPTED NOSTR / commitment-only in any public attestation. |

## Dispute

| Field | Classification | Notes |
|---|---|---|
| Dispute existence (coarse, e.g. "disputed: yes/no") | OPTIONAL DISCLOSURE | Not published by default; may be disclosed via a `CapabilityGrant` to an authorized arbitration role, per the Persona page's Layer 3. |
| Dispute evidence/content | ENCRYPTED NOSTR / LOCAL ONLY, always capability-gated | Never public plane, ever. |
| Dispute outcome | OPTIONAL DISCLOSURE | May, if the merchant/buyer choose, contribute to a coarse reputation signal (e.g. via `reviewReputationSignal()`'s existing label vocabulary) without exposing the underlying evidence. |

## Media

| Field | Classification | Notes |
|---|---|---|
| `SignedProductMediaManifest` (metadata) | PUBLIC NOSTR | See `COMMERCE-MEDIA-STORAGE.md` §6. |
| Media bytes (public visibility) | IPFS CIPHERTEXT (unencrypted allowed only for explicitly-public media) | — |
| Media bytes (protected visibility) | IPFS CIPHERTEXT (always encrypted) | Never plaintext on IPFS. |
| Decryption key | OPTIONAL DISCLOSURE | Delivered only via `CapabilityGrant`-style out-of-band mechanism, never in the manifest. |
