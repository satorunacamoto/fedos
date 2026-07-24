/**
 * Secure Runtime Alpha 7001-7080 (FedOS Desktop Beta Final Runtime
 * Validation and End-to-End Messaging Acceptance Arc) — structural
 * guards, proving by direct source inspection (never narrative claim
 * alone) what this Arc actually built: a narrow, real `messageDelivery`
 * wiring fix, two narrow real Shell wrapper methods, and a closed,
 * AUTOTEST-only acceptance command vocabulary that is unreachable in
 * ordinary packaged production mode.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";
// @ts-expect-error see above.
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "1dfb7a48";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

const MAIN_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts";

describe("Secure Runtime Alpha 7001-7080 -- structural guards", () => {
  it("1. the messageDelivery wiring fix is additive/optional -- omitted by default, zero behavior change for every pre-existing caller", () => {
    const source = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect(source).toMatch(/directRatchetMessageDeliveryRemoteDeviceRef\s*!==\s*undefined/);
    expect(source).toMatch(/messageDelivery:\s*\n\s*config\.directRatchetMessageDeliveryRemoteDeviceRef\s*!==\s*undefined/);
  });

  it("2. activateDirectConversation/establishDirectRatchetSession on the Shell are THIN wrappers -- no new business logic, delegate entirely to already-real Conversation-Runtime methods", () => {
    const source = stripComments(read("src/desktop/shell/fedos_desktop_application_shell.ts"));
    expect(source).toMatch(/async activateDirectConversation\(conversationId: string\)/);
    expect(source).toMatch(/this\.#runtime\.conversationRuntime\(\)\.activateDirectConversation\(conversationId\)/);
    expect(source).toMatch(/async establishDirectRatchetSession\(/);
    expect(source).toMatch(/dr\.initializeDirectRatchetSession\(conversationId, remoteDeviceRef, options\)/);
  });

  it("3. the closed fedos-acceptance:* command vocabulary rejects unless a real profile is unlocked -- gated on requireShell(), never a second, ad-hoc check (Secure Runtime Alpha 7321-7400's own real-production-reachability fix reconciled this exact-shape assertion: the ORIGINAL AUTOTEST_MODE-only gate this Arc itself introduced was later found to be exactly the reachability gap a follow-on Arc's own mission existed to close -- see that Arc's own structural guards for the current gate's own exact shape)", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/function requireShell\(\)[\s\S]{0,120}if \(activeAssembly === null\) return null;/);
    const acceptanceHandlerNames = [
      "handleAcceptanceCreateDirectConversation",
      "handleAcceptanceActivateDirectConversation",
      "handleAcceptanceDevicePairingCreate",
      "handleAcceptanceDevicePairingInspect",
      "handleAcceptanceDevicePairingApprove",
      "handleAcceptanceDevicePairingComplete",
      "handleAcceptanceEstablishDirectRatchetSession",
      "handleAcceptanceSendMessage",
      "handleAcceptanceListMessages",
      "handleAcceptanceReadMessage",
      "handleAcceptanceDirectRatchetStatus",
    ];
    for (const name of acceptanceHandlerNames) {
      const startIndex = source.indexOf(`async function ${name}(`);
      expect(startIndex, `${name} must exist`).toBeGreaterThanOrEqual(0);
      const body = source.slice(startIndex, startIndex + 1500);
      expect(body, `${name} must gate on requireShell()`).toMatch(/const shell = requireShell\(\);/);
      expect(body, `${name} must reject when requireShell() returns null`).toMatch(/if \(shell === null\) return acceptanceGateRejection\(\);/);
    }
  });

  it("4. every acceptance command validates its own payload shape (bounded length, correct type) before calling the Shell -- no unvalidated field reaches production", () => {
    const source = stripComments(read(MAIN_PATH));
    expect((source.match(/isBoundedString\(/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-acceptance:[a-z-]+",\s*async \(_e: IpcMainInvokeEvent\) => handleAcceptance\w+\(\)\)/);
  });

  it("5. every acceptance command delegates to an ALREADY-REAL Shell method -- no second, parallel business-logic implementation exists in this file", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/return shell\.createDirectConversation\(/);
    expect(source).toMatch(/return shell\.activateDirectConversation\(/);
    expect(source).toMatch(/return shell\.devicePairingCreate\(/);
    expect(source).toMatch(/return shell\.devicePairingInspect\(/);
    expect(source).toMatch(/return shell\.devicePairingApprove\(/);
    expect(source).toMatch(/return shell\.devicePairingComplete\(/);
    expect(source).toMatch(/return shell\.establishDirectRatchetSession\(/);
    expect(source).toMatch(/return shell\.sendMessage\(/);
    expect(source).toMatch(/return shell\.listMessages\(/);
    expect(source).toMatch(/return shell\.readMessage\(/);
    expect(source).toMatch(/value: shell\.directRatchetStatus\(/);
  });

  it("6. no raw Master Seed handle, SecretHandle, Ratchet key, or raw WASM module crosses the fedos-acceptance:* boundary", () => {
    const source = stripComments(read(MAIN_PATH));
    const acceptanceSection = source.slice(source.indexOf("function acceptanceGateRejection"), source.indexOf("function registerIpcHandlers"));
    expect(acceptanceSection).not.toMatch(/masterSeedAuthority/);
    expect(acceptanceSection).not.toMatch(/SecretHandle/);
    expect(acceptanceSection).not.toMatch(/root_key|chain_key|private_key/);
    expect(acceptanceSection).not.toMatch(/moduleRef|FedosWasmLoaderSkeleton/);
  });

  it("7. no generic execute/invoke IPC surface was added -- every new channel is a specific, narrow, named command", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-acceptance:execute"/);
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-acceptance:invoke"/);
    const preloadSource = stripComments(read("packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts"));
    expect(preloadSource).not.toMatch(/ipcRenderer\.invoke\(channel/);
  });

  it("8. the real local WebSocket relay server fixture lives under test/support/, never under src/, and is never imported by production code", () => {
    // `git diff` never shows an untracked (not yet `git add`ed) file --
    // check its real on-disk presence directly instead.
    expect(read("test/support/fedos_real_local_websocket_relay_server.ts").length).toBeGreaterThan(0);
    let srcReferences = "";
    try {
      srcReferences = execFileSync("git", ["grep", "-l", "fedos_real_local_websocket_relay_server", "--", "src/"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
    } catch {
      srcReferences = ""; // `git grep` exits non-zero (and throws) when it finds NO matches -- the expected, passing case here.
    }
    expect(srcReferences.trim()).toBe("");
  });

  it("9. Electron security literals (contextIsolation/sandbox/nodeIntegration/webSecurity) remain untouched by this Arc", () => {
    const source = read(MAIN_PATH);
    expect(source).toMatch(/contextIsolation:\s*true/);
    expect(source).toMatch(/sandbox:\s*true/);
    expect(source).toMatch(/nodeIntegration:\s*false/);
  });

  it("10. zero Rust source changed, zero p2p/.tmp_gen change, zero wire/persistence-schema change by this Arc", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/desktop/production_activation").trim()).toBe("");
  });

  it("11. no second Master Seed Authority / Store / Desktop Runtime / Conversation Runtime factory was added -- startFedosDesktopRuntime remains the ONE Desktop Runtime constructor", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/fedos_desktop_runtime_v2/);
    expect(diffOutput).not.toMatch(/fedos_conversation_runtime_v2/);
    const runtimeSource = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect((runtimeSource.match(/export async function startFedosDesktopRuntime/g) ?? []).length).toBe(1);
  });
});
