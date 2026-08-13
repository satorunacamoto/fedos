/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc -- Agent U
 * (Fresh Buyer/Seller UX Closure) -- structural guards, proving by direct
 * source inspection (mirrors `commerce_reachable_catalog_phase1_structural_guards.test.ts`'s
 * own established convention: `readFileSync` + regex, no Electron/WASM
 * artifact required, so these run in ANY environment).
 *
 * Covers this agent's own brief:
 *   1. demo-persona gating (production build never offers a demo fixture)
 *   2. "Unknown merchant" seller-display-name fix (real local identity)
 *   3. Commerce Network Profile durability (persisted across restart)
 *   4. Shop/My Store real-vs-demo mode banner truthfulness
 *   5. restart/order-recovery: "Acting as" auto-defaults to the real
 *      identity, never sticks on a demo fixture
 *   6. pre-checkout delivery-expectation copy
 *   7. error-recovery copy for the named failure modes (grant denied,
 *      content missing/corrupted, seller/listing not found, content
 *      upload rejected, publication stale, seller/buyer offline)
 *   8. actionable order-recovery landing pointer
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

const MAIN_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts";
const RENDERER_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts";
const HTML_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html";

describe("Agent U -- item 1: demo-persona gating (never offered outside explicit test/demo mode)", () => {
  it("1. commerceActingAsOptions() only includes COMMERCE_DEMO_ACTORS when window.fedosBeta.debugInstrumentationEnabled is true", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceActingAsOptions(): readonly CommerceActingAsActor[] {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/commerceDemoActorsVisible\(\)/);
    expect(body).not.toMatch(/return real === null \? COMMERCE_DEMO_ACTORS/); // the old, unconditional-demo-inclusion shape
  });

  it("2. commerceDemoActorsVisible() reuses window.fedosBeta.debugInstrumentationEnabled -- the SAME flag every other test-only affordance in this file already gates on (FEDOS_ELECTRON_BETA_AUTOTEST), never a bespoke/new toggle", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceDemoActorsVisible(): boolean {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/window\.fedosBeta\.debugInstrumentationEnabled/);
  });

  it("3. every existing E2E harness in this package already sets FEDOS_ELECTRON_BETA_AUTOTEST, so demo-actor visibility is unaffected for every existing automated test -- this is a pure production-vs-test gate", () => {
    const e2eFiles = [
      "packages/fedos-desktop-electron-spike/test/commerce_e2e_full_happy_path_real_electron.test.ts",
      "packages/fedos-desktop-electron-spike/test/commerce_e2e_packaged_binary_real_electron.test.ts",
      "packages/fedos-desktop-electron-spike/test/commerce_e2e_restart_persistence_real_electron.test.ts",
      "packages/fedos-desktop-electron-spike/test/commerce_e2e_two_process_real_electron.test.ts",
    ];
    for (const f of e2eFiles) {
      expect(read(f), f).toMatch(/FEDOS_ELECTRON_BETA_AUTOTEST/);
    }
  });
});

describe("Agent U -- item 1/6: 'Acting as' defaults to the real identity, never sticks on a demo fixture across restart", () => {
  it("4. commerceActingAsPubkey starts empty (never pre-seeded with a demo pubkey)", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/let commerceActingAsPubkey = "";/);
    expect(source).not.toMatch(/let commerceActingAsPubkey: string = COMMERCE_DEMO_ACTORS\[0\]/);
  });

  it("5. refreshCommerceActorOptionsForRealIdentity() defaults commerceActingAsPubkey to the real local Persona UNLESS the user already explicitly chose something this session", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function refreshCommerceActorOptionsForRealIdentity(): void {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/commerceRealActor\(\)/);
    expect(body).toMatch(/!commerceActingAsUserExplicitlyChosen/);
    expect(body).toMatch(/commerceActingAsPubkey = real\.pubkey/);
  });

  it("6. setCommerceActingAs() -- called ONLY from a real user 'change'/'input' event -- marks the choice explicit so the auto-default never silently overrides it", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function setCommerceActingAs(pubkey: string): void {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/commerceActingAsUserExplicitlyChosen = true;/);
  });

  it("7. a locked/relocked session resets both the acting-as pubkey and the explicit-choice flag (defense in depth, mirrors localAccountPublicIdentifier's own reset)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function clearAllRendererContentState(): void {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1200);
    expect(body).toMatch(/commerceActingAsPubkey = "";/);
    expect(body).toMatch(/commerceActingAsUserExplicitlyChosen = false;/);
  });

  it("8. renderReady() and routeByStatus() both fetch order/landing-pointer activity AND the real identity default at Ready, so a restart lands the user pointed at their own real activity, not the demo fixture's", () => {
    const source = stripComments(read(RENDERER_PATH));
    for (const fnStart of ["function renderReady(", "function routeByStatus("]) {
      const start = source.indexOf(fnStart);
      expect(start, `${fnStart} not found`).toBeGreaterThanOrEqual(0);
      const body = source.slice(start, start + 1400);
      expect(body, fnStart).toMatch(/refreshCommerceActorOptionsForRealIdentity\(\)/);
      expect(body, fnStart).toMatch(/refreshCommerceLandingPointer\(\)/);
    }
  });
});

