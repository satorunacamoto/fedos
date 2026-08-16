/**
 * Real Digital Delivery mega-arc (Coordinator, release-pipeline pass) --
 * behavioral test for `scripts/verify_release_package_allowlist.mjs`,
 * which had NO test file at all before this pass and had never actually
 * been run against the real, current `electron_builder.beta.config.json`
 * -- it failed immediately the first time this arc ran the real
 * `release:electron-beta` pipeline end to end, on legitimate, real,
 * evidence-backed node_modules-bundling config that predates the
 * checker's own last update by three weeks (see the script's own header
 * comment for the full account). This test proves the FIXED policy both
 * (1) accepts the real current config and (2) still rejects the
 * genuinely dangerous shapes the original blanket check was trying to
 * catch -- never "the function exists" checks.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// This package's `tsconfig.json` compiles `.ts` test files as CommonJS (no
// `"type": "module"` in `package.json`), but `verify_release_package_allowlist.mjs`
// is a real ESM module -- TypeScript itself (TS1479) requires a dynamic
// `import()` rather than a static `import` for exactly this cross-module-kind
// case, mirroring `packaged_binary_dependency_closure_guard.test.ts`'s own
// established pattern for the same situation.
let verifyFedosBetaPackageAllowlist: typeof import("../scripts/verify_release_package_allowlist.mjs", { with: { "resolution-mode": "import" } }).verifyFedosBetaPackageAllowlist;
beforeAll(async () => {
  ({ verifyFedosBetaPackageAllowlist } = await import("../scripts/verify_release_package_allowlist.mjs"));
});

// `process.cwd()` is the repo root (this file is only ever run via the
// root-level `vitest.electron-spike.config.ts`, which sets no `root`
// override), never this package's own directory -- mirrors
// `packaged_binary_dependency_closure_guard.test.ts`'s own
// `repoRoot`/`packageDir` pattern for the same reason.
const REAL_CONFIG_PATH = join(process.cwd(), "packages/fedos-desktop-electron-spike/electron_builder.beta.config.json");

function baseConfig(overrides = {}) {
  return {
    files: [
      "dist/fedos_electron_beta_main.cjs",
      "dist/fedos_electron_beta_preload.cjs",
      "dist/fedos_electron_beta_renderer.js",
      "dist/fedos_electron_beta_page.html",
      "package.json",
      "!src/**/*",
      "!test/**/*",
    ],
    extraFiles: [],
    extraResources: [],
    ...overrides,
  };
}

describe("verifyFedosBetaPackageAllowlist", () => {
  it("accepts the REAL, current electron_builder.beta.config.json (this arc's own actual release config)", () => {
    const configText = readFileSync(REAL_CONFIG_PATH, "utf8");
    const result = verifyFedosBetaPackageAllowlist(configText);
    expect(result.problems, JSON.stringify(result.problems)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts a minimal valid config with no node_modules references at all", () => {
    const result = verifyFedosBetaPackageAllowlist(JSON.stringify(baseConfig()));
    expect(result.ok).toBe(true);
  });

  it("accepts the package's OWN local node_modules/**/* in `files` -- always legitimate, never flagged", () => {
    const result = verifyFedosBetaPackageAllowlist(
      JSON.stringify(baseConfig({ files: [...baseConfig().files, "node_modules/**/*", "node_modules/dijkstrajs/**/*"] })),
    );
    expect(result.ok, JSON.stringify(result.problems)).toBe(true);
  });

  it("accepts an extraFiles entry copying node_modules from OUTSIDE the package root ONLY IF it carries a non-empty filter", () => {
    const result = verifyFedosBetaPackageAllowlist(
      JSON.stringify(
        baseConfig({
          extraFiles: [{ from: "../../node_modules", to: "dist/node_modules", filter: ["**/*", "!typescript/**/*"] }],
        }),
      ),
    );
    expect(result.ok, JSON.stringify(result.problems)).toBe(true);
  });

  it("REJECTS an extraFiles entry copying node_modules from outside the package root with NO filter (the actually dangerous shape)", () => {
    const result = verifyFedosBetaPackageAllowlist(
      JSON.stringify(baseConfig({ extraFiles: [{ from: "../../node_modules", to: "dist/node_modules" }] })),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "forbidden-node-modules-unfiltered-external-copy")).toBe(true);
  });

  it("REJECTS an extraFiles entry copying node_modules from outside the package root with an EMPTY filter array", () => {
    const result = verifyFedosBetaPackageAllowlist(
      JSON.stringify(baseConfig({ extraFiles: [{ from: "../../node_modules", to: "dist/node_modules", filter: [] }] })),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "forbidden-node-modules-unfiltered-external-copy")).toBe(true);
  });

  it("REJECTS a files entry that sweeps in docs/reviews", () => {
    const result = verifyFedosBetaPackageAllowlist(JSON.stringify(baseConfig({ files: [...baseConfig().files, "docs/reviews/**/*"] })));
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "forbidden-path-included" && p.forbidden === "docs/reviews")).toBe(true);
  });

  it("REJECTS a files entry that sweeps in .git", () => {
    const result = verifyFedosBetaPackageAllowlist(JSON.stringify(baseConfig({ files: [...baseConfig().files, "../.git/**/*"] })));
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "forbidden-path-included" && p.forbidden === ".git")).toBe(true);
  });

  it("REJECTS an extraFiles entry copying from a sibling worktree", () => {
    const result = verifyFedosBetaPackageAllowlist(
      JSON.stringify(baseConfig({ extraFiles: [{ from: "../../../OS-worktrees/some-other-worktree/dist", to: "dist" }] })),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "forbidden-path-included" && p.forbidden === "worktree")).toBe(true);
  });

  it("a `!`-prefixed exclusion glob is never flagged, even if it contains a forbidden fragment or 'node_modules'", () => {
    const result = verifyFedosBetaPackageAllowlist(
      JSON.stringify(baseConfig({ files: [...baseConfig().files, "!node_modules/typescript/**/*", "!**/.git/**"] })),
    );
    expect(result.ok, JSON.stringify(result.problems)).toBe(true);
  });

  it("still requires every REQUIRED_ALLOWED_ENTRIES entry to be present", () => {
    const config = baseConfig();
    config.files = config.files.filter((f) => f !== "package.json");
    const result = verifyFedosBetaPackageAllowlist(JSON.stringify(config));
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "missing-required-entry" && p.entry === "package.json")).toBe(true);
  });

  it("still requires the src/ and test/ deny globs", () => {
    const config = baseConfig();
    config.files = config.files.filter((f) => f !== "!src/**/*");
    const result = verifyFedosBetaPackageAllowlist(JSON.stringify(config));
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "missing-required-deny-glob" && p.entry === "!src/**/*")).toBe(true);
  });

  it("still rejects a bare '**/*' allow-everything glob", () => {
    const result = verifyFedosBetaPackageAllowlist(JSON.stringify(baseConfig({ files: [...baseConfig().files, "**/*"] })));
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.kind === "non-explicit-allowlist")).toBe(true);
  });
});
