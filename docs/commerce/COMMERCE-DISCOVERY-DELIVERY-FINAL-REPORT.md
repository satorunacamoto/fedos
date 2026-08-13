# FedOS — Buyer Discovery + Digital Content Delivery Mega-Arc: Final Report

**Branch:** `arc/fedos-commerce-discovery-delivery`
**Starting EvidenceHead:** `b4304f22` (Real Two-Party Purchase Completion + UX Closure mega-arc)
**Final CandidateHead:** `3d1a69d8` (source freeze — test:current/OSS-verifier/build/package/package-integrity/real-two-process-E2E all validated from this exact commit)
**Final EvidenceHead:** *(this commit)*

## How this arc ran

Four parallel agents (D: buyer discovery, M: seller digital-product content, A: purchase authorization/delivery, U: fresh buyer/seller UX), each in its own isolated worktree/branch off `b4304f22`, then a Coordinator integration pass, a security review, a BUILD-gate fix pass, a live two-process E2E validation pass (which found and fixed a real security-relevant race in the E2E harness itself — see below), a full validation sequence, and — critically — two rounds of **real, uncoached, fresh-user tabletop testing against the actual packaged app**, which found and drove fixes for three defects no automated test had caught: a pre-existing crypto bridge that made protected-content attach fail in every real launch, a P0 regression that made it impossible for any real user to place any order, and an app-freezing bug on Unpublish. This report treats the tabletop findings as first-class evidence, not a final polish pass — two of the three defects they found were the single most consequential fixes in the entire arc.

---

## PRE-WORK: re-deriving the two P0s (§3)

Before any implementation, the exact prior EvidenceHead (`b4304f22`) final report and its own investigation doc (`docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`) were read and re-verified against current source, not trusted as-is. One correction found immediately: the reachability doc's own "Blocker 2" (no way to construct an `AeadKeyHandle` from raw bytes) turned out to be a dead end that a prior arc had already solved differently — `media_access_grant_key_release.ts` already wraps the *decrypted plaintext release payload itself* (≤64KB) end-to-end via already-reviewed NIP-44 primitives, needing no new crypto. This reframing shaped the whole arc: P0-2 was scoped as a bounded wiring job for small purchased artifacts, not a crypto-boundary change, and no new Rust/WASM surface was touched anywhere in this arc.

---

## DISCOVERY

