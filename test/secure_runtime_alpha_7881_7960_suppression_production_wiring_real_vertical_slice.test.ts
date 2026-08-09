/**
 * Secure Runtime Alpha 7881-7960 — Phases H/I/J: the real, no-mocks
 * vertical slice proving `FedosArchiveSuppressionObservationAuthority`
 * and its Device Sync propagation are now genuinely constructed by the
 * real production `startFedosDesktopRuntime()` entry point — the exact
 * gap `6a2f274`'s own completion declaration disclosed
 * (`docs/secure_runtime_alpha_7801_7880_multidevice_suppression_wiring_status.md`):
 * "the Desktop Runtime itself... still constructs NO
 * `FedosArchiveSuppressionObservationAuthority` of any kind, and no
 * Device Sync outbound/inbound wiring exists for the suppression
 * `kind:1` route in the real running application."
 *
 * Two real `startFedosDesktopRuntime()` instances (Device A, Device B),
 * a real local RFC 6455 WebSocket relay server, real BIP-340 Schnorr
 * signing (`RealFedosNostrSigningAuthority`, the SAME account identity
 * shared by both Devices -- matches this domain's own "same account,
 * NOT Device-specific keys" design), a real, durable, file-backed Device
 * Registry per Device (each pre-seeded, as a completed pairing already
 * would be, with BOTH Devices trusted), and `archiveSuppressionSyncEnabled: true`
 * on both -- NO hand-wired `FedosArchiveSuppressionOutboundCoordinator`/
 * `InboundHandler`/`InboundSubscription` construction anywhere in this
 * file; every one of those is constructed BY `startFedosDesktopRuntime()`
 * itself, exactly like the real packaged app would.
 *
 * No WASM artifact is required (`DevelopmentFedosMasterSeedAuthority`,
 * the SAME no-WASM-needed pattern the Alpha 6521-6600 real production
 * vertical slice already established) -- this file proves WIRING
 * correctness, not Archive encryption itself (already proven elsewhere,
 * real WASM, by `secure_runtime_alpha_7801_7880_real_vertical_slice.test.ts`).
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/os/messenger/desktop/onboarding/fedos_development_master_seed_authority.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/os/messenger/desktop/node_websocket_relay_socket_factory.js";
import { startFedosRealLocalWebSocketRelayServer, type FedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import type { FedosPersistedDeviceBindingEventV1 } from "../src/os/messenger/device/persistence/fedos_persisted_device_binding_event_v1.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";

const SUPPRESSED_PAYLOAD_ID = "payload-suppression-wiring-1" as unknown as FedosConversationPayloadId;

class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(): Promise<FedosConversationEncryptionResult> {
    throw new Error("not used by this file -- this slice never sends a live message");
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(): Promise<FedosConversationDecryptionResult> {
    throw new Error("not used by this file -- this slice never decrypts a live message");
  }
}

function registeredAndTrustedEvents(deviceId: string, accountRef: FedosDeviceBindingAccountRef, at: number): FedosPersistedDeviceBindingEventV1[] {
  return [
    {
      schemaVersion: 1,
      eventType: "registered",
      deviceId,
      accountAuthority: accountRef.authority,
      accountPublicIdentifier: accountRef.publicIdentifier,
      accountIdentityId: accountRef.identityId,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: at,
    },
    { schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: at },
  ];
}

/** Pre-seeds a real, durable, file-backed Device Registry for ONE Device's own local view -- exactly what a completed real pairing flow would have already produced on disk before either Runtime in this test ever starts. */
function seedRegistry(logPath: string, accountRef: FedosDeviceBindingAccountRef, now: number): void {
  const persistence = new AppendOnlyFedosDeviceRegistryPersistence(logPath);
  for (const event of registeredAndTrustedEvents("device-a", accountRef, now)) persistence.putEvent(event);
  for (const event of registeredAndTrustedEvents("device-b", accountRef, now)) persistence.putEvent(event);
}

async function waitUntil(predicate: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!predicate()) throw new Error(`waitUntil timed out: ${label}`);
}

