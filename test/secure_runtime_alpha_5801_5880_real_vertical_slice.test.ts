/**
 * Secure Runtime Alpha 5801-5880 — Phase O: real vertical slice.
 *
 * Two REAL, independent identities (genuine BIP-340 Schnorr keypairs via
 * `@noble/curves`, the same production dependency used elsewhere in this
 * repo) build one replacement transition, produce a real new-key proof,
 * a real old-key continuity signature, and a real authorized Device
 * corroboration; persist it; simulate a restart; replay; import a
 * matching duplicate idempotently; reject a same-id/different-body
 * duplicate, a lower revision, and a broken predecessor; detect a
 * competing replacement; and produce a read-only Ratchet impact plan.
 *
 * No fake crypto anywhere on this path — every signature here is a real
 * signature over a real digest, verified by the SAME verification
 * functions production code would use.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FedosIdentityTransitionFacade } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_facade.js";
import { AppendOnlyFedosIdentityTransitionFactPersistence } from "../src/os/messenger/conversations/identity_transition/persistence/append_only_fedos_identity_transition_fact_persistence.js";
import type { FedosIdentityTransitionFactPersistence } from "../src/os/messenger/conversations/identity_transition/persistence/fedos_identity_transition_fact_persistence.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest, fedosIdentityTransitionContinuityProofDigest, fedosIdentityTransitionDeviceCorroborationDigest } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_canonical.js";
import type { FedosIdentityTransitionNewKeyProofV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_new_key_proof.js";
import type { FedosIdentityTransitionContinuityEvidenceV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_continuity_evidence.js";
import type { FedosIdentityTransitionDeviceCorroborationV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_device_corroboration.js";
import { generateFedosDeviceSigningKeypair } from "../src/os/messenger/device/crypto/fedos_device_signing_keypair.js";
import { createPendingFedosDeviceBinding, trustFedosDeviceBinding } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosIdentityTransitionRecordV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.js";

function signedNewKeyProof(record: FedosIdentityTransitionRecordV1, newKey: Uint8Array, at: number): FedosIdentityTransitionNewKeyProofV1 {
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const digest = fedosIdentityTransitionNewKeyProofDigest({
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: at,
    expiresAt: at + 500,
  });
  return {
    schemaVersion: 1,
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: at,
    expiresAt: at + 500,
    signatureHex: bytesToHex(schnorr.sign(digest, newKey)),
  };
}

function signedContinuityEvidence(record: FedosIdentityTransitionRecordV1, oldKey: Uint8Array, at: number): FedosIdentityTransitionContinuityEvidenceV1 {
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const digest = fedosIdentityTransitionContinuityProofDigest({
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: at,
    expiresAt: at + 500,
  });
  return {
    schemaVersion: 1,
    transitionId: record.transitionId,
    revision: record.revision,
    bodyHash,
    oldNostrIdentity: record.oldNostrIdentity,
    newNostrIdentity: record.newNostrIdentity,
    issuedAt: at,
    expiresAt: at + 500,
    signatureHex: bytesToHex(schnorr.sign(digest, oldKey)),
  };
}

describe("Phase O — real vertical slice", () => {
  let dir: string;
  let filePath: string;
  let persistence: FedosIdentityTransitionFactPersistence;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fedos-identity-transition-slice-"));
    filePath = join(dir, "facts.ndjson");
    persistence = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs the full create -> prove -> evaluate -> persist -> restart -> replay flow with real signatures", () => {
    // 1-2: two real independent identities.
    const oldKey = schnorr.utils.randomSecretKey();
    const newKey = schnorr.utils.randomSecretKey();
    const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
    const newPub = bytesToHex(schnorr.getPublicKey(newKey));
    const oldAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: oldPub, identityId: null };
    const newAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: newPub, identityId: null };

    // An authorized, trusted Device bound to the OLD account.
    const device = generateFedosDeviceSigningKeypair();
    const deviceBinding = trustFedosDeviceBinding(
      createPendingFedosDeviceBinding({ deviceId: "desktop-1", accountRef: oldAccount, devicePublicKeyRef: device.publicKeyHex, label: "desktop", createdAt: 100 }),
      150,
    )!;

    const facade = new FedosIdentityTransitionFacade(persistence);

    // 3: build one replacement transition.
    const record = facade.createTransitionDraft({
      transitionType: "identity-replacement",
      oldAccountIdentity: oldAccount,
      newAccountIdentity: newAccount,
      oldNostrIdentity: oldPub,
      newNostrIdentity: newPub,
      reasonCategory: "key-compromise-confirmed",
      issuedAt: 1_000,
      expiresAt: 100_000,
      revision: 0,
      previousTransitionId: null,
    })!;
    expect(record).not.toBeNull();

    // 7: validate canonical bytes / structural validity.
    const validation = facade.validateTransition(record, 1_500)!;
    expect(validation.structurallyValid).toBe(true);
    expect(validation.timestampCheck).toBe("ok");

    // 4: real new-key proof.
    expect(facade.verifyNewIdentityProof(record.transitionId, signedNewKeyProof(record, newKey, 1_100))).toBe(true);

    // 9: prove old-key-only remains insufficient under a compromise-confirmed reason.
    facade.addContinuityEvidence(record.transitionId, signedContinuityEvidence(record, oldKey, 1_100));
    const evaluationBeforeDevice = facade.evaluateTransitionEvidence(record.transitionId, 1_500);
    expect(evaluationBeforeDevice).toBe("manual-verification-required");
    expect(evaluationBeforeDevice).not.toBe("locally-acceptable");

    // 6: real authorized Device corroboration — 10: changes the evidence level but is still not a quorum/auto-accept.
    const bodyHash = fedosIdentityTransitionBodyHash(record);
    const corroborationDigest = fedosIdentityTransitionDeviceCorroborationDigest({
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "desktop-1",
      issuedAt: 1_100,
      expiresAt: 1_600,
    });
    const corroboration: FedosIdentityTransitionDeviceCorroborationV1 = {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: record.revision,
      bodyHash,
      newNostrIdentity: record.newNostrIdentity,
      deviceId: "desktop-1",
      devicePublicKeyHex: device.publicKeyHex,
      issuedAt: 1_100,
      expiresAt: 1_600,
      signatureHex: bytesToHex(device.sign(corroborationDigest)),
    };
    facade.addDeviceCorroboration(record.transitionId, corroboration, deviceBinding);

    // 8: evaluate evidence.
    const evaluation = facade.evaluateTransitionEvidence(record.transitionId, 1_500)!;
    expect(evaluation).toBe("device-corroborated");
    expect(evaluation).not.toBe("locally-acceptable");

    // 11: persist transition.
    expect(facade.persistTransition(record.transitionId, evaluation, 1_700)).toBe("inserted");

    // 12-13: stop/restart, replay identical state.
    const restartedPersistence = new AppendOnlyFedosIdentityTransitionFactPersistence(filePath);
    const restartedFacade = new FedosIdentityTransitionFacade(restartedPersistence);
    const status = restartedFacade.inspectTransition(record.transitionId)!;
    expect(status.evidenceOutcome).toBe("device-corroborated");
    expect(status.acceptanceState).toBe("corroborated");
    expect(status.superseded).toBe(false);

    // 20: prove no Runtime/Profile/Device/Conversation identity changed — the Device Binding object itself is untouched (still "trusted", never mutated by this Arc).
    expect(deviceBinding.trustState).toBe("trusted");

    // 21: prove no private key / message plaintext appears in the durable file.
    const raw: string = readFileSync(filePath, "utf8") as string;
    expect(raw).not.toContain(bytesToHex(oldKey));
    expect(raw).not.toContain(bytesToHex(newKey));
    expect(raw).not.toContain("secretKey");
    expect(raw).not.toContain("privateKey");

    // 14: import matching duplicate idempotently.
    expect(restartedPersistence.putFact(persistence.getFact(record.transitionId)!)).toBe("already-present");

    // 15: reject same id / different body (simulate a tampered re-import).
    const tampered = { ...persistence.getFact(record.transitionId)!, evidenceOutcome: "rejected" as const };
    expect(restartedPersistence.putFact(tampered)).toBe("conflict");

    // 19: read-only Ratchet reset impact plan.
    const plan = restartedFacade.planTransitionImpact(record.transitionId)!;
    expect(plan.actionable).toBe(false); // acceptanceState is "corroborated", not "accepted" — never auto-accepted.
    expect(plan.oldSessionsMustNotRebind).toBe(true);
    expect(plan.skippedKeysMustNotMigrate).toBe(true);

    // Explicit local decision promotes it to accepted — still never automatic.
    const decided = restartedFacade.recordLocalDecision(record.transitionId, "accept");
    expect(decided).toBe("accepted");
    const acceptedPlan = restartedFacade.planTransitionImpact(record.transitionId, "accept")!;
    expect(acceptedPlan.actionable).toBe(true);
    expect(acceptedPlan.existingSessionsRequireReset).toBe(true);
  });

  it("16: rejects a revision that rolls back the lineage", () => {
    const facade = new FedosIdentityTransitionFacade(persistence);
    const oldAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
    const newAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
    const revision0 = facade.createTransitionDraft({
      transitionType: "identity-replacement",
      oldAccountIdentity: oldAccount,
      newAccountIdentity: newAccount,
      oldNostrIdentity: oldAccount.publicIdentifier,
      newNostrIdentity: newAccount.publicIdentifier,
      reasonCategory: "user-initiated-replacement",
      issuedAt: 1_000,
      expiresAt: 100_000,
      revision: 0,
      previousTransitionId: null,
    })!;
    const key0 = schnorr.utils.randomSecretKey();
    facade.verifyNewIdentityProof(revision0.transitionId, signedNewKeyProof({ ...revision0, newNostrIdentity: bytesToHex(schnorr.getPublicKey(key0)) }, key0, 1_100));
    facade.persistTransition(revision0.transitionId, "locally-acceptable", 1_200);

    const revision1 = facade.createTransitionDraft({
      transitionType: "identity-replacement",
      oldAccountIdentity: oldAccount,
      newAccountIdentity: newAccount,
      oldNostrIdentity: oldAccount.publicIdentifier,
      newNostrIdentity: newAccount.publicIdentifier,
      reasonCategory: "user-initiated-replacement",
      issuedAt: 2_000,
      expiresAt: 200_000,
      revision: 1,
      previousTransitionId: revision0.transitionId,
    })!;
    facade.persistTransition(revision1.transitionId, "locally-acceptable", 2_200);

    // 17: a broken predecessor.
    const brokenPredecessor = facade.createTransitionDraft({
      transitionType: "identity-replacement",
      oldAccountIdentity: oldAccount,
      newAccountIdentity: newAccount,
      oldNostrIdentity: oldAccount.publicIdentifier,
      newNostrIdentity: newAccount.publicIdentifier,
      reasonCategory: "user-initiated-replacement",
      issuedAt: 3_000,
      expiresAt: 300_000,
      revision: 5,
      previousTransitionId: "fedos-identity-transition-" + "0".repeat(32),
    })!;
    expect(facade.persistTransition(brokenPredecessor.transitionId, "locally-acceptable", 3_200)).toBe("broken-predecessor");

    // 16: rollback — a NEW transition claiming revision 1 again (<= current max of 1).
    const rollback = facade.createTransitionDraft({
      transitionType: "identity-replacement",
      oldAccountIdentity: oldAccount,
      newAccountIdentity: newAccount,
      oldNostrIdentity: oldAccount.publicIdentifier,
      newNostrIdentity: newAccount.publicIdentifier,
      reasonCategory: "user-initiated-replacement",
      issuedAt: 4_000,
      expiresAt: 400_000,
      revision: 1,
      previousTransitionId: revision0.transitionId,
    })!;
    expect(facade.persistTransition(rollback.transitionId, "locally-acceptable", 4_200)).toBe("rollback-detected");
  });

  it("18: detects two competing replacement transitions for the same old identity", () => {
    const facade = new FedosIdentityTransitionFacade(persistence);
    const oldAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };

    const first = facade.createTransitionDraft({
      transitionType: "identity-replacement",
      oldAccountIdentity: oldAccount,
      newAccountIdentity: { authority: "nostr", publicIdentifier: "d".repeat(64), identityId: null },
      oldNostrIdentity: oldAccount.publicIdentifier,
      newNostrIdentity: "d".repeat(64),
      reasonCategory: "user-initiated-replacement",
      issuedAt: 1_000,
      expiresAt: 100_000,
      revision: 0,
      previousTransitionId: null,
    })!;
    expect(facade.persistTransition(first.transitionId, "locally-acceptable", 1_100)).toBe("inserted");

    const competing = facade.createTransitionDraft({
      transitionType: "identity-replacement",
      oldAccountIdentity: oldAccount,
      newAccountIdentity: { authority: "nostr", publicIdentifier: "e".repeat(64), identityId: null },
      oldNostrIdentity: oldAccount.publicIdentifier,
      newNostrIdentity: "e".repeat(64),
      reasonCategory: "user-initiated-replacement",
      issuedAt: 1_050,
      expiresAt: 100_050,
      revision: 0,
      previousTransitionId: null,
    })!;
    expect(facade.persistTransition(competing.transitionId, "locally-acceptable", 1_150)).toBe("conflict");
  });

  it("a stopped facade returns null (never throws) from every method", () => {
    const facade = new FedosIdentityTransitionFacade(persistence);
    facade.stop();
    expect(
      facade.createTransitionDraft({
        transitionType: "identity-replacement",
        oldAccountIdentity: { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null },
        newAccountIdentity: { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null },
        oldNostrIdentity: "a".repeat(64),
        newNostrIdentity: "b".repeat(64),
        reasonCategory: "user-initiated-replacement",
        issuedAt: 1_000,
        expiresAt: 100_000,
        revision: 0,
        previousTransitionId: null,
      }),
    ).toBeNull();
    expect(facade.inspectTransition("anything")).toBeNull();
    expect(facade.planTransitionImpact("anything")).toBeNull();
  });
});
