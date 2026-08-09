/**
 * Secure Runtime Alpha 7241-7320 — FedOS Long-Running Runtime Reliability
 * and Recovery Arc — multi-conversation isolation.
 *
 * No existing test constructs two separate, concurrently-live
 * conversations for the same real profile and proves message/Search
 * isolation between them. This file closes that gap for the case the
 * production inbound routing actually supports correctly (real, distinct
 * counterparty pubkeys) -- AND, via real testing, originally discovered
 * and honestly documented a genuine, structural limitation for the OTHER
 * case (two concurrent Direct conversations with the SAME peer), rather
 * than silently working around or hiding it.
 *
 * UPDATE — Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation
 * Route Binding and NIP-17 Inbound Isolation Arc) closed this exact
 * finding: `resolveFedosPrivateNostrInboundDirectConversation()`
 * (`src/conversation/delivery/nostr/fedos_private_nostr_inbound_conversation_resolver.ts`,
 * Alpha 1424, still UNMODIFIED) is retained but is no longer the PRIMARY
 * inbound resolution path -- a new, authenticated route binding carried
 * inside the encrypted Rumor content
 * (`fedos_direct_conversation_plain_message_payload.ts`) is resolved
 * directly via `resolveFedosDirectConversationByRouteBinding()`
 * (`fedos_direct_conversation_route_binding_resolver.ts`), never a
 * peer-only guess. This was a real, NIP-17-content-layer fix (never a
 * wire-format/NIP-level change -- `.content` remains standard NIP-17
 * plain text; only its FedOS-proprietary INNER meaning changed, mirroring
 * the Direct Ratchet route's own already-established convention), so
 * "fixing it for real would require... protocol redesign" (this file's
 * own original conclusion) turned out to be avoidable: see
 * `docs/secure_runtime_alpha_7401_7480_routing_decision.md`. Test 2 below
 * is UPDATED (this Arc) to assert the CORRECTED behavior -- see
 * `test/secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts`
 * for this Arc's own dedicated, fresh regression test of the identical
 * scenario.
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent. **`NODE_ENV` is never read or set anywhere in
 * this file.**
 */
import { describe, it, expect } from "vitest";
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
    conversationTransportIntervalMs: 100,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(created.outcome).toBe("ok");
  if (created.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, publicIdentifier: created.value.accountPublicIdentifier };
}

async function relaunchParty(dir: string, relayUrl: string, appId: string, passphrase: string) {
  const paths = planFedosLocalProfilePaths(dir)!;
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
    conversationTransportIntervalMs: 100,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const unlocked = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(unlocked.outcome).toBe("ok");
  if (unlocked.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, publicIdentifier: unlocked.value.accountPublicIdentifier };
}

