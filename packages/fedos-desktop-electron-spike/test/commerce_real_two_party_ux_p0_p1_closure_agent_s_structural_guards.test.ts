/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — structural
 * guards, proving by direct source inspection (mirrors
 * `commerce_reachable_catalog_phase1_structural_guards.test.ts`'s own
 * established convention: `readFileSync` + regex, no Electron/WASM
 * artifact required, so these run in ANY environment including one with
 * no compiled `pkg/` and no downloaded Electron binary).
 *
 * Covers items 1-9 of this agent's brief. The AUTHORITATIVE, deepest
 * evidence for item 1 (the "Unknown merchant" P0) is the real, live,
 * fully-executed domain-layer suite at `test/commerce_product_repository.test.ts`
 * and `test/commerce_durable_product_repository.test.ts` (both run under
 * plain `vitest`, no Electron needed at all) — this file's own item-1
 * tests below additionally prove the Electron IPC/renderer wiring calls
 * that domain layer correctly, never re-deriving its own copy of the
 * authority decision.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

const MAIN_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts";
const PRELOAD_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts";
const RENDERER_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts";
const HTML_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html";
const WINDOW_DTS_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_window.d.ts";
const POLICY_PATH = "src/os/commerce/catalog/policy.ts";
const LOCAL_PRODUCT_REPO_PATH = "src/os/commerce/catalog/local_product_repository.ts";
const DURABLE_PRODUCT_REPO_PATH = "src/os/commerce/catalog/persistence/durable_product_repository.ts";

describe("Item 1 -- \"Unknown merchant\" P0 fix: domain-layer actor-role gate on product create", () => {
  it("1. src/os/commerce/catalog/policy.ts defines canCreateProduct(), rejecting anything but an explicit \"merchant\" role", () => {
    const source = stripComments(read(POLICY_PATH));
    expect(source).toMatch(/export function canCreateProduct\(actorRole: "customer" \| "merchant"\): AccessDecision \{/);
    expect(source).toMatch(/actorRole === "merchant"/);
  });

  it("2. LocalProductRepository.create() calls canCreateProduct() and rejects BEFORE constructing a Product (real live enforcement, see test/commerce_product_repository.test.ts for the executed proof)", () => {
    const source = stripComments(read(LOCAL_PRODUCT_REPO_PATH));
    const start = source.indexOf("create(actorPubkey: string, input: CreateProductInput): ProductRepositoryMutationResult {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 900);
    expect(body).toMatch(/canCreateProduct\(input\.actorRole\)/);
    expect(body).toMatch(/outcome: "unauthorized-actor"/);
  });

  it("3. DurableProductRepository.create() enforces the SAME gate (the durable sibling never has a weaker authority check than the in-memory one)", () => {
    const source = stripComments(read(DURABLE_PRODUCT_REPO_PATH));
    const start = source.indexOf("create(actorPubkey: string, input: CreateProductInput): ProductRepositoryMutationResult {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 900);
    expect(body).toMatch(/canCreateProduct\(input\.actorRole\)/);
    expect(body).toMatch(/outcome: "unauthorized-actor"/);
  });

  it("4. handleCommerceProductCreate() requires an explicit actorRole in the IPC payload and forwards it to the domain layer -- never hardcodes \"merchant\", never omits it", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductCreate(payload: unknown) {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1600);
    expect(body).toMatch(/body\.actorRole !== "customer" && body\.actorRole !== "merchant"/);
    expect(body).toMatch(/actorRole: body\.actorRole/);
  });

  it("5. the renderer derives actorRole from whichever identity is actually acting (commerceActorRole()) and passes it explicitly to commerceProductCreate() -- never a hardcoded literal", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function onCommerceMerchantCreateSubmit(): Promise<void> {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 2200);
    expect(body).toMatch(/const actorRole = commerceActorRole\(commerceActingAsPubkey\);/);
    expect(body).toMatch(/if \(actorRole !== "merchant"\) \{/);
    expect(body).toMatch(/window\.fedosApp\.commerceProductCreate\(commerceActingAsPubkey, actorRole, \{/);
  });

  it("6. preload's commerceProductCreate requires actorRole as a real, separate, closed-literal argument (never folded into the free-text input object)", () => {
    const source = stripComments(read(PRELOAD_PATH));
    expect(source).toMatch(/commerceProductCreate: \(actorPubkey: string, actorRole: "customer" \| "merchant", input:/);
    expect(source).toMatch(/actorRole: actorRole === "merchant" \? "merchant" : "customer"/);
  });
});

describe("Item 2 -- real local Persona identity, separated from the demo actor fixture", () => {
  it("7. COMMERCE_DEMO_ACTORS still exists (kept, not deleted) and every entry is explicitly flagged isDemo: true", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("const COMMERCE_DEMO_ACTORS: readonly CommerceActingAsActor[] = [");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 500);
    expect((body.match(/isDemo: true/g) ?? []).length).toBe(3);
  });

  it("8. commerceRealActor() derives the real local identity from localAccountPublicIdentifier/localDisplayLabel (the SAME state window.fedosProfile.status() already establishes), never from a demo fixture, and always asserts role \"merchant\"", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceRealActor(): CommerceActingAsActor | null {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 500);
    expect(body).toMatch(/if \(localAccountPublicIdentifier\.length === 0\) return null;/);
    expect(body).toMatch(/role: "merchant"/);
    expect(body).toMatch(/isDemo: false/);
  });

  it("9. the real identity is re-populated into both \"Acting as\" selectors as soon as a profile becomes ready (renderReady/routeByStatus), not only lazily on next screen visit", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/localDisplayLabel = ready\.displayLabel;\s*\n\s*refreshCommerceActorOptionsForRealIdentity\(\);/);
    expect(source).toMatch(/localDisplayLabel = status\.displayLabel \?\? "";\s*\n\s*refreshCommerceActorOptionsForRealIdentity\(\);/);
  });
});

