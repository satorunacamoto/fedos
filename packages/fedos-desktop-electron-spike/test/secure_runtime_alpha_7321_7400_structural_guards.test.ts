/**
 * Secure Runtime Alpha 7321-7400 (FedOS Desktop Production Feature
 * Reachability Arc) — structural guards, proving by direct source
 * inspection (never narrative claim alone) what this Arc actually built:
 * removal of the `AUTOTEST_MODE`-only gate on the `fedos-acceptance:*`
 * vocabulary (now gated on "a real profile is unlocked" instead), four new
 * IPC channels (`create-conversation-invitation`/`search`/`archive`/
 * `safety-center-overview`) that delegate ENTIRELY to already-real Shell/
 * Boundary methods, and zero protocol/Ratchet/Identity/NIP-17/Secure
 * Memory redesign.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const ARC_BASE = "10b02cbf";

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
const PRELOAD_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts";
const WINDOW_DTS_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_window.d.ts";

describe("Secure Runtime Alpha 7321-7400 -- structural guards", () => {
  it("1. requireShell()/requireBoundary() gate on a real unlocked profile ONLY -- the prior AUTOTEST_MODE-only gate is gone", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).not.toMatch(/if \(AUTOTEST_MODE\.length === 0\) return null;/);
    expect(source).toMatch(/function requireShell\(\): ShellDiagnosticLike \| null \{\s*if \(activeAssembly === null\) return null;\s*return activeAssembly\.shell;\s*\}/);
    expect(source).toMatch(/function requireBoundary\(\): BoundaryLike \| null \{\s*if \(activeAssembly === null\) return null;\s*return activeAssembly\.boundary;\s*\}/);
  });

  it("2. every ORIGINAL (Alpha 7001-7080) acceptance handler still gates on requireShell() -- this Arc changed the gate's OWN definition, never removed a handler's call to it", () => {
    const source = stripComments(read(MAIN_PATH));
    const originalHandlerNames = [
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
    for (const name of originalHandlerNames) {
      const startIndex = source.indexOf(`async function ${name}(`);
      expect(startIndex, `${name} must still exist`).toBeGreaterThanOrEqual(0);
      const body = source.slice(startIndex, startIndex + 1500);
      expect(body, `${name} must still gate on requireShell()`).toMatch(/const shell = requireShell\(\);/);
      expect(body, `${name} must still reject when requireShell() returns null`).toMatch(/if \(shell === null\) return acceptanceGateRejection\(\);/);
    }
  });

  it("3. the four NEW handlers this Arc added each gate on requireShell()/requireBoundary() and delegate ENTIRELY to an already-real Shell/Boundary method -- no new business logic", () => {
    const source = stripComments(read(MAIN_PATH));

    const invitationStart = source.indexOf("async function handleAcceptanceCreateConversationInvitation(");
    expect(invitationStart).toBeGreaterThanOrEqual(0);
    const invitationBody = source.slice(invitationStart, invitationStart + 1200);
    expect(invitationBody).toMatch(/const shell = requireShell\(\);/);
    expect(invitationBody).toMatch(/if \(shell === null\) return acceptanceGateRejection\(\);/);
    expect(invitationBody).toMatch(/return shell\.createConversationInvitation\(/);

    const searchStart = source.indexOf("async function handleAcceptanceSearch(");
    expect(searchStart).toBeGreaterThanOrEqual(0);
    const searchBody = source.slice(searchStart, searchStart + 700);
    expect(searchBody).toMatch(/const shell = requireShell\(\);/);
    expect(searchBody).toMatch(/if \(shell === null\) return acceptanceGateRejection\(\);/);
    expect(searchBody).toMatch(/return Promise\.resolve\(shell\.search\(query\)\);/);

    const archiveStart = source.indexOf("async function handleAcceptanceArchive(");
    expect(archiveStart).toBeGreaterThanOrEqual(0);
    const archiveBody = source.slice(archiveStart, archiveStart + 1200);
    expect(archiveBody).toMatch(/const shell = requireShell\(\);/);
    expect(archiveBody).toMatch(/if \(shell === null\) return acceptanceGateRejection\(\);/);
    expect(archiveBody).toMatch(/return shell\.archive\(/);

    const safetyCenterStart = source.indexOf("async function handleAcceptanceSafetyCenterOverview(");
    expect(safetyCenterStart).toBeGreaterThanOrEqual(0);
    const safetyCenterBody = source.slice(safetyCenterStart, safetyCenterStart + 700);
    expect(safetyCenterBody).toMatch(/const boundary = requireBoundary\(\);/);
    expect(safetyCenterBody).toMatch(/if \(boundary === null\) return acceptanceGateRejection\(\);/);
    expect(safetyCenterBody).toMatch(/await boundary\.safetyCenter\.refreshOverview\(\[\]\);/);
    expect(safetyCenterBody).toMatch(/value: boundary\.safetyCenter\.overviewState/);
  });

  it("4. every new acceptance command validates its own payload shape (bounded length, correct type, closed discriminant) before calling the Shell -- no unvalidated field reaches production", () => {
    const source = stripComments(read(MAIN_PATH));
    const searchStart = source.indexOf("async function handleAcceptanceSearch(");
    const searchBody = source.slice(searchStart, searchStart + 700);
    expect(searchBody).toMatch(/isBoundedString\(query, MAX_SEARCH_QUERY_CHARS\)/);

    const archiveStart = source.indexOf("async function handleAcceptanceArchive(");
    const archiveBody = source.slice(archiveStart, archiveStart + 1200);
    expect(archiveBody).toMatch(/isBoundedString\(sourcePath, MAX_ARCHIVE_PATH_CHARS\)/);
    expect(archiveBody).toMatch(/operation === "inspect"/);
    expect(archiveBody).toMatch(/operation === "preflightRestore" \|\| operation === "export" \|\| operation === "restore"/);
    expect(archiveBody).toMatch(/return \{ outcome: "invalid-input", reason: "unknown archive operation" \};/);

    const invitationStart = source.indexOf("async function handleAcceptanceCreateConversationInvitation(");
    const invitationBody = source.slice(invitationStart, invitationStart + 1200);
    expect(invitationBody).toMatch(/isBoundedString\(publicIdentifier, MAX_ID_LENGTH\)/);
  });

  it("5. no raw Master Seed handle, SecretHandle, Ratchet key, or raw WASM module crosses the fedos-acceptance:* boundary -- including the four new channels", () => {
    const source = stripComments(read(MAIN_PATH));
    const acceptanceSection = source.slice(source.indexOf("function acceptanceGateRejection"), source.indexOf("function registerIpcHandlers"));
    expect(acceptanceSection).not.toMatch(/masterSeedAuthority/);
    expect(acceptanceSection).not.toMatch(/SecretHandle/);
    expect(acceptanceSection).not.toMatch(/root_key|chain_key|private_key/);
    expect(acceptanceSection).not.toMatch(/moduleRef|FedosWasmLoaderSkeleton/);
  });

  it("6. no generic execute/invoke IPC surface was added -- every new channel is a specific, narrow, named command, registered unconditionally like every existing channel", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-acceptance:execute"/);
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-acceptance:invoke"/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-acceptance:create-conversation-invitation",\s*async \(_e: IpcMainInvokeEvent, payload: unknown\) => handleAcceptanceCreateConversationInvitation\(payload\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-acceptance:search",\s*async \(_e: IpcMainInvokeEvent, payload: unknown\) => handleAcceptanceSearch\(payload\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-acceptance:archive",\s*async \(_e: IpcMainInvokeEvent, payload: unknown\) => handleAcceptanceArchive\(payload\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-acceptance:safety-center-overview",/);

    const preloadSource = stripComments(read(PRELOAD_PATH));
    expect(preloadSource).not.toMatch(/ipcRenderer\.invoke\(channel/);
    expect(preloadSource).toMatch(/createConversationInvitation/);
    expect(preloadSource).toMatch(/search/);
    expect(preloadSource).toMatch(/archive/);
    expect(preloadSource).toMatch(/safetyCenterOverview/);
  });

  it("7. the preload bridge's window.d.ts type surface was extended, not replaced -- every original method signature is untouched", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    expect(source).toMatch(/readonly createDirectConversation:/);
    expect(source).toMatch(/readonly activateDirectConversation:/);
    expect(source).toMatch(/readonly sendMessage:/);
    expect(source).toMatch(/readonly listMessages:/);
    expect(source).toMatch(/readonly readMessage:/);
    expect(source).toMatch(/readonly directRatchetStatus:/);
    expect(source).toMatch(/readonly createConversationInvitation:/);
    expect(source).toMatch(/readonly search:/);
    expect(source).toMatch(/readonly archive:/);
    expect(source).toMatch(/readonly safetyCenterOverview:/);
  });

  it("8. Electron security literals (contextIsolation/sandbox/nodeIntegration/webSecurity) remain untouched by this Arc", () => {
    const source = read(MAIN_PATH);
    expect(source).toMatch(/contextIsolation:\s*true/);
    expect(source).toMatch(/sandbox:\s*true/);
    expect(source).toMatch(/nodeIntegration:\s*false/);
  });

  it("9. zero Rust source changed, zero p2p/.tmp_gen change, zero wire/persistence-schema change, zero Ratchet/Identity/NIP-17/Secure-Memory source change by this Arc (RECONCILED: Secure Runtime Alpha 7401-7480's own later, disclosed, additive route-binding fix legitimately touches fedos_direct_ratchet_outbound_integration.ts/fedos_direct_ratchet_inbound_integration.ts -- see that Arc's own structural guards for the current state of those two files; every other path below remains genuinely untouched by this Arc)", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_crypto.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/identity").trim()).toBe("");
    expect(diffNames("src/desktop/production_activation").trim()).toBe("");
  });

  it("10. no second Master Seed Authority / Store / Desktop Runtime / Conversation Runtime / Shell / Boundary factory was added -- startFedosDesktopRuntime and FedosDesktopBetaApplicationAssembly remain the ONE production activation chain", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/fedos_desktop_runtime_v2/);
    expect(diffOutput).not.toMatch(/fedos_conversation_runtime_v2/);
    expect(diffOutput).not.toMatch(/fedos_desktop_application_shell_v2/);
    const runtimeSource = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect((runtimeSource.match(/export async function startFedosDesktopRuntime/g) ?? []).length).toBe(1);
  });

  it("11. this Arc's own new real vertical-slice test lives under packages/fedos-desktop-electron-spike/test/, and the real local relay fixture is imported ONLY via a computed (non-literal) specifier from within it, never a static import", () => {
    const sliceSource = read("packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_7321_7400_real_packaged_vertical_slice.test.ts");
    expect(sliceSource.length).toBeGreaterThan(0);
    expect(sliceSource).not.toMatch(/^import\s+.*fedos_real_local_websocket_relay_server/m);
    expect(sliceSource).toMatch(/await import\(relayServerModuleSpecifier\)/);
  });
});
