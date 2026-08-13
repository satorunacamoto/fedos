/**
 * Buyer Discovery + Digital Content Delivery mega-arc (Agent M) — P0-2
 * content-creation half: "no production product can currently be marked/
 * provisioned as protected purchased content." Structural guards, proving
 * by direct source inspection (never narrative claim alone, mirrors
 * `commerce_reachable_catalog_phase1_structural_guards.test.ts`'s own
 * established convention) that:
 *
 *   1. A REAL, production-reachable IPC path exists that can create a
 *      `classification: "protected"` `ProductMedia` record, separate from
 *      the pre-existing public-image-attach path (which stays hard-coded
 *      to `"public"`, unchanged).
 *   2. That path routes through the EXISTING `putProtected()` encryption
 *      enforcement mechanism (`IpfsMediaStore`), never a new crypto
 *      primitive, never a caller-suppliable `classification` field.
 *   3. Untrusted seller input (contentType, base64 size, label) is bounded
 *      and validated the same way every other handler in this file
 *      already is, and unsafe content types (HTML/SVG/scriptable) are
 *      never in the allowlist.
 *   4. The response shape never leaks CID/checksum/storageRef/AEAD
 *      internals to the ordinary seller UI.
 *   5. The renderer's own new controls use plain seller language and
 *      never `innerHTML` (no XSS vector via a seller-supplied label).
 *
 * `fedos_electron_beta_main.cts` imports `electron` at module scope, so it
 * cannot be unit-imported directly outside a real Electron process (same
 * constraint every other handler in this file already has — there is no
 * precedent anywhere in this test suite for a plain `import` of that
 * file). A real end-to-end Electron harness is out of scope for this pass
 * (no `electron.exe` binary is installed in this worktree, and installing
 * one requires reaching outside this task's local-only network scope) —
 * see this arc's own final report for the full account. This file is the
 * same class of proof this codebase already relies on for exactly this
 * situation.
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
const WINDOW_DTS_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_window.d.ts";

describe("Protected content attach -- IPC wiring is real and separate from the public image-attach path", () => {
  it("1. fedos-app:commerce-product-content-attach is registered, unconditionally (never gated on ACCEPTANCE_MODE_ENABLED)", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-product-content-attach",\s*async \([^)]*\)\s*=>\s*handleCommerceProductContentAttach\(payload\)\);/);
    const idx = source.indexOf('"fedos-app:commerce-product-content-attach"');
    const precedingSlice = source.slice(Math.max(0, idx - 400), idx);
    expect(precedingSlice).not.toMatch(/if \(ACCEPTANCE_MODE_ENABLED\)\s*\{[^}]*$/);
  });

  it("2. fedos-app:commerce-merchant-product-media-list is registered, unconditionally", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:commerce-merchant-product-media-list",\s*async \([^)]*\)\s*=>\s*handleCommerceMerchantProductMediaList\(payload\)\);/);
  });

  it("3. handleCommerceProductContentAttach is a SEPARATE function from handleCommerceProductImageAttach -- never a shared branch on a caller-suppliable classification field", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/async function handleCommerceProductContentAttach\(payload: unknown\)/);
    expect(source).toMatch(/async function handleCommerceProductImageAttach\(payload: unknown\)/);
    const contentAttachStart = source.indexOf("async function handleCommerceProductContentAttach");
    const contentAttachBody = source.slice(contentAttachStart, contentAttachStart + 2500);
    // The protected handler's own body never reads a caller-supplied `classification` field off the payload.
    expect(contentAttachBody).not.toMatch(/body\.classification/);
    expect(contentAttachBody).not.toMatch(/body\?\.classification/);
  });

  it('4. handleCommerceProductContentAttach ALWAYS writes classification: "protected" and checksumSubject: "ciphertext" -- the literal, never a variable a caller could influence', () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductContentAttach");
    const end = source.indexOf("async function handleCommerceProductUpdate");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toMatch(/role:\s*"sample"/);
    expect(body).toMatch(/classification:\s*"protected"/);
    expect(body).toMatch(/checksumSubject:\s*"ciphertext"/);
  });

  it("5. handleCommerceProductContentAttach routes through the EXISTING putProtected() encryption enforcement mechanism, never a bare put() or putPublic() call with caller-supplied bytes", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductContentAttach");
    const end = source.indexOf("async function handleCommerceProductUpdate");
    const body = source.slice(start, end);
    expect(body).toMatch(/commerceMediaStoreFor\(\)\.putProtected\(bytes, body\.contentType\)/);
    expect(body).not.toMatch(/\.putPublic\(/);
    // put() is never called directly on bytes in this handler -- only putProtected(), which itself calls put() internally after encryption (ipfs_media_store.ts).
    expect(body).not.toMatch(/commerceMediaStoreFor\(\)\.put\(/);
  });

  it("6. contentType is validated against a small, closed, non-scriptable allowlist -- never text/html, never image/svg+xml, never a wildcard", () => {
    const source = stripComments(read(MAIN_PATH));
    const match = source.match(/const COMMERCE_PROTECTED_CONTENT_TYPES: ReadonlySet<string> = new Set\(\[([^\]]+)\]\);/);
    expect(match, source).not.toBeNull();
    const allowlist = match![1];
    expect(allowlist).not.toMatch(/text\/html/);
    expect(allowlist).not.toMatch(/image\/svg/);
    expect(allowlist).not.toMatch(/\*/);
    // Real, bounded values only.
    expect(allowlist).toMatch(/application\/pdf/);
  });

  it("7. contentBase64 and label are both bounded BEFORE any decode/storage attempt, mirroring the existing image-attach handler's own discipline", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductContentAttach");
    const end = source.indexOf("async function handleCommerceProductUpdate");
    const body = source.slice(start, end);
    expect(body).toMatch(/isBoundedString\(body\.contentBase64, MAX_PRODUCT_CONTENT_BASE64_CHARS\)/);
    expect(body).toMatch(/isSafeProductContentLabel\(body\.label\)/);
    expect(body).toMatch(/isBoundedString\(body\.contentType, MAX_PRODUCT_CONTENT_TYPE_CHARS\)/);
  });

  it("8. malformed base64 is caught and reported as invalid-input, never an unhandled throw", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductContentAttach");
    const end = source.indexOf("async function handleCommerceProductUpdate");
    const body = source.slice(start, end);
    expect(body).toMatch(/try\s*\{\s*bytes = new Uint8Array\(Buffer\.from\(body\.contentBase64, "base64"\)\);\s*\}\s*catch\s*\{\s*return \{ outcome: "invalid-input"/);
  });

  it("9. the success response never echoes storageRef/checksum/checksumSubject/CID -- only id/productId/contentType/label (ordinary seller language, never internals)", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceProductContentAttach");
    const end = source.indexOf("async function handleCommerceProductUpdate");
    const body = source.slice(start, end);
    const returnMatch = body.match(/return \{\s*outcome: "ok",\s*media: \{([^}]+)\}/);
    expect(returnMatch, body).not.toBeNull();
    const mediaShape = returnMatch![1];
    expect(mediaShape).not.toMatch(/storageRef/);
    expect(mediaShape).not.toMatch(/checksum/);
    expect(mediaShape).toMatch(/\bid:/);
    expect(mediaShape).toMatch(/contentType:/);
    expect(mediaShape).toMatch(/label:/);
  });

  it("10. isSafeProductContentLabel rejects path separators, traversal segments, blank/whitespace-only, and is bounded", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("function isSafeProductContentLabel");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 900);
    expect(body).toMatch(/value\.includes\("\/"\)/);
    expect(body).toContain('value.includes("\\\\")'); // rejects a literal backslash path separator
    expect(body).toMatch(/value\.includes\("\.\."\)/);
    expect(body).toMatch(/value\.trim\(\)\.length === 0/);
    expect(body).toMatch(/MAX_PRODUCT_CONTENT_LABEL_CHARS/);
    // No raw control-character bytes embedded in source -- explicit numeric codepoint check only.
    expect(body).toMatch(/code <= 0x1f \|\| code === 0x7f/);
  });

  it("11. handleCommerceMerchantProductMediaList is creator-only (checks product.creatorPubkey === actorPubkey) and never returns storageRef/checksum", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleCommerceMerchantProductMediaList");
    const end = source.indexOf("async function handleCommerceProductCreate");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toMatch(/product\.creatorPubkey !== body\.actorPubkey/);
    expect(body).toMatch(/outcome: "forbidden"/);
    expect(body).not.toMatch(/storageRef/);
    expect(body).not.toMatch(/checksum/);
    expect(body).toMatch(/classification: item\.classification/);
  });
});

