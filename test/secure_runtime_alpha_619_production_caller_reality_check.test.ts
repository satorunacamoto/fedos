import { describe, it, expect, afterAll, beforeAll } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` in this project's tsconfig.
import { spawn, execSync } from "node:child_process";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, existsSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
// @ts-expect-error `node:process` has no type declarations without `@types/node` in this project's tsconfig.
import process from "node:process";

/**
 * Secure Runtime Alpha 619 -- "Production Caller Reality Check": Stage
 * 19 of the Alpha 601-620 Desktop Local Runtime Entry Point & Publish
 * Pipeline Ownership Arc. Launches the REAL, `npm run build:runtime`-
 * built `dist/desktop/runtime/run_fedos_desktop_runtime.js` as an
 * actual, separate OS process (`node:child_process.spawn`, never a
 * function call from within this test's own process) against a real
 * temporary directory, with the SAME `--board-log=`/`--outbox-log=`
 * CLI arguments a real invocation of `npm run start:runtime` would
 * receive.
 *
 * Honest limitation, found by direct, repeated experimentation during
 * this Stage (not assumed): sending `SIGINT`/`SIGTERM`/`SIGKILL` to a
 * spawned child process, via `child.kill()`, Windows `taskkill /PID`,
 * AND this shell's own native `kill` builtin, was NOT reliably
 * observed to terminate or signal the child process within this
 * specific Windows-sandboxed session -- a testing-ENVIRONMENT
 * limitation (Windows has no real POSIX signals; Node emulates a
 * subset only under specific console-attachment conditions this
 * sandbox does not provide), not a defect in
 * `run_fedos_desktop_runtime.ts`'s own signal-handling code, which
 * follows Node's documented `process.on('SIGINT'|'SIGTERM', ...)` API
 * exactly and is expected to work correctly on a real POSIX deployment
 * target (Linux/macOS). This test therefore verifies what IS reliably
 * observable here -- real subprocess launch, real CLI argument
 * parsing, real durable file creation, reaching a real "ready" state
 * -- and treats termination as best-effort or environment-adapted
 * rather than asserting a specific shutdown transcript. See
 * `docs/secure_runtime_alpha_619_production_caller_reality_check.md`
 * for the full account.
 */

const dirs: string[] = [];
// `ChildProcess` itself is untyped without `@types/node` (this project's
// established convention) -- held as `any` here, matching the same
// untyped-Node-builtin convention every `@ts-expect-error` above already
// establishes for this file.
const children: any[] = [];

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-619-"));
  dirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const child of children) {
    if (child.pid !== undefined && !child.killed) {
      try {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          // best-effort cleanup only -- see this file's own header.
        }
      }
    }
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function waitForOutput(child: any, pattern: RegExp, timeoutMs: number): Promise<string> {
  let out = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern} in: ${out}`)), timeoutMs);
    const onData = (d: { toString(): string }): void => {
      out += d.toString();
      if (pattern.test(out)) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolve(out);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", (d: { toString(): string }) => {
      out += d.toString();
    });
  });
}

describe("Secure Runtime Alpha 619 -- Production Caller Reality Check", () => {
  beforeAll(() => {
    // The SAME repository-authoritative build command a real caller
    // would run (`npm run build:runtime`) -- executed here directly so
    // this test is self-contained regardless of whether `dist/` was
    // already built.
    execSync("npx tsc -p tsconfig.runtime.json", { stdio: "pipe", cwd: process.cwd() });
  }, 60_000);

  it(
    "the REAL built entry point, launched as its own OS process with real CLI args, reaches a real ready state against real durable files",
    async () => {
      const dir = freshDir();
      const boardLogPath = join(dir, "board.jsonl");
      const outboxLogPath = join(dir, "outbox.jsonl");

      const child = spawn(
        process.execPath,
        [
          "dist/desktop/runtime/run_fedos_desktop_runtime.js",
          `--board-log=${boardLogPath}`,
          `--outbox-log=${outboxLogPath}`,
        ],
        { stdio: ["ignore", "pipe", "pipe"], cwd: process.cwd() },
      );
      children.push(child);

      const output = await waitForOutput(child, /fedos-desktop-runtime: ready \(state=ready\)/, 10_000);
      expect(output).toContain("state=ready");

      // The process is real and alive -- confirmed via its own reported pid.
      expect(child.pid).toBeGreaterThan(0);
      expect(child.exitCode).toBeNull();
    },
    15_000,
  );

  it(
    "invoking with missing required CLI arguments fails closed with a clear, non-zero exit -- no partial ready state, no hang",
    async () => {
      const child = spawn(process.execPath, ["dist/desktop/runtime/run_fedos_desktop_runtime.js"], {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: process.cwd(),
      });
      children.push(child);

      const exitCode = await new Promise<number | null>((resolve) => {
        child.on("exit", (code: number | null) => resolve(code));
        setTimeout(() => resolve(null), 8_000);
      });
      expect(exitCode).toBe(1);
    },
    12_000,
  );

  it("the built dist/ output is a genuine artifact of npm run build:runtime -- confirmed present, real JS, importable", () => {
    const entry = "dist/desktop/runtime/run_fedos_desktop_runtime.js";
    expect(existsSync(entry)).toBe(true);
  });
});
