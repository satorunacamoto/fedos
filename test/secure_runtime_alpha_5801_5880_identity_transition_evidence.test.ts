import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest, fedosIdentityTransitionContinuityProofDigest, fedosIdentityTransitionDeviceCorroborationDigest } from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import { verifyFedosIdentityTransitionNewKeyProof, type FedosIdentityTransitionNewKeyProofV1 } from "../src/conversation/identity_transition/fedos_identity_transition_new_key_proof.js";
import { verifyFedosIdentityTransitionContinuityEvidence, type FedosIdentityTransitionContinuityEvidenceV1 } from "../src/conversation/identity_transition/fedos_identity_transition_continuity_evidence.js";
import { verifyFedosIdentityTransitionDeviceCorroboration, type FedosIdentityTransitionDeviceCorroborationV1 } from "../src/conversation/identity_transition/fedos_identity_transition_device_corroboration.js";
import { generateFedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";
import { createPendingFedosDeviceBinding, trustFedosDeviceBinding, revokeFedosDeviceBinding } from "../src/device/fedos_device_binding.js";
import {
  evaluateFedosIdentityTransitionEvidence,
  FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY,
  type FedosIdentityTransitionEvidenceEvaluationInput,
} from "../src/conversation/identity_transition/fedos_identity_transition_evidence_evaluation.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

function makeRecord(oldKey: Uint8Array, newKey: Uint8Array, reasonCategory: Parameters<typeof createFedosIdentityTransitionRecordV1>[0]["reasonCategory"] = "user-initiated-replacement") {
  const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
  const newPub = bytesToHex(schnorr.getPublicKey(newKey));
  return createFedosIdentityTransitionRecordV1({
    transitionId: generateFedosIdentityTransitionId(),
    transitionType: "identity-replacement",
    oldAccountIdentity: accountRef(oldPub),
    newAccountIdentity: accountRef(newPub),
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    reasonCategory,
    issuedAt: 1_000,
    expiresAt: 2_000,
    revision: 0,
    previousTransitionId: null,
  });
}

function realNewKeyProof(record: ReturnType<typeof makeRecord>, newKey: Uint8Array): FedosIdentityTransitionNewKeyProofV1 {
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const digest = fedosIdentityTransitionNewKeyProofDigest({
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: 1_100,
    expiresAt: 1_900,
  });
  return {
    schemaVersion: 1,
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: 1_100,
    expiresAt: 1_900,
    signatureHex: bytesToHex(schnorr.sign(digest, newKey)),
  };
}

function realContinuityEvidence(record: ReturnType<typeof makeRecord>, oldKey: Uint8Array): FedosIdentityTransitionContinuityEvidenceV1 {
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
  return {
    schemaVersion: 1,
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: 1_100,
    expiresAt: 1_900,
    signatureHex: bytesToHex(schnorr.sign(digest, oldKey)),
  };
}

describe("Phase F — new-key proof of possession (real Schnorr signatures)", () => {
  it("verifies a genuine proof signed by the new key", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    expect(verifyFedosIdentityTransitionNewKeyProof(record, realNewKeyProof(record, newKey))).toBe(true);
  });

  it("rejects a proof signed by the WRONG key", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const wrongKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    const proof = realNewKeyProof(record, wrongKey);
    expect(verifyFedosIdentityTransitionNewKeyProof(record, proof)).toBe(false);
  });

  it("rejects a proof after the transition body was mutated (bodyHash mismatch)", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    const proof = realNewKeyProof(record, newKey);
    const mutatedRecord = { ...record, reasonCategory: "identity-lost" as const };
    expect(verifyFedosIdentityTransitionNewKeyProof(mutatedRecord, proof)).toBe(false);
  });

  it("rejects a proof for the wrong transitionId/revision", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    const proof = { ...realNewKeyProof(record, newKey), transitionId: generateFedosIdentityTransitionId() };
    expect(verifyFedosIdentityTransitionNewKeyProof(record, proof)).toBe(false);
  });
});

describe("Phase G — old-identity continuity evidence (real Schnorr signatures)", () => {
  it("is cryptographically-valid alone does not imply acceptance says the caller's own docs (unit here just checks the raw verdict)", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    expect(verifyFedosIdentityTransitionContinuityEvidence(record, realContinuityEvidence(record, oldKey))).toBe("cryptographically-valid");
  });

  it("rejects a continuity signature from the wrong (non-old) key", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const wrongKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    expect(verifyFedosIdentityTransitionContinuityEvidence(record, realContinuityEvidence(record, wrongKey))).toBe("rejected");
  });

  it("returns unverifiable for a structurally malformed evidence object", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    expect(verifyFedosIdentityTransitionContinuityEvidence(record, { not: "well-formed" } as any)).toBe("unverifiable");
  });
});

