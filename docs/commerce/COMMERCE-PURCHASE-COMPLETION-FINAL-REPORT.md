# FedOS — Real Two-Party Purchase Completion + UX Closure Mega-Arc: Final Report

**Branch:** `arc/fedos-commerce-purchase-completion`
**Starting EvidenceHead:** `8d0a8a757b86764523d4232501ec6c2fdba8d275`
**Final CandidateHead:** `d953c37b` (source freeze — build/package/OSS-verifier validated from this exact commit)
**Final EvidenceHead:** *(this commit)*

## How this arc ran

Four parallel agents (P: payment transport, D: delivery + content authorization, R: receipt restart, U: buyer/seller UX), each in its own isolated worktree/branch off `8d0a8a75`, then a Coordinator integration pass, a real two-independent-Electron-process E2E proof, a second fix round for defects the E2E proof found, a full CandidateHead validation sequence, and a fresh uncoached buyer/seller usability tabletop rerun. Three agents hit transient infra errors (API overload / connection drops) mid-task; each was resumed in place from its own uncommitted work rather than restarted, verified against the worktree state before resuming.

---

## TWO-PARTY TRANSACTION

BOB PUBLISH: **PASS**
ALICE DISCOVERY (cross-process, technical): **PASS** — live-proven in the two-process E2E; but see UX note below: an ordinary independent buyer using only the shipped UI has no reliable path to this.
ALICE ORDER → BOB: **PASS**
BOB ACCEPT → ALICE: **PASS**
PAYMENT EVIDENCE → BOB: **PASS** — new NIP-44 PaymentEvidence Port + transport (Agent P), receiver independently re-verifies before PAID.
AUTHORITATIVE PAID: **PASS**
DELIVERY → ALICE: **PASS** (authorization/state) / **FAIL** (actual protected-content bytes — see Purchased Content below)
PURCHASED CONTENT: **FAIL** (not PARTIAL — see rationale below)
COMPLETE TRADE: **PASS** — full real two-process happy path (publish → discover → order → accept → pay → PAID → fulfill → deliver → complete → receipt → reputation) proven live, STEPS 1–10 all PASS.
SAME-PROCESS FALLBACK: **NO** — two genuinely independent Electron processes, own PIDs, own dataDirs, communicating only via a real local loopback relay.

### Purchased Content — why FAIL, not PARTIAL

Two independent investigations converged on the same conclusion:

1. **Fix Round 2's engineering investigation** found 5 disqualifying blockers: no byte transport between processes exists at all (`IpfsMediaStore`'s only implementation is an in-memory per-process fake); the content-encryption key is per-profile with no counterparty-resolution primitive; the redeem handler wraps/unwraps within a single process, not across two; the same-process protected-media store is itself already broken (pre-existing P1); and grant issuance can never return `"issued"` in the shipped app. The only IPC path that can attach product media (`handleCommerceProductImageAttach`) hardcodes `classification: "public"` **by an explicit prior arc's own documented scope decision**, not an oversight.
2. **The fresh, independent seller usability tabletop** confirmed the real-world consequence: Bob was able to walk a full transaction — "sell this digital product to Alice" — to a green "completed" status, a valid signed receipt, and an updated reputation record, while delivering **zero** actual content, with **no warning anywhere in the UI** to either party. This is a silent false-success, which the arc's own §25 requirement explicitly forbids.

Given §10's own instruction was "wire the existing... do NOT rebuild," and the investigation found the entitlement/encryption pieces exist but genuinely nothing to wire them *to* across a process boundary, this was documented rather than force-built (`docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`).

---

## SECURITY

USER-FORGEABLE PAID: **NO**
MERCHANT-FORGEABLE PAID: **NO**
AI/BOT-FORGEABLE PAID: **NO**
UNAUTH CALLBACK: **NO**
RELAY-FORGEABLE PAID: **NO**
NOSTR-EVENT-ALONE: **NOT AUTHORITY**
PAYMENT REPLAY: **SAFE** — duplicate, replayed, out-of-order, and stale evidence all confirmed rejected/no-op; a genuine dedup-vs-idempotency bug found in Fix Round 2 (events marked "applied" before the apply resolved) was fixed without weakening any authority check.
DELIVERY REPLAY: **SAFE**
CONTENT WRONG-BUYER ACCESS: **REJECTED** (existing MediaAccessGrant redeem path, confirmed sound, left untouched)
PRIVATE DATA PUBLIC: **NO** — Payment/Delivery event payloads carry only the minimum (payment/order/product id, amount, currency, provider identity, verification data, timestamp); no buyer identity details, private Order contents, credentials, or raw keys are ever published; all transport is the existing NIP-44 encrypted private-event stack, never a second crypto/messaging stack.

