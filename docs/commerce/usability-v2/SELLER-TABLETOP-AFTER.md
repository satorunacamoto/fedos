# FedOS Commerce Usability — Seller Tabletop (AFTER), "Bob's Tabletop Goods"

**Date:** 2026-08-12
**Branch under test:** `arc/fedos-commerce-real-two-party-ux-closure-agent-tabletop-seller` (forked from the just-integrated `arc/fedos-commerce-real-two-party-ux-closure`)
**Tester:** fresh, uncoached usability pass — no implementation source, no prior findings docs read before completing the flow once (per the arc brief).
**Methodology:** real Beta Electron app (`npm run start:beta`, real dev Electron binary, real WASM artifact — no mocks), driven live over Chrome DevTools Protocol on an isolated `--remote-debugging-port=9256` + isolated `--user-data-dir`, using the app's single-window "Acting as" identity selector to alternate between seller (Bob) and buyer (Alice) — same methodology the frozen v1 baseline (`docs/commerce/usability/SELLER-TABLETOP.md`, read only *after* this first pass, for format/scale reference) used.

**Task, verbatim:** "Sell this fictional digital product to Alice. Create a good listing, publish it, handle the order, payment, delivery, and confirm your transaction/reputation."

**Product chosen:** *Thornwatch: Shattered Vale — Print-and-Play Adventure Module (PDF)*, $12.00 USD, a 24-page tabletop RPG adventure module.

