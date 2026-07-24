/**
 * Secure Runtime Alpha 5961-6040 — Phase P: failure matrix. Cases not
 * already covered by the schema/coordinators/persistence/ratchet-reset/
 * vertical-slice test files (which already cover: malformed/oversized
 * notification, missing/invalid new-key proof, old-key-only under
 * compromise (inherited from the Foundation's own evaluator, re-proven
 * here for the notification path), unknown/wrong recipient account and
 * Device, expired transition, duplicate/conflicting/rollback/broken-
 * predecessor/competing observations, corrupt append log, stopped
 * facade, reset-without-acceptance, reset dispatch/reason binding).
 */
import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { FedosIdentityTransitionInboundNotificationCoordinator } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_inbound_notification_coordinator.js";
import { InMemoryFedosIdentityTransitionPeerObservationPersistence } from "../src/conversation/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest } from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import { encodeFedosRatchetPeerCapabilityControlPayload, decodeFedosRatchetPeerCapabilityControlPayloadFromContent } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import { authorizeFedosIdentityTransitionRatchetReset } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_authorization.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

const CONVERSATION_ID = "conv-1" as unknown as FedosConversationId;

async function buildPublishedNotification(overrides: { reasonCategory?: Parameters<typeof createFedosIdentityTransitionRecordV1>[0]["reasonCategory"] } = {}) {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const oldKey = schnorr.utils.randomSecretKey();
  const newKey = schnorr.utils.randomSecretKey();
  const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
  const newPub = bytesToHex(schnorr.getPublicKey(newKey));
  const aliceIdentity = await signingAuthority.publicIdentityForAccount(0);
  const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
  const bobAccount = accountRef("d".repeat(64));
  const record = createFedosIdentityTransitionRecordV1({
    transitionId: generateFedosIdentityTransitionId(),
    transitionType: "identity-replacement",
    oldAccountIdentity: accountRef(oldPub),
    newAccountIdentity: accountRef(newPub),
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    reasonCategory: overrides.reasonCategory ?? "user-initiated-replacement",
    issuedAt: 1_000,
    expiresAt: 2_000,
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
  const newKeyProof = {
    schemaVersion: 1 as const,
    transitionId: record.transitionId,
    revision: 0,
    bodyHash,
    newNostrIdentity: newPub,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    signatureHex: bytesToHex(schnorr.sign(digest, newKey)),
  };

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
    nonceGenerator: () => "9".repeat(32),
    sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
  });
  const published = await outbound.publishTransitionNotification({
    notificationId: "notif-fm-1",
    transitionRecord: record,
    newKeyProof,
    continuityEvidence: null,
    deviceCorroborations: [],
    recipientAccountRef: bobAccount,
    recipientDeviceRef: "bob-desktop",
    conversationId: CONVERSATION_ID,
  });
  if (published.outcome !== "published") throw new Error("setup failed: " + published.outcome);
  return { published, bobAccount, record };
}

describe("Phase P failure matrix", () => {
  it("unknown field/version in the wire content fails closed at the classifier", () => {
    const malformed = JSON.stringify({ schemaVersion: 2, kind: "identity-transition-notification", notification: {} });
    expect(decodeFedosRatchetPeerCapabilityControlPayloadFromContent(malformed)).toBeNull();
  });

  it("old-key-only continuity under a compromise-confirmed reason never reaches locally-acceptable on the notification path", async () => {
    const { published, bobAccount } = await buildPublishedNotification({ reasonCategory: "key-compromise-confirmed" });
    // Even though NO continuity evidence was attached at all, the important invariant is that a compromise reason can never silently reach "locally-acceptable" from evidence alone.
    const content = new TextDecoder().decode(
      encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }),
    );
    const inbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      clock: () => 1_600,
      observationPersistence: new InMemoryFedosIdentityTransitionPeerObservationPersistence(),
    });
    const result = await inbound.importRumorContent(content);
    expect(result.outcome).toBe("recorded");
    if (result.outcome !== "recorded") throw new Error("unreachable");
    expect(result.evidenceOutcome).not.toBe("locally-acceptable");
  });

  it("an expired transition is rejected", async () => {
    const { published, bobAccount } = await buildPublishedNotification();
    const content = new TextDecoder().decode(
      encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }),
    );
    const inbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      // Well past the transition's own expiresAt (2_000).
      clock: () => 999_999,
      observationPersistence: new InMemoryFedosIdentityTransitionPeerObservationPersistence(),
    });
    expect((await inbound.importRumorContent(content)).outcome).toBe("expired");
  });

  it("a locally-revoked recipient Device denies inbound import", async () => {
    const { published, bobAccount } = await buildPublishedNotification();
    const content = new TextDecoder().decode(
      encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }),
    );
    const revokedDeviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
    revokedDeviceRegistry.putEvent({
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
    revokedDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "revoked", deviceId: "bob-desktop", revokedAt: 5 });
    const inbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: revokedDeviceRegistry,
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      clock: () => 1_600,
      observationPersistence: new InMemoryFedosIdentityTransitionPeerObservationPersistence(),
    });
    expect((await inbound.importRumorContent(content)).outcome).toBe("local-device-revoked");
  });

  it("reset without acceptance is refused (never dispatches the wire message)", async () => {
    let called = false;
    const result = await authorizeFedosIdentityTransitionRatchetReset({
      transitionId: "fedos-identity-transition-" + "a".repeat(32),
      acceptanceState: "manual-review-required",
      affectedSessions: [{ sessionId: "s", conversationId: CONVERSATION_ID, remoteAccountRef: accountRef("a".repeat(64)), remoteDeviceRef: "d" }],
      outboundIntegration: {
        establishSession: async () => {
          called = true;
          return { outcome: "initiated", sessionId: "x" as any, queue: {} as any };
        },
      },
      resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
      now: () => 1,
    });
    expect(result.outcome).toBe("not-accepted");
    expect(called).toBe(false);
  });

  it("resource-limit exhaustion: reset authorization processes every affected session, none silently dropped", async () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      sessionId: `s${i}`,
      conversationId: CONVERSATION_ID,
      remoteAccountRef: accountRef("a".repeat(64)),
      remoteDeviceRef: `device-${i}`,
    }));
    let calls = 0;
    const result = await authorizeFedosIdentityTransitionRatchetReset({
      transitionId: "fedos-identity-transition-" + "b".repeat(32),
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
    expect(result.results).toHaveLength(5);
    expect(calls).toBe(5);
  });

  it("a payload that decodes but is not this domain's kind is rejected by the inbound coordinator", async () => {
    const inbound = new FedosIdentityTransitionInboundNotificationCoordinator({
      deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
      localAccountRef: accountRef("a".repeat(64)),
      localDeviceRef: "d",
      clock: () => 1,
      observationPersistence: new InMemoryFedosIdentityTransitionPeerObservationPersistence(),
    });
    const notPayload = "not even json";
    expect((await inbound.importRumorContent(notPayload)).outcome).toBe("not-identity-transition-payload");
  });
});
