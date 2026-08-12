/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc -- Agent U
 * (buyer/systemic robustness) -- structural guards, proving by direct
 * source inspection (never narrative claim alone, mirrors
 * `commerce_reachable_catalog_phase1_structural_guards.test.ts`'s own
 * established convention -- fast, no real Electron launch required).
 *
 * Covers, against `COMMERCE-FRICTION-LEDGER.md` row numbers:
 *   - row 21 (arc §22/§41-42): systematic action-handler robustness sweep
 *   - row 4  (arc §23, P0): order-form quantity resets on product change
 *   - row 6  (arc §24): "Pay Now" naming + idempotencyKey honored
 *   - row 7  (arc §25): waiting-state copy for actionless Order states
 *   - row 9  (arc §27): friendly buyer/seller identity as primary label
 *   - row 12 (arc §26): debug label gated, never deleted
 *   - row 8  (arc §28): nav language ("Shop"/"My Store")
 *   - row 19 (arc §43): responsive "Acting as" selector
 *   - row 23 (arc §44): primary/secondary/destructive button hierarchy
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** HTML-comment-stripped view -- used only where a check must look at USER-VISIBLE markup/text, not this arc's own explanatory `<!-- -->` banners (which legitimately name the very vocabulary they document as forbidden). */
function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

const MAIN_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts";
const PRELOAD_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts";
const RENDERER_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts";
const HTML_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html";
const WINDOW_DTS_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_window.d.ts";
const LOCAL_SIMULATOR_PATH = "src/os/commerce/payment/local_simulator.ts";

