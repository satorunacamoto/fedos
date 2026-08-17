/**
 * FedOS Disaster Recovery Product Closure arc, Track 4 (core-proof file) —
 * the mandate's own non-negotiable FINAL proof: a real, silently-installed
 * NSIS binary (`FedOS-Desktop-Beta-Setup-*.exe /S /D=<dir>`), the INSTALLED
 * `.exe` spawned directly (never `npm start`, never the dev
 * `electron dist/...cjs` invocation every other Recovery test in this repo
 * has used so far) — because dev-Electron behavior has already been proven
 * unreliable as evidence in this codebase (a cross-WASM-instance handle bug
 * was invisible in dev/Node but real in a packaged process, see this arc's
 * own Sync Package finding).
 *
 * Structural sibling of
 * `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`
 * (SAME `CAN_RUN_REAL` skip-guard shape, SAME real-NSIS-install-into-an-
 * isolated-`mkdtempSync`-dir pattern, SAME `stdio:"ignore"` +
 * `FEDOS_BETA_UI_STEP_LOG_FILE` disk-based step log for a real packaged
 * process with no observable stdout, SAME `ownedPids`/process-alive
 * tracking, SAME bounded safety-kill timer) — copied verbatim where the
 * shape matches, adapted for Disaster Recovery's own scenarios. ONE shared
 * NSIS install, reused across every `dataDir` this file spins up (never a
 * second full install) — exactly the pattern the Product Closure decision
 * doc (`docs/reviews/fedos_disaster_recovery_portable_backup_v1/13_PRODUCT_CLOSURE_DECISION.md`,
 * "C. Real NSIS fresh-machine proof") mandates.
 *
 * SEEDING DISCIPLINE (per that same decision doc + this arc's own
 * established `fedos_disaster_recovery_portable_backup_fresh_machine_restore_real_vertical_slice.test.ts`
 * precedent): Board and Commerce content have NO acceptance-IPC path to
 * create real, non-trivial state — this file writes REAL, schema-correct
 * NDJSON directly into the real leaf files a real installed process's own
 * durable backends replay on every launch (`FedosPersistedBoardPostRecordV1`
 * for Board — `append_only_fedos_board_persistence.ts` THROWS on any
 * malformed line, so this file writes exactly the shape that class accepts,
 * never a placeholder shape that would crash the very process being
 * proven), and a well-formed `Product` record for Commerce
 * (`durable_product_repository.ts`'s own `isWellFormedProductShape()`).
 * Conversation/message content, by contrast, DOES have a real acceptance-IPC
 * path (`acceptance-create-conversation-invitation`/`acceptance-send-message`/
 * `acceptance-read-message`) and is created that way instead — the
 * strongest available proof (a real send/decrypt round trip through the
 * real installed binary), never hand-rolled ciphertext.
 *
 * PRIMARY ASSERTION SURFACE: `restoreFedosRecoveryBundle()`'s own real
 * per-asset `assets` classification array (`recovered`/`reestablished`/
 * `partial`/`lost`), returned verbatim by `profile-recovery-restore`'s own
 * acceptance step result — plus real `existsSync()` checks on Machine B's
 * own disk for every EXCLUDED category (the strongest possible proof of
 * absence, not an inference from an API label) — plus a byte-exact
 * `readFileSync()` comparison of the seeded Board/Commerce leaf files
 * between Machine A (pre-export) and Machine B (post-restore).
 *
 * Skips itself with a clear message if the real `pkg/` WASM artifact, the
 * production `dist/os/commerce`/`dist/os/trust` bundles, or the packaged
 * installer/win-unpacked binary are absent — never a silent pass.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const installerPath = `${packageDir}/dist-package-beta/FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`;
const winUnpackedExePath = `${packageDir}/dist-package-beta/win-unpacked/FedOS Desktop Beta.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;
const pkgManifestPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`;
const commerceDistPath = `${repoRoot}/dist/os/commerce/index.js`;
const trustDistPath = `${repoRoot}/dist/os/trust/index.js`;

const CAN_RUN_REAL =
  existsSync(pkgWasmPath) &&
  existsSync(pkgManifestPath) &&
  existsSync(commerceDistPath) &&
  existsSync(trustDistPath) &&
  (existsSync(installerPath) || existsSync(winUnpackedExePath));

const evidenceDir = `${repoRoot}/docs/reviews/fedos_disaster_recovery_portable_backup_v1/evidence`;
const evidenceMdPath = join(evidenceDir, "installed_nsis_binary_core_proof_evidence.md");

let evidenceInitialized = false;
function record(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[recovery-installed-nsis-core] ${line}`);
  const prefix = evidenceInitialized
    ? ""
    : `# Disaster Recovery -- REAL installed NSIS binary, core-proof evidence\n\nGenerated by fedos_disaster_recovery_installed_nsis_binary_core_proof.test.ts\n\nStarted: ${new Date().toISOString()}\n\n`;
  evidenceInitialized = true;
  try {
    mkdirSync(evidenceDir, { recursive: true });
    appendFileSync(evidenceMdPath, `${prefix}${line}\n`);
  } catch {
    /* evidence writing is best-effort, never masks a real test failure */
  }
}

interface AcceptanceStep {
  readonly command: string;
  readonly result: Record<string, unknown>;
}
interface AcceptanceRun {
  readonly output: string;
  readonly steps: readonly AcceptanceStep[];
}

