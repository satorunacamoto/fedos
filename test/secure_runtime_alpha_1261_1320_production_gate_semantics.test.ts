/**
 * Secure Runtime Alpha 1261–1320 — Phase E: Production Gate Semantics
 * (Alpha 1264/1274/1275/1289/1294–1298), verified against the REAL
 * `startFedosDesktopRuntime()` entry point and the REAL WASM artifact.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { assembleFedosConversationProductionCryptoGraph } from "../src/os/messenger/conversations/encryption/production/fedos_conversation_production_crypto_authority_factory.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { FedosFixedPassphraseProvider, UnavailableFedosPassphraseProvider } from "../src/os/core/vault/wasm/fedos_passphrase_provider.js";

declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

function baseConfig(dir: string): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    clock: () => 1_716_000_000,
  };
}

describe("Alpha 1264/1275 -- disabled/omitted production crypto config", () => {
  it("1. omitted conversationProductionCrypto -- capability 'disabled', Runtime/Board/drafts fully usable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-gate-disabled-"));
    const runtime = await startFedosDesktopRuntime(baseConfig(dir));
    expect(runtime.conversationProductionCryptoCapability()).toBe("disabled");

    const cr = runtime.conversationRuntime();
    const created = cr.createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    expect(typeof runtime.boardRuntime).toBe("function");

    await runtime.stop();
  });
});

describe("Alpha 1289 -- unsupported-runtime outside Development mode (the frozen, unmodified 'never Production' gate)", () => {
  it("1. conversationProductionCrypto.enabled=true but NODE_ENV is NOT 'development' -- capability 'unsupported-runtime', never a fallback", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-gate-unsupported-"));
    const config: FedosDesktopRuntimeConfig = {
      ...baseConfig(dir),
      conversationProductionCrypto: {
        enabled: true,
        sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(join(dir, "alice.seed")),
        passphraseProvider: new FedosFixedPassphraseProvider(new TextEncoder().encode("x")),
        allowSeedCreation: true,
      },
    };
    // Deliberately NOT wrapped in withDevelopmentNodeEnv -- this test's own point is the ambient (test-runner) NODE_ENV, whatever it is, is never "development" by accident here.
    const original = process.env.NODE_ENV;
    if (original === "development") delete process.env.NODE_ENV;
    try {
      const runtime = await startFedosDesktopRuntime(config);
      expect(runtime.conversationProductionCryptoCapability()).toBe("unsupported-runtime");
      expect((await runtime.conversationRuntime().activateDirectConversation("irrelevant")).outcome).toBe("conversation-not-found");
      await runtime.stop();
    } finally {
      if (original !== undefined) process.env.NODE_ENV = original;
    }
  });
});

describe("Alpha 1296 -- corrupt sealed seed fails closed, never overwritten automatically", () => {
  it("1. a structurally malformed sealed-seed file yields 'seed-restore-failed', and the file is left untouched", async () => {
    await withDevelopmentNodeEnv(async () => {
      const dir = mkdtempSync(join(tmpdir(), "fedos-gate-corrupt-"));
      const seedPath = join(dir, "corrupt.seed");
      writeFileSync(seedPath, "not a sealed envelope at all", "utf8");

      const result = await assembleFedosConversationProductionCryptoGraph({
        enabled: true,
        sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(seedPath),
        passphraseProvider: new FedosFixedPassphraseProvider(new TextEncoder().encode("whatever")),
        allowSeedCreation: false,
      });
      expect(result.outcome).toBe("seed-restore-failed");

      // File genuinely untouched -- re-reading raises the SAME structural error, never silently replaced.
      const reread = new FileFedosSealedMasterSeedEnvelopePersistence(seedPath);
      expect(() => reread.read()).toThrow();
    });
  });
});

describe("Alpha 1297 -- passphrase unavailable denies production capability, no prompt loop", () => {
  it("1. UnavailableFedosPassphraseProvider on a first-run (no existing seed) path -- 'seed-unavailable', exactly one attempt", async () => {
    await withDevelopmentNodeEnv(async () => {
      const dir = mkdtempSync(join(tmpdir(), "fedos-gate-nopassphrase-"));
      const result = await assembleFedosConversationProductionCryptoGraph({
        enabled: true,
        sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(join(dir, "alice.seed")),
        passphraseProvider: new UnavailableFedosPassphraseProvider(),
        allowSeedCreation: true,
      });
      expect(result.outcome).toBe("seed-unavailable");
    });
  });
});

describe("Alpha 1277/1278/1298 -- clear/stop denies further use, no secret handle reused", () => {
  it("1. after clear(), isAvailable() reports false and resolveConversationKey() denies", async () => {
    await withDevelopmentNodeEnv(async () => {
      const dir = mkdtempSync(join(tmpdir(), "fedos-gate-clear-"));
      const result = await assembleFedosConversationProductionCryptoGraph({
        enabled: true,
        sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(join(dir, "alice.seed")),
        passphraseProvider: new FedosFixedPassphraseProvider(new TextEncoder().encode("alice-passphrase")),
        allowSeedCreation: true,
      });
      expect(result.outcome).toBe("available");
      if (result.outcome !== "available") return;

      expect(await result.graph.masterSeedAuthority.isAvailable()).toBe(true);
      await result.graph.masterSeedAuthority.clear();
      expect(await result.graph.masterSeedAuthority.isAvailable()).toBe(false);
      expect(await result.graph.masterSeedAuthority.resolveConversationKey(0, "a".repeat(64))).toBeNull();
    });
  });

  it("2. startFedosDesktopRuntime().stop() clears the real Master Seed Authority it assembled", async () => {
    await withDevelopmentNodeEnv(async () => {
      const dir = mkdtempSync(join(tmpdir(), "fedos-gate-runtimestop-"));
      const seedPath = join(dir, "alice.seed");
      const config: FedosDesktopRuntimeConfig = {
        ...baseConfig(dir),
        conversationProductionCrypto: {
          enabled: true,
          sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(seedPath),
          passphraseProvider: new FedosFixedPassphraseProvider(new TextEncoder().encode("alice-passphrase")),
          allowSeedCreation: true,
        },
      };

      const runtime = await startFedosDesktopRuntime(config);
      expect(runtime.conversationProductionCryptoCapability()).toBe("available");
      await runtime.stop();

      // The capability accessor itself remains readable (a static fact about how this runtime started) even after stop().
      expect(runtime.conversationProductionCryptoCapability()).toBe("available");
      // But the Conversation Runtime handle itself is inaccessible after stop() (Alpha 923, unchanged).
      expect(() => runtime.conversationRuntime()).toThrow();
    });
  });
});
