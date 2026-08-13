/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * structural guards, proving by direct source inspection (mirrors
 * `commerce_reachable_catalog_phase1_structural_guards.test.ts`'s own
 * established convention) that:
 *   - the Commerce network profile now inherits the user's own configured
 *     Relay by default (arc mandate item 1) instead of always resetting to
 *     local-only;
 *   - every catalog item is labeled `isDemo`, computed from a fixed,
 *     closed id set (arc mandate item 5);
 *   - the signed Product Share Proof issue/open IPC surface exists, is
 *     bounded, and the buyer-side "open" path never treats an unconfirmed
 *     preview as equivalent to a confirmed, openable product (arc mandate
 *     item 3/6);
 *   - the Shop screen's discovery status banner and share-code UI exist.
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

describe("arc mandate item 1 -- Commerce inherits the user's own Relay config", () => {
  it("1. initializeCommerceNetworkProfileFromRelayConfig() derives the default from activeRelays.length, never a hardcoded local-only reset", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/function initializeCommerceNetworkProfileFromRelayConfig\(\): void \{\s*\n\s*commerceNetworkProfile = activeRelays\.length > 0 \? "direct" : "local-only";/);
  });

  it("2. is called on BOTH the create and unlock success paths, before commerceNostrOutboundPortFor() -- so the very first outbound port construction already reflects the real Relay config", () => {
    const source = stripComments(read(MAIN_PATH));
    const calls = source.match(/initializeCommerceNetworkProfileFromRelayConfig\(\);\s*\n\s*commerceMediaStoreFor\(\);\s*\n\s*commerceNostrOutboundPortFor\(\);/g) ?? [];
    expect(calls.length).toBe(2);
  });
});

describe("arc mandate item 2 -- honest discovery-attempt reporting", () => {
  it("3. commerceNostrDiscoverAndIngestProductsNonFatal() returns a structured outcome (never void) distinguishing skipped-local-only / skipped-no-relay / ok / failed", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/type CommerceDiscoveryAttemptOutcome =\s*\n\s*\| \{ readonly outcome: "skipped-local-only" \}\s*\n\s*\| \{ readonly outcome: "skipped-no-relay" \}\s*\n\s*\| \{ readonly outcome: "ok"; readonly ingestedCount: number \}\s*\n\s*\| \{ readonly outcome: "failed"; readonly reason: string \};/);
    expect(source).toMatch(/async function commerceNostrDiscoverAndIngestProductsNonFatal\(\): Promise<CommerceDiscoveryAttemptOutcome>/);
  });

  it("4. handleCommerceCatalogList() surfaces discoveryAttempt, networkProfile, hasConfiguredRelay, and realListingCount to the renderer", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceCatalogList()");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1600);
    expect(body).toMatch(/discoveryAttempt/);
    expect(body).toMatch(/networkProfile: commerceNetworkProfile/);
    expect(body).toMatch(/hasConfiguredRelay: activeRelays\.length > 0/);
    expect(body).toMatch(/realListingCount/);
  });

  it("5. the Shop screen's discovery banner + no-listings note exist in HTML", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-discovery-banner"/);
    expect(html).toMatch(/id="commerce-discovery-badge"/);
    expect(html).toMatch(/id="commerce-discovery-detail"/);
    expect(html).toMatch(/id="commerce-discovery-connect-btn"/);
    expect(html).toMatch(/id="commerce-no-listings-note"/);
  });

  it("6. the renderer's discovery-status text uses the arc mandate's own required vocabulary verbatim (LOCAL DEMO / OFFLINE / CONNECTING / SYNCING / CONNECTED / SYNC FAILED)", () => {
    const source = stripComments(read(RENDERER_PATH));
    for (const badge of ["LOCAL DEMO", "OFFLINE", "CONNECTING", "SYNCING", "CONNECTED", "SYNC FAILED"]) {
      expect(source, `expected renderer to declare badge "${badge}"`).toMatch(new RegExp(badge.replace(/ /g, "\\s")));
    }
  });

  it("7. the discovery status derivation never claims connected/syncing when no Relay is configured -- offline/local-demo both short-circuit before checking inFlight", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("status(networkProfile:");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 400);
    const localOnlyIdx = body.indexOf('networkProfile === "local-only"');
    const noRelayIdx = body.indexOf("!hasConfiguredRelay");
    const inFlightIdx = body.indexOf("this.inFlight");
    expect(localOnlyIdx).toBeGreaterThanOrEqual(0);
    expect(noRelayIdx).toBeGreaterThan(localOnlyIdx);
    expect(inFlightIdx).toBeGreaterThan(noRelayIdx);
  });
});

describe("arc mandate item 5 -- every catalog item is labeled isDemo, computed from a fixed closed id set", () => {
  it("8. COMMERCE_DEMO_PRODUCT_IDS is derived from FEDOS_COMMERCE_DEMO_PRODUCTS' own ids, never a heuristic/guess", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/const COMMERCE_DEMO_PRODUCT_IDS: ReadonlySet<string> = new Set\(FEDOS_COMMERCE_DEMO_PRODUCTS\.map\(\(p\) => p\.id\)\);/);
  });

  it("9. both local and Nostr-discovered catalog items carry an isDemo field in handleCommerceCatalogList()'s response", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceCatalogList()");
    const body = source.slice(start, start + 1600);
    expect(body).toMatch(/isDemo: COMMERCE_DEMO_PRODUCT_IDS\.has\(product\.id\)/);
    expect(body).toMatch(/isDemo: false,/);
  });

  it("10. the renderer renders an explicit DEMO pill on every isDemo row", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).toMatch(/if \(product\.isDemo\) \{\s*\n\s*const demoPill = document\.createElement\("span"\);\s*\n\s*demoPill\.className = "commerce-sim-pill";\s*\n\s*demoPill\.textContent = "DEMO";/);
  });
});