FRESH BUYER CAN CONNECT: **PASS** — live-proven, real relay, real two independent processes (buyer tabletop, second run).
REAL SELLER IDENTITY: **PASS** — "Acting as" defaults to the real local Persona everywhere; Product Detail shows "Sold by \<real display name\>"; the prior arc's "Unknown merchant" defect is fixed.
BOB SHAREABLE STORE/PRODUCT: **PARTIAL** — the signed Product Share Proof mechanism (Agent D) is real, cryptographically sound, and works correctly when used directly (verified live: pasting a real `fedos:trust:v1:...` code opens the correct product with signature verification). But the seller's visible **"Copy Share Info"** button emits a different, unsigned prose artifact that the buyer's "Find a seller by share code" box rejects (`malformed-envelope`) — the two halves of the shipped share feature do not connect for an ordinary user clicking the obvious button. Store Share (as opposed to Product Share) is adapter-complete but never wired to IPC/UI at all.
ALICE FINDS BOB WITHOUT CODE KNOWLEDGE: **PASS** — relay-browse discovery worked cleanly in the live buyer tabletop: once connected, Bob's real listing appeared in Shop next to (and visually distinct from) demo fixtures, with no share code needed at all.
REAL SHOP VS DEMO: **CLEAR** — every demo item carries a visible DEMO badge; real listings never do; explicit LOCAL DEMO/OFFLINE/CONNECTING/CONNECTED/SYNC-FAILED states now exist and were observed live matching reality, except see the sync-status honesty gap noted under Known Remaining Defects.
RELAY/BROWSE DISCOVERY: **PASS** — live cross-process, confirmed above.
OFFLINE → RECONNECT DISCOVERY: **PASS** — both a dedicated unit-level proof (`test/commerce_offline_reconnect_discovery.test.ts`) and the live two-process E2E's own SS23 phase confirm a listing published while a peer is offline appears exactly once on reconnect, no duplicates.
FORGED LISTING: **REJECTED** — Agent D's and the Coordinator's tests both confirm tampered/forged/replayed events and impersonated display names are rejected; the cryptographic seller identity is authoritative, presentation is not, at every layer checked (including the security review's own dedicated pass, which found this area clean).

---

## DIGITAL PRODUCT

SELLER CAN ATTACH PUBLIC PREVIEW: **PASS**.
SELLER CAN ATTACH PURCHASED CONTENT: **PASS** — but only as of commit `c587d64f`. Every attempt against a real, unlocked, real-WASM launch of the app failed 100% of the time before that fix (a **pre-existing** defect: `WasmProductMediaEncryption`'s default dependencies were dev-only scaffolding gated on `NODE_ENV=development`, present since before this arc, invisible because every existing test injected fake crypto dependencies and none had ever exercised the real default path in a real launch — this arc's own work, wiring the first real production caller, is what finally exposed it). Fixed by reusing the same production AEAD-bridge pattern already proven for Conversations. Live-proven twice, independently, in both the dev build and the repackaged real binary.
PRODUCT DECLARES DELIVERY SEMANTICS: **PASS** — Product Detail's pre-purchase copy ("Digital item — any protected content the seller has attached becomes available to you… once your order is confirmed and the seller marks this fulfilled. You confirm receipt yourself…") was independently rated the strongest writing in the app by the fresh buyer tester. It is also, currently, a promise the app cannot keep — see Delivery below.
PROTECTED CONTENT ENCRYPTED: **YES** — genuine Rust/WASM ChaCha20Poly1305 under the `CommerceMedia` AAD domain, now genuinely reachable from a real launch.
PLAINTEXT DOWNGRADE: **NO** — public preview stays public by explicit, separate classification; buyers-only content is never stored except through the real encrypted path; the classification distinction is enforced by using two structurally separate IPC handlers, not a caller-suppliable flag.

---

## PURCHASE AUTHORIZATION

MEDIA ACCESS GRANT WIRED: **PASS (channel) / FAIL (in practice)** — the real fourth private-sync channel (`private-media-release-request`/`-release`, Agent A) is genuinely built, tested, and reuses only already-reviewed NIP-44 primitives. In practice it cannot yet succeed for a real (non-demo) seller identity: grant issuance still requires a signing keypair whose public key literally equals the seller's real pubkey, and the codebase has no way to mint one for a genuinely-owned identity without either exposing raw account secret material in a new way or redesigning the grant sign/verify scheme — both correctly identified as crypto-boundary/key-custody decisions and left undone rather than forced (Blocker 5, unchanged from the prior arc, confirmed still live).
BUYER BINDING: **PASS** — tested: wrong buyer, wrong product, wrong media, pre-payment access, revoked/expired grants all rejected, with negative-control tests proving the rejection is real, not vacuous.
ORDER/TRADE BINDING: **PASS**.
WRONG BUYER: **REJECTED**.
PRE-PAYMENT CONTENT ACCESS: **REJECTED**.

---

## DELIVERY

BOB DELIVERS REAL CONTENT: **PASS** — as of `c587d64f`, a real seller can genuinely attach, encrypt, and store real purchased content.
ALICE RECEIVES REAL CONTENT: **FAIL — confirmed live**, not inferred. This is the arc's central, unresolved boundary. `handleCommerceMediaGrantRedeem()` short-circuits to `{outcome: "not-found", reason: "this product has no protected content"}` directly from the buyer's own **local, in-memory, per-process** `ProductMedia` repository — which nothing in the codebase ever populates from the network. A buyer's process has no way to learn a product has protected media at all, so it never even attempts the cross-process release request. Live buyer tabletop, two genuinely independent packaged processes: Bob's process reports his product's real media list (protected PDF + public PNG); Alice's process, for the exact same product, reports `media: null`. Not even the *public* cover image crosses.
ALICE CAN OPEN CONTENT: **FAIL**, same cause.
MISSING CONTENT: **FALSE SUCCESS — confirmed live, this is the most serious open finding in the arc.** "This product has no protected content" is not an error state or a pending state; it is an unqualified, false, affirmative statement about the seller's product, indistinguishable on screen from "the seller never attached anything." A real buyer would conclude the seller shorted them and have no reason to suspect a sync problem. Worse: the buyer tabletop then completed the trade anyway (following the app's own instructed path), and FedOS issued a **cryptographically valid signed trade receipt reading "Verification status: VALID"** and wrote **reputation records for both parties**, for a transaction in which the buyer received zero bytes — while the same screen still displayed "this product has no protected content" directly above the receipt.
DIGITAL TRADE CAN GREEN-COMPLETE WITHOUT CONTENT: **YES — this violates the arc's own §25/§43 requirement, and is disclosed rather than papered over.** Two real fixes narrowed this during the arc (the order-completion invariant now checks before allowing `"complete"` on both the local path and, after a Coordinator fix, the inbound-private-order-sync path too — closing a live-reproducible second bypass), but both checks read from the same vacuous per-process `ProductMedia` state, so on the buyer's own process — the process where user-facing completion actually happens — the check is satisfied vacuously, not genuinely, whenever the buyer never separately learned the product has protected media. This is a real, closely-bounded, well-understood remaining gap, not a vague one: the fix needs a `ProductMedia` metadata-sync mechanism (id + classification, never bytes) that does not exist yet. The closest existing scaffold is the drafted-but-never-wired `MediaManifestReferenceEventDraft`. This is a protocol design decision, correctly left to a future arc rather than forced through in this one.
CONTENT ACCESS AFTER RESTART: **FAIL** — moot, for the same reason; nothing is ever genuinely delivered to check.