describe("Agent U -- item 2: 'Unknown merchant' P1 fix (real seller display name)", () => {
  it("9. commerceMerchantLabelFor() resolves the CURRENT process's own real local identity BEFORE falling back to the demo map", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("function commerceMerchantLabelFor(creatorPubkey: string): string {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/activeLocalIdentity !== null/);
    expect(body).toMatch(/activeLocalIdentity\.displayLabel/);
    expect(body).toMatch(/fedosCommerceDemoMerchantLabel\(creatorPubkey\)/);
  });

  it("10. an unattributed real seller (not the local identity, not a demo fixture) gets an honest 'name not shared yet' label, never the bare, alarming 'Unknown merchant' string", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("function commerceMerchantLabelFor(creatorPubkey: string): string {");
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).not.toMatch(/return "Unknown merchant"/);
    expect(body).toMatch(/display name not shared yet/);
  });

  it("11. activeLocalIdentity is set at the SAME points activeViewerParticipant already is (create/unlock), and cleared at the SAME points it's cleared (lock/shutdown) -- never a second, independently-derived identity source", () => {
    const source = stripComments(read(MAIN_PATH));
    const setCount = (source.match(/activeLocalIdentity = \{ displayLabel: result\.value\.displayLabel, accountPublicIdentifier: result\.value\.accountPublicIdentifier \};/g) ?? []).length;
    expect(setCount).toBe(2); // handleCreate + handleUnlock
    const clearCount = (source.match(/activeLocalIdentity = null;/g) ?? []).length;
    expect(clearCount).toBe(2); // handleLock + performCleanShutdown
  });
});

describe("Agent U -- item 8: Commerce Network Profile durability (persists across restart)", () => {
  it("12. a real, file-backed load/persist pair exists, independent of the closed FedosSettingsDescriptorV1 schema", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/function loadPersistedCommerceNetworkProfile\(\): CommerceNetworkProfileValue \{/);
    expect(source).toMatch(/function persistCommerceNetworkProfile\(profile: CommerceNetworkProfileValue\): void \{/);
    expect(source).toMatch(/function commerceNetworkProfileFilePath\(\): string \{/);
  });

  it("13. loadPersistedCommerceNetworkProfile() fails closed to the safe 'local-only' default on any read/parse problem, never throws", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("function loadPersistedCommerceNetworkProfile(): CommerceNetworkProfileValue {");
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/try \{/);
    expect(body).toMatch(/catch/);
    expect(body).toMatch(/return "local-only";/);
  });

  it("14. handleCommerceNetworkProfileSet() persists the new value (not just the in-memory variable)", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceNetworkProfileSet(payload: unknown) {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/persistCommerceNetworkProfile\(commerceNetworkProfile\);/);
  });

  it("15. the real persisted value is loaded post app.whenReady(), never eagerly at module scope (app.getPath('userData') is only reliable once Electron has reached ready)", () => {
    const source = stripComments(read(MAIN_PATH));
    const readyStart = source.indexOf("app.whenReady().then(async () => {");
    expect(readyStart, source).toBeGreaterThanOrEqual(0);
    const readyBody = source.slice(readyStart, readyStart + 600);
    expect(readyBody).toMatch(/commerceNetworkProfile = loadPersistedCommerceNetworkProfile\(\);/);
  });

  it("16. the Settings HTML/renderer copy no longer claims this resets every launch (that claim became false once this was persisted)", () => {
    const html = read(HTML_PATH);
    expect(html).not.toMatch(/resets to Local Only every launch/);
    const renderer = read(RENDERER_PATH);
    expect(renderer).not.toMatch(/Resets to Local Only on the next launch/);
  });
});

