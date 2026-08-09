import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-678-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function freshRuntime() {
  const dir = freshDir();
  return startFedosDesktopRuntime({
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false,
  });
}

/**
 * Secure Runtime Alpha 678 ("Lifecycle Verification") — Stage 8 of
 * Phase D of the Alpha 641-680 Arc.
 */
describe("Secure Runtime Alpha 678 -- Lifecycle Verification", () => {
  it("1. boardRuntime() is available immediately once startFedosDesktopRuntime() resolves", async () => {
    const runtime = await freshRuntime();
    expect(() => runtime.boardRuntime()).not.toThrow();
    await runtime.stop();
  });

  it("2. boardRuntime() returns the SAME instance across repeated calls while running", async () => {
    const runtime = await freshRuntime();
    expect(runtime.boardRuntime()).toBe(runtime.boardRuntime());
    await runtime.stop();
  });

  it("3. boardRuntime() is inaccessible (throws) after stop()", async () => {
    const runtime = await freshRuntime();
    await runtime.stop();
    expect(() => runtime.boardRuntime()).toThrow();
  });

  it("4. operations through a boardRuntime() handle obtained BEFORE stop() fail closed (unavailable) once the underlying Host has stopped", async () => {
    const runtime = await freshRuntime();
    const boardRuntime = runtime.boardRuntime();
    await runtime.stop();
    const result = await boardRuntime.createPublicThread({ boardId: "b", body: "after stop" });
    expect(result).toEqual({ outcome: "unavailable" });
  });

  it("5. a second stop() call throws -- no restart of the same runtime handle", async () => {
    const runtime = await freshRuntime();
    await runtime.stop();
    await expect(runtime.stop()).rejects.toThrow();
  });

  it("6. boardRuntime() never outlives Host -- once Host.state() is not 'ready', every boardRuntime() operation reports unavailable, never throws", async () => {
    const runtime = await freshRuntime();
    const boardRuntime = runtime.boardRuntime();
    await runtime.stop();
    expect(runtime.host.state()).toBe("stopped");
    await expect(boardRuntime.createPublicThread({ boardId: "b", body: "x" })).resolves.toEqual({ outcome: "unavailable" });
    await expect(boardRuntime.replyToPublicThread({ boardId: "b", threadId: "t", replyTo: "t", body: "x" })).resolves.toEqual({
      outcome: "unavailable",
    });
  });
});