describe("Item 3 -- product edit, own-product-only authority", () => {
  it("10. commerceProductUpdate is wired end-to-end: preload -> fedos-app:commerce-product-update -> handleCommerceProductUpdate -> LocalProductRepository.update()'s existing canEditProduct() creator-only check (no new authority mechanism invented)", () => {
    const preload = stripComments(read(PRELOAD_PATH));
    expect(preload).toMatch(/commerceProductUpdate: \(actorPubkey: string, productId: string, patch:/);
    const main = stripComments(read(MAIN_PATH));
    expect(main).toMatch(/ipcMain\.handle\("fedos-app:commerce-product-update", async \(_e: IpcMainInvokeEvent, payload: unknown\) => handleCommerceProductUpdate\(payload\)\);/);
    const repo = stripComments(read(LOCAL_PRODUCT_REPO_PATH));
    const updateStart = repo.indexOf("update(actorPubkey: string, productId: string, patch: UpdateProductInput): ProductRepositoryMutationResult {");
    expect(updateStart).toBeGreaterThanOrEqual(0);
    expect(repo.slice(updateStart, updateStart + 400)).toMatch(/canEditProduct\(actorPubkey, existing\)/);
  });

  it("11. the renderer has a real Edit button per product row wired to onCommerceMerchantEditOpen(), and Save calls commerceProductUpdate() with the currently-open product's id", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/editBtn\.addEventListener\("click", \(\) => onCommerceMerchantEditOpen\(product\)\);/);
    const saveStart = source.indexOf("async function onCommerceMerchantEditSave(): Promise<void> {");
    expect(saveStart).toBeGreaterThanOrEqual(0);
    expect(source.slice(saveStart, saveStart + 1200)).toMatch(/window\.fedosApp\.commerceProductUpdate\(commerceActingAsPubkey, commerceEditingProductId, \{/);
  });

  it("12. the Edit form markup exists in the page and is hidden by default", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/<div id="commerce-merchant-edit-form" hidden>/);
    expect(html).toMatch(/id="commerce-merchant-edit-save"/);
  });
});

