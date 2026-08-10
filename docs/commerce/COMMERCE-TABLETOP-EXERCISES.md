# Commerce Tabletop Exercises — Code-Grounded Simulation

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`. Fictional data only. See [ACTOR-MAP.md](../architecture/ACTOR-MAP.md) for actor definitions and [FEDOS-COMMERCE-END-TO-END.md](FEDOS-COMMERCE-END-TO-END.md) for the full narrative.

---

## Scenario 1 — Happy Path

**Alice** = Customer. **Bob** = Merchant. Item: a fictional "Digital art print" (`kind: "other"`, priceCents: 500, currency: "USD").

| Step | Actor | Action | Code/module | Input | Persistent state | Output | Network contact | Cryptographic proof | Failure mode |
|---|---|---|---|---|---|---|---|---|---|
| T0 product/listing | Bob | Create a listing | **STOP — GAP.** No UI/IPC path exists to create a `Product` in the running app (Agent U: zero create-product screen). The only construction path, `productFromSpace()`/`productFromEvent()` (`catalog/bridge.ts`), is a pure function reachable only from a test harness, never from Bob's real app. | — | None | — | — | — | Chain cannot start |
| T1 discovery | Alice | Look for the print | **STOP — GAP.** No product/catalog screen exists in the shipping app at all (Agent U: full 6-screen enumeration, none commerce-related). | — | — | — | — | — | Chain cannot start |
| T2 order | Alice | Place an order | **STOP — GAP.** No Order concept exists anywhere in the codebase (`src/os/commerce/README.md:52-58`). There is nothing to create. | — | — | — | — | — | No such action exists |
| T3 merchant receives | Bob | See the order | **STOP — GAP.** No merchant inbox UI exists (Agent U). Even hypothetically, there's no Order object to route to one. | — | — | — | — | — | No routing mechanism exists |
| T4 payment request | Alice | Pay | **STOP — GAP** at the UI level; if called directly in a test harness, `productToPaymentRequest()` (`payment/commerce_bridge.ts:69-87`) → `PlaceholderPaymentProvider.requestPayment()` (`noop_payment.ts:214-268`) would return `PaymentDecision{status:"accepted_placeholder"}` — a purely local policy check, contacting no rail. | `Product`, `buyerPubkey=Alice` | In-memory ledger entry (dies with process) | `accepted_placeholder` | **None** | **None — not a real payment** | Real rail integration is absent (`payment/adapters/btcpay/` is empty) |
| T5 payment | Alice | (settlement) | **N/A — no real settlement rail exists.** `accepted_placeholder` is explicitly documented to never mean money moved (`payment/types.ts:22-24`). | — | — | — | — | — | This step cannot occur for real |
| T6 payment confirmation | Bob | See confirmation | **STOP — GAP.** Even the placeholder "accepted" state is never routed to any merchant-facing surface — no notification mechanism exists. | — | — | — | — | — | No routing mechanism exists |
| T7 fulfillment | Bob | Deliver the print | **STOP — GAP.** `DigitalAsset` (the closest delivery-artifact type) has zero consumers repo-wide — dead code. | — | — | — | — | — | No delivery mechanism exists |
| T8 proof/QR/credential | System | Issue proof | **STOP — GAP.** Trust QR/entitlement primitives are real (`os/trust/`) but zero-imported by Commerce (enforced by `test/architecture_boundary_trust.test.ts`). | — | — | — | — | — | No wiring exists |
| T9 completed | — | — | **Scenario cannot complete.** | — | — | — | — | — | — |

### TABLETOP HAPPY PATH: BLOCKED

The scenario is blocked at **T0/T1** simultaneously (no way to list, no way to discover) and would remain blocked at every subsequent step even if T0/T1 were hypothetically bypassed by direct test-harness calls, because no Order/notification/delivery/proof mechanism exists anywhere in the codebase. This is not a narrow gap — it is the complete absence of a live commerce path.

---

## Scenario 2 — Failure Cases

| Case | Expected Policy | Actual Code Behavior | Verdict |
|---|---|---|---|
| **A.** Customer claims "I paid" but no authoritative payment evidence exists | An unverified claim must never be treated as settlement | No "paid" state exists at all in `PaymentStatus` (`payment/types.ts:57-64`). The closest state, `accepted_placeholder`, is explicitly documented as never meaning money moved. `ingestCallback()` (`noop_payment.ts:295-309`) accepts an **unauthenticated** `{paymentId, event:"settled"}` payload with no signature/HMAC check *inside this file* — but this function is unreachable from the shipped app, so the gap cannot currently be exploited by a real user. | **PASS in the shipped product** (unreachable), **GAP in the dormant code itself** (`ingestCallback` lacks the caller-verification the interface doc requires — would need closing before any live wiring) |
| **B.** Merchant claims an order is complete but delivery proof is absent | Merchant-claimed completion should not be treated as proof of delivery | No Order or Delivery concept exists at all — there is nothing to mark "complete" and no delivery-proof mechanism to be absent from a working flow. | **GAP** (the whole concept is absent, so the specific policy can't even be tested) |
| **C.** QR is tampered with | Tampered QR must fail verification | `decodeFedosTrustEnvelopeFromQrText()` (`os/trust/qr/fedos_trust_qr_text_codec.ts:145-187`) explicitly does **not** re-derive/check the signature on decode — the header states the caller MUST separately call `verifyFedosTrustEnvelopeV1()`. That verify function does real Schnorr signature verification and would correctly reject a tampered envelope. But **no commerce/purchase code path ever calls either function** — QR/Trust and Commerce have zero cross-imports. | **UNKNOWN as a commerce behavior** (Trust's own QR tamper-handling is sound when used correctly, per its README's test coverage, but it is never invoked from any commerce-shaped flow to evaluate against) |
| **D.** Credential/entitlement expired | Expired entitlement must not grant access | `verifyFedosTrustSubscriptionEntitlement()` (`os/trust/entitlement/fedos_trust_subscription_entitlement_verify.ts:65-115`) is real, tested code with expiry handling. Never invoked from Commerce. | **UNKNOWN as a commerce behavior** (same reasoning as C) |
| **E.** Payment confirmation arrives twice | Duplicate confirmation must not double-grant | `PlaceholderPaymentProvider.ingestCallback()` mutates `entry.status` directly with no idempotency guard visible in the traced code (Agent P did not find one). Moot in practice since nothing calls this from the shipped app. | **GAP in the dormant code** (no idempotency check found), **not currently reachable** |
| **F.** Message/order delivery duplicated | Duplicate delivery must be deduplicated | No Order/Delivery concept exists to be duplicated. | **GAP** (concept absent) |
| **G.** Customer offline | Should degrade gracefully; no commerce action should silently corrupt state | N/A for commerce (no commerce state exists to corrupt). For Messenger (the live system), offline handling is out of this audit's scope — not investigated here. | **N/A / out of scope** |
| **H.** Merchant offline | Same as above | N/A for commerce, same reasoning. | **N/A / out of scope** |
| **I.** Media URL/file missing or modified | A modified/missing media reference should fail integrity checks or degrade safely, never silently serve wrong content | `AssetMetadata.checksum` field exists (`asset_cache_types.ts`) but Agent M found no code that actually *compares* a fetched asset's bytes against this checksum anywhere in the traced files — `asset_preview.ts` explicitly never reads bytes at all (metadata-only). No live media-fetch path exists to test this against. | **GAP / UNKNOWN** (checksum field exists but no verification code was found exercising it; the whole subsystem is unreachable regardless) |
| **J.** Malicious product media payload | Malicious/oversized/wrong-MIME media must be rejected before rendering | No media bytes ever flow through any reachable code path (Agent M, Agent C both confirm `asset_preview.ts` is metadata-only by design). There is no rendering pipeline for product media to attack, because there is no product media rendering pipeline at all. | **PASS by absence** (nothing to attack because nothing renders media — not a designed defense, just an accidental consequence of the feature not existing) |

### FAILURE TABLETOP: 2 PASS / 5 GAP / 3 UNKNOWN / 2 N/A (out of scope)

- **PASS (2):** A (in the shipped product only, by unreachability), J (by absence, not by design)
- **GAP (5):** A (in the dormant code itself), B, E, F, I
- **UNKNOWN (3):** C, D, I (also counted as GAP — the checksum-verification question is genuinely both: the field exists, GAP; whether it's ever compared, UNKNOWN because no live path exists to observe)
- **N/A/out of scope (2):** G, H

---

## Scenario 3 — Media Tabletop

Per the audit (Agent M, [PRODUCT-SURFACE-AUDIT.md](PRODUCT-SURFACE-AUDIT.md)), **product media does not exist as a live capability** — only as dead/model-only fields in a dormant subsystem. Per the task brief's own instruction ("If media does not exist: document the missing flow, do not fake it"), this section documents the missing flow rather than simulating a working one:

| Step | Would require | Current status |
|---|---|---|
| Merchant adds product image | A create/edit-product UI with a file picker, an `AssetMetadata`-shaped write path, and a `Product.assetIds` writer | **ABSENT.** No UI; `InMemoryProductDirectory` has no write method at all |
| Customer views image | A product detail screen rendering `<img>` from a resolved `AssetMetadata`/bytes source | **ABSENT.** No product detail screen exists |
| Content changes | A re-fetch + checksum re-comparison on each view | **ABSENT.** No fetch path exists; `checksum` field exists but no comparison code was found |
| Hash mismatch | A rejection/warning UI state | **ABSENT** |
| Unsupported MIME | A rejection at ingest or render time | **ABSENT** — no MIME-gating code found near commerce (the only real MIME-adjacent concept, `FedosConversationPayloadStorage.mediaType`, is a closed vocabulary of exactly one value, `"application/octet-stream"`, and belongs to Messenger, not Commerce) |
| Very large video | A size-limit / streaming-chunking policy | **ABSENT** for commerce. `AssetKind = "video_segment"` hints at a chunking design intent but has zero consumers |
| Broken reference | A graceful "media unavailable" UI state | **ABSENT** |
| Offline view | Cached-bytes-first rendering | **ABSENT** — no cache implementation exists; `AssetCache` is an interface only, explicitly noting "MeshKV and R2 are NOT implemented" |

### MEDIA TABLETOP: BLOCKED (documented as missing, not simulated as working)

**MEDIA GAP: FULL** — model fragments exist (kind/MIME/size/checksum fields) but there is no UI, no fetch path, no integrity-check invocation, and no cache — the entire pipeline from "merchant attaches an image" to "customer sees it" is missing, not just one layer of it.