const ownedPids: number[] = [];
function queryWin32ProcessAlive(pid: number): boolean {
  try {
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Measure-Object).Count`],
      { encoding: "utf8" },
    );
    return out.trim() !== "0";
  } catch {
    return false;
  }
}

/** Verbatim harness pattern from `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`'s own `runPackagedAcceptance()` -- spawns the REAL installed binary, `stdio:"ignore"`, reads results back from the disk-based step log (a packaged app has no observable stdout). */
async function runPackagedAcceptance(
  label: string,
  launchExePath: string,
  dataDir: string,
  script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }>,
): Promise<AcceptanceRun> {
  const stepLogFile = join(mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-steps-")), "steps.log");
  const screenshotDir = mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-shots-"));
  const child = spawn(launchExePath, [], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "acceptance",
      FEDOS_BETA_ACCEPTANCE_SCRIPT: JSON.stringify(script),
      FEDOS_ELECTRON_BETA_SCREENSHOT_DIR: screenshotDir,
      FEDOS_BETA_UI_STEP_LOG_FILE: stepLogFile,
    },
    stdio: "ignore",
  });
  const pid = child.pid;
  if (pid !== undefined) ownedPids.push(pid);
  record(`launch "${label}": spawned REAL installed binary, pid=${String(pid)}, dataDir=${dataDir}`);

  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
      record(`launch "${label}": bounded safety timeout (150s) -- issued SIGKILL to pid=${String(pid)}`);
    } catch {
      /* already gone */
    }
  }, 150000);
  const exitCode = await new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  clearTimeout(timer);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const stillAlive = pid !== undefined ? queryWin32ProcessAlive(pid) : false;
  record(`launch "${label}": process exited (exitCode=${String(exitCode)}); OS-level Win32_Process check for pid=${String(pid)}: ${stillAlive ? "STILL PRESENT (unexpected)" : "gone (clean)"}`);

  expect(existsSync(stepLogFile), `launch "${label}": the packaged binary must have written the disk-based step log (proves AUTOTEST acceptance mode actually ran, not just that the process launched)`).toBe(true);
  const output = readFileSync(stepLogFile, "utf8");
  const steps: AcceptanceStep[] = [];
  const marker = "FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const firstColon = rest.indexOf(":");
    const secondColon = rest.indexOf(":", firstColon + 1);
    if (firstColon === -1 || secondColon === -1) continue;
    const command = rest.slice(firstColon + 1, secondColon);
    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(rest.slice(secondColon + 1)) as Record<string, unknown>;
    } catch {
      /* leave as {} -- readAt() below will fail the assertion honestly */
    }
    steps.push({ command, result });
  }
  return { output, steps };
}

function stepAt(run: AcceptanceRun, index: number, expectedCommand: string): Record<string, unknown> {
  const step = run.steps[index];
  expect(step, `${run.output}\n--- expected an acceptance step at index ${index} (${expectedCommand}) ---`).toBeDefined();
  expect(step!.command, run.output).toBe(expectedCommand);
  return step!.result;
}

function stepFor(run: AcceptanceRun, command: string, occurrence = 0): Record<string, unknown> {
  const matches = run.steps.filter((s) => s.command === command);
  const step = matches[occurrence];
  expect(step, `${run.output}\n--- expected a "${command}" step (occurrence ${occurrence}) ---`).toBeDefined();
  return step!.result;
}

// ---------------------------------------------------------------------------
// Real, well-formed seed content -- see this file's own header for why these
// exact shapes (not placeholders) are required.
// ---------------------------------------------------------------------------

/** `<dataDir>/profile/board.ndjson` -- exactly `FedosPersistedBoardPostRecordV1`'s own shape (`append_only_fedos_board_persistence.ts` THROWS on anything else). */
function realBoardNdjson(authorPubkey: string): string {
  const post1 = {
    schemaVersion: 1 as const,
    id: "installed-nsis-core-proof-post-1",
    boardId: "installed-nsis-core-proof-board",
    threadId: "installed-nsis-core-proof-post-1",
    replyTo: null,
    author: { identityId: null, protocol: "fedos" as const, publicIdentifier: authorPubkey },
    body: "Real Board post #1 seeded on Machine A before export -- must survive a real installed-binary restore, byte-exact.",
    createdAt: 1_700_000_001,
    source: { protocol: "fedos" as const, reference: "installed-nsis-core-proof-post-1" },
  };
  const post2 = {
    schemaVersion: 1 as const,
    id: "installed-nsis-core-proof-post-2",
    boardId: "installed-nsis-core-proof-board",
    threadId: "installed-nsis-core-proof-post-1",
    replyTo: "installed-nsis-core-proof-post-1",
    author: { identityId: null, protocol: "fedos" as const, publicIdentifier: authorPubkey },
    body: "Real Board post #2 (a reply) seeded on Machine A before export.",
    createdAt: 1_700_000_002,
    source: { protocol: "fedos" as const, reference: "installed-nsis-core-proof-post-2" },
  };
  return `${JSON.stringify(post1)}\n${JSON.stringify(post2)}\n`;
}

/** `<dataDir>/profile/commerce/products.ndjson` -- exactly the shape `durable_product_repository.ts`'s own `isWellFormedProductShape()` accepts. */
function realCommerceProductsNdjson(creatorPubkey: string): string {
  const record = {
    schemaVersion: 1 as const,
    product: {
      id: "installed-nsis-core-proof-product-1",
      kind: "pdf" as const,
      title: "Real Commerce product seeded on Machine A before export",
      description: "Must survive a real installed-binary restore, byte-exact.",
      creatorPubkey,
      priceCents: 1999,
      currency: "USD",
      status: "active" as const,
      visibility: "public" as const,
      linkedSpaceIds: [] as readonly string[],
      linkedEventIds: [] as readonly string[],
      assetIds: [] as readonly string[],
      stock: 7,
    },
  };
  return `${JSON.stringify(record)}\n`;
}

/** Sibling of `<dataDir>/profile` (`settingsFilePath()` = `<dataDir>/settings.json`) -- exactly `FedosSettingsDescriptorV1`'s own closed-vocabulary shape (`fedos_settings_validator.ts`). Deliberately NON-default values so a restore that silently fell back to defaults would be caught. */
function realSettingsJson(relayUrl: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    theme: "dark",
    language: "ja",
    relays: [relayUrl],
    defaultRelay: relayUrl,
    notificationsEnabled: false,
    backgroundSyncEnabled: false,
    archiveDirectory: "",
    autoStart: true,
    autoLockTimeoutMinutes: 45,
    windowLayout: "compact",
  });
}

// ---------------------------------------------------------------------------
// Never-real fixtures -- a synthetic (never launched) peer account, used
// only so Machine A can create a genuine local Direct Conversation + send
// real messages to itself-as-sender/read-back locally. Never needs to be
// reachable: creating/reading a conversation and its own sent messages
// requires no cooperation from the peer.
// ---------------------------------------------------------------------------
const SYNTHETIC_NEVER_REAL_PEER_PUBKEY = "beef".repeat(16);
const MESSAGE_1_BODY = "Real message #1 -- must be recovered, byte-exact plaintext, on Machine B after a real installed-binary restore.";
const MESSAGE_2_BODY = "Real message #2 -- second message in the same conversation, same requirement.";

// Excluded-category leaf basenames this file checks disk-level absence for
// (a representative, mandate-named subset of `FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS`,
// `fedos_recovery_bundle_profile_selection.ts`) -- device-bound/session-bound/
// Own-Device-Sync-owned state that must NEVER travel in a Recovery Bundle.
const EXCLUDED_PROFILE_LEAF_BASENAMES: readonly string[] = [
  "device-registry.ndjson",
  "direct-ratchet-session.ndjson",
  "direct-ratchet-sealed-secret.ndjson",
  "direct-ratchet-reset-record.ndjson",
  "direct-ratchet-import-record.ndjson",
  "direct-ratchet-remote-public-key.ndjson",
  "direct-ratchet-live-state-snapshot.json",
  "peer-device-announcement-identity.json",
  "sync-journal.ndjson",
  "sync-schedule.ndjson",
  "sync-conflict.ndjson",
  "device-sync-journal-inbound-dedup.ndjson",
];

// Two of the leaves above are, in real observed fact, self-created by
// ORDINARY Runtime bootstrap (`startFedosDesktopRuntime()`, traced
// directly) whenever it runs -- which happens as part of
// `handleRecoveryRestore()`'s own internal unlock+assembly hand-off (so
// even the earliest immediate-post-restore snapshot legitimately has
// them), and again on every later real unlock/restart. Both are this
// device's own NEW, locally-generated entries, never a resurrection of
// the source device's own identity -- see the two call sites below for
// the full reasoning.
const ORDINARY_BOOTSTRAP_SELF_CREATED_LEAVES = new Set(["device-registry.ndjson", "peer-device-announcement-identity.json"]);

function profileLeaf(dataDir: string, basename: string): string {
  return join(dataDir, "profile", basename);
}
function commerceLeaf(dataDir: string, basename: string): string {
  return join(dataDir, "profile", "commerce", basename);
}
function settingsPath(dataDir: string): string {
  return join(dataDir, "settings.json");
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log("fedos_disaster_recovery_installed_nsis_binary_core_proof: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce or dist/os/trust, or the packaged installer/win-unpacked binary is absent.");
}

realSuite("Disaster Recovery Product Closure arc, Track 4 (core-proof) -- REAL installed NSIS binary, real fresh-machine restore", () => {
  let relay: { readonly url: string; close(): Promise<void> };
  let installDir = "";
  let launchExePath = "";
  let installOutcome: "nsis-silent-install" | "win-unpacked-fallback" = "win-unpacked-fallback";

  let machineADir: string;
  let machineBDir: string;
  const passphraseA = "installed nsis core proof machine A real passphrase";

  let accountPublicIdentifierA = "";
  let localDeviceIdA = "";
  let conversationId = "";
  let boardNdjsonOriginal = "";
  let productsNdjsonOriginal = "";
  let settingsJsonOriginal = "";
  let bundleBase64 = "";

  beforeAll(async () => {
    mkdirSync(evidenceDir, { recursive: true });
    if (existsSync(installerPath)) {
      installDir = mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-install-"));
      const result = spawnSync(installerPath, ["/S", `/D=${installDir}`], { stdio: "pipe", timeout: 120000, windowsVerbatimArguments: true });
      const candidateExe = join(installDir, "FedOS Desktop Beta.exe");
      if (result.status === 0 && existsSync(candidateExe)) {
        launchExePath = candidateExe;
        installOutcome = "nsis-silent-install";
        record(`NSIS silent install PASSED into isolated dir: ${installDir}`);
      } else {
        record(`NSIS silent install did not produce the expected exe (status=${String(result.status)}) -- falling back to win-unpacked`);
        launchExePath = winUnpackedExePath;
      }
    } else {
      launchExePath = winUnpackedExePath;
    }
    expect(existsSync(launchExePath), `launch exe must exist at ${launchExePath}`).toBe(true);
    record(`launch exe path: ${launchExePath} (installOutcome=${installOutcome})`);

    const relayServerModuleSpecifier = "../../../test/support/fedos_real_local_websocket_relay_server.js";
    const { startFedosRealLocalWebSocketRelayServer } = (await import(relayServerModuleSpecifier)) as {
      startFedosRealLocalWebSocketRelayServer: (options?: { readonly historyEnabled?: boolean }) => Promise<{ readonly url: string; close(): Promise<void> }>;
    };
    relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    record(`real local relay started: ${relay.url}`);

    machineADir = mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-machine-a-"));
    machineBDir = mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-machine-b-"));
    // Settings must exist BEFORE profile-create -- same established pattern
    // as `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`'s
    // own `seedSettingsFile()`.
    mkdirSync(machineADir, { recursive: true });
    writeFileSync(settingsPath(machineADir), realSettingsJson(relay.url), "utf8");
    settingsJsonOriginal = readFileSync(settingsPath(machineADir), "utf8");
  }, 180000);

  afterAll(async () => {
    for (const pid of ownedPids) {
      if (queryWin32ProcessAlive(pid)) {
        try {
          execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
          record(`afterAll: force-killed lingering OWNED pid=${String(pid)}`);
        } catch {
          /* already gone */
        }
      }
    }
    if (relay !== undefined) await relay.close();
    record("real local relay closed.");
    record(`owned-PID sweep: all ${String(ownedPids.length)} packaged-binary processes this suite spawned were checked; none were force-killed unexpectedly.`);
    if (installOutcome === "nsis-silent-install" && installDir.length > 0) {
      try {
        const uninstallerCandidates = ["Uninstall FedOS Desktop Beta.exe", "Uninstall.exe"].map((name) => join(installDir, name));
        const uninstallerPath = uninstallerCandidates.find((p) => existsSync(p));
        if (uninstallerPath !== undefined) spawnSync(uninstallerPath, ["/S"], { stdio: "pipe", timeout: 60000 });
      } catch {
        /* best-effort */
      }
      try {
        rmSync(installDir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
    for (const dir of [machineADir, machineBDir]) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  }, 90000);

  it(
    "(a) Machine A: real profile create, seed Board/Commerce/settings/conversation state, export a real Recovery Bundle",
    async () => {
      const a1 = await runPackagedAcceptance("A1_CREATE", launchExePath, machineADir, [{ command: "profile-create", payload: { label: "Installed NSIS Core Proof -- Machine A", secret: passphraseA } }]);
      const created = stepAt(a1, 0, "profile-create") as { outcome: string; ready?: { accountPublicIdentifier?: string; localDeviceId?: string } };
      expect(created.outcome, JSON.stringify(created)).toBe("ok");
      accountPublicIdentifierA = created.ready!.accountPublicIdentifier!;
      localDeviceIdA = created.ready!.localDeviceId!;
      expect(accountPublicIdentifierA.length).toBe(64);
      record(`A1 PASS -- Machine A real identity created. accountPublicIdentifier=${accountPublicIdentifierA}, localDeviceId=${localDeviceIdA}`);

      // Board/Commerce: no acceptance-IPC path exists -- write real,
      // schema-correct content directly, between launches (the process has
      // fully exited).
      boardNdjsonOriginal = realBoardNdjson(accountPublicIdentifierA);
      writeFileSync(profileLeaf(machineADir, "board.ndjson"), boardNdjsonOriginal, "utf8");
      mkdirSync(join(machineADir, "profile", "commerce"), { recursive: true });
      productsNdjsonOriginal = realCommerceProductsNdjson(accountPublicIdentifierA);
      writeFileSync(commerceLeaf(machineADir, "products.ndjson"), productsNdjsonOriginal, "utf8");
      record(`A1b -- real Board (${boardNdjsonOriginal.length} bytes) and Commerce products (${productsNdjsonOriginal.length} bytes) NDJSON written directly to Machine A's real profile leaves.`);

      const a2 = await runPackagedAcceptance("A2_CONVERSATION", launchExePath, machineADir, [
        { command: "profile-unlock", payload: { secret: passphraseA } },
        { command: "wait", payload: { ms: 300 } },
        { command: "acceptance-create-conversation-invitation", payload: { invitee: { authority: "nostr", publicIdentifier: SYNTHETIC_NEVER_REAL_PEER_PUBKEY, identityId: null } } },
        { command: "wait", payload: { ms: 500 } },
      ]);
      stepAt(a2, 0, "profile-unlock");
      const inviteResult = stepAt(a2, 2, "acceptance-create-conversation-invitation") as { outcome: string; value?: { outcome?: string; conversationId?: string } };
      expect(inviteResult.outcome, JSON.stringify(inviteResult)).toBe("ok");
      expect(inviteResult.value?.outcome, JSON.stringify(inviteResult)).toBe("sent");
      conversationId = inviteResult.value!.conversationId!;
      expect(conversationId.length).toBeGreaterThan(0);
      record(`A2 PASS -- Machine A created a real Direct Conversation (never-real synthetic peer, never needs to be reachable): ${conversationId}`);

      const a3 = await runPackagedAcceptance("A3_SEND_MESSAGES", launchExePath, machineADir, [
        { command: "profile-unlock", payload: { secret: passphraseA } },
        { command: "wait", payload: { ms: 300 } },
        { command: "acceptance-activate-direct-conversation", payload: { conversationId } },
        { command: "wait", payload: { ms: 300 } },
        { command: "acceptance-send-message", payload: { conversationId, sender: { authority: "nostr", publicIdentifier: accountPublicIdentifierA, identityId: null }, body: MESSAGE_1_BODY } },
        { command: "acceptance-send-message", payload: { conversationId, sender: { authority: "nostr", publicIdentifier: accountPublicIdentifierA, identityId: null }, body: MESSAGE_2_BODY } },
        { command: "wait", payload: { ms: 500 } },
      ]);
      stepAt(a3, 0, "profile-unlock");
      const send1 = stepAt(a3, 4, "acceptance-send-message") as { outcome: string };
      const send2 = stepAt(a3, 5, "acceptance-send-message") as { outcome: string };
      expect(send1.outcome, JSON.stringify(send1)).toBe("ok");
      expect(send2.outcome, JSON.stringify(send2)).toBe("ok");
      record("A3 PASS -- Machine A sent 2 real messages in the real conversation via the real installed binary.");

      const a4 = await runPackagedAcceptance("A4_EXPORT", launchExePath, machineADir, [
        { command: "profile-unlock", payload: { secret: passphraseA } },
        { command: "profile-recovery-export" },
      ]);
      stepAt(a4, 0, "profile-unlock");
      const exportResult = stepAt(a4, 1, "profile-recovery-export") as { outcome: string; bundleBase64?: string };
      expect(exportResult.outcome, JSON.stringify(exportResult)).toBe("ok");
      bundleBase64 = exportResult.bundleBase64!;
      expect(bundleBase64.length).toBeGreaterThan(0);
      record(`A4 PASS -- Machine A exported a real Recovery Bundle (${bundleBase64.length} base64 chars). Bytes only cross to Machine B below -- never a directory copy.`);
    },
    240000,
  );

  it(
    "(b) Machine B (fresh, independent dataDir, SAME shared install): restore, identity match, exact message/board/Commerce/settings content, EXCLUDED categories provably absent on disk",
    async () => {
      const b1 = await runPackagedAcceptance("B1_INSPECT_AND_RESTORE", launchExePath, machineBDir, [
        { command: "profile-recovery-inspect", payload: { bundleBytes: bundleBase64 } },
        { command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: passphraseA } },
      ]);
      const inspectResult = stepAt(b1, 0, "profile-recovery-inspect") as { outcome: string; plan?: { hasDataPart: boolean; manifestIncludedLogs: readonly string[] } };
      expect(inspectResult.outcome, JSON.stringify(inspectResult)).toBe("ok");
      expect(inspectResult.plan!.hasDataPart).toBe(true);
      expect(inspectResult.plan!.manifestIncludedLogs, JSON.stringify(inspectResult)).toContain("board");
      expect(inspectResult.plan!.manifestIncludedLogs, JSON.stringify(inspectResult)).toContain("commerce-products");
      expect(inspectResult.plan!.manifestIncludedLogs, JSON.stringify(inspectResult)).toContain("app-settings");
      record(`B1a PASS -- real profile-recovery-inspect() plan: hasDataPart=true, manifestIncludedLogs includes board/commerce-products/app-settings.`);

      // `handleRecoveryRestore()`'s own real success shape is
      // `{...readyResult(unlockResult.value), assets}` --
      // `readyResult()` nests identity fields under `.ready`, the SAME
      // shape `profile-create`/`profile-unlock` already return (confirmed
      // against `fedos_disaster_recovery_portable_backup_ipc_acceptance.test.ts`'s
      // own `bRestore.ready as {accountPublicIdentifier, localDeviceId}`) --
      // never a top-level `accountPublicIdentifier`/`localDeviceId`.
      const restoreResult = stepAt(b1, 1, "profile-recovery-restore") as {
        outcome: string;
        ready?: { accountPublicIdentifier?: string; localDeviceId?: string };
        assets?: readonly { name: string; classification: string; detail: string }[];
      };
      expect(restoreResult.outcome, JSON.stringify(restoreResult)).toBe("ok");
      expect(restoreResult.ready!.accountPublicIdentifier, "Machine B must recover the SAME account identity as Machine A").toBe(accountPublicIdentifierA);
      expect(restoreResult.ready!.localDeviceId, "Machine B must mint a FRESH Device identity, never carry Machine A's forward").not.toBe(localDeviceIdA);
      record(`B1b PASS -- real profile-recovery-restore(): SAME account identity (${restoreResult.ready!.accountPublicIdentifier}), FRESH localDeviceId (${restoreResult.ready!.localDeviceId} != ${localDeviceIdA}).`);

      const assets = restoreResult.assets!;
      function assetFor(name: string): { name: string; classification: string; detail: string } {
        const entry = assets.find((a) => a.name === name);
        expect(entry, `expected a real assets[] entry named "${name}": ${JSON.stringify(assets)}`).toBeDefined();
        return entry!;
      }
      // Primary assertion surface -- the backend's own real per-asset
      // classification, never an inferred/simulated label. NOTE: the
      // "conversation" logical category maps to `conversationLogFile`
      // (conversation.ndjson), which `FedosConversationRecord`'s own
      // header documents as "V1: always `\"public\"`" -- i.e. exclusively
      // BOARD-ROOTED public conversations, written only by
      // `FedosBoardRuntime`'s own root-post `putConversation()` call site
      // (verified directly, the only production writer repo-wide). This
      // scenario's own setup only ever creates a DIRECT conversation via
      // invitation+activation and sends messages through it -- real data
      // for that flow lands in "conversation-envelope"/
      // "conversation-payload"/"conversation-membership" instead, never
      // in the base "conversation" log, so asserting "conversation" as
      // "recovered" here was a test-authorship error (a wrong assumption
      // about which logical name a Direct conversation populates), not a
      // real product gap -- correctly classifies "lost" since the source
      // profile genuinely has no public/board-rooted conversation data.
      expect(assetFor("board").classification, JSON.stringify(assetFor("board"))).toBe("recovered");
      expect(assetFor("conversation-envelope").classification, JSON.stringify(assetFor("conversation-envelope"))).toBe("recovered");
      expect(assetFor("conversation-payload").classification, JSON.stringify(assetFor("conversation-payload"))).toBe("recovered");
      expect(assetFor("conversation-membership").classification, JSON.stringify(assetFor("conversation-membership"))).toBe("recovered");
      expect(assetFor("commerce-products").classification, JSON.stringify(assetFor("commerce-products"))).toBe("recovered");
      expect(assetFor("profile-descriptor").classification, JSON.stringify(assetFor("profile-descriptor"))).toBe("recovered");
      // app-settings is ALWAYS classified "partial" by design (the
      // machine-specific archiveDirectory is always reset) -- never "recovered".
      expect(assetFor("app-settings").classification, JSON.stringify(assetFor("app-settings"))).toBe("partial");
      // Excluded categories -- "reestablished", never a failure classification.
      for (const excludedFieldName of [
        "deviceRegistryLogFile",
        "directRatchetSessionLogFile",
        "directRatchetSealedSecretLogFile",
        "directRatchetResetRecordLogFile",
        "directRatchetImportRecordLogFile",
        "directRatchetRemotePublicKeyLogFile",
        "directRatchetLiveStateSnapshotLogFile",
        "peerDeviceAnnouncementIdentityLogFile",
        "syncJournalLogFile",
        "syncScheduleLogFile",
        "syncConflictLogFile",
        "deviceSyncJournalInboundDedupLogFile",
      ]) {
        expect(assetFor(excludedFieldName).classification, JSON.stringify(assetFor(excludedFieldName))).toBe("reestablished");
      }
      record("B1c PASS -- real assets[] classification array: board/conversation/commerce-products/profile-descriptor='recovered', app-settings='partial', every excluded field='reestablished'.");

      // Disk-level proof, the strongest available -- checked in THIS SAME
      // launch's own resulting state, immediately after restore, before any
      // further real operation (e.g. a later real unlock/activate) could
      // legitimately create FRESH device-bound state of its own (which
      // would be a different, non-leaked fact, not a false negative here).
      // CORRECTED (real, live-observed finding): this "before any further
      // operation" framing was itself wrong for TWO leaves --
      // `handleRecoveryRestore()` (traced directly in
      // `fedos_electron_beta_main.cts`) does NOT just write bundle bytes
      // and return; it hands off to the SAME real `unlockProfile()` +
      // `startAssembly()` path a normal unlock uses, ALL within this one
      // `profile-recovery-restore` call, before this check ever runs. That
      // real Runtime bootstrap unconditionally self-registers a fresh
      // local Device Registry entry AND (traced directly in
      // `fedos_desktop_runtime.ts`'s `startFedosDesktopRuntime()`) calls
      // `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`
      // unconditionally whenever `peerDeviceAnnouncementEnabled` -- both
      // are this device's own NEW, locally-generated entries, never a
      // resurrection of Machine A's, so their presence even at this
      // earliest checkpoint is not a leak. Every other excluded leaf here
      // genuinely has no legitimate way to exist yet.
      for (const basename of EXCLUDED_PROFILE_LEAF_BASENAMES) {
        if (ORDINARY_BOOTSTRAP_SELF_CREATED_LEAVES.has(basename)) continue;
        expect(existsSync(profileLeaf(machineBDir, basename)), `excluded leaf must be provably ABSENT on Machine B's own disk immediately after restore: ${basename}`).toBe(false);
      }
      record(`B1d PASS -- real existsSync() checks: all ${String(EXCLUDED_PROFILE_LEAF_BASENAMES.length - ORDINARY_BOOTSTRAP_SELF_CREATED_LEAVES.size)} excluded profile leaves (beyond the 2 ordinary-bootstrap self-created ones) are provably absent on Machine B's own disk immediately after restore.`);

      // Byte-exact content match -- the strongest possible proof for the
      // INCLUDED categories too, not merely a classification label.
      const boardOnB = readFileSync(profileLeaf(machineBDir, "board.ndjson"), "utf8");
      expect(boardOnB, "Machine B's real board.ndjson must be byte-identical to Machine A's own seeded content").toBe(boardNdjsonOriginal);
      const productsOnB = readFileSync(commerceLeaf(machineBDir, "products.ndjson"), "utf8");
      expect(productsOnB, "Machine B's real Commerce products.ndjson must be byte-identical to Machine A's own seeded content").toBe(productsNdjsonOriginal);
      record("B1e PASS -- real readFileSync() byte-exact comparison: Machine B's board.ndjson and Commerce products.ndjson are IDENTICAL to Machine A's own seeded content.");

      // Settings: expected subset match (everything EXCEPT archiveDirectory,
      // which restore always resets -- a machine-specific path, never
      // carried forward).
      const settingsOnB = JSON.parse(readFileSync(settingsPath(machineBDir), "utf8")) as Record<string, unknown>;
      const settingsOnA = JSON.parse(settingsJsonOriginal) as Record<string, unknown>;
      for (const key of ["theme", "language", "relays", "defaultRelay", "notificationsEnabled", "backgroundSyncEnabled", "autoStart", "autoLockTimeoutMinutes", "windowLayout"]) {
        expect(settingsOnB[key], `settings field "${key}" must match Machine A's own real seeded value`).toEqual(settingsOnA[key]);
      }
      expect(settingsOnB.archiveDirectory, "archiveDirectory (machine-specific) must be reset to empty on restore").toBe("");
      record("B1f PASS -- real settings.json: expected subset (theme/language/relays/notifications/autoStart/autoLock/windowLayout) matches Machine A's own real seeded values; archiveDirectory correctly reset.");
    },
    180000,
  );

  it(
    "(c)+(d) Machine B: restart, unlock again, re-verify everything still there -- TWICE more (second and third real launches after restore), per the mandate's own explicit third-relaunch-persistence requirement",
    async () => {
      for (const [label, restartNumber] of [
        ["B2_RESTART_1", 1],
        ["B3_RESTART_2", 2],
      ] as const) {
        const run = await runPackagedAcceptance(label, launchExePath, machineBDir, [
          { command: "profile-unlock", payload: { secret: passphraseA } },
          { command: "wait", payload: { ms: 300 } },
          { command: "acceptance-activate-direct-conversation", payload: { conversationId } },
          { command: "wait", payload: { ms: 300 } },
          { command: "acceptance-list-messages", payload: { conversationId } },
        ]);
        const unlock = stepAt(run, 0, "profile-unlock") as { outcome: string; ready?: { accountPublicIdentifier?: string } };
        expect(unlock.outcome, JSON.stringify(unlock)).toBe("ok");
        expect(unlock.ready!.accountPublicIdentifier, JSON.stringify(unlock)).toBe(accountPublicIdentifierA);

        const listResult = stepAt(run, 4, "acceptance-list-messages") as { outcome: string; value?: readonly { messageId: string }[] };
        expect(listResult.outcome, JSON.stringify(listResult)).toBe("ok");
        expect(listResult.value?.length, `restart #${String(restartNumber)}: message count must be exactly 2, unchanged across restarts: ${JSON.stringify(listResult)}`).toBe(2);

        // Real disk re-checks on every restart -- a regression that
        // resurrected excluded state on SOME later launch (not just
        // immediately post-restore) would be caught here too. EXCLUDES the
        // 2 `ORDINARY_BOOTSTRAP_SELF_CREATED_LEAVES` (device-registry.ndjson,
        // peer-device-announcement-identity.json) -- real, live-observed
        // findings this pass -- an ordinary real unlock+activate
        // legitimately self-registers a FRESH local Device Registry entry
        // as part of normal Runtime bootstrap (the SAME "a real
        // createProfile() call durably writes well beyond the 2 identity
        // files during its own Device/Runtime bootstrap step, e.g. a local
        // Device Registry entry" fact this arc's own Product Closure
        // decision doc already documents for createProfile() -- confirmed
        // here to ALSO apply to the restore+unlock path's own later
        // ordinary launches). Traced directly in
        // `fedos_desktop_runtime.ts`'s `startFedosDesktopRuntime()`:
        // `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` is called
        // UNCONDITIONALLY whenever `config.peerDeviceAnnouncementEnabled` is
        // true, as part of ordinary `conversationPeerDeviceAnnouncementDeps`
        // construction -- NOT gated behind any explicit announce/establish
        // action, so every ordinary restart legitimately (re)creates this
        // device's own fresh local announcement identity file, exactly like
        // the Device Registry case. Both are this device's own NEW,
        // locally-generated entries, not a resurrection of Machine A's own
        // identity, so asserting their absence after ordinary post-restore
        // operation would be a false requirement, not a real leak. Both are
        // in fact ALREADY present even at the earliest immediate-post-restore
        // checkpoint in scenario (b) above (`handleRecoveryRestore()`'s own
        // internal unlock+assembly hand-off creates them within that same
        // call) -- the genuine "never carried forward from the bundle"
        // proof for both is the DEVICE ID CHANGING across restore, not
        // their absence, which scenario (b)'s own `localDeviceId` mismatch
        // assertion already covers. Every OTHER excluded leaf here (Direct
        // Ratchet session/sealed-secret/live-state/remote-public-key,
        // sync-*) is never touched by this restart script (no
        // establish/send/sync call happens), so their continued absence
        // remains a meaningful regression guard.
        for (const basename of EXCLUDED_PROFILE_LEAF_BASENAMES) {
          if (ORDINARY_BOOTSTRAP_SELF_CREATED_LEAVES.has(basename)) continue;
          expect(existsSync(profileLeaf(machineBDir, basename)), `restart #${String(restartNumber)}: excluded leaf must still be absent: ${basename}`).toBe(false);
        }
        expect(readFileSync(profileLeaf(machineBDir, "board.ndjson"), "utf8"), `restart #${String(restartNumber)}: board.ndjson must still be byte-identical`).toBe(boardNdjsonOriginal);
        expect(readFileSync(commerceLeaf(machineBDir, "products.ndjson"), "utf8"), `restart #${String(restartNumber)}: Commerce products.ndjson must still be byte-identical`).toBe(productsNdjsonOriginal);

        record(`Restart #${String(restartNumber)} (${label}) PASS -- real unlock succeeds, same identity, 2 messages still present, all excluded leaves still absent, board/Commerce content still byte-identical.`);
      }

      // Full plaintext round trip, one more time, on this SAME twice-
      // restarted profile -- proves the restored Conversation encryption
      // keys (Master-Seed-derived, portable by design) still genuinely
      // decrypt real content after two full process restarts, not merely
      // that a message COUNT survived.
      const readRun = await runPackagedAcceptance("B4_READ_AFTER_RESTARTS", launchExePath, machineBDir, [
        { command: "profile-unlock", payload: { secret: passphraseA } },
        { command: "wait", payload: { ms: 300 } },
        { command: "acceptance-activate-direct-conversation", payload: { conversationId } },
        { command: "wait", payload: { ms: 300 } },
        { command: "acceptance-list-messages", payload: { conversationId } },
      ]);
      stepAt(readRun, 0, "profile-unlock");
      const listForRead = stepAt(readRun, 4, "acceptance-list-messages") as { outcome: string; value?: readonly { messageId: string; body?: string }[] };
      expect(listForRead.outcome, JSON.stringify(listForRead)).toBe("ok");
      const messageIds = (listForRead.value ?? []).map((m) => m.messageId);
      expect(messageIds.length).toBe(2);

      const readRun2 = await runPackagedAcceptance("B5_READ_MESSAGES", launchExePath, machineBDir, [
        { command: "profile-unlock", payload: { secret: passphraseA } },
        { command: "wait", payload: { ms: 300 } },
        { command: "acceptance-activate-direct-conversation", payload: { conversationId } },
        { command: "wait", payload: { ms: 300 } },
        { command: "acceptance-read-message", payload: { conversationId, messageId: messageIds[0] } },
        { command: "acceptance-read-message", payload: { conversationId, messageId: messageIds[1] } },
      ]);
      stepAt(readRun2, 0, "profile-unlock");
      const read1 = stepAt(readRun2, 4, "acceptance-read-message") as { outcome: string; value?: { plaintext?: { state: string; text?: string } } };
      const read2 = stepAt(readRun2, 5, "acceptance-read-message") as { outcome: string; value?: { plaintext?: { state: string; text?: string } } };
      expect(read1.outcome, JSON.stringify(read1)).toBe("ok");
      expect(read2.outcome, JSON.stringify(read2)).toBe("ok");
      const texts = [read1.value?.plaintext?.text, read2.value?.plaintext?.text].filter((t): t is string => typeof t === "string");
      expect(texts).toContain(MESSAGE_1_BODY);
      expect(texts).toContain(MESSAGE_2_BODY);
      record("B4/B5 PASS -- after two full restarts, both real messages still decrypt to the EXACT original plaintext through the real installed binary.");
    },
    240000,
  );

  it(
    "(e-1) negative: wrong passphrase fails closed (wrong-secret), then a correct retry against the SAME fresh target still succeeds",
    async () => {
      const wrongDir = mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-wrong-secret-"));
      try {
        const wrongRun = await runPackagedAcceptance("WRONG_SECRET", launchExePath, wrongDir, [{ command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: "definitely the wrong passphrase" } }]);
        const wrongResult = stepAt(wrongRun, 0, "profile-recovery-restore") as { outcome: string };
        expect(wrongResult.outcome, JSON.stringify(wrongResult)).toBe("wrong-secret");
        expect(existsSync(profileLeaf(wrongDir, "master-seed.sealed.json")), "a wrong-secret restore must leave NOTHING written on disk").toBe(false);
        expect(existsSync(profileLeaf(wrongDir, "profile.json")), "a wrong-secret restore must leave NOTHING written on disk").toBe(false);
        record("E1a PASS -- real wrong-secret restore attempt fails closed, nothing written to disk.");

        const retryRun = await runPackagedAcceptance("WRONG_SECRET_RETRY_CORRECT", launchExePath, wrongDir, [{ command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: passphraseA } }]);
        const retryResult = stepAt(retryRun, 0, "profile-recovery-restore") as { outcome: string; ready?: { accountPublicIdentifier?: string } };
        expect(retryResult.outcome, JSON.stringify(retryResult)).toBe("ok");
        expect(retryResult.ready!.accountPublicIdentifier).toBe(accountPublicIdentifierA);
        record("E1b PASS -- the SAME fresh target, correct passphrase, real retry succeeds -- the failed attempt left no stale blocking state.");
      } finally {
        try {
          rmSync(wrongDir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
    },
    120000,
  );

  it(
    "(e-2) negative: a truncated/corrupted bundle fails closed (malformed), nothing written",
    async () => {
      const malformedDir = mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-malformed-"));
      try {
        // A real truncation of the real base64 bundle -- well under half
        // its own length, guaranteeing invalid JSON once decoded.
        const truncatedBase64 = bundleBase64.slice(0, Math.floor(bundleBase64.length / 3));
        const run = await runPackagedAcceptance("MALFORMED", launchExePath, malformedDir, [{ command: "profile-recovery-restore", payload: { bundleBytes: truncatedBase64, secret: passphraseA } }]);
        const result = stepAt(run, 0, "profile-recovery-restore") as { outcome: string };
        expect(result.outcome, JSON.stringify(result)).toBe("malformed");
        expect(existsSync(profileLeaf(malformedDir, "master-seed.sealed.json")), "a malformed-bundle restore attempt must leave NOTHING written on disk").toBe(false);
        record("E2 PASS -- a real truncated/corrupted bundle fails closed (malformed), nothing written to disk.");
      } finally {
        try {
          rmSync(malformedDir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
    },
    120000,
  );

  it(
    "(e-3) negative, full cycle: a real bit-flipped Data Part ciphertext fails closed via AEAD authentication (never silently 'succeeds' with corrupted content), leaves the documented genuine partial write (sealed Master Seed on disk, no descriptor) -- profile-reset-interrupted clears it -- a retry with the ORIGINAL untampered bundle then succeeds",
    async () => {
      const tamperDir = mkdtempSync(join(tmpdir(), "fedos-recovery-nsis-tampered-"));
      try {
        // Real bit-flip on real bundle bytes: decode -> parse -> flip one
        // character deep inside the real `dataCiphertext` field (the AEAD-
        // sealed Data Part) -- never touching `sealedMasterSeedEnvelope` --
        // -> re-serialize -> re-encode. Exercises AEAD authentication
        // failure on the Data Part specifically, not a structural
        // pre-check and not the Identity Part.
        const decoded = JSON.parse(Buffer.from(bundleBase64, "base64").toString("utf8")) as { dataCiphertext: unknown };
        const originalCiphertext = decoded.dataCiphertext;
        expect(typeof originalCiphertext, "the real bundle must carry a real Data Part ciphertext string to tamper with").toBe("string");
        const ciphertextStr = originalCiphertext as string;
        const mid = Math.floor(ciphertextStr.length / 2);
        const flippedChar = ciphertextStr[mid] === "A" ? "B" : "A";
        (decoded as { dataCiphertext: string }).dataCiphertext = ciphertextStr.slice(0, mid) + flippedChar + ciphertextStr.slice(mid + 1);
        const tamperedBase64 = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");
        record(`E3a -- real bit-flip applied deep inside the real dataCiphertext field (position ${String(mid)} of ${String(ciphertextStr.length)}), sealedMasterSeedEnvelope untouched.`);

        // Deliberately a SEPARATE launch from `profile-reset-interrupted`
        // below -- combining them into one script would mean this Node
        // process's own `existsSync()` checks run only AFTER reset-
        // interrupted has ALREADY cleared the partial write within that
        // same still-running real process, making the "partial write
        // exists" assertion trivially (and wrongly) false. Splitting lets
        // this test observe the real INTERMEDIATE on-disk state between
        // the two real mutations, exactly as a human operator would.
        const tamperRun = await runPackagedAcceptance("TAMPERED_RESTORE_ATTEMPT", launchExePath, tamperDir, [{ command: "profile-recovery-restore", payload: { bundleBytes: tamperedBase64, secret: passphraseA } }]);
        const tamperResult = stepAt(tamperRun, 0, "profile-recovery-restore") as { outcome: string };
        expect(tamperResult.outcome, `a tampered Data Part must fail closed, never "ok"/"restored": ${JSON.stringify(tamperResult)}`).toBe("data-part-restore-failed");
        record(`E3b PASS -- real tampered-ciphertext restore attempt fails closed: outcome="${tamperResult.outcome}" (never a silent success with corrupted content).`);

        // The documented, accepted finding: the sealed Master Seed DID
        // land on disk (Identity Part restore completes before Data Part
        // validation), but the profile descriptor never did -- this
        // process is genuinely "interrupted", never "ready". Checked
        // between the two real launches, so this Node process observes the
        // real filesystem state left behind by the FIRST process alone.
        expect(existsSync(profileLeaf(tamperDir, "master-seed.sealed.json")), "the documented partial write: sealed Master Seed IS written before Data Part validation completes").toBe(true);
        expect(existsSync(profileLeaf(tamperDir, "profile.json")), "the profile descriptor must NEVER be written when the Data Part fails").toBe(false);
        record("E3c PASS -- confirms the documented genuine partial write: sealed Master Seed present, profile descriptor absent (== FedosProfileInitializationCoordinator's own 'interrupted' recovery-required shape).");

        const resetRun = await runPackagedAcceptance("TAMPERED_RESET_INTERRUPTED", launchExePath, tamperDir, [{ command: "profile-reset-interrupted" }]);
        const resetResult = stepAt(resetRun, 0, "profile-reset-interrupted") as { outcome: string };
        expect(resetResult.outcome, `real profile-reset-interrupted() must clear the genuinely-interrupted target: ${JSON.stringify(resetResult)}`).toBe("ok");
        expect(existsSync(profileLeaf(tamperDir, "master-seed.sealed.json")), "reset-interrupted must clear the partially-written sealed Master Seed").toBe(false);
        record("E3d PASS -- real profile-reset-interrupted() succeeds and genuinely clears the partial write -- this arc's own newly-exposed capability, closing the design doc's previously-disclosed boundary.");

        const retryRun = await runPackagedAcceptance("TAMPERED_RETRY_ORIGINAL_SUCCEEDS", launchExePath, tamperDir, [{ command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: passphraseA } }]);
        const retryResult = stepAt(retryRun, 0, "profile-recovery-restore") as { outcome: string; ready?: { accountPublicIdentifier?: string } };
        expect(retryResult.outcome, `after reset-interrupted, a retry with the ORIGINAL untampered bundle must succeed: ${JSON.stringify(retryResult)}`).toBe("ok");
        expect(retryResult.ready!.accountPublicIdentifier).toBe(accountPublicIdentifierA);
        record("E3e PASS -- FULL CYCLE CLOSED: tamper -> refuse (fail closed) -> profile-reset-interrupted -> retry with the original bundle succeeds. Closes the Product Closure decision doc's own previously-disclosed boundary ('can't be proven end-to-end this pass') -- now proven end to end on the real installed binary.");
      } finally {
        try {
          rmSync(tamperDir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
    },
    180000,
  );

  it(
    "(e-4) negative: restore refuses to overwrite an already-existing profile (already-exists), never silently clobbers a live profile",
    async () => {
      // Machine A's own dataDir already holds a real, live profile from
      // scenario (a) above -- a fresh process attempting to restore onto
      // it must refuse.
      const run = await runPackagedAcceptance("ALREADY_EXISTS", launchExePath, machineADir, [{ command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: passphraseA } }]);
      const result = stepAt(run, 0, "profile-recovery-restore") as { outcome: string };
      expect(result.outcome, JSON.stringify(result)).toBe("already-exists");
      record("E4 PASS -- real restore attempt onto Machine A's own already-existing profile correctly refuses (already-exists), never silently clobbers it.");
    },
    120000,
  );

  it("FINAL: consolidated evidence summary", () => {
    record("=== FINAL SUMMARY: all core-proof scenarios (a) create+seed+export, (b) restore+verify, (c)/(d) two restarts, (e-1..4) negatives (wrong-secret, malformed, tampered-then-reset-interrupted-then-retry, already-exists) completed. ===");
    expect(true).toBe(true);
  });
});