suite("Alpha 7241-7320 -- multi-conversation isolation", () => {
  it(
    "test 1 (the supported case): Alice's real, concurrently-live conversations with Bob AND Carol (two DIFFERENT real peers) stay fully isolated, before and after a real restart of all three profiles",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-multiconv-peers-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const carolDir = mkdtempSync(join(root, "carol-"));
        const alicePass = "alice-multiconv-peers-passphrase-7241";
        const bobPass = "bob-multiconv-peers-passphrase-7241";
        const carolPass = "carol-multiconv-peers-passphrase-7241";

        let alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-multiconv-peers", "Alice", alicePass);
        let bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-multiconv-peers", "Bob", bobPass);
        let carol = await makeRealParty(carolDir, relay.url, "com.fedos.desktop.test.carol-7241-multiconv-peers", "Carol", carolPass);
        await waitUntil(() => relay.connectionCount() >= 3, 2000, "all three real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };
        const carolRef = { authority: "nostr" as const, publicIdentifier: carol.publicIdentifier, identityId: null };

        let aliceRuntime = alice.coordinator.runningRuntime()!;
        let bobRuntime = bob.coordinator.runningRuntime()!;
        let carolRuntime = carol.coordinator.runningRuntime()!;
        let aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);
        let carolShell = FedosDesktopApplicationShell.fromRunningRuntime(carolRuntime);

        const inviteBob = await aliceShell.createConversationInvitation(bobRef);
        expect(inviteBob.outcome).toBe("ok");
        if (inviteBob.outcome !== "ok") throw new Error("unreachable");
        expect(inviteBob.value.outcome).toBe("sent");
        if (inviteBob.value.outcome !== "sent") throw new Error("unreachable");
        const conversationWithBob = inviteBob.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationWithBob) !== null, 5000, "Bob receiving his invitation");

        const inviteCarol = await aliceShell.createConversationInvitation(carolRef);
        expect(inviteCarol.outcome).toBe("ok");
        if (inviteCarol.outcome !== "ok") throw new Error("unreachable");
        expect(inviteCarol.value.outcome).toBe("sent");
        if (inviteCarol.value.outcome !== "sent") throw new Error("unreachable");
        const conversationWithCarol = inviteCarol.value.conversationId;
        await waitUntil(() => carolRuntime.conversationRuntime().findConversation(conversationWithCarol) !== null, 5000, "Carol receiving her invitation");

        expect(conversationWithBob).not.toBe(conversationWithCarol);

        // Interleaved real messaging across both real, distinct peers.
        const toBob1 = await aliceShell.sendMessage(conversationWithBob, aliceRef, "to-bob-unique-topic-quokka");
        expect(toBob1.outcome).toBe("ok");
        const toCarol1 = await aliceShell.sendMessage(conversationWithCarol, aliceRef, "to-carol-unique-topic-wombat");
        expect(toCarol1.outcome).toBe("ok");
        await waitUntil(() => bobShell.listMessages(conversationWithBob).outcome === "ok" && (bobShell.listMessages(conversationWithBob) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1, 5000, "Bob receiving his message");
        await waitUntil(() => carolShell.listMessages(conversationWithCarol).outcome === "ok" && (carolShell.listMessages(conversationWithCarol) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1, 5000, "Carol receiving her message");

        const bobFirst = bobShell.listMessages(conversationWithBob);
        expect(bobFirst.outcome).toBe("ok");
        if (bobFirst.outcome !== "ok") throw new Error("unreachable");
        const replyFromBob = await bobShell.reply(conversationWithBob, bobRef, bobFirst.value[0]!.messageId, "reply-from-bob-only");
        expect(replyFromBob.outcome).toBe("ok");
        const carolFirst = carolShell.listMessages(conversationWithCarol);
        expect(carolFirst.outcome).toBe("ok");
        if (carolFirst.outcome !== "ok") throw new Error("unreachable");
        const replyFromCarol = await carolShell.reply(conversationWithCarol, carolRef, carolFirst.value[0]!.messageId, "reply-from-carol-only");
        expect(replyFromCarol.outcome).toBe("ok");

        await waitUntil(() => aliceShell.listMessages(conversationWithBob).outcome === "ok" && (aliceShell.listMessages(conversationWithBob) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 2, 5000, "Alice receiving Bob's reply");
        await waitUntil(() => aliceShell.listMessages(conversationWithCarol).outcome === "ok" && (aliceShell.listMessages(conversationWithCarol) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 2, 5000, "Alice receiving Carol's reply");

        async function assertFullIsolation(label: string): Promise<void> {
          const listBob = aliceShell.listMessages(conversationWithBob);
          const listCarol = aliceShell.listMessages(conversationWithCarol);
          expect(listBob.outcome, label).toBe("ok");
          expect(listCarol.outcome, label).toBe("ok");
          if (listBob.outcome !== "ok" || listCarol.outcome !== "ok") throw new Error("unreachable");
          expect(listBob.value, `${label}: conversation-with-Bob must have exactly 2 messages`).toHaveLength(2);
          expect(listCarol.value, `${label}: conversation-with-Carol must have exactly 2 messages`).toHaveLength(2);

          const readsBob = await Promise.all(listBob.value.map((m) => aliceShell.readMessage(conversationWithBob, m.messageId)));
          const readsCarol = await Promise.all(listCarol.value.map((m) => aliceShell.readMessage(conversationWithCarol, m.messageId)));
          const textsBob = readsBob.map((r) => (r.outcome === "ok" ? r.value.plaintext : null));
          const textsCarol = readsCarol.map((r) => (r.outcome === "ok" ? r.value.plaintext : null));

          expect(textsBob).toContainEqual({ state: "available", text: "to-bob-unique-topic-quokka" });
          expect(textsBob).toContainEqual({ state: "available", text: "reply-from-bob-only" });
          expect(textsCarol).toContainEqual({ state: "available", text: "to-carol-unique-topic-wombat" });
          expect(textsCarol).toContainEqual({ state: "available", text: "reply-from-carol-only" });

          // The real cross-contamination check.
          expect(textsBob, `${label}: Bob's conversation must never contain Carol's content`).not.toContainEqual({ state: "available", text: "to-carol-unique-topic-wombat" });
          expect(textsBob, `${label}: Bob's conversation must never contain Carol's content`).not.toContainEqual({ state: "available", text: "reply-from-carol-only" });
          expect(textsCarol, `${label}: Carol's conversation must never contain Bob's content`).not.toContainEqual({ state: "available", text: "to-bob-unique-topic-quokka" });
          expect(textsCarol, `${label}: Carol's conversation must never contain Bob's content`).not.toContainEqual({ state: "available", text: "reply-from-bob-only" });

          const searchBob = aliceShell.search("quokka");
          expect(searchBob.outcome, label).toBe("ok");
          if (searchBob.outcome !== "ok") throw new Error("unreachable");
          expect(searchBob.value.every((hit) => hit.conversationId === conversationWithBob), `${label}: "quokka" hits must all belong to the Bob conversation`).toBe(true);
          expect(searchBob.value.length).toBeGreaterThanOrEqual(1);

          const searchCarol = aliceShell.search("wombat");
          expect(searchCarol.outcome, label).toBe("ok");
          if (searchCarol.outcome !== "ok") throw new Error("unreachable");
          expect(searchCarol.value.every((hit) => hit.conversationId === conversationWithCarol), `${label}: "wombat" hits must all belong to the Carol conversation`).toBe(true);
          expect(searchCarol.value.length).toBeGreaterThanOrEqual(1);
        }

        await assertFullIsolation("before restart");

        // ---- Restart ALL THREE sides -- isolation must survive, both conversations must both keep working. ----
        await alice.coordinator.lock();
        await bob.coordinator.lock();
        await carol.coordinator.lock();
        alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-multiconv-peers", alicePass);
        bob = await relaunchParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-multiconv-peers", bobPass);
        carol = await relaunchParty(carolDir, relay.url, "com.fedos.desktop.test.carol-7241-multiconv-peers", carolPass);
        aliceRuntime = alice.coordinator.runningRuntime()!;
        bobRuntime = bob.coordinator.runningRuntime()!;
        carolRuntime = carol.coordinator.runningRuntime()!;
        expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationWithBob)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationWithCarol)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await bobRuntime.conversationRuntime().activateDirectConversation(conversationWithBob)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await carolRuntime.conversationRuntime().activateDirectConversation(conversationWithCarol)).toEqual(expect.objectContaining({ outcome: "activated" }));
        aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);
        carolShell = FedosDesktopApplicationShell.fromRunningRuntime(carolRuntime);
        await waitUntil(() => relay.connectionCount() >= 3, 2000, "all three real relay connections re-established after restart");
        await new Promise((resolve) => setTimeout(resolve, 200));

        await assertFullIsolation("after restart");

        const postBob = await aliceShell.sendMessage(conversationWithBob, aliceRef, "post-restart-to-bob-only");
        expect(postBob.outcome).toBe("ok");
        const postCarol = await aliceShell.sendMessage(conversationWithCarol, aliceRef, "post-restart-to-carol-only");
        expect(postCarol.outcome).toBe("ok");
        await waitUntil(() => bobShell.listMessages(conversationWithBob).outcome === "ok" && (bobShell.listMessages(conversationWithBob) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 3, 5000, "Bob receiving post-restart message");
        await waitUntil(() => carolShell.listMessages(conversationWithCarol).outcome === "ok" && (carolShell.listMessages(conversationWithCarol) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 3, 5000, "Carol receiving post-restart message");

        const finalBob = bobShell.listMessages(conversationWithBob);
        const finalCarol = carolShell.listMessages(conversationWithCarol);
        expect(finalBob.outcome).toBe("ok");
        expect(finalCarol.outcome).toBe("ok");
        if (finalBob.outcome !== "ok" || finalCarol.outcome !== "ok") throw new Error("unreachable");
        expect(finalBob.value).toHaveLength(3);
        expect(finalCarol.value).toHaveLength(3);

        await alice.coordinator.lock();
        await bob.coordinator.lock();
        await carol.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );

  it(
    "test 2 (UPDATED by Secure Runtime Alpha 7401-7480): two concurrent real Direct conversations with the SAME peer ARE now correctly isolated by inbound routing -- the route-binding fix confirmed live",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-multiconv-samepeer-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alicePass = "alice-multiconv-samepeer-passphrase-7241";
        const bobPass = "bob-multiconv-samepeer-passphrase-7241";

        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-multiconv-samepeer", "Alice", alicePass);
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-multiconv-samepeer", "Bob", bobPass);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        // The system does NOT itself prevent creating a second Direct
        // conversation with an already-conversing peer -- both invitations
        // genuinely succeed, over the real relay, with distinct ids.
        const inviteFirst = await aliceShell.createConversationInvitation(bobRef);
        expect(inviteFirst.outcome).toBe("ok");
        if (inviteFirst.outcome !== "ok") throw new Error("unreachable");
        expect(inviteFirst.value.outcome).toBe("sent");
        if (inviteFirst.value.outcome !== "sent") throw new Error("unreachable");
        const conversationFirst = inviteFirst.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationFirst) !== null, 5000, "Bob receiving the first invitation");

        const inviteSecond = await aliceShell.createConversationInvitation(bobRef);
        expect(inviteSecond.outcome).toBe("ok");
        if (inviteSecond.outcome !== "ok") throw new Error("unreachable");
        expect(inviteSecond.value.outcome).toBe("sent");
        if (inviteSecond.value.outcome !== "sent") throw new Error("unreachable");
        const conversationSecond = inviteSecond.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationSecond) !== null, 5000, "Bob receiving the second invitation");
        expect(conversationFirst).not.toBe(conversationSecond);

        // Alice sends a real message specifically into the SECOND
        // conversation.
        const sentToSecond = await aliceShell.sendMessage(conversationSecond, aliceRef, "intended-for-the-second-conversation");
        expect(sentToSecond.outcome).toBe("ok");
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const bobListSecond = bobShell.listMessages(conversationSecond);
        expect(bobListSecond.outcome).toBe("ok");
        if (bobListSecond.outcome !== "ok") throw new Error("unreachable");
        // THE FIX (Secure Runtime Alpha 7401-7480): the message now
        // arrives in the exact conversation it was actually sent to.
        expect(
          bobListSecond.value,
          "FIXED: an inbound message addressed to the SECOND concurrent conversation with the same peer now arrives there via resolveFedosDirectConversationByRouteBinding()",
        ).toHaveLength(1);
        const readSecond = await bobShell.readMessage(conversationSecond, bobListSecond.value[0]!.messageId);
        expect(readSecond.outcome).toBe("ok");
        if (readSecond.outcome !== "ok") throw new Error("unreachable");
        expect(readSecond.value.plaintext).toEqual({ state: "available", text: "intended-for-the-second-conversation" });

        // The FIRST conversation with the same peer must remain completely
        // untouched -- no more first-match misrouting.
        const bobListFirst = bobShell.listMessages(conversationFirst);
        expect(bobListFirst.outcome).toBe("ok");
        if (bobListFirst.outcome !== "ok") throw new Error("unreachable");
        expect(
          bobListFirst.value,
          "FIXED: the FIRST conversation with the same peer must never receive a message actually addressed to the SECOND",
        ).toHaveLength(0);

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );
});