**One authority-model correction made during integration**, documented for transparency: the original spec assumed the seller ("Bob") owns the local payment-authority rail. Live investigation found the opposite — the payment rail runs in the *buyer's* process. The Coordinator wired inbound-evidence adoption accordingly: only an order's own seller ever adopts inbound payment evidence, only from that order's own buyer; a buyer's process never adopts a remote claim about its own payment.

---

## DURABILITY

TWO-PARTY RESTART: **PASS** — both real processes closed and restarted; Persona identity, Product, both Orders, PAID, Delivery, completion, receipt (via lookup, not re-issue), and amount all survived correctly.
MID-FLOW RESTART: **1/1** (restart after PAID tested live; zero duplicate effects)
OFFLINE/RECONNECT: **1/1** (Bob offline while payment evidence arrives → reconnect → PAID resolves exactly once, tested live)
PAYMENT DURABILITY: **PASS**
DELIVERY DURABILITY: **PASS**
CONTENT ACCESS AFTER RESTART: **FAIL** — moot; no protected content is ever issuable in the first place (see above).

---

## RECEIPT

DEV RESTART: **PASS**
PACKAGED RESTART: **PASS** (real NSIS install → 3 real launches incl. tamper/fail-closed → uninstall, 797s)
DISCREPANCY: **RESOLVED**
ROOT CAUSE: There was **no storage/environment divergence** between dev and packaged launches — both use byte-identical `dataDir()`/`DurableReceiptStore` code paths, and the backend already survived restart correctly in both. The actual bug: `renderCommerceOrderScreen()` in the renderer never queried an existing receipt when a completed order's detail screen opened — only an explicit "Issue" click ever populated the panel. A real user reopening a completed order (restart or not) always saw a pristine, never-issued-looking panel. Fixed with a new read-only `handleCommerceReceiptLookup` IPC handler + auto-fetch on order-open, proven with a negative control (reverted the fix, reproduced the exact original failure, restored it, went green).
HISTORICAL RECEIPT: **PASS**
REAL QR: **PASS** — real 1194-character `fedos:trust:v1:...` envelope, verified `VALID` before and after restart.

---

## UX

BEFORE THIS ARC: ~5/10 (starting classification)
AFTER: **3/10** (both buyer and seller tabletop, independently)

This is a harsher score than the starting baseline, deliberately, per the arc's own "score harshly, do not automatically award improvement" instruction. The real technical achievements this arc delivered (cross-process payment/delivery correctness, receipt persistence, honest sync-state UI, no-silent-failure fixes) are genuine and verified — but they don't move the needle on the two most consequential UX blockers, both of which sit outside what this arc's P/D/R/U scope could fix without a much larger redesign:

