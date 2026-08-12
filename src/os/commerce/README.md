# Commerce (`src/os/commerce/`)

## Status: reachable end-to-end (as of the Commerce E2E Completion arc)

The `catalog/`, `marketplace/`, `creator/` subdirectories below were
originally **carried forward from a pre-pivot prototype** ("nostr-window,"
a Reddit-style window into Nostr). That is no longer the whole story: this
directory now also contains real, newly-implemented `order/`, `delivery/`,
`payment/local_simulator.ts`, `reputation/`, `events/`, and `receipt/`
modules, and a real Order → TEST/LOCAL payment → Delivery → signed Trust
receipt vertical slice **is reachable from the shipped FedOS Desktop
Electron app** — a merchant can create/publish a product, a customer can
discover/order/pay (TEST/LOCAL simulator only, never a real payment rail)
it, and the merchant can fulfill it, all through real IPC channels and
composition-root wiring (`fedos_electron_beta_main.cts`), not just unit
tests. See top-level [`README.md`](../../../README.md)'s "Commerce" section
and [`docs/commerce/FEDOS-COMMERCE-END-TO-END.md`](../../../docs/commerce/FEDOS-COMMERCE-END-TO-END.md)
for the authoritative, code-audited account, including exactly what
remains unwired (a real payment rail, Nostr publication of Commerce
events, and pseudonymous reputation/persona UI surface — see below).
Nothing in the originally-relocated `catalog/`/`marketplace/`/`creator/`
subset itself was redesigned as part of the original move; the reachable
slice above was built on top of it in later arcs.

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

**Order** (`order/`) and **Delivery** (`delivery/`) concepts now exist and
are real, guarded state machines wired into the shipped app — this
section's older claim that neither existed anywhere is stale and kept only
for context. `catalog/types.ts`'s `PurchaseGrant` is unrelated to and
predates both — it still only records the *result* of an already-decided
external entitlement (a manual gift, a settled payment, a promo), not an
order.

**Support** (ticketing) and a general **Seller State** concept beyond what
`order/`/`delivery/` already model still do not exist anywhere in this
capability; building either is future work with no committed design yet.

## Dependency rule: Commerce depends on Messenger only through Ports

Commerce must never import a messenger implementation directly (old
location or new). Any future point where Commerce needs to reach Messenger
(e.g. a support conversation, a purchase notification) must go through a
Port defined in `src/os/core/ports/`, with a Messenger-side adapter on the
other end of that Port — never a direct import of messenger internals. See
`test/architecture_boundary_commerce.test.ts` for the automated check.
