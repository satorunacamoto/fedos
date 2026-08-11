/**
 * Commerce Reachable Catalog + Product Surface, Phase 1 — structural
 * guards, proving by direct source inspection (never narrative claim
 * alone, mirrors `secure_runtime_alpha_8041_8120_structural_guards.test.ts`'s
 * own established convention).
 *
 * UPDATED (Commerce E2E Completion arc, coordinator integration gate):
 * Phase 1 was deliberately read-only-catalog-only; tests 2/3/4/6/8/9/17
 * below encoded that exact boundary as "never Order/Payment/PaymentProvider
 * reachable at all". This arc's own explicit, sanctioned mission is to
 * widen that boundary safely — Order and a LOUDLY-labeled TEST/LOCAL
 * `DeterministicLocalPaymentProvider` (never `PlaceholderPaymentProvider`,
 * never `ingestCallback`) are now real and reachable. Those 7 tests are
 * updated below to assert the NEW correct boundary rather than deleted —
 * every original safety property (no unauthenticated settlement path, no
 * PAID forgeable by a bare claim, bounded validated IPC, reachable without
 * a profile) is re-asserted in its new, still-real form:
 *
 *   - `createCommerce()`'s barrel is genuinely wired into the real
 *     composition root (`loadRootModules()`), via the compiled `dist/`
 *     graph like every other module, not a parallel app.
 *   - The full `fedos-app:commerce-*` IPC channel family is bounded and
 *     enumerated exactly, reuses the existing `fedos-app:*` validation
 *     discipline, and is never gated on a Coordinator/Shell (Commerce must
 *     be reachable even before a profile exists).
 *   - `PlaceholderPaymentProvider`/`ingestCallback` — the historically
 *     unauthenticated settlement path — is never imported/constructed/
 *     reachable from this slice. The one payment provider THIS slice can
 *     reach, `DeterministicLocalPaymentProvider`, is the loudly-labeled
 *     TEST/LOCAL simulator (`payment/local_simulator.ts`'s own header),
 *     never a real rail, and the preload channel it's exposed through
 *     accepts only two opaque id strings — never a status/evidence shape
 *     the renderer could use to dictate an outcome.
 *   - Media rendering never uses `innerHTML`, never accepts an unsafe
 *     scheme, and always has a safe fallback.
 *   - No "Buy Now"/instant-purchase control or "Mark as Paid" control
 *     exists anywhere — a real "Create Order" control now does (by
 *     design), but every path to PAID still requires the local simulator's
 *     own explicit two-step request→simulate flow, never a single click.
 *   - The pre-existing Messenger UI/IPC vocabulary is untouched.
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
const DEMO_CATALOG_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_commerce_demo_catalog.ts";
const BETA_RUNTIME_TSCONFIG_PATH = "tsconfig.beta-runtime.json";

describe("Commerce Reachable Catalog Phase 1 -- composition root wiring", () => {
  it("1. src/os/commerce/index.ts is included in the beta-runtime build allowlist -- without this, dist/commerce/index.js is never produced and the dynamic import below cannot resolve", () => {
    const tsconfig = read(BETA_RUNTIME_TSCONFIG_PATH);
    expect(tsconfig).toMatch(/"src\/os\/commerce\/index\.ts"/);
  });

  it("2. loadRootModules() dynamically imports the real os/commerce barrel and takes ONLY the Commerce E2E Completion arc's own explicitly-widened name set -- never PlaceholderPaymentProvider/ingestCallback/createCommerce/marketplace inside main.cts itself", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/distUrl\("os", "commerce", "index\.js"\)/);
    expect(source).toMatch(/listViewableProducts:\s*RootModules\["Commerce"\]\["listViewableProducts"\]/);
    // The commerce dynamic-import block's destructured shape names exactly the arc's own widened, reviewed set.
    const importBlockMatch = source.match(/const commerce = \(await import\(distUrl\("os", "commerce", "index\.js"\)\)\) as \{([\s\S]{0,1600}?)\};/);
    expect(importBlockMatch, source).not.toBeNull();
    const importBlock = importBlockMatch![1];
    for (const name of [
      "listViewableProducts", "LocalProductRepository", "LocalOrderRepository", "createOrder", "applyOrderAction",
      "DeterministicLocalPaymentProvider", "PaymentSettlementLedger", "LocalDeliveryRepository", "createDelivery",
      "applyDeliveryAction", "issueSignedTradeReceiptProof", "verifySignedTradeReceiptProof",
      "encodeCommerceReceiptProofToQrText", "decodeCommerceReceiptProofFromQrText",
    ]) {
      expect(importBlock, `expected commerce import block to name ${name}`).toMatch(new RegExp(name));
    }
    expect(importBlock).not.toMatch(/PlaceholderPaymentProvider/);
    expect(importBlock).not.toMatch(/ingestCallback/);
    expect(importBlock).not.toMatch(/createCommerce/);
    expect(importBlock).not.toMatch(/marketplace/i);
  });

  it("3. RootModules.Commerce exposes exactly the Commerce E2E Completion arc's own reviewed name set -- no PlaceholderPaymentProvider/marketplace field, never the raw createCommerce() factory", () => {
    const source = stripComments(read(MAIN_PATH));
    const fieldMatch = source.match(/readonly Commerce: \{([\s\S]{0,1900}?)\n  \};/);
    expect(fieldMatch, source).not.toBeNull();
    const field = fieldMatch![1];
    for (const name of [
      "listViewableProducts", "LocalProductRepository", "LocalOrderRepository", "createOrder", "applyOrderAction",
      "DeterministicLocalPaymentProvider", "PaymentSettlementLedger", "LocalDeliveryRepository", "createDelivery",
      "applyDeliveryAction", "issueSignedTradeReceiptProof", "verifySignedTradeReceiptProof",
      "encodeCommerceReceiptProofToQrText", "decodeCommerceReceiptProofFromQrText",
    ]) {
      expect(field, `expected RootModules.Commerce to declare ${name}`).toMatch(new RegExp(name));
    }
    expect(field).not.toMatch(/marketplace|PlaceholderPaymentProvider/i);
    expect(field).not.toMatch(/:\s*new\s*\([^)]*\)\s*=>\s*Commerce\b/); // never the raw createCommerce() factory type
  });
});

describe("Commerce Reachable Catalog Phase 1 -- bounded IPC family", () => {
  it("4. exactly the Commerce E2E Completion arc's own reviewed set of fedos-app:commerce-* channels are registered, unconditionally (never gated on ACCEPTANCE_MODE_ENABLED), and none outside that set exists", () => {
    const source = stripComments(read(MAIN_PATH));
    const channelMatches = source.match(/ipcMain\.handle\("fedos-app:commerce-[a-z-]+",/g) ?? [];
    const EXPECTED_CHANNELS = [
      "commerce-catalog-list",
      "commerce-product-detail",
      "commerce-merchant-products-list",
      "commerce-product-create",
      "commerce-product-update",
      "commerce-product-publish",
      "commerce-product-unpublish",
      "commerce-order-create",
      "commerce-order-submit",
      "commerce-order-cancel",
      "commerce-order-accept",
      "commerce-order-reject",
      "commerce-order-fulfill",
      "commerce-orders-list-mine",
      "commerce-orders-list-incoming",
      "commerce-payment-request",
      "commerce-payment-simulate",
      "commerce-delivery-status",
      "commerce-delivery-acknowledge-receipt",
      "commerce-order-complete",
      "commerce-receipt-issue",
    ];
    expect(channelMatches.length).toBe(EXPECTED_CHANNELS.length);
    for (const channel of EXPECTED_CHANNELS) {
      expect(source, `expected channel ${channel} to be registered`).toMatch(new RegExp(`ipcMain\\.handle\\("fedos-app:${channel}",`));
    }
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-catalog-list",\s*async \(\)\s*=>\s*handleCommerceCatalogList\(\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-product-detail",\s*async \([^)]*\)\s*=>\s*handleCommerceProductDetail\(payload\)\);/);
    // None of these registrations sits inside an `if (ACCEPTANCE_MODE_ENABLED)` block -- re-verified
    // structurally (not just "not gated" by absence of the word) by confirming every commerce
    // registration line, sliced out of the full registration function, has no enclosing acceptance guard
    // between it and the nearest preceding top-level statement.
    for (const channel of EXPECTED_CHANNELS) {
      const idx = source.indexOf(`"fedos-app:${channel}"`);
      const precedingSlice = source.slice(Math.max(0, idx - 400), idx);
      expect(precedingSlice, `expected ${channel} registration to not be inside an ACCEPTANCE_MODE_ENABLED guard`).not.toMatch(/if \(ACCEPTANCE_MODE_ENABLED\)\s*\{[^}]*$/);
    }
  });

  it("5. the product-detail handler bounds/validates productId the same way every other fedos-app:* handler does (isBoundedString + MAX_ID_LENGTH), never trusts an unvalidated payload field", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductDetail");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const handlerBody = source.slice(start, start + 600);
    expect(handlerBody).toMatch(/isBoundedString\(productId, MAX_ID_LENGTH\)/);
    expect(handlerBody).toMatch(/return \{ outcome: "invalid-input"/);
  });

  it("6. neither read-only Commerce handler is gated on requireShell()/requireBoundary() -- Commerce discovery must be reachable even before any profile exists (0 network/profile dependency); commerceState() itself is equally ungated", () => {
    const source = stripComments(read(MAIN_PATH));
    const mainSection = source.slice(source.indexOf("function commerceMerchantLabelFor"), source.indexOf("async function handleCommerceProductDetail") + 800);
    expect(mainSection).not.toMatch(/requireShell\(\)/);
    expect(mainSection).not.toMatch(/requireBoundary\(\)/);
    // Commerce E2E Completion arc: catalog now reads through the live, mutable
    // repository (`commerceState().products.listPublished()`) rather than the static
    // array directly -- `listPublished()` itself applies the SAME real
    // `listViewableProducts()` domain policy internally (`local_product_repository.ts`).
    expect(mainSection).toMatch(/commerceState\(\)\.products\.listPublished\(\)/);
    const stateFnStart = source.indexOf("function commerceState(): {");
    expect(stateFnStart, source).toBeGreaterThanOrEqual(0);
    const stateFnBody = source.slice(stateFnStart, source.indexOf("\n}\n", stateFnStart) + 3);
    expect(stateFnBody).not.toMatch(/requireShell\(\)/);
    expect(stateFnBody).not.toMatch(/requireBoundary\(\)/);
    expect(stateFnBody).toMatch(/requireModules\(\)/);
  });
});

describe("Commerce Reachable Catalog Phase 1 -- dormant payment callback stays unreachable", () => {
  it("7. main.cts never references PlaceholderPaymentProvider or ingestCallback -- the new Catalog slice cannot make the dormant, unauthenticated settlement callback reachable", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).not.toMatch(/PlaceholderPaymentProvider/);
    expect(source).not.toMatch(/ingestCallback/);
  });

  it("8. exactly two payment-named IPC channels exist, both routed through the TEST/LOCAL simulator + PaymentSettlementLedger -- never a raw provider-agnostic 'ingestCallback' passthrough channel", () => {
    const source = stripComments(read(MAIN_PATH));
    const paymentChannels = source.match(/ipcMain\.handle\("[^"]*payment[^"]*"/gi) ?? [];
    expect(paymentChannels.sort()).toEqual([
      'ipcMain.handle("fedos-app:commerce-payment-request"',
      'ipcMain.handle("fedos-app:commerce-payment-simulate"',
    ].sort());
    expect(source).toMatch(/async function handleCommercePaymentRequest[\s\S]{0,900}?state\.payments\.requestPayment/);
    expect(source).toMatch(/async function handleCommercePaymentSimulate[\s\S]{0,1400}?state\.payments\.simulateSettlement/);
    expect(source).toMatch(/async function handleCommercePaymentSimulate[\s\S]{0,1800}?state\.ledger\.apply/);
    expect(source).not.toMatch(/ingestCallback/);
  });

  it("9. the preload bridge's two payment-shaped methods accept ONLY opaque orderId/paymentId strings -- never a status/evidence/verification field the renderer could use to dictate an outcome", () => {
    const source = stripComments(read(PRELOAD_PATH));
    const requestMatch = source.match(/commercePaymentRequest:\s*\([^)]*\)\s*=>[\s\S]{0,200}?\)/);
    expect(requestMatch, source).not.toBeNull();
    expect(requestMatch![0]).toMatch(/orderId: string/);
    expect(requestMatch![0]).not.toMatch(/status|evidence|verification|outcome|paid/i);
    const simulateMatch = source.match(/commercePaymentSimulate:\s*\([^)]*\)\s*=>[\s\S]{0,250}?\)/);
    expect(simulateMatch, source).not.toBeNull();
    expect(simulateMatch![0]).toMatch(/orderId: string, paymentId: string/);
    expect(simulateMatch![0]).not.toMatch(/status|evidence|verification|outcome|paid/i);
  });

  it("10. the demo catalog module imports nothing from os/commerce/payment -- Phase 1's demo data is catalog-only", () => {
    const source = stripComments(read(DEMO_CATALOG_PATH));
    expect(source).not.toMatch(/payment/i);
  });
});

describe("Commerce Reachable Catalog Phase 1 -- preload/type surface", () => {
  it("11. fedosApp exposes commerceCatalogList/commerceProductDetail using the same boundedString discipline as every other method", () => {
    const source = stripComments(read(PRELOAD_PATH));
    expect(source).toMatch(/commerceCatalogList: \(\) => ipcRenderer\.invoke\("fedos-app:commerce-catalog-list"\)/);
    expect(source).toMatch(/commerceProductDetail: \(productId: string\) => ipcRenderer\.invoke\("fedos-app:commerce-product-detail", \{ productId: boundedString\(productId, MAX_ID_CHARS\) \}\)/);
  });

  it("12. FedosAppBridge's .d.ts declares both new methods with typed results", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    expect(source).toMatch(/commerceCatalogList: \(\) => Promise<FedosCommerceCatalogListResult>/);
    expect(source).toMatch(/commerceProductDetail: \(productId: string\) => Promise<FedosCommerceProductDetailResult>/);
  });
});

describe("Commerce Reachable Catalog Phase 1 -- media safety", () => {
  it("13. the renderer's image-safety guard accepts ONLY an exact data:image/png;base64, prefix -- no javascript:/file://svg/https:/remote scheme of any kind", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/function isSafeCommerceImageDataUri\(value: string\): boolean \{\s*\n\s*return value\.startsWith\("data:image\/png;base64,"\)/);
  });

  it("14. buildCommerceMediaElement never uses innerHTML and always has an onerror fallback to the safe initials placeholder", () => {
    const source = stripComments(read(RENDERER_PATH));
    const fnMatch = source.match(/function buildCommerceMediaElement\([\s\S]{0,1400}?\n\}/);
    expect(fnMatch, source).not.toBeNull();
    expect(fnMatch![0]).not.toMatch(/innerHTML/);
    expect(fnMatch![0]).toMatch(/addEventListener\("error"/);
    expect(fnMatch![0]).toMatch(/commerceProductInitials/);
  });

  it("15. the CSP meta tag allows images ONLY from 'self' and data: -- never a remote scheme, never a wildcard, connect-src stays 'none' (0 network contact)", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/img-src 'self' data:/);
    expect(html).toMatch(/connect-src 'none'/);
    expect(html).not.toMatch(/img-src[^;]*\*/);
    expect(html).not.toMatch(/img-src[^;]*https:/);
  });

  it("16. the demo catalog ships exactly one image asset (aurora-study), and it is a real PNG data URI with a matching sha256 contentHash", async () => {
    const mod = (await import("../src/fedos_electron_beta_commerce_demo_catalog.js")) as {
      FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA: Readonly<Record<string, { readonly dataUri: string; readonly contentHash: string; readonly mimeType: string }>>;
    };
    const keys = Object.keys(mod.FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA);
    expect(keys).toEqual(["aurora-study"]);
    const media = mod.FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA["aurora-study"]!;
    expect(media.mimeType).toBe("image/png");
    expect(media.dataUri.startsWith("data:image/png;base64,")).toBe(true);
    const b64 = media.dataUri.slice("data:image/png;base64,".length);
    const bytes = Buffer.from(b64, "base64");
    const { createHash } = await import("node:crypto");
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    expect(actualHash).toBe(media.contentHash);
  });
});