**Result: task completed.** Listing published, real order placed by "Alice," payment simulated, delivery marked/confirmed, order completed, signed receipt issued and verified `VALID`, seller reputation recorded ("1-4 verified trades"). A restart/resume test was also run (not required, done because it was cheap and it's an explicit scorecard dimension): profile, listing, and order state all survived a full app quit + relaunch + re-unlock; the previously-issued signed receipt did **not** survive it.

---

## 1. Setup notes (environment, not scored)

`npm ci` (root + `packages/fedos-desktop-electron-spike`), `npm run ensure-electron-binary`, a from-scratch `cargo build --target wasm32-unknown-unknown --release` + `wasm-bindgen` + manifest generation (isolated `CARGO_TARGET_DIR` to dodge the known OneDrive-path mingw-linker issue), then `npm run build:beta-runtime` + `npm run build` + a direct `electron.exe dist/fedos_electron_beta_main.cjs --remote-debugging-port=9256 --user-data-dir=<isolated>` launch. All of this worked on the first try with no surprises — this is process, not a finding.

---

## 2. Walkthrough

### 2.1 First launch → profile creation (screenshots 00–03)

- **00-launch.png** — clean first-run screen: "Welcome. No local profile was found on this device," an honest Closed-Beta security disclosure ("no independent, external security audit has been performed... Do not use it to protect information where compromise would cause serious harm"), one button: **Create a profile**. Good, low-anxiety first impression.
- **01 / 02** — profile form: label, passphrase, confirm-passphrase, with a clear, scary-in-a-good-way warning that the passphrase is never stored and there is no reset. I named the profile "Bob's Tabletop Goods."
- **03-after-profile-created.png** — instantly dropped into the main shell: **Conversations / Shop / My Store / Search / Archive / Devices / Safety Center / Settings**, plus **Lock/Quit**. "No Relay configured" is shown persistently in the top bar. Tab naming is a clear improvement over what the v1 baseline reported ("Commerce"/"Merchant" with no distinguishing label) — **Shop** and **My Store** read immediately as buyer-side and seller-side.

**Steps so far: 5** (Create a profile → fill 3 fields → submit).

### 2.2 Finding "sell my product" (screenshot 04–05)

- **04-my-store-tab.png** — clicked **My Store**. First surprise: the "Acting as" selector defaulted to **Customer — Alice (demo)**, not my own just-created profile, even though I was on the seller-facing "My Store" screen. A brand-new seller's very first instinct (click My Store, start creating a listing) lands on the wrong identity by default.
- **05-acting-as-bob.png** — switched "Acting as" to **My Store — Bob's Tabletop Goods (real profile)**. Note: the helper caption directly under the selector still read "Demo fixture identity — not your real profile, not a real merchant/customer" even after selecting my *real* profile — a stale/generic caption that doesn't reflect the actual selection (minor, P3).

**Steps so far: 7.**

### 2.3 Creating the listing (screenshots 06–13)

- **06 / 06b / 07-listing-form-filled.png** — the Create Product form: Title, Description, Price, Currency. Price took a plain decimal ("12.00") with a live "= 12.00 USD" preview — no cents-math friction (a real, verified improvement over the v1-documented "Price (cents)" friction).
- **08-after-create-product.png** — clicked **Create Product (draft)**. Form cleared with no toast/confirmation in the viewport; had to scroll down to find out it worked.
- **09-my-products-after-create.png** — the product appeared as **draft** under "My Products" with **Preview / Edit / Publish** buttons, plus a real file input (localized "ファイルを選択" per the OS's Japanese locale — a real, working native file picker) and an **Attach Image** button. This is new capability the v1 baseline explicitly reported as *entirely absent* ("no media/image upload capability exists anywhere") — a genuine, meaningful improvement in surface area, **but see the bug below.**
- **10-file-selected.png** — generated a small placeholder cover PNG and attached it via the file input; the filename showed correctly.
- **11-after-attach-image.png** — clicked **Attach Image** → **`image storage failed: failed`** in red. A real, live, reproducible failure.
- **12-attach-image-retry.png** — retried once (a normal user's first reaction) → identical failure, byte-for-byte. **This is a confirmed, reproducible dead end**, not a fluke. The error message itself is close to useless ("failed: failed" — doubles the word "failed" with no cause, no suggested next step).
- **13-after-publish.png** — proceeded without an image (a real seller would have no other option) and clicked **Publish**. Status flipped to **active**, button became **Unpublish**. Listing is live.

**Steps to "listing published": 12** required actions (5 profile-creation + 2 nav/identity + 3 form fields + 1 create + 1 publish), **+3 wasted actions** on the image-attach dead end (file-select, Attach Image, retry).

### 2.4 Playing Alice: finding and buying Bob's own listing (screenshots 14–20)

- **15-shop-tab-as-bob.png** — clicked **Shop** while still "Acting as" Bob: correctly shows *other* merchants' catalog (Northlight Studio, Riverbend Makerspace), **not** Bob's own listing — sensible, you shouldn't be able to buy your own product.
- **16 / 17** — switched "Acting as" to **Customer — Alice (demo)**; scrolled the catalog and found the Thornwatch listing. It renders correctly (title, price, avatar-initials placeholder) but the byline under it reads **"Unknown merchant"** rather than "Bob's Tabletop Goods," even though I had explicitly selected the correct real-profile identity before creating and publishing it. The v1 baseline's version of this bug was caused by creating a listing *while* mis-identified as a customer; here I did everything "right" and the merchant name still failed to resolve on the catalog card — the root symptom persists even though the originally-documented cause doesn't apply.
- **18-product-detail-view.png** — product detail page: full title, description, price, and **"Sold by Unknown merchant"** again, plus an honest "Seller Reputation: No reputation history on record for this seller yet" and a **Create Order** form (quantity, defaulting to 1).
- **19 / 20** — **Create Order** → order screen shows Buyer/Seller *correctly* this time (seller shown as a truncated hex ID, not "Unknown merchant" — so the display-name resolution gap is specific to the catalog-card/detail-page byline, not universal). **Submit Order** → status **submitted**, with clear copy: "Submitted — waiting on the seller to accept or reject. You can safely close this and come back later."

**Steps so far: 12 (listing) + 6 (browse/order/submit as Alice) = 18.**

### 2.5 Back to Bob: the stale-view bug (screenshots 21–25)

- **21-mystore-as-bob-incoming-order.png** — switched back to My Store, re-selected Bob's real profile. "Needs your attention" said **"Nothing needs your attention right now"** and the badge on the My Store tab read **0** — even though Alice had just submitted a real order two steps earlier.
- **22-incoming-orders-section.png** — scrolled down: **"My Products: No products yet — create one below."** and **"Incoming Orders: No incoming orders yet."** Bob's own just-published product and the order against it had both **visually vanished** from Bob's own dashboard.
- I navigated away (Conversations tab) and back to My Store as a natural recovery attempt.
- **23-mystore-recheck-products.png** — after that round-trip, the product ("active") and the order ("1 new order(s) awaiting your accept/reject") both reappeared correctly.

**This is a real, reproducible bug**, not tester error: switching the "Acting as" identity on My Store does not refresh the "My Products" / "Incoming Orders" lists — you have to navigate away to an unrelated tab and back to force a re-render. For a first-time seller with no reason to suspect this, the honest experience is "I made a listing and got an order, then they were both erased" — a severe, confidence-destroying moment even though nothing was actually lost.

- (Along the way, a scripting misclick of my own — not an app bug — accidentally submitted the empty Create Product form and surfaced a real, reasonably clear validation message, **"malformed title"**, which stuck around in the UI on unrelated later screens rather than clearing on next legitimate navigation — noted as a minor, P3 loose end, not counted as a friction against the app's core flow.)
- **24 / 25** — opened the order via **Open**, landed on the seller's order-detail view: Buyer/Seller/Status/price, and clear copy — "Incoming order — accept to proceed, or reject with an optional reason" — with **Accept** and **Reject** (visually distinct: blue primary vs. dark red) buttons.
- **26-after-accept.png** — clicked **Accept**. Status → **accepted**, copy: "Accepted — waiting on the buyer to pay. Reopen this order later to check progress."

### 2.6 Payment (screenshots 27–30)

- **27-alice-my-orders.png** — switched to Alice, Shop tab: "My Orders" correctly showed **"1 ready to pay"** with no stale-view issue this time (the stale-view bug was one-directional in my testing — Bob→My Store, not Alice→Shop).
- **28-alice-order-detail-pay.png** — opened the order: "Merchant accepted — pay now, then (local demo only) simulate an authoritative payment confirmation." Honest, upfront about what's real vs. simulated. **Pay Now** button (not "Request Payment" — the v1-documented buyer/seller mental-model inversion appears fixed).
- **29-after-pay-now.png** — clicked **Pay Now**: a payment request appeared (`local-sim-payment-8c9f6280-1 — 12.00 USD`) with a clearly labeled **Simulate Payment (TEST/LOCAL) [NOT REAL MONEY]** button.
- **30-after-simulate-payment.png** — clicked it: status → **paid**, with excellent trust copy: **"PAID — confirmed by this device's local deterministic payment simulator, never by a bare customer/merchant claim."** This exact honesty pattern (state changes are attributed to a specific, named authority, never a bare claim) repeats at every subsequent step and is the single strongest thing about this app's Commerce UX.

### 2.7 Fulfillment and delivery (screenshots 31–39)

- **31-open-purchased-content-before-delivery.png** — curiosity click on **Open Purchased Content** before any delivery step: **"this product has no protected content."** Accurate, not misleading — but it surfaces a real, structural gap: **at no point in the entire Create Product flow was there ever a field to attach the actual digital deliverable** (the PDF itself). Only a cover-image attach exists (and it's broken — §2.3). A buyer who paid for a "digital download" has no on-screen path to ever receive the actual file, in this build.
- **32-mystore-incoming-after-payment.png** — back as Bob: this time the "Incoming Orders" list correctly, immediately showed **"1 paid, ready to fulfill"** with no stale-view issue (so the earlier bug is not 100% reproducible on every identity switch — it happened on the very first switch after creating the listing, and not on subsequent ones in this session; still real, still worth reporting, but not "every single switch").
- **33-seller-order-paid-fulfill.png** — opened the order: "Payment confirmed — fulfill this order," **Mark Fulfilling** button.
- **34-after-mark-fulfilling.png** — clicked it: status → **fulfilling**, "waiting on the buyer to confirm they received it."
- **35–37** — switched to Alice, "My Orders" showed **"1 ready to acknowledge receipt"** correctly and immediately; opened the order: **"Merchant has fulfilled this order — once you receive it, confirm receipt yourself. Only your own confirmation (never a merchant claim alone) can mark this delivered."** — again, excellent, specific trust language.
- **38-after-received-confirmation.png** — clicked **I Received This**: status → **delivered**.
- **39-order-delivered-lower.png** — scrolled down: **Complete Order** button, and (again) **"this product has no protected content"** under "Open Purchased Content" — confirming the no-deliverable-file gap persists all the way through a fully successful transaction.

### 2.8 Completion, receipt, reputation (screenshots 40–44)

- **40-after-complete-order.png** — clicked **Complete Order**: status → **completed**, "Order completed. Reputation records were saved for both parties."
- **41 / 42 / 43** — clicked **Issue Signed Receipt**: **Verification status: VALID**, a real rendered QR code image (the v1 baseline reported a QR *label* with no actual QR image ever rendering — this appears fixed, a real QR now renders), and the underlying signed text (`fedos:trust:v1:...`) shown alongside it with a note that the signed object, not the image, is authoritative.
- **44-bob-mystore-reputation-check.png** — switched back to Bob, My Store dashboard: **"My Reputation: Persona a5f0d2c30e7e... — 1-4 verified trades — mostly other — persona epoch currently valid. Reputation is pseudonymous, self-reported by trading counterparties, and not a guarantee of identity or Sybil resistance."** Reputation is now visible directly on the seller's own dashboard without having to view your own listing as a buyer — the v1 baseline reported this as entirely invisible from the Merchant tab; that appears fixed.

**"Listing published" → "order fulfilled and reputation confirmed": roughly 24 more required clicks/identity-switches** (browse-as-Alice, create/submit order, switch-accept, switch-pay/simulate, switch-fulfill, switch-receive/complete/receipt, switch-verify-reputation), **+2 extra clicks** to recover from the stale-view bug (navigate away and back).

**Total, launch to fully-confirmed transaction+reputation: ~38 required steps, ~5 wasted/recovery steps** (3 on the image-attach dead end, 2 on the stale-view recovery).

### 2.9 Restart/resume test (screenshots 45–50, not required by the brief, done because it's cheap and scorecard-relevant)

- Clicked the in-app **Quit** button (clean shutdown, verified via the CDP port going down), relaunched with the same `--user-data-dir`.
- **46-relaunch-initial.png** — correctly landed on a lock screen showing **"Profile: Bob's Tabletop Goods"** (not a generic "no profile found" state) — the app remembered exactly which profile to prompt for.
- **47-after-unlock-restart.png** — entered the same passphrase, unlocked cleanly into the main shell.
- **48-restart-mystore-products-orders.png** — My Store: the product ("active") and the order ("completed") **both survived** the restart correctly, with full status.
- **49-restart-receipt-check.png** — opened the completed order: the previously-issued, verified-`VALID` signed receipt was **gone** — the screen showed a plain **"Issue Signed Receipt"** button as if it had never been issued, with no warning that a prior receipt existed and was lost.
- **50-restart-receipt-reissued.png** — re-issued it: regenerated cleanly to `VALID` in one click, so the *capability* is not broken — only the previously-issued artifact's persistence is. This exactly matches a finding in the v1 baseline (documented there as P0) and is confirmed **still present** in this build.

---

## 3. Scores (seller-perspective, same 1–10 scale and dimension set as `docs/commerce/usability/COMMERCE-UX-SCORECARD.md`, read only after this pass)

Scale: 5 = usable but clearly immature. 8 = genuinely excellent. 9+ requires extraordinary evidence. Scored against what I actually experienced in this build, not against what the v1 baseline reported for a different (older) commit — several things have visibly improved, a few have not.

| Dimension | Score | Justification |
|---|---|---|
| **Seller product creation** | **6** | Fast (4 required fields, well under 2 minutes), price entry has no cents-math friction (a real improvement), and there's now a real Edit/Preview/Publish/Attach-Image affordance set that didn't exist before. Held back hard by: the "Acting as" selector defaulting to the *wrong* identity the first time you land on My Store; the image-attach feature being present in the UI but reproducibly broken ("image storage failed: failed", twice, identically); and no way at all to attach the actual digital deliverable (only a cover image, itself broken). |
| **Seller order management** | **6** | Incoming orders are clearly labeled by status ("1 new order(s) awaiting your accept/reject," "1 paid, ready to fulfill") with a badge count on the tab — a real, working notification surface, unlike the v1 baseline's "no notification/badge anywhere." Pulled down by the stale-view bug on the very first post-creation identity switch (product and order both appeared to vanish until I navigated away and back), and by the buyer still being shown as a raw hex string on the seller's order-detail screen rather than "Alice." |
| **Seller fulfillment** | **8** | Single, clear "Mark Fulfilling" button; every subsequent screen (both seller- and buyer-facing) has explicit "waiting on X" copy — the v1 baseline's "goes completely silent afterward" / "actionless screens" finding did not reproduce anywhere in this pass. This is the strongest dimension in the seller flow. |
| **Trust / reputation clarity** | **8** | Exceptional, specific, repeated trust copy at every state transition ("confirmed by this device's local deterministic payment simulator, never by a bare customer/merchant claim"; "only your own confirmation, never a merchant claim alone, can mark this delivered") — never overclaims, always names the actual authority behind a state change. Reputation is now visible directly on the seller's own dashboard (a real fix over the v1 baseline). Held back one point by the still-unexplained, jargon-dense "1-4 verified trades — mostly other — persona epoch currently valid" phrasing, and by the catalog/detail-page merchant byline reading "Unknown merchant" even for a correctly-attributed listing — a real trust-signal gap for the buyer side of the same transaction. |
| **Privacy UX** | **5** | Honest "LOCAL DEMO" / "fictional... not a real product, merchant, or payment" labeling throughout, and a "No Relay configured" indicator that doesn't pretend otherwise. Not independently exercised beyond what's visible in this single-process pass — scored on honesty of labeling, not on a demonstrated privacy property. |
| **Error recovery** | **3** | The image-attach failure gives a genuinely unhelpful message ("image storage failed: failed" — no cause, no next step) with no retry guidance, and retrying produced the identical unhelpful failure both times. The stale-product/order-list bug gives **zero** error indication at all — it silently shows an empty, "nothing to see here" state instead of a spinner, an error, or a stale-data warning, which is worse than an explicit error because it reads as *data loss* rather than *a bug*. The lost-on-restart receipt is the same pattern: silent, no warning, no explanation — only discoverable by noticing the button reverted. |
| **Restart / resume** | **6** | Profile identity, listing, and full order lifecycle status all correctly survive a real app quit + relaunch + re-unlock — this is a genuine, verified positive and the core promise ("your business state persists") holds. Held back by the receipt-loses-on-restart bug (confirmed still present, matches a v1 P0 finding) and by landing on a generic unlock screen with no "you have an order awaiting action" pointer after unlocking. |
| **Cognitive load** | **5** | The seller must track and correctly switch a dual-identity "Acting as" selector (Shop's and My Store's are two separate DOM controls that happen to stay value-synced but do not visually indicate that to the user) roughly a dozen times to complete one single transaction end-to-end, entirely an artifact of the single-process demo-role-switching harness itself rather than a real two-user product flow — this is explicitly out of scope to "solve," but it is real, repeated friction I personally felt throughout this pass, and it directly caused the stale-view confusion in §2.5. Raw hex identifiers still appear as primary labels in several places (order's "Seller: 43efa4ba38cd...", product's "Sold by Unknown merchant") even where the app clearly has a friendly name available elsewhere on the very same order. |

**Not separately scored** (buyer-facing dimensions from the v1 rubric — buyer discoverability, buyer product decision confidence, checkout/order clarity, payment clarity, order tracking/recovery, delivery clarity — were exercised only incidentally while playing Alice to generate a real order against my own listing, per the brief's instruction to treat that as a means to an end, not a full buyer-side red-team pass. Everything I *did* observe while playing Alice is folded into the narrative and dimension notes above where it bears directly on the seller's experience.)

---

## 4. Top friction findings, severity per the arc brief's own discipline

*(P0 = user cannot safely complete the transaction, or is misled about payment/delivery/product-state truth, or the UI is security-critically misleading. P1 = high abandonment/confusion risk on the core flow even if nothing is technically unsafe. P2 = meaningful friction/discoverability problem. P3 = polish.)*

1. **[P1] Image attach is a live, reproducible dead end.** The "Attach Image" feature is fully present in the seller UI (working native file picker, correct filename display) but fails identically on every attempt with an unhelpful, non-actionable error: **"image storage failed: failed."** A first-time seller who wants a product photo — the single most natural thing to want for a listing — hits a wall with zero recovery path and a message that explains nothing. Screenshots 10–12.

2. **[P1] Switching seller identity does not reliably refresh My Store's own dashboard.** Immediately after creating and publishing a listing, and immediately after a buyer submitted a real order against it, switching "Acting as" back to the seller's own real profile showed **"No products yet"** and **"No incoming orders yet"** — a false, confidence-destroying "everything I just did disappeared" moment. The fix (navigate away to an unrelated tab and back) is not something a real first-time user would think to try; it reads exactly like data loss, not a rendering bug. Only reproduced once (the very first switch); did not reproduce on later switches in the same session, which itself is confusing (inconsistent behavior is harder to reason about than consistent behavior). Screenshots 21–23.

3. **[P1] No mechanism anywhere to attach the actual digital product being sold.** The entire Create Product form has Title/Description/Price/Currency and (broken) cover-image attach — never a field for the deliverable file itself. A buyer who completes a full purchase, confirms delivery, and completes the order is told **"this product has no protected content"** at every stage where they try to access what they paid for. The seller-facing flow never once surfaces this gap to the seller either — there's no "remember to attach your file" prompt anywhere, so a first-time seller has no way to discover this limitation until a buyer complains. Screenshots 31, 39.

4. **[P1, confirmed still-present from the v1 baseline] Issued receipts do not survive an app restart.** A signed receipt verified `VALID` with a real rendered QR code, once issued, silently reverts to "not yet issued" after a clean app quit + relaunch + re-unlock, with zero warning that this would happen and zero indication after the fact that anything was lost. Re-issuing works cleanly (one click, regenerates to `VALID`), so the capability itself isn't broken — but a user who screenshots or scans their receipt believing it's a durable proof, then later reopens the app, would reasonably conclude their proof of purchase evaporated. Order status/history itself persists correctly, which makes this inconsistency more confusing, not less. Screenshots 41–43 (issued), 49 (gone after restart), 50 (cleanly re-issued).

5. **[P2] Merchant identity fails to resolve on the buyer-facing catalog card and product-detail page ("Unknown merchant"), even for a listing correctly created and published under the seller's own real, selected identity.** The order screen created from that same listing correctly resolves and displays party information (as a hex ID), so the app clearly has the data — it just isn't wired into the catalog-card/detail-page byline renderer. This directly undermines the "Trust/reputation clarity" story on the one screen (product detail) where a buyer is actually making a trust decision. Screenshots 17, 18.

6. **[P2] The "Acting as" identity selector defaults to the wrong role the first time a new seller opens My Store**, and exists as two separate, value-synced-but-visually-unlinked dropdown instances (one under Shop, one under My Store) that a user has no way to know are the same underlying state. This is explicitly an artifact of the single-process demo-role-switching harness rather than a real product gap, but it is real, repeated, first-pass-observed friction that a first-time uncoached tester (or a real solo-tester doing exactly this kind of role-swap testing) would hit immediately. Screenshots 04–05.

---

## 5. What felt broken vs. merely unpolished

**Felt broken (real bugs, not "could be nicer"):**
- Image attach ("image storage failed: failed", 100% reproducible)
- My Store's product/order lists silently going empty after an identity switch (at least once, not consistently)
- Signed receipts not surviving an app restart

**Felt merely unpolished (real, but lower-stakes):**
- Stale "Demo fixture identity" caption under a correctly-selected real profile
- A leftover "malformed title" validation message persisting across unrelated navigation (triggered by my own misclick, not a normal flow, but the persistence itself is a real minor issue)
- Raw hex identifiers used as primary labels in several places where a friendly name is already computed and shown elsewhere on the same screen
- "Unknown merchant" on the catalog card despite correct underlying attribution

**What was genuinely good, worth stating plainly:** the state-transition trust copy (payment, delivery, receipt) is consistently excellent — specific, honest, never overclaiming, always naming the real authority behind a claim ("confirmed by this device's local deterministic payment simulator, never by a bare customer/merchant claim"). The core happy-path sequence (list → order → accept → pay → fulfill → confirm receipt → complete → issue receipt → reputation) is coherent, logically ordered, and each step's copy correctly explains what's being waited on next. Restart/resume of the *transactional* state (not the receipt artifact) genuinely works.

---

## 6. Answering the brief's specific questions

- **Did I complete the task?** Yes — a real listing was created, published, ordered against, paid, fulfilled, delivery-confirmed, completed, and both a verified signed receipt and a reputation record were produced.
- **Was the dual-role ("Acting as") setup itself confusing?** Yes, moderately — see friction #6 above and the Cognitive Load score. It's flagged in the brief as out-of-scope architecture, but the UX symptom (a stale-looking dashboard right after the identity switch that matters most) was real, observed, and would have looked like a serious bug to an uncoached user.
- **Where did the single-process flow feel stuck or unclear, independent of the disclosed cross-process limitation?** The My Store stale-view moment (friction #2) is the clearest example — it happened entirely within one process, one window, one session, with no relay/cross-process involvement at all.