describe("Agent U -- item 2/3: Shop/My Store real-vs-demo mode banner is truthful, not a static claim", () => {
  it("17. renderCommerceCatalogModeBanner() renders different copy for a demo actor vs the real local profile, and reflects the real Commerce Network Profile (local-only vs published) for the real case", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function renderCommerceCatalogModeBanner(): void {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/active\.isDemo/);
    expect(body).toMatch(/commerceNetworkProfileCache === "local-only"/);
    expect(body).toMatch(/commerce-mode-banner/);
    expect(body).toMatch(/commerce-merchant-mode-banner/);
  });

  it("18. the Shop and My Store screens no longer show one unconditional static 'LOCAL DEMO' banner over real content", () => {
    const html = read(HTML_PATH);
    const shopStart = html.indexOf('id="app-screen-commerce"');
    const shopSection = html.slice(shopStart, html.indexOf('id="app-screen-commerce-detail"', shopStart));
    expect(shopSection).toMatch(/id="commerce-mode-banner"/);
    expect(shopSection).not.toMatch(/<p class="muted">Fictional\/local demo data only — nothing here is a real product/);
    const storeStart = html.indexOf('id="app-screen-commerce-merchant"');
    const storeSection = html.slice(storeStart, storeStart + 800);
    expect(storeSection).toMatch(/id="commerce-merchant-mode-banner"/);
    expect(storeSection).not.toMatch(/<p class="muted">Fictional\/local demo data only\.</);
  });
});

describe("Agent U -- item 5: pre-checkout delivery-expectation copy (never only discovered after payment)", () => {
  it("19. Product Detail HTML has a dedicated delivery-expectation element, present BEFORE the order form", () => {
    const html = stripHtmlComments(read(HTML_PATH));
    const detailStart = html.indexOf('id="app-screen-commerce-detail"');
    const detailEnd = html.indexOf('<div class="app-screen"', detailStart + 10);
    const detailSection = html.slice(detailStart, detailEnd);
    const deliveryIdx = detailSection.indexOf('id="commerce-detail-delivery-expectation"');
    const orderFormIdx = detailSection.indexOf('id="commerce-detail-order-form"');
    expect(deliveryIdx).toBeGreaterThan(0);
    expect(orderFormIdx).toBeGreaterThan(0);
    expect(deliveryIdx).toBeLessThan(orderFormIdx);
  });

  it("20. renderCommerceProductDetail() actually populates the delivery-expectation text (never left blank)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function renderCommerceProductDetail(product: FedosCommerceProductDetail): void {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/commerce-detail-delivery-expectation/);
    expect(body).toMatch(/deliveryExpectationText/);
  });

  it("21. the Product Detail screen still never mentions pay/paid anywhere (payment stays one screen later, on Order) -- the delivery-expectation copy was deliberately worded to preserve this existing guard", () => {
    const html = stripHtmlComments(read(HTML_PATH));
    const detailStart = html.indexOf('id="app-screen-commerce-detail"');
    const detailEnd = html.indexOf('<div class="app-screen"', detailStart + 10);
    const detailSection = html.slice(detailStart, detailEnd);
    expect(detailSection).not.toMatch(/pay|paid/i);
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function renderCommerceProductDetail(product: FedosCommerceProductDetail): void {");
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).not.toMatch(/"[^"]*\bpaid\b[^"]*"/i);
  });
});

describe("Agent U -- item 7: error-recovery copy for grant denied / content missing / content corrupted", () => {
  it("22. COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT covers the real closed denial vocabulary from media_access_grant_policy.ts, never a bare jargon string shown to a buyer", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("const COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT: Readonly<Record<string, string>> = {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n};", start) + 3);
    for (const key of [
      "no-grant-on-file",
      "content-unavailable",
      "wrap-unavailable",
      "buyer-mismatch",
      "wrong-signer",
      "expired",
      "revoked",
      "superseded",
    ]) {
      expect(body, `expected a "${key}" entry`).toMatch(new RegExp(`(^|\\s)${key.replace(/[-]/g, "\\-")}:|"${key}":`));
    }
  });

  it("23. onCommerceOpenPurchasedContentClick() routes every denial through commercePurchasedContentDenialText(), never the raw reason unconditionally", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function onCommerceOpenPurchasedContentClick(): Promise<void> {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/commercePurchasedContentDenialText\(result\.outcome, result\.reason\)/);
  });
});

