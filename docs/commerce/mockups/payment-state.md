# Payment State — CONCEPTUAL — NOT CURRENT PRODUCT UI

```
+-----------------------------------------------------------+
|  Payment                                                    |
+-----------------------------------------------------------+
|  Amount:      $5.00 USD                                     |
|  Status:      [ ] pending  [ ] paid*  [x] unavailable       |
|                              * "paid" does not exist as a   |
|                                state anywhere in the code    |
|                                                               |
|  No payment rail is configured. This request cannot be       |
|  completed. (NoopPaymentProvider — always returns            |
|  {status: "unavailable"})                                    |
+-----------------------------------------------------------+
```

Backed conceptually by `PaymentProvider.requestPayment()` (`src/os/commerce/payment/types.ts`). The real `PaymentStatus` enum (`payment/types.ts:57-64`) is `"unavailable"|"pending"|"accepted_placeholder"|"rejected"|"expired"|"refunded"|"error"` — note there is **no `"paid"` value**, which this mockup deliberately shows as a crossed-out/impossible option rather than pretending it exists. See [PAYMENT-FLOW.md](../../architecture/PAYMENT-FLOW.md).