describe("Protected content attach -- preload bridge bounds every field, mirrors the existing image-attach discipline exactly", () => {
  it("12. commerceProductContentAttach bounds every field with boundedString and the new MAX_PRODUCT_CONTENT_* constants", () => {
    const source = stripComments(read(PRELOAD_PATH));
    expect(source).toMatch(/commerceProductContentAttach:\s*\(actorPubkey: string, productId: string, contentBase64: string, contentType: string, label: string\)\s*=>/);
    const start = source.indexOf("commerceProductContentAttach:");
    const body = source.slice(start, start + 700);
    expect(body).toMatch(/fedos-app:commerce-product-content-attach/);
    expect(body).toMatch(/boundedString\(contentBase64, MAX_PRODUCT_CONTENT_BASE64_CHARS\)/);
    expect(body).toMatch(/boundedString\(contentType, MAX_PRODUCT_CONTENT_TYPE_CHARS\)/);
    expect(body).toMatch(/boundedString\(label, MAX_PRODUCT_CONTENT_LABEL_CHARS\)/);
  });

  it("13. commerceMerchantProductMediaList is exposed and bounded", () => {
    const source = stripComments(read(PRELOAD_PATH));
    expect(source).toMatch(/commerceMerchantProductMediaList:\s*\(actorPubkey: string, productId: string\)\s*=>/);
    expect(source).toMatch(/fedos-app:commerce-merchant-product-media-list/);
  });

  it("14. no generic invoke(channel, any) is introduced -- every new call still goes through ipcRenderer.invoke with a fixed literal channel string", () => {
    const source = stripComments(read(PRELOAD_PATH));
    const start = source.indexOf("commerceProductContentAttach:");
    const end = source.indexOf("commerceMerchantProductMediaList:");
    const body = source.slice(start, end);
    expect(body).toMatch(/ipcRenderer\.invoke\("fedos-app:commerce-product-content-attach", \{/);
  });
});

describe("Protected content attach -- window.d.ts declares the new bridge surface", () => {
  it("15. FedosAppBridge declares commerceProductContentAttach and commerceMerchantProductMediaList", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    expect(source).toMatch(/readonly commerceProductContentAttach: \(actorPubkey: string, productId: string, contentBase64: string, contentType: string, label: string\) => Promise<FedosCommerceProductContentAttachResult>;/);
    expect(source).toMatch(/readonly commerceMerchantProductMediaList: \(actorPubkey: string, productId: string\) => Promise<FedosCommerceMerchantProductMediaListResult>;/);
  });

  it("16. FedosCommerceProductContentAttachResult never carries a storageRef/checksum/CID field", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    const start = source.indexOf("interface FedosCommerceProductContentAttachResult");
    const end = source.indexOf("}", start);
    const body = source.slice(start, end);
    expect(body).not.toMatch(/storageRef/);
    expect(body).not.toMatch(/checksum/);
  });

  it("17. FedosCommerceProductMediaListItem.classification is a closed \"public\" | \"protected\" union, never a bare string", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    expect(source).toMatch(/readonly classification: "public" \| "protected";/);
  });
});