describe("Agent U -- item 7: 'seller not found'/'listing unavailable' error-recovery copy", () => {
  it("24. showCommerceProductDetailNotFoundError() gives plain-language remediation for the not-found outcome, never a bare 'Not found.'", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function showCommerceProductDetailNotFoundError(");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/isn't available/);
    expect(body).toMatch(/result\.outcome === "not-found"/);
  });

  it("25. openCommerceProductDetailScreen() uses the dedicated not-found handler on a failed fetch", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function openCommerceProductDetailScreen(productId: string, previewActorPubkey?: string): Promise<void> {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/showCommerceProductDetailNotFoundError\(result\)/);
  });
});

describe("Agent U -- item 7: content upload rejected (friendlier copy)", () => {
  it("26. the product-image-attach error path translates the two most common technical rejections into plain language", () => {
    const source = stripComments(read(RENDERER_PATH));
    const idx = source.indexOf("function commerceMerchantProductImageAttachControls(productId: string): HTMLDivElement {");
    expect(idx).toBeGreaterThanOrEqual(0);
    const body = source.slice(idx, idx + 2600);
    expect(body).toMatch(/This file type isn't supported\. Only PNG or JPEG images can be attached\./);
    expect(body).toMatch(/Couldn't read that image file/);
  });
});

describe("Agent U -- item 7: publication stale + seller/buyer offline reassurance copy", () => {
  it("27. My Store honestly discloses that publishing is fire-and-forget (no live staleness check exists)", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-merchant-products-staleness-note"/);
    expect(html).toMatch(/cannot confirm it's still there later/);
  });

  it("28. commerceOrderWaitingText() reassures a waiting party that an offline counterparty doesn't lose or expire anything", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceOrderWaitingText(status: string, isBuyer: boolean, isSeller: boolean): string {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/offline/i);
  });
});

describe("Agent U -- item 6: order-recovery landing pointer is actionable, not text-only", () => {
  it("29. the landing pointer has real 'Go to Shop'/'Go to My Store' controls, toggled independently by buyer vs seller activity", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-landing-pointer-shop-btn"/);
    expect(html).toMatch(/id="commerce-landing-pointer-store-btn"/);
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function refreshCommerceLandingPointer(): Promise<void> {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/hasBuyerActivity/);
    expect(body).toMatch(/hasSellerActivity/);
    expect(body).toMatch(/shopBtn\.toggleAttribute\("hidden", !hasBuyerActivity\)/);
    expect(body).toMatch(/storeBtn\.toggleAttribute\("hidden", !hasSellerActivity\)/);
  });

  it("30. clicking either button navigates via the SAME screen/refresh calls as the corresponding nav button (never a second, divergent navigation path)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const idx = source.indexOf('byId<HTMLButtonElement>("commerce-landing-pointer-shop-btn").addEventListener("click"');
    expect(idx).toBeGreaterThanOrEqual(0);
    const body = source.slice(idx, idx + 500);
    expect(body).toMatch(/showAppScreen\("commerce"\)/);
    expect(body).toMatch(/refreshCommerceCatalogList\(\)/);
    expect(body).toMatch(/showAppScreen\("commerce-merchant"\)/);
    expect(body).toMatch(/refreshCommerceMerchantScreen\(\)/);
  });
});

describe("Agent U -- item 2: 'how do I share my store/product?' UI surface (honest, coordinates with Agent D's plumbing)", () => {
  it("32. a per-product 'Copy Share Info' control exists in My Store, and a 'Copy My Store Info' control exists at the top of My Store", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/function commerceMerchantProductShareControls\(product: FedosCommerceMerchantProduct\): HTMLDivElement \{/);
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-merchant-share-store"/);
  });

  it("33. the share copy is honest about what it does NOT yet guarantee -- the recipient still needs a working Relay connection, and this is not yet a verified/signed proof", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceMerchantProductShareControls(");
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/needs a working Relay connection/);
    expect(body).toMatch(/not yet a verified\/signed proof/);
    const html = read(HTML_PATH);
    expect(html).toMatch(/They'll still need a working Relay connection/);
  });
});

describe("Agent U -- SELLER-TABLETOP-AFTER.md: 'Attach Image is a red herring for delivery'", () => {
  it("34. the per-product image-attach control now carries an explicit caption distinguishing it from deliverable-content upload (which this build genuinely does not have)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceMerchantProductImageAttachControls(productId: string): HTMLDivElement {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 900);
    expect(body).toMatch(/not where you attach the digital content buyers will receive/);
  });
});

