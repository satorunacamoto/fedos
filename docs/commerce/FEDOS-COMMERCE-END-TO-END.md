# FedOS Commerce: End-to-End — What Actually Happens When Someone Buys Something

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65` ("GitHub OSS Presentation + Repository Operations Final Polish arc")
**Method:** code inspection by four independent research passes (Commerce domain, Payment/QR/Trust, UX surfaces, Product media) against a clean checkout pinned to this commit, followed by direct test execution (`npm run test:current`: 132 files / 1902 tests, all passing; `scripts/release/verify_oss_release.mjs`: 8/8 checks passing) and a code-grounded tabletop simulation. No doc claims were taken on faith — every statement below traces to a specific file and line.

---

## Phase 1 update (post-audit, additive — does not rewrite the audit below)

**Commerce Reachable Catalog + Product Surface Phase 1 has landed.** The narrative below (§1–§11) is the original audit, pinned to commit `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`, and is left intact as a faithful historical snapshot. What has actually changed since:

```
ACTUAL CUSTOMER FLOW:   PARTIAL       (was: ABSENT)
CUSTOMER PRODUCT UI:    IMPLEMENTED   (was: ABSENT)
PRODUCT IMAGES:         YES — minimal image support   (was: ABSENT)
ACTUAL ORDER FLOW:      ABSENT        (unchanged)
ACTUAL PAYMENT FLOW:    ABSENT        (unchanged)
QR COMMERCE:            NOT WIRED     (unchanged)
TRUST COMMERCE:         NOT WIRED     (unchanged)
```

A customer can now: open FedOS Desktop → click **Commerce** in the nav (next to Conversations) → see a real 3-product demo catalog (title, price, merchant, safe thumbnail/fallback) → open a product → see full Product Detail (description, price, merchant, media or safe fallback, an explicit **"Ordering not available yet"** notice — never a fake working Buy button) → return to Commerce or to Conversations. This is real, IPC-backed, exercised against the actual `os/commerce` domain's `listViewableProducts()` — not a mock. See `docs/architecture/COMMERCE-E2E-SWIMLANE.md`'s "Phase 1 update" section for the sequence diagram, and `docs/commerce/evidence/` for screenshots of the real packaged app.

**Still true, unchanged by this arc:** no Order type exists, no payment rail is wired, `PlaceholderPaymentProvider.ingestCallback()` remains unreachable (now with an explicit regression test proving it), Commerce↔Trust wiring is still zero, and QR still has no commerce meaning. §1 below ("no product to discover") now describes the *pre-Phase-1* state only — see the Phase 1 update above for the current customer view.

---

## The one-sentence answer

**As of the original audit, nothing happened — FedOS Desktop was a 1:1 end-to-end-encrypted messenger (Nostr NIP-17 + Double Ratchet) with no reachable commerce capability at all; a well-typed, well-tested Commerce domain and a separate, real Trust capability both existed in the source tree, but neither was wired into the shipping application. Phase 1 (above) has since made read-only product discovery real — everything else in this sentence remains true.**

---

## 1. Customer view (as of the original audit — see "Phase 1 update" above for the current state)

A customer opened FedOS Desktop and saw exactly six things: Conversations, Search, Archive, Devices, Safety Center, Settings. There was no product to discover, nothing to buy, no order to place, no payment to make, and nothing to receive. This wasn't a partially-built flow with a broken step in the middle — there was no first step. See [CUSTOMER-COMMERCE-FLOW.md](../architecture/CUSTOMER-COMMERCE-FLOW.md).

## 2. Merchant view

A merchant has no way to list a product, no inbox to receive an order into (because no Order concept exists at all — confirmed by the Commerce domain's own README: *"No Order, Support (ticketing), Delivery, or Seller State concept is defined anywhere in this capability"*), and no way to accept, reject, cancel, or fulfill anything. See [MERCHANT-COMMERCE-FLOW.md](../architecture/MERCHANT-COMMERCE-FLOW.md).

## 3. FedOS / platform view

Underneath the UI, a real domain module exists at `src/os/commerce/` — a `Product` catalog type, an access-policy layer, a payment boundary, a marketplace-intent boundary, and creator-adjacent capabilities (entitlement/membership/profile/reputation/appeal/subscription-policy). Every one of these files carries the same self-declared header: `STATUS: inert scaffolding, not reachable from the shipped Electron app.` This was independently verified, not just quoted: the composition root that would assemble it, `createCommerce()` (`src/os/commerce/create_commerce.ts:73-79`), has zero callers anywhere outside `test/*` files. The Electron app's own composition root, `loadRootModules()` (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:487-565`), imports only Messenger modules — never Commerce, never Trust.

**Layer model (as implemented):**

```
UI (6 screens, no commerce)
  ↓  window.fedosApp bridge — no commerce/product/order/payment channel
Composition root (loadRootModules — Messenger only)
  ↓  ⛔ never imports os/commerce or os/trust
Commerce domain (dormant)          Trust capability (dormant relative to Commerce/UI)
  catalog / payment / marketplace   envelope / credential / entitlement / QR
  — zero network calls              — reachable only via a standalone CLI
  — zero persistence
```

See [COMMERCE-BACKEND-DATAFLOW.md](../architecture/COMMERCE-BACKEND-DATAFLOW.md) for the full per-transition table.

## 4. Backside/internal system flow

Nothing crosses a network boundary for commerce. The only network contact anywhere in this story is the Messenger domain talking to a Nostr relay — for messages, never for products, orders, or payments. The only durable storage anywhere in this story is the Messenger domain's local encrypted conversation state — Commerce never imports `StorageBackend` at all (confirmed by `create_commerce.ts`'s own header, which states it deliberately doesn't accept a storage/messaging parameter because grep confirms nothing in `os/commerce` would consume one). See [COMMERCE-E2E-SWIMLANE.md](../architecture/COMMERCE-E2E-SWIMLANE.md) for the full sequence diagram (almost entirely dashed/dormant, by design of the diagram matching reality).

## 5. Payment authority

**There is no "paid" state in this codebase.** `PaymentStatus` is `"unavailable"|"pending"|"accepted_placeholder"|"rejected"|"expired"|"refunded"|"error"` — no `"paid"`, no `"disputed"`. The closest state, `accepted_placeholder`, is produced by a purely local, non-cryptographic check (non-negative amount, no sensitive-substring metadata) inside `PlaceholderPaymentProvider` — and is explicitly documented to mean only "passed a policy check," never "money was received." No real payment rail exists: `payment/adapters/btcpay/` is a reserved, empty directory containing only a README that says so. **FedOS's own policy — that an AI/customer claim must never be authoritative payment proof — is upheld today, but only because the entire payment path is unreachable, not because of an active verification control.** The type system does correctly prevent the dormant code from ever labeling a grant `source: "payment"` (it's restricted to `"manual"|"promo"` at the type level) — a real, if currently moot, safeguard. See [PAYMENT-FLOW.md](../architecture/PAYMENT-FLOW.md).

## 6. Trust / QR role

QR code generation and signed-envelope verification are real, tested capabilities — but they live entirely inside `src/os/trust/`, reachable only via a standalone CLI (`npm run trust:issuer`), never from the Electron app or Commerce. A QR today can encode any signed Trust envelope (credential, entitlement, capability grant, contract-artifact proof) — but **zero code anywhere makes a QR represent a payment request, receipt, order, or delivery token**, because zero code connects Trust to Commerce in either direction (enforced by an automated test, `test/architecture_boundary_trust.test.ts`). See [ACTOR-MAP.md](../architecture/ACTOR-MAP.md) §6 and [PAYMENT-FLOW.md](../architecture/PAYMENT-FLOW.md).

**IMPLEMENTED:** signing/verifying envelopes; encoding a signed envelope to QR text/image; decoding QR text back to a structurally-parsed (not auto-verified) envelope.
**AVAILABLE WITH EXISTING PRIMITIVES:** using a `FedosSubscriptionEntitlement` (whose scopes already include `"signed-qr"` and `"contract-proof"`) as a purchase receipt/entitlement, if a Commerce→Trust seam were added.
**NOT IMPLEMENTED:** any connection from a purchase/payment event to Trust issuance; QR scanning from a camera image (only text-string decoding exists).

## 7. Storage / network boundaries

Commerce: zero storage, zero network. Trust: zero storage of its own (caller-managed), zero network from the library (its CLI is a local process). Messenger: real local encrypted storage, real Nostr relay network contact — the only live system of record in the product.

## 8. Failure behavior

Simulated in [COMMERCE-TABLETOP-EXERCISES.md](COMMERCE-TABLETOP-EXERCISES.md): the happy-path tabletop is **BLOCKED** at the very first step (no way to list a product, no way to discover one) and would remain blocked at every later step even bypassing the UI, because Order/notification/delivery/proof mechanisms don't exist. Of 10 simulated failure cases, 2 PASS (both by absence/unreachability, not by a working control), 5 are GAPs, 3 are UNKNOWN (Trust's own tamper/expiry handling is sound in isolation but is never exercised by any commerce-shaped call), 2 are out of scope (offline handling, a Messenger-layer concern not investigated here).

## 9. Current limitations (the honest summary)

- No Order concept exists anywhere.
- No real payment rail is integrated.
- No commerce UI exists in the shipping app, for either customer or merchant.
- No delivery/fulfillment mechanism exists (`DigitalAsset` is dead code, zero consumers).
- Commerce and Trust have zero wiring, despite Trust already modeling exactly the entitlement/QR primitives a purchase receipt would need.
- Product media (image/gallery/video/sample) is model-only fragments in a dead sibling subsystem, never a field on `Product` itself, never rendered anywhere.

## 10. Media support

**ABSENT in the shipping product; MODEL ONLY in the dormant domain layer.** `Product` itself has no image/video/gallery field — only an opaque `assetIds: string[]` link to a separate, unreachable `AssetMetadata` type that does model `kind` (image/video_segment/audio/preview/thumbnail), `contentType`, `sizeBytes`, `checksum`, `tags`. No alt text, no remote-URL field, no local-file field, and no Nostr-media-tag parsing exist anywhere. See [PRODUCT-SURFACE-AUDIT.md](PRODUCT-SURFACE-AUDIT.md).

### Recommended minimal `ProductMedia` shape (observation only — not implemented)

Derived from what already exists in the repo, reusing rather than reinventing: `AssetMetadata`'s field shape, the Messenger domain's real SHA-256 content-hash primitive (`computeFedosConversationArchiveContentHash()`), and the Messenger domain's real opaque-bytes storage port (`FedosConversationPayloadStorage`) as the eventual byte-storage seam (not currently commerce-facing, but architecturally the closest live analog):

```ts
interface ProductMedia {
  readonly id: string;
  readonly productId: string;
  readonly role: "primary" | "gallery" | "thumbnail" | "video" | "video_preview" | "sample";
  readonly contentType: string;        // MIME, as AssetMetadata.contentType
  readonly sizeBytes: number;
  readonly checksum?: string;          // sha256, reusing the Conversation Archive integrity pattern
  readonly altText?: string;           // net-new — wholly absent today
  readonly storageRef: string;         // opaque pointer, as DigitalAsset.storageRef — resolution deliberately deferred
  readonly nostrEventId?: string;      // to plug into Product.linkedEventIds / the existing Nostr classify.ts tag scheme
}
```

This is a design note for a future arc, not a plan already underway.

## 11. Current vs proposed

| | Current | Proposed (next bounded arc, see below) |
|---|---|---|
| Product listing | Type exists, zero UI, zero persistence | A create/list screen backed by real (even if initially local-only) storage |
| Order | Absent entirely | A new, minimal Order type + lifecycle |
| Payment | No "paid" state, no real rail | A real `PaymentProvider` (e.g. BTCPay) with authenticated callbacks |
| Trust/QR | Real, but unwired | A Commerce→Trust Port issuing a signed entitlement on confirmed payment |
| Media | Model fragments, unreachable | A `ProductMedia` type reusing existing hash/storage primitives |

---

## Recommended Next Implementation Arc (one, bounded)

**DONE** — "Commerce Composition Root Wiring, Phase 1: reachable read-only catalog" (as scoped below) landed via the Commerce Reachable Catalog + Product Surface Phase 1 arc; see the "Phase 1 update" section at the top of this document. Original scope statement, preserved for the record: wire `createCommerce()` into `loadRootModules()`, add exactly one new IPC channel family (`fedos-app:commerce-*`) exposing `listViewableProducts()` read-only, and add exactly one new UI screen (product list + detail, no buy button yet). Deliberately excluded Order, Payment, Trust wiring, and media beyond a minimal image slice — those remain separate, larger, riskier follow-on arcs (per [COMMERCE-GAP-CLASSIFICATION.md](COMMERCE-GAP-CLASSIFICATION.md) and `docs/commerce/COMMERCE-IMPLEMENTATION-ROADMAP.md`'s recommended build order).

**Next recommended arc:** Merchant Product Creation / Editing (see `docs/commerce/COMMERCE-IMPLEMENTATION-ROADMAP.md` step 2) — still local-only, no network requirement.

---

## Document index

- [ACTOR-MAP.md](../architecture/ACTOR-MAP.md)
- [CUSTOMER-COMMERCE-FLOW.md](../architecture/CUSTOMER-COMMERCE-FLOW.md)
- [MERCHANT-COMMERCE-FLOW.md](../architecture/MERCHANT-COMMERCE-FLOW.md)
- [PAYMENT-FLOW.md](../architecture/PAYMENT-FLOW.md)
- [COMMERCE-E2E-SWIMLANE.md](../architecture/COMMERCE-E2E-SWIMLANE.md)
- [COMMERCE-BACKEND-DATAFLOW.md](../architecture/COMMERCE-BACKEND-DATAFLOW.md)
- [COMMERCE-STATE-MACHINES.md](../architecture/COMMERCE-STATE-MACHINES.md)
- [PRODUCT-SURFACE-AUDIT.md](PRODUCT-SURFACE-AUDIT.md)
- [COMMERCE-TABLETOP-EXERCISES.md](COMMERCE-TABLETOP-EXERCISES.md)
- [COMMERCE-GAP-CLASSIFICATION.md](COMMERCE-GAP-CLASSIFICATION.md)
- [mockups/](mockups/) — conceptual, not current product UI