describe("Phase H — Device corroboration", () => {
  it("verifies a genuine corroboration from a trusted Device bound to the OLD account", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    const device = generateFedosDeviceSigningKeypair();
    let binding = createPendingFedosDeviceBinding({
      deviceId: "device-1",
      accountRef: record.oldAccountIdentity,
      devicePublicKeyRef: device.publicKeyHex,
      label: null,
      createdAt: 500,
    });
    binding = trustFedosDeviceBinding(binding, 600)!;

    const bodyHash = fedosIdentityTransitionBodyHash(record);
    const digest = fedosIdentityTransitionDeviceCorroborationDigest({
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      issuedAt: 1_100,
      expiresAt: 1_900,
    });
    const corroboration: FedosIdentityTransitionDeviceCorroborationV1 = {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      devicePublicKeyHex: device.publicKeyHex,
      issuedAt: 1_100,
      expiresAt: 1_900,
      signatureHex: bytesToHex(device.sign(digest)),
    };
    expect(verifyFedosIdentityTransitionDeviceCorroboration(record, corroboration, binding)).toBe("cryptographically-valid");
  });

  it("fails closed for a REVOKED Device even with a valid signature", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    const device = generateFedosDeviceSigningKeypair();
    let binding = createPendingFedosDeviceBinding({
      deviceId: "device-1",
      accountRef: record.oldAccountIdentity,
      devicePublicKeyRef: device.publicKeyHex,
      label: null,
      createdAt: 500,
    });
    binding = trustFedosDeviceBinding(binding, 600)!;
    binding = revokeFedosDeviceBinding(binding, 700)!;

    const bodyHash = fedosIdentityTransitionBodyHash(record);
    const digest = fedosIdentityTransitionDeviceCorroborationDigest({
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      issuedAt: 1_100,
      expiresAt: 1_900,
    });
    const corroboration: FedosIdentityTransitionDeviceCorroborationV1 = {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      devicePublicKeyHex: device.publicKeyHex,
      issuedAt: 1_100,
      expiresAt: 1_900,
      signatureHex: bytesToHex(device.sign(digest)),
    };
    expect(verifyFedosIdentityTransitionDeviceCorroboration(record, corroboration, binding)).toBe("unverifiable");
  });

  it("fails closed for an UNKNOWN/untrusted (pending) Device", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    const device = generateFedosDeviceSigningKeypair();
    const binding = createPendingFedosDeviceBinding({
      deviceId: "device-1",
      accountRef: record.oldAccountIdentity,
      devicePublicKeyRef: device.publicKeyHex,
      label: null,
      createdAt: 500,
    });
    const bodyHash = fedosIdentityTransitionBodyHash(record);
    const digest = fedosIdentityTransitionDeviceCorroborationDigest({
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      issuedAt: 1_100,
      expiresAt: 1_900,
    });
    const corroboration: FedosIdentityTransitionDeviceCorroborationV1 = {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      devicePublicKeyHex: device.publicKeyHex,
      issuedAt: 1_100,
      expiresAt: 1_900,
      signatureHex: bytesToHex(device.sign(digest)),
    };
    expect(verifyFedosIdentityTransitionDeviceCorroboration(record, corroboration, binding)).toBe("unverifiable");
  });

  it("fails closed when the Device is bound to a DIFFERENT account", () => {
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const record = makeRecord(oldKey, newKey);
    const device = generateFedosDeviceSigningKeypair();
    let binding = createPendingFedosDeviceBinding({
      deviceId: "device-1",
      accountRef: accountRef("f".repeat(64)),
      devicePublicKeyRef: device.publicKeyHex,
      label: null,
      createdAt: 500,
    });
    binding = trustFedosDeviceBinding(binding, 600)!;
    const bodyHash = fedosIdentityTransitionBodyHash(record);
    const digest = fedosIdentityTransitionDeviceCorroborationDigest({
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      issuedAt: 1_100,
      expiresAt: 1_900,
    });
    const corroboration: FedosIdentityTransitionDeviceCorroborationV1 = {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "device-1",
      devicePublicKeyHex: device.publicKeyHex,
      issuedAt: 1_100,
      expiresAt: 1_900,
      signatureHex: bytesToHex(device.sign(digest)),
    };
    expect(verifyFedosIdentityTransitionDeviceCorroboration(record, corroboration, binding)).toBe("unverifiable");
  });
});