describe("Agent U -- row 21: systematic action-handler robustness", () => {
  it("1. every window.fedosApp.commerce*() call site in the renderer is routed through runCommerceAction() (directly, or via the shared onCommerceOrderActionClick wrapper)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const callSites = source.match(/window\.fedosApp\.commerce\w+\(/g) ?? [];
    // Real, re-derived count (never trust the baseline's approximate "14").
    expect(callSites.length).toBeGreaterThanOrEqual(20);
    const runCommerceActionUses = source.match(/runCommerceAction\(/g) ?? [];
    // The helper's own definition is one occurrence; every OTHER occurrence
    // is a real call site (directly, or the one generic
    // onCommerceOrderActionClick wrapper reused by Submit/Cancel/Accept/
    // Fulfill). Coordinator merge note: threshold was 19 pre-merge; Agent
    // S had independently closed the Publish/Unpublish P0 (friction ledger
    // row #3) with its own two-separate-buttons + manual disable/confirm/
    // try-finally guard, per arc §14's own explicit direction against a
    // single ambiguous toggle -- kept over Agent U's competing single-
    // toggle handler (which used runCommerceAction) as the correct design,
    // dropping that one call site deliberately, not by accident.
    expect(runCommerceActionUses.length).toBeGreaterThanOrEqual(18);
  });

  it("2. runCommerceAction() disables its busy buttons before calling, clears the error element first, and always re-enables in a finally", () => {
    const source = stripComments(read(RENDERER_PATH));
    const fnMatch = source.match(/async function runCommerceAction[\s\S]{0,900}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toMatch(/clearError\(errorElementId\)/);
    expect(fn).toMatch(/b\.disabled = true/);
    expect(fn).toMatch(/finally\s*\{/);
    expect(fn).toMatch(/b\.disabled = false/);
  });

  it("3. a genuine thrown/rejected Commerce IPC call is caught and shows a safe, non-stack-trace message -- never silently swallowed", () => {
    const source = stripComments(read(RENDERER_PATH));
    const fnMatch = source.match(/async function runCommerceAction[\s\S]{0,900}?\n\}/);
    const fn = fnMatch![0];
    expect(fn).toMatch(/catch \(err\)/);
    expect(fn).toMatch(/console\.error\(/);
    expect(fn).not.toMatch(/err\.stack/);
    expect(fn).not.toMatch(/textContent = .*\berr\b/); // never interpolates the raw error object into the DOM
    expect(fn).toMatch(/"Something went wrong\. Please try again\."/);
  });

  it("4. reputation-attestation issuance (a secondary, optional operation per arc §42) is no longer silently swallowed -- its real success/failure reaches the renderer and is rendered truthfully", () => {
    const mainSource = stripComments(read(MAIN_PATH));
    expect(mainSource).toMatch(/async function issueReputationAttestationsForCompletedOrderNonFatal\([^)]*\): Promise<boolean>/);
    expect(mainSource).toMatch(/reputationSyncStatus: reputationRecorded \? "recorded" : "unavailable"/);
    const rendererSource = stripComments(read(RENDERER_PATH));
    expect(rendererSource).toMatch(/result\.reputationSyncStatus === "unavailable"/);
    // The CORE transaction (order reaching "completed") is never gated on
    // the secondary one -- `outcome: "ok"` is set regardless. Coordinator
    // merge note: Agent N's own real nostrSyncOutcome field (arc items
    // #4/#5) now sits between `order:` and `reputationSyncStatus:` --
    // both are genuinely truthful, additive, non-blocking fields on the
    // SAME response, not a regression of either.
    //
    // PURCHASE COMPLETION INTEGRATION PHASE (Coordinator): a THIRD such
    // field, `deliverySyncOutcome`, now also sits on this same response
    // (Agent D performed that delivery-sync send but discarded its result;
    // it is captured and reported honestly now). The assertion below was
    // pinning the exact ADJACENCY of two specific fields, which made every
    // future additive non-blocking field a false failure even though the
    // property actually under test was unaffected. It now asserts the real
    // invariant instead -- `outcome: "ok"` plus the order, with each
    // additive field genuinely present on this SAME response object --
    // while still allowing further truthful additive siblings between
    // them. Strictly more faithful to this test's own stated intent, and
    // it still fails if any of the three fields is dropped.
    const completeReturn = mainSource.match(/return \{\s*\n\s*outcome: "ok",\s*\n\s*order: commerceOrderDto\(orderResult\.order\),[\s\S]{0,400}?\n\s*\};/);
    expect(completeReturn).not.toBeNull();
    expect(completeReturn![0]).toMatch(/\n\s*nostrSyncOutcome,/);
    expect(completeReturn![0]).toMatch(/\n\s*deliverySyncOutcome,/);
    expect(completeReturn![0]).toMatch(/\n\s*reputationSyncStatus: reputationRecorded \? "recorded" : "unavailable",/);
  });
});

describe("Agent U -- row 4 (P0, arc §23): order-form quantity resets on product change", () => {
  it("5. openCommerceProductDetailScreen() resets #commerce-order-quantity to a clean default -- the ONLY place currentCommerceDetailProductId changes, so every navigation path to Product Detail is covered", () => {
    const source = stripComments(read(RENDERER_PATH));
    // Coordinator merge note: the real reset logic lives in
    // openCommerceProductDetailScreen() -- openCommerceProduct() itself is
    // a separate, thin wrapper (catalog "View" click ->
    // openCommerceProductDetailScreen(productId)) with no reset logic of
    // its own. Retargeted this regex to the function that actually
    // contains the reset (verified directly in the merged source).
    const fnMatch = source.match(/async function openCommerceProductDetailScreen\([\s\S]{0,1400}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toMatch(/currentCommerceDetailProductId = productId/);
    expect(fn).toMatch(/byId<HTMLInputElement>\("commerce-order-quantity"\)\.value = "1"/);
    // The reset happens BEFORE the async product-detail fetch, not after --
    // otherwise a slow fetch would show the STALE quantity from the
    // previous product while loading.
    const resetIndex = fn.indexOf('byId<HTMLInputElement>("commerce-order-quantity").value = "1"');
    const fetchIndex = fn.indexOf("runCommerceAction");
    expect(resetIndex).toBeGreaterThan(0);
    expect(fetchIndex).toBeGreaterThan(resetIndex);
  });
});

describe("Agent U -- row 6 (arc §24): buyer-facing payment naming + idempotency", () => {
  it("6. the buyer-facing payment CTA reads 'Pay Now', never 'Request Payment', and never leaks PaymentEvidence/SettlementLedger/provider vocabulary into user-visible markup", () => {
    const html = read(HTML_PATH);
    const visibleHtml = stripHtmlComments(html);
    expect(visibleHtml).toMatch(/id="commerce-order-payment-request-btn"[^>]*>Pay Now</);
    expect(visibleHtml).not.toMatch(/>Request Payment</);
    expect(visibleHtml).not.toMatch(/PaymentEvidence|SettlementLedger/);
  });

  it("7. handleCommercePaymentRequest() passes idempotencyKey: order.id to the payment provider, and does not re-bind an idempotent-replay paymentId onto the settlement ledger", () => {
    const source = stripComments(read(MAIN_PATH));
    const fnMatch = source.match(/async function handleCommercePaymentRequest\([\s\S]{0,1600}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toMatch(/idempotencyKey: order\.id/);
    expect(fn).toMatch(/if \(state\.ledger\.get\(decision\.paymentId\) === undefined\) \{/);
  });

  it("8. DeterministicLocalPaymentProvider (the provider actually wired into the Beta app) now honors idempotencyKey the same way PlaceholderPaymentProvider already did -- no second bespoke mechanism invented", () => {
    const source = read(LOCAL_SIMULATOR_PATH);
    expect(source).toMatch(/#idempotency = new Map<string, string>\(\)/);
    expect(source).toMatch(/if \(request\.idempotencyKey !== undefined\) \{/);
    expect(source).toMatch(/idempotent replay/);
  });

  it("9. the CommerceLocalPaymentProviderLike structural mirror in main.cts declares idempotencyKey -- without this the real fix above could never actually reach the provider", () => {
    const source = stripComments(read(MAIN_PATH));
    const ifaceMatch = source.match(/interface CommerceLocalPaymentProviderLike \{[\s\S]{0,700}?\n\}/);
    expect(ifaceMatch, source).not.toBeNull();
    expect(ifaceMatch![0]).toMatch(/idempotencyKey\?: string/);
  });
});

describe("Agent U -- row 7 (arc §25): symmetric waiting-state copy for both roles", () => {
  it("10. commerceOrderWaitingText() covers created/submitted/accepted/paid/fulfilling for whichever role is NOT the one with an action available, using plain language (no raw state-machine jargon as the primary sentence)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const fnMatch = source.match(/function commerceOrderWaitingText\([\s\S]{0,1700}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    const fn = fnMatch![0];
    for (const status of ["created", "submitted", "accepted", "paid", "fulfilling"]) {
      expect(fn, `expected a branch for status "${status}"`).toMatch(new RegExp(`status === "${status}"`));
    }
    expect(fn).toMatch(/waiting on the (buyer|seller)/i);
    expect(fn).not.toMatch(/accepted_placeholder|provider_verified/); // no raw domain-code vocabulary
  });

  it("11. renderCommerceOrderScreen() renders the waiting text into #commerce-order-waiting on every render", () => {
    const source = stripComments(read(RENDERER_PATH));
    // Coordinator merge note: window widened from 3200 -- Agent D's own
    // additive purchased-content-actions block (arc §36) inside this same
    // function pushes later lines further from the function's own start
    // than before the merge (real function length now ~4450 chars).
    const fnMatch = source.match(/function renderCommerceOrderScreen\(\)[\s\S]{0,4600}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    expect(fnMatch![0]).toMatch(/byId\("commerce-order-waiting"\)\.textContent = commerceOrderWaitingText\(/);
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-order-waiting"/);
  });
});

describe("Agent U -- row 9 (arc §27): human-readable identities as the primary label", () => {
  it("12. commerceActorLabel() reuses the SAME friendly COMMERCE_DEMO_ACTORS labels already used by the 'Acting as' selectors", () => {
    const source = stripComments(read(RENDERER_PATH));
    const fnMatch = source.match(/function commerceActorLabel\([\s\S]{0,400}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    expect(fnMatch![0]).toMatch(/COMMERCE_DEMO_ACTORS\.find/);
  });

  it("13. the Order screen shows a friendly Buyer/Seller line, and raw hex ids are demoted to a <details> disclosure -- never deleted", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-order-parties-text"/);
    expect(html).toMatch(/<details id="commerce-order-technical-details">/);
    expect(html).toMatch(/id="commerce-order-id"/);
    expect(html).toMatch(/id="commerce-order-history"/);
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/commerce-order-parties-text"\)\.textContent = `Buyer: \$\{commerceActorLabel\(order\.buyerPubkey\)\}/);
  });

  it("14. My Orders / Incoming Orders list rows show a friendly counterparty name as the primary label, not a raw pubkey", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/title\.textContent = `\$\{commerceActorLabel\(order\.sellerPubkey\)\} — \$\{order\.status\}`/);
    expect(source).toMatch(/title\.textContent = `\$\{commerceActorLabel\(order\.buyerPubkey\)\} — \$\{order\.status\}`/);
  });
});

describe("Agent U -- row 12 (arc §26): debug label gated, never deleted", () => {
  it("15. #current-screen-row is hidden by default in the markup itself; the renderer only removes `hidden` when fedosBeta.debugInstrumentationEnabled is true", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/<p class="muted" id="current-screen-row" hidden>Current screen: <span id="current-screen">loading<\/span><\/p>/);
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/if \(window\.fedosBeta\.debugInstrumentationEnabled\) \{\s*\n\s*byId\("current-screen-row"\)\.hidden = false;/);
  });

  it("16. showScreen() still unconditionally updates #current-screen's textContent -- real E2E tests read this directly via document.querySelector, regardless of the row's visibility", () => {
    const source = stripComments(read(RENDERER_PATH));
    const fnMatch = source.match(/function showScreen\([\s\S]{0,600}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    expect(fnMatch![0]).toMatch(/byId\("current-screen"\)\.textContent = name;/);
  });

  it("17. fedosBeta.debugInstrumentationEnabled is derived from the SAME FEDOS_ELECTRON_BETA_AUTOTEST env var as ACCEPTANCE_MODE_ENABLED, not a new/parallel mechanism", () => {
    const preloadSource = stripComments(read(PRELOAD_PATH));
    expect(preloadSource).toMatch(/AUTOTEST_MODE_ACTIVE = \(process\.env\.FEDOS_ELECTRON_BETA_AUTOTEST \?\? ""\)\.length > 0/);
    expect(preloadSource).toMatch(/debugInstrumentationEnabled: AUTOTEST_MODE_ACTIVE/);
    const dtsSource = stripComments(read(WINDOW_DTS_PATH));
    expect(dtsSource).toMatch(/readonly debugInstrumentationEnabled: boolean;/);
  });
});

describe("Agent U -- row 8 (arc §28): nav language", () => {
  it("18. the Commerce/Merchant nav buttons are relabeled 'Shop'/'My Store' -- ids and screen wiring stay unchanged (buyer-vs-seller reads immediately)", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/<button id="nav-commerce" type="button">Shop/);
    expect(html).toMatch(/<button id="nav-commerce-merchant" type="button">My Store/);
  });
});

describe("Agent U -- row 19 (arc §43): responsive 'Acting as' selector", () => {
  it("19. the 'Acting as' select no longer uses a fixed `width: auto` that can overflow a narrow window -- it can shrink and wrap on BOTH the Commerce and Merchant screens (same shared .commerce-actor-bar class, so this is symmetric by construction)", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/\.commerce-actor-bar \{[^}]*flex-wrap:\s*wrap[^}]*\}/);
    expect(html).toMatch(/\.commerce-actor-bar select\s*\{[^}]*min-width:\s*0;[^}]*\}/);
    expect(html).not.toMatch(/\.commerce-actor-bar select \{ width: auto; \}/);
  });
});