---

## FULL TWO-PARTY (live two-process E2E, `commerce_e2e_two_process_real_electron.test.ts`, 7/7 PASS at CandidateHead, run three times consecutively, 16 real Electron launches each run, zero orphaned processes)

BOB PUBLISH: **PASS**
ALICE DISCOVER: **PASS** (cross-process, live)
ORDER: **PASS**
ACCEPT: **PASS**
PAYMENT: **PASS**
PAID: **PASS**
DELIVERY (order-state transition): **PASS**
CONTENT (actual bytes): **FAIL** — see above; this specific E2E suite's own product never attaches protected media, so its "no protected content" result is separately, truthfully correct for *that* product and does not by itself exercise the vacuity bug — the buyer tabletop is the live proof for a product that actually has content.
COMPLETE: **PASS** (state machine)
RECEIPT: **PASS** — real signed + QR-encoded, independently verifies VALID before and after restart.
REPUTATION: **PARTIAL** — attestations are written, but confirmed live (both the E2E suite and the buyer tabletop) that they never cross to the counterparty's own process (no sync channel carries them), so a seller who completes a real trade sees "No reputation history on record for this seller yet." on their own device. One buyer-tabletop run also showed reputation display attributed to a persona id that did not match the actual seller's pubkey.
TWO-PROCESS RESTART: **PASS** — every durable fact (Persona identity, Product, Order, PAID lineage, Delivery, completion, Receipt via lookup not reissue) survives a real restart on both sides.
SAME-PROCESS FALLBACK: **NO** — every phase used genuinely separate Electron processes with separate PIDs and dataDirs, communicating only through a real local relay.

---

## A P0 found and fixed mid-arc: nobody could buy anything

The most severe defect found in this entire arc was not one of the original two P0s — it was a full regression of the core buy loop, found by the live buyer tabletop: **a fresh, genuinely independent buyer could not place an order for any product at all**, including the shipped built-in demo listings. The "Acting as" identity selector, after Agent U's (correct, mandate-required) removal of the demo customer-persona system, had exactly one option — the user's own identity in a merchant-labeled slot — and the order form's visibility gate still checked for a `role: "customer"` that only ever existed on the now-removed demo fixture. The real two-process E2E suite never caught this because its own automation clicked the (hidden) submit control directly via `querySelector(...).click()`, bypassing the visibility check a real user's mouse cannot bypass — and the suite's own header had explicitly, incorrectly, dismissed this as "a cosmetic hidden-form gap." Root-caused, fixed (any real identity may now order any product it does not itself own; self-dealing is still refused, verified at both the UI and the domain-state-machine layer), and live-proven with two independent processes and real mouse clicks in production mode — no test flags, no demo personas reintroduced. Fixed in `3d1a69d8`.

---

## UX

Two independent, harsh, uncoached tabletop passes were run against the real packaged app. Both are genuine, current measurements — but neither reflects every fix landed afterward, and that gap is disclosed rather than smoothed over:

