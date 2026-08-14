import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Verified Secure Session UI mega-arc (Coordinator) — always-run structural
 * guards (no Electron/WASM needed), mirroring
 * `real_digital_delivery_agent_u_security_ui_closure.test.ts`'s own
 * established Tier-1 discipline exactly: real source-order/content
 * invariants, never "the function exists".
 */

const repoRoot = process.cwd();
const rendererSourcePath = join(repoRoot, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts");
const mainSourcePath = join(repoRoot, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts");
const pageSourcePath = join(repoRoot, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html");
const preloadSourcePath = join(repoRoot, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const rendererSource = readFileSync(rendererSourcePath, "utf8");
const mainSource = readFileSync(mainSourcePath, "utf8");
const pageSource = readFileSync(pageSourcePath, "utf8");
const preloadSource = readFileSync(preloadSourcePath, "utf8");

const FORBIDDEN_CLAIM_PATTERNS: readonly RegExp[] = [
  /fully secure/i,
  /end-to-end verified/i,
  /identity verified/i,
  /all devices verified/i,
  /forward secrecy active/i,
  /no one can intercept/i,
  />anonymous</i,
  /"anonymous"/i,
  />safe</i,
  /"safe"/i,
];

describe("Verified Secure Session UI -- no forbidden overclaim string in the new copy (mandate section 7/52)", () => {
  it("no forbidden claim string appears anywhere in the renderer's new security-state copy tables", () => {
    // Extract just the new copy tables, not the whole 5000+ line renderer,
    // so this test remains specific to what this arc actually added.
    const startMarker = "CHAT_SECURITY_AXIS_LABELS";
    const endMarker = "function onChatSecurityIndicatorClick";
    const startIdx = rendererSource.indexOf(startMarker);
    const endIdx = rendererSource.indexOf(endMarker);
    expect(startIdx, "expected to find the security-state copy tables in the renderer").toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(startIdx);
    const securityStateCopy = rendererSource.slice(startIdx, endIdx);
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(securityStateCopy, `forbidden claim pattern ${String(pattern)} must not appear in the security-state copy`).not.toMatch(pattern);
    }
  });

  it("no forbidden claim string appears in the new page.html security panel markup", () => {
    const startIdx = pageSource.indexOf('id="chat-security-indicator"');
    const endIdx = pageSource.indexOf('id="chat-error"');
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(startIdx);
    const panelMarkup = pageSource.slice(startIdx, endIdx);
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(panelMarkup, `forbidden claim pattern ${String(pattern)} must not appear in the security panel markup`).not.toMatch(pattern);
    }
  });
});

describe("Verified Secure Session UI -- renderer/page/preload/main wiring is real (source-order invariants)", () => {
  it("the chat security indicator button exists in page.html, paired with its details panel and standing-limits disclosure", () => {
    expect(pageSource).toContain('id="chat-security-indicator"');
    expect(pageSource).toContain('id="chat-security-indicator-text"');
    expect(pageSource).toContain('id="chat-security-details"');
    expect(pageSource).toContain('id="chat-security-axes"');
    // The standing "no safety number" disclosure must be present unconditionally in markup, not injected only for some states.
    expect(pageSource).toMatch(/no safety number/i);
  });

  it("openConversation() calls refreshChatSecurityState() AFTER conversationActivate(), never before (activation must resolve first)", () => {
    const stripped = stripComments(rendererSource);
    const fnStart = stripped.indexOf("async function openConversation(");
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const fnBody = stripped.slice(fnStart, stripped.indexOf("\n}", fnStart) + 2);
    const activateIdx = fnBody.indexOf("conversationActivate(");
    const securityIdx = fnBody.indexOf("refreshChatSecurityState(");
    expect(activateIdx).toBeGreaterThanOrEqual(0);
    expect(securityIdx).toBeGreaterThan(activateIdx);
  });

  it("refreshChatSecurityState() never hardcodes a 'good'/'attention' result -- it always branches on the real IPC result.outcome first", () => {
    const stripped = stripComments(rendererSource);
    const fnStart = stripped.indexOf("async function refreshChatSecurityState(");
    const fnBody = stripped.slice(fnStart, stripped.indexOf("\n}", fnStart) + 2);
    expect(fnBody).toMatch(/result\.outcome !== "ok"/);
    // On a non-ok outcome, the indicator must read an honest unavailable text, never silently keep a stale "good"-shaped label.
    const failBranchIdx = fnBody.indexOf('result.outcome !== "ok"');
    const afterFailBranch = fnBody.slice(failBranchIdx, failBranchIdx + 200);
    expect(afterFailBranch).toMatch(/unavailable/);
  });

  it("the click handler toggles [hidden] on the details panel -- never removes it from the DOM (accessible show/hide, matches the codebase's own established [hidden] convention)", () => {
    const stripped = stripComments(rendererSource);
    const fnStart = stripped.indexOf("function onChatSecurityIndicatorClick(");
    const fnBody = stripped.slice(fnStart, stripped.indexOf("\n}", fnStart) + 2);
    expect(fnBody).toMatch(/\.hidden/);
    expect(fnBody).toMatch(/aria-expanded/);
  });

  it("main.cts registers the fedos-app:conversation-security-state IPC channel, delegating to boundary.securityState (never a raw Runtime/Shell bypass)", () => {
    const stripped = stripComments(mainSource);
    expect(stripped).toContain('"fedos-app:conversation-security-state"');
    const handlerStart = stripped.indexOf("async function handleAppConversationSecurityState(");
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    const handlerBody = stripped.slice(handlerStart, stripped.indexOf("\n}", handlerStart) + 2);
    expect(handlerBody).toContain("boundary.securityState.getSecurityState(");
    // Renderer-supplied conversationId is bounds-checked before use.
    expect(handlerBody).toMatch(/isBoundedString\(body\?\.conversationId/);
  });

  it("preload exposes conversationSecurityState with bounded-string sanitization on conversationId (same discipline as every sibling method)", () => {
    const stripped = stripComments(preloadSource);
    const idx = stripped.indexOf("conversationSecurityState:");
    expect(idx).toBeGreaterThanOrEqual(0);
    const line = stripped.slice(idx, idx + 400);
    expect(line).toContain("boundedString(conversationId");
    expect(line).toContain('"fedos-app:conversation-security-state"');
  });
});
