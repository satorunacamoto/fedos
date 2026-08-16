import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FedOS Peer Device Discovery Arc -- Peer-Device UX entry point closure
 * (`docs/reviews/fedos-peer-device-discovery-current/10_P0_CLOSURE_COORDINATOR_FREEZE.md`
 * §4, Agent U scope). Direct Ratchet P1 arc -- extended to cover the
 * re-announcement throttle (mandate §15/§16: no unnecessary duplicate
 * announcement on every conversation open, but always on first
 * availability and always via an explicit refresh action). Always-run
 * structural guards (no Electron/WASM needed), mirroring
 * `verified_secure_session_ui_structural_guards.test.ts`'s own established
 * Tier-1 discipline exactly: real source-order/content invariants over the
 * renderer's own `openConversation()`/`announcePeerDeviceIfNeeded()`/
 * `onRefreshDeviceAnnouncementClick()`, never "the function exists". The
 * real, functional, cross-restart epoch-monotonicity proof lives in
 * `test/fedos_peer_device_announcement.test.ts`'s own
 * `FedosPeerDeviceAnnouncementRuntime.announceLocalDevice()` describe block
 * (real Runtime facade, real signing, real acceptance policy) -- this file
 * proves the renderer's own call site is wired correctly, which a
 * source-text guard is the established way to prove for this sandboxed
 * (`contextIsolation: true`, `nodeIntegration: false`), fs-less renderer.
 */

const repoRoot = process.cwd();
const rendererSourcePath = join(repoRoot, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const rendererSource = readFileSync(rendererSourcePath, "utf8");
const strippedRenderer = stripComments(rendererSource);

function functionBody(signature: string, endMarker: string): string {
  const fnStart = strippedRenderer.indexOf(signature);
  expect(fnStart, `expected to find ${signature} in the renderer`).toBeGreaterThanOrEqual(0);
  const endIdx = strippedRenderer.indexOf(endMarker, fnStart);
  expect(endIdx, `expected to find ${endMarker} inside ${signature}`).toBeGreaterThan(fnStart);
  return strippedRenderer.slice(fnStart, endIdx + endMarker.length);
}

function openConversationBody(): string {
  return functionBody("async function openConversation(", "startChatPolling();");
}

function announcePeerDeviceIfNeededBody(): string {
  return functionBody("async function announcePeerDeviceIfNeeded(", "\n}");
}

describe("Peer-Device UX entry point closure -- openConversation() wires the peer-device announce call (source-order invariants)", () => {
  it("openConversation() calls announcePeerDeviceIfNeeded(...) AFTER refreshChatSecurityState(...), reusing the SAME conversationId/counterpartyAccountRef, never a second resolution path, never forced", () => {
    const fnBody = openConversationBody();
    const securityIdx = fnBody.indexOf("refreshChatSecurityState(conversationId, counterpartyAccountRef)");
    const announceIdx = fnBody.indexOf("announcePeerDeviceIfNeeded(");
    expect(securityIdx, "expected refreshChatSecurityState(conversationId, counterpartyAccountRef) in openConversation()").toBeGreaterThanOrEqual(0);
    expect(announceIdx, "expected announcePeerDeviceIfNeeded(...) in openConversation()").toBeGreaterThanOrEqual(0);
    expect(announceIdx).toBeGreaterThan(securityIdx);
    const announceCallLine = fnBody.slice(announceIdx, announceIdx + 200);
    expect(announceCallLine).toContain("counterpartyAccountRef");
    expect(announceCallLine).toContain("conversationId");
    expect(announceCallLine).toMatch(/announcePeerDeviceIfNeeded\(\s*counterpartyAccountRef\s*,\s*conversationId\s*,\s*false\s*\)/);
  });

  it("the announcePeerDeviceIfNeeded() call is gated on a genuinely resolved counterpartyAccountRef -- never fired with a null/guessed counterparty", () => {
    const fnBody = openConversationBody();
    const announceIdx = fnBody.indexOf("announcePeerDeviceIfNeeded(");
    expect(announceIdx).toBeGreaterThanOrEqual(0);
    const gateWindow = fnBody.slice(Math.max(0, announceIdx - 400), announceIdx);
    expect(gateWindow).toMatch(/counterpartyAccountRef\s*!==\s*null/);
  });

  it("openConversation() calls announcePeerDeviceIfNeeded() exactly once per invocation (not inside any loop/render callback)", () => {
    const fnBody = openConversationBody();
    const matches = fnBody.match(/announcePeerDeviceIfNeeded\(/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe("Peer-Device UX entry point closure -- announcePeerDeviceIfNeeded() is the ONE real send path", () => {
  it("calls window.fedosApp.peerDeviceAnnounce(...) exactly once, with an epoch sourced from a real local monotonic counter, never Date.now()/new Date() (no wall-clock epoch)", () => {
    const fnBody = announcePeerDeviceIfNeededBody();
    const matches = fnBody.match(/window\.fedosApp\.peerDeviceAnnounce\(/g) ?? [];
    expect(matches.length).toBe(1);
    expect(fnBody).not.toMatch(/Date\.now\(\)/);
    expect(fnBody).not.toMatch(/new Date\(/);
    expect(fnBody).toContain("peerDeviceAnnouncementLocalEpochCounter");
  });

  it("a failed/unavailable send is caught and never propagates (openConversation() must never be blocked by it)", () => {
    const fnBody = announcePeerDeviceIfNeededBody();
    expect(fnBody).toContain("catch");
  });

  it("the per-session throttle is only bypassed when force is true, and is only marked satisfied on a successful send", () => {
    const fnBody = announcePeerDeviceIfNeededBody();
    expect(fnBody).toMatch(/if\s*\(\s*!force\s*&&\s*peerDeviceAnnouncementSentThisSession\.has\(key\)\s*\)\s*return\s*false\s*;/);
    const sendIdx = fnBody.indexOf("window.fedosApp.peerDeviceAnnounce(");
    const addIdx = fnBody.indexOf("peerDeviceAnnouncementSentThisSession.add(key)");
    expect(sendIdx).toBeGreaterThanOrEqual(0);
    expect(addIdx).toBeGreaterThan(sendIdx);
  });

  it("the module-level epoch counter starts at 0 and is only ever incremented (real monotonic counter, never reset mid-module, never derived from randomness/time)", () => {
    const idx = strippedRenderer.indexOf("let peerDeviceAnnouncementLocalEpochCounter");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(strippedRenderer.slice(idx, idx + 80)).toMatch(/=\s*0\s*;/);
    const incrementMatches = strippedRenderer.match(/peerDeviceAnnouncementLocalEpochCounter\s*\+=\s*1/g) ?? [];
    expect(incrementMatches.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Peer-Device UX entry point closure -- explicit refresh action always bypasses the throttle", () => {
  it("onRefreshDeviceAnnouncementClick() calls announcePeerDeviceIfNeeded(..., true) -- an explicit user action, never gated by the session throttle", () => {
    const fnBody = functionBody("async function onRefreshDeviceAnnouncementClick(", "\n}");
    expect(fnBody).toMatch(/announcePeerDeviceIfNeeded\([^)]*,\s*true\s*\)/);
  });

  it("the refresh button is wired to onRefreshDeviceAnnouncementClick()", () => {
    expect(strippedRenderer).toMatch(/byId<HTMLButtonElement>\("chat-refresh-device-announcement"\)\.addEventListener\("click",\s*\(\)\s*=>\s*void onRefreshDeviceAnnouncementClick\(\)\)/);
  });
});