**SELLER (measured before the `c587d64f` encryption fix and before the `3d1a69d8` order-creation fix): 3/10.** Genuine improvements confirmed: correct real-identity default (no more opening your own store as a fake customer), correct real attribution ("Sold by \<real name\>", not "Unknown merchant"), an excellent, unambiguous public-vs-buyers-only labeling scheme, working relay publication, a real signed QR/text share artifact. Held down by: the purchased-file attach failing every time (now fixed), a relay URL the app gives no way to obtain from inside itself (not fixed — a genuine, unsolved onboarding gap), and — found in a follow-up pass — **Unpublish hard-freezes the app** (reproduced 3×, renderer deadlock, no error, force-kill required to recover; not fixed this arc, disclosed below) plus the app's own in-UI recovery advice for "buyer can't find my listing" (`Edit → Save`) silently emitting the wrong, incomplete event type.

**BUYER (measured after the encryption fix, before the order-creation fix, so its score reflects the "cannot buy at all" blocker at full severity): 2/10.** Genuine improvements confirmed: real cross-process browse discovery over a real relay; an honest, well-written trust/expectation surface that never fakes reputation or seller identity; a genuinely solid order/pay/fulfill state machine once reached (every transition synced correctly across two real processes with clear status text). Held down by the since-fixed order-creation blocker (full severity at time of scoring) and by the confirmed-live false-success delivery/completion/receipt/reputation chain described above, which is not fixed and could not be fixed within this arc's bounded scope.

BUYER ZERO-INSTRUCTION: **NO** at time of measurement (root blocker since fixed; not re-measured — see Recommended Next Step).
SELLER ZERO-INSTRUCTION: **NO** at time of measurement (attach blocker since fixed; Unpublish freeze and relay-onboarding gap remain unfixed).
DISCOVERY UX: genuinely improved — browse discovery is clear, honest, and was completed successfully uncoached; the share-code path is broken (two mismatched artifacts) and unfixed.
PRODUCT DECISION UX: strong — the seller-identity and delivery-expectation copy were independently singled out as the best writing in the app.
DELIVERY UX: the worst-scoring area in both passes, and the one area where a real fix requires a design decision (ProductMedia sync protocol) rather than a bounded change.
ERROR RECOVERY: mixed — Agent U's honest connected/offline/sync-failed states and no-silent-failure copy are real and tested; set against them, "this product has no protected content" and the deep-linked-Settings-Add-silently-no-ops defect are exactly the silent-failure class this arc's own mandate (§35) explicitly asked to close, and were not fully closed.
UX-P0: **1 remaining** (the false-success delivery/completion chain) plus the general recommendation to re-run both tabletops fresh against the final CandidateHead before treating either score as current.
AMAZON-LEVEL: **NO**.

---

## VALIDATION

TARGETED: every sub-agent's and every follow-up fix agent's own targeted suite passed; full detail in each commit message (`git log b4304f22..3d1a69d8`).

