# Signed QR / Credential Result — CONCEPTUAL — NOT CURRENT PRODUCT UI

```
+-----------------------------------------------------------+
|  Your entitlement                                            |
+-----------------------------------------------------------+
|   #########  #  ## #########                                |
|   #       #  ## #  #       #      Scan to prove you own      |
|   #  ###  #  #  ##  #  ###  #     this entitlement.          |
|   #  ###  #   ##    #  ###  #                                |
|   #  ###  #  # ##   #  ###  #     (illustrative QR pattern    |
|   #       #  ##  #  #       #      only — not generated       |
|   #########  # # # #########      from real data)            |
|                                                                |
|   Encodes: FedosSubscriptionEntitlement (signed)              |
+-----------------------------------------------------------+
```

This mockup shows what a **Trust-issued** QR *could* look like if Commerce and Trust were wired together — using primitives that genuinely exist today: `encodeFedosTrustEnvelopeToQrText()` / `renderFedosTrustQrTextToPngDataUrl()` (`src/os/trust/qr/`) can already turn a signed `FedosSubscriptionEntitlement` into a real, scannable QR. **What doesn't exist is the connection from a purchase to issuing that entitlement in the first place** — zero cross-imports exist between `os/commerce` and `os/trust` (enforced by `test/architecture_boundary_trust.test.ts`). See [../../architecture/PAYMENT-FLOW.md](../../architecture/PAYMENT-FLOW.md) §Trust↔Commerce Wiring Map in [../FEDOS-COMMERCE-END-TO-END.md](../FEDOS-COMMERCE-END-TO-END.md).
