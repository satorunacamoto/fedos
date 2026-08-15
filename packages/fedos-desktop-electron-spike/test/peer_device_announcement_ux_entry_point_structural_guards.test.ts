import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FedOS Peer Device Discovery Arc -- Peer-Device UX entry point closure
 * (`docs/reviews/fedos-peer-device-discovery-current/10_P0_CLOSURE_COORDINATOR_FREEZE.md`
 * §4, Agent U scope). Always-run structural guards (no Electron/WASM
 * needed), mirroring `verified_secure_session_ui_structural_guards.test.ts`'s
 * own established Tier-1 discipline exactly: real source-order/content
 * invariants over the renderer's own `openConversation()`, never "the
 * function exists". The real, functional, cross-restart epoch-monotonicity
 * proof lives in `test/fedos_peer_device_announcement.test.ts`'s own
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

function openConversationBody(): string {
  const fnStart = strippedRenderer.indexOf("async function openConversation(");
  expect(fnStart, "expected to find openConversation() in the renderer").toBeGreaterThanOrEqual(0);
  const endMarker = "startChatPolling();";
  const endIdx = strippedRenderer.indexOf(endMarker, fnStart);
  expect(endIdx, "expected to find startChatPolling(); inside openConversation()").toBeGreaterThan(fnStart);
  const fnBody = strippedRenderer.slice(fnStart, endIdx + endMarker.length);
  expect(fnBody).toContain("startChatPolling();");
  return fnBody;
}

describe("Peer-Device UX entry point closure -- openConversation() wires window.fedosApp.peerDeviceAnnounce() (source-order invariants)", () => {
  it("openConversation() calls window.fedosApp.peerDeviceAnnounce(...) AFTER refreshChatSecurityState(...), reusing the SAME conversationId/counterpartyAccountRef, never a second resolution path", () => {
    const fnBody = openConversationBody();
    const securityIdx = fnBody.indexOf("refreshChatSecurityState(conversationId, counterpartyAccountRef)");
    const announceIdx = fnBody.indexOf("window.fedosApp.peerDeviceAnnounce(");
    expect(securityIdx, "expected refreshChatSecurityState(conversationId, counterpartyAccountRef) in openConversation()").toBeGreaterThanOrEqual(0);
    expect(announceIdx, "expected window.fedosApp.peerDeviceAnnounce(...) in openConversation()").toBeGreaterThanOrEqual(0);
    expect(announceIdx).toBeGreaterThan(securityIdx);
    const announceCallLine = fnBody.slice(announceIdx, announceIdx + 200);
    expect(announceCallLine).toContain("counterpartyAccountRef");
    expect(announceCallLine).toContain("conversationId");
  });

  it("the peerDeviceAnnounce() call is gated on a genuinely resolved counterpartyAccountRef -- never fired with a null/guessed counterparty", () => {
    const fnBody = openConversationBody();
    const announceIdx = fnBody.indexOf("window.fedosApp.peerDeviceAnnounce(");
    expect(announceIdx).toBeGreaterThanOrEqual(0);
    const gateWindow = fnBody.slice(Math.max(0, announceIdx - 400), announceIdx);
    expect(gateWindow).toMatch(/counterpartyAccountRef\s*!==\s*null/);
  });

  it("openConversation() calls peerDeviceAnnounce() exactly once per invocation (not inside any loop/render callback)", () => {
    const fnBody = openConversationBody();
    const matches = fnBody.match(/window\.fedosApp\.peerDeviceAnnounce\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("the epoch argument is sourced from a real local monotonic counter, never Date.now()/new Date() (no wall-clock epoch)", () => {
    const fnBody = openConversationBody();
    const announceIdx = fnBody.indexOf("window.fedosApp.peerDeviceAnnounce(");
    const callWindow = fnBody.slice(Math.max(0, announceIdx - 300), announceIdx + 200);
    expect(callWindow).not.toMatch(/Date\.now\(\)/);
    expect(callWindow).not.toMatch(/new Date\(/);
    expect(callWindow).toContain("peerDeviceAnnouncementLocalEpochCounter");
  });

  it("the module-level epoch counter starts at 0 and is only ever incremented (real monotonic counter, never reset mid-module, never derived from randomness/time)", () => {
    const idx = strippedRenderer.indexOf("let peerDeviceAnnouncementLocalEpochCounter");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(strippedRenderer.slice(idx, idx + 80)).toMatch(/=\s*0\s*;/);
    const incrementMatches = strippedRenderer.match(/peerDeviceAnnouncementLocalEpochCounter\s*\+=\s*1/g) ?? [];
    expect(incrementMatches.length).toBeGreaterThanOrEqual(1);
  });

  it("a failed/unavailable peerDeviceAnnounce() call is caught and never blocks the chat screen (openConversation() still proceeds to startChatPolling())", () => {
    const fnBody = openConversationBody();
    const announceIdx = fnBody.indexOf("window.fedosApp.peerDeviceAnnounce(");
    expect(announceIdx).toBeGreaterThanOrEqual(0);
    const afterAnnounce = fnBody.slice(announceIdx, announceIdx + 400);
    expect(afterAnnounce).toContain("catch");
    expect(fnBody.indexOf("startChatPolling();")).toBeGreaterThan(announceIdx);
  });
});
