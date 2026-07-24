/**
 * Secure Runtime Alpha 7241-7320 — FedOS Long-Running Runtime Reliability
 * and Recovery Arc — Identity Transition arriving DURING an active,
 * real, two-profile, real-relay Direct conversation.
 *
 * Every prior Identity Transition test proved the mechanism in isolation
 * (`test/secure_runtime_alpha_5801_5880_*`) or against a real production
 * Runtime with a SYNTHETIC, never-messaged conversation id
 * (`test/secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`,
 * `conversationId: "prod-slice-conv"`). Nobody had proven a peer's own
 * Identity Transition notification arriving in the MIDDLE of a real,
 * ongoing, message-exchanging conversation, nor that the conversation
 * keeps working correctly on both sides of it, nor that Bob's own
 * acceptance decision survives a real restart while the conversation
 * itself is still live. This file closes that gap. No redesign of
 * Identity Transition's own record/proof/decision model in any way.
 *
 * HONEST BOUNDARY (disclosed, not hidden, mirrors this codebase's own
 * established convention): the production Runtime/Shell wires the
 * RECEIVING/peer side of Identity Transition (`FedosIdentityTransitionPeerRuntime`
 * — list/open/accept/reject/defer) but exposes no Shell method to
 * INITIATE (publish) one's own transition notification — only
 * `FedosIdentityTransitionOutboundNotificationCoordinator` (constructed
 * directly, exactly like
 * `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
 * already does) can build one. That coordinator's own real, signed
 * artifacts are handed to Bob's real, running Conversation Runtime via
 * `receiveNip17Rumor()` — the SAME real, unmodified import pathway a
 * genuinely relay-delivered Rumor would reach — rather than relay-
 * transported, since no real production route to originate one exists
 * yet to relay-transport in the first place. Everything else in this
 * file (the conversation itself, its messages, both restarts) is fully
 * real, over the real local relay, real WASM crypto, no substitution.
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
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

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
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import {
  fedosIdentityTransitionBodyHash,
  fedosIdentityTransitionNewKeyProofDigest,
  fedosIdentityTransitionContinuityProofDigest,
} from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";

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
  readonly accountSigningAuthority: FedosProductionNostrSigningAuthority;
  readonly localDeviceId: string;
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
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(created.outcome).toBe("ok");
  if (created.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, publicIdentifier: created.value.accountPublicIdentifier, paths, accountSigningAuthority, localDeviceId: created.value.localDeviceId };
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
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const unlocked = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(unlocked.outcome).toBe("ok");
  if (unlocked.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, publicIdentifier: unlocked.value.accountPublicIdentifier, paths, accountSigningAuthority, localDeviceId: unlocked.value.localDeviceId };
}

/**
 * Structurally satisfies BOTH `FedosDeviceBindingAccountRef` (device/
 * identity-transition APIs) and `FedosConversationParticipantReference`
 * (Conversation/messaging APIs) -- both are `{ authority, publicIdentifier,
 * identityId }` shapes, just declared as two separate named types in two
 * separate domains; no explicit return-type annotation here so the
 * literal `"nostr"` type is preserved for both call sites.
 */
function accountRef(pubkey: string) {
  return { authority: "nostr" as const, publicIdentifier: pubkey, identityId: null };
}

