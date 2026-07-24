import { describe, it, expect } from "vitest";
import {
  createFedosArchiveSuppressionFact,
  validateFedosArchiveSuppressionFact,
  fedosArchiveSuppressionFactCanonicalBytes,
  fedosArchiveSuppressionFactId,
} from "../src/conversation/retention/fedos_archive_suppression_fact.js";
import {
  createFedosArchiveSuppressionFactDeviceEvidence,
  verifyFedosArchiveSuppressionFactDeviceEvidence,
} from "../src/conversation/retention/fedos_archive_suppression_fact_signing.js";
import { generateFedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";
import { FedosArchiveSuppressionObservationAuthority } from "../src/conversation/retention/fedos_archive_suppression_observation_authority.js";
import { InMemoryFedosArchiveSuppressionObservationPersistence } from "../src/conversation/retention/in_memory_fedos_archive_suppression_observation_persistence.js";
import { createAndRecordLocalArchiveSuppressionFact } from "../src/conversation/retention/fedos_archive_suppression_local_bridge.js";
import type { FedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";

const ACCOUNT_REF: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const SUBJECT = "payload-7721" as unknown as FedosConversationPayloadId;

function makeAuthority() {
  return new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
}

describe("Secure Runtime Alpha 7721-7800 -- suppression fact (Phase C)", () => {
  it("1. createFedosArchiveSuppressionFact produces a deterministic factId; validateFedosArchiveSuppressionFact round-trips it", () => {
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(fact.factId).toBe(fedosArchiveSuppressionFactId(ACCOUNT_REF, "device-a", SUBJECT, "suppress-payload-restore", 0));

    const wire = JSON.parse(JSON.stringify(fact));
    const revalidated = validateFedosArchiveSuppressionFact(wire);
    expect(revalidated).not.toBeNull();
    expect(revalidated!.factId).toBe(fact.factId);
  });

  it("2. fails closed for an unrecognized suppressionMeaning, malformed nonce, or negative revision", () => {
    const base = {
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload" as const,
      subjectRef: SUBJECT,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    };
    expect(createFedosArchiveSuppressionFact({ ...base, suppressionMeaning: "delete-everything" as never, revision: 0 })).toBeNull();
    expect(createFedosArchiveSuppressionFact({ ...base, suppressionMeaning: "suppress-payload-restore", revision: -1 })).toBeNull();
    expect(createFedosArchiveSuppressionFact({ ...base, suppressionMeaning: "suppress-payload-restore", revision: 0, nonce: "not-hex" })).toBeNull();
  });

  it("3. canonical bytes are stable across two logically-identical calls (deterministic signing input)", () => {
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-envelope-restore",
      revision: 2,
      decidedAt: 5000,
      nonce: "b".repeat(32),
    })!;
    const bytes1 = fedosArchiveSuppressionFactCanonicalBytes(fact);
    const bytes2 = fedosArchiveSuppressionFactCanonicalBytes(fact);
    expect(new TextDecoder().decode(bytes1)).toBe(new TextDecoder().decode(bytes2));
  });

  it("4. carries no plaintext/ciphertext/path field -- exactly the 9 reviewed fields, nothing else", () => {
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(Object.keys(fact).sort()).toEqual(
      ["accountRef", "decidedAt", "factId", "nonce", "revision", "schemaVersion", "sourceDeviceId", "subjectRef", "subjectType", "suppressionMeaning"].sort(),
    );
  });
});

describe("Secure Runtime Alpha 7721-7800 -- Device evidence (Phase D)", () => {
  it("5. a real Device signature verifies as 'device-verified' when the Registry's own known key matches", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    const evidence = createFedosArchiveSuppressionFactDeviceEvidence(keypair, fact);
    expect(verifyFedosArchiveSuppressionFactDeviceEvidence(fact, evidence, keypair.publicKeyHex)).toBe("device-verified");
  });

  it("6. absent evidence verifies as 'account-only' -- never silently treated as device-verified", () => {
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(verifyFedosArchiveSuppressionFactDeviceEvidence(fact, null, null)).toBe("account-only");
  });

  it("7. a forged/mismatched Device signature verifies as 'device-evidence-invalid', never 'device-verified'", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const otherKeypair = generateFedosDeviceSigningKeypair();
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    const evidence = createFedosArchiveSuppressionFactDeviceEvidence(keypair, fact);
    // Verified against a DIFFERENT registry-known key -- the signature is real, but for the wrong device.
    expect(verifyFedosArchiveSuppressionFactDeviceEvidence(fact, evidence, otherKeypair.publicKeyHex)).toBe("device-evidence-invalid");

    // A tampered signature over the same fact.
    const tampered = { devicePublicKeyHex: evidence.devicePublicKeyHex, signatureHex: "0".repeat(128) };
    expect(verifyFedosArchiveSuppressionFactDeviceEvidence(fact, tampered, keypair.publicKeyHex)).toBe("device-evidence-invalid");
  });
});

