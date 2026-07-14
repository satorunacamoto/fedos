import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_348_deployment_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import tsconfigSource from "../tsconfig.json?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 348 -- "Deployment Review": Stage 8 of the
 * Alpha 341-350 Board Durable Backend Re-evaluation & Local Backend
 * Selection Arc. Review only. Determines where each backend can
 * realistically exist across every target environment this
 * repository has.
 */
describe("Secure Runtime Alpha 348 -- Deployment Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc reviews all four target environments", () => {
    for (const heading of [
      "## 2. Desktop Host (Node, with a real Host boundary)",
      "## 3. Node (bare test/dev harness, no Host)",
      "## 4. Cloudflare Workers",
      "## 5. Browser",
    ]) {
      expect(designDocSource).toContain(heading);
    }
  });

  it("3. structural: the Worker still has no DOM lib -- confirming no browser environment exists", () => {
    const tsconfig = JSON.parse(tsconfigSource);
    expect(tsconfig.compilerOptions.lib).not.toContain("DOM");
  });

  it("4. structural: src/worker.ts still carries zero import of either backend or the Host", () => {
    expect(workerSource).not.toMatch(/from ["'].*desktop\/host\//);
    expect(workerSource).not.toMatch(/FedosDesktopHost|createFedosDesktopHost/);
    expect(workerSource).not.toMatch(/from ["'].*sqlite/i);
  });

  it("5. the design doc concludes the Desktop Host is the only environment with both reachability and a real caller", () => {
    expect(normalize(designDocSource)).toContain(
      "Exactly one environment — the Desktop Host — is BOTH technically",
    );
  });

  it("6. the design doc concludes deployment environment is not a differentiator between the two backends", () => {
    expect(normalize(designDocSource)).toContain(
      "Deployment environment is therefore NOT a differentiator between SQLite and append-only",
    );
  });

  it("7. the design doc includes the required summary table naming both backends across all four environments", () => {
    expect(designDocSource).toContain("| Environment       | SQLite reachable? | Append-only reachable? | Real caller exists? |");
  });

  it("8. the design doc cross-references Alpha 341, Alpha 343, Alpha 344, and Alpha 321", () => {
    for (const ref of [
      "secure_runtime_alpha_341_host_capability_inventory",
      "secure_runtime_alpha_343_sqlite_review",
      "secure_runtime_alpha_344_append_only_backend_review",
      "secure_runtime_alpha_321_board_deployment_runtime_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