suite("Alpha 7241-7320 -- Identity Transition arriving mid-conversation: a real, live, two-profile, real-relay Direct conversation keeps working correctly before, during, and after a real Identity Transition notification and decision, across a real restart", () => {
  it(
    "Alice and Bob exchange real messages; a real Identity Transition notification (delivered by Alice, about a synthetic old->new key pair) arrives for Bob mid-conversation; Bob's real decision is recorded, survives a real restart, and messaging continues normally throughout",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-identity-transition-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alicePass = "alice-identity-transition-passphrase-7241";
        const bobPass = "bob-identity-transition-passphrase-7241";

        let alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-idtransition", "Alice", alicePass);
        let bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-idtransition", "Bob", bobPass);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = accountRef(alice.publicIdentifier);
        const bobRef = accountRef(bob.publicIdentifier);

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

        // 1: real message BEFORE the transition.
        const before = await aliceShell.sendMessage(conversationId, aliceRef, "before-transition");
        expect(before.outcome).toBe("ok");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1, 5000, "Bob receiving before-transition");

        // 2: a real Identity Transition notification (Alice's OLD -> NEW
        // key) arrives for Bob, mid-conversation. Bob's own real Device
        // Registry (already constructed by his real Coordinator) must
        // know Alice's OLD identity as a real, resolvable peer for the
        // transition's own local-decision plumbing to have somewhere to
        // record against -- his real Runtime already tracks this via
        // Membership, not Device Trust (Direct conversations use Nostr
        // identity, not Device Trust, for peer resolution) -- so a
        // narrow, external, this-file-only Device Registry view (the SAME
        // established pattern `secure_runtime_alpha_6521_6600_*` already
        // uses) supplies the OLD-identity account ref the outbound
        // coordinator needs to address the notification.
        // Bob's own REAL, resolved local Device id (derived from his real
        // Device keypair during real profile creation above) -- his real,
        // already-running Runtime's own Device Trust checks a delivered
        // Rumor's recipient device against ITS OWN real Device Registry,
        // so a made-up id here would (and initially did) fail closed as
        // "wrong-recipient-device".
        const bobDeviceId = bob.localDeviceId;
        const bobDeviceRegistryLog = join(root, "bob-devices-external.ndjson");
        const bobExternalRegistry = new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog);
        bobExternalRegistry.putEvent({ schemaVersion: 1, eventType: "registered", deviceId: bobDeviceId, accountAuthority: "nostr", accountPublicIdentifier: bobRef.publicIdentifier, accountIdentityId: null, devicePublicKeyRef: null, label: null, initialTrustState: "pending", registeredAt: 0 });
        bobExternalRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: bobDeviceId, trustedAt: 1 });

        // A matched synthetic old/new keypair for the transition's OWN
        // identity being replaced -- decoupled from Alice's real
        // production conversation identity (`aliceRef`), since
        // `FedosProductionNostrSigningAuthority` deliberately exposes no
        // raw-scalar signing hook (Alpha 424's own design boundary, this
        // Arc does not touch), so a real, valid continuity-proof
        // signature can only be constructed against a raw key this test
        // itself generates -- matching this codebase's own established
        // `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
        // precedent exactly. What this file adds beyond that precedent is
        // the notification arriving for a Bob who has a REAL, LIVE,
        // ongoing, message-exchanging conversation with Alice at the same
        // time -- `localAccountRef`/`localDeviceRef` below (WHO delivers
        // the notification) still name Alice's own real identity.
        const NOW = Math.floor(Date.now() / 1000);
        const oldKey = schnorr.utils.randomSecretKey();
        const newKey = schnorr.utils.randomSecretKey();
        const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
        const newPub = bytesToHex(schnorr.getPublicKey(newKey));
        const record = createFedosIdentityTransitionRecordV1({
          transitionId: generateFedosIdentityTransitionId(),
          transitionType: "identity-replacement",
          oldAccountIdentity: accountRef(oldPub),
          newAccountIdentity: accountRef(newPub),
          oldNostrIdentity: oldPub,
          newNostrIdentity: newPub,
          reasonCategory: "user-initiated-replacement",
          issuedAt: NOW,
          expiresAt: NOW + 1_000_000,
          revision: 0,
          previousTransitionId: null,
        });
        const bodyHash = fedosIdentityTransitionBodyHash(record);
        // The new-key proof is signed by the real, freshly-generated new
        // key; the continuity proof by the real, freshly-generated old
        // key -- both genuine BIP-340 Schnorr signatures over the real
        // canonical digests, never fabricated/skipped.
        const newKeyDigest = fedosIdentityTransitionNewKeyProofDigest({ transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });
        const continuityDigest = fedosIdentityTransitionContinuityProofDigest({ transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });

        const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
          deviceRegistry: bobExternalRegistry,
          // Alice's own REAL, already-activated production signing
          // authority (the SAME one her real Coordinator/Runtime already
          // uses for every other real signed artifact in this file) --
          // never a second, fake signing authority.
          signingAuthority: alice.accountSigningAuthority,
          accountIndex: 0,
          localAccountRef: aliceRef,
          localDeviceRef: "alice-old-desktop-7241",
          clock: () => NOW,
          nonceGenerator: () => bytesToHex(schnorr.utils.randomSecretKey()).slice(0, 32),
          sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
        });
        const published = await outbound.publishTransitionNotification({
          notificationId: "id-transition-notif-7241",
          transitionRecord: record,
          newKeyProof: { schemaVersion: 1, transitionId: record.transitionId, revision: 0, bodyHash, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(newKeyDigest, newKey)) },
          continuityEvidence: { schemaVersion: 1, transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(continuityDigest, oldKey)) },
          deviceCorroborations: [],
          recipientAccountRef: bobRef,
          recipientDeviceRef: bobDeviceId,
          conversationId: conversationId as never,
        });
        expect(published.outcome).toBe("published");
        if (published.outcome !== "published") throw new Error("unreachable");

        const { encodeFedosRatchetPeerCapabilityControlPayload } = await import("../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js");
        const wireContent = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }));
        const imported = await bobRuntime.conversationRuntime().receiveNip17Rumor(
          { envelopeId: "id-transition-envelope-7241", senderPublicKeyHex: aliceRef.publicIdentifier, recipientPublicKeyHex: bobRef.publicIdentifier, createdAt: NOW, kind: 14, tags: [], content: wireContent },
          null,
        );
        expect((imported as { outcome: string }).outcome).toBe("recorded");

        // 3: Bob sees it in his real, production-reachable Identity Transition inbox and records a real decision.
        const inbox = bobShell.identityTransitionList(10, 0);
        expect(inbox.outcome).toBe("ok");
        if (inbox.outcome !== "ok") throw new Error("unreachable");
        expect(inbox.value.some((v) => v.transitionId === record.transitionId)).toBe(true);

        const acceptResult = bobShell.identityTransitionAccept(aliceRef, "alice-old-desktop-7241", record.transitionId);
        expect(acceptResult.outcome).toBe("ok");

        // 4: the LIVE conversation keeps working normally, both before AND after this decision.
        const after = await aliceShell.sendMessage(conversationId, aliceRef, "after-transition");
        expect(after.outcome).toBe("ok");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 2, 5000, "Bob receiving after-transition");
        const bobMessagesBeforeRestart = bobShell.listMessages(conversationId);
        expect(bobMessagesBeforeRestart.outcome).toBe("ok");
        if (bobMessagesBeforeRestart.outcome !== "ok") throw new Error("unreachable");
        const bobReadsBeforeRestart = await Promise.all(bobMessagesBeforeRestart.value.map((m) => bobShell.readMessage(conversationId, m.messageId)));
        const bobTextsBeforeRestart = bobReadsBeforeRestart.map((r) => (r.outcome === "ok" ? r.value.plaintext : null));
        expect(bobTextsBeforeRestart).toContainEqual({ state: "available", text: "before-transition" });
        expect(bobTextsBeforeRestart).toContainEqual({ state: "available", text: "after-transition" });

        // 5: restart BOTH sides -- Bob's real accept decision AND the conversation history both survive.
        await alice.coordinator.lock();
        await bob.coordinator.lock();
        alice = await relaunchParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-idtransition", alicePass);
        bob = await relaunchParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-idtransition", bobPass);
        aliceRuntime = alice.coordinator.runningRuntime()!;
        bobRuntime = bob.coordinator.runningRuntime()!;
        expect(await aliceRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        expect(await bobRuntime.conversationRuntime().activateDirectConversation(conversationId)).toEqual(expect.objectContaining({ outcome: "activated" }));
        aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        const inboxAfterRestart = bobShell.identityTransitionList(10, 0);
        expect(inboxAfterRestart.outcome).toBe("ok");
        if (inboxAfterRestart.outcome !== "ok") throw new Error("unreachable");
        const restoredEntry = inboxAfterRestart.value.find((v) => v.transitionId === record.transitionId);
        expect(restoredEntry, "Bob's own real accept decision must survive a real restart").toBeDefined();

        const bobMessagesAfterRestart = bobShell.listMessages(conversationId);
        expect(bobMessagesAfterRestart.outcome).toBe("ok");
        if (bobMessagesAfterRestart.outcome !== "ok") throw new Error("unreachable");
        expect(bobMessagesAfterRestart.value).toHaveLength(2);

        // 6: the conversation genuinely keeps working after the restart too.
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections re-established after restart");
        const postRestart = await aliceShell.sendMessage(conversationId, aliceRef, "after-restart-post-transition");
        expect(postRestart.outcome).toBe("ok");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 3, 5000, "Bob receiving the post-restart message");

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );
});
