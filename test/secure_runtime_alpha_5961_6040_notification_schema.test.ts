import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalSerializeFedosIdentityTransitionNotificationContent,
  isWellFormedFedosIdentityTransitionNotificationV1,
  isWellFormedFedosIdentityTransitionNotificationSignableContent,
  reconstructFedosIdentityTransitionRecordFromNotification,
  encodeFedosIdentityTransitionNotificationV1,
  decodeFedosIdentityTransitionNotificationV1,
  FEDOS_IDENTITY_TRANSITION_NOTIFICATION_MAX_DEVICE_CORROBORATIONS,
  type FedosIdentityTransitionNotificationV1,
} from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_notification.js";
import {
  isWellFormedFedosRatchetPeerCapabilityControlPayload,
  encodeFedosRatchetPeerCapabilityControlPayload,
  decodeFedosRatchetPeerCapabilityControlPayloadFromContent,
} from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import { isKnownFedosRatchetLifecycleCapability } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import { isWellFormedFedosDirectRatchetSessionResetReason } from "../src/conversation/ratchet/fedos_direct_ratchet_session_reset_reason.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest } from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

function realNotification(): FedosIdentityTransitionNotificationV1 {
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
    expiresAt: 100_000,
    revision: 0,
    previousTransitionId: null,
  });
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const proofDigest = fedosIdentityTransitionNewKeyProofDigest({
    transitionId: record.transitionId,
    revision: 0,
    bodyHash,
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    issuedAt: 1_100,
    expiresAt: 1_900,
  });
  const signerKey = schnorr.utils.randomSecretKey();
  const signerPub = bytesToHex(schnorr.getPublicKey(signerKey));

  const content = {
    notificationId: "notif-1",
    transitionId: record.transitionId,
    oldAccountIdentity: record.oldAccountIdentity,
    newAccountIdentity: record.newAccountIdentity,
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    reasonCategory: record.reasonCategory,
    revision: 0,
    previousTransitionId: null,
    transitionBodyHash: bodyHash,
    senderAccountRef: accountRef(signerPub),
    senderDeviceRef: "sender-device-1",
    recipientAccountRef: accountRef("f".repeat(64)),
    recipientDeviceRef: "recipient-device-1",
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    nonce: "a".repeat(32),
    evidence: {
      newKeyProof: {
        schemaVersion: 1 as const,
        transitionId: record.transitionId,
        revision: 0,
        bodyHash,
        newNostrIdentity: newPub,
        issuedAt: 1_100,
        expiresAt: 1_900,
        signatureHex: bytesToHex(schnorr.sign(proofDigest, newKey)),
      },
      continuityEvidence: null,
      deviceCorroborations: [],
    },
  };
  const canonicalContent = canonicalSerializeFedosIdentityTransitionNotificationContent(content);
  const digest = sha256(new TextEncoder().encode(canonicalContent));
  const id = bytesToHex(digest);
  const sig = bytesToHex(schnorr.sign(digest, signerKey));
  return {
    schemaVersion: 1,
    ...content,
    accountAuthorization: {
      event: {
        id,
        pubkey: signerPub,
        created_at: 1_100,
        kind: 1,
        tags: [["t", "fedos-ratchet-peer-capability-v1"]],
        content: canonicalContent,
        sig,
      },
    },
    deviceSignatureHex: null,
    capabilityVersion: 1,
  };
}

describe("Phase B — notification schema", () => {
  it("accepts a well-formed notification and its standalone signable content", () => {
    const notification = realNotification();
    expect(isWellFormedFedosIdentityTransitionNotificationV1(notification)).toBe(true);
    const { schemaVersion, accountAuthorization, deviceSignatureHex, capabilityVersion, ...content } = notification;
    void schemaVersion;
    void accountAuthorization;
    void deviceSignatureHex;
    void capabilityVersion;
    expect(isWellFormedFedosIdentityTransitionNotificationSignableContent(content)).toBe(true);
  });

  it("rejects an unknown extra field", () => {
    const notification = { ...realNotification(), extra: "field" };
    expect(isWellFormedFedosIdentityTransitionNotificationV1(notification)).toBe(false);
  });

  it("rejects a missing field", () => {
    const { nonce, ...withoutNonce } = realNotification() as any;
    void nonce;
    expect(isWellFormedFedosIdentityTransitionNotificationV1(withoutNonce)).toBe(false);
  });

  it("rejects more device corroborations than the bound", () => {
    const notification = realNotification();
    const oneCorroboration = {
      schemaVersion: 1 as const,
      transitionId: notification.transitionId,
      revision: 0,
      bodyHash: notification.transitionBodyHash,
      newNostrIdentity: notification.newNostrIdentity,
      deviceId: "d",
      devicePublicKeyHex: "a".repeat(64),
      issuedAt: 1_100,
      expiresAt: 1_900,
      signatureHex: "a".repeat(128),
    };
    const tooMany = Array.from({ length: FEDOS_IDENTITY_TRANSITION_NOTIFICATION_MAX_DEVICE_CORROBORATIONS + 1 }, () => oneCorroboration);
    const withTooMany = { ...notification, evidence: { ...notification.evidence, deviceCorroborations: tooMany } };
    expect(isWellFormedFedosIdentityTransitionNotificationV1(withTooMany)).toBe(false);
  });

  it("round-trips through encode/decode", () => {
    const notification = realNotification();
    const decoded = decodeFedosIdentityTransitionNotificationV1(encodeFedosIdentityTransitionNotificationV1(notification));
    expect(decoded).toEqual(notification);
  });

  it("decode fails closed on malformed JSON", () => {
    expect(decodeFedosIdentityTransitionNotificationV1("{not json")).toBeNull();
  });

  it("reconstructs a valid transition record whose bodyHash matches, and rejects a tampered bodyHash", () => {
    const notification = realNotification();
    const record = reconstructFedosIdentityTransitionRecordFromNotification(notification);
    expect(record).not.toBeNull();
    expect(fedosIdentityTransitionBodyHash(record!)).toBe(notification.transitionBodyHash);

    const tampered = { ...notification, transitionBodyHash: "0".repeat(64) };
    expect(reconstructFedosIdentityTransitionRecordFromNotification(tampered)).toBeNull();
  });
});

describe("Phase B — control payload third kind", () => {
  it("recognizes the new identity-transition-notification kind", () => {
    const notification = realNotification();
    const payload = { schemaVersion: 1 as const, kind: "identity-transition-notification" as const, notification };
    expect(isWellFormedFedosRatchetPeerCapabilityControlPayload(payload)).toBe(true);
    const roundTripped = decodeFedosRatchetPeerCapabilityControlPayloadFromContent(new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload(payload)));
    expect(roundTripped).toEqual(payload);
  });

  it("still rejects an unknown kind", () => {
    expect(isWellFormedFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "something-else" })).toBe(false);
  });
});

describe("Phase H — capability vocabulary extension", () => {
  it("recognizes the new identity-transition-v1 lifecycle capability", () => {
    expect(isKnownFedosRatchetLifecycleCapability("identity-transition-v1")).toBe(true);
  });
});

describe("Phase I/J — session reset reason vocabulary extension", () => {
  it("recognizes the new identity-transition reset reason", () => {
    expect(isWellFormedFedosDirectRatchetSessionResetReason("identity-transition")).toBe(true);
  });

  it("still rejects an unknown reason", () => {
    expect(isWellFormedFedosDirectRatchetSessionResetReason("something-else")).toBe(false);
  });
});
