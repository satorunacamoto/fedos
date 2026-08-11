# FedOS Actor Map — Commerce End-to-End Audit

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65` ("GitHub OSS Presentation + Repository Operations Final Polish arc")
**Method:** code inspection only (no doc claims taken on faith). See [FEDOS-COMMERCE-END-TO-END.md](../commerce/FEDOS-COMMERCE-END-TO-END.md) for the full narrative this map supports.

> **Read this first:** FedOS at this commit is a shipping **1:1 end-to-end-encrypted messenger** (Nostr NIP-17 + a Double Ratchet session per conversation). A **Commerce domain** (`src/os/commerce/`) and a **Trust capability** (`src/os/trust/`) exist as real, tested, standalone TypeScript — but neither is invoked by the shipping Electron app's composition root, IPC layer, or renderer. Every "Customer" / "Merchant" actor below is therefore split into two rows where the distinction matters: the actor **as it exists in the running product** (a Messenger Account) and the actor **as it exists only in dormant domain-layer types** (a commerce `buyerPubkey` / `creatorPubkey`).

---

## Legend

- **LIVE** — reachable from the shipping Electron app (`packages/fedos-desktop-electron-spike`, `package:beta`/`release:beta` build).
- **DORMANT** — real code, real tests, but zero callers from any shipped entry point (confirmed by grep for `createCommerce`/`createTrust` outside `test/*` and doc files).

---

## 1. Customer (Messenger Account) — LIVE

| Field | Value |
|---|---|
| ROLE | The human operating one FedOS Desktop installation, identified by a Nostr keypair. In the shipping app this is simply "the user" — there is no separate "customer" persona or mode. |
| OWNS WHAT | Local encrypted conversation state, Device Trust records, master seed / unlock secret, local `StorageBackend` data. |
| TRUSTS WHAT | Its own Device Trust runtime (`src/desktop/runtime/fedos_device_trust_runtime.ts`) for verifying peer devices; the Nostr relay only as a transport (not as an authority); nothing about payment or product claims (no such surface exists). |
| CAN DO | Start/accept conversations, send/receive NIP-17-wrapped Double-Ratchet messages, manage device pairing, search/archive conversations, use Safety Center. |
| CANNOT DO | Browse a product catalog, place an order, pay a merchant, receive a QR/credential/receipt for a purchase — **none of these surfaces exist in the shipping renderer** (confirmed by Agent U: full enumeration of `fedos_electron_beta_page.html`'s six `app-screen-*` divs, none commerce-related; `window.fedosApp` bridge exposes only conversation/search/archive/device/identity-transition/deletion-request/safety-center/settings methods). |
| KEY MATERIAL OWNED | Nostr identity keypair, Double Ratchet session keys, Device Trust signing key. |
| NETWORK CONTACT | Nostr relay(s) for message transport only. |
| AUTHORITATIVE DATA | Its own local encrypted message store; nothing payment- or order-related (none exists). |

## 2. Customer (Commerce buyer) — DORMANT, type-level only

| Field | Value |
|---|---|
| ROLE | `buyerPubkey: string` — a bare string field referenced by `PurchaseGrant` (`src/os/commerce/catalog/types.ts:78-86`) and `PaymentRequest`/`PaymentDecision` (`src/os/commerce/payment/types.ts`). Not a class, not a session, not an authenticated principal within the commerce domain itself — just an id string a caller supplies. |
| OWNS WHAT | Nothing durable — no persistence layer exists under `src/os/commerce/` (`InMemoryProductDirectory` has no write method at all; `PlaceholderPaymentProvider`'s ledger is an in-memory `Map` that dies with the process). |
| TRUSTS WHAT | N/A — no verification of this identity happens anywhere in `src/os/commerce/`. |
| CAN DO | Have a `PurchaseGrant` constructed *about* it by a caller (`paymentDecisionToGrant()`, `commerce_bridge.ts:107-120`) — always sourced `"manual"` or `"promo"`, **never `"payment"`**, because the module documents it "never verifies a real payment" (`commerce_bridge.ts:12-14`). |
| CANNOT DO | Actually buy anything — `createCommerce()` (the domain's only composition root) is never called outside `test/*` (confirmed by Agent U's repo-wide grep). |
| KEY MATERIAL OWNED | None known to the commerce domain — `buyerPubkey` is an unauthenticated string, not a verified key. |
| NETWORK CONTACT | None — the entire commerce domain performs zero I/O (Agent C, §11). |
| AUTHORITATIVE DATA | None — nothing is persisted. |

## 3. Merchant (Commerce creator) — DORMANT, type-level only

| Field | Value |
|---|---|
| ROLE | `creatorPubkey: string` on `Product` (`catalog/types.ts:33-52`) — the party who "owns" a listing. Six adjacent files (`creator/entitlement.ts`, `membership.ts`, `profile.ts`, `reputation.ts`, `appeal.ts`, `subscription_policy.ts`) model creator-adjacent concepts, but are explicitly excluded from the commerce barrel (`index.ts:25-27`) and touched by nothing in the composition root. |
| OWNS WHAT | A `Product` object (in whatever in-memory array a caller constructs — no persistence). |
| TRUSTS WHAT | N/A — no signature or authentication check exists anywhere in `catalog/policy.ts`; `canEditProduct` (policy.ts:88-91) is a bare pubkey-string-equality check, not a cryptographic proof. |
| CAN DO | Be the subject of `productFromSpace()` (`catalog/bridge.ts:51-66`, builds a **draft** `Product` from a Stage-9 "Space") or `productFromEvent()` (`catalog/adapters/nostr/bridge.ts`). Neither publishes, persists, or notifies anyone. |
| CANNOT DO | List a product through any UI (none exists — Agent U confirmed zero merchant screens: no create/list/receive-order/accept/reject/cancel/fulfill affordance anywhere in the shipping app), receive an order, receive a payment notification, mark something delivered — none of these concepts exist (no `Order` type anywhere in the repo; `src/os/commerce/README.md:52-58` states this explicitly). |
| KEY MATERIAL OWNED | None known to the commerce domain (same caveat as buyer). |
| NETWORK CONTACT | None. |
| AUTHORITATIVE DATA | None persisted. |

## 4. FedOS Desktop (Electron shell) — LIVE

| Field | Value |
|---|---|
| ROLE | The packaged application. Real entry point at this commit: main `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`, preload `fedos_electron_beta_preload.cts`, renderer HTML `fedos_electron_beta_page.html` + `fedos_electron_beta_renderer.ts` — confirmed as what `package:beta`/`release:beta` actually package (Agent U). |
| OWNS WHAT | IPC channel registration (`fedos-profile:*`, `fedos-beta:*`, `fedos-acceptance:*`, `fedos-app:*` families only — no commerce-shaped channel exists), the composition root that assembles the Messenger runtime (`loadRootModules()`, `fedos_electron_beta_main.cts:487-565`, imports only `os/messenger/desktop/*` modules). |
| TRUSTS WHAT | Its own local Device Trust runtime and the Messenger domain's Double Ratchet session state. |
| CAN DO | Render conversations/search/archive/devices/safety-center/settings; nothing else. |
| CANNOT DO | Surface `os/commerce` or `os/trust` — neither is imported anywhere in `packages/fedos-desktop-electron-spike/src/**` (confirmed by grep, both directions). Several dev-only spike pages exist (`fedos_electron_spike_*`, `_badge_*`, `_navigation_*`, `_notifications_tray_*`, `_unlock_*`, `_settings_*`, `_host_adapter_*`) but none of them are commerce-related either and none ship via `package:beta`. |
| KEY MATERIAL OWNED | Delegates to the Messenger domain / OS keychain; the shell itself holds no independent key material. |
| NETWORK CONTACT | Nostr relay(s), via the Messenger domain only. |
| AUTHORITATIVE DATA | Local encrypted conversation/device state on disk. |

## 5. Commerce domain (`src/os/commerce/`) — DORMANT

| Field | Value |
|---|---|
| ROLE | A self-contained, well-typed, unit-tested TypeScript module modeling a Product catalog, a payment boundary, a marketplace-intent boundary, and creator-adjacent capabilities — carried forward from a pre-pivot prototype and explicitly marked, in every one of its files' own header comments, `STATUS: inert scaffolding, not reachable from the shipped Electron app.` |
| OWNS WHAT | Pure, in-process TypeScript types and functions only. Composition root `createCommerce()` (`create_commerce.ts:73-79`) wires exactly three ports, all defaulting to empty/noop: `catalog: InMemoryProductDirectory([])`, `payments: NoopPaymentProvider`, `marketplace: NoopMarketplaceProvider`. |
| TRUSTS WHAT | Nothing external — performs zero cryptographic verification, zero network I/O, zero persistence. |
| CAN DO | Answer pure queries (`listViewableProducts`, `canViewProduct`) and construct pure decision objects (`PaymentDecision`, `MarketplaceStatus`, `AccessDecision`) when a caller supplies data directly, in tests. |
| CANNOT DO | Reach a real payment rail (BTCPay adapter dir is reserved but empty — `payment/adapters/btcpay/README.md`), reach Trust, reach Messaging, reach any `StorageBackend`, or be constructed by anything in the shipped app (zero callers of `createCommerce()` outside `test/*`, confirmed by Agent U). |
| KEY MATERIAL OWNED | None. |
| NETWORK CONTACT | **Zero** — confirmed across all four research passes; no `fetch`/socket/SDK import anywhere under `src/os/commerce/`. |
| AUTHORITATIVE DATA | None — nothing here is a system of record. |

## 6. Trust capability (`src/os/trust/`) — DORMANT (relative to Commerce/Desktop), but real and independently reachable via a CLI

| Field | Value |
|---|---|
| ROLE | A real, tested (Agent P: README claims 80 tests at time of writing; `test:current` run for this audit shows the Trust test files passing as part of the 1902-test full run) cryptographic-envelope capability: SignedEnvelope, pseudonymous Credential, ProofOfPossession, CapabilityGrant, SubscriptionEntitlement, ContractArtifactProof, plus QR text-codec/rendering for any of the above. |
| OWNS WHAT | Envelope signing/verification logic, entitlement issuance/verification logic, QR encode/decode-to-text/render-to-image logic. |
| TRUSTS WHAT | Schnorr/secp256k1 signatures over its own envelope format; explicitly documents QR as "TRANSPORT, not a security primitive" (`os/trust/README.md:175-187`) — the envelope signature, not the QR encoding, is the trust boundary. |
| CAN DO | Issue and verify each of the six primitive types; encode a signed envelope to QR text (`fedos_trust_qr_text_codec.ts:75-81`) and render it to a PNG data-URL or terminal string (`fedos_trust_qr_image.ts:57-69`); decode QR text back to a structurally-validated (not yet cryptographically-verified) envelope object, requiring the caller to separately call `verifyFedosTrustEnvelopeV1()`. |
| CANNOT DO | Scan a QR image (no camera-decoding/`jsQR`-style code exists anywhere in the repo — "decoding" here means parsing a text string, not an image); be reached from `os/commerce` or the Electron shell (zero cross-imports in either direction, enforced by an automated test, `test/architecture_boundary_trust.test.ts:28-42`, which forbids any relative import from `os/trust` resolving into `os/commerce`/`os/messenger`/`os/desktop`/`os/device`/`os/nostr`). |
| KEY MATERIAL OWNED | Whatever signing key the caller supplies to issue an envelope/credential/entitlement — Trust itself does not manage key custody. |
| NETWORK CONTACT | None from the library itself. Its one live entry point is a standalone Node CLI, `scripts/fedos_trust_issuer_cli.mjs` (`npm run trust:issuer`), explicitly documented as not part of the Electron app. |
| AUTHORITATIVE DATA | Whatever the caller of the CLI persists externally — Trust itself has no store. |

## 7. Payment Provider (Placeholder / Noop) — DORMANT

| Field | Value |
|---|---|
| ROLE | `PaymentProvider` interface (`payment/types.ts`) with exactly two implementations, both in `payment/noop_payment.ts`: `NoopPaymentProvider` (always `unavailable`) and `PlaceholderPaymentProvider` (in-memory `Map` ledger, no I/O). `payment/adapters/btcpay/` contains only a README explaining no adapter code exists. |
| OWNS WHAT | An in-memory ledger that dies with the process (`PlaceholderPaymentProvider.#ledger`, `noop_payment.ts:191`). |
| TRUSTS WHAT | Nothing — `requestPayment()` accepts any caller-supplied amount/metadata that passes a local, non-cryptographic sensitive-substring filter; `ingestCallback()` accepts an unauthenticated `{paymentId, event: "settled"}` payload from any caller (Agent P, §2/§4). |
| CAN DO | Flip its own in-memory ledger entry to `"accepted_placeholder"` — explicitly documented as meaning only "passed the boundary's policy check," **never** "a payment was received/settled" (`payment/types.ts:22-24`). |
| CANNOT DO | Ever reach `"paid"` — that state does not exist in this codebase's `PaymentStatus` enum (`"unavailable"\|"pending"\|"accepted_placeholder"\|"rejected"\|"expired"\|"refunded"\|"error"`, `types.ts:57-64`) or anywhere else; contact any real rail (Lightning/BTCPay/Stripe are all `*_placeholder`-suffixed labels only, `types.ts:37-43`). |
| KEY MATERIAL OWNED | None. |
| NETWORK CONTACT | **Zero.** |
| AUTHORITATIVE DATA | Its own transient in-memory ledger — never treated as authoritative by anything downstream, because nothing downstream exists (no caller converts its output into anything a merchant would see). |

## 8. External Payment Rail (BTCPay / Lightning / Stripe / any real settlement system) — ABSENT

| Field | Value |
|---|---|
| ROLE | **Does not exist in this codebase.** `payment/adapters/btcpay/` is a reserved, empty directory containing only a README stating this fact (`payment/adapters/btcpay/README.md:1-25`). |
| OWNS WHAT | N/A |
| TRUSTS WHAT | N/A |
| CAN DO | N/A |
| CANNOT DO | Everything — no adapter code, no SDK dependency, no server integration exists. |
| KEY MATERIAL OWNED | N/A |
| NETWORK CONTACT | N/A |
| AUTHORITATIVE DATA | N/A |

## 9. Nostr Relay — LIVE (Messenger only)

| Field | Value |
|---|---|
| ROLE | Transport for NIP-17-wrapped Messenger events. |
| OWNS WHAT | Nothing FedOS-authoritative — pure relay/transport role. |
| TRUSTS WHAT | N/A (external, untrusted transport by design — the Double Ratchet layer is what provides confidentiality/integrity). |
| CAN DO | Carry ciphertext events between Messenger accounts. |
| CANNOT DO | Participate in commerce in any way — no commerce code touches the network at all (Agent C, §11; Agent P, §7). |
| KEY MATERIAL OWNED | N/A (external infrastructure). |
| NETWORK CONTACT | The relay endpoint(s) the Messenger domain is configured with. |
| AUTHORITATIVE DATA | N/A — not a system of record for FedOS. |

## 10. Local Storage (`StorageBackend`) — LIVE (Messenger only)

| Field | Value |
|---|---|
| ROLE | Real storage abstraction defined under `src/os/core/storage/`. |
| OWNS WHAT | Encrypted conversation/device state persisted by the Messenger domain. |
| TRUSTS WHAT | The OS filesystem / whatever concrete backend is configured. |
| CAN DO | Persist Messenger-domain data. |
| CANNOT DO | Persist anything from `os/commerce` — that domain never imports `StorageBackend` at all (Agent C, §11, confirmed both by direct read and by `create_commerce.ts`'s own grep-verified header comment that neither `messaging` nor `storage` is even accepted as a constructor parameter). |
| KEY MATERIAL OWNED | N/A (storage of already-encrypted data; encryption keys live with the Messenger/Trust domains). |
| NETWORK CONTACT | Local disk only. |
| AUTHORITATIVE DATA | The Messenger domain's own encrypted state — the only durable system of record in the shipped app. |

---

## Summary Table

| Actor | Live in shipped app? | Owns durable data? | Network contact | Authoritative for payment? |
|---|---|---|---|---|
| Customer (Messenger Account) | Yes | Yes (local encrypted state) | Nostr relay (messaging only) | N/A — no payment surface |
| Customer (Commerce buyer) | No (type-level only) | No | None | No |
| Merchant (Commerce creator) | No (type-level only) | No | None | No |
| FedOS Desktop shell | Yes | Via Messenger domain | Nostr relay (messaging only) | N/A |
| Commerce domain | No | No | None | No — never claims to be |
| Trust capability | Reachable only via a standalone CLI | Whatever caller persists externally | None from the library | No — not wired to payment |
| Payment Provider (stub) | No | No (in-memory, transient) | None | **No — explicitly never produces a "paid" state** |
| External payment rail | Does not exist | — | — | — |
| Nostr relay | Yes (external infra) | No | N/A | No |
| Local Storage | Yes | Yes (Messenger data only) | None | No |