describe("Agent U -- row 23 (arc §44): primary/secondary/destructive action hierarchy", () => {
  it("20. Submit (primary) vs Cancel (secondary), Accept (primary) vs Reject (danger) are visually differentiated by more than color (weight/padding/margin, not just a color swap)", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-order-submit-btn"[^>]*class="commerce-btn-primary"/);
    expect(html).toMatch(/id="commerce-order-cancel-btn"[^>]*class="commerce-btn-secondary"/);
    expect(html).toMatch(/id="commerce-order-accept-btn"[^>]*class="commerce-btn-primary"/);
    expect(html).toMatch(/id="commerce-order-reject-btn"[^>]*class="commerce-btn-danger"/);
    expect(html).toMatch(/button\.commerce-btn-primary \{[^}]*font-weight:\s*700[^}]*\}/);
    expect(html).toMatch(/button\.commerce-btn-danger \{[^}]*margin-left:[^}]*\}/);
  });

  it("21. Publish/Unpublish (Agent S's own two-separate-buttons debounce mechanics, untouched) get the SAME visual-hierarchy treatment applied via a class, not a second bespoke mechanism", () => {
    // Coordinator merge note: Agent U's own original design here was a
    // SINGLE toggle button whose className swapped with state
    // (`publishBtn.className = isPublished ? ... : ...`) -- written without
    // visibility into Agent S's sibling worktree, where S had already
    // closed the Publish/Unpublish P0 (friction ledger row #3) with two
    // separate, explicitly-labeled buttons, per arc §14's own explicit
    // direction against a single ambiguous toggle. The coordinator merge
    // kept S's two-button architecture (the correct P0 fix) and layered
    // this row's primary/secondary classes onto BOTH buttons instead --
    // same visual-hierarchy intent, different (and correct) button count.
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/unpublishBtn\.className = "commerce-btn-unpublish commerce-btn-secondary";/);
    expect(source).toMatch(/publishBtn\.className = "commerce-btn-publish commerce-btn-primary";/);
  });
});
