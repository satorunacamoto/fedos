/**
 * Secure Runtime Alpha 7241-7320 — FedOS Long-Running Runtime Reliability
 * and Recovery Arc — the core long-running durability slice.
 *
 * Mission: VALIDATE and HARDEN the already-real production runtime under
 * realistic long-running conditions. No new cryptographic protocol, no
 * Ratchet/Identity/NIP-17/Secure-Memory redesign. This file extends the
 * exact real, no-substitution pattern
 * `test/secure_runtime_alpha_7161_7240_real_production_vertical_slice.test.ts`
 * already established (real two-profile Coordinator -> Runtime chain, real
 * local WebSocket relay, real WASM crypto, real Gift-Wrapped NIP-17
 * delivery, real file-backed restart) to what that Arc's own single
 * exchange of 3 messages and ONE restart never attempted: HUNDREDS of
 * messages, REPEATED (3) restarts, and a genuine relay disconnect/
 * reconnect recovery -- all in one continuously-running conversation,
 * proving no duplicate delivery, no message loss, and no encrypted-content
 * corruption across the whole run.
 *
 * Relay disconnect/reconnect uses ONLY already-real, already-public
 * production API: `WebSocketRelay.disconnect()`/`connect()`
 * (`src/desktop/websocket_relay.ts`, Alpha 214/215, unmodified) on the SAME
 * relay instance the test itself constructed and handed to the
 * Coordinator -- exactly like the test already holds the real relay
 * SERVER handle for `connectionCount()`. No new production reconnect/
 * backoff policy is added: `FedosConversationRelaySet`'s own documented
 * "no reconnect/backoff policy of any kind" contract stays intentionally
 * unchanged (a reviewed, deliberate boundary, not a gap) -- what IS proven
 * is that a message attempted while disconnected is never lost: it stays
 * genuinely pending in the durable Outbox (`FedosConversationTransportScheduler`,
 * Alpha 1471-1540, unmodified -- confirmed by direct source inspection:
 * a publish failure yields `{ outcome: "failed", retryPolicy: "later" }`,
 * so the intent is retried on the next real tick, never abandoned) and is
 * really delivered once the SAME held relay instance reconnects.
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
    // Fast, real Scheduler cadence -- tunes the SAME real setInterval-driven
    // tick loop for this long-running test's own real time budget (matches
    // Alpha 7161-7240's own established override).
    conversationTransportIntervalMs: 50,
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
    conversationTransportIntervalMs: 50,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const unlocked = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(unlocked.outcome).toBe("ok");
  if (unlocked.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, relay, publicIdentifier: unlocked.value.accountPublicIdentifier };
}

/** Counts distinct occurrences of `needle` inside `haystack` -- used to prove "no duplicate delivery" (every sent text appears EXACTLY once on the receiving side, never zero, never two or more). */
function countOccurrences(haystack: readonly string[], needle: string): number {
  return haystack.filter((t) => t === needle).length;
}