describe("Agent U -- commerceActorLabel() also resolves the current user's own real display label (order-party labels), not only demo fixtures", () => {
  it("31. a pubkey matching the local real identity resolves to the real displayLabel, checked BEFORE the demo-fixture lookup", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceActorLabel(pubkey: string): string {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    const localIdx = body.indexOf("localAccountPublicIdentifier");
    const demoIdx = body.indexOf("COMMERCE_DEMO_ACTORS.find");
    expect(localIdx).toBeGreaterThan(0);
    expect(demoIdx).toBeGreaterThan(0);
    expect(localIdx).toBeLessThan(demoIdx);
  });
});

/**
 * REGRESSION GUARDS for the live, severe blocker this arc's own item-1
 * demo-persona gating exposed and that a fresh-buyer usability tester
 * found on the real packaged app: with the demo fixtures correctly hidden
 * from production, Product Detail's order-form gate
 * (`commerceActorRole(commerceActingAsPubkey) === "customer"`) became
 * UNCONDITIONALLY false -- the only actor ever labelled `role: "customer"`
 * was the demo customer fixture, and `commerceRealActor()` hard-codes
 * every real Persona to `"merchant"`. No real user could order anything.
 *
 * These guards pin the CORRECT condition so the two changes can never
 * drift apart again: ordering is gated on OWNERSHIP (a real identity may
 * order any product it does not itself own), never on demo-fixture role
 * membership.
 */
describe("Agent U -- item 1 REGRESSION: hiding the demo personas must never also hide the buyer order form", () => {
  it("35. the Product Detail order-form gate is ownership-based (actingAs vs product.creatorPubkey) and never asks whether the acting identity has the demo-only \"customer\" role", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceProductOrderAvailability(product: FedosCommerceProductDetail):");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/commerceActingAsPubkey === product\.creatorPubkey/);
    expect(body).not.toMatch(/commerceActorRole/);
    expect(body).not.toMatch(/"customer"/);
  });

  it("36. renderCommerceProductDetail() drives BOTH the order form and the unavailable note from that one ownership decision -- no surviving isCustomer/role check", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function renderCommerceProductDetail(product: FedosCommerceProductDetail): void {");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    expect(body).toMatch(/commerceProductOrderAvailability\(product\)/);
    expect(body).toMatch(/commerce-detail-order-form/);
    expect(body).toMatch(/commerce-detail-order-unavailable-note/);
    expect(body).not.toMatch(/isCustomer/);
    expect(body).not.toMatch(/commerceActorRole/);
  });

  it("37. commerceActorRole() survives ONLY where a genuine MERCHANT capacity is asserted (product creation) -- never on the buyer path", () => {
    const source = stripComments(read(RENDERER_PATH));
    const callSites = source.split("commerceActorRole(").length - 1;
    // one definition + exactly one call site (onCommerceMerchantCreateSubmit)
    expect(callSites).toBe(2);
    const createStart = source.indexOf("async function onCommerceMerchantCreateSubmit(): Promise<void> {");
    const createBody = source.slice(createStart, source.indexOf("\n}", createStart) + 2);
    expect(createBody).toMatch(/const actorRole = commerceActorRole\(commerceActingAsPubkey\);/);
  });

  it("38. self-dealing is still refused, and the UI gate mirrors the domain rule createOrder() independently enforces", () => {
    const domain = stripComments(read("src/os/commerce/order/order_state_machine.ts"));
    expect(domain).toMatch(/actor\.pubkey === input\.sellerPubkey/);
    expect(domain).toMatch(/"self_dealing"/);
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/commerceActingAsPubkey === product\.creatorPubkey/);
  });

  it("39. the order-unavailable note no longer tells the user to switch to a \"customer identity\" -- an instruction no real build could satisfy (no such option exists anywhere)", () => {
    // Comments are stripped first: the replacement markup deliberately
    // KEEPS a comment naming the removed instruction, so a future reader
    // knows why the element is empty. Only real, user-visible copy is
    // asserted against.
    const html = stripHtmlComments(read(HTML_PATH));
    expect(html).not.toMatch(/customer identity/i);
    const source = stripComments(read(RENDERER_PATH));
    expect(source).not.toMatch(/Switch "Acting as" to a customer identity/);
    // the static markup is deliberately empty; the renderer owns this text
    expect(html).toMatch(/<p class="muted" id="commerce-detail-order-unavailable-note" hidden><\/p>/);
  });
});
