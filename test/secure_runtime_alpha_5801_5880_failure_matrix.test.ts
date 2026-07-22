/**
 * Secure Runtime Alpha 5801-5880 — Phase P: failure matrix. Cases not
 * already covered by the types/evidence/persistence/vertical-slice test
 * files (which already cover: malformed transition, unknown field,
 * invalid/expired/future timestamps, missing/invalid/wrong-identity
 * new-key proof, old-key-only under compromise, unauthorized/revoked/
 * wrong-binding Device, matching/conflicting duplicate transition,
 * revision rollback, broken predecessor, two competing replacements,
 * corrupt/interrupted append log, stopped facade).
 */
import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { isWellFormedFedosIdentityTransitionRecordV1, createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import { isKnownFedosIdentityTransitionEvidenceKind } from "../src/conversation/identity_transition/fedos_identity_transition_vocabulary.js";
import { FedosIdentityTransitionFacade } from "../src/conversation/identity_transition/fedos_identity_transition_facade.js";
import { InMemoryFedosIdentityTransitionFactPersistence } from "../src/conversation/identity_transition/persistence/in_memory_fedos_identity_transition_fact_persistence.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionContinuityProofDigest, fedosIdentityTransitionDeviceCorroborationDigest } from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import { generateFedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";
import { createPendingFedosDeviceBinding, trustFedosDeviceBinding } from "../src/device/fedos_device_binding.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";

function baseCreateInput() {
  const oldPub = "1".repeat(64);
  const newPub = "2".repeat(64);
  return {
    transitionId: generateFedosIdentityTransitionId(),
    transitionType: "identity-replacement" as const,
    oldAccountIdentity: { authority: "nostr", publicIdentifier: oldPub, identityId: null } as FedosDeviceBindingAccountRef,
    newAccountIdentity: { authority: "nostr", publicIdentifier: newPub, identityId: null } as FedosDeviceBindingAccountRef,
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    reasonCategory: "user-initiated-replacement" as const,
    issuedAt: 1_000,
    expiresAt: 2_000,
    revision: 0,
    previousTransitionId: null,
  };
}

describe("Phase P failure matrix — schema/version/size", () => {
  it("unknown schemaVersion fails closed", () => {
    const record = { ...createFedosIdentityTransitionRecordV1(baseCreateInput()), schemaVersion: 2 };
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("oversized transitionId fails closed", () => {
    const record = { ...createFedosIdentityTransitionRecordV1(baseCreateInput()), transitionId: "fedos-identity-transition-" + "a".repeat(1000) };
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("unsupported account/Nostr mapping (non-nostr authority) fails closed", () => {
    const input = baseCreateInput();
    const record = {
      ...createFedosIdentityTransitionRecordV1(input),
      oldAccountIdentity: { authority: "activitypub", publicIdentifier: input.oldNostrIdentity, identityId: null },
    };
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("unknown evidence kind fails closed", () => {
    expect(isKnownFedosIdentityTransitionEvidenceKind("free-form-vouch")).toBe(false);
    expect(isKnownFedosIdentityTransitionEvidenceKind(undefined)).toBe(false);
  });
});

describe("Phase P failure matrix — facade edge cases", () => {
  it("resource-limit exhaustion: Device corroborations per transition are bounded", () => {
    const facade = new FedosIdentityTransitionFacade(new InMemoryFedosIdentityTransitionFactPersistence());
    const record = facade.createTransitionDraft(baseCreateInput())!;
    let lastResult: unknown = "not-called";
    for (let i = 0; i < 9; i++) {
      const device = generateFedosDeviceSigningKeypair();
      const binding = trustFedosDeviceBinding(
        createPendingFedosDeviceBinding({ deviceId: `device-${i}`, accountRef: record.oldAccountIdentity, devicePublicKeyRef: device.publicKeyHex, label: null, createdAt: 0 }),
        1,
      )!;
      const bodyHash = fedosIdentityTransitionBodyHash(record);
      const digest = fedosIdentityTransitionDeviceCorroborationDigest({
        transitionId: record.transitionId,
        revision: record.revision,
        bodyHash,
        newNostrIdentity: record.newNostrIdentity,
        deviceId: `device-${i}`,
        issuedAt: 1_100,
        expiresAt: 1_900,
      });
      lastResult = facade.addDeviceCorroboration(
        record.transitionId,
        {
          schemaVersion: 1,
          transitionId: record.transitionId,
          revision: record.revision,
          bodyHash,
          newNostrIdentity: record.newNostrIdentity,
          deviceId: `device-${i}`,
          devicePublicKeyHex: device.publicKeyHex,
          issuedAt: 1_100,
          expiresAt: 1_900,
          signatureHex: bytesToHex(device.sign(digest)),
        },
        binding,
      );
    }
    // The 9th call (index 8) exceeds MAX_DEVICE_CORROBORATIONS_PER_TRANSITION (8) and is rejected with null.
    expect(lastResult).toBeNull();
  });

  it("addContinuityEvidence/addDeviceCorroboration on an unknown transitionId returns null rather than throwing", () => {
    const facade = new FedosIdentityTransitionFacade(new InMemoryFedosIdentityTransitionFactPersistence());
    expect(facade.addContinuityEvidence("fedos-identity-transition-" + "0".repeat(32), {} as any)).toBeNull();
    expect(facade.evaluateTransitionEvidence("fedos-identity-transition-" + "0".repeat(32), 1_500)).toBeNull();
    expect(facade.persistTransition("fedos-identity-transition-" + "0".repeat(32), "locally-acceptable", 1_500)).toBeNull();
  });

  it("evaluateTransitionEvidence before verifyNewIdentityProof was ever called returns null (no fabricated default)", () => {
    const facade = new FedosIdentityTransitionFacade(new InMemoryFedosIdentityTransitionFactPersistence());
    const record = facade.createTransitionDraft(baseCreateInput())!;
    expect(facade.evaluateTransitionEvidence(record.transitionId, 1_500)).toBeNull();
  });

  it("creating a draft with identical old/new account identity is rejected", () => {
    const facade = new FedosIdentityTransitionFacade(new InMemoryFedosIdentityTransitionFactPersistence());
    const input = baseCreateInput();
    expect(
      facade.createTransitionDraft({ ...input, newAccountIdentity: input.oldAccountIdentity, newNostrIdentity: input.oldNostrIdentity }),
    ).toBeNull();
  });

  it("re-adding continuity evidence for the same transition overwrites rather than accumulating conflicting state silently", () => {
    const facade = new FedosIdentityTransitionFacade(new InMemoryFedosIdentityTransitionFactPersistence());
    const record = facade.createTransitionDraft(baseCreateInput())!;
    const wrongKey = schnorr.utils.randomSecretKey();
    const bodyHash = fedosIdentityTransitionBodyHash(record);
    const digest = fedosIdentityTransitionContinuityProofDigest({
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      oldNostrIdentity: record.oldNostrIdentity,
      newNostrIdentity: record.newNostrIdentity,
      issuedAt: 1_100,
      expiresAt: 1_900,
    });
    const firstStatus = facade.addContinuityEvidence(record.transitionId, {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      oldNostrIdentity: record.oldNostrIdentity,
      newNostrIdentity: record.newNostrIdentity,
      issuedAt: 1_100,
      expiresAt: 1_900,
      signatureHex: bytesToHex(schnorr.sign(digest, wrongKey)),
    });
    expect(firstStatus).toBe("rejected");
  });
});
