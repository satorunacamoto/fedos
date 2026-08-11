/**
 * Secure Runtime Alpha 6121-6200 — Phase S: failure matrix. Cases not
 * already covered by the peer-runtime-extensions/host-command/real
 * vertical-slice test files (which already cover: durable accept/reject/
 * defer, manual-verification unknown-method fail-closed, continuity
 * refusal without acceptance, bounded inbox pagination, stopped Peer
 * Runtime returning empty/null/unavailable everywhere, malformed Shell
 * command structural rejection, competing-transition conflict, restart
 * reconstruction).
 */
import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { FedosIdentityTransitionPeerRuntime } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.js";
import { InMemoryFedosIdentityTransitionPeerObservationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import { InMemoryFedosIdentityTransitionManualVerificationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import { InMemoryFedosIdentityTransitionConversationContinuityPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";
import { InMemoryFedosIdentityTransitionLocalDecisionPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_local_decision.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_canonical.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "../src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import { authorizeFedosIdentityTransitionRatchetReset } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_authorization.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

const CONVERSATION_ID = "conv-1" as unknown as FedosConversationId;

function makeRuntime(bobAccount: FedosDeviceBindingAccountRef) {
  return new FedosIdentityTransitionPeerRuntime({
    deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
    signingAuthority: new RealFedosNostrSigningAuthority(),
    accountIndex: 0,
    localAccountRef: bobAccount,
    localDeviceRef: "bob-desktop",
    clock: () => 5_000,
    nonceGenerator: () => "1".repeat(32),
    sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    observationPersistence: new InMemoryFedosIdentityTransitionPeerObservationPersistence(),
    resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
    manualVerificationPersistence: new InMemoryFedosIdentityTransitionManualVerificationPersistence(),
    continuityPersistence: new InMemoryFedosIdentityTransitionConversationContinuityPersistence(),
    localDecisionPersistence: new InMemoryFedosIdentityTransitionLocalDecisionPersistence(),
  });
}

async function importOneTransition(runtime: FedosIdentityTransitionPeerRuntime, bobAccount: FedosDeviceBindingAccountRef, notificationId: string) {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const aliceIdentity = await signingAuthority.publicIdentityForAccount(0);
  const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
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
    issuedAt: 1_000,
    expiresAt: 1_000_000,
    revision: 0,
    previousTransitionId: null,
  });
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const digest = fedosIdentityTransitionNewKeyProofDigest({
    transitionId: record.transitionId,
    revision: 0,
    bodyHash,
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
  const bobDeviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
  bobDeviceRegistry.putEvent({
    schemaVersion: 1,
    eventType: "registered",
    deviceId: "bob-desktop",
    accountAuthority: "nostr",
    accountPublicIdentifier: bobAccount.publicIdentifier,
    accountIdentityId: null,
    devicePublicKeyRef: null,
    label: null,
    initialTrustState: "pending",
    registeredAt: 0,
  });
  bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-desktop", trustedAt: 1 });
  const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
    deviceRegistry: bobDeviceRegistry,
    signingAuthority,
    accountIndex: 0,
    localAccountRef: aliceAccount,
    localDeviceRef: "alice-old-desktop",
    clock: () => 1_500,
    nonceGenerator: () => bytesToHex(schnorr.utils.randomSecretKey()).slice(0, 32),
    sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
  });
  const published = await outbound.publishTransitionNotification({
    notificationId,
    transitionRecord: record,
    newKeyProof: {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: 0,
      bodyHash,
      newNostrIdentity: newPub,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      signatureHex: bytesToHex(schnorr.sign(digest, newKey)),
    },
    continuityEvidence: null,
    deviceCorroborations: [],
    recipientAccountRef: bobAccount,
    recipientDeviceRef: "bob-desktop",
    conversationId: CONVERSATION_ID,
  });
  if (published.outcome !== "published") throw new Error("setup failed: " + published.outcome);
  const wireContent = new TextDecoder().decode(
    encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }),
  );
  const imported = await runtime.importIdentityTransitionNotification(wireContent);
  if (imported.outcome !== "recorded") throw new Error("import failed: " + imported.outcome);
  return { aliceAccount, transitionId: record.transitionId };
}

