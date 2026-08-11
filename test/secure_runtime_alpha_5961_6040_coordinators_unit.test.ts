import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { FedosIdentityTransitionInboundNotificationCoordinator } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_inbound_notification_coordinator.js";
import { InMemoryFedosIdentityTransitionPeerObservationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest, fedosIdentityTransitionContinuityProofDigest } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_canonical.js";
import type { FedosIdentityTransitionNewKeyProofV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_new_key_proof.js";
import type { FedosIdentityTransitionContinuityEvidenceV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_continuity_evidence.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "../src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

const CONVERSATION_ID = "conversation-1" as unknown as FedosConversationId;

function makeEnvironment() {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const bobDeviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
  const observationPersistence = new InMemoryFedosIdentityTransitionPeerObservationPersistence();
  let clockValue = 5_000;
  const clock = () => clockValue;
  return { signingAuthority, bobDeviceRegistry, observationPersistence, clock, advanceClock: (n: number) => (clockValue += n) };
}

async function makeSignedNewKeyProof(record: ReturnType<typeof createFedosIdentityTransitionRecordV1>, newKey: Uint8Array): Promise<FedosIdentityTransitionNewKeyProofV1> {
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const digest = fedosIdentityTransitionNewKeyProofDigest({
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
  return {
    schemaVersion: 1,
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    signatureHex: bytesToHex(schnorr.sign(digest, newKey)),
  };
}

async function makeSignedContinuityEvidence(record: ReturnType<typeof createFedosIdentityTransitionRecordV1>, oldKey: Uint8Array): Promise<FedosIdentityTransitionContinuityEvidenceV1> {
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const digest = fedosIdentityTransitionContinuityProofDigest({
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
  return {
    schemaVersion: 1,
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    signatureHex: bytesToHex(schnorr.sign(digest, oldKey)),
  };
}

function makeTransition(oldKey: Uint8Array, newKey: Uint8Array, now: number) {
  const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
  const newPub = bytesToHex(schnorr.getPublicKey(newKey));
  return createFedosIdentityTransitionRecordV1({
    transitionId: generateFedosIdentityTransitionId(),
    transitionType: "identity-replacement",
    oldAccountIdentity: accountRef(oldPub),
    newAccountIdentity: accountRef(newPub),
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    reasonCategory: "user-initiated-replacement",
    issuedAt: now,
    expiresAt: now + 1_000_000,
    revision: 0,
    previousTransitionId: null,
  });
}

describe("Outbound + Inbound Notification Coordinators (real Schnorr crypto, fake wire)", () => {
  it("delivers a real notification end to end and records a durable, evaluated observation", async () => {
    const env = makeEnvironment();
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const aliceIdentity = await env.signingAuthority.publicIdentityForAccount(0);
    const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
    const record = makeTransition(oldKey, newKey, env.clock());
    const newKeyProof = await makeSignedNewKeyProof(record, newKey);
    const continuityEvidence = await makeSignedContinuityEvidence(record, oldKey);

    env.bobDeviceRegistry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId: "bob-device-1",
      accountAuthority: "nostr",
      accountPublicIdentifier: "bob-pubkey",
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: 0,
    });
    env.bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-device-1", trustedAt: 1 });

    const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
      deviceRegistry: env.bobDeviceRegistry,
      signingAuthority: env.signingAuthority,
      accountIndex: 0,
      localAccountRef: aliceAccount,
      localDeviceRef: "alice-device-1",
      clock: env.clock,
      nonceGenerator: () => "a".repeat(32),
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });

    const bobAccount = accountRef("f".repeat(64));
    const outboundResult = await outbound.publishTransitionNotification({
      notificationId: "notif-1",
      transitionRecord: record,
      newKeyProof,
      continuityEvidence,
      deviceCorroborations: [],
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-device-1",
      conversationId: CONVERSATION_ID,
    });
    expect(outboundResult.outcome).toBe("published");
    if (outboundResult.outcome !== "published") throw new Error("unreachable");
    expect(outboundResult.relayOutcome).toBe("delivered");

    const content = new TextDecoder().decode(
      encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: outboundResult.notification }),
    );

    const inbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
      localAccountRef: bobAccount,
      localDeviceRef: "bob-device-1",
      clock: env.clock,
      observationPersistence: env.observationPersistence,
    });

    const inboundResult = await inbound.importRumorContent(content);
    expect(inboundResult.outcome).toBe("recorded");
    if (inboundResult.outcome !== "recorded") throw new Error("unreachable");
    // Real new-key proof AND real old-key continuity signature, both
    // independently re-verified by the receiver from the notification's
    // own embedded evidence — non-compromise reason + default local
    // policy reaches locally-acceptable.
    expect(inboundResult.evidenceOutcome).toBe("locally-acceptable");

    const observations = env.observationPersistence.listObservations();
    expect(observations).toHaveLength(1);
    expect(observations[0]?.evidenceOutcome).toBe("locally-acceptable");
  });

  it("rejects a notification with a tampered account signature", async () => {
    const env = makeEnvironment();
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const aliceAccount = accountRef((await env.signingAuthority.publicIdentityForAccount(0))!.publicKeyHex);
    const record = makeTransition(oldKey, newKey, env.clock());
    const newKeyProof = await makeSignedNewKeyProof(record, newKey);
    env.bobDeviceRegistry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId: "bob-device-1",
      accountAuthority: "nostr",
      accountPublicIdentifier: "bob-pubkey",
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: 0,
    });
    env.bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-device-1", trustedAt: 1 });

    const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
      deviceRegistry: env.bobDeviceRegistry,
      signingAuthority: env.signingAuthority,
      accountIndex: 0,
      localAccountRef: aliceAccount,
      localDeviceRef: "alice-device-1",
      clock: env.clock,
      nonceGenerator: () => "b".repeat(32),
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });
    const bobAccount = accountRef("f".repeat(64));
    const outboundResult = await outbound.publishTransitionNotification({
      notificationId: "notif-2",
      transitionRecord: record,
      newKeyProof,
      continuityEvidence: null,
      deviceCorroborations: [],
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-device-1",
      conversationId: CONVERSATION_ID,
    });
    if (outboundResult.outcome !== "published") throw new Error("unreachable");

    const tamperedNotification = { ...outboundResult.notification, transitionId: outboundResult.notification.transitionId };
    const tamperedEvent = { ...tamperedNotification.accountAuthorization.event, content: tamperedNotification.accountAuthorization.event.content.replace("a", "b") };
    const tampered = { ...tamperedNotification, accountAuthorization: { event: tamperedEvent } };
    const content = new TextDecoder().decode(
      encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: tampered as any }),
    );

    const inbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
      localAccountRef: bobAccount,
      localDeviceRef: "bob-device-1",
      clock: env.clock,
      observationPersistence: env.observationPersistence,
    });
    const inboundResult = await inbound.importRumorContent(content);
    expect(inboundResult.outcome).toBe("bad-account-signature");
  });

  it("rejects wrong recipient account/device", async () => {
    const env = makeEnvironment();
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const aliceAccount = accountRef((await env.signingAuthority.publicIdentityForAccount(0))!.publicKeyHex);
    const record = makeTransition(oldKey, newKey, env.clock());
    const newKeyProof = await makeSignedNewKeyProof(record, newKey);
    env.bobDeviceRegistry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId: "bob-device-1",
      accountAuthority: "nostr",
      accountPublicIdentifier: "bob-pubkey",
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: 0,
    });
    env.bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-device-1", trustedAt: 1 });

    const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
      deviceRegistry: env.bobDeviceRegistry,
      signingAuthority: env.signingAuthority,
      accountIndex: 0,
      localAccountRef: aliceAccount,
      localDeviceRef: "alice-device-1",
      clock: env.clock,
      nonceGenerator: () => "c".repeat(32),
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });
    const bobAccount = accountRef("f".repeat(64));
    const outboundResult = await outbound.publishTransitionNotification({
      notificationId: "notif-3",
      transitionRecord: record,
      newKeyProof,
      continuityEvidence: null,
      deviceCorroborations: [],
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-device-1",
      conversationId: CONVERSATION_ID,
    });
    if (outboundResult.outcome !== "published") throw new Error("unreachable");
    const content = new TextDecoder().decode(
      encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: outboundResult.notification }),
    );

    const wrongDeviceInbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
      localAccountRef: bobAccount,
      localDeviceRef: "bob-device-2",
      clock: env.clock,
      observationPersistence: env.observationPersistence,
    });
    expect((await wrongDeviceInbound.importRumorContent(content)).outcome).toBe("wrong-recipient-device");

    const wrongAccountInbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
      localAccountRef: accountRef("1".repeat(64)),
      localDeviceRef: "bob-device-1",
      clock: env.clock,
      observationPersistence: env.observationPersistence,
    });
    expect((await wrongAccountInbound.importRumorContent(content)).outcome).toBe("wrong-recipient-account");
  });

  it("preflight denies publish for an unknown recipient Device", async () => {
    const env = makeEnvironment();
    const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
      deviceRegistry: env.bobDeviceRegistry,
      signingAuthority: env.signingAuthority,
      accountIndex: 0,
      localAccountRef: accountRef("a".repeat(64)),
      localDeviceRef: "alice-device-1",
      clock: env.clock,
      nonceGenerator: () => "d".repeat(32),
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeTransition(oldKey, newKey, env.clock());
    const newKeyProof = await makeSignedNewKeyProof(record, newKey);
    const result = await outbound.publishTransitionNotification({
      notificationId: "notif-4",
      transitionRecord: record,
      newKeyProof,
      continuityEvidence: null,
      deviceCorroborations: [],
      recipientAccountRef: accountRef("f".repeat(64)),
      recipientDeviceRef: "never-registered-device",
      conversationId: CONVERSATION_ID,
    });
    expect(result.outcome).toBe("recipient-device-unknown");
  });

  it("stop() denies further publish attempts", async () => {
    const env = makeEnvironment();
    const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
      deviceRegistry: env.bobDeviceRegistry,
      signingAuthority: env.signingAuthority,
      accountIndex: 0,
      localAccountRef: accountRef("a".repeat(64)),
      localDeviceRef: "alice-device-1",
      clock: env.clock,
      nonceGenerator: () => "e".repeat(32),
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });
    outbound.stop();
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeTransition(oldKey, newKey, env.clock());
    const newKeyProof = await makeSignedNewKeyProof(record, newKey);
    const result = await outbound.publishTransitionNotification({
      notificationId: "notif-5",
      transitionRecord: record,
      newKeyProof,
      continuityEvidence: null,
      deviceCorroborations: [],
      recipientAccountRef: accountRef("f".repeat(64)),
      recipientDeviceRef: "bob-device-1",
      conversationId: CONVERSATION_ID,
    });
    expect(result.outcome).toBe("runtime-stopped");
  });

  it("rejects publishing evidence with an invalid new-key proof (never signs bad evidence onto the wire)", async () => {
    const env = makeEnvironment();
    env.bobDeviceRegistry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId: "bob-device-1",
      accountAuthority: "nostr",
      accountPublicIdentifier: "bob-pubkey",
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: 0,
    });
    const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
      deviceRegistry: env.bobDeviceRegistry,
      signingAuthority: env.signingAuthority,
      accountIndex: 0,
      localAccountRef: accountRef("a".repeat(64)),
      localDeviceRef: "alice-device-1",
      clock: env.clock,
      nonceGenerator: () => "f0".repeat(16),
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const wrongKey = schnorr.utils.randomSecretKey();
    const record = makeTransition(oldKey, newKey, env.clock());
    const badProof = await makeSignedNewKeyProof(record, wrongKey);
    const result = await outbound.publishTransitionNotification({
      notificationId: "notif-6",
      transitionRecord: record,
      newKeyProof: badProof,
      continuityEvidence: null,
      deviceCorroborations: [],
      recipientAccountRef: accountRef("f".repeat(64)),
      recipientDeviceRef: "bob-device-1",
      conversationId: CONVERSATION_ID,
    });
    expect(result.outcome).toBe("new-key-proof-invalid");
  });
});
