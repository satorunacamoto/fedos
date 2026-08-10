/**
 * Commerce Reachable Catalog + Product Surface, Phase 1 — structural
 * guards, proving by direct source inspection (never narrative claim
 * alone, mirrors `secure_runtime_alpha_8041_8120_structural_guards.test.ts`'s
 * own established convention) that:
 *
 *   - `createCommerce()`'s barrel is genuinely wired into the real
 *     composition root (`loadRootModules()`), via the compiled `dist/`
 *     graph like every other module, not a parallel app.
 *   - The new IPC channel family is bounded (exactly 2 channels), reuses
 *     the existing `fedos-app:*` validation discipline, and is never
 *     gated on a Coordinator/Shell (Commerce must be reachable even
 *     before a profile exists).
 *   - Nothing payment-shaped is ever imported/constructed/reachable from
 *     this new slice — the dormant, unauthenticated
 *     `PlaceholderPaymentProvider.ingestCallback()` stays exactly as
 *     unreachable as the prior audit found it.
 *   - Media rendering never uses `innerHTML`, never accepts an unsafe
 *     scheme, and always has a safe fallback.
 *   - No "Buy"/"Order" control exists; the disabled state is explicit.
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

  it("2. loadRootModules() dynamically imports the real os/commerce barrel and takes ONLY listViewableProducts from it -- never a PaymentProvider/PlaceholderPaymentProvider/createCommerce call inside main.cts itself", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/distUrl\("os", "commerce", "index\.js"\)/);
    expect(source).toMatch(/listViewableProducts:\s*RootModules\["Commerce"\]\["listViewableProducts"\]/);
    // The commerce dynamic-import block's destructured shape names only listViewableProducts.
    const importBlockMatch = source.match(/const commerce = \(await import\(distUrl\("os", "commerce", "index\.js"\)\)\) as \{([\s\S]{0,200}?)\};/);
    expect(importBlockMatch, source).not.toBeNull();
    expect(importBlockMatch![1]).toMatch(/listViewableProducts/);
    expect(importBlockMatch![1]).not.toMatch(/[Pp]ayment/);
    expect(importBlockMatch![1]).not.toMatch(/createCommerce/);
  });

  it("3. RootModules.Commerce exposes ONLY listViewableProducts -- no payments/marketplace field", () => {
    const source = stripComments(read(MAIN_PATH));
    const fieldMatch = source.match(/readonly Commerce: \{([\s\S]{0,300}?)\};\s*\n\}/);
    expect(fieldMatch, source).not.toBeNull();
    expect(fieldMatch![1]).toMatch(/listViewableProducts/);
    expect(fieldMatch![1]).not.toMatch(/payments|marketplace|PaymentProvider/i);
  });
});

describe("Commerce Reachable Catalog Phase 1 -- bounded IPC family", () => {
  it("4. exactly two new fedos-app:commerce-* channels are registered, unconditionally (never gated on ACCEPTANCE_MODE_ENABLED)", () => {
    const source = stripComments(read(MAIN_PATH));
    const channelMatches = source.match(/ipcMain\.handle\("fedos-app:commerce-[a-z-]+",/g) ?? [];
    expect(channelMatches.length).toBe(2);
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-catalog-list",\s*async \(\)\s*=>\s*handleCommerceCatalogList\(\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-product-detail",\s*async \([^)]*\)\s*=>\s*handleCommerceProductDetail\(payload\)\);/);
  });

  it("5. the product-detail handler bounds/validates productId the same way every other fedos-app:* handler does (isBoundedString + MAX_ID_LENGTH), never trusts an unvalidated payload field", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductDetail");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const handlerBody = source.slice(start, start + 600);
    expect(handlerBody).toMatch(/isBoundedString\(productId, MAX_ID_LENGTH\)/);
    expect(handlerBody).toMatch(/return \{ outcome: "invalid-input"/);
  });

  it("6. neither Commerce handler is gated on requireShell()/requireBoundary() -- Commerce discovery must be reachable even before any profile exists (0 network/profile dependency)", () => {
    const source = stripComments(read(MAIN_PATH));
    const sectionMatch = source.match(/\/\/ Commerce Reachable Catalog[\s\S]*?function renderCommerceProductDetail/);
    // (renderCommerceProductDetail is renderer-only; guard against an accidental over-match by re-slicing to just the main.cts handler section instead.)
    const mainSection = source.slice(source.indexOf("function commerceViewableDemoProducts"), source.indexOf("async function handleCommerceProductDetail") + 800);
    expect(mainSection).not.toMatch(/requireShell\(\)/);
    expect(mainSection).not.toMatch(/requireBoundary\(\)/);
    expect(mainSection).toMatch(/requireModules\(\)\.Commerce\.listViewableProducts/);
    void sectionMatch;
  });
});

describe("Commerce Reachable Catalog Phase 1 -- dormant payment callback stays unreachable", () => {
  it("7. main.cts never references PlaceholderPaymentProvider or ingestCallback -- the new Catalog slice cannot make the dormant, unauthenticated settlement callback reachable", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).not.toMatch(/PlaceholderPaymentProvider/);
    expect(source).not.toMatch(/ingestCallback/);
  });

  it("8. no IPC channel anywhere in main.cts has 'payment' in its name", () => {
    const source = stripComments(read(MAIN_PATH));
    const paymentChannels = source.match(/ipcMain\.handle\("[^"]*payment[^"]*"/gi) ?? [];
    expect(paymentChannels).toEqual([]);
  });

  it("9. the preload bridge never exposes a payment-shaped method", () => {
    const source = stripComments(read(PRELOAD_PATH));
    expect(source).not.toMatch(/payment/i);
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

describe("Commerce Reachable Catalog Phase 1 -- no fake ordering control", () => {
  it("17. the product detail screen never contains a Buy/Order/Purchase/Checkout button -- only the explicit disabled-state pill", () => {
    const html = read(HTML_PATH);
    const detailSection = html.slice(html.indexOf('id="app-screen-commerce-detail"'), html.indexOf('id="app-screen-search"'));
    expect(detailSection).not.toMatch(/>Buy</i);
    expect(detailSection).not.toMatch(/>Order</i);
    expect(detailSection).not.toMatch(/>Purchase</i);
    expect(detailSection).not.toMatch(/>Checkout</i);
    expect(detailSection).toMatch(/commerce-unavailable-pill">Ordering not available yet</);
    // the pill is a <span>, never a <button> -- never an interactive-looking disabled control.
    expect(detailSection).toMatch(/<span class="commerce-unavailable-pill">/);
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
