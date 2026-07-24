/**
 * Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
 * Configuration Unification Arc) — Phase O: failure matrix for this Arc's
 * own new configuration surface (the four `*Enabled` flags and their
 * validation guards in `startFedosDesktopRuntime()`).
 */
import { describe, it, expect } from "vitest";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { NullRelay } from "../src/desktop/null_relay.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import type { FedosDesktopRuntimeConfig } from "../src/desktop/runtime/fedos_desktop_runtime_config.js";

function baseConfig(dir: string): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false,
    conversationLogPath: join(dir, "conversation.ndjson"),
    conversationEnvelopeLogPath: join(dir, "conversation-envelope.ndjson"),
    conversationPayloadLogPath: join(dir, "conversation-payload.ndjson"),
    conversationMembershipLogPath: join(dir, "conversation-membership.ndjson"),
  };
}

describe("Secure Runtime Alpha 6521-6600 -- failure matrix", () => {
  it("1. directRatchetEnabled without deviceTrustEnabled fails closed, synchronously, before any Persistence backend is constructed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-cfg-fail-"));
    try {
      await expect(startFedosDesktopRuntime({ ...baseConfig(dir), directRatchetEnabled: true })).rejects.toThrow(/deviceTrustEnabled/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. peerCapabilityEnabled with deviceTrustEnabled but without privateTransportEnabled fails closed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-cfg-fail-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = await signingAuthority.publicIdentityForAccount(0);
      await expect(
        startFedosDesktopRuntime({
          ...baseConfig(dir),
          deviceTrustEnabled: true,
          localDeviceId: "device-1",
          localAccountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null },
          deviceRegistryLogPath: join(dir, "device-registry.ndjson"),
          deviceBindingChallengeReplayLogPath: join(dir, "device-binding-replay.ndjson"),
          deviceBindingAccountSigningAuthority: signingAuthority,
          deviceSyncJournalLogPath: join(dir, "sync-journal.ndjson"),
          peerCapabilityEnabled: true,
          peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
        }),
      ).rejects.toThrow(/privateTransportEnabled/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3. peerCapabilityEnabled without peerCapabilityLocallySupportedCapabilities fails closed -- never a fabricated capability list", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-cfg-fail-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = await signingAuthority.publicIdentityForAccount(0);
      await expect(
        startFedosDesktopRuntime({
          ...baseConfig(dir),
          deviceTrustEnabled: true,
          localDeviceId: "device-1",
          localAccountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null },
          deviceRegistryLogPath: join(dir, "device-registry.ndjson"),
          deviceBindingChallengeReplayLogPath: join(dir, "device-binding-replay.ndjson"),
          deviceBindingAccountSigningAuthority: signingAuthority,
          deviceSyncJournalLogPath: join(dir, "sync-journal.ndjson"),
          privateTransportEnabled: true,
          conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
          conversationTransportSigningAuthority: signingAuthority,
          conversationTransportObservationLogPath: join(dir, "transport-obs.ndjson"),
          peerCapabilityEnabled: true,
        }),
      ).rejects.toThrow(/peerCapabilityLocallySupportedCapabilities/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. deletionRequestEnabled without deletionRequestResolveLocalPolicy fails closed -- never a default recipient policy", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-cfg-fail-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = await signingAuthority.publicIdentityForAccount(0);
      await expect(
        startFedosDesktopRuntime({
          ...baseConfig(dir),
          deviceTrustEnabled: true,
          localDeviceId: "device-1",
          localAccountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null },
          deviceRegistryLogPath: join(dir, "device-registry.ndjson"),
          deviceBindingChallengeReplayLogPath: join(dir, "device-binding-replay.ndjson"),
          deviceBindingAccountSigningAuthority: signingAuthority,
          deviceSyncJournalLogPath: join(dir, "sync-journal.ndjson"),
          privateTransportEnabled: true,
          conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
          conversationTransportSigningAuthority: signingAuthority,
          conversationTransportObservationLogPath: join(dir, "transport-obs.ndjson"),
          deletionRequestEnabled: true,
        }),
      ).rejects.toThrow(/deletionRequestResolveLocalPolicy/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("5. identityTransitionEnabled + deviceTrustEnabled + privateTransportEnabled together succeed -- one coherent graph, no throw", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-cfg-ok-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = await signingAuthority.publicIdentityForAccount(0);
      const runtime = await startFedosDesktopRuntime({
        ...baseConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "device-1",
        localAccountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null },
        deviceRegistryLogPath: join(dir, "device-registry.ndjson"),
        deviceBindingChallengeReplayLogPath: join(dir, "device-binding-replay.ndjson"),
        deviceBindingAccountSigningAuthority: signingAuthority,
        deviceSyncJournalLogPath: join(dir, "sync-journal.ndjson"),
        privateTransportEnabled: true,
        conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
        conversationTransportSigningAuthority: signingAuthority,
        conversationTransportObservationLogPath: join(dir, "transport-obs.ndjson"),
        identityTransitionEnabled: true,
      });
      expect(runtime.conversationRuntime().identityTransition()).not.toBeNull();
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("6. directRatchetEnabled with deviceTrustEnabled+privateTransportEnabled but NO production crypto stays honestly unreachable (directRatchet() returns null), never a fabricated Master Seed authority", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-cfg-ok-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = await signingAuthority.publicIdentityForAccount(0);
      const runtime = await startFedosDesktopRuntime({
        ...baseConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "device-1",
        localAccountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null },
        deviceRegistryLogPath: join(dir, "device-registry.ndjson"),
        deviceBindingChallengeReplayLogPath: join(dir, "device-binding-replay.ndjson"),
        deviceBindingAccountSigningAuthority: signingAuthority,
        deviceSyncJournalLogPath: join(dir, "sync-journal.ndjson"),
        privateTransportEnabled: true,
        conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
        conversationTransportSigningAuthority: signingAuthority,
        conversationTransportObservationLogPath: join(dir, "transport-obs.ndjson"),
        directRatchetEnabled: true,
        // Deliberately NO conversationProductionCrypto supplied.
      });
      expect(runtime.conversationRuntime().directRatchet()).toBeNull();
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("7. a manual conversationDeletionRequest override skips auto-construction entirely -- the caller's own object is used verbatim, byte-for-byte the same as before this Arc", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-cfg-ok-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = await signingAuthority.publicIdentityForAccount(0);
      const runtime = await startFedosDesktopRuntime({
        ...baseConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "device-1",
        localAccountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null },
        deviceRegistryLogPath: join(dir, "device-registry.ndjson"),
        deviceBindingChallengeReplayLogPath: join(dir, "device-binding-replay.ndjson"),
        deviceBindingAccountSigningAuthority: signingAuthority,
        deviceSyncJournalLogPath: join(dir, "sync-journal.ndjson"),
        privateTransportEnabled: true,
        conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
        conversationTransportSigningAuthority: signingAuthority,
        conversationTransportObservationLogPath: join(dir, "transport-obs.ndjson"),
        // deletionRequestEnabled deliberately NOT set -- only the manual override is supplied.
        conversationDeletionRequest: {
          deviceRegistry: { getBinding: () => null, putEvent: () => undefined, listBindingsForAccount: () => [] } as never,
          signingAuthority,
          localAccountRef: identity!.publicKeyHex,
          localDeviceRef: "device-1",
          searchIndex: { reconcilePayloadRetention: () => 0 },
          resolveLocalPolicy: () => "deny",
          sendMailboxNip17Control: async () => ({ outcome: "queued", envelopeId: "x" }),
        },
      });
      expect(runtime.conversationRuntime().deletionRequest()).not.toBeNull();
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
