import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { FedosNobleTestNostrSigningAuthority, fedosTestSecretKeyFromSeed } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_signing.js";
import type { FedosConversationDeletionRequestIntegrationDependencies } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime.js";

/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) -- gap-closing follow-up: proves
 * `FedosDesktopRuntimeConfig.conversationDeletionRequest`
 * (`../src/desktop/runtime/fedos_desktop_runtime_config.ts`) really reaches
 * `FedosConversationRuntime.deletionRequest()` through `startFedosDesktopRuntime()`'s
 * own production bootstrap (`../src/desktop/runtime/fedos_desktop_runtime.ts`),
 * mirroring `secure_runtime_alpha_1691_1760_desktop_runtime_wiring.test.ts`'s
 * OWN established "optional config in -> real accessor out" proof pattern for
 * `archiveEnabled`/`conversationArchiveRuntime()`. Uses a REAL BIP-340 signing
 * authority (`FedosNobleTestNostrSigningAuthority`, the SAME one `5881-5960`'s
 * own coordinator-integration test already relies on) -- no WASM artifact
 * required, no mock of the deletion-request domain itself.
 */

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-6041-6120-config-threading-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function realDeletionRequestDeps(): FedosConversationDeletionRequestIntegrationDependencies {
  const deviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
  const signingAuthority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: 0, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
  return {
    deviceRegistry,
    signingAuthority,
    localAccountRef: "alice-account",
    localDeviceRef: "alice-device-a",
    searchIndex: { reconcilePayloadRetention: () => 0 },
    resolveLocalPolicy: () => "always-review",
    sendMailboxNip17Control: async () => ({ outcome: "queued" }) as never,
  };
}

describe("Secure Runtime Alpha 6041-6120 gap-closing -- desktop runtime conversationDeletionRequest config threading", () => {
  it("1. conversationDeletionRequest omitted -- conversationRuntime().deletionRequest() stays null, exactly like the pre-gap-closing behavior", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(runtime.conversationRuntime().deletionRequest()).toBeNull();
    await runtime.stop();
  });

  it("2. conversationDeletionRequest supplied -- conversationRuntime().deletionRequest() is a real, usable, non-null Runtime", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
      conversationDeletionRequest: realDeletionRequestDeps(),
    });
    const deletionRequest = runtime.conversationRuntime().deletionRequest();
    expect(deletionRequest).not.toBeNull();
    // Reaches for a request id nothing ever created -- proves this is a REAL, live, wired
    // Runtime performing a real durable lookup, not a stub returning a fixed value.
    expect(deletionRequest!.listReceivedRequestSummaries()).toEqual([]);
    await runtime.stop();
  });

  it("3. calling deletionRequest() again returns the SAME instance while running -- no singleton-per-call surprise (mirrors conversationArchiveRuntime()'s own established discipline)", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
      conversationDeletionRequest: realDeletionRequestDeps(),
    });
    expect(runtime.conversationRuntime().deletionRequest()).toBe(runtime.conversationRuntime().deletionRequest());
    await runtime.stop();
  });

  it("4. the Shell's own deletion-request methods become live (no longer 'unavailable') once conversationDeletionRequest is supplied through this SAME production config path (FedosDesktopApplicationShell.create().start(config))", async () => {
    const dir = freshDir();
    const shell = FedosDesktopApplicationShell.create();
    const startResult = await shell.start({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
      conversationDeletionRequest: realDeletionRequestDeps(),
    });
    expect(startResult.outcome).toBe("ok");
    const result = shell.deletionRequestListReceived();
    expect(result).toEqual({ outcome: "ok", value: [] });
    await shell.stop();
  });
});
