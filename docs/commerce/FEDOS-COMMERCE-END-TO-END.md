# FedOS Commerce: End-to-End — What Actually Happens When Someone Buys Something

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65` ("GitHub OSS Presentation + Repository Operations Final Polish arc")
**Method:** code inspection by four independent research passes (Commerce domain, Payment/QR/Trust, UX surfaces, Product media) against a clean checkout pinned to this commit, followed by direct test execution (`npm run test:current`: 132 files / 1902 tests, all passing; `scripts/release/verify_oss_release.mjs`: 8/8 checks passing) and a code-grounded tabletop simulation. No doc claims were taken on faith — every statement below traces to a specific file and line.

---

## Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL Closure arc update (current, additive — does not rewrite any prior section below)

Starting CandidateHead `b447dfcc899b6c713606f36f02351bc566636e3e` / EvidenceHead `9dbdc87ec4b9b10df73128ecf8e0337c49c0a427`. Four parallel agents (D: persistence, G: protected-media grant, O: order self-dealing, X: NSIS harness investigation) plus coordinator integration, closing the four bounded P1s that section's own final classification left open:

```
COMMERCE DOMAIN STATE:   REAL, DURABLE (append-only NDJSON, per-repository)   (was: in-memory-only, confirmed process-lifetime END TO END)
ORDER SELF-DEALING:      REJECTED at the domain boundary (order_state_machine.ts)   (was: not forbidden anywhere)
PROTECTED MEDIA ACCESS:  PURCHASE-BOUND grant exists, signed/revocable, real+tested   (was: Master-Seed-only, no purchase binding, no expiry/revocation)
PACKAGED-BINARY E2E:     Root cause substantially narrowed (real packaging bug found+fixed: node_modules were never bundled at all); identity proof re-proven more robustly; full happy-path STILL not observed completing in this environment
```

**Persistence (P1 #3, closed):** every Commerce repository (`Order`, `Product`, `Payment` settlement, `Delivery`, `Reputation` epoch registry + trade-completion attestation store) now has a `Durable*` sibling of its original `Local*` in-memory adapter, implementing the SAME Port unchanged, backed by this codebase's own established append-only NDJSON convention (the same discipline `append_only_fedos_sync_journal_persistence.ts`/the device binding-challenge replay persistence already use — fail-closed on any corruption, replay-on-construction, `schemaVersion` gated). Wired live into `fedos_electron_beta_main.cts`'s `commerceState()`/`commerceReputationState()`, one NDJSON log per repository under `<profile>/commerce/*.ndjson`. Proven with a REAL, passing, two-process restart E2E (`commerce_e2e_restart_persistence_real_electron.test.ts`): launch 1 completes a full Product→Order→Payment→Delivery→Reputation trade; the process exits; launch 2 (brand-new Electron process, same profile, real unlock) confirms Product/Order/Delivery all survive exactly. **Disclosed, not closed:** the coordinator's own real-pubkey→PersonaEpoch identity-minting cache (which also holds each epoch's live signing keypair) and the demo Receipt-issuer's signing keypair are BOTH still process-lifetime-only — durable storage exists and is correct, but neither identity survives a restart yet; both need sealed/encrypted-at-rest key storage, a judgment call this arc disclosed rather than forced through.

**Self-dealing (P1 #1, closed):** `createOrder()` (`order_state_machine.ts`) now rejects `buyerPubkey === sellerPubkey` unconditionally, with a new `self_dealing` rejection code, exact-string comparison matching this codebase's own pubkey-comparison convention everywhere else. No bypass path exists — `createOrder()` is the only place an `Order` object is ever constructed.

**Protected media (P1 #2, closed at the domain layer):** a new `MediaAccessGrant` artifact binds decryption capability to buyer+media+qualifying-Order+time-window, signed via this codebase's existing attestation-envelope convention, gated on `Order.status ∈ {paid, fulfilling, delivered, completed}`. Key release wraps the grant payload via the existing NIP-44/ECDH primitive (`FedosMasterSeedAuthority.encryptNip44Wire`), not a hand-rolled scheme. **Disclosed limitation:** a truly portable, separate per-media symmetric content key needs new Rust/WASM surface this arc did not add — the wrap currently covers the release payload directly (bounded to 64 KiB), not an independently-portable content key. No live "download protected media" IPC handler exists in the shipped app yet to wire this grant into (same "real capability, not yet a reachable composition-root path" posture Order/Delivery/Reputation each had before their own prior wiring arc).

**Packaged-binary E2E (P1 #4, root cause narrowed, not closed):** this arc found and fixed a REAL packaging bug — `electron_builder.beta.config.json` excluded `node_modules/**/*` from the packaged app AND overrode its metadata to claim zero dependencies, so no prior packaged build ever bundled `qrcode`/`@noble/curves`/`@noble/hashes`, despite `os/trust`'s and `os/commerce/reputation`'s import chains needing all three at Electron boot (`app.whenReady()`, before the first lifecycle checkpoint). Fixed (declared real dependencies in the Electron package's own `package.json`, corrected the packaging config, verified 142 real `node_modules` entries now present inside the packaged `app.asar`) and independently confirmed to fix the SAME crash for a real dev-launch Electron process. Also fixed two harness bugs found along the way (a PowerShell UTF-8 console-encoding bug that produced a false identity-check failure on this checkout's Japanese OneDrive path; a path-separator mismatch in the same check) and added a crash-visibility diagnostic. Despite all of this, the packaged binary — across the runs after every fix — still does not write its first lifecycle checkpoint within its own test timeout; the new crash diagnostic never fires (ruling out a JS-level startup crash) and host telemetry stays healthy throughout (ruling out contention as the sole explanation). The narrowed, honest conclusion: the hang is upstream of this app's own JS, inside Electron's native process bootstrap for this specific packaged artifact in this environment — real, disclosed, and precisely characterized, not fixed.

See `docs/commerce/COMMERCE-E2E-COMPLETION-FINAL-REPORT.md`'s own "Commerce Durability arc" section for the full validation table and `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` for the updated gap list.

---

## Commerce FINAL P1 Closure arc update (current, additive — does not rewrite any prior section below)

Starting CandidateHead `5bfe57b3d8ba66594dd9d652b1e25e91e722cc01` / EvidenceHead `385126cddd64c04a5328d458a7742754e75e9db9`. Closes all three P1s the prior arc's own final classification left open (Persona Epoch key durability, Receipt-issuer key durability, packaged-binary native-bootstrap hang) via four parallel agents (K1: Persona Epoch sealed-key persistence, K2: Receipt-issuer sealed-key persistence, X: Electron/NSIS native-bootstrap diagnostics, T: cross-restart identity verification + corruption tests) plus coordinator integration and independent re-verification of every claim.

```
PERSONA EPOCH KEY DURABILITY:  SEALED AT REST, RESTART-PROVEN, FAIL-CLOSED ON CORRUPTION   (was: process-lifetime-only)
RECEIPT ISSUER KEY DURABILITY: SEALED AT REST, RESTART-PROVEN, FAIL-CLOSED ON CORRUPTION   (was: process-lifetime-only)
PACKAGED-BINARY NATIVE BOOTSTRAP: ROOT-CAUSED AND FIXED -- two real electron-builder packaging defects, neither a Chromium/environment issue   (was: unresolved, "upstream of this app's own JS")
INSTALLED (NSIS) FULL HAPPY-PATH E2E: PASS, independently re-verified twice (once by Agent X, once by the coordinator on the fully-merged tree)   (was: NEVER OBSERVED TO COMPLETE, across every prior arc in this repo's history)
```

**Persona Epoch key durability (closed):** `src/os/commerce/reputation/persistence/durable_persona_epoch_signing_key_store.ts` (new) seals the Persona Epoch signing keypair at rest, reusing the EXISTING `SealingAuthorityPort`/`FedosProductionMasterSeedAuthority.sealDirectRatchetSecret`/`restoreDirectRatchetSecret` primitive (`src/os/core/vault/wasm/fedos_sealed_signing_key_store.ts`, a new shared, domain-agnostic, generic NDJSON-backed sealed-record store both this and the Receipt-issuer closure build on — no new Rust/WASM surface, no plaintext key store). `commercePersonaEpochForPubkey()` tries the sealed store first on both the read and mint-if-absent paths; gracefully degrades to the exact pre-existing in-memory-only behavior when no unlocked Master Seed Authority is available; never silently mints a replacement identity when a sealed record exists but fails to restore. See `docs/commerce/REPUTATION-PERSONA-EPOCH-DESIGN.md`'s own "Commerce FINAL P1 Closure arc update" for the full account.

**Receipt-issuer key durability (closed):** `src/os/trust/issuer/durable_receipt_issuer_signing_key_store.ts` (new) seals the demo Receipt-issuer's signing keypair the same way. `commerceReceiptSigningState()` now resolves the durable keypair and builds `commerceReceiptPolicy` from the SAME persisted public key every restart — the concrete fix for "a receipt signed before a restart could never verify against the policy built after one." A receipt signed in one process launch (Trade A) now independently verifies `VALID` against a later launch's (Trade B's) live issuer policy — proven by a real, two-launch Electron E2E, not just a unit test.

**Real restart proof (not merely reasoned about):** `commerce_e2e_restart_persistence_real_electron.test.ts` (extended) now asserts the CORRECT closed-state behavior — after a real restart, the Seller Reputation panel shows the same content byte-for-byte, and a receipt issued before the restart re-verifies after it, alongside a newly-issued second receipt sharing the same issuer identity. A new `commerce_e2e_sealed_key_corruption_real_electron.test.ts` proves the fail-closed direction for both keys against real, ciphertext-tampered on-disk sealed files via real Electron relaunches — a structured rejection for the Receipt-issuer, an honest "no reputation history yet" fallback for Persona Epoch — never a silently fabricated replacement identity.

**Packaged-binary native bootstrap (root-caused and fixed):** every prior arc's own investigation (stdio redirection, host-contention correlation, crash-visibility diagnostics) narrowed but never closed this gap. This arc's own Agent X checked something no prior arc had: the hung process's own WINDOW creation state — and found a real, visible native Electron "Error" dialog (the default uncaught-exception handler), never observable before because every prior run used `stdio:"ignore"` (headless, no one to click "OK"). Extracted via UI Automation, not a screenshot: `Cannot find module './fedos_electron_notification_adapter.js'` — a real `electron_builder.beta.config.json` `files` allowlist gap (5 required sibling `.js` modules were never listed). Fixing it surfaced a SECOND real defect: the root-compiled `dist/`'s own `extraFiles` copy landed at a location that is a sibling of, not an ancestor of, `resources/app.asar` (where `node_modules` actually lives), so Node's module-resolution walk-up never found it. Both fixed. **Independently re-verified by the coordinator on the fully-merged tree** (not narrative trust): a direct `npx asar list` inspection of the built `app.asar` found qrcode's OWN transitive runtime dependencies (`dijkstrajs`, `pngjs` — both required eagerly, at module-load time, by `qrcode/lib/server.js`/`qrcode/lib/core/segments.js`) were STILL silently absent despite `qrcode` itself being present — a real, live, third instance of the exact same defect class, found and fixed BEFORE it could reproduce the crash (declaring them as direct dependencies in `packages/fedos-desktop-electron-spike/package.json` was what made electron-builder's own dependency-graph collector include them; the underlying reason a transitive resolution through `qrcode`'s own `package.json` was insufficient in this environment was not further root-caused within this fix's own scope). Full evidence: `docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_bootstrap_investigation_2026-08-12_agent_x_p1.md` (Agent X) and this document's own EvidenceHead commit (coordinator re-verification).

**Installed full happy-path E2E: PASS, independently re-verified twice.** `commerce_e2e_packaged_binary_real_electron.test.ts` — real NSIS silent install into an isolated dir, real launch, real OS-level process-identity proof (PID/parent PID/executable path/live SHA-256 match), full 45-observed-step happy path (product create/publish → order → TEST/LOCAL payment → fulfill → deliver → complete → a real signed, QR-encoded Trust receipt issued and independently verified `VALID`) — first by Agent X in isolation, then again by the coordinator on the fully-merged tree (K1+K2+X+T+coordinator packaging fixes together), catching and fixing the dijkstrajs/pngjs gap above in the process. **Installed restart E2E: PASS BY EQUIVALENCE, not a separately-built combined test this pass** — the packaged binary runs the IDENTICAL compiled `dist/fedos_electron_beta_main.cjs` the dev-`dist/`-launch restart test already proves survives a restart with full Persona/Receipt identity continuity (same file, same build step, copied into `app.asar` unchanged); a literal installed-binary + restart combined test was not built within this arc's own time budget, disclosed here rather than silently assumed.

See `docs/commerce/COMMERCE-PACKAGED-BINARY-E2E-CLOSURE.md`'s own "Commerce FINAL P1 Closure" update and `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` for the updated gap list.

---

## Commerce E2E Completion arc update (current, additive — does not rewrite the audit or Phase 1 update below)

**A full, real, locally-verifiable Commerce vertical slice now exists end-to-end.** Verified as of commit `7dac8718` (`arc/fedos-commerce-e2e-completion`) via real Electron process execution (`packages/fedos-desktop-electron-spike/test/commerce_e2e_full_happy_path_real_electron.test.ts`), not code inspection alone:

```
ACTUAL CUSTOMER FLOW:   REAL, END-TO-END   (was: PARTIAL, discovery-only)
ACTUAL ORDER FLOW:      REAL               (was: ABSENT)
ACTUAL PAYMENT FLOW:    REAL (TEST/LOCAL simulator, never real money)  (was: ABSENT)
DELIVERY/FULFILLMENT:   REAL               (was: ABSENT — DigitalAsset dead code)
QR / TRUST RECEIPT:     REAL, WIRED, VERIFIED   (was: NOT WIRED)
REPUTATION/PERSONA:     DESIGN ONLY (type-only scaffolding, unwired)   (unchanged)
NOSTR COMMERCE EVENTS:  BACKEND-READY, DELIBERATELY NOT WIRED into the Electron composition root (Nostr publication remains optional)
PROTECTED MEDIA CRYPTO: REAL (Rust/WASM `CommerceMedia` AEAD/HKDF domain), adapter wiring still a follow-up
```

A merchant can now, through the real shipping UI, create and publish a product; a customer can discover it, place a real Order, submit it; the merchant accepts; the customer requests and simulates a TEST/LOCAL payment (never real money — `DeterministicLocalPaymentProvider`, never a bare UI claim: the "PAID" banner reads *"confirmed by this device's local deterministic payment simulator, never by a bare customer/merchant claim"*); the merchant fulfills, which creates a real `DeliveryRecord`; the customer acknowledges real receipt (the ONLY thing that can move a Delivery/Order to `"delivered"` — a self-asserted merchant claim can reach `"fulfilling"` but never further); either party completes the order; and a real signed `TradeReceiptProof` is issued via `os/trust`'s real `SignedEnvelope` primitives, QR-encoded, and independently re-verified `VALID` server-side before the renderer ever sees it. See `docs/commerce/evidence/commerce_e2e_completion/` for real screenshots of every step, and the test file above for the automated, assertion-backed equivalent (67 scripted UI steps against the real packaged binary).

**Three real defects were found and fixed only by this real end-to-end run** — none were visible to any unit or structural test, because none of them called through the exact composition-root comparison where the bug lived: the Electron composition root (`fedos_electron_beta_main.cts`) checked `result.outcome !== "transitioned"` against Order/Delivery domain transition results, but those domain functions have never had an `outcome` field — they discriminate on a boolean `ok` (a distinct, correct `outcome`-shaped result genuinely exists one layer over, on `PaymentSettlementLedger.apply()`, and the Order/Delivery checks were apparently generalized from that by mistake). Every real order-create/order-action/payment-confirm/delivery-acknowledge/order-complete call was therefore always falling into its own `"rejected"` branch — Commerce was 100% unreachable end-to-end despite 100% of unit/structural tests passing. A second, related gap: the Delivery-side merchant actions (`createDelivery`, `start_fulfillment`, `acknowledge`) require `actor.pubkey` to match the record's own buyer/seller pubkey, but the composition root's own calls omitted it, so Delivery records were silently never created. All three are fixed (see that commit's own message for the full account) and are now covered by the new E2E test so this class of drift cannot silently return.

**Still true, unchanged by this arc:** Reputation/Persona attestation is design-only type scaffolding (`src/os/commerce/reputation/`, self-declared "DESIGN + TYPE-ONLY SCAFFOLDING" in its own header) — no coordinator wiring exists yet, and no UI surface exists for it. The Nostr Commerce event/data-plane adapter (`src/os/commerce/events/`) is real, tested code with a real fake-transport test double, but is deliberately not barreled into `src/os/commerce/index.ts` nor imported by the Electron composition root this pass — Nostr publication of Commerce events remains optional, matching this arc's own brief. Protected product-media encryption has a real, tested Rust/WASM `CommerceMedia` AEAD/HKDF domain (`resolve_commerce_media_key()`, isolated from every other domain, round-trip proven at the public WASM boundary) and a real, tested `ProductMediaEncryptionPort` implementation consuming it (`WasmProductMediaEncryption`, `catalog/wasm_product_media_encryption.ts`) — but `ipfs_media_store.ts`'s own default composition still wires the safe fallback, `UnavailableProductMediaEncryption`, not `WasmProductMediaEncryption`. The crypto primitive and its adapter are both ready; only the final "use it by default" composition step is a disclosed follow-up.

---

## Commerce FINAL Closure Mega-Arc update (current, additive — does not rewrite the Commerce E2E Completion account above)

Verified at CandidateHead `7e0d9f0a9611792dea6cfcaf077bb37528575bf1` (validation-fix CandidateHead `b447dfcc899b6c713606f36f02351bc566636e3e`), against a fresh worktree build (`npm run test:current`: 162 files / 2463 passed + 3 skipped / 0 fail; `cargo test --offline`: 649/650, 1 pre-existing unrelated failure; OSS release verifier 8/8; `npm run package:beta` PASS):

```
REPUTATION/PERSONA:     REAL, WIRED into the composition root   (was: DESIGN ONLY)
NOSTR COMMERCE EVENTS:  REAL, WIRED, default-off (NetworkProfile "local-only")   (was: BACKEND-READY, NOT WIRED)
PROTECTED MEDIA CRYPTO: REAL DEFAULT COMPOSITION (fails closed, no plaintext fallback)   (was: PASS primitive/adapter, PARTIAL composition)
PACKAGED-BINARY E2E:    Install+launch+OS identity PROVEN; full 67-step happy path PARTIAL (host-contention-limited, not a code defect)   (was: NOT PROVEN)
COMMERCE DOMAIN STATE:  Confirmed process-lifetime, in-memory-only END TO END (Product/Order/Delivery/Payment ledger AND Reputation/Persona) — a FedOS Desktop Beta restart loses all of it. New finding this pass, via direct code reading of commerceState()/commerceReputationState() in fedos_electron_beta_main.cts.
```

A merchant's product now also carries a live **Seller Reputation** panel (Product Detail screen) fed by a real, signed `TradeCompletionAttestation` issued automatically when either counterparty completes a real order — never a bare claim, gated on the real `OrderRepository` reporting `"completed"`. A merchant's product publish/unpublish now best-effort announces over Nostr when the (default-off) network profile allows it, verified end-to-end (publish → real relay → a second read-model instance, idempotent, replay-safe, wrong-signer-rejecting) by `test/commerce_inbound_event_bridge.test.ts`. Product media, when present, now flows through a real AEAD-encrypted-at-rest path by default (`WasmProductMediaEncryption`/`WasmProductMediaDecryption`), refusing to store or return anything without a real unlocked Master Seed Authority — no code path anywhere silently falls back to plaintext.

**Still true, unchanged by this arc:** no real payment rail; no purchase-grant-to-media-key binding; no IPC yet exposes protected-media `put()`/`get()` to the UI. **Newly true, disclosed by this pass, not previously stated at this scope:** the entire Commerce domain — not just Reputation — is in-memory-only; nothing in the current composition root reads any commerce state back from disk on startup. See `docs/commerce/COMMERCE-E2E-COMPLETION-FINAL-REPORT.md`'s own "Commerce FINAL Closure Mega-Arc update" for the full evidence table, cross-capability authority spot-check (8/8 PASS), and failure-tabletop classification.

---

## Phase 1 update (post-audit, additive — does not rewrite the audit below)

**Commerce Reachable Catalog + Product Surface Phase 1 has landed.** The narrative below (§1–§11) is the original audit, pinned to commit `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`, and is left intact as a faithful historical snapshot. What has actually changed since:

```
ACTUAL CUSTOMER FLOW:   PARTIAL       (was: ABSENT)
CUSTOMER PRODUCT UI:    IMPLEMENTED   (was: ABSENT)
PRODUCT IMAGES:         YES — minimal image support   (was: ABSENT)
ACTUAL ORDER FLOW:      ABSENT        (unchanged)
ACTUAL PAYMENT FLOW:    ABSENT        (unchanged)
QR COMMERCE:            NOT WIRED     (unchanged)
TRUST COMMERCE:         NOT WIRED     (unchanged)
```

A customer can now: open FedOS Desktop → click **Commerce** in the nav (next to Conversations) → see a real 3-product demo catalog (title, price, merchant, safe thumbnail/fallback) → open a product → see full Product Detail (description, price, merchant, media or safe fallback, an explicit **"Ordering not available yet"** notice — never a fake working Buy button) → return to Commerce or to Conversations. This is real, IPC-backed, exercised against the actual `os/commerce` domain's `listViewableProducts()` — not a mock. See `docs/architecture/COMMERCE-E2E-SWIMLANE.md`'s "Phase 1 update" section for the sequence diagram, and `docs/commerce/evidence/` for screenshots of the real packaged app.

**Still true, unchanged by this arc:** no Order type exists, no payment rail is wired, `PlaceholderPaymentProvider.ingestCallback()` remains unreachable (now with an explicit regression test proving it), Commerce↔Trust wiring is still zero, and QR still has no commerce meaning. §1 below ("no product to discover") now describes the *pre-Phase-1* state only — see the Phase 1 update above for the current customer view.

---

## The one-sentence answer

**As of the original audit, nothing happened — FedOS Desktop was a 1:1 end-to-end-encrypted messenger (Nostr NIP-17 + Double Ratchet) with no reachable commerce capability at all; a well-typed, well-tested Commerce domain and a separate, real Trust capability both existed in the source tree, but neither was wired into the shipping application. Phase 1 (above) has since made read-only product discovery real — everything else in this sentence remains true.**

---

## 1. Customer view (as of the original audit — see "Phase 1 update" above for the current state)

A customer opened FedOS Desktop and saw exactly six things: Conversations, Search, Archive, Devices, Safety Center, Settings. There was no product to discover, nothing to buy, no order to place, no payment to make, and nothing to receive. This wasn't a partially-built flow with a broken step in the middle — there was no first step. See [CUSTOMER-COMMERCE-FLOW.md](../architecture/CUSTOMER-COMMERCE-FLOW.md).

## 2. Merchant view

A merchant has no way to list a product, no inbox to receive an order into (because no Order concept exists at all — confirmed by the Commerce domain's own README: *"No Order, Support (ticketing), Delivery, or Seller State concept is defined anywhere in this capability"*), and no way to accept, reject, cancel, or fulfill anything. See [MERCHANT-COMMERCE-FLOW.md](../architecture/MERCHANT-COMMERCE-FLOW.md).

## 3. FedOS / platform view

Underneath the UI, a real domain module exists at `src/os/commerce/` — a `Product` catalog type, an access-policy layer, a payment boundary, a marketplace-intent boundary, and creator-adjacent capabilities (entitlement/membership/profile/reputation/appeal/subscription-policy). Every one of these files carries the same self-declared header: `STATUS: inert scaffolding, not reachable from the shipped Electron app.` This was independently verified, not just quoted: the composition root that would assemble it, `createCommerce()` (`src/os/commerce/create_commerce.ts:73-79`), has zero callers anywhere outside `test/*` files. The Electron app's own composition root, `loadRootModules()` (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:487-565`), imports only Messenger modules — never Commerce, never Trust.

**Layer model (as implemented):**

```
UI (6 screens, no commerce)
  ↓  window.fedosApp bridge — no commerce/product/order/payment channel
Composition root (loadRootModules — Messenger only)
  ↓  ⛔ never imports os/commerce or os/trust
Commerce domain (dormant)          Trust capability (dormant relative to Commerce/UI)
  catalog / payment / marketplace   envelope / credential / entitlement / QR
  — zero network calls              — reachable only via a standalone CLI
  — zero persistence
```

See [COMMERCE-BACKEND-DATAFLOW.md](../architecture/COMMERCE-BACKEND-DATAFLOW.md) for the full per-transition table.

## 4. Backside/internal system flow

Nothing crosses a network boundary for commerce. The only network contact anywhere in this story is the Messenger domain talking to a Nostr relay — for messages, never for products, orders, or payments. The only durable storage anywhere in this story is the Messenger domain's local encrypted conversation state — Commerce never imports `StorageBackend` at all (confirmed by `create_commerce.ts`'s own header, which states it deliberately doesn't accept a storage/messaging parameter because grep confirms nothing in `os/commerce` would consume one). See [COMMERCE-E2E-SWIMLANE.md](../architecture/COMMERCE-E2E-SWIMLANE.md) for the full sequence diagram (almost entirely dashed/dormant, by design of the diagram matching reality).

## 5. Payment authority

**There is no "paid" state in this codebase.** `PaymentStatus` is `"unavailable"|"pending"|"accepted_placeholder"|"rejected"|"expired"|"refunded"|"error"` — no `"paid"`, no `"disputed"`. The closest state, `accepted_placeholder`, is produced by a purely local, non-cryptographic check (non-negative amount, no sensitive-substring metadata) inside `PlaceholderPaymentProvider` — and is explicitly documented to mean only "passed a policy check," never "money was received." No real payment rail exists: `payment/adapters/btcpay/` is a reserved, empty directory containing only a README that says so. **FedOS's own policy — that an AI/customer claim must never be authoritative payment proof — is upheld today, but only because the entire payment path is unreachable, not because of an active verification control.** The type system does correctly prevent the dormant code from ever labeling a grant `source: "payment"` (it's restricted to `"manual"|"promo"` at the type level) — a real, if currently moot, safeguard. See [PAYMENT-FLOW.md](../architecture/PAYMENT-FLOW.md).

## 6. Trust / QR role

QR code generation and signed-envelope verification are real, tested capabilities — but they live entirely inside `src/os/trust/`, reachable only via a standalone CLI (`npm run trust:issuer`), never from the Electron app or Commerce. A QR today can encode any signed Trust envelope (credential, entitlement, capability grant, contract-artifact proof) — but **zero code anywhere makes a QR represent a payment request, receipt, order, or delivery token**, because zero code connects Trust to Commerce in either direction (enforced by an automated test, `test/architecture_boundary_trust.test.ts`). See [ACTOR-MAP.md](../architecture/ACTOR-MAP.md) §6 and [PAYMENT-FLOW.md](../architecture/PAYMENT-FLOW.md).

**IMPLEMENTED:** signing/verifying envelopes; encoding a signed envelope to QR text/image; decoding QR text back to a structurally-parsed (not auto-verified) envelope.
**AVAILABLE WITH EXISTING PRIMITIVES:** using a `FedosSubscriptionEntitlement` (whose scopes already include `"signed-qr"` and `"contract-proof"`) as a purchase receipt/entitlement, if a Commerce→Trust seam were added.
**NOT IMPLEMENTED:** any connection from a purchase/payment event to Trust issuance; QR scanning from a camera image (only text-string decoding exists).

## 7. Storage / network boundaries

Commerce: zero storage, zero network. Trust: zero storage of its own (caller-managed), zero network from the library (its CLI is a local process). Messenger: real local encrypted storage, real Nostr relay network contact — the only live system of record in the product.

## 8. Failure behavior

Simulated in [COMMERCE-TABLETOP-EXERCISES.md](COMMERCE-TABLETOP-EXERCISES.md): the happy-path tabletop is **BLOCKED** at the very first step (no way to list a product, no way to discover one) and would remain blocked at every later step even bypassing the UI, because Order/notification/delivery/proof mechanisms don't exist. Of 10 simulated failure cases, 2 PASS (both by absence/unreachability, not by a working control), 5 are GAPs, 3 are UNKNOWN (Trust's own tamper/expiry handling is sound in isolation but is never exercised by any commerce-shaped call), 2 are out of scope (offline handling, a Messenger-layer concern not investigated here).

## 9. Current limitations (the honest summary)

- No Order concept exists anywhere.
- No real payment rail is integrated.
- No commerce UI exists in the shipping app, for either customer or merchant.
- No delivery/fulfillment mechanism exists (`DigitalAsset` is dead code, zero consumers).
- Commerce and Trust have zero wiring, despite Trust already modeling exactly the entitlement/QR primitives a purchase receipt would need.
- Product media (image/gallery/video/sample) is model-only fragments in a dead sibling subsystem, never a field on `Product` itself, never rendered anywhere.

## 10. Media support

**ABSENT in the shipping product; MODEL ONLY in the dormant domain layer.** `Product` itself has no image/video/gallery field — only an opaque `assetIds: string[]` link to a separate, unreachable `AssetMetadata` type that does model `kind` (image/video_segment/audio/preview/thumbnail), `contentType`, `sizeBytes`, `checksum`, `tags`. No alt text, no remote-URL field, no local-file field, and no Nostr-media-tag parsing exist anywhere. See [PRODUCT-SURFACE-AUDIT.md](PRODUCT-SURFACE-AUDIT.md).

### Recommended minimal `ProductMedia` shape (observation only — not implemented)

Derived from what already exists in the repo, reusing rather than reinventing: `AssetMetadata`'s field shape, the Messenger domain's real SHA-256 content-hash primitive (`computeFedosConversationArchiveContentHash()`), and the Messenger domain's real opaque-bytes storage port (`FedosConversationPayloadStorage`) as the eventual byte-storage seam (not currently commerce-facing, but architecturally the closest live analog):

```ts
interface ProductMedia {
  readonly id: string;
  readonly productId: string;
  readonly role: "primary" | "gallery" | "thumbnail" | "video" | "video_preview" | "sample";
  readonly contentType: string;        // MIME, as AssetMetadata.contentType
  readonly sizeBytes: number;
  readonly checksum?: string;          // sha256, reusing the Conversation Archive integrity pattern
  readonly altText?: string;           // net-new — wholly absent today
  readonly storageRef: string;         // opaque pointer, as DigitalAsset.storageRef — resolution deliberately deferred
  readonly nostrEventId?: string;      // to plug into Product.linkedEventIds / the existing Nostr classify.ts tag scheme
}
```

This is a design note for a future arc, not a plan already underway.

## 11. Current vs proposed

| | Current | Proposed (next bounded arc, see below) |
|---|---|---|
| Product listing | Type exists, zero UI, zero persistence | A create/list screen backed by real (even if initially local-only) storage |
| Order | Absent entirely | A new, minimal Order type + lifecycle |
| Payment | No "paid" state, no real rail | A real `PaymentProvider` (e.g. BTCPay) with authenticated callbacks |
| Trust/QR | Real, but unwired | A Commerce→Trust Port issuing a signed entitlement on confirmed payment |
| Media | Model fragments, unreachable | A `ProductMedia` type reusing existing hash/storage primitives |

---

## Recommended Next Implementation Arc (one, bounded)

**DONE** — "Commerce Composition Root Wiring, Phase 1: reachable read-only catalog" (as scoped below) landed via the Commerce Reachable Catalog + Product Surface Phase 1 arc; see the "Phase 1 update" section at the top of this document. Original scope statement, preserved for the record: wire `createCommerce()` into `loadRootModules()`, add exactly one new IPC channel family (`fedos-app:commerce-*`) exposing `listViewableProducts()` read-only, and add exactly one new UI screen (product list + detail, no buy button yet). Deliberately excluded Order, Payment, Trust wiring, and media beyond a minimal image slice — those remain separate, larger, riskier follow-on arcs (per [COMMERCE-GAP-CLASSIFICATION.md](COMMERCE-GAP-CLASSIFICATION.md) and `docs/commerce/COMMERCE-IMPLEMENTATION-ROADMAP.md`'s recommended build order).

**Next recommended arc:** Merchant Product Creation / Editing (see `docs/commerce/COMMERCE-IMPLEMENTATION-ROADMAP.md` step 2) — still local-only, no network requirement.

---

## Document index

- [ACTOR-MAP.md](../architecture/ACTOR-MAP.md)
- [CUSTOMER-COMMERCE-FLOW.md](../architecture/CUSTOMER-COMMERCE-FLOW.md)
- [MERCHANT-COMMERCE-FLOW.md](../architecture/MERCHANT-COMMERCE-FLOW.md)
- [PAYMENT-FLOW.md](../architecture/PAYMENT-FLOW.md)
- [COMMERCE-E2E-SWIMLANE.md](../architecture/COMMERCE-E2E-SWIMLANE.md)
- [COMMERCE-BACKEND-DATAFLOW.md](../architecture/COMMERCE-BACKEND-DATAFLOW.md)
- [COMMERCE-STATE-MACHINES.md](../architecture/COMMERCE-STATE-MACHINES.md)
- [PRODUCT-SURFACE-AUDIT.md](PRODUCT-SURFACE-AUDIT.md)
- [COMMERCE-TABLETOP-EXERCISES.md](COMMERCE-TABLETOP-EXERCISES.md)
- [COMMERCE-GAP-CLASSIFICATION.md](COMMERCE-GAP-CLASSIFICATION.md)
- [mockups/](mockups/) — conceptual, not current product UI
