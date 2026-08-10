# Commerce End-to-End Swimlane — As-Implemented

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`.
**Updated by:** Commerce Reachable Catalog + Product Surface Phase 1 arc. Customer discovery (Catalog → Product Detail) is now IMPLEMENTED and reachable from the real packaged FedOS Desktop app — see §"Phase 1 update" below. Everything after Product Detail (Order/Payment/Delivery/QR) remains exactly as dashed/not-wired as the original audit found it.

## Legend

- **Solid arrow** — IMPLEMENTED and reachable in the flow it's drawn in (may still be reachable only within the dormant domain layer's own unit tests — labeled explicitly where that's the case).
- **Dashed arrow** — NOT-YET-WIRED / PROPOSED. Never drawn to represent something that actually executes today.
- Lane order: Customer → Customer FedOS → Commerce (domain layer) → Payment → Trust → Merchant FedOS → Merchant. Messenger/Nostr is added only where it is actually involved (it is not, anywhere in this flow).

## Diagram

```mermaid
sequenceDiagram
    actor Customer
    participant CFedOS as Customer FedOS (shipping app)
    participant Commerce as Commerce domain (os/commerce)
    participant Payment as Payment (noop/placeholder)
    participant Trust as Trust (os/trust)
    participant MFedOS as Merchant FedOS (shipping app)
    actor Merchant

    Customer->>CFedOS: Open the app, look for something to buy
    CFedOS--xCustomer: No product/catalog screen exists (ABSENT)

    rect rgb(255, 235, 235)
    note over Customer,Merchant: Everything below this line is DORMANT DOMAIN-LAYER CODE ONLY.<br/>It is exercised by unit tests directly calling these functions —<br/>NOT by any UI, IPC channel, or composition root in the shipped app.<br/>Dashed arrows = would require new wiring that does not exist today.
    Customer-->>Commerce: (if called directly) listViewableProducts()
    Commerce-->>Customer: Product[] filtered by canViewProduct()
    Customer-->>Commerce: (if called directly) productToPaymentRequest()
    Commerce-->>Payment: PaymentRequest
    Payment-->>Commerce: PaymentDecision {status: "accepted_placeholder"}<br/>— NEVER a verified real payment
    Commerce-->>Commerce: paymentDecisionToGrant()<br/>source forced to "manual"|"promo", never "payment"
    Note over Commerce: PurchaseGrant constructed —<br/>then NOTHING persists it or routes it anywhere.<br/>No Order concept exists to carry it forward.
    Commerce-.->Trust: MISSING WIRING — no code path exists.<br/>issueFedosSubscriptionEntitlement() is never called<br/>from anywhere in os/commerce.
    Trust-.->Commerce: MISSING WIRING — Trust QR/envelope<br/>primitives are real but zero-imported by commerce.
    Commerce-.->MFedOS: MISSING WIRING — no notification mechanism,<br/>no Order to route, no merchant inbox to receive it.
    MFedOS-.->Merchant: ABSENT — no merchant UI exists at all<br/>(no create/list/accept/reject/cancel/fulfill screen)
    end
```

## What is actually solid (implemented) anywhere in this diagram

Only the two innermost domain-layer hops are real, working code:
1. `listViewableProducts()` → filtered `Product[]` (`catalog/directory.ts:60-68`, `catalog/policy.ts:61-85`)
2. `productToPaymentRequest()` → `PaymentRequest` → `PlaceholderPaymentProvider.requestPayment()` → `PaymentDecision` (`payment/commerce_bridge.ts`, `payment/noop_payment.ts`)
3. `paymentDecisionToGrant()` → `PurchaseGrant` (`payment/commerce_bridge.ts:107-120`)

All three are pure, in-process TypeScript functions, fully unit-tested (`test/commerce_*.test.ts`, `test/architecture_payment_provider_btcpay_readiness.test.ts` — all passing per this audit's `test:current` run), and **none is reachable from any UI, IPC channel, or composition root in the shipped Electron app.**

## What is entirely absent

- ~~Any UI screen for product discovery, product detail~~ — **UPDATED, see "Phase 1 update" below**: product discovery (Catalog) and Product Detail are now real, reachable screens. Order creation, payment, order confirmation, and merchant management screens remain entirely absent.
- The Order concept itself (no type exists anywhere).
- Any real payment rail (`payment/adapters/btcpay/` is a reserved, empty directory).
- Any wiring between Commerce and Trust (zero cross-imports in either direction, enforced by `test/architecture_boundary_trust.test.ts`).
- Any delivery mechanism (`DigitalAsset` type is dead code, zero consumers).

**E2E DIAGRAM: PASS** (as a faithful representation of current reality at the audited commit — the diagram above intentionally documents that snapshot and is left unmodified; the Phase 1 update below is additive, not a retroactive edit to the original diagram).

## Phase 1 update — Customer discovery is now IMPLEMENTED

```mermaid
sequenceDiagram
    actor Customer
    participant CFedOS as Customer FedOS (shipped app)
    participant Main as Electron main (loadRootModules)
    participant Commerce as Commerce domain (os/commerce)
    participant Payment as Payment (noop/placeholder)
    participant Trust as Trust (os/trust)

    Customer->>CFedOS: Open the app, click "Commerce" in the nav
    CFedOS->>Main: fedos-app:commerce-catalog-list (real IPC, bounded)
    Main->>Commerce: listViewableProducts(demoProducts, "", [])
    Commerce-->>Main: Product[] (real domain policy, real filter)
    Main-->>CFedOS: catalog DTO (title/price/merchant/hasImage)
    CFedOS-->>Customer: Catalog screen renders — IMPLEMENTED

    Customer->>CFedOS: Click a product
    CFedOS->>Main: fedos-app:commerce-product-detail { productId }
    Main->>Commerce: (same listViewableProducts, then find by id)
    Main-->>CFedOS: product detail DTO + media (or null -> fallback)
    CFedOS-->>Customer: Product Detail screen renders — IMPLEMENTED<br/>"Ordering not available yet" (no fake Buy button)

    rect rgb(255, 235, 235)
    note over Customer,Trust: Everything below remains exactly as the original audit found it: DORMANT / MISSING.
    Commerce-.->Payment: NOT WIRED from this slice -- PlaceholderPaymentProvider/<br/>ingestCallback() remain unreachable (regression-tested)
    Commerce-.->Trust: MISSING WIRING -- unchanged from the original audit
    end
```

**What changed vs. the original diagram above:** `loadRootModules()` now dynamically imports the real `os/commerce` barrel (`src/os/commerce/index.ts`, newly added to `tsconfig.beta-runtime.json`'s build allowlist) and calls the SAME real `listViewableProducts()` the original diagram already showed as "solid (implemented)" — the difference is this call is now reachable from the real Electron main process and IPC surface, not only from `test/commerce_*.test.ts`. `productToPaymentRequest()` / `paymentDecisionToGrant()` / the Payment lane are untouched — Phase 1 never imports or constructs a `PaymentProvider` of any kind (see `docs/commerce/PRODUCT-SURFACE-AUDIT.md`'s Phase 1 regression guard).

**CUSTOMER DISCOVERY (Catalog → Product Detail): IMPLEMENTED.**
