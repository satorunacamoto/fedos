# Order Confirmation — CONCEPTUAL — NOT CURRENT PRODUCT UI

```
+-----------------------------------------------------------+
|  Order placed                                              |
+-----------------------------------------------------------+
|  Digital Art Print                            $5.00 USD    |
|  Order ID:    (no Order type exists to generate this)      |
|  Status:      pending payment                              |
|  Merchant:    npub1bob...                                  |
|                                                              |
|  [        Continue to payment        ]                     |
+-----------------------------------------------------------+
```

This entire screen is conceptual: there is no `Order` type anywhere in the codebase (`src/os/commerce/README.md:52-58`), so there is no Order ID, no persisted order state, and nothing for a merchant to be notified about. See [CUSTOMER-COMMERCE-FLOW.md](../../architecture/CUSTOMER-COMMERCE-FLOW.md).
