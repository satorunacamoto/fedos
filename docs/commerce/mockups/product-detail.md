# Product Detail — CONCEPTUAL — NOT CURRENT PRODUCT UI

```
+-----------------------------------------------------------+
|  < Back                                                    |
+-----------------------------------------------------------+
|  +-------------------+                                     |
|  |                   |   Digital Art Print                 |
|  |   [primary image] |   by npub1bob... (merchant)          |
|  |                   |   $5.00 USD                          |
|  +-------------------+   Status: active | In stock          |
|  [thumb][thumb][thumb]                                      |
|  (gallery, not implemented today)                           |
|                                                              |
|  A hand-drawn digital art print, delivered as a PDF.        |
|                                                              |
|  [        Buy for $5.00        ]                            |
+-----------------------------------------------------------+
```

Every field shown here maps to a real `Product` field (`src/os/commerce/catalog/types.ts:33-52`) except: gallery/thumbnail images (MODEL ONLY, dead subsystem), "In stock" (ABSENT — no inventory field exists on `Product` at all). The "Buy" button has no reachable target today — no Order concept exists. See [PRODUCT-SURFACE-AUDIT.md](../PRODUCT-SURFACE-AUDIT.md).
