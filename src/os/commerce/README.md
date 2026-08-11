# Commerce (`src/os/commerce/`)

## Status: inert scaffolding

Everything under this directory is **carried forward from a pre-pivot
prototype** ("nostr-window," a Reddit-style window into Nostr) and is **not
reachable from the shipped FedOS Desktop Electron app**. FedOS today ships
as a focused, end-to-end encrypted Direct-message messenger; none of this
capability is wired into that product's runtime, IPC surface, or packaging
tsconfigs (`tsconfig.runtime.json`, `tsconfig.beta-runtime.json`,
`tsconfig.host-bridge.json`, `tsconfig.settings-host-bridge.json`,
`tsconfig.unlock-runtime.json`). It exists to give the commerce-shaped
subset of that prototype a real, forward-looking home instead of leaving it
scattered across top-level `src/` directories — nothing here has been
redesigned, re-validated, or newly implemented as part of this move.

## Subdirectories

- **`catalog/`** — the original `src/commerce/` (moved verbatim). Product
  model, access policy, event classification, and a read-only product
  directory. Defines `Product`/`PurchaseGrant` shapes; charges nothing,
  verifies no payment.
- **`payment/`** — the original `src/payment/` (moved verbatim). The
  `PaymentProvider` seam (`types.ts`) plus two safe implementations that
  charge nothing (`NoopPaymentProvider`, `PlaceholderPaymentProvider`) and a
  pure bridge to the catalog's `Product`/`PurchaseGrant` model.
- **`marketplace/`** — the original `src/marketplace/` (moved verbatim). A
  more abstract, protocol-neutral "creator lists something for sale/support"
  seam, decoupled from any specific rail or storefront protocol. Its
  `NoopMarketplaceProvider` lists and charges nothing.
- **`creator/`** — the original `src/creator/` (moved verbatim). Creator
  profile/trust labels, entitlement checks, membership plan labels,
  subscription visibility policy, reputation signals, and appeal records —
  all pure, protocol-neutral shapes and policy functions; no real identity
  verification, scoring, or grant issuance.

## Reserved adapter seams (no implementation yet)

- **`support/`** and **`support/adapters/telegram/`** — a *future* Support
  domain (ticketing/customer support) does not exist yet anywhere in this
  repository. These directories reserve its location and its first channel
  adapter's location; see their own READMEs.
- **`payment/adapters/btcpay/`** — a *future* BTCPay adapter implementing
  the `PaymentProvider` contract above (`payment/types.ts`). No BTCPay code
  exists anywhere in this repository; see its own README.

No Telegram or BTCPay SDK is installed or referenced anywhere in this
repository. These are reserved locations only.

## What does not exist yet

No **Order**, **Support** (ticketing), **Delivery**, or **Seller State**
concept is defined anywhere in this capability. `catalog/types.ts`'s
`PurchaseGrant` records only the *result* of an already-decided external
entitlement (a manual gift, a settled payment, a promo) — it is not an
order, and nothing here models fulfillment, delivery, refunds, or a
seller-side state machine. Building any of those is future work with no
committed design yet.

## Dependency rule: Commerce depends on Messenger only through Ports

Commerce must never import a messenger implementation directly (old
location or new). Any future point where Commerce needs to reach Messenger
(e.g. a support conversation, a purchase notification) must go through a
Port defined in `src/os/core/ports/`, with a Messenger-side adapter on the
other end of that Port — never a direct import of messenger internals. See
`test/architecture_boundary_commerce.test.ts` for the automated check.
