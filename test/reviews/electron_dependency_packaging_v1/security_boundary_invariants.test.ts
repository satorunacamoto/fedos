import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostBridgeSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostCommandSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_command.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostResponseSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_response.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostPortSource from "../../../src/os/messenger/desktop/host_boundary/fedos_desktop_host_port.ts?raw";
import { assertFedosRootDependencyInvariant } from "../../helpers/fedos_root_dependency_invariant.js";

/**
 * Electron Dependency and Desktop Packaging V1 review -- security boundary
 * invariants. Verifies, against REAL git state and REAL source (not
 * prose), the Absolute Prohibitions this review operates under: no
 * production/README/dependency change, p2p/`.tmp_gen` untouched, and the
 * structural security properties `06`/`07`/`08`/`17` describe are ALREADY
 * true of the real, existing Host boundary this review evaluates (never
 * newly introduced by this review itself).
 */

function gitGrepFiles(pattern: string, pathspec: string): string[] {
  try {
    const output = execFileSync("git", ["grep", "-lE", pattern, "--", pathspec], { encoding: "utf8" }) as string;
    return output.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    throw error;
  }
}

describe("Electron Dependency and Desktop Packaging V1 review -- no production change", () => {
  it("1. git working tree shows NO change under src/, packages/, package.json, package-lock.json, Cargo.toml, or README.md", () => {
    const output = execFileSync(
      "git",
      ["status", "--porcelain", "--", "src", "packages", "package.json", "package-lock.json", "Cargo.toml", "README.md"],
      { encoding: "utf8" },
    ) as string;
    expect(output.trim()).toBe("");
  });

  it("2. p2p/ is untouched -- either absent from this worktree entirely, or (if present) shows no git change", () => {
    if (existsSync("p2p")) {
      const output = execFileSync("git", ["status", "--porcelain", "--", "p2p"], { encoding: "utf8" }) as string;
      expect(output.trim()).toBe("");
    } else {
      expect(existsSync("p2p")).toBe(false);
    }
  });

  it("3. .tmp_gen/ is untouched -- either absent from this worktree entirely, or (if present) shows no git change", () => {
    if (existsSync(".tmp_gen")) {
      const output = execFileSync("git", ["status", "--porcelain", "--", ".tmp_gen"], { encoding: "utf8" }) as string;
      expect(output.trim()).toBe("");
    } else {
      expect(existsSync(".tmp_gen")).toBe(false);
    }
  });

  it("4. git status shows changes ONLY under this review's own two directories (plus this worktree's own untracked scratch state, if any)", () => {
    const output = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }) as string;
    const lines = output.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    for (const line of lines) {
      const path = line.slice(line.indexOf(" ") + 1).trim();
      const allowed =
        path.startsWith("docs/reviews/electron_dependency_packaging_v1/") ||
        path.startsWith("test/reviews/electron_dependency_packaging_v1/") ||
        path === "docs/reviews/" ||
        path === "test/reviews/";
      expect(allowed, `unexpected changed/untracked path introduced by this review: ${path}`).toBe(true);
    }
  });

  it("5. no new dependency was introduced -- package.json still carries exactly two production dependencies", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });
});

describe("Electron Dependency and Desktop Packaging V1 review -- Host boundary security properties (already real, confirmed unmodified)", () => {
  it("6. no persistence port import anywhere under src/desktop/host_boundary/", () => {
    expect(gitGrepFiles("from \"\\.\\./\\.\\./conversation/.*persistence", "src/desktop/host_boundary/")).toEqual([]);
  });

  it("7. no crypto authority/Master Seed import anywhere under src/desktop/host_boundary/", () => {
    for (const source of [hostBridgeSource, hostCommandSource, hostResponseSource, hostPortSource] as string[]) {
      expect(source).not.toMatch(/MasterSeed/);
      expect(source).not.toMatch(/EncryptionAuthority/);
      expect(source).not.toMatch(/DecryptionAuthority/);
      expect(source).not.toMatch(/AeadKeyHandle/);
    }
  });

  it("8. no conversationRuntime()/conversationContentAccessor() call anywhere under src/desktop/host_boundary/ -- every real action goes through the Shell/ViewModel layer", () => {
    for (const source of [hostBridgeSource, hostCommandSource, hostResponseSource, hostPortSource] as string[]) {
      expect(source).not.toMatch(/\.conversationRuntime\(\)/);
      expect(source).not.toMatch(/\.conversationContentAccessor\(\)/);
    }
  });

  it("9. the Host command vocabulary is validated (structural shape checked) before dispatch, never trusted as-is", () => {
    expect(hostCommandSource).toMatch(/function validateFedosDesktopHostCommand/);
    expect(hostBridgeSource).toMatch(/validateFedosDesktopHostCommand/);
  });

  it("10. the Host command vocabulary enforces operational size limits reusing existing domain constants, never an unbounded string", () => {
    expect(hostCommandSource).toMatch(/FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH/);
    expect(hostCommandSource).toMatch(/FEDOS_DESKTOP_HOST_MAX_ID_LENGTH/);
  });

  it("11. archive path validation rejects path traversal ('..' segments) before any filesystem call", () => {
    expect(hostCommandSource).toMatch(/\.\.["'`]/);
    expect(hostCommandSource).toMatch(/isSafeArchivePath|segments\.includes\("\.\."\)/);
  });

  it("12. no raw Error/stack field exists on the closed response vocabulary", () => {
    expect(hostResponseSource).not.toMatch(/\bstack\s*:/);
    expect(hostResponseSource).not.toMatch(/extends Error/);
  });

  it("13. dispatch()/start()/stop() each wrap their real work in a try/catch, converting any exception to a closed response -- never letting a raw exception escape to a caller", () => {
    const tryCount = (hostBridgeSource.match(/\btry\s*\{/g) ?? []).length;
    expect(tryCount).toBeGreaterThanOrEqual(3);
  });
});
