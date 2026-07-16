import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/desktop/runtime/fedos_desktop_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runConfigSource from "../src/desktop/runtime/fedos_desktop_runtime_config.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runMainSource from "../src/desktop/runtime/run_fedos_desktop_runtime.ts?raw";

/**
 * Secure Runtime Alpha 616 -- "No Worker Coupling Guard": Stage 16 of
 * the Alpha 601-620 Desktop Local Runtime Entry Point & Publish
 * Pipeline Ownership Arc.
 */

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("Secure Runtime Alpha 616 -- No Worker Coupling Guard", () => {
  it("1. src/worker.ts does not import Desktop Host or the new runtime files", () => {
    expect(workerSource).not.toMatch(/desktop\/host|desktop\/runtime/);
  });

  it("2. every new runtime file imports nothing from ../../worker.js or src/worker.ts", () => {
    for (const source of [runtimeSource, runConfigSource, runMainSource]) {
      const code = codeOnly(source);
      expect(code).not.toMatch(/from ["'].*worker\.js["']/);
      expect(code).not.toMatch(/\bCloudflare\b/i);
      expect(code).not.toMatch(/\bD1\b/);
      expect(code).not.toMatch(/\benv\.[A-Z]/); // no Worker-style Env binding access
    }
  });

  it("3. no request-lifecycle coupling -- no Request/Response/fetch handler shape anywhere in the new runtime files", () => {
    for (const source of [runtimeSource, runConfigSource, runMainSource]) {
      const code = codeOnly(source);
      expect(code).not.toMatch(/\bhandleRequest\b|\bnew Response\(|\bnew Request\(/);
    }
  });
});
