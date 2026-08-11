# FedOS Commerce — Capability Boundary

Status: architecture note accompanying the "OS Capability Modularization"
arc's move of the commerce-shaped subset of a pre-pivot prototype into
`src/os/commerce/`. Pure software architecture — no legal/compliance/
regulatory content.

## What "Commerce" is today: inert scaffolding

`src/os/commerce/` is **not a live product capability**. It is the
commerce-shaped subset of a pre-pivot prototype ("nostr-window," a
Reddit-style window into Nostr) that has been given a real, forward-looking
home instead of being scattered across top-level `src/` directories or
quarantined alongside the rest of that prototype's genuinely dead code
(`src/os/_legacy_prototype/`). Nothing here has been redesigned or
newly implemented as part of this move — it is a relocation only.

It is not reachable from the shipped FedOS Desktop Electron app: none of
its routes, pages, or providers run in the shipped product, and it is not
included by any of the app's packaging tsconfigs (`tsconfig.runtime.json`,
`tsconfig.beta-runtime.json`, `tsconfig.host-bridge.json`,
`tsconfig.settings-host-bridge.json`, `tsconfig.unlock-runtime.json`).

## The four subdirectories

- **`catalog/`** (formerly `src/commerce/`) — the `Product`/`PurchaseGrant`
  model: a read-only product directory, pure access policy (view/purchase
  decisions over status + visibility + grants), and PUBLIC/UNLISTED asset
  preview metadata resolution (never bytes, never a download, never a
  signed URL). Nostr-event-tag classification mapping events onto products
  lives in `catalog/adapters/nostr/` (see the dependency-rule section
  below), not in this domain layer.
- **`payment/`** (formerly `src/payment/`) — the `PaymentProvider` seam:
  `types.ts` defines the request/decision shapes; `noop_payment.ts` ships
  two implementations that charge nothing (`NoopPaymentProvider`,
  permanently `unavailable`; `PlaceholderPaymentProvider`, a policy check
  only); `commerce_bridge.ts` is a pure bridge from `catalog/`'s
  `Product`/`PurchaseGrant` to a payment request/decision.
- **`marketplace/`** (formerly `src/marketplace/`) — a more abstract,
  protocol-neutral "creator lists something for sale/support" seam,
  decoupled from any specific rail or storefront protocol — a different,
  broader layer than `catalog/`'s Nostr-event-shaped `Product`. Its only
  implementation, `NoopMarketplaceProvider`, lists and charges nothing.
- **`creator/`** (formerly `src/creator/`) — protocol-neutral creator
  concepts as pure types + policy functions only: profile/trust labels
  (`profile.ts`), entitlement questions with no grant issuance
  (`entitlement.ts`), membership plan labels (`membership.ts`),
  subscription-gated visibility (`subscription_policy.ts`), reputation
  signals (`reputation.ts`), and appeal records (`appeal.ts`).

## Reserved adapter seams (no implementation)

Two directories exist purely to reserve a location for future work; neither
contains any code beyond a README today:

- **`support/`** and **`support/adapters/telegram/`** — a Support domain
  (ticketing/customer support) does not exist anywhere in this repository.
  When built, it will compose with a `MessagingPort` (see below) plus
  channel adapters; `support/adapters/telegram/` reserves the first such
  adapter's location.
- **`payment/adapters/btcpay/`** — reserves the location for a future
  BTCPay Server adapter implementing the `PaymentProvider` contract in
  `payment/types.ts`.

No Telegram or BTCPay SDK is installed or imported anywhere in this
repository. `test/architecture_boundary_commerce.test.ts` enforces that any
future Telegram/BTCPay SDK reference stays confined to its own reserved
adapter directory.

## What does not exist yet

No **Order**, **Support** (ticketing), **Delivery**, or **Seller State**
concept is defined anywhere in this capability. A `PurchaseGrant`
(`catalog/types.ts`) records only the *result* of an already-decided
external entitlement (a manual gift, a settled payment, a promo) — it is
not an order, and there is no fulfillment, delivery, refund, or seller-side
state machine modeled anywhere. Designing any of those is future work with
no committed shape yet.

## Dependency rule: Commerce → Port ← Messenger Adapter

Commerce must never import a Messenger implementation directly — old
location (`src/conversation/`, `src/board/`, `src/desktop/`, `src/device/`,
`src/nostr/`) or new (`src/os/messenger/`). Any point where a future
Commerce feature needs to reach Messenger (for example, a purchase
notification, or a Support conversation) must go through a **Port**
interface defined in `src/os/core/ports/`, with a Messenger-side adapter
implementing that Port on the other end — never a direct import of
Messenger internals. `test/architecture_boundary_commerce.test.ts` walks
every file under `src/os/commerce/` and fails the build if a relative
import ever resolves into a forbidden Messenger directory.

### A pre-existing exception, fixed via a reserved Nostr adapter directory

`catalog/bridge.ts`'s `productFromEvent` and all of `catalog/classify.ts`
took a type-only `NostrEvent` shape from `src/nostr/types.ts` to classify
raw Nostr events onto products. This predated the commerce move entirely —
inherited from the original `src/commerce/bridge.ts` / `classify.ts` — and
was exactly the class of dependency the boundary rule above forbids.

Fix: `classify.ts` (whose entire purpose is reading a Nostr event's tags)
moved to `catalog/adapters/nostr/classify.ts`; `productFromEvent` (the one
`NostrEvent`-typed function in `bridge.ts`) split out to
`catalog/adapters/nostr/bridge.ts`, alongside it. `catalog/bridge.ts` keeps
`productFromSpace`/`canPromoteProductInSpace`/`ProductDraftOptions` — none
of which touch `NostrEvent`. `test/architecture_boundary_commerce.test.ts`
now permits `src/nostr/` imports only from within
`catalog/adapters/nostr/`, the same pattern already used for the reserved
Telegram/BTCPay adapter directories above; every other file under
`src/os/commerce/` is still hard-forbidden from importing `src/nostr/`.
Zero violations now (was 1, both files, before this fix).

## Relationship to `src/os/_legacy_prototype/`

Some legacy-prototype files still reference this commerce subset (e.g.
`_legacy_prototype/render/product.ts` imports `catalog/directory.ts`;
`_legacy_prototype/runtime/create_runtime.ts` imports
`payment/noop_payment.ts`). Those are real, pre-existing cross-references
between two capabilities with different futures — commerce may become a
real product surface someday, `_legacy_prototype/` is kept only for its
existing test coverage — and are not a boundary violation in either
direction; `src/os/commerce/`'s own boundary test does not forbid importing
`_legacy_prototype/`.