function minimalConfig(
  dir: string,
  localDeviceId: string,
  accountRef: FedosDeviceBindingAccountRef,
  registryLogPath: string,
  suppressionLogPath: string,
  relayUrl: string,
  sharedSigningAuthority: RealFedosNostrSigningAuthority,
): FedosDesktopRuntimeConfig {
  const localParticipantRef = { authority: "nostr" as const, publicIdentifier: accountRef.publicIdentifier, identityId: null };
  return {
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    conversationEnvelopeLogPath: join(dir, "envelope.log"),
    conversationPayloadLogPath: join(dir, "payload.log"),
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(localParticipantRef),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
    clock: () => Math.floor(Date.now() / 1000),
    archiveEnabled: true,
    conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
    archiveSuppressionObservationLogPath: suppressionLogPath,
    deviceTrustEnabled: true,
    localDeviceId,
    localAccountRef: accountRef,
    deviceRegistryLogPath: registryLogPath,
    archiveSuppressionSyncEnabled: true,
    conversationTransportRelays: [new WebSocketRelay(relayUrl, createNodeWebSocketRelaySocketFactory())],
    conversationTransportSigningAuthority: sharedSigningAuthority,
  };
}

describe("Secure Runtime Alpha 7881-7960 -- Phases H/I/J: real production Suppression wiring vertical slice", () => {
  it(
    "startFedosDesktopRuntime() itself constructs a real Suppression Authority + real Device Sync fan-out/inbound over a real relay; Device B's own restore-gating query flips to 'suppressed' after a real relay round-trip, and survives a real restart",
    async () => {
      let server: FedosRealLocalWebSocketRelayServer | null = null;
      const root = mkdtempSync(join(tmpdir(), "fedos-7881-7960-suppression-wiring-"));
      try {
        server = await startFedosRealLocalWebSocketRelayServer();

        const sharedSigningAuthority = new RealFedosNostrSigningAuthority();
        const identity = (await sharedSigningAuthority.publicIdentityForAccount(0))!;
        const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
        const now = Math.floor(Date.now() / 1000);

        const dirA = mkdtempSync(join(root, "device-a-"));
        const dirB = mkdtempSync(join(root, "device-b-"));
        const registryLogA = join(dirA, "devices.ndjson");
        const registryLogB = join(dirB, "devices.ndjson");
        const suppressionLogB = join(dirB, "suppression.ndjson");
        seedRegistry(registryLogA, accountRef, now);
        seedRegistry(registryLogB, accountRef, now);

        const runtimeA = await startFedosDesktopRuntime(
          minimalConfig(dirA, "device-a", accountRef, registryLogA, join(dirA, "suppression.ndjson"), server.url, sharedSigningAuthority),
        );
        const runtimeB = await startFedosDesktopRuntime(
          minimalConfig(dirB, "device-b", accountRef, registryLogB, suppressionLogB, server.url, sharedSigningAuthority),
        );

        // 1. Restore-gating starts "active" on both real, durable, freshly-constructed authorities -- no suppression fact exists yet.
        expect(runtimeA.archiveSuppressionAuthority().evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore")).toBe("active");
        expect(runtimeB.archiveSuppressionAuthority().evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore")).toBe("active");

        // 2. Device A composes a local Retention/Deletion decision into a durable, self-authored suppression fact,
        //    through the REAL production entry point -- no suppression authority/coordinator was constructed by
        //    this test file itself anywhere above.
        const outcome = runtimeA.recordAndPropagateArchiveSuppression({
          subjectRef: SUPPRESSED_PAYLOAD_ID,
          suppressionMeaning: "suppress-payload-restore",
          decidedAt: now,
        });
        expect(outcome.outcome).toBe("recorded");

        // 3. The LOCAL effect on Device A itself is synchronous and immediate.
        expect(runtimeA.archiveSuppressionAuthority().evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore")).toBe("suppressed");

        // 4. Device B, over a REAL relay round-trip (real Nostr kind:1 event, real BIP-340 signature, real
        //    inbound subscription this Arc's own new FedosArchiveSuppressionInboundSubscription opened),
        //    independently converges to the SAME answer -- proving the full real production wiring end to end.
        await waitUntil(
          () => runtimeB.archiveSuppressionAuthority().evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore") === "suppressed",
          5000,
          "Device B's real Suppression Authority receiving Device A's real relay-propagated fact",
        );

        // 5. A real restart: Device B's Runtime stops, a fresh Runtime is constructed over the SAME durable
        //    Suppression Observation log path -- the imported fact must survive, exactly like every other
        //    durable Observation domain in this codebase.
        await runtimeB.stop();
        const runtimeB2 = await startFedosDesktopRuntime(
          minimalConfig(dirB, "device-b", accountRef, registryLogB, suppressionLogB, server.url, sharedSigningAuthority),
        );
        expect(runtimeB2.archiveSuppressionAuthority().evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore")).toBe("suppressed");

        await runtimeA.stop();
        await runtimeB2.stop();
      } finally {
        if (server !== null) await server.close();
        rmSync(root, { recursive: true, force: true });
      }
    },
    20_000,
  );
});
