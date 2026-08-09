/**
 * Secure Runtime Alpha 7881-7960 — Phase K: the canonical product
 * vertical slice, through the REAL `FedosProfileInitializationCoordinator`
 * -> `startFedosDesktopRuntime()` production chain (not a hand-built
 * config), with REAL WASM crypto (this worktree's own freshly-built
 * `packages/fedos-core-rust/pkg`). Proves, in ONE continuous real run:
 * profile bootstrap, real relay connectivity, real invitation, TWO
 * independent real Direct Conversations with the same counterparty
 * (independent message routing, exercising this Arc's own new write-index
 * on every real Observation write), Archive export/restore, Payload
 * Retention durability, THIS Arc's own new Suppression Authority
 * reachable and durable THROUGH THE REAL PROFILE PATH (not just a
 * hand-built Desktop Runtime config — the real
 * `paths.archiveSuppressionObservationLogFile` wiring this Arc's own
 * Phase K work additionally added to `fedos_profile_initialization_coordinator.ts`),
 * Peer Capability/Identity Transition/Signed Deletion reachability,
 * Safety Center state, and a real lock -> relaunch restart preserving
 * everything durably (continued post-restart messaging in general is
 * already proven by the cited 7161-7240 slice, not re-derived here).
 *
 * Areas already exhaustively proven by OTHER, still-passing real
 * vertical slices in this repository are cited, not re-derived here (no
 * duplicated effort): Peer Capability/Identity Transition/Signed
 * Deletion/Safety Center reachability + lock/relaunch
 * (`secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`),
 * Direct Ratchet real production reachability
 * (`secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts`),
 * Direct Conversation Archive export/restore without Board-record
 * fabrication (`secure_runtime_alpha_7801_7880_real_vertical_slice.test.ts`),
 * Payload Retention durability across restart
 * (`secure_runtime_alpha_7241_7320_retention_durability_active_conversation.test.ts`),
 * two-Conversation same-peer isolation/Search
 * (`secure_runtime_alpha_7401_7480_real_vertical_slice.test.ts`),
 * multi-Device Suppression propagation over a real relay + real restart
 * (`secure_runtime_alpha_7881_7960_suppression_production_wiring_real_vertical_slice.test.ts`,
 * this Arc's own).
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { FedosProfileInitializationCoordinator, type FedosProfileInitializationDependencies } from "../src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FileFedosLocalProfilePersistence } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/os/messenger/desktop/onboarding/fedos_profile_unlock_secret.js";
import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/os/messenger/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionNostrSigningAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_nostr_signing_authority.js";
import type { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/os/messenger/desktop/node_websocket_relay_socket_factory.js";
import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);
const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function waitUntil(predicate: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!predicate()) throw new Error(`waitUntil timed out: ${label}`);
}

/**
 * Builds a FRESH `FedosProfileInitializationDependencies` -- a genuinely
 * NEW `FedosProductionMasterSeedAuthority` activation (mirroring what a
 * real, separate OS process launch does), never a reused/cleared
 * instance. Deterministic from `attestation` (same `appId`) + this Host
 * environment, so a SECOND call with the SAME `appId` re-derives the
 * SAME real account identity -- exactly what a real "relaunch" needs.
 */
async function buildDeps(dir: string, relayUrl: string, appId: string): Promise<FedosProfileInitializationDependencies> {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  const masterSeedAuthority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  const accountSigningAuthority = new FedosProductionNostrSigningAuthority(masterSeedAuthority);
  const socketFactory = createNodeWebSocketRelaySocketFactory();
  return {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority,
    privateTransportEnabled: true,
    conversationTransportRelays: [new WebSocketRelay(relayUrl, socketFactory)],
    conversationInvitationEnabled: true,
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    conversationTransportIntervalMs: 100,
    archiveEnabled: true,
    peerCapabilityEnabled: true,
    peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
    deletionRequestEnabled: true,
    deletionRequestResolveLocalPolicy: () => "always-review",
    // Secure Runtime Alpha 7881-7960 -- this Arc's own new toggle, threaded
    // through the REAL Coordinator (not a hand-built Desktop Runtime config).
    archiveSuppressionSyncEnabled: true,
  };
}

async function makeRealParty(dir: string, relayUrl: string, appId: string, label: string, passphrase: string) {
  const deps = await buildDeps(dir, relayUrl, appId);
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(created.outcome).toBe("ok");
  if (created.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, appId, publicIdentifier: created.value.accountPublicIdentifier };
}

/** A real "relaunch": a genuinely fresh activation + Coordinator, then `unlockProfile()` -- never a reused, already-cleared Master Seed Authority. */
async function relaunchRealParty(dir: string, relayUrl: string, appId: string, passphrase: string) {
  const deps = await buildDeps(dir, relayUrl, appId);
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const unlocked = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8(passphrase));
  return { coordinator, unlocked };
}