describe("arc mandate item 3 -- signed Product Share Proof (never a raw pubkey typed by hand)", () => {
  it("11. exactly the two new share IPC channels are registered, unconditionally", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-share-product-issue",\s*async \([^)]*\)\s*=>\s*handleCommerceShareProductIssue\(payload\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-share-open",\s*async \([^)]*\)\s*=>\s*handleCommerceShareOpen\(payload\)\);/);
  });

  it("12. only the product's own established creator may issue a share for it", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceShareProductIssue");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1200);
    expect(body).toMatch(/if \(product\.creatorPubkey !== body\.actorPubkey\) \{\s*\n\s*return \{ outcome: "forbidden"/);
  });

  it("13. handleCommerceShareOpen() calls verifySelfAssertedProductShareProof and rejects before ever building a preview from unverified content", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceShareOpen");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1600);
    const decodeIdx = body.indexOf("decodeCommerceShareProofFromQrText");
    const verifyIdx = body.indexOf("verifySelfAssertedProductShareProof");
    const rejectIdx = body.indexOf('verified.status !== "VALID"');
    const previewBuildIdx = body.indexOf("const preview =");
    expect(decodeIdx).toBeGreaterThanOrEqual(0);
    expect(verifyIdx).toBeGreaterThan(decodeIdx);
    expect(rejectIdx).toBeGreaterThan(verifyIdx);
    expect(previewBuildIdx).toBeGreaterThan(rejectIdx);
  });

  it("14. handleCommerceShareOpen() mandatorily cross-checks the claimed sellerPubkey against a REAL, independently-resolved record (local repo OR the verified Nostr read model) before ever reporting confirmed: true, and explicitly rejects a mismatch", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceShareOpen");
    const body = source.slice(start, start + 2400);
    expect(body).toMatch(/await commerceNostrDiscoverAndIngestProductsNonFatal\(\);/);
    expect(body).toMatch(/commerceState\(\)\.products\.get\(preview\.productId\)/);
    expect(body).toMatch(/commerceNostrReadModelFor\(\)\.getProduct\(preview\.productId\)/);
    expect(body).toMatch(/if \(realCreatorPubkey !== preview\.sellerPubkey\) \{\s*\n\s*return \{\s*\n\s*outcome: "rejected",\s*\n\s*reason: "seller mismatch/);
    expect(body).toMatch(/return \{ outcome: "ok", confirmed: true, productId: preview\.productId, preview \};/);
  });

  it("15. the renderer only ever opens Product Detail when confirmed === true, never on a bare 'ok' outcome alone", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function onCommerceShareOpenClick");
    expect(start, source).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1600);
    expect(body).toMatch(/if \(result\.confirmed === true && result\.productId !== undefined\) \{/);
    expect(body).toMatch(/await openCommerceProduct\(result\.productId\);/);
  });

  it("16. the preload bridge sends the share code as a bounded string, never a raw unbounded value, and never pre-parses it", () => {
    const source = stripComments(read(PRELOAD_PATH));
    expect(source).toMatch(/commerceShareOpen: \(qrText: string\) =>\s*\n\s*ipcRenderer\.invoke\("fedos-app:commerce-share-open", \{ qrText: boundedString\(qrText, MAX_SHARE_QR_TEXT_CHARS\) \}\),/);
    expect(source).toMatch(/commerceShareProductIssue: \(actorPubkey: string, productId: string\) =>/);
  });

  it("17. window.d.ts declares both new bridge methods with typed results", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    expect(source).toMatch(/commerceShareProductIssue: \(actorPubkey: string, productId: string\) => Promise<FedosCommerceShareIssueResult>/);
    expect(source).toMatch(/commerceShareOpen: \(qrText: string\) => Promise<FedosCommerceShareOpenResult>/);
  });

  it("18. the Shop screen's share-open UI (paste + Open) and the merchant's per-product Share Product control exist", () => {
    const html = read(HTML_PATH);
    expect(html).toMatch(/id="commerce-share-open-input"/);
    expect(html).toMatch(/id="commerce-share-open-btn"/);
    expect(html).toMatch(/id="commerce-share-issue-result"/);
    const rendererSource = stripComments(read(RENDERER_PATH));
    expect(rendererSource).toMatch(/shareBtn\.textContent = "Share Product";/);
  });

  it("19. no raw-pubkey text-entry field is offered anywhere as the ordinary discovery path -- the only cross-identity input in Shop is the share-code textarea", () => {
    const html = read(HTML_PATH);
    const shopSection = html.slice(html.indexOf('id="app-screen-commerce"'), html.indexOf('id="app-screen-commerce-detail"'));
    // The share-code textarea is the only free-text field a buyer fills in to reach another identity's listing.
    expect(shopSection).toMatch(/id="commerce-share-open-input"/);
    expect(shopSection).not.toMatch(/placeholder="[0-9a-f]{64}"/);
  });
});