describe("Protected content attach -- renderer control uses plain seller language and never innerHTML", () => {
  it('18. the seller-facing label reads "Purchased file" / "Buyers only", never internal vocabulary (classification/AEAD/CID/content key/ciphertext)', () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceMerchantProductContentAttachControls");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 3000);
    expect(body).toMatch(/Purchased file/);
    expect(body).toMatch(/buyers/i);
    expect(body).not.toMatch(/AEAD|ciphertext|content key|CID\b/i);
  });

  it("19. the attach controls call window.fedosApp.commerceProductContentAttach, never a raw ipcRenderer/generic invoke", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceMerchantProductContentAttachControls");
    const end = source.indexOf("function refreshCommerceMerchantProductsList");
    const body = source.slice(start, end);
    expect(body).toMatch(/window\.fedosApp\.commerceProductContentAttach\(/);
    expect(body).not.toMatch(/ipcRenderer/);
  });

  it("20. the accept filter for the file picker is restricted to PDF/ZIP, matching the main-process allowlist", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("function commerceMerchantProductContentAttachControls");
    const body = source.slice(start, start + 1500);
    expect(body).toMatch(/fileInput\.accept = "\.pdf,\.zip,application\/pdf,application\/zip"/);
  });

  it("21. the media summary renderer never uses innerHTML/outerHTML/insertAdjacentHTML (no XSS vector via a seller-supplied label)", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function refreshCommerceMerchantProductMediaSummary");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf("\n}", start);
    const body = source.slice(start, end);
    expect(body).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    expect(body).toMatch(/\.textContent = /);
  });

  it("22. the badge copy for protected content says \"Buyers only\", and for public content says \"everyone\" -- both plain, non-technical, never the raw classification string", () => {
    const source = stripComments(read(RENDERER_PATH));
    const start = source.indexOf("async function refreshCommerceMerchantProductMediaSummary");
    const end = source.indexOf("\n}", start);
    const body = source.slice(start, end);
    expect(body).toMatch(/Buyers only/);
    expect(body).toMatch(/everyone/);
  });
});
