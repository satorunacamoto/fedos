/**
 * Secure Runtime Alpha 1691–1760 — Local Runtime lifecycle wiring for
 * `conversationArchiveRuntime()`: the `archiveEnabled` fail-closed
 * config guard, the two-state accessor gate (not-enabled /
 * inaccessible-after-stop), and end-to-end confirmation that the
 * wired-through Runtime is really the one this Local Runtime owns.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-1691-1760-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fakeMasterSeedAuthority(): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey: vi.fn(async () => ({ kind: "AeadKeyHandle" }) as AeadKeyHandle),
  };
}

describe("Secure Runtime Alpha 1691-1760 -- archiveEnabled config guard", () => {
  it("1. archiveEnabled: true without conversationArchiveMasterSeedAuthority throws synchronously, before any Persistence/Host is constructed", async () => {
    const dir = freshDir();
    await expect(
      startFedosDesktopRuntime({
        boardLogPath: join(dir, "board.jsonl"),
        outboxLogPath: join(dir, "outbox.jsonl"),
        deliveryEnabled: false,
        archiveEnabled: true,
      }),
    ).rejects.toThrow(/conversationArchiveMasterSeedAuthority/);
  });

  it("2. archiveEnabled omitted (default false) never constructs a FedosConversationArchiveRuntime -- conversationArchiveRuntime() throws not-enabled", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(() => runtime.conversationArchiveRuntime()).toThrow(/not enabled/);
    await runtime.stop();
  });

  it("3. archiveEnabled: false explicitly -- same as omitted", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
      archiveEnabled: false,
    });
    expect(() => runtime.conversationArchiveRuntime()).toThrow(/not enabled/);
    await runtime.stop();
  });
});

describe("Secure Runtime Alpha 1691-1760 -- conversationArchiveRuntime() accessor lifecycle", () => {
  it("1. archiveEnabled: true with a Master Seed Authority supplied -- the accessor returns a real, usable FedosConversationArchiveRuntime", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(),
    });
    const archiveRuntime = runtime.conversationArchiveRuntime();
    // Reaches for a nonexistent conversation -- proves this is a REAL, live, wired Runtime, not a stub.
    const result = await archiveRuntime.exportConversationArchive({
      conversationId: "unknown::thread",
      destinationPath: join(dir, "archive.bin"),
      localParticipant: { authority: "fedos", publicIdentifier: "alice", identityId: null },
      localAccountIndex: 0,
      counterpartyPublicKeyHex: "ab".repeat(32),
      suite: "ChaCha20Poly1305",
    });
    expect(result).toEqual({ outcome: "conversation-not-found" });
    await runtime.stop();
  });

  it("2. calling conversationArchiveRuntime() again returns the SAME instance while running -- no singleton-per-call surprise", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(),
    });
    expect(runtime.conversationArchiveRuntime()).toBe(runtime.conversationArchiveRuntime());
    await runtime.stop();
  });

  it("3. inaccessible after stop() -- both the accessor itself AND an already-held reference's own operations fail closed", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(),
    });
    const heldReference = runtime.conversationArchiveRuntime();
    await runtime.stop();

    expect(() => runtime.conversationArchiveRuntime()).toThrow(/inaccessible after stop/);
    // The Archive Runtime's OWN internal isRuntimeRunning() closure independently also fails closed --
    // a caller that grabbed a reference BEFORE stop() cannot use it afterward either.
    const result = await heldReference.exportConversationArchive({
      conversationId: "unknown::thread",
      destinationPath: join(dir, "too-late.archive"),
      localParticipant: { authority: "fedos", publicIdentifier: "alice", identityId: null },
      localAccountIndex: 0,
      counterpartyPublicKeyHex: "ab".repeat(32),
      suite: "ChaCha20Poly1305",
    });
    expect(result).toEqual({ outcome: "failed" });
  });

  it("4. two independent runtimes never share the same FedosConversationArchiveRuntime instance", async () => {
    const dirA = freshDir();
    const dirB = freshDir();
    const runtimeA = await startFedosDesktopRuntime({
      boardLogPath: join(dirA, "board.jsonl"), outboxLogPath: join(dirA, "outbox.jsonl"), deliveryEnabled: false,
      archiveEnabled: true, conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(),
    });
    const runtimeB = await startFedosDesktopRuntime({
      boardLogPath: join(dirB, "board.jsonl"), outboxLogPath: join(dirB, "outbox.jsonl"), deliveryEnabled: false,
      archiveEnabled: true, conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(),
    });
    expect(runtimeA.conversationArchiveRuntime()).not.toBe(runtimeB.conversationArchiveRuntime());
    await runtimeA.stop();
    await runtimeB.stop();
  });
});
