import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageLockSource from "../../../package-lock.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostPortSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_port.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostBridgeSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostCommandSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_command.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostResponseSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_response.ts?raw";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
import { assertFedosRootDependencyInvariant } from "../../helpers/fedos_root_dependency_invariant.js";

/** `git grep` exits 1 (not 0) when NO line matches -- that is the EXPECTED, passing case for the checks below, never a tool failure. Returns the matched file list (empty when none). */
function gitGrepFiles(pattern: string, pathspec: string): string[] {
  try {
    const output = execFileSync("git", ["grep", "-lE", pattern, "--", pathspec], { encoding: "utf8" }) as string;
    return output.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return []; // no match -- exactly the expected, passing outcome.
    throw error;
  }
}

/**
 * Electron Dependency and Desktop Packaging V1 review -- source alignment.
 *
 * Verifies, against this worktree's own REAL, currently-checked-out
 * source (`review/electron-dependency-packaging-v1`, branched from
 * `arc/desktop-electron-host-boundary` @ `7b72a3e`), the "current
 * implementation reality" claims `01`-`20` make. Never asserts that any
 * FUTURE (unimplemented) Electron capability exists -- only what this
 * review's own docs claim IS true today.
 */

const DOCS_DIR = "docs/reviews/electron_dependency_packaging_v1";
const TEST_DIR = "test/reviews/electron_dependency_packaging_v1";

const REQUIRED_DOCS: readonly string[] = [
  "index.md",
  "01_current_desktop_stack_inventory.md",
  "02_product_host_requirements.md",
  "03_options_comparison.md",
  "04_electron_dependency_blast_radius.md",
  "05_process_model.md",
  "06_ipc_command_boundary.md",
  "07_ipc_response_boundary.md",
  "08_electron_security_configuration.md",
  "09_filesystem_authority.md",
  "10_secret_input_and_master_seed_unlock.md",
  "11_local_data_location.md",
  "12_packaging.md",
  "13_windows_path_and_onedrive_risks.md",
  "14_code_signing_and_distribution.md",
  "15_updates.md",
  "16_logging_and_crash_reports.md",
  "17_threat_model.md",
  "18_testing_strategy.md",
  "19_implementation_arc_packaging.md",
  "20_final_recommendation.md",
];

const REQUIRED_TESTS: readonly string[] = ["source_alignment.test.ts", "security_boundary_invariants.test.ts", "recommendation_consistency.test.ts"];

const MIN_CHARS = 800;
const MIN_LINES = 20;

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

function readAllDocs(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of REQUIRED_DOCS) result[name] = readDoc(name);
  return result;
}

describe("Electron Dependency and Desktop Packaging V1 review -- deliverable structure", () => {
  it("1. index.md exists and is non-trivial", () => {
    const index = readDoc("index.md");
    expect(index.length).toBeGreaterThan(MIN_CHARS);
    expect(index.split("\n").length).toBeGreaterThan(MIN_LINES);
  });

  it("2. every one of the 20 numbered review docs exists on disk, named exactly as specified", () => {
    const files = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(files.sort()).toEqual([...REQUIRED_DOCS].sort());
  });

  it("3. every doc is non-trivial (not a stub)", () => {
    for (const [name, text] of Object.entries(readAllDocs())) {
      expect(text.length, name).toBeGreaterThan(MIN_CHARS);
    }
  });

  it("4. all 3 required test files exist under test/reviews/electron_dependency_packaging_v1/, named exactly as specified", () => {
    const files = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(files.sort()).toEqual([...REQUIRED_TESTS].sort());
  });
});

