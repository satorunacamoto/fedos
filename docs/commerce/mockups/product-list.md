# Product List — CONCEPTUAL — NOT CURRENT PRODUCT UI

```
+-----------------------------------------------------------+
|  FedOS — Marketplace (CONCEPTUAL)                    [x]  |
+-----------------------------------------------------------+
|  [Conversations] [Search] [Archive] [Devices] [Marketplace*]
|                                          * does not exist   |
+-----------------------------------------------------------+
|  +-----------+  Digital Art Print                          |
|  | [image]   |  by npub1bob...                              |
|  | 96x96 px  |  $5.00 USD          [ View ]                 |
|  +-----------+                                              |
|                                                              |
|  +-----------+  Handmade Ceramic Mug                        |
|  | [image]   |  by npub1carol...                            |
|  | 96x96 px  |  $18.00 USD         [ View ]                 |
|  +-----------+                                              |
+-----------------------------------------------------------+
```

Backed conceptually by `listViewableProducts()` (`src/os/commerce/catalog/directory.ts:60-68`) — a real, tested, pure function today, but with no UI or IPC channel that calls it. See [PRODUCT-SURFACE-AUDIT.md](../PRODUCT-SURFACE-AUDIT.md).
