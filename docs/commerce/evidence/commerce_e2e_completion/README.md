# Commerce E2E Completion arc — Visual Evidence (full happy-path tabletop)

Screenshots of the **real packaged FedOS Desktop Beta Electron app**
(`packages/fedos-desktop-electron-spike/dist/fedos_electron_beta_main.cjs`,
launched with the real Electron binary, real WASM Master Seed artifact, a
real Argon2 profile unlock, an isolated throwaway test profile via
`FEDOS_ELECTRON_BETA_DATA_DIR`), captured via a new, disclosed,
additive `AUTOTEST_MODE=ui-script` action (`{"action":"screenshot", ...}`,
`fedos_electron_beta_main.cts`) that calls Electron's own real
`webContents.capturePage()` — never a DOM serialization or a mock. Fails
closed unless `FEDOS_ELECTRON_BETA_SCREENSHOT_DIR` is explicitly set (an
ordinary launch, and every other `ui-script` run that doesn't request
screenshots, never writes to disk). All product/merchant/order data shown
is synthetic demo data (the same `COMMERCE_DEMO_ACTORS` — Alice the
customer, Northlight Studio the merchant — every other Commerce test in
this package already uses) — no real customer, business, or payment data.

Captured across one continuous real run of the full tabletop (§30 of the
arc's own brief): Merchant creates+publishes a product → Customer
discovers, orders, submits → Merchant accepts → Customer requests +
simulates (TEST/LOCAL, never real money) payment → Merchant fulfills
(creates a real Delivery record) → Customer acknowledges real receipt →
either party completes the order → a real signed, QR-encoded Trust
receipt is issued and independently re-verified `VALID`.

| # | File | What it shows |
|---|------|----------------|
| 01 | `01-merchant-product-create-form.png` | Merchant's real Create Product form, filled in (title/description/price/currency) before submission. |
| 02 | `02-merchant-products-list-with-draft.png` | "My Products" immediately after creation — the new product is real and listed. |
| 03 | `03-merchant-products-list-published.png` | Same list after Publish — status flips to `active`, button flips to `Unpublish`. |
| 04 | `04-customer-catalog.png` | Customer-facing Commerce catalog with the "Acting as" demo actor selector. |
| 05 | `05-customer-product-detail.png` | Product Detail for the newly published product, opened as the customer. |
| 06 | `06-customer-order-created.png` | Order screen immediately after a real `Create Order` — status `created`. |
| 07 | `07-customer-order-submitted.png` | After `Submit` — status `submitted`. |
| 08 | `08-merchant-order-incoming-before-accept.png` | Same order, viewed as the merchant, Accept/Reject controls visible. |
| 09 | `09-merchant-order-accepted.png` | After `Accept` — status `accepted`. |
| 10 | `10-customer-payment-requested.png` | A real (TEST/LOCAL) payment request in flight — non-empty `paymentId`. |
| 11 | `11-customer-order-paid.png` | After `Simulate Payment` — the **"PAID — confirmed by this device's local deterministic payment simulator, never by a bare customer/merchant claim."** banner, proving PAID is never a bare UI claim. |
| 12 | `12-merchant-order-fulfilling-delivery.png` | After `Mark Fulfilling` — Order `fulfilling` AND a real Delivery record (`Delivery status: fulfilling`), both real domain state, not UI-only. |
| 13 | `13-customer-order-delivered.png` | After `I Received This` — Order and Delivery both `delivered`, reachable ONLY via the buyer's own recipient-acknowledgment evidence. |
| 14 | `14-order-completed.png` | After `Complete Order` — status `completed`. |
| 15 | `15-signed-qr-receipt-valid.png` | After `Issue Signed Receipt` — a real signed `TradeReceiptProof`, QR-encoded, decoded, and independently re-verified: **`Verification status: VALID`**. |

Machine-specific paths and unrelated desktop content were never present
(each screenshot is a scroll-to-relevant-element capture of the app's own
content area only — no OS chrome, no other windows).

The identical flow is exercised automatically (not just visually) by
`packages/fedos-desktop-electron-spike/test/commerce_e2e_full_happy_path_real_electron.test.ts`,
which drives the same real packaged app end-to-end via the same
`AUTOTEST_MODE=ui-script` harness and asserts on every state transition
shown above.
