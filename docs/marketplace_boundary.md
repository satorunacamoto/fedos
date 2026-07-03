# Marketplace Provider Boundary (docs only — describes the Stage 111 type-only skeleton)

**Status: this document describes the `MarketplaceProvider` seam shipped in
`src/marketplace/types.ts` and `src/marketplace/noop_marketplace.ts` (Stage
111). It adds NO real payment, NO checkout, NO download unlock, NO Stripe/
Lightning integration, and NO `PurchaseGrant` issuance.**

---

## 1. Relationship to the existing `src/commerce/`

`src/commerce/` (Stage ~30s) already models `Product`/`PurchaseGrant` in a
Nostr-event-shaped way, with its own policy and a `PaymentProvider`
boundary (`src/payment/`) in front of it. `MarketplaceProvider` is a
DIFFERENT, more abstract layer above that — the same relationship
`src/social/` has to the Nostr-specific chat/community models (see
`docs/federation_boundary.md`). The idea is that a future storefront
surface could eventually be described protocol-neutrally (a digital
product, a membership, a subscription, a tip, a service) independent of
which underlying commerce/payment implementation backs it. This stage does
NOT connect the two — `src/commerce/` is untouched.

---

## 2. What `MarketplaceProvider` is for

- `status()` — a pure, synchronous read of the current status.
- `listPlaceholder()` — ask to (eventually) list available listings.
  `items` is ALWAYS empty in this stage.
- `purchasePlaceholder(request)` — ask to (eventually) purchase.
  `request.listingRef` is an OPAQUE label only — never a price, payment
  method, or checkout session reference. The decision NEVER grants access
  or moves money.

---

## 3. What a `MarketplaceListingDescriptor` explicitly does NOT carry

- **No price.** Not a number, not a currency code, not a display string.
- **No payment method or rail reference.**
- **No checkout/session reference or URL.**
- **No download URL or signed URL.** A listing names WHAT is offered — it
  never carries how to receive it.
- **No bytes of any kind.**

Only `idRef` (opaque), `creatorRef` (opaque), `kind`
(`MarketplaceItemKind`), `visibility`, and non-sensitive `metadata` exist on
the type.

---

## 4. What is explicitly NOT implemented

- **No real payment of any kind** — no Stripe, no Lightning/BOLT11/LNURL,
  no Apple Pay/Google Pay, no manual grant issuance.
- **No checkout.** No session, no redirect URL, no cart.
- **No download unlock.** No signed URL, no asset-cache grant.
- **No `PurchaseGrant`.** `purchasePlaceholder` never constructs or returns
  one; that type belongs to `src/commerce/` and is not referenced here.
- **No connection to `PaymentProvider`** (`src/payment/`). A marketplace
  provider implementation must not import it.
- **No wiring** into `StorageBackend`, any `CryptoProvider`, or the Worker.
  The Runtime selects `NoopMarketplaceProvider` only and never calls its
  methods.

---

## 5. Future connection points (not built yet)

If a real marketplace surface is ever implemented behind this seam, a
purchase flow would eventually need to compose (never duplicate):

- **`PaymentProvider`** (`src/payment/`) for the actual payment request/
  decision.
- **`EntitlementProvider`** (`src/creator/entitlement.ts`) for recording
  and checking the resulting access — see `docs/creator_entitlement_boundary.md`
  for why that is a SEPARATE decision from "was this paid for".
- **`StorageBackend`** (`src/storage/`) if a downloadable asset needs
  storage, subject to its own metadata policy.

None of these connections exists today; `purchasePlaceholder` always
resolves `unavailable`/`rejected` and never reaches any of them.

---

## 6. Conclusion

- `MarketplaceProvider` is a naming/shape boundary only — no listing is
  ever really published and no purchase is ever really made.
- `NoopMarketplaceProvider` is the only implementation, permanently
  `unavailable`.
- `src/commerce/`, `src/payment/`, and this new boundary remain three
  separate, uncoupled pieces until a future stage deliberately connects
  them.

---

## 7. Stage 112 update note

`docs/creator_monetization_flow.md` fixes the intended FUTURE sequence
this boundary sits in: listing → purchase intent → payment placeholder →
entitlement check → gated chat/content → federation announcement (see its
§3). It also names fee concepts (platform fee, creator share, developer
fund, community treasury — all policy-only, §6) that a future listing
might reference, and states that a listing announcement's PUBLIC metadata
only (never price/payment) is a `docs/nostr_adapter_planning.md`-style
federation-announcement candidate. Neither doc changes anything shipped
here; `NoopMarketplaceProvider` remains the only implementation.
