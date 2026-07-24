/**
 * Secure Runtime Alpha 7241-7320 — FedOS Long-Running Runtime Reliability
 * and Recovery Arc — Payload Retention durability across restart, during
 * an otherwise-live, real, two-profile, real-relay Direct conversation.
 *
 * This is the direct regression proof for this Arc's own real production
 * fix: `FedosDesktopRuntimeConfig.conversationPayloadRetentionLogPath` and
 * `.conversationCapabilityLogPath` ALREADY existed (Alpha 923/1143) and
 * `startFedosDesktopRuntime()` ALREADY wires an `AppendOnlyFedosPayloadRetentionAuthority`
 * when a path is supplied (confirmed by direct source inspection) -- but
 * `FedosProfileInitializationCoordinator` never SUPPLIED either path, and
 * `fedos_local_profile_paths.ts` never even PLANNED a leaf file for them.
 * The real production Coordinator path therefore silently fell back to
 * `InMemoryFedosPayloadRetentionPersistence`/`InMemoryFedosConversationCapabilityPersistence`
 * -- meaning any retention decision (e.g. a granted Signed Deletion
 * Request's own reconciliation) was SILENTLY LOST on every real restart,
 * the exact "no retention bypass" failure this Arc's own required scope
 * calls out by name. This file proves the fix: the SAME two real,
 * independently-provisioned profiles this Arc's other files use, a real
 * live Direct conversation with real encrypted messages, one message's
 * payload genuinely tombstoned mid-conversation, and BOTH sides restarted
 * -- the tombstone survives, every OTHER message stays fully intact and
 * readable (no over-broad retention bypass), and Search stays consistent
 * with the (now durable) retention state across the restart.
 *
 * HONEST BOUNDARY (disclosed, not hidden): the full Signed Deletion
 * Request WIRE protocol (`FedosDeletionRequestOutboundCoordinator.createDeletionRequest()`)
 * requires the recipient's Device to already be registered+trusted in the
 * REQUESTER's own real Device Registry -- a real Device Pairing handshake
 * between two independently-provisioned profiles is its own separate,
 * un-scoped subsystem this Arc does not build. This file therefore
 * exercises retention at the exact layer this codebase's own PRIOR
 * established test convention already does
 * (`test/secure_runtime_alpha_3081_3160_content_accessor.test.ts`'s own
 * "out-of-band retention transition, over the SAME durable retention/
 * payload log paths this running Runtime already uses" pattern, header
 * comment unmodified) -- what a GRANTED Signed Deletion Request's own
 * `reconcilePayloadRetention()` ultimately causes -- rather than
 * fabricating a Device Pairing shortcut. What this file adds beyond that
 * prior precedent: a real two-profile, real-relay LIVE conversation
 * (not a single, manually-driven Runtime) and, critically, a REAL RESTART
 * across the tombstone (the prior precedent's own test never restarted at
 * all -- durability across restart was never actually provable before
 * this Arc's own fix).
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

import { FedosProfileInitializationCoordinator, type FedosProfileInitializationDependencies } from "../src/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FileFedosLocalProfilePersistence } from "../src/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories, type FedosLocalProfilePaths } from "../src/desktop/onboarding/fedos_local_profile_paths.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/desktop/onboarding/fedos_profile_unlock_secret.js";
import { createElectronMainHostAttestation } from "../src/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionNostrSigningAuthority } from "../src/desktop/production_activation/fedos_production_nostr_signing_authority.js";
import { FedosProductionMasterSeedAuthority } from "../src/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/desktop/node_websocket_relay_socket_factory.js";
import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { AppendOnlyFedosPayloadRetentionPersistence } from "../src/conversation/retention/append_only_fedos_payload_retention_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";

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
  readonly publicIdentifier: string;
  readonly paths: FedosLocalProfilePaths;
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
  return { coordinator, publicIdentifier: created.value.accountPublicIdentifier, paths };
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
  return { coordinator, publicIdentifier: unlocked.value.accountPublicIdentifier, paths };
}

suite("Alpha 7241-7320 -- Payload Retention (Signed Deletion's own underlying effect) genuinely survives a real restart of a real, live, two-profile conversation -- the direct regression proof of this Arc's own conversationPayloadRetentionLogPath/conversationCapabilityLogPath Coordinator wiring fix", () => {
  it(
    "a tombstoned message's payload stays tombstoned after both sides restart; every other message in the same live conversation stays fully intact",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-retention-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alicePass = "alice-retention-passphrase-7241";
        const bobPass = "bob-retention-passphrase-7241";

        let alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-retention", "Alice", alicePass);
        let bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-retention", "Bob", bobPass);
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
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving Alice's invitation");

        // Three real, live, relay-delivered messages -- one of which will be tombstoned.
        const keep1 = await aliceShell.sendMessage(conversationId, aliceRef, "keep-this-message-1");
        expect(keep1.outcome).toBe("ok");
        if (keep1.outcome !== "ok") throw new Error("unreachable");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1, 5000, "Bob receiving keep-1");

        const toDelete = await aliceShell.sendMessage(conversationId, aliceRef, "delete-this-message");
        expect(toDelete.outcome).toBe("ok");
        if (toDelete.outcome !== "ok") throw new Error("unreachable");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 2, 5000, "Bob receiving delete-this-message");
        const targetEnvelopeId = toDelete.value.messageId;

        const keep2 = await bobShell.sendMessage(conversationId, bobRef, "keep-this-message-2");
        expect(keep2.outcome).toBe("ok");
        if (keep2.outcome !== "ok") throw new Error("unreachable");
        await waitUntil(() => aliceShell.listMessages(conversationId).outcome === "ok" && (aliceShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 3, 5000, "Alice receiving keep-2");

        // Tombstone Alice's own "delete-this-message" over the SAME durable
        // retention/payload log paths her ALREADY-RUNNING real Runtime uses
        // (this Arc's own fix: these paths now genuinely exist and are
        // genuinely threaded by the real Coordinator -- before this fix,
        // `config.conversationPayloadRetentionLogPath` was `undefined`
        // through this exact chain, so this SAME tombstone call would have
        // written to a durable file NO Runtime generation ever reads back).
        const envelope = aliceRuntime.conversationRuntime().getConversationMessageEnvelope(conversationId, targetEnvelopeId)!;
        expect(envelope).not.toBeNull();
        const payloadId = toFedosConversationPayloadId(envelope.payloadId)!;
        const retentionAuthority = new FedosPayloadRetentionAuthority({
          retentionPersistence: new AppendOnlyFedosPayloadRetentionPersistence(alice.paths.conversationPayloadRetentionLogFile),
          payloadStorage: new AppendOnlyFedosConversationPayloadStorage(alice.paths.conversationPayloadLogFile, 1_048_576),
          clock: () => Math.floor(Date.now() / 1000),
        });
        expect(retentionAuthority.tombstonePayload(payloadId, null, "user_requested_placeholder")).toEqual({ outcome: "tombstoned" });

        // Immediately: tombstoned message is honestly unavailable; the other two remain fully readable.
        const beforeRestartDeleted = await aliceShell.readMessage(conversationId, targetEnvelopeId);
        expect(beforeRestartDeleted.outcome).toBe("ok");
        if (beforeRestartDeleted.outcome !== "ok") throw new Error("unreachable");
        expect(beforeRestartDeleted.value.plaintext.state).toBe("unavailable");
        expect(beforeRestartDeleted.value.retentionState).toBe("tombstoned");

        const beforeRestartSearch = aliceShell.search("delete-this-message");
        expect(beforeRestartSearch).toEqual({ outcome: "ok", value: [] });
        const beforeRestartKeepSearch = aliceShell.search("keep-this-message");
        expect(beforeRestartSearch.outcome).toBe("ok");
        expect((beforeRestartKeepSearch as { outcome: "ok"; value: readonly unknown[] }).value.length).toBeGreaterThanOrEqual(1);

        // ---- Restart BOTH sides -- fresh Coordinators over the SAME on-disk profiles/logs. ----
        await alice.coordinator.lock();
        await bob.coordinator.lock();
        alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-retention", alicePass);
        bob = await relaunchParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-retention", bobPass);
        aliceRuntime = alice.coordinator.runningRuntime()!;
        bobRuntime = bob.coordinator.runningRuntime()!;
        expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await bobRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        // THE regression proof: the tombstone survives the restart (this
        // Arc's own fix is what makes `retentionState` still say
        // "tombstoned" here, rather than reverting to "active" the way an
        // in-memory-only fallback silently would).
        const afterRestartDeleted = await aliceShell.readMessage(conversationId, targetEnvelopeId);
        expect(afterRestartDeleted.outcome).toBe("ok");
        if (afterRestartDeleted.outcome !== "ok") throw new Error("unreachable");
        expect(afterRestartDeleted.value.plaintext.state, "the tombstone must survive a real restart -- this Arc's own regression proof").toBe("unavailable");
        expect(afterRestartDeleted.value.retentionState, "the tombstone must survive a real restart -- this Arc's own regression proof").toBe("tombstoned");

        // No retention bypass in the OTHER direction either: the two kept
        // messages remain fully intact and readable after the SAME restart.
        const afterRestartKeep1 = await aliceShell.readMessage(conversationId, keep1.value.messageId);
        expect(afterRestartKeep1.outcome).toBe("ok");
        if (afterRestartKeep1.outcome !== "ok") throw new Error("unreachable");
        expect(afterRestartKeep1.value.plaintext).toEqual({ state: "available", text: "keep-this-message-1" });
        expect(afterRestartKeep1.value.retentionState).toBe("active");

        // Bob's own reply has its OWN, LOCALLY-generated envelope id on
        // Alice's side (envelope ids are never shared/correlated cross-
        // peer in this codebase's own existing Direct-message design, a
        // pre-existing characteristic unrelated to this Arc's own scope)
        // -- so it is located by decrypted content, never by Bob's own id.
        const aliceListAfterRestart = aliceShell.listMessages(conversationId);
        expect(aliceListAfterRestart.outcome).toBe("ok");
        if (aliceListAfterRestart.outcome !== "ok") throw new Error("unreachable");
        expect(aliceListAfterRestart.value).toHaveLength(3);
        const aliceReadsAfterRestart = await Promise.all(aliceListAfterRestart.value.map((m) => aliceShell.readMessage(conversationId, m.messageId)));
        for (const r of aliceReadsAfterRestart) expect(r.outcome).toBe("ok");
        const aliceTextsAfterRestart = aliceReadsAfterRestart.map((r) => (r.outcome === "ok" ? r.value.plaintext : null));
        expect(aliceTextsAfterRestart).toContainEqual({ state: "available", text: "keep-this-message-1" });
        expect(aliceTextsAfterRestart).toContainEqual({ state: "available", text: "keep-this-message-2" });
        expect(aliceTextsAfterRestart).toContainEqual({ state: "unavailable", reason: expect.any(String) });

        // Search index (rebuilt fresh every Runtime generation, Alpha
        // 2581-2620's own restart-safety guarantee) stays consistent with
        // the NOW-durable retention state too: the tombstoned content never
        // resurfaces, the kept content still does.
        const afterRestartSearchDeleted = aliceShell.search("delete-this-message");
        expect(afterRestartSearchDeleted).toEqual({ outcome: "ok", value: [] });
        const afterRestartSearchKeep = aliceShell.search("keep-this-message");
        expect(afterRestartSearchKeep.outcome).toBe("ok");
        if (afterRestartSearchKeep.outcome !== "ok") throw new Error("unreachable");
        expect(afterRestartSearchKeep.value.length).toBeGreaterThanOrEqual(1);

        // Bob's own independent side never even had the retention decision
        // applied directly (only Alice's side ran the out-of-band
        // tombstone, over ALICE's OWN durable retention log) -- his own
        // local view is unaffected, proving retention is genuinely
        // per-participant/local state, never a shared, cross-participant
        // bypass of any kind. Located by content (Bob's own local
        // envelope id for this message differs from Alice's own).
        const bobListAfterRestart = bobShell.listMessages(conversationId);
        expect(bobListAfterRestart.outcome).toBe("ok");
        if (bobListAfterRestart.outcome !== "ok") throw new Error("unreachable");
        const bobReadsAfterRestart = await Promise.all(bobListAfterRestart.value.map((m) => bobShell.readMessage(conversationId, m.messageId)));
        for (const r of bobReadsAfterRestart) expect(r.outcome).toBe("ok");
        const bobTextsAfterRestart = bobReadsAfterRestart.map((r) => (r.outcome === "ok" ? r.value.plaintext : null));
        expect(bobTextsAfterRestart).toContainEqual({ state: "available", text: "delete-this-message" });

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );
});