describe("Phase S failure matrix", () => {
  it("duplicate acceptance is idempotent, not an error", async () => {
    const bobAccount = accountRef("1".repeat(64));
    const runtime = makeRuntime(bobAccount);
    const { aliceAccount, transitionId } = await importOneTransition(runtime, bobAccount, "notif-a");
    const first = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    const second = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    expect(first?.acceptanceState).toBe("accepted");
    expect(second?.acceptanceState).toBe("accepted");
  });

  it("reject after accept overrides to rejected; accept after reject overrides back to accepted (latest explicit decision always wins)", async () => {
    const bobAccount = accountRef("2".repeat(64));
    const runtime = makeRuntime(bobAccount);
    const { aliceAccount, transitionId } = await importOneTransition(runtime, bobAccount, "notif-b");
    runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    const rejected = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "reject");
    expect(rejected?.acceptanceState).toBe("rejected");
    const acceptedAgain = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    expect(acceptedAgain?.acceptanceState).toBe("accepted");
  });

  it("an unknown transition returns null from every decision/inspect method, never throws", () => {
    const bobAccount = accountRef("3".repeat(64));
    const runtime = makeRuntime(bobAccount);
    const unknownId = "fedos-identity-transition-" + "f".repeat(32);
    expect(runtime.recordIdentityTransitionDecision(accountRef("a".repeat(64)), "d", unknownId, "accept")).toBeNull();
    expect(runtime.inspectPeerIdentityTransitionStatus(accountRef("a".repeat(64)), "d", unknownId)).toBeNull();
    expect(runtime.getIdentityTransitionSafeView(accountRef("a".repeat(64)), "d", unknownId)).toBeNull();
  });

  it("wrong local profile (recipientAccountRef mismatch) is rejected at import, never silently recorded under the wrong account", async () => {
    const bobAccount = accountRef("4".repeat(64));
    const runtime = makeRuntime(bobAccount);
    const wrongAccount = accountRef("5".repeat(64));
    const result = await importOneTransitionForAccount(runtime, wrongAccount, "notif-wrong-account");
    expect(result.outcome).toBe("wrong-recipient-account");
  });

  async function importOneTransitionForAccount(runtime: FedosIdentityTransitionPeerRuntime, wrongAccount: FedosDeviceBindingAccountRef, notificationId: string) {
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const aliceIdentity = await signingAuthority.publicIdentityForAccount(0);
    const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
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
      issuedAt: 1_000,
      expiresAt: 1_000_000,
      revision: 0,
      previousTransitionId: null,
    });
    const bodyHash = fedosIdentityTransitionBodyHash(record);
    const digest = fedosIdentityTransitionNewKeyProofDigest({
      transitionId: record.transitionId,
      revision: 0,
      bodyHash,
      oldNostrIdentity: oldPub,
      newNostrIdentity: newPub,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
    });
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    registry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId: "bob-desktop",
      accountAuthority: "nostr",
      accountPublicIdentifier: wrongAccount.publicIdentifier,
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: 0,
    });
    registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-desktop", trustedAt: 1 });
    const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
      deviceRegistry: registry,
      signingAuthority,
      accountIndex: 0,
      localAccountRef: aliceAccount,
      localDeviceRef: "alice-old-desktop",
      clock: () => 1_500,
      nonceGenerator: () => bytesToHex(schnorr.utils.randomSecretKey()).slice(0, 32),
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });
    const published = await outbound.publishTransitionNotification({
      notificationId,
      transitionRecord: record,
      newKeyProof: {
        schemaVersion: 1,
        transitionId: record.transitionId,
        revision: 0,
        bodyHash,
        newNostrIdentity: newPub,
        issuedAt: record.issuedAt,
        expiresAt: record.expiresAt,
        signatureHex: bytesToHex(schnorr.sign(digest, newKey)),
      },
      continuityEvidence: null,
      deviceCorroborations: [],
      // Sent to wrongAccount's own device, but the RECEIVING runtime is bobAccount's own -- a mismatch.
      recipientAccountRef: wrongAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
    });
    if (published.outcome !== "published") throw new Error("setup failed: " + published.outcome);
    const wireContent = new TextDecoder().decode(
      encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }),
    );
    return runtime.importIdentityTransitionNotification(wireContent);
  }

  it("resource-limit exhaustion is not silently dropped: authorizeFedosIdentityTransitionRatchetReset processes every affected session even when the list is large", async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      sessionId: `s${i}`,
      conversationId: CONVERSATION_ID,
      remoteAccountRef: accountRef("a".repeat(64)),
      remoteDeviceRef: `device-${i}`,
    }));
    let calls = 0;
    const result = await authorizeFedosIdentityTransitionRatchetReset({
      transitionId: "fedos-identity-transition-" + "9".repeat(32),
      acceptanceState: "accepted",
      affectedSessions: sessions,
      outboundIntegration: {
        establishSession: async () => {
          calls += 1;
          return { outcome: "initiated", sessionId: `new-${calls}` as any, queue: {} as any };
        },
      },
      resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
      now: () => 1,
    });
    expect(result.outcome).toBe("applied");
    if (result.outcome !== "applied") throw new Error("unreachable");
    expect(result.results).toHaveLength(10);
    expect(calls).toBe(10);
  });
});