describe("Secure Runtime Alpha 7721-7800 -- Observation Authority conflict/rollback (Phase E)", () => {
  it("8. a higher revision for the SAME (subject, source) is recorded; evaluateSuppression reports 'suppressed'", () => {
    const authority = makeAuthority();
    const fact0 = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(authority.recordSelfSuppression(fact0)).toBe("recorded");
    expect(authority.evaluateSuppression(SUBJECT, "restore")).toBe("suppressed");
  });

  it("9. a revision <= the max already recorded for the SAME (subject, source) is rejected as rollback -- never applied", () => {
    const authority = makeAuthority();
    const fact1 = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 1,
      decidedAt: 2000,
      nonce: "a".repeat(32),
    })!;
    authority.recordSelfSuppression(fact1);

    const staleFact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 500,
      nonce: "b".repeat(32),
    })!;
    expect(authority.recordImportedSuppression(staleFact, "account-only")).toBe("rollback-rejected");
    // The real, higher-revision fact still stands.
    expect(authority.evaluateSuppression(SUBJECT, "restore")).toBe("suppressed");
  });

  it("10. recording the EXACT same fact twice is idempotent ('already-present'), never a conflict", () => {
    const authority = makeAuthority();
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(authority.recordSelfSuppression(fact)).toBe("recorded");
    expect(authority.recordSelfSuppression(fact)).toBe("already-present");
  });

  it("11. a 'device-evidence-invalid' imported record is durably kept but NEVER suppresses anything", () => {
    const authority = makeAuthority();
    const fact = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-b",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(authority.recordImportedSuppression(fact, "device-evidence-invalid")).toBe("recorded");
    expect(authority.evaluateSuppression(SUBJECT, "restore")).toBe("active"); // NOT suppressed
    expect(authority.listObservationsForSubject(SUBJECT)).toHaveLength(1); // but kept for audit
  });

  it("12. different sourceDeviceId values maintain INDEPENDENT revision counters for the same subject", () => {
    const authority = makeAuthority();
    const factFromA = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-a",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 5,
      decidedAt: 1000,
      nonce: "a".repeat(32),
    })!;
    expect(authority.recordSelfSuppression(factFromA)).toBe("recorded");

    // device-b's own revision 0 is NOT a rollback relative to device-a's revision 5 -- independent counters.
    const factFromB = createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF,
      sourceDeviceId: "device-b",
      subjectType: "payload",
      subjectRef: SUBJECT,
      suppressionMeaning: "suppress-payload-restore",
      revision: 0,
      decidedAt: 1000,
      nonce: "b".repeat(32),
    })!;
    expect(authority.recordImportedSuppression(factFromB, "account-only")).toBe("recorded");
  });
});

describe("Secure Runtime Alpha 7721-7800 -- local bridge (Phase F steps 1-2)", () => {
  it("13. createAndRecordLocalArchiveSuppressionFact derives the next revision automatically and records origin 'self'", () => {
    const authority = makeAuthority();
    const first = createAndRecordLocalArchiveSuppressionFact(
      { accountRef: ACCOUNT_REF, sourceDeviceId: "device-a", subjectRef: SUBJECT, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 },
      authority,
    );
    expect(first.outcome).toBe("recorded");
    expect((first as { fact: { revision: number } }).fact.revision).toBe(0);

    const second = createAndRecordLocalArchiveSuppressionFact(
      { accountRef: ACCOUNT_REF, sourceDeviceId: "device-a", subjectRef: SUBJECT, suppressionMeaning: "suppress-envelope-restore", decidedAt: 2000 },
      authority,
    );
    expect(second.outcome).toBe("recorded");
    expect((second as { fact: { revision: number } }).fact.revision).toBe(1);

    const observations = authority.listObservationsForSubject(SUBJECT);
    expect(observations.every((o) => o.origin === "self")).toBe(true);
  });
});