describe("Item 4 -- Publish/Unpublish P0: explicit semantics, debounce, confirm-on-unpublish-live", () => {
  it("13. Publish and Unpublish are two SEPARATE buttons (never one dual-purpose toggle) -- only one is ever rendered for a given product's status", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceMerchantProductRow(product: FedosCommerceMerchantProduct): HTMLLIElement {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 2200);
    // Coordinator merge note: Agent U layered its own primary/secondary
    // visual-hierarchy class (arc §44) onto these SAME two buttons -- the
    // className now carries both classes, not just this item's own.
    expect(body).toMatch(/unpublishBtn\.className = "commerce-btn-unpublish commerce-btn-secondary";/);
    expect(body).toMatch(/unpublishBtn\.textContent = "Unpublish";/);
    expect(body).toMatch(/publishBtn\.className = "commerce-btn-publish commerce-btn-primary";/);
    expect(body).toMatch(/publishBtn\.textContent = "Publish";/);
    expect(body).toMatch(/if \(isPublished\) \{[\s\S]*?\} else \{/);
  });

  it("14. onCommercePublishAction() disables its own button for the duration of the call and re-enables in a finally block -- the same double-submit guard mechanism secure_runtime_alpha_8121_8200_double_submit_guards.test.ts proves live for onDeviceRevoke()", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function onCommercePublishAction(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1300);
    expect(body).toMatch(/if \(btn\.disabled\) return;/);
    expect(body).toMatch(/btn\.disabled = true;/);
    expect(body).toMatch(/finally \{\s*btn\.disabled = false;\s*\}/);
  });

  it("15. unpublishing is ALWAYS confirmed before the call -- publish is never confirmed (nothing real is removed from buyer view)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function onCommercePublishAction(");
    const body = source.slice(start, start + 900);
    // Buyer Discovery + Digital Content Delivery mega-arc (post-report
    // follow-up fix): the confirmation itself is unchanged in intent
    // (unpublish is always confirmed, publish never is) but is no longer
    // `window.confirm()` -- that native dialog blocks the renderer's whole
    // JS main thread, which reproduced live as a permanently frozen app.
    // It is now the shared in-page `confirmInPage()` dialog, awaited.
    expect(body).toMatch(/action === "unpublish" &&\s*!\(await confirmInPage\(/);
    // ...and it still happens BEFORE the unpublish call actually fires.
    expect(body.indexOf("confirmInPage(")).toBeLessThan(body.indexOf("commerceProductUnpublish("));
  });

  // Buyer Discovery + Digital Content Delivery mega-arc (post-report
  // follow-up fix) -- the durable never-regress guard for the real
  // app-freezing bug a live usability run found: clicking "Unpublish"
  // called `window.confirm()`, whose native dialog suspends the renderer's
  // JS main thread entirely (`Runtime.evaluate("1+1")` never returned).
  // `armDevicePairingApproveConfirm()` had already documented this exact
  // hazard for Device Pairing (Secure Runtime Alpha 8201-8280); this guard
  // makes the rule apply to the whole renderer so no future call site can
  // reintroduce it.
  it("15b. the renderer NEVER calls window.confirm()/alert()/prompt() anywhere -- native JS dialogs block the renderer's JS main thread", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).not.toMatch(/window\.(confirm|alert|prompt)\(/);
    // The replacement primitive really exists and is promise-based (never
    // a synchronous blocking call dressed up with a different name).
    expect(source).toMatch(/function confirmInPage\(title: string, body: string, confirmLabel: string\): Promise<boolean> \{/);
    expect(source).toMatch(/function settleAppConfirm\(confirmed: boolean\): void \{/);
  });

  it("15c. the shared confirmation dialog's markup exists in the page, is hidden by default, and is answerable by ordinary DOM clicks", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/<div id="app-confirm-overlay"[^>]*hidden>/);
    expect(html).toMatch(/id="app-confirm-title"/);
    expect(html).toMatch(/id="app-confirm-body"/);
    expect(html).toMatch(/<button id="app-confirm-accept" type="button"/);
    expect(html).toMatch(/<button id="app-confirm-cancel" type="button"/);
    expect(html).toMatch(/role="dialog" aria-modal="true"/);
  });
});