describe("Phase I — evidence evaluation: the two hard invariants", () => {
  const baseInput: FedosIdentityTransitionEvidenceEvaluationInput = {
    structurallyValid: true,
    transitionType: "identity-replacement",
    reasonCategory: "user-initiated-replacement",
    timestampCheck: "ok",
    historyOutcome: "none",
    newKeyProofValid: true,
    continuityEvidenceStatus: "cryptographically-valid",
    deviceCorroborationStatuses: [],
    manualVerificationConfirmed: false,
    localPolicy: FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY,
  };

  it("invariant 1: does not auto-accept merely because all signatures parse — non-compromise, old-key-only, policy set to NOT auto-accept", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({
      ...baseInput,
      localPolicy: { autoAcceptOldKeyContinuity: false },
    });
    expect(outcome).toBe("continuity-old-key-only");
    expect(outcome).not.toBe("locally-acceptable");
  });

  it("invariant 2: a compromise-confirmed reason never treats the old signature alone as sufficient", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({
      ...baseInput,
      reasonCategory: "key-compromise-confirmed",
    });
    expect(outcome).toBe("manual-verification-required");
    expect(outcome).not.toBe("locally-acceptable");
    expect(outcome).not.toBe("device-corroborated");
  });

  it("Device corroboration changes the evidence level under compromise but is still not an automatic accept (not a quorum)", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({
      ...baseInput,
      reasonCategory: "key-compromise-confirmed",
      deviceCorroborationStatuses: ["cryptographically-valid"],
    });
    expect(outcome).toBe("device-corroborated");
    expect(outcome).not.toBe("locally-acceptable");
  });

  it("non-compromise + old-key-only + default policy (auto-accept true) IS locally-acceptable", () => {
    expect(evaluateFedosIdentityTransitionEvidence(baseInput)).toBe("locally-acceptable");
  });

  it("no continuity evidence at all, but Device corroboration present (identity-lost path) still reaches device-corroborated", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({
      ...baseInput,
      reasonCategory: "identity-lost",
      continuityEvidenceStatus: "absent",
      deviceCorroborationStatuses: ["cryptographically-valid"],
    });
    expect(outcome).toBe("device-corroborated");
  });

  it("no continuity evidence and no Device corroboration at all is continuity-unproven, never accepted", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({
      ...baseInput,
      continuityEvidenceStatus: "absent",
    });
    expect(outcome).toBe("continuity-unproven");
  });

  it("new-key proof invalid short-circuits to new-key-unproven regardless of continuity", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({ ...baseInput, newKeyProofValid: false });
    expect(outcome).toBe("new-key-unproven");
  });

  it("an explicit manual verification fact reaches locally-acceptable even under compromise", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({
      ...baseInput,
      reasonCategory: "key-compromise-confirmed",
      manualVerificationConfirmed: true,
    });
    expect(outcome).toBe("locally-acceptable");
  });

  it("structurally invalid always wins over everything else", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({ ...baseInput, structurallyValid: false, manualVerificationConfirmed: true });
    expect(outcome).toBe("invalid");
  });

  it("continuity-claim transitionType is unsupported by this Arc's evaluation path", () => {
    const outcome = evaluateFedosIdentityTransitionEvidence({ ...baseInput, transitionType: "continuity-claim" });
    expect(outcome).toBe("unsupported");
  });

  it("history-derived facts (rollback/conflict/superseded/stale) take priority over fresh evidence", () => {
    expect(evaluateFedosIdentityTransitionEvidence({ ...baseInput, historyOutcome: "rollback-detected" })).toBe("rollback-detected");
    expect(evaluateFedosIdentityTransitionEvidence({ ...baseInput, historyOutcome: "conflicting" })).toBe("conflicting");
    expect(evaluateFedosIdentityTransitionEvidence({ ...baseInput, historyOutcome: "superseded" })).toBe("superseded");
    expect(evaluateFedosIdentityTransitionEvidence({ ...baseInput, historyOutcome: "stale" })).toBe("stale");
  });

  it("expired vs future-issued-beyond-skew map to distinct outcomes", () => {
    expect(evaluateFedosIdentityTransitionEvidence({ ...baseInput, timestampCheck: "expired" })).toBe("stale");
    expect(evaluateFedosIdentityTransitionEvidence({ ...baseInput, timestampCheck: "future-issued-beyond-skew" })).toBe("invalid");
  });
});
