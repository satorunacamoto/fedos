# Commerce Gap Classification

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`.

P0 = flow cannot safely work at all. P1 = core user journey incomplete. P2 = usability/discoverability. P3 = future enhancement.

| # | Priority | Gap | Evidence | Current code location | Minimal fix | Architectural impact | Scope |
|---|---|---|---|---|---|---|---|
| 1 | P0 | No commerce UI exists anywhere in the shipping app | Agent U: full 6-screen enumeration of `fedos_electron_beta_page.html`, none commerce-related | `packages/fedos-desktop-electron-spike/src/` | Add a product list/detail screen wired via new IPC channels | New UI surface, new IPC family, new composition-root wiring | L |
| 2 | P0 | `createCommerce()` is never called from the shipped app | Agent U/C: zero callers outside `test/*` | `src/os/commerce/create_commerce.ts`, `fedos_electron_beta_main.cts` | Call `createCommerce()` from `loadRootModules()` and expose it via IPC | Cross-module wiring only — no new domain logic required | M |
| 3 | P0 | No Order concept exists anywhere in the codebase | `src/os/commerce/README.md:52-58`; repo-wide grep, zero hits | `src/os/commerce/` (absent) | Design and add an `Order` type + lifecycle, distinct from `PurchaseGrant` | New domain concept — the single largest missing piece | L |
| 4 | P0 | No real payment rail is integrated (BTCPay adapter directory is empty) | `payment/adapters/btcpay/README.md:1-25` | `src/os/commerce/payment/adapters/btcpay/` | Implement a real `PaymentProvider` (e.g. BTCPay) behind the existing interface | New external dependency, new secret/network handling | L |
| 5 | P0 | `PlaceholderPaymentProvider.ingestCallback()` accepts unauthenticated settlement events | `payment/noop_payment.ts:295-309`; interface doc `types.ts:214-219` requires signature/HMAC verification the placeholder doesn't perform | `payment/noop_payment.ts` | Add signature/HMAC verification before accepting any real adapter's callback (must be fixed *before*, not after, a real rail is wired — see Gap 4) | Contained to the payment adapter boundary | S |
| 6 | P1 | No merchant-side UI (create/list/accept/reject/cancel/fulfill) exists | Agent U: full inventory, all ABSENT | `packages/fedos-desktop-electron-spike/src/` | Add a merchant management screen | New UI surface | L |
| 7 | P1 | No delivery/fulfillment mechanism exists; `DigitalAsset` is dead code | Agent C: zero consumers repo-wide of `DigitalAsset` | `src/os/commerce/catalog/types.ts:58-68` | Wire `DigitalAsset` to a real storage-ref resolver, or design a new delivery artifact type | Needs a decision on local-first vs. remote storage before implementation | M |
| 8 | P1 | Commerce and Trust have zero wiring in either direction | Agent P: zero cross-imports, enforced by `test/architecture_boundary_trust.test.ts` | `src/os/commerce/`, `src/os/trust/` | Add a Commerce→Trust Port under `os/core/ports/` for entitlement issuance on confirmed payment | Requires relaxing (in a controlled, tested way) the current boundary-test isolation | M |
| 9 | P1 | Product has no image/gallery/video/sample/alt-text field; `AssetMetadata` is dead-code-adjacent | Agent M: full classification table | `src/os/commerce/catalog/types.ts`, `asset_cache_types.ts` | Add a minimal `ProductMedia` type (see recommendation in [FEDOS-COMMERCE-END-TO-END.md](FEDOS-COMMERCE-END-TO-END.md)) reusing existing SHA-256/payload-storage primitives | Net-new small type + reuse of existing integrity/storage primitives — no new dependency required | S–M |
| 10 | P1 | Product has no inventory/stock field | Repo-wide grep, 0 hits on any stock/inventory concept on `Product` | `src/os/commerce/catalog/types.ts` | Add an optional `stock?: number` field and a decrement-on-grant path once Orders exist | Small, but depends on Gap 3 (Order) landing first | S |
| 11 | P2 | No product discovery/search UI, even once a catalog exists | Agent U | `packages/fedos-desktop-electron-spike/src/` | Add a simple list view (already covered by Gap 1/6 if scoped together) | Folds into Gap 1 | S (if combined with Gap 1) |
| 12 | P2 | No customer receipt/order-confirmation UI | Agent U | `packages/fedos-desktop-electron-spike/src/` | Add a confirmation screen once Order + Payment evidence exist | Depends on Gaps 3, 4 | S (once dependencies land) |
| 13 | P3 | QR is not used anywhere in commerce (transport-only, in Trust) | Agent P: zero commerce imports of `os/trust/qr/` | `src/os/trust/qr/` | Once Trust↔Commerce wiring (Gap 8) exists, use QR to hand a signed entitlement/receipt to the customer | Depends on Gap 8 | S (once dependency lands) |
| 14 | P3 | No dispute/refund UX, even though `refundPayment()` exists in the dormant provider | `payment/noop_payment.ts` | `src/os/commerce/payment/` | Add a merchant/customer dispute flow once Orders + real payments exist | Depends on Gaps 3, 4 | M |
| 15 | P3 | No video/media-preview concept beyond a "segment" kind with zero consumers | Agent M | `catalog/asset_cache_types.ts` | Defer — video support is not part of a minimum useful product surface | Cosmetic/future only | XS (to explicitly defer, document as out of scope) |

## Gap counts

- **P0 (flow cannot safely work): 5**
- **P1 (core journey incomplete): 5**
- **P2 (usability/discoverability): 2**
- **P3 (future enhancement): 3**

No gap in this table represents a silent omission on the audit's part — every row cites the exact code location and evidence found by the four research agents. Nothing here should be read as a commitment to build; see [FEDOS-COMMERCE-END-TO-END.md](FEDOS-COMMERCE-END-TO-END.md) §Recommended Next Arc for the one bounded next step this audit recommends.