describe("Item 5/6 -- Merchant dashboard attention + reputation, reusing existing data/queries", () => {
  it("16. attention counts are derived from the SAME orders array commerceOrdersListIncoming() already returns -- no second IPC call inside renderCommerceMerchantAttention()", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).not.toMatch(/function renderCommerceMerchantAttention[\s\S]{0,600}?window\.fedosApp\./);
    // FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- refactored
    // `refreshCommerceMerchantOrdersList()` to extract a
    // `renderCommerceMerchantOrdersList(orders)` render helper (added
    // honest sync-state tracking + "keep the last known list on a failed
    // refresh" -- see that function's own header) -- the invariant this
    // test proves (attention counts derived from the SAME fetched array,
    // never a second IPC call) still holds, re-expressed against the new
    // shape: `renderCommerceMerchantAttention(orders)` is called with the
    // SAME `orders` parameter `renderCommerceMerchantOrdersList` receives,
    // and there is exactly ONE `commerceOrdersListIncoming(` call site
    // across both functions combined.
    const renderStart = source.indexOf("function renderCommerceMerchantOrdersList(orders: readonly FedosCommerceOrder[]): void {");
    expect(renderStart).toBeGreaterThanOrEqual(0);
    const renderBody = source.slice(renderStart, renderStart + 500);
    expect(renderBody).toMatch(/renderCommerceMerchantAttention\(orders\);/);
    const refreshStart = source.indexOf("async function refreshCommerceMerchantOrdersList(): Promise<void> {");
    expect(refreshStart).toBeGreaterThanOrEqual(0);
    const combined = source.slice(renderStart, refreshStart + 1200);
    expect((combined.match(/commerceOrdersListIncoming\(/g) ?? []).length).toBe(1);
    expect(combined).toMatch(/renderCommerceMerchantOrdersList\(commerceMerchantOrdersCache\);/);
  });

  it("17. the Merchant dashboard reputation panel reuses the SAME renderCommercePersonaReputation() the buyer-facing Product Detail panel uses -- one shared function, never a duplicated query", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/async function renderCommerceSellerReputation\(creatorPubkey: string\): Promise<void> \{\s*\n\s*await renderCommercePersonaReputation\(creatorPubkey, "commerce-detail-reputation-summary"\);/);
    expect(source).toMatch(/async function renderCommerceMerchantReputation\(\): Promise<void> \{\s*\n\s*await renderCommercePersonaReputation\(commerceActingAsPubkey, "commerce-merchant-reputation-summary"\);/);
    // Exactly one call site for the real IPC query across both wrappers' shared implementation.
    expect((source.match(/window\.fedosApp\.commercePersonaBoardQuery\(/g) ?? []).length).toBe(1);
  });

  it("18. refreshCommerceMerchantScreen() calls the reputation panel refresh on every Merchant screen entry/actor switch", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function refreshCommerceMerchantScreen(): Promise<void> {");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(source.slice(start, start + 400)).toMatch(/renderCommerceMerchantReputation\(\)/);
  });

  it("19. the dashboard attention panel markup exists in the page", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-merchant-attention-list"/);
    expect(html).toMatch(/id="commerce-merchant-reputation-summary"/);
  });
});