TEST:CURRENT: 184 files (up from 175 — 9 of this arc's own new test files had never been added to the curated allowlist, found and fixed as part of the BUILD gate), **181 passed / 3 failed**, 2714 tests (**2708 passed / 3 failed / 3 skipped**). The 3 failures are the same pre-existing class throughout this arc (`NODE_ENV`-gated dev-only WASM loader tests that require `NODE_ENV=development` to pass by their own design — confirmed unrelated to any change in this arc by explicit before/after comparison).

OSS VERIFIER: **PASS** (8/8 checks).
BUILD: **PASS** (`typecheck:beta-runtime` clean, `build:electron-spike` clean). One real BUILD-gate bug found and fixed along the way: a stale hand-maintained Commerce import-projection type at the composition-root dynamic-import site never got Agent A's 6 new symbols added, despite them being correctly exported everywhere else — fixed by extending that one type literal, no architecture change.
PACKAGE: **PASS** — real `npm ci`, real electron-builder NSIS installer + zip (110MB installer / 400MB unpacked), including a real compiled WASM artifact (built fresh this arc; a first packaging pass predated the WASM build and was caught and corrected before being used for any usability evidence). One transient `7za.exe` DLL-init failure (exit 0xC0000142) during repackaging, resolved by the same clean-retry this failure mode's prior-arc precedent already established.
PACKAGE INTEGRITY: **PASS** (6/6, including negative-proof fail-closed dependency-closure checks against the real built `app.asar`/`dist` tree, re-verified against the final rebuilt package).
REAL TWO-PROCESS FULL E2E: **PASS** (7/7, run three times consecutively at CandidateHead, 16 real Electron launches per run, zero orphaned processes each time).
OFFLINE/RECONNECT: **PASS** — both the dedicated unit test and the live E2E's own SS23 phase. One real regression was found and fixed along the way here too: a live-reproduced race where an inbound-sync bounded refresh could adopt payment evidence before an explicit "go offline" UI action took effect within the same launch — investigated with real instrumentation, confirmed to be a stale test assumption (the test's own comment described this build's *old* behavior, before this arc's own P0-1 fix made network profile durably persist rather than reset every launch) rather than an actual security gap: at the instant of adoption, the process's own durably-persisted, explicitly-saved instruction genuinely was "direct," so adopting evidence was correct, not a bypass. Fixed by correcting the test's choreography to match the real, current, correct behavior, and strengthened to prove the offline choice holds for a launch's entire lifetime.
SCREENSHOTS: 23 (regenerated at CandidateHead, real two-process E2E run).
UNEXPECTED EXTERNAL CONTACT: **0** — confirmed by every agent; all networking was local relay / loopback / in-memory throughout.
PRIVATE KEY LEAK: **NO**.
PUBLIC PUSH: **NO**.
FORCE PUSH: **NO**.
WORKTREE: **CLEAN** (as of this commit).
REMAINING P0: **1** — cross-process protected-content delivery (buyer-side `ProductMedia` sync does not exist; this is what makes the false-success completion chain possible). Everything downstream of this single gap (Blocker 5's grant-signing-key limitation, the vacuous completion invariant, the vacuous redeem short-circuit) is a direct consequence of it, not an independent gap.
REMAINING P1 (multiple, all disclosed above, none forced through): Unpublish hard-freezes the app; `Edit → Save`'s in-UI recovery advice emits the wrong event type; the seller's visible share button and the buyer's share-code input use two different, incompatible artifact shapes; reputation attestations never sync to the counterparty; one observed reputation-display persona-id mismatch; "Needs your attention" counters observed wrong on both sides in one run; deep-linked Settings navigation's Add-relay control silently no-ops; no relay is reachable from inside the app without external knowledge (unchanged from the prior arc); the honest sync-status line reads "Up to date." even during a fully offline refresh where every channel early-returned.

---

## Recommended next step

Both usability scores in this report are real, harsh, and current *as measurements of the states they were taken against* — but the two most severe defects driving both scores (protected-content attach, order creation) are fixed as of this exact CandidateHead, and neither tabletop was re-run against the fully-fixed build due to this arc's own resource bounds. The single highest-value action for a following arc or session is a **fresh, third-round, uncoached buyer+seller tabletop against CandidateHead `3d1a69d8` exactly** — expected to score meaningfully higher on both the buy-loop and attach dimensions, while still correctly hitting the disclosed, unresolved delivery false-success chain, since that one genuinely remains.

---

## FINAL CLASSIFICATION

**FEDOS REAL TWO-PARTY DIGITAL COMMERCE: PARTIAL — boundary: publish, discover (both browse and, separately when using the correct signed artifact, direct share), order, accept, authoritative cross-process PAID, fulfill, complete (state machine), receipt, and two-process restart are all PROVEN CORRECT AND LIVE between two genuinely independent Electron processes, including a real, previously-broken buy loop this arc found and fixed. A real seller can now genuinely create, encrypt, and store real purchased digital content — also previously broken, also found and fixed this arc. It is NOT complete because a genuinely independent buyer's process has no way to learn that a product has protected content at all, so real content delivery cannot yet complete end-to-end, and — this is the load-bearing reason this cannot be called COMPLETE rather than merely "close" — the app currently completes such a trade anyway, with a valid signed receipt and written reputation, while telling both parties nothing went wrong. That specific gap is real, precisely bounded, confirmed live rather than assumed, and correctly left to a future arc's protocol-design decision rather than forced through here.**

No same-process fallback anywhere in this arc's own validation. No hidden developer setup in any passing test. No public push. No force push.

---

*Full agent-by-agent detail, every commit's own reasoning, and the complete tabletop transcripts are preserved in this arc's own commit history (`git log b4304f22..3d1a69d8`) and in `docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`'s Addendum 2/3 — both written to be re-checked, not trusted.*
