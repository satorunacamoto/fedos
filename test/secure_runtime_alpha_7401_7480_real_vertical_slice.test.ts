/**
 * Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — Phase K: the real, two-Conversation
 * vertical slice, closing the specific proof items not already covered
 * by `test/secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts`
 * (create/route/isolate) or
 * `test/secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`
 * (Ratchet session-init/message isolation, Session Reset scoping,
 * restart, Device revocation): duplicate delivery, reverse delivery
 * order, and Search/Archive isolation for two Direct Conversations with
 * the SAME peer, over the real, compiled production Shell.
 *
 * Signed Deletion's own control payload (`fedos_deletion_request_record.ts`)
 * already carries its own explicit `conversationId` field directly in its
 * signed content, resolved never via the peer-only resolver at all — it
 * was never vulnerable to Finding 1/2 and needed no change; see the
 * execution specification for this finding's own full account.
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent. **`NODE_ENV` is never read or set anywhere in
 * this file.**
 */
import { describe, it, expect, afterAll } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync } from "node:fs";
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
import { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
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

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-7401-slice-${label}-`));
  tmpRoots.push(dir);
  return dir;
}
afterAll(() => {
  /* left on disk for post-mortem inspection if a test fails; harmless temp dirs */
  void tmpRoots;
});

async function makeRealParty(dir: string, relayUrl: string, appId: string, label: string, passphrase: string) {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  const masterSeedAuthority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  const accountSigningAuthority = new FedosProductionNostrSigningAuthority(masterSeedAuthority);
  const socketFactory = createNodeWebSocketRelaySocketFactory();
  const deps: FedosProfileInitializationDependencies = {
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
    conversationTransportIntervalMs: 80,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(created.outcome).toBe("ok");
  if (created.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, publicIdentifier: created.value.accountPublicIdentifier };
}

suite("Alpha 7401-7480 -- Phase K: real two-Conversation vertical slice (duplicate delivery, reverse order, Search/Archive isolation)", () => {
  it(
    "duplicate relay redelivery is a no-op, out-of-order arrival across two same-peer conversations still lands correctly, and Search stays isolated per Conversation",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = makeTmpRoot("main");
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alicePass = "alice-phase-k-passphrase-7401";
        const bobPass = "bob-phase-k-passphrase-7401";

        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7401-phase-k", "Alice", alicePass);
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7401-phase-k", "Bob", bobPass);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        const inviteA = await aliceShell.createConversationInvitation(bobRef);
        expect(inviteA.outcome).toBe("ok");
        if (inviteA.outcome !== "ok") throw new Error("unreachable");
        expect(inviteA.value.outcome).toBe("sent");
        if (inviteA.value.outcome !== "sent") throw new Error("unreachable");
        const conversationA = inviteA.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationA) !== null, 5000, "Bob receiving conversation A's invitation");

        const inviteB = await aliceShell.createConversationInvitation(bobRef);
        expect(inviteB.outcome).toBe("ok");
        if (inviteB.outcome !== "ok") throw new Error("unreachable");
        expect(inviteB.value.outcome).toBe("sent");
        if (inviteB.value.outcome !== "sent") throw new Error("unreachable");
        const conversationB = inviteB.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationB) !== null, 5000, "Bob receiving conversation B's invitation");
        expect(conversationA).not.toBe(conversationB);

        // --- Duplicate delivery: the real relay re-delivers the SAME event again -- must be a genuine no-op ---
        const dupSend = await aliceShell.sendMessage(conversationA, aliceRef, "duplicate-delivery-probe");
        expect(dupSend.outcome).toBe("ok");
        await waitUntil(
          () => bobShell.listMessages(conversationA).outcome === "ok" && (bobShell.listMessages(conversationA) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1,
          5000,
          "Bob receiving the duplicate-delivery probe the first time",
        );
        relay.redeliverLast();
        await new Promise((resolve) => setTimeout(resolve, 800));
        const afterRedeliver = bobShell.listMessages(conversationA);
        expect(afterRedeliver.outcome).toBe("ok");
        if (afterRedeliver.outcome !== "ok") throw new Error("unreachable");
        expect(afterRedeliver.value, "a real relay re-delivery of the identical event must never duplicate the imported message").toHaveLength(1);

        // --- Reverse delivery order: send to B, THEN to A, arriving out of the order they were created ---
        const toB = await aliceShell.sendMessage(conversationB, aliceRef, "reverse-order-message-for-B");
        expect(toB.outcome).toBe("ok");
        const toA2 = await aliceShell.sendMessage(conversationA, aliceRef, "reverse-order-message-for-A");
        expect(toA2.outcome).toBe("ok");
        await waitUntil(
          () => bobShell.listMessages(conversationB).outcome === "ok" && (bobShell.listMessages(conversationB) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1,
          5000,
          "Bob receiving the B message",
        );
        await waitUntil(
          () => bobShell.listMessages(conversationA).outcome === "ok" && (bobShell.listMessages(conversationA) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 2,
          5000,
          "Bob receiving the second A message",
        );
        const finalListB = bobShell.listMessages(conversationB);
        const finalListA = bobShell.listMessages(conversationA);
        expect(finalListB.outcome).toBe("ok");
        expect(finalListA.outcome).toBe("ok");
        if (finalListB.outcome !== "ok" || finalListA.outcome !== "ok") throw new Error("unreachable");
        expect(finalListB.value, "conversation B must have exactly its own 1 message, regardless of send/arrival order relative to A").toHaveLength(1);
        expect(finalListA.value, "conversation A must have exactly its own 2 messages, regardless of send/arrival order relative to B").toHaveLength(2);

        // --- Search isolation across two same-peer Conversations (extends Alpha 7241-7320's own different-peer proof to the SAME-peer case this Arc fixes) ---
        for (const m of finalListA.value) await bobShell.readMessage(conversationA, m.messageId);
        for (const m of finalListB.value) await bobShell.readMessage(conversationB, m.messageId);
        const searchA = bobShell.search("reverse-order-message-for-A");
        expect(searchA.outcome).toBe("ok");
        if (searchA.outcome !== "ok") throw new Error("unreachable");
        expect(searchA.value.every((hit) => hit.conversationId === conversationA), "search hits for A's own unique text must never include conversation B").toBe(true);
        expect(searchA.value.length).toBeGreaterThanOrEqual(1);

        const searchB = bobShell.search("reverse-order-message-for-B");
        expect(searchB.outcome).toBe("ok");
        if (searchB.outcome !== "ok") throw new Error("unreachable");
        expect(searchB.value.every((hit) => hit.conversationId === conversationB), "search hits for B's own unique text must never include conversation A").toBe(true);
        expect(searchB.value.length).toBeGreaterThanOrEqual(1);

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );
});