describe("Item 7 -- price/currency UX: integer-safe cents parsing, no float artifacts", () => {
  it("20. parseCommerceDecimalPriceToCents() never multiplies a parsed float by 100 -- splits on the decimal point and parses each integer part separately", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function parseCommerceDecimalPriceToCents(raw: string): number | null {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 900);
    expect(body).not.toMatch(/parseFloat/);
    expect(body).not.toMatch(/Number\(raw\)/);
    expect(body).toMatch(/\/\^\(\\d\+\)\(\?:\\\.\(\\d\{1,2\}\)\)\?\$\//);
    expect(body).toMatch(/wholeUnits \* 100/);
  });

  it("21. the Create Product price field is a decimal text input (not the old raw-integer 'cents' field), with a currency <select> (not free text) and a live preview element", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/<input id="commerce-merchant-create-price" type="text" inputmode="decimal"/);
    expect(html).toMatch(/<select id="commerce-merchant-create-currency">/);
    expect(html).toMatch(/id="commerce-merchant-create-price-preview"/);
    expect(html).not.toMatch(/Price \(cents\)/);
  });

  it("22. onCommerceMerchantCreateSubmit() and onCommerceMerchantEditSave() both reject an unparseable price via parseCommerceDecimalPriceToCents() before any IPC call, never falling back to a sentinel/negative number", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/const priceCents = parseCommerceDecimalPriceToCents\(byId<HTMLInputElement>\("commerce-merchant-create-price"\)\.value\);/);
    expect(source).toMatch(/const priceCents = parseCommerceDecimalPriceToCents\(byId<HTMLInputElement>\("commerce-merchant-edit-price"\)\.value\);/);
  });
});

describe("Item 8 -- draft/unpublished product preview reuses the real detail render path", () => {
  it("23. openCommerceProductPreview() and the ordinary openCommerceProduct() both funnel into the SAME openCommerceProductDetailScreen()/renderCommerceProductDetail() -- never a second, divergent preview renderer", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/async function openCommerceProduct\(productId: string\): Promise<void> \{\s*\n\s*commerceDetailReturnScreen = "commerce";\s*\n\s*await openCommerceProductDetailScreen\(productId\);/);
    expect(source).toMatch(/async function openCommerceProductPreview\(productId: string\): Promise<void> \{\s*\n\s*commerceDetailReturnScreen = "commerce-merchant";\s*\n\s*await openCommerceProductDetailScreen\(productId, commerceActingAsPubkey\);/);
    // Only ONE function in the whole renderer calls renderCommerceProductDetail().
    expect((source.match(/renderCommerceProductDetail\(result\.product\)/g) ?? []).length).toBe(1);
  });

  it("24. the Merchant product row's Preview button calls openCommerceProductPreview(), and a preview-only banner exists in the markup", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/previewBtn\.addEventListener\("click", \(\) => void openCommerceProductPreview\(product\.id\)\);/);
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-detail-preview-banner"/);
  });

  it("25. handleCommerceProductDetail() lets a product's own creator preview a draft/unpublished product (never anyone else), additive to the existing published-only path", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductDetail(payload: unknown) {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1600);
    expect(body).toMatch(/candidate\.creatorPubkey === previewActorPubkey/);
    expect(body).toMatch(/isPreview = true;/);
  });
});

describe("Item 9 -- nav language: \"Commerce\"/\"Merchant\" renamed to \"Shop\"/\"My Store\"", () => {
  it("26. nav-commerce reads \"Shop\" and nav-commerce-merchant reads \"My Store\" -- element ids deliberately unchanged for merge-friendliness with any concurrent nav-language work", () => {
    const html = read(HTML_PATH);
    // Coordinator merge note: Agent U independently landed the identical
    // wording and additionally wired nav count badges (a <span> nested
    // inside the same button, after the text) -- regex intentionally does
    // NOT require an immediately-following </button>, see
    // commerce_reachable_catalog_phase1_structural_guards.test.ts's own
    // matching fix for the same merge.
    expect(html).toMatch(/<button id="nav-commerce" type="button">Shop/);
    expect(html).toMatch(/<button id="nav-commerce-merchant" type="button">My Store/);
  });
});