describe("Commerce E2E Completion arc -- real Order control, but no fake instant-purchase/mark-as-paid control anywhere", () => {
  it("17. the product detail screen's ONLY commerce action is a real, bounded 'Create Order' control -- no 'Buy Now'/instant-purchase button, and PAID is never one click away from Product Detail", () => {
    const html = read(HTML_PATH);
    const detailSection = html.slice(html.indexOf('id="app-screen-commerce-detail"'), html.indexOf('id="app-screen-commerce-order"'));
    expect(detailSection).not.toMatch(/>Buy</i);
    expect(detailSection).not.toMatch(/>Buy Now</i);
    expect(detailSection).not.toMatch(/>Purchase</i);
    expect(detailSection).not.toMatch(/>Checkout</i);
    expect(detailSection).not.toMatch(/pay|paid/i);
    // Exactly one real, bounded control: Create Order.
    expect(detailSection).toMatch(/id="commerce-order-create-submit"[^>]*>Create Order</);
  });

  it("18b. no control anywhere in the whole page lets the renderer directly claim/mark an order PAID -- 'Simulate Payment' is the ONLY payment-adjacent control, and it is loudly labeled TEST/LOCAL, never a bare 'Mark as Paid' checkbox/button", () => {
    const html = read(HTML_PATH);
    expect(html).not.toMatch(/>Mark as [Pp]aid</);
    expect(html).not.toMatch(/type="checkbox"[^>]*>\s*Paid/i);
    expect(html).toMatch(/id="commerce-order-payment-simulate-btn"[^>]*>Simulate Payment \(TEST\/LOCAL\)/);
    expect(html).toMatch(/commerce-sim-pill">NOT REAL MONEY</);
  });
});

describe("Commerce Reachable Catalog Phase 1 -- synthetic demo catalog shape", () => {
  it("18. exactly 3 products, 2 distinct merchant identities, at least 1 product with an image and at least 1 without, no real customer/business data", async () => {
    const mod = (await import("../src/fedos_electron_beta_commerce_demo_catalog.js")) as {
      FEDOS_COMMERCE_DEMO_PRODUCTS: readonly { readonly id: string; readonly title: string; readonly status: string; readonly visibility: string; readonly creatorPubkey: string }[];
      FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA: Readonly<Record<string, unknown>>;
      FEDOS_COMMERCE_DEMO_MERCHANT_LABELS: Readonly<Record<string, string>>;
    };
    expect(mod.FEDOS_COMMERCE_DEMO_PRODUCTS.length).toBe(3);
    const merchants = new Set(mod.FEDOS_COMMERCE_DEMO_PRODUCTS.map((p) => p.creatorPubkey));
    expect(merchants.size).toBe(2);
    expect(Object.keys(mod.FEDOS_COMMERCE_DEMO_MERCHANT_LABELS).length).toBe(2);
    const withImage = mod.FEDOS_COMMERCE_DEMO_PRODUCTS.filter((p) => p.id in mod.FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA);
    const withoutImage = mod.FEDOS_COMMERCE_DEMO_PRODUCTS.filter((p) => !(p.id in mod.FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA));
    expect(withImage.length).toBeGreaterThanOrEqual(1);
    expect(withoutImage.length).toBeGreaterThanOrEqual(1);
    for (const p of mod.FEDOS_COMMERCE_DEMO_PRODUCTS) {
      expect(p.status).toBe("active");
      expect(p.visibility).toBe("public");
    }
  });

  it("19. every demo product is genuinely viewable by a guest actor through the REAL os/commerce domain policy (listViewableProducts), not just present in the array", async () => {
    const catalogMod = (await import("../src/fedos_electron_beta_commerce_demo_catalog.js")) as unknown as {
      FEDOS_COMMERCE_DEMO_PRODUCTS: readonly Record<string, unknown>[];
    };
    // A non-literal specifier (matches the established pattern in
    // `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`'s
    // own `seedSettings()`) deliberately defeats TypeScript's static
    // module resolution for this one cross-package import -- the real
    // `src/os/commerce/**` tree is outside this package's own `rootDir`
    // (`tsconfig.test.json`), and a literal import specifier would pull
    // its whole dependency graph into THIS package's type-check.
    const commerceModuleSpecifier = "../../../src/os/commerce/index.js";
    const commerceMod = (await import(commerceModuleSpecifier)) as {
      listViewableProducts: (products: readonly unknown[], actorPubkey?: string, grants?: readonly unknown[]) => readonly unknown[];
    };
    const viewable = commerceMod.listViewableProducts(catalogMod.FEDOS_COMMERCE_DEMO_PRODUCTS, "", []);
    expect(viewable.length).toBe(3);
  });
});

describe("Commerce Reachable Catalog Phase 1 -- navigation + Messenger regression", () => {
  it("20. a Commerce nav entry exists alongside Conversations, and the catalog/detail screens are present with a back-to-Commerce control", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/<button id="nav-commerce" type="button">Commerce<\/button>/);
    expect(html).toMatch(/id="app-screen-commerce"/);
    expect(html).toMatch(/id="app-screen-commerce-detail"/);
    expect(html).toMatch(/id="commerce-detail-back"/);
  });

  it("21. the renderer wires nav-commerce to showAppScreen('commerce') + refreshCommerceCatalogList(), and commerce-detail-back returns to the catalog", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/byId<HTMLButtonElement>\("nav-commerce"\)\.addEventListener\("click", \(\) => \{\s*\n\s*showAppScreen\("commerce"\);\s*\n\s*void refreshCommerceCatalogList\(\);/);
    expect(source).toMatch(/byId<HTMLButtonElement>\("commerce-detail-back"\)\.addEventListener\("click", \(\) => \{\s*\n\s*showAppScreen\("commerce"\);/);
  });

  it("22. Messenger's own nav/IPC vocabulary is untouched -- Conversations nav, conversations-list channel, and window.fedosAcceptance boundary all remain exactly as before", () => {
    const html = read(HTML_PATH);
    const mainSource = stripComments(read(MAIN_PATH));
    const rendererSource = stripComments(read(RENDERER_PATH));
    expect(html).toMatch(/<button id="nav-conversations" type="button">Conversations<\/button>/);
    expect(mainSource).toMatch(/ipcMain\.handle\("fedos-app:conversations-list",/);
    expect(rendererSource).not.toMatch(/fedosAcceptance/);
  });
});