- **Buyer discovery**: an independently-created real buyer profile has no working path to find a real seller (Shop is hard-labeled "fictional/local demo data," the configured Relay never actually connects for a fresh user, Search only covers own messages). Every completed purchase in both this arc's own two-process E2E and the tabletop relied on either a real *configured* relay connection (E2E) or the same local instance's built-in demo-fixture buyer identity (tabletop) — never a truly independent, freshly-onboarded second buyer using only the default UI. This is a pre-existing gap (also flagged in this repo's own memory across multiple prior arcs), not something introduced or fixed here.
- **Purchased content honesty**: see above — a seller can walk a "digital product" sale to a false "completed" success with nothing delivered and no warning.

BUYER ZERO-INSTRUCTION: **NO**
SELLER ZERO-INSTRUCTION: **YES WITH FRICTION**
BUYER ORDER RECOVERY: 6/10 (Agent U's honest sync-state/landing-pointer logic is real and tested, but the tabletop's buyer never got far enough into a genuinely independent flow to exercise it under real conditions)
SELLER ATTENTION: 7/10 (tabletop's own direct sub-score)
DELIVERY CLARITY: 2/10 (a completed, receipted, reputation-updated "successful" trade can deliver nothing, silently)
ERROR RECOVERY: 6/10 (Agent U's honest connected/syncing/offline/sync-failed/up-to-date states and no-silent-failure outcome text are real, tested improvements)
UX-P0: **2** — (1) no working independent-buyer discovery path via the shipped UI, (2) digital-content sales can silently "complete" with nothing delivered and no warning.
UX-P1: multiple, logged in `docs/commerce/usability-v3/BUYER-TABLETOP-AFTER.md` and `SELLER-TABLETOP-AFTER.md` (seller shown as "Unknown merchant" to buyers, no seller display-name field, restart doesn't land on/point back to the in-progress order, local-only Nostr-publish default doesn't persist across restarts).
AMAZON-LEVEL: **NO**

---

## VALIDATION

TARGETED: every sub-agent's own targeted suite passed (P: 3 files/49 tests + 7 files/153 tests + 60 files/864 tests; D: 16 files/186 tests; R: 41+ receipt tests + 2 real-restart E2E; U: 36 tests + 70 electron-spike; Coordinator: 933 commerce tests; Fix Round 2: 960/966 + 87/87 structural guards + live two-process E2E 7/7)

test:current: 175 files, **172 passed / 3 failed** (pre-existing WASM-import gap, this worktree has no compiled `pkg/`, confirmed byte-identical to baseline by diff), 2597 tests total, **2594 passed / 3 failed** (same WASM gap) / 3 skipped. (One additional pre-existing-vs-real failure — the package-extraction blocker baseline — was investigated, confirmed a deliberate and mechanically-verified 16→28 increase from reusing the existing Nostr/NIP-44 stack for 2 new private-sync channels exactly as instructed, and fixed by updating the pinned baseline with full documentation, commit `d953c37b`.)

OSS VERIFIER: **PASS** (8/8 checks)
BUILD: **PASS** (typecheck:beta-runtime clean, build:electron-spike clean)
PACKAGE: **PASS** (real `npm ci`, real electron-builder NSIS installer + zip, 110MB/400MB — first attempt hit a transient `7za.exe` DLL-init failure (`0xC0000142`), zero orphan processes, clean retry)
PACKAGE INTEGRITY: **PASS** (6/6, including negative-proof fail-closed dependency-closure checks against the real built `app.asar`/`dist` tree)
REAL TWO-PROCESS FULL E2E: **PASS** (16 real Electron launches, 2 independent profiles, loopback relay only, STEPS 1–10 all PASS)
TWO-PROCESS RESTART: **PASS**
UNEXPECTED EXTERNAL CONTACT: **0** confirmed by every agent
PRIVATE KEY LEAK: **NO**
PUBLIC PUSH: **NO**
FORCE PUSH: **NO**
WORKTREE: **CLEAN** (as of this commit)
REMAINING P0: **2** (independent-buyer discovery; silent-undelivered-digital-content)
REMAINING P1: multiple, see UX section and tabletop docs

---

## 34. FINAL CLASSIFICATION

**FEDOS REAL TWO-PARTY COMMERCE: PARTIAL — boundary: the full technical trade lifecycle (publish, discover, order, accept, authoritative cross-process PAID, deliver, complete, receipt, reputation, two-process restart, offline/reconnect) is PROVEN CORRECT AND SECURE between two genuinely independent Electron processes. It is NOT complete because (a) digital purchased-content delivery is structurally unreachable today — a product can never be marked protected, so a buyer can never receive actual supported content, and the UI does not yet warn when this happens, and (b) an ordinary, independently-onboarded buyer has no reliable path to discover a real seller through the shipped UI outside of an explicitly-configured relay or the built-in demo-fixture identity.**

Neither gap is a payment-authority, security, or crypto-boundary problem — both are pre-existing product-surface gaps this arc's scope did not extend to, confirmed honestly rather than papered over, each independently corroborated by both an engineering investigation and a fresh, uncoached usability pass.