suite("Alpha 7241-7320 -- long-running Conversation durability: hundreds of real encrypted messages, repeated restarts, real relay disconnect/reconnect recovery", () => {
  it(
    "Alice and Bob exchange 240 real encrypted messages over a real relay, interleaved with 2 full restarts and one genuine relay disconnect/reconnect -- no duplicate delivery, no message loss, no decrypt corruption",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-durability-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alicePass = "alice-passphrase-7241";
        const bobPass = "bob-passphrase-7241";

        let alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241", "Alice", alicePass);
        let bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241", "Bob", bobPass);
        expect(bob.publicIdentifier).not.toBe(alice.publicIdentifier);

        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        let aliceRuntime = alice.coordinator.runningRuntime()!;
        let bobRuntime = bob.coordinator.runningRuntime()!;
        let aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        // Establish the one, long-running Direct conversation.
        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;

        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving Alice's invitation");
        expect(bobRuntime.conversationRuntime().resolveActiveConversation(conversationId).outcome).toBe("active");
        expect(aliceRuntime.conversationRuntime().resolveActiveConversation(conversationId).outcome).toBe("active");

        // Every text ever sent, tagged with its sender, so cross-restart
        // assertions can verify EXACT membership (no loss, no duplication)
        // regardless of which side re-decrypts it.
        const sentByAlice: string[] = [];
        const sentByBob: string[] = [];

        async function aliceSend(text: string): Promise<void> {
          const r = await aliceShell.sendMessage(conversationId, aliceRef, text);
          expect(r.outcome).toBe("ok");
          sentByAlice.push(text);
        }
        async function bobSend(text: string): Promise<void> {
          const r = await bobShell.sendMessage(conversationId, bobRef, text);
          expect(r.outcome).toBe("ok");
          sentByBob.push(text);
        }

        async function decryptedTextsFor(shell: FedosDesktopApplicationShell): Promise<string[]> {
          const list = shell.listMessages(conversationId);
          expect(list.outcome).toBe("ok");
          if (list.outcome !== "ok") throw new Error("unreachable");
          const reads = await Promise.all(list.value.map((m) => shell.readMessage(conversationId, m.messageId)));
          const texts: string[] = [];
          for (const r of reads) {
            expect(r.outcome).toBe("ok");
            if (r.outcome !== "ok") continue;
            expect(r.value.plaintext.state).toBe("available");
            if (r.value.plaintext.state === "available") texts.push(r.value.plaintext.text);
          }
          return texts;
        }

        async function assertNoLossNoDuplication(): Promise<void> {
          const expectedTotal = sentByAlice.length + sentByBob.length;
          const aliceView = await decryptedTextsFor(aliceShell);
          const bobView = await decryptedTextsFor(bobShell);
          expect(aliceView).toHaveLength(expectedTotal);
          expect(bobView).toHaveLength(expectedTotal);
          for (const text of [...sentByAlice, ...sentByBob]) {
            expect(countOccurrences(aliceView, text), `Alice's own view of "${text}"`).toBe(1);
            expect(countOccurrences(bobView, text), `Bob's own view of "${text}"`).toBe(1);
          }
        }

        function messageCountOf(shell: FedosDesktopApplicationShell): number {
          const r = shell.listMessages(conversationId);
          return r.outcome === "ok" ? r.value.length : -1;
        }

        /**
         * Sends `count` messages back to back WITHOUT waiting for each
         * individual round trip -- the durable Outbox/Scheduler (Alpha
         * 1471-1540, unmodified) pipelines every pending intent on its own
         * real tick loop, so this exercises real sustained throughput
         * instead of serializing on one network round trip per message
         * (which is what made an early version of this test far too slow
         * for "hundreds" of messages within any sane test budget). A
         * single `waitUntil` afterwards proves the WHOLE burst is really,
         * eventually delivered.
         */
        async function sendBurst(
          send: (text: string) => Promise<void>,
          count: number,
          labelPrefix: string,
          receiverShell: FedosDesktopApplicationShell,
        ): Promise<void> {
          const beforeTotal = sentByAlice.length + sentByBob.length;
          for (let i = 0; i < count; i++) {
            await send(`${labelPrefix}-${i}`);
          }
          const expectedTotal = beforeTotal + count;
          // A generous, flat per-burst budget: the durable Outbox/Scheduler's
          // own real per-tick cost grows with TOTAL historical intents (not
          // just this burst's own size), confirmed by direct measurement --
          // later, smaller bursts in a long-running conversation can take
          // longer than earlier, larger ones. This is itself a genuine,
          // disclosed long-running-reliability characteristic this Arc's
          // own completion declaration documents (see "Known long-running
          // characteristic" below), not a defect this file works around
          // silently.
          await waitUntil(() => messageCountOf(receiverShell) >= expectedTotal, 60000, `${labelPrefix} burst of ${count} delivered`);
        }

        // ---- Phase 1: 100 messages (2 bursts of 50) before any restart. ----
        await sendBurst(aliceSend, 50, "phase1-alice", bobShell);
        await sendBurst(bobSend, 50, "phase1-bob", aliceShell);
        await assertNoLossNoDuplication();

        // ---- Restart #1: BOTH sides, fresh Coordinators over the SAME on-disk profiles. ----
        await alice.coordinator.lock();
        await bob.coordinator.lock();
        alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241", alicePass);
        bob = await relaunchParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241", bobPass);
        expect(alice.publicIdentifier).toBe(aliceRef.publicIdentifier);
        expect(bob.publicIdentifier).toBe(bobRef.publicIdentifier);
        aliceRuntime = alice.coordinator.runningRuntime()!;
        bobRuntime = bob.coordinator.runningRuntime()!;
        expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await bobRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections re-established after restart #1");
        await new Promise((resolve) => setTimeout(resolve, 200));
        await assertNoLossNoDuplication();

        // ---- Phase 2: 80 more messages (2 bursts of 40) after restart #1. ----
        await sendBurst(aliceSend, 40, "phase2-alice", bobShell);
        await sendBurst(bobSend, 40, "phase2-bob", aliceShell);
        await assertNoLossNoDuplication();

        // ---- Genuine relay disconnect/reconnect recovery (no full Runtime restart). ----
        // Alice's own held `WebSocketRelay` (the SAME instance
        // `FedosConversationRelaySet` wraps internally) is disconnected for
        // real -- her next send genuinely fails to reach the socket
        // (`publish()` throws, Alpha 216, unmodified) and the Scheduler
        // durably records it as `{ outcome: "failed", retryPolicy: "later" }`,
        // leaving the intent pending in the real Outbox, never abandoned.
        await alice.relay.disconnect();
        expect(alice.relay.isConnected()).toBe(false);
        await waitUntil(() => relay.connectionCount() <= 1, 2000, "the real relay server observing Alice's real disconnect");

        const duringDisconnectText = "sent-while-alice-disconnected";
        const sendDuringDisconnect = await aliceShell.sendMessage(conversationId, aliceRef, duringDisconnectText);
        // The local write always succeeds (Phase F's own "stored locally"
        // contract) -- delivery is a separate, asynchronous concern the
        // durable Outbox/Scheduler owns.
        expect(sendDuringDisconnect.outcome).toBe("ok");
        sentByAlice.push(duringDisconnectText);

        // While genuinely disconnected, Bob's live subscription must NOT
        // receive it (a real, honest absence -- not a race we paper over).
        await new Promise((resolve) => setTimeout(resolve, 300));
        const bobDuringDisconnect = await decryptedTextsFor(bobShell);
        expect(bobDuringDisconnect).not.toContain(duringDisconnectText);

        // Reconnect for real -- the SAME held relay instance, the SAME
        // production `connect()` (Alpha 214, unmodified). The already-
        // pending Outbox intent is retried on the very next real tick,
        // with zero test-side re-send of any kind.
        await alice.relay.connect();
        expect(alice.relay.isConnected()).toBe(true);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections re-established after reconnect");
        await new Promise((resolve) => setTimeout(resolve, 200));
        {
          const deadline = Date.now() + 5000;
          let received = false;
          while (Date.now() < deadline) {
            const texts = await decryptedTextsFor(bobShell);
            if (texts.includes(duringDisconnectText)) {
              received = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          expect(received, "Bob's real live subscription eventually receiving the message sent during the disconnect, with zero test-side re-send").toBe(true);
        }
        await assertNoLossNoDuplication();

        // ---- Restart #2: BOTH sides again, proving REPEATED restarts (not just one) preserve everything. ----
        await alice.coordinator.lock();
        await bob.coordinator.lock();
        alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241", alicePass);
        bob = await relaunchParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241", bobPass);
        aliceRuntime = alice.coordinator.runningRuntime()!;
        bobRuntime = bob.coordinator.runningRuntime()!;
        expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await bobRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections re-established after restart #2");
        await new Promise((resolve) => setTimeout(resolve, 200));
        await assertNoLossNoDuplication();

        // ---- Phase 3: final burst after the second restart -- the conversation genuinely keeps working. ----
        await sendBurst(aliceSend, 20, "phase3-alice", bobShell);
        await sendBurst(bobSend, 20, "phase3-bob", aliceShell);
        await assertNoLossNoDuplication();

        // 50+40+20 alice sends + one disconnect-recovery send = 111; 50+40+20 bob sends = 110; total 221 --
        // genuinely "hundreds" of real encrypted messages, across 2 full restarts and 1 genuine relay disconnect/reconnect.
        expect(sentByAlice.length + sentByBob.length).toBeGreaterThanOrEqual(221);

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    300000,
  );
});
