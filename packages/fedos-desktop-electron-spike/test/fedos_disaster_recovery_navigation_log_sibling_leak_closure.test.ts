import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Disaster Recovery Product Closure arc, Track 3 (mini red-team R2
 * follow-up) — REAL, end-to-end proof that the CONFIRMED HIGH finding is
 * actually closed, not just closed at the library level.
 *
 * R2's finding: `navigation.log` lives at `<userData>/navigation.log`, a
 * genuine SIBLING of the profile root (`<userData>/profile`) —
 * structurally invisible to `hasResidualFedosProfileData()`'s own
 * `paths.root`-scoped directory listing no matter how that listing is
 * implemented. `FedosDesktopConversationWindowRegistry` reads this file
 * back unconditionally on construction and its snapshot
 * (`lastOpenedConversationId`/`pinnedConversationIds`/`recentConversationIds`)
 * is served verbatim through the real `fedos-beta:status` IPC channel to
 * whichever identity is currently active — after Start Over, a brand-new
 * identity's Home screen could show the OLD identity's real conversation
 * identifiers.
 *
 * The fix (`fedos_electron_beta_main.cts`): `buildFreshCoordinator()`
 * threads `additionalResidualPaths: [navigationLogPath(), commerceNetworkProfileFilePath()]`
 * into every `createProfile()`/`resetInterruptedProfile()`/
 * `resetCorruptReadyProfile()` call. This test proves it through the REAL
 * compiled Electron binary: Identity A creates a profile, a real
 * navigation event is written to the real `navigation.log` sibling path,
 * Start Over runs through the real `fedos-profile:reset-corrupt-ready`
 * channel, and Identity B (created fresh at the SAME `dataDir`) must see
 * NOTHING of Identity A's navigation state through the real
 * `fedos-beta:status` channel.
 *
 * Uses the SAME real-packaged-binary `AUTOTEST_MODE=acceptance` harness as
 * the sibling `fedos_disaster_recovery_portable_backup_ipc_acceptance.test.ts`
 * (verbatim pattern) — skips itself if the real artifact/binary are absent.
 */

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const REAL_ARTIFACT_PRESENT = existsSync(pkgWasmPath);
const ELECTRON_PRESENT = existsSync(electronBinPath);
const CAN_RUN_REAL = REAL_ARTIFACT_PRESENT && ELECTRON_PRESENT && existsSync(mainCjsPath);

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-navlog-leak-${label}-`));
  tmpRoots.push(dir);
  return dir;
}
afterAll(() => {
  while (tmpRoots.length) {
    try {
      rmSync(tmpRoots.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

interface AcceptanceStep {
  readonly command: string;
  readonly result: Record<string, unknown>;
}
interface AcceptanceRun {
  readonly output: string;
  readonly steps: readonly AcceptanceStep[];
}

/** Verbatim pattern from `fedos_disaster_recovery_portable_backup_ipc_acceptance.test.ts`'s own `runBetaAcceptance()`. */
async function runBetaAcceptance(
  dataDir: string,
  script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }>,
): Promise<AcceptanceRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "acceptance",
      FEDOS_BETA_ACCEPTANCE_SCRIPT: JSON.stringify(script),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
  child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }, 60000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  const output = Buffer.concat(outChunks).toString("utf8");
  const steps: AcceptanceStep[] = [];
  for (const line of output.split("\n")) {
    const marker = "FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:";
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const firstColon = rest.indexOf(":");
    const secondColon = rest.indexOf(":", firstColon + 1);
    const command = rest.slice(firstColon + 1, secondColon);
    const resultJson = rest.slice(secondColon + 1);
    steps.push({ command, result: JSON.parse(resultJson) as Record<string, unknown> });
  }
  return { output, steps };
}

function stepFor(run: AcceptanceRun, command: string, occurrence = 0): Record<string, unknown> {
  const matches = run.steps.filter((s) => s.command === command);
  const step = matches[occurrence];
  expect(step, `${run.output}\n--- expected a "${command}" step (occurrence ${occurrence}) ---`).toBeDefined();
  return step!.result;
}

const suite = CAN_RUN_REAL ? describe : describe.skip;

suite("Disaster Recovery Product Closure arc, Track 3 (R2 follow-up) -- navigation.log sibling leak, REAL end-to-end closure proof", () => {
  it("Identity A's real navigation.log content does NOT survive Start Over, and Identity B's real fedos-beta:status response carries none of it", async () => {
    const dataDir = makeTmpRoot("machine");

    // Step 1: Identity A creates a real profile (this also creates
    // <dataDir>/profile/ on disk).
    const createRun = await runBetaAcceptance(dataDir, [
      { command: "profile-create", payload: { label: "Identity A", secret: "identity-a-navlog-real-secret" } },
    ]);
    const created = stepFor(createRun, "profile-create");
    expect(created.outcome, createRun.output).toBe("ok");

    // Step 2: simulate a real navigation event at the REAL sibling path
    // `navigationLogPath()` resolves to (`<dataDir>/navigation.log`,
    // sibling of `<dataDir>/profile` = `paths.root`) -- same NDJSON shape
    // `AppendOnlyFedosDesktopNavigationPersistence` itself writes
    // (`{type,conversationId,at}` per line).
    const navigationLogPath = join(dataDir, "navigation.log");
    const leakedConversationId = "IDENTITY-A-PRIVATE-CONVERSATION-MARKER";
    writeFileSync(navigationLogPath, `{"type":"last-opened","conversationId":"${leakedConversationId}","at":1700000000}\n`, "utf8");
    expect(existsSync(navigationLogPath)).toBe(true);

    // Step 3: corrupt the sealed Master Seed (structurally, not a wrong
    // passphrase) so Start Over's own "corrupt ready profile" path applies
    // -- mirrors this arc's own established reproduction pattern.
    const sealedSeedPath = join(dataDir, "profile", "master-seed.sealed.json");
    writeFileSync(sealedSeedPath, "{ not even close to well-formed", "utf8");

    // Step 4: run the REAL reset through the REAL IPC handler, then
    // (in the SAME process) create Identity B at the same dataDir, then
    // ask the REAL fedos-beta:status channel what it sees.
    const resetAndRecreateRun = await runBetaAcceptance(dataDir, [
      { command: "profile-reset-corrupt-ready" },
      { command: "profile-create", payload: { label: "Identity B", secret: "identity-b-navlog-real-secret" } },
      { command: "beta-status" },
    ]);
    const reset = stepFor(resetAndRecreateRun, "profile-reset-corrupt-ready");
    expect(reset.outcome, resetAndRecreateRun.output).toBe("ok");

    const recreated = stepFor(resetAndRecreateRun, "profile-create");
    expect(recreated.outcome, resetAndRecreateRun.output).toBe("ok");

    // The real fix's own direct, on-disk effect: navigation.log must not
    // survive a completed Start Over.
    expect(existsSync(navigationLogPath), "navigation.log must not survive Start Over (R2's own CONFIRMED HIGH finding)").toBe(false);

    // The real, live-exploitable surface R2 actually found: Identity B's
    // own real fedos-beta:status response must carry NONE of Identity A's
    // navigation state.
    const status = stepFor(resetAndRecreateRun, "beta-status");
    const statusJson = JSON.stringify(status);
    expect(statusJson, "Identity B's real fedos-beta:status response must not contain Identity A's conversation id").not.toContain(
      leakedConversationId,
    );
    const navigation = status.navigation as { lastOpenedConversationId?: string | null } | null;
    expect(navigation === null || navigation.lastOpenedConversationId === null || navigation.lastOpenedConversationId === undefined).toBe(true);
  });
});
