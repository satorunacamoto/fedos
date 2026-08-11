/**
 * Secure Runtime Alpha 8041-8120 (FedOS Desktop Beta User-Facing Product UI
 * Completion Arc) — structural guards, proving by direct source inspection
 * (never narrative claim alone) that this Arc's own new `fedos-app:*`
 * ordinary-page vocabulary never uses `window.fedosAcceptance`, that
 * `fedosAcceptance`/`fedos-acceptance:*` remain untouched (Phase P), that no
 * generic execute/invoke IPC surface exists, that Electron's security
 * literals are unweakened, and that zero protocol/Rust/p2p/.tmp_gen source
 * changed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const ARC_BASE = "97f26f0f";

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
const RENDERER_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts";
const HTML_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html";
const WINDOW_DTS_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_window.d.ts";

describe("Secure Runtime Alpha 8041-8120 -- structural guards", () => {
  it("1. the ordinary renderer NEVER references window.fedosAcceptance -- the UX review's own headline claim, re-verified after this Arc's own edits", () => {
    const source = stripComments(read(RENDERER_PATH));
    expect(source).not.toMatch(/fedosAcceptance/);
  });

  it("2. the ordinary page HTML never inlines a script and never references fedosAcceptance", () => {
    const source = read(HTML_PATH);
    expect(source).not.toMatch(/fedosAcceptance/);
    expect(source).not.toMatch(/<script>[\s\S]*<\/script>/);
    // exactly one external script tag, the compiled renderer.
    const scriptTags = source.match(/<script\b[^>]*>/g) ?? [];
    expect(scriptTags.length).toBe(1);
    expect(scriptTags[0]).toMatch(/src="fedos_electron_beta_renderer\.js"/);
  });

  it("3. fedosAcceptance / fedos-acceptance:* remain byte-for-byte reachable -- this Arc reuses several of their handler FUNCTIONS internally but never renames or removes the acceptance vocabulary itself (Phase P). Secure Runtime Alpha 8121-8200 (Security Finding 1, `6873d24f`) narrows WHEN it is reachable, never removes it: the vocabulary itself, and its exposure/registration under explicit acceptance mode, both remain intact.", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/ipcMain\.handle\("fedos-acceptance:create-direct-conversation",/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-acceptance:safety-center-overview",/);
    // Secure Runtime Alpha 8121-8200 -- both registrations now live inside
    // the SAME `if (ACCEPTANCE_MODE_ENABLED)` block, not unconditionally.
    expect(source).toMatch(/if \(ACCEPTANCE_MODE_ENABLED\) \{[\s\S]{0,4000}ipcMain\.handle\("fedos-acceptance:create-direct-conversation",/);
    expect(source).toMatch(/AUTOTEST_MODE === "acceptance"/);
    const preloadSource = stripComments(read(PRELOAD_PATH));
    expect(preloadSource).toMatch(/contextBridge\.exposeInMainWorld\("fedosAcceptance", fedosAcceptance\);/);
    expect(preloadSource).toMatch(/if \(ACCEPTANCE_MODE_ENABLED\) \{[\s\S]{0,300}contextBridge\.exposeInMainWorld\("fedosAcceptance", fedosAcceptance\);/);
  });

  it("4. the NEW fedos-app:* vocabulary is additive, gated on requireShell()/requireBoundary() (the SAME real-profile-unlocked precondition every other command in this file already requires), and reuses existing handler functions rather than duplicating business logic where an acceptance handler already does the same real work", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:conversations-list",/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:create-invitation",\s*async \(_e: IpcMainInvokeEvent, payload: unknown\) => handleAcceptanceCreateConversationInvitation\(payload\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:search",\s*async \(_e: IpcMainInvokeEvent, payload: unknown\) => handleAcceptanceSearch\(payload\)\);/);
    expect(source).toMatch(/ipcMain\.handle\("fedos-app:archive",\s*async \(_e: IpcMainInvokeEvent, payload: unknown\) => handleAcceptanceArchive\(payload\)\);/);

    const appHandlerNames = [
      "handleAppConversationsList",
      "handleAppConversationOpen",
      "handleAppMessagesList",
      "handleAppMessageReveal",
      "handleAppMessageSend",
      "handleAppMembershipList",
      "handleAppInvitationsList",
      "handleAppDevicesList",
      "handleAppDeviceDetail",
      "handleAppDeviceRevoke",
      "handleAppIdentityTransitionList",
      "handleAppIdentityTransitionOpen",
      "handleAppDeletionRequestListReceived",
      "handleAppDeletionRequestOpen",
      "handleAppSafetyCenterOverview",
      "handleAppSettingsLoad",
    ];
    for (const name of appHandlerNames) {
      const startIndex = source.indexOf(`async function ${name}(`);
      expect(startIndex, `${name} must exist`).toBeGreaterThanOrEqual(0);
      const body = source.slice(startIndex, startIndex + 900);
      expect(body, `${name} must gate on requireShell()/requireBoundary()/activeAssembly`).toMatch(/require(Shell|Boundary|ViewerParticipant)\(\)|activeAssembly === null/);
    }
  });

  it("5. no generic execute/invoke IPC surface exists -- every fedos-app:* channel is a specific, narrow, named command; the preload never forwards an arbitrary channel string", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-app:execute"/);
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-app:invoke"/);
    const preloadSource = stripComments(read(PRELOAD_PATH));
    expect(preloadSource).not.toMatch(/ipcRenderer\.invoke\(channel/);
  });

  it("6. the two new Archive file-picker channels open a native OS dialog and return ONLY a chosen path -- never a generic read/write-arbitrary-path command", () => {
    const source = stripComments(read(MAIN_PATH));
    const exportDestStart = source.indexOf("async function handleAppArchiveChooseExportDestination(");
    expect(exportDestStart).toBeGreaterThanOrEqual(0);
    const exportDestBody = source.slice(exportDestStart, exportDestStart + 800);
    expect(exportDestBody).toMatch(/dialog\.showSaveDialog/);
    const sourceStart = source.indexOf("async function handleAppArchiveChooseSource(");
    expect(sourceStart).toBeGreaterThanOrEqual(0);
    const sourceBody = source.slice(sourceStart, sourceStart + 700);
    expect(sourceBody).toMatch(/dialog\.showOpenDialog/);
  });

  it("7. window.fedosApp is additive on the window.d.ts surface -- fedosProfile/fedosBeta/fedosAcceptance signatures remain untouched", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    expect(source).toMatch(/readonly fedosProfile: FedosProfileBridge;/);
    expect(source).toMatch(/readonly fedosBeta: FedosBetaBridge;/);
    // Secure Runtime Alpha 8121-8200 -- Security Finding 1: genuinely
    // optional now (absent unless acceptance mode is active), not a
    // weakening of the signature -- see `secure_runtime_alpha_8121_8200_acceptance_bridge_isolation.test.ts`.
    expect(source).toMatch(/readonly fedosAcceptance\?: FedosAcceptanceBridge;/);
    expect(source).toMatch(/readonly fedosApp: FedosAppBridge;/);
  });

  it("8. Electron security literals (contextIsolation/sandbox/nodeIntegration/webSecurity) remain untouched by this Arc, and no second BrowserWindow/preload/main entry point was added", () => {
    const source = read(MAIN_PATH);
    expect(source).toMatch(/contextIsolation:\s*true/);
    expect(source).toMatch(/sandbox:\s*true/);
    expect(source).toMatch(/nodeIntegration:\s*false/);
    expect(source).toMatch(/webSecurity:\s*true/);
    expect((source.match(/new BrowserWindow\(/g) ?? []).length).toBe(1);
  });

  it("9. no automatic Identity Replacement acceptance / Signed Deletion approval anywhere in this Arc's own new code -- accept/reject/defer and approve/reject are only ever invoked by an explicit renderer button click, never called from a status-refresh or list-load path", () => {
    const source = stripComments(read(MAIN_PATH));
    const listStart = source.indexOf("async function handleAppIdentityTransitionList(");
    const listBody = source.slice(listStart, listStart + 2000);
    expect(listBody).not.toMatch(/acceptSelected|identityTransitionAccept/);
    const rendererSource = stripComments(read(RENDERER_PATH));
    // the auto-refresh/list/open functions (called on nav/open, never on a
    // user's explicit accept/reject/defer/approve click) must never
    // themselves call the decision functions -- only an addEventListener
    // click callback may.
    const autoRefreshFnNames = ["refreshIdentityTransitionList", "openIdentityTransition", "refreshDeletionRequestList", "openDeletionRequest", "refreshSafetyCenter"];
    for (const fnName of autoRefreshFnNames) {
      const start = rendererSource.indexOf(`function ${fnName}(`);
      expect(start, `${fnName} must exist`).toBeGreaterThanOrEqual(0);
      const body = rendererSource.slice(start, start + 1200);
      expect(body, `${fnName} must never call a decision function itself`).not.toMatch(/decideIdentityTransition\(|decideDeletionRequest\(/);
    }
    // the decision functions themselves are wired ONLY from within a real
    // click listener. Secure Runtime Alpha 8121-8200 (Security Finding 3)
    // added a second argument (the exact target id, closed over from the
    // render call, never re-read from mutable "current selection" state
    // at click time); Security Finding 2 added a third (the sibling
    // decision buttons, disabled together while any one is in flight) --
    // the click-only wiring discipline is unchanged.
    expect(rendererSource).toMatch(/addEventListener\("click", \(\) => void decideIdentityTransition\("accept", target, decisionButtons\)\)/);
    expect(rendererSource).toMatch(/addEventListener\("click", \(\) => void decideDeletionRequest\("approve", targetRequestId, decisionButtons\)\)/);
  });

  it("10. no false security score -- the Safety Center renderer shows each section's own independent state text, never a single numeric/percentage score", () => {
    const rendererSource = stripComments(read(RENDERER_PATH));
    expect(rendererSource).not.toMatch(/securityScore|overallScore|safetyScore|\d+%\s*safe/i);
  });

  it("11. zero Rust source changed, zero p2p/.tmp_gen change, zero protocol/Ratchet/Identity/NIP-17/Secure-Memory source change by this Arc; the ONE Shell file this Arc touched is a disclosed, additive, non-protocol bug fix, never a redesign", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_crypto.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/identity").trim()).toBe("");
    expect(diffNames("src/desktop/production_activation").trim()).toBe("");
    // Secure Runtime Alpha 8121-8200 (Security Finding 3, external audit
    // delta `6873d24f`) later, disclosed, additively touched exactly these
    // two presentation-layer Controllers -- adding exact-id `accept()`/
    // `reject()`/`defer()`/`approve()` methods alongside the pre-existing
    // selection-based ones (kept, unmodified in behavior, for their own
    // historical callers) -- never a redesign, never removing a capability.
    // This Alpha 8041-8120 Arc's own original diff at 97f26f0f remains
    // otherwise unchanged; this file's own name/scope predates that later
    // Arc, so this ONE assertion is widened rather than the whole test
    // renamed.
    const presentationDiff = diffNames("src/desktop/presentation")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .sort();
    expect(presentationDiff).toEqual([
      "src/desktop/presentation/deletion_request/fedos_deletion_request_controller.ts",
      "src/desktop/presentation/identity_transition/fedos_identity_transition_controller.ts",
    ]);
    // Real, disclosed gaps this Arc's own real user-facing vertical slice found live:
    // (a) `createConversationInvitation()` never registered its own new conversation into
    //     `#knownConversationIds`, so the INVITER never saw their own new conversation;
    // (b) `listConversations()` had no way to discover a conversation known ONLY through
    //     real-time inbound delivery (the automatic-acceptance design this Arc's own Phase A
    //     report names), so the INVITEE never saw it either. Both fixed via already-existing,
    //     already-public accessors (`#knownConversationIds` itself, `FedosConversationRuntime.listDrafts()`)
    //     -- no new persistence, business rule, or Runtime capability, no protocol change.
    expect(diffNames("src/desktop/shell").trim()).toBe("src/desktop/shell/fedos_desktop_application_shell.ts");
    const shellSource = stripComments(read("src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts"));
    expect(shellSource).toMatch(/if \(outcome\.outcome === "sent"\) this\.#knownConversationIds\.add\(outcome\.conversationId\);/);
    expect(shellSource).toMatch(/for \(const draft of this\.#runtime\.conversationRuntime\(\)\.listDrafts\(\)\) allIds\.add\(draft\.id\);/);
  });

  it("12. no second Desktop Runtime / Shell / Presentation Boundary factory was added -- this Arc only WIDENS this file's own local structural TYPE for the boundary it already held a reference to", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/fedos_desktop_runtime_v2/);
    expect(diffOutput).not.toMatch(/fedos_desktop_application_shell_v2/);
    expect(diffOutput).not.toMatch(/fedos_desktop_conversation_ui_presentation_boundary_v2/);
  });

  it("13. this Arc's own real user-facing vertical slice test exists under packages/fedos-desktop-electron-spike/test/", () => {
    const sliceSource = read("packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts");
    expect(sliceSource.length).toBeGreaterThan(0);
    expect(sliceSource).toMatch(/executeJavaScript|AUTOTEST_MODE=ui-script|FEDOS_ELECTRON_BETA_AUTOTEST.*ui-script/);
  });
});
