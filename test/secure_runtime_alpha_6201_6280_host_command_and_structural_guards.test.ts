/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase H/Q: structural validation of this Arc's own
 * 8 new closed Host Commands, plus structural guards proving the new
 * `src/desktop/presentation/safety_center/` and
 * `src/desktop/renderer/safety_center/` subtrees import nothing from
 * archive/search/membership/electron, contain no crypto import, and that
 * exactly one Controller/Renderer/Navigation-state class exists for this
 * domain — mirrors `secure_runtime_alpha_6121_6200_host_command_and_structural_guards.test.ts`'s
 * own established pattern exactly.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";
import { validateFedosDesktopHostCommand } from "../src/os/messenger/desktop/host_boundary/fedos_desktop_host_command.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRESENTATION_DIR = join(REPO_ROOT, "src", "os", "messenger", "desktop", "presentation", "safety_center");
const RENDERER_DIR = join(REPO_ROOT, "src", "os", "messenger", "desktop", "renderer", "safety_center");

/** Strips `/** ... *\/` block comments and `//` line comments -- several of this Arc's own doc comments explicitly NAME a forbidden pattern to state its ABSENCE (mirrors `secure_runtime_alpha_5641_5720_structural_no_live_wire_guards.test.ts`'s own established discipline exactly, non-circular). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readAllTs(dir: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir) as string[]) {
    if (!name.endsWith(".ts")) continue;
    out[name] = stripComments(readFileSync(join(dir, name), "utf8") as string);
  }
  return out;
}

const presentationFiles = readAllTs(PRESENTATION_DIR);
const rendererFiles = readAllTs(RENDERER_DIR);
const allFiles = { ...presentationFiles, ...rendererFiles };

describe("Secure Runtime Alpha 6201-6280 -- Safety Center Host Command validation", () => {
  it("1. safety-center-overview -- valid and malformed", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-overview", ratchetPairs: [] })).toEqual({ type: "safety-center-overview", ratchetPairs: [] });
    expect(validateFedosDesktopHostCommand({ type: "safety-center-overview", ratchetPairs: "not-an-array" })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "safety-center-overview", ratchetPairs: [{ conversationId: "c1", remoteDeviceRef: "d1" }] })).not.toBeNull();
  });

  it("2. safety-center-events -- valid and malformed", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-events", limit: 10, offset: 0 })).toEqual({ type: "safety-center-events", limit: 10, offset: 0 });
    expect(validateFedosDesktopHostCommand({ type: "safety-center-events", limit: -1, offset: 0 })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "safety-center-events", limit: 1.5, offset: 0 })).toBeNull();
  });

  it("3. safety-center-section -- valid and malformed", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-section", section: "overview" })).toEqual({ type: "safety-center-section", section: "overview" });
    expect(validateFedosDesktopHostCommand({ type: "safety-center-section", section: "not-a-real-section" })).toBeNull();
  });

  it("4. safety-center-device-action -- valid and malformed", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-device-action", action: "request-revoke", deviceId: "d1", devicePublicKeyHex: "aa" })).toEqual({
      type: "safety-center-device-action",
      action: "request-revoke",
      deviceId: "d1",
      devicePublicKeyHex: "aa",
    });
    expect(validateFedosDesktopHostCommand({ type: "safety-center-device-action", action: "revoke-immediately", deviceId: "d1", devicePublicKeyHex: "aa" })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "safety-center-device-action", action: "request-revoke", deviceId: "", devicePublicKeyHex: "aa" })).toBeNull();
  });

  it("5. safety-center-ratchet-action -- valid and malformed", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-ratchet-action", action: "request-reset", conversationId: "c1", remoteDeviceRef: "d1" })).not.toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "safety-center-ratchet-action", action: "reset-immediately", conversationId: "c1", remoteDeviceRef: "d1" })).toBeNull();
  });

  it("6. safety-center-confirm-action / safety-center-cancel-action -- no fields required", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-confirm-action" })).toEqual({ type: "safety-center-confirm-action" });
    expect(validateFedosDesktopHostCommand({ type: "safety-center-cancel-action" })).toEqual({ type: "safety-center-cancel-action" });
  });

  it("7. safety-center-settings-action -- valid and malformed", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-settings-action", field: "notifications", enabled: true })).toEqual({
      type: "safety-center-settings-action",
      field: "notifications",
      enabled: true,
    });
    expect(validateFedosDesktopHostCommand({ type: "safety-center-settings-action", field: "not-a-real-field", enabled: true })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "safety-center-settings-action", field: "background-sync", enabled: "yes" })).toBeNull();
  });

  it("8. requestId is threaded through when present, omitted when absent, for every new command kind", () => {
    const withId = validateFedosDesktopHostCommand({ type: "safety-center-events", limit: 1, offset: 0, requestId: "req-1" });
    expect(withId).toEqual({ type: "safety-center-events", limit: 1, offset: 0, requestId: "req-1" });
  });

  it("9. an unknown command type still fails closed to null", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-not-a-real-command" })).toBeNull();
  });
});

describe("Secure Runtime Alpha 6201-6280 -- structural guards over src/desktop/presentation/safety_center/ and src/desktop/renderer/safety_center/", () => {
  it("10. the scan is non-vacuous", () => {
    expect(Object.keys(presentationFiles).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(rendererFiles).length).toBeGreaterThanOrEqual(1);
  });

  it("11. no file imports from archive/search/membership/electron/deletion_request/identity_transition domain internals -- pure aggregation only, over the Shell's own already-public accessors", () => {
    for (const [name, text] of Object.entries(allFiles)) {
      expect(text, name).not.toMatch(/from ["'].*\/archive\//);
      expect(text, name).not.toMatch(/from ["'].*\/search\//);
      expect(text, name).not.toMatch(/from ["'].*\/membership\//);
      expect(text, name).not.toMatch(/from ["'].*electron/i);
      expect(text, name).not.toMatch(/from ["'].*conversation\/deletion_request\//);
      expect(text, name).not.toMatch(/from ["'].*conversation\/identity_transition\//);
    }
  });

  it("12. no @noble crypto import anywhere in this UI-layer domain", () => {
    for (const [name, text] of Object.entries(allFiles)) {
      expect(text, name).not.toMatch(/from ["']@noble/);
    }
  });

  it("13. no node:fs/node:path import anywhere in this UI-layer domain -- every fact comes from the Shell, never a direct file read", () => {
    for (const [name, text] of Object.entries(allFiles)) {
      expect(text, name).not.toMatch(/from ["']node:fs["']/);
    }
  });

  it("14. exactly one Controller, one Renderer, one Navigation-state class exists for this domain", () => {
    const controllerMatches = (presentationFiles["fedos_safety_center_controller.ts"] ?? "").match(/class FedosSafetyCenterController\b/g) ?? [];
    expect(controllerMatches.length).toBe(1);
    const navMatches = (presentationFiles["fedos_safety_center_navigation_state.ts"] ?? "").match(/class FedosSafetyCenterNavigationState\b/g) ?? [];
    expect(navMatches.length).toBe(1);
    const rendererMatches = (rendererFiles["fedos_safety_center_renderer.ts"] ?? "").match(/class FedosSafetyCenterRenderer\b/g) ?? [];
    expect(rendererMatches.length).toBe(1);
  });

  it("15. never displays a single overall numeric 'security score' or an unconditional 'all protected'/'100% safe' string", () => {
    for (const [name, text] of Object.entries(allFiles)) {
      expect(text, name).not.toMatch(/100%\s*safe/i);
      expect(text, name).not.toMatch(/all\s+protected/i);
      expect(text, name).not.toMatch(/security\s*score/i);
    }
  });

  it("16. the word 'trusted' is never used as an overall verdict for Identity Replacement evidence (mirrors the prior Arc's own vocabulary discipline) -- only Device trust-state facts use that word", () => {
    const summarySource = readFileSync(join(PRESENTATION_DIR, "fedos_safety_center_summary.ts"), "utf8") as string;
    expect(summarySource).not.toMatch(/identityReplacement.*trusted/i);
  });

  it("17. only ONE Shell/Boundary/Renderer/Bridge class exists in this whole codebase (unchanged by this Arc) -- confirms no second owner was created", () => {
    const shellSource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "shell", "fedos_desktop_application_shell.ts"), "utf8") as string;
    expect((shellSource.match(/class FedosDesktopApplicationShell\b/g) ?? []).length).toBe(1);
    const boundarySource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "presentation", "fedos_desktop_conversation_ui_presentation_boundary.ts"), "utf8") as string;
    expect((boundarySource.match(/class FedosDesktopConversationUiPresentationBoundary\b/g) ?? []).length).toBe(1);
    const rendererAggSource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "renderer", "fedos_desktop_renderer.ts"), "utf8") as string;
    expect((rendererAggSource.match(/class FedosDesktopRenderer\b/g) ?? []).length).toBe(1);
    const bridgeSource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "host_boundary", "fedos_desktop_host_bridge.ts"), "utf8") as string;
    expect((bridgeSource.match(/class FedosDesktopHostBridge\b/g) ?? []).length).toBe(1);
  });
});
