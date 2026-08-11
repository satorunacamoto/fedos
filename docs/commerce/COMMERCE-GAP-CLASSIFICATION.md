# Commerce Gap Classification

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`.

## Commerce E2E Completion arc update (current, additive)

The Commerce E2E Completion arc closed **Gap #3** (Order), **Gap #6** (merchant UI: create/edit/publish/incoming-orders/accept/reject/fulfill), **Gap #7** (delivery/fulfillment — a real `DeliveryRecord` state machine, not `DigitalAsset`), **Gap #8** (Commerce↔Trust wiring — a real signed `TradeReceiptProof` issued on order completion), **Gap #12** (customer order/receipt UI), and **Gap #13** (QR now carries a real signed trade receipt). Verified end-to-end via `commerce_e2e_full_happy_path_real_electron.test.ts` against the real packaged app, not code inspection alone — see `docs/commerce/FEDOS-COMMERCE-END-TO-END.md`'s own "Commerce E2E Completion arc update" for the full account, including three real composition-root bugs this run found and fixed.

**Gap #4 (real payment rail) remains open BY DESIGN, not by omission** — this arc's own brief explicitly forbids wiring a real payment rail or moving real money; payment is a `DeterministicLocalPaymentProvider`, constructed only with `{ acknowledgeTestOnly: true }` and refusing `runtimeProfile: "production"` outright, callable only from this process's own composition root (no external network callback surface — it is not the same code path Gap #5 describes). **Gap #5 (`PlaceholderPaymentProvider.ingestCallback()` unauthenticated)** is unchanged — that specific dormant provider is untouched by this arc, and is not the one used by the new local simulator flow.

**Gap #10 (no inventory/stock field)** remains open and now has its stated dependency satisfied (Order exists) — a reasonable next-arc candidate.

Updated counts: **P0: 3 total — 3 closed (#1, #2 from Phase 1; effectively #3's core blocker resolved), 1 open (#4, by design)**; **P1: 5 total — 3 closed this arc (#6, #7, #8), 1 partially closed (#9, unchanged from Phase 1), 1 open (#10)**; **P2: 1 closed this arc (#12), 1 open (#11)**; **P3: 1 closed this arc (#13), 2 open (#14, #15)**.

## Phase 1 update (post-audit, additive)

The Commerce Reachable Catalog + Product Surface Phase 1 arc closed **Gap #1** and **Gap #2** below (both P0) and partially closed **Gap #9** (image only, at the composition-root layer, not yet the `Product`/`AssetMetadata` domain types themselves — see `docs/commerce/PRODUCT-SURFACE-AUDIT.md`'s Phase 1 update). **Gap #5** (the unauthenticated `PlaceholderPaymentProvider.ingestCallback()`) is **NOT closed** — the underlying provider is unchanged — but Phase 1 added an explicit regression test proving the new Catalog IPC surface cannot make it reachable. All other gaps are unchanged. Updated counts: **P0: 3 open, 2 closed.**

P0 = flow cannot safely work at all. P1 = core user journey incomplete. P2 = usability/discoverability. P3 = future enhancement.

| # | Priority | Gap | Evidence | Current code location | Minimal fix | Architectural impact | Scope |
|---|---|---|---|---|---|---|---|
| 1 | P0 | ~~No commerce UI exists anywhere in the shipping app~~ **CLOSED (Phase 1)** | Agent U: full 6-screen enumeration of `fedos_electron_beta_page.html`, none commerce-related | `packages/fedos-desktop-electron-spike/src/` | ~~Add a product list/detail screen wired via new IPC channels~~ DONE — Commerce nav entry + Catalog + Product Detail, read-only | New UI surface, new IPC family, new composition-root wiring | L |
| 2 | P0 | ~~`createCommerce()` is never called from the shipped app~~ **CLOSED (Phase 1)** | Agent U/C: zero callers outside `test/*` | `src/os/commerce/create_commerce.ts`, `fedos_electron_beta_main.cts` | ~~Call `createCommerce()` from `loadRootModules()` and expose it via IPC~~ DONE — `loadRootModules()` dynamically imports the barrel and exposes `listViewableProducts` via `fedos-app:commerce-*` | Cross-module wiring only — no new domain logic required | M |
| 3 | P0 | No Order concept exists anywhere in the codebase | `src/os/commerce/README.md:52-58`; repo-wide grep, zero hits | `src/os/commerce/` (absent) | Design and add an `Order` type + lifecycle, distinct from `PurchaseGrant` | New domain concept — the single largest missing piece | L |
| 4 | P0 | No real payment rail is integrated (BTCPay adapter directory is empty) | `payment/adapters/btcpay/README.md:1-25` | `src/os/commerce/payment/adapters/btcpay/` | Implement a real `PaymentProvider` (e.g. BTCPay) behind the existing interface | New external dependency, new secret/network handling | L |
| 5 | P0 | `PlaceholderPaymentProvider.ingestCallback()` accepts unauthenticated settlement events | `payment/noop_payment.ts:295-309`; interface doc `types.ts:214-219` requires signature/HMAC verification the placeholder doesn't perform | `payment/noop_payment.ts` | Add signature/HMAC verification before accepting any real adapter's callback (must be fixed *before*, not after, a real rail is wired — see Gap 4) | Contained to the payment adapter boundary | S |
| 6 | P1 | No merchant-side UI (create/list/accept/reject/cancel/fulfill) exists | Agent U: full inventory, all ABSENT | `packages/fedos-desktop-electron-spike/src/` | Add a merchant management screen | New UI surface | L |
| 7 | P1 | No delivery/fulfillment mechanism exists; `DigitalAsset` is dead code | Agent C: zero consumers repo-wide of `DigitalAsset` | `src/os/commerce/catalog/types.ts:58-68` | Wire `DigitalAsset` to a real storage-ref resolver, or design a new delivery artifact type | Needs a decision on local-first vs. remote storage before implementation | M |
| 8 | P1 | Commerce and Trust have zero wiring in either direction | Agent P: zero cross-imports, enforced by `test/architecture_boundary_trust.test.ts` | `src/os/commerce/`, `src/os/trust/` | Add a Commerce→Trust Port under `os/core/ports/` for entitlement issuance on confirmed payment | Requires relaxing (in a controlled, tested way) the current boundary-test isolation | M |
| 9 | P1 | Product has no image/gallery/video/sample/alt-text field; `AssetMetadata` is dead-code-adjacent — **PARTIALLY CLOSED (Phase 1)**: image rendering now real, but still not a `Product`/`AssetMetadata` domain field | Agent M: full classification table | `src/os/commerce/catalog/types.ts`, `asset_cache_types.ts` | Add a minimal `ProductMedia` type (see recommendation in [FEDOS-COMMERCE-END-TO-END.md](FEDOS-COMMERCE-END-TO-END.md), design detailed in `docs/architecture/COMMERCE-MEDIA-STORAGE.md`) reusing existing SHA-256/payload-storage primitives — gallery/video/sample remain fully open | Net-new small type + reuse of existing integrity/storage primitives — no new dependency required | S–M |
| 10 | P1 | Product has no inventory/stock field | Repo-wide grep, 0 hits on any stock/inventory concept on `Product` | `src/os/commerce/catalog/types.ts` | Add an optional `stock?: number` field and a decrement-on-grant path once Orders exist | Small, but depends on Gap 3 (Order) landing first | S |
| 11 | P2 | No product discovery/search UI, even once a catalog exists | Agent U | `packages/fedos-desktop-electron-spike/src/` | Add a simple list view (already covered by Gap 1/6 if scoped together) | Folds into Gap 1 | S (if combined with Gap 1) |
| 12 | P2 | No customer receipt/order-confirmation UI | Agent U | `packages/fedos-desktop-electron-spike/src/` | Add a confirmation screen once Order + Payment evidence exist | Depends on Gaps 3, 4 | S (once dependencies land) |
| 13 | P3 | QR is not used anywhere in commerce (transport-only, in Trust) | Agent P: zero commerce imports of `os/trust/qr/` | `src/os/trust/qr/` | Once Trust↔Commerce wiring (Gap 8) exists, use QR to hand a signed entitlement/receipt to the customer | Depends on Gap 8 | S (once dependency lands) |
| 14 | P3 | No dispute/refund UX, even though `refundPayment()` exists in the dormant provider | `payment/noop_payment.ts` | `src/os/commerce/payment/` | Add a merchant/customer dispute flow once Orders + real payments exist | Depends on Gaps 3, 4 | M |
| 15 | P3 | No video/media-preview concept beyond a "segment" kind with zero consumers | Agent M | `catalog/asset_cache_types.ts` | Defer — video support is not part of a minimum useful product surface | Cosmetic/future only | XS (to explicitly defer, document as out of scope) |

## Gap counts

- **P0 (flow cannot safely work): 5 total — 2 CLOSED (Phase 1: #1, #2), 3 open (#3 Order, #4 payment rail, #5 unauthenticated callback)**
- **P1 (core journey incomplete): 5 (1 partially closed — #9, image only)**
- **P2 (usability/discoverability): 2**
- **P3 (future enhancement): 3**

No gap in this table represents a silent omission on the audit's part — every row cites the exact code location and evidence found by the four research agents. Nothing here should be read as a commitment to build; see [FEDOS-COMMERCE-END-TO-END.md](FEDOS-COMMERCE-END-TO-END.md) §Recommended Next Arc for the one bounded next step this audit recommends.
