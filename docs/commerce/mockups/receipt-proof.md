# Receipt / Proof of Purchase — CONCEPTUAL — NOT CURRENT PRODUCT UI

```
+-----------------------------------------------------------+
|  Receipt                                                    |
+-----------------------------------------------------------+
|  Digital Art Print                            $5.00 USD    |
|  Grant source:  manual   (never "payment" — see note)       |
|  Granted at:    2026-08-11T00:00:00Z                        |
|  Signed by:     (no signature — PurchaseGrant is a plain    |
|                  unsigned object today)                     |
+-----------------------------------------------------------+
```

The closest real artifact to a "receipt" today is `PurchaseGrant` (`src/os/commerce/catalog/types.ts:78-86`) — an unsigned plain object with `productId`, `buyerPubkey`, `grantedAt`, `source`, `revokedAt?`. It is never persisted or shown to anyone in the shipping app, and `source` can never be `"payment"` by construction (`payment/commerce_bridge.ts:90,94`). A real receipt would need to be a Trust-signed artifact (`os/trust/` has the primitives) — but zero wiring exists between Commerce and Trust today. See [PAYMENT-FLOW.md](../../architecture/PAYMENT-FLOW.md) and [../../architecture/ACTOR-MAP.md](../../architecture/ACTOR-MAP.md) (Trust capability).
