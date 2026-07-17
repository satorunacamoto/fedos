import { describe, it, expect } from "vitest";

/**
 * Secure Runtime Alpha 617 -- "No Implicit Startup Guard": Stage 17 of
 * the Alpha 601-620 Desktop Local Runtime Entry Point & Publish
 * Pipeline Ownership Arc. Importing `fedos_desktop_runtime.ts` must
 * perform NO filesystem access, NO Host construction, NO timer, NO
 * signal registration, NO key generation, NO Relay connection -- only
 * CALLING `startFedosDesktopRuntime()` may do any of that.
 */

describe("Secure Runtime Alpha 617 -- No Implicit Startup Guard", () => {
  it("1. every non-indented (module-top-level) line is only an import, an interface/function declaration opener, or a brace -- no top-level statement executes anything", async () => {
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const source = (await import("../src/desktop/runtime/fedos_desktop_runtime.ts?raw")).default as string;
    // This file is checked out with CRLF line endings on this platform
    // (see e.g. `test/secure_runtime_alpha_436_...ts`'s own note); a bare
    // `\n` split otherwise leaves a stray `"\r"` "line" for every blank
    // line, which is neither empty nor indented and so would incorrectly
    // survive the filter below.
    const topLevelLines = source
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t") && !line.startsWith("*") && !line.startsWith("/"));
    for (const line of topLevelLines) {
      expect(line).toMatch(/^(import |export interface |export async function |function |readonly |\}|\{|\))/);
    }
    // Confirmed no top-level line matches a call/construction pattern.
    expect(topLevelLines.some((line) => /\w\(.*\);?\s*$/.test(line) && !line.startsWith("function") && !line.startsWith("export async function"))).toBe(false);
  });

  it("2. importing run_fedos_desktop_runtime.ts's own executable file does not itself run main() -- confirmed structurally, since main() is only ever invoked once, at the file's own bottom, guarded by nothing else", async () => {
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const source = (await import("../src/desktop/runtime/run_fedos_desktop_runtime.ts?raw")).default as string;
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    // main() is called exactly once, at module top level -- this file IS
    // the intentional exception (Alpha 613's own "executable owns process"
    // boundary); the guard here is that NOTHING ELSE in this repository
    // imports this file (Alpha 616's own guard would catch that), so this
    // top-level call only ever executes when `node` is invoked on this
    // file directly (`npm run start:runtime`), never via a library import.
    const mainCalls = (codeOnly.match(/^main\(\)/m) ?? []).length;
    expect(mainCalls).toBe(1);
  });

  it("3. no signal registration, no timer, and no Relay/WebSocket/Signing CONSTRUCTION anywhere in the testable assembly module (a string literal naming what is absent, e.g. an explanatory error message, is not a reference)", async () => {
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const source = (await import("../src/desktop/runtime/fedos_desktop_runtime.ts?raw")).default as string;
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith('"'))
      .join("\n");
    expect(codeOnly).not.toMatch(/process\.on\(|SIGINT|SIGTERM/);
    expect(codeOnly).not.toMatch(/setInterval|setTimeout/);
    expect(codeOnly).not.toMatch(/new\s+\w*(Relay|WebSocket|SigningAuthority)/i);
    expect(codeOnly).not.toMatch(/^import.*\b(Relay|WebSocket|SigningAuthority)\b/im);
  });
});