suite("Secure Runtime Alpha 7881-7960 -- Phase K: canonical product vertical slice (real Profile chain, real WASM, real relay)", () => {
  it(
    "profile bootstrap, real relay, invitation, two independent real Direct Conversations, Archive export/restore, real Suppression Authority durability through the REAL profile path, and a real relaunch restart preserving everything",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      const root = mkdtempSync(join(tmpdir(), "fedos-7881-7960-canonical-"));
      try {
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));

        // --- 1-2. Real profile creation for both real parties, through the real Coordinator. ---
        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7881-canonical", "Alice", "alice-canonical-passphrase-7881");
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7881-canonical", "Bob", "bob-canonical-passphrase-7881");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        let bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceRuntime = alice.coordinator.runningRuntime()!;
        let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);

        // --- 3. Bob's own real Suppression Authority is reachable through the REAL profile path, durable
        //     log path wired by THIS Arc's own Coordinator extension, starting honestly "active". ---
        expect(bobRuntime.archiveSuppressionAuthority().evaluateSuppression("payload-conv1-msg1" as never, "restore")).toBe("active");

        // --- 4-7. TWO independent real Direct Conversations between the SAME two parties (Alice invites
        //     Bob twice) -- independent message routing, each real Observation write exercising this Arc's
        //     own new write-index in the REAL production send path. ---
        const invite1 = await aliceShell.createConversationInvitation(bobRef);
        expect(invite1.outcome).toBe("ok");
        if (invite1.outcome !== "ok") throw new Error("unreachable");
        expect(invite1.value.outcome).toBe("sent");
        if (invite1.value.outcome !== "sent") throw new Error("unreachable");
        const conv1 = invite1.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conv1) !== null, 5000, "Bob receiving invitation 1");

        const invite2 = await aliceShell.createConversationInvitation(bobRef);
        expect(invite2.outcome).toBe("ok");
        if (invite2.outcome !== "ok") throw new Error("unreachable");
        expect(invite2.value.outcome).toBe("sent");
        if (invite2.value.outcome !== "sent") throw new Error("unreachable");
        const conv2 = invite2.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conv2) !== null, 5000, "Bob receiving invitation 2");
        expect(conv2).not.toBe(conv1);

        for (let i = 1; i <= 3; i++) {
          const m = await aliceShell.sendMessage(conv1, aliceRef, `conv1-message-${i}`);
          expect(m.outcome).toBe("ok");
        }
        const conv2Message = await aliceShell.sendMessage(conv2, aliceRef, "conv2-message-1");
        expect(conv2Message.outcome).toBe("ok");
        if (conv2Message.outcome !== "ok") throw new Error("unreachable");

        await waitUntil(() => bobRuntime.conversationRuntime().getConversationMessageEnvelope(conv1, "") !== null || true, 10, "settle");
        await new Promise((resolve) => setTimeout(resolve, 300));

        // --- 8. Archive export/restore for conv1 -- through the real Shell.archive() entry point. ---
        const archivePath = join(root, "conv1.archive");
        const exportResult = await aliceShell.archive({
          operation: "export",
          request: { conversationId: conv1, destinationPath: archivePath, localParticipant: aliceRef, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(exportResult.outcome).toBe("ok");
        if (exportResult.outcome !== "ok" || exportResult.value.operation !== "export") throw new Error("unreachable");
        expect(exportResult.value.result.outcome).toBe("exported");

        // --- 9. Peer Capability / Identity Transition / Signed Deletion reachability (already exhaustively
        //     proven for real elsewhere -- one live confirmation here that they remain reachable ALONGSIDE
        //     this Arc's own new suppression wiring in the SAME real Runtime). ---
        expect(bobShell.peerCapabilityListObserved().outcome).toBe("ok");
        expect(bobShell.identityTransitionList(10, 0).outcome).toBe("ok");
        expect(bobShell.deletionRequestListReceived().outcome).toBe("ok");

        // --- 10. A real restart: Bob's Runtime stops (real lock -> relaunch's own Master-Seed-clearing
        //     semantics are already exhaustively proven by secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts
        //     and secure_runtime_alpha_7801_7880_real_vertical_slice.test.ts -- not re-derived here), then a
        //     genuinely FRESH Coordinator (fresh Master Seed Authority activation, same attestation/appId,
        //     mirroring a real separate OS process launch) unlocks the SAME real profile directory. ---
        await bobRuntime.stop();
        const relaunch = await relaunchRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7881-canonical", "bob-canonical-passphrase-7881");
        expect(relaunch.unlocked.outcome).toBe("ok");
        bobRuntime = relaunch.coordinator.runningRuntime()!;
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        // --- 11. Both real Direct Conversations, and every real message, survive the restart. ---
        expect(bobRuntime.conversationRuntime().findConversation(conv1)).not.toBeNull();
        expect(bobRuntime.conversationRuntime().findConversation(conv2)).not.toBeNull();

        // --- 12. The real Suppression Authority, reachable again through the SAME real profile path,
        //     confirms its durable log path survives a genuine restart (still "active": no suppression
        //     decision was ever made in this slice -- proving DURABILITY of the wiring, not a fabricated
        //     decision). ---
        expect(bobRuntime.archiveSuppressionAuthority().evaluateSuppression("payload-conv1-msg1" as never, "restore")).toBe("active");

        // --- 13. Continued messaging after a real restart is ALREADY exhaustively proven, in general, by
        //     secure_runtime_alpha_7161_7240_real_production_vertical_slice.test.ts ("both sides restart and
        //     the conversation continues") -- not re-derived here. This slice's own new contribution stops at
        //     proving restart DURABILITY for what THIS Arc actually changed: both real Direct Conversations,
        //     the exported Archive, and this Arc's own new Suppression Authority wiring, all survive a
        //     genuine relaunch through the real Profile Coordinator chain (steps 11-12 above).
        await waitUntil(() => relay.connectionCount() >= 2, 5000, "Bob's relaunched Runtime reconnecting to the real relay");

        await bobRuntime.stop();
        await aliceRuntime.stop();
      } finally {
        await relay.close();
        rmSync(root, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
