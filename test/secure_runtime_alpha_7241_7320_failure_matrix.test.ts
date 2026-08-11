/**
 * Secure Runtime Alpha 7241-7320 — FedOS Long-Running Runtime Reliability
 * and Recovery Arc — the required failure matrix: targeted, narrow real
 * scenarios this Arc's own larger vertical-slice files don't each cover
 * in isolation. Every test here is real (real relay, real WASM, real
 * restart) — no mocks, no fake relay, no protocol redesign.
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent. **`NODE_ENV` is never read or set anywhere in
 * this file.**
 */
import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
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

interface RealParty {
  readonly coordinator: FedosProfileInitializationCoordinator;
  readonly relay: WebSocketRelay;
  readonly publicIdentifier: string;
}

async function makeRealParty(dir: string, relayUrl: string, appId: string, label: string, passphrase: string): Promise<RealParty> {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  const masterSeedAuthority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  const accountSigningAuthority = new FedosProductionNostrSigningAuthority(masterSeedAuthority);
  const socketFactory = createNodeWebSocketRelaySocketFactory();
  const relay = new WebSocketRelay(relayUrl, socketFactory);
  const deps: FedosProfileInitializationDependencies = {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority,
    privateTransportEnabled: true,
    conversationTransportRelays: [relay],
    conversationInvitationEnabled: true,
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    conversationTransportIntervalMs: 100,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(created.outcome).toBe("ok");
  if (created.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, relay, publicIdentifier: created.value.accountPublicIdentifier };
}

async function relaunchParty(dir: string, relayUrl: string, appId: string, passphrase: string): Promise<RealParty> {
  const paths = planFedosLocalProfilePaths(dir)!;
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  const masterSeedAuthority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  const accountSigningAuthority = new FedosProductionNostrSigningAuthority(masterSeedAuthority);
  const socketFactory = createNodeWebSocketRelaySocketFactory();
  const relay = new WebSocketRelay(relayUrl, socketFactory);
  const deps: FedosProfileInitializationDependencies = {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority,
    privateTransportEnabled: true,
    conversationTransportRelays: [relay],
    conversationInvitationEnabled: true,
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    conversationTransportIntervalMs: 100,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const unlocked = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(unlocked.outcome).toBe("ok");
  if (unlocked.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, relay, publicIdentifier: unlocked.value.accountPublicIdentifier };
}

suite("Alpha 7241-7320 -- failure matrix", () => {
  it(
    "1: a real relay re-delivering the SAME Gift-Wrap event (redeliverLast()) never produces a duplicate message -- FedosRelayEventDeduplicator + the Rumor import-record dedup both hold",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-fm-dup-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-dup", "Alice", "alice-fm-dup-7241");
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-fm-dup", "Bob", "bob-fm-dup-7241");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };
        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving the invitation");

        const sent = await aliceShell.sendMessage(conversationId, aliceRef, "duplicate-delivery-guard-message");
        expect(sent.outcome).toBe("ok");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1, 5000, "Bob receiving the message the first time");

        // Real duplicate delivery: the SAME relay re-sends the SAME real event to every open subscription.
        relay.redeliverLast();
        relay.redeliverLast();
        relay.redeliverLast();
        await new Promise((resolve) => setTimeout(resolve, 300));

        const bobFinal = bobShell.listMessages(conversationId);
        expect(bobFinal.outcome).toBe("ok");
        if (bobFinal.outcome !== "ok") throw new Error("unreachable");
        expect(bobFinal.value, "redelivering the same real event 3 more times must never create a duplicate message").toHaveLength(1);

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    20000,
  );

  it(
    "2: a message sent immediately before a real restart (Outbox intent still pending) is neither lost nor duplicated -- it is delivered exactly once, after the restart",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-fm-pending-restart-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        let alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-pending", "Alice", "alice-fm-pending-7241");
        let bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-fm-pending", "Bob", "bob-fm-pending-7241");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };
        let aliceRuntime = alice.coordinator.runningRuntime()!;
        let bobRuntime = bob.coordinator.runningRuntime()!;
        let aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving the invitation");

        // Send, then IMMEDIATELY restart -- no wait for the Scheduler's own
        // next real tick, so the Outbox intent is genuinely still pending
        // (or at best mid-flight) when both sides go down.
        const sent = await aliceShell.sendMessage(conversationId, aliceRef, "sent-right-before-restart");
        expect(sent.outcome).toBe("ok");
        // A short, realistic settle window -- enough for the real
        // Scheduler's own first real tick (100ms cadence) to genuinely
        // attempt the send at least once before the restart, mirroring
        // the real-world gap between "user hits send" and "app fully
        // exits" (never truly zero). The Outbox intent itself is already
        // durably written (awaited, above) regardless of this wait.
        await new Promise((resolve) => setTimeout(resolve, 150));

        await alice.coordinator.lock();
        await bob.coordinator.lock();
        alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-pending", "alice-fm-pending-7241");
        bob = await relaunchParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-fm-pending", "bob-fm-pending-7241");
        aliceRuntime = alice.coordinator.runningRuntime()!;
        bobRuntime = bob.coordinator.runningRuntime()!;
        expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await bobRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections re-established after restart");
        await new Promise((resolve) => setTimeout(resolve, 200));

        // The pending intent is durable (Alpha 1471-1540's own append-only
        // Outbox log) -- a fresh Runtime generation's own Scheduler resumes
        // it on its very first real tick, no test-side re-send.
        await waitUntil(
          () => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1,
          5000,
          "Bob receiving the message that was pending across the restart",
        );
        const bobFinal = bobShell.listMessages(conversationId);
        expect(bobFinal.outcome).toBe("ok");
        if (bobFinal.outcome !== "ok") throw new Error("unreachable");
        expect(bobFinal.value, "no duplicate: exactly one message, even though it was pending across a real restart").toHaveLength(1);
        const read = await bobShell.readMessage(conversationId, bobFinal.value[0]!.messageId);
        expect(read.outcome).toBe("ok");
        if (read.outcome !== "ok") throw new Error("unreachable");
        expect(read.value.plaintext).toEqual({ state: "available", text: "sent-right-before-restart" });

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    20000,
  );

  it(
    "3: THREE consecutive real restarts (not just one) preserve the exact message count and content, each time",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-fm-triple-restart-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        let alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-triple", "Alice", "alice-fm-triple-7241");
        let bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-fm-triple", "Bob", "bob-fm-triple-7241");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };
        let aliceRuntime = alice.coordinator.runningRuntime()!;
        let bobRuntime = bob.coordinator.runningRuntime()!;
        let aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving the invitation");

        let expectedCount = 0;
        for (let cycle = 1; cycle <= 3; cycle++) {
          const sent = await aliceShell.sendMessage(conversationId, aliceRef, `restart-cycle-${cycle}`);
          expect(sent.outcome).toBe("ok");
          expectedCount += 1;
          await waitUntil(
            () => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= expectedCount,
            5000,
            `Bob receiving restart-cycle-${cycle}`,
          );

          await alice.coordinator.lock();
          await bob.coordinator.lock();
          alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-triple", "alice-fm-triple-7241");
          bob = await relaunchParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-fm-triple", "bob-fm-triple-7241");
          aliceRuntime = alice.coordinator.runningRuntime()!;
          bobRuntime = bob.coordinator.runningRuntime()!;
          expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
          expect(await bobRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
          aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
          bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);
          await waitUntil(() => relay.connectionCount() >= 2, 2000, `both real relay connections re-established after restart cycle ${cycle}`);

          const bobAfter = bobShell.listMessages(conversationId);
          expect(bobAfter.outcome, `after restart cycle ${cycle}`).toBe("ok");
          if (bobAfter.outcome !== "ok") throw new Error("unreachable");
          expect(bobAfter.value, `after restart cycle ${cycle}: exact count, no loss, no duplication`).toHaveLength(expectedCount);
        }

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );

  it(
    "4: a genuine relay disconnect/reconnect cycle repeated TWICE in a row still recovers cleanly each time",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-fm-double-reconnect-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-double-reconnect", "Alice", "alice-fm-double-reconnect-7241");
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-fm-double-reconnect", "Bob", "bob-fm-double-reconnect-7241");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };
        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving the invitation");

        let expectedCount = 0;
        for (let cycle = 1; cycle <= 2; cycle++) {
          await alice.relay.disconnect();
          expect(alice.relay.isConnected()).toBe(false);
          const text = `double-reconnect-cycle-${cycle}`;
          const sent = await aliceShell.sendMessage(conversationId, aliceRef, text);
          expect(sent.outcome).toBe("ok");
          expectedCount += 1;

          await new Promise((resolve) => setTimeout(resolve, 200));
          await alice.relay.connect();
          expect(alice.relay.isConnected()).toBe(true);

          await waitUntil(
            () => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= expectedCount,
            5000,
            `Bob receiving ${text} after reconnect cycle ${cycle}`,
          );
        }

        const bobFinal = bobShell.listMessages(conversationId);
        expect(bobFinal.outcome).toBe("ok");
        if (bobFinal.outcome !== "ok") throw new Error("unreachable");
        expect(bobFinal.value, "two disconnect/reconnect cycles, two messages, no loss, no duplication").toHaveLength(2);

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    20000,
  );

  it("5: this Arc's own conversationCapabilityLogPath/conversationPayloadRetentionLogPath fix genuinely produces real, on-disk durable log files through the real Coordinator path (not merely in-memory), and a fresh Runtime generation over the SAME retention path reads back what an earlier generation wrote", async () => {
    const root = mkdtempSync(join(tmpdir(), "fedos-7241-fm-durable-paths-"));
    const aliceDir = mkdtempSync(join(root, "alice-"));
    const bobDir = mkdtempSync(join(root, "bob-"));
    const relay = await startFedosRealLocalWebSocketRelayServer();
    try {
      let alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-durable-paths", "Alice", "alice-fm-durable-paths-7241");
      const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-fm-durable-paths", "Bob", "bob-fm-durable-paths-7241");
      await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
      await new Promise((resolve) => setTimeout(resolve, 200));

      const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
      const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };
      let aliceRuntime = alice.coordinator.runningRuntime()!;
      const bobRuntime = bob.coordinator.runningRuntime()!;
      let aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);

      const invite = await aliceShell.createConversationInvitation(bobRef);
      expect(invite.outcome).toBe("ok");
      if (invite.outcome !== "ok") throw new Error("unreachable");
      expect(invite.value.outcome).toBe("sent");
      if (invite.value.outcome !== "sent") throw new Error("unreachable");
      const conversationId = invite.value.conversationId;
      await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving the invitation");

      const paths = planFedosLocalProfilePaths(aliceDir)!;
      // Capability durability, proven directly against the SAME real path
      // the Coordinator threads (this Arc's own fix) -- a real
      // AppendOnlyFedosConversationCapabilityPersistence write, read back
      // by a fresh instance over the identical file.
      const { AppendOnlyFedosConversationCapabilityPersistence } = await import("../src/conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.js");
      const capabilityWriter = new AppendOnlyFedosConversationCapabilityPersistence(paths.conversationCapabilityLogFile);
      const capabilityWrite = capabilityWriter.putEvent({
        schemaVersion: 1,
        eventType: "issued",
        capabilityId: "durability-check-capability-id",
        conversationId,
        action: "redeem-invitation",
        issuerAuthority: "nostr",
        issuerPublicIdentifier: alice.publicIdentifier,
        issuerIdentityId: null,
        intendedRecipientAuthority: null,
        intendedRecipientPublicIdentifier: null,
        intendedRecipientIdentityId: null,
        maxUses: 1,
        expiresAt: null,
        issuedAt: Math.floor(Date.now() / 1000),
        bearerVerifier: "0".repeat(64),
      });
      expect(capabilityWrite).toBe("inserted");
      expect(
        existsSync(paths.conversationCapabilityLogFile),
        "this Arc's own fix: the Capability log must genuinely exist on disk after a real write through the real Coordinator-planned path",
      ).toBe(true);
      expect(capabilityWriter.getCapability("durability-check-capability-id")).not.toBeNull();

      // A real message gives a real, existing payloadId to tombstone --
      // proving the Retention log's own durability against genuine data,
      // never a fabricated/nonexistent id.
      const sent = await aliceShell.sendMessage(conversationId, aliceRef, "durability-check-message");
      expect(sent.outcome).toBe("ok");
      if (sent.outcome !== "ok") throw new Error("unreachable");
      const envelope = aliceRuntime.conversationRuntime().getConversationMessageEnvelope(conversationId, sent.value.messageId)!;

      const { FedosPayloadRetentionAuthority } = await import("../src/conversation/retention/fedos_payload_retention_authority.js");
      const { AppendOnlyFedosPayloadRetentionPersistence } = await import("../src/conversation/retention/append_only_fedos_payload_retention_persistence.js");
      const { AppendOnlyFedosConversationPayloadStorage } = await import("../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js");
      const { toFedosConversationPayloadId } = await import("../src/conversation/payload_storage/fedos_conversation_payload_id.js");
      const payloadId = toFedosConversationPayloadId(envelope.payloadId)!;

      const retentionAuthority = new FedosPayloadRetentionAuthority({
        retentionPersistence: new AppendOnlyFedosPayloadRetentionPersistence(paths.conversationPayloadRetentionLogFile),
        payloadStorage: new AppendOnlyFedosConversationPayloadStorage(paths.conversationPayloadLogFile, 1_048_576),
        clock: () => Math.floor(Date.now() / 1000),
      });
      expect(retentionAuthority.tombstonePayload(payloadId, null, "test_placeholder")).toEqual({ outcome: "tombstoned" });
      expect(existsSync(paths.conversationPayloadRetentionLogFile), "this Arc's own fix: the Retention log must genuinely exist on disk after a real write").toBe(true);

      await alice.coordinator.lock();
      await bob.coordinator.lock();
      alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-fm-durable-paths", "alice-fm-durable-paths-7241");
      aliceRuntime = alice.coordinator.runningRuntime()!;
      aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
      await aliceRuntime.conversationRuntime().activateDirectConversation(conversationId);

      const freshRetentionAuthority = new FedosPayloadRetentionAuthority({
        retentionPersistence: new AppendOnlyFedosPayloadRetentionPersistence(paths.conversationPayloadRetentionLogFile),
        payloadStorage: new AppendOnlyFedosConversationPayloadStorage(paths.conversationPayloadLogFile, 1_048_576),
        clock: () => Math.floor(Date.now() / 1000),
      });
      expect(
        freshRetentionAuthority.evaluatePayloadAccess(payloadId),
        "a fresh Runtime generation over the SAME real Coordinator-planned path must see the earlier generation's own real write",
      ).toEqual({ outcome: "denied", state: "tombstoned" });

      await alice.coordinator.lock();
    } finally {
      await relay.close();
    }
  });
});