describe("Electron Dependency and Desktop Packaging V1 review -- source alignment (current implementation reality)", () => {
  it("5. Electron is absent from package.json -- zero references in dependencies/devDependencies", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const allDepNames = [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})];
    for (const name of allDepNames) expect(name.toLowerCase()).not.toContain("electron");
    expect(packageJsonSource.toLowerCase()).not.toContain("electron");
  });

  it("6. Electron is absent from package-lock.json -- zero references anywhere in the resolved dependency graph", () => {
    expect((packageLockSource as string).toLowerCase()).not.toContain("electron");
  });

  it("7. package.json still carries exactly two production dependencies -- no dependency was added by this review", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });

  // Real CODE USAGE only (an actual import, construction, or method call) --
  // NOT a bare mention of the word, since both files' own doc comments
  // correctly EXPLAIN that no such usage exists (e.g. "names nothing
  // Electron-specific (no BrowserWindow, no ipcMain/ipcRenderer)"), which
  // must not itself be mistaken for the usage it is disclaiming.
  const REAL_ELECTRON_USAGE_PATTERNS: readonly RegExp[] = [
    /from\s+["']electron["']/,
    /require\(\s*["']electron["']\s*\)/,
    /new\s+BrowserWindow\s*\(/,
    /\bipcMain\./,
    /\bipcRenderer\./,
    /\bcontextBridge\./,
  ];

  it("8. FedosDesktopHostPort is framework-neutral -- no real Electron import/construction/usage anywhere (doc-comment mentions of the ABSENCE of these are expected and allowed)", () => {
    for (const pattern of REAL_ELECTRON_USAGE_PATTERNS) expect(hostPortSource).not.toMatch(pattern);
  });

  it("9. FedosDesktopHostBridge (the in-process reference host) contains no real Electron dependency of any kind", () => {
    for (const pattern of REAL_ELECTRON_USAGE_PATTERNS) expect(hostBridgeSource).not.toMatch(pattern);
  });

  it("10. the Host command vocabulary is a closed, named union -- no generic/arbitrary command shape", () => {
    expect(hostCommandSource).toMatch(/export type FedosDesktopHostCommand\s*=/);
    expect(hostCommandSource).toMatch(/validateFedosDesktopHostCommand/);
    // No escape hatch accepting an arbitrary channel/command name or payload.
    expect(hostCommandSource).not.toMatch(/\[key:\s*string\]:\s*any/);
    expect(hostCommandSource).not.toMatch(/Record<string,\s*any>/);
  });

  it("11. the Host response vocabulary is closed and reused verbatim -- FedosDesktopHostResponse<T> is the only exported response shape", () => {
    expect(hostResponseSource).toMatch(/export type FedosDesktopHostResponse<T>\s*=/);
    expect(hostResponseSource).toMatch(/FedosDesktopHostDiagnosticCode/);
  });

  it("12. no persistence port or crypto authority is IMPORTED anywhere under src/desktop/host_boundary/ (an import line specifically, not a doc-comment mention of their absence)", () => {
    const forbiddenImportPatterns = [/^import .*persistence/im, /^import .*MasterSeed/im, /^import .*EncryptionAuthority/im, /^import .*DecryptionAuthority/im, /^import .*payload_storage/im];
    for (const source of [hostPortSource, hostBridgeSource, hostCommandSource, hostResponseSource] as string[]) {
      for (const pattern of forbiddenImportPatterns) expect(source).not.toMatch(pattern);
    }
  });

  it("13. no REAL ipcMain/ipcRenderer/contextBridge usage exists ANYWHERE in src/ -- confirms no IPC boundary (unrestricted or otherwise) has been built yet (doc-comment mentions of their absence, e.g. in this Arc's own Host files, are expected and excluded)", () => {
    const candidateFiles = gitGrepFiles("ipcMain\\.|ipcRenderer\\.|contextBridge\\.", "src/");
    expect(candidateFiles).toEqual([]);
  });

  it("14. no real BrowserWindow construction exists anywhere in src/ -- confirms no window/Electron adapter has been built yet", () => {
    expect(gitGrepFiles("new BrowserWindow\\(", "src/")).toEqual([]);
  });
});
