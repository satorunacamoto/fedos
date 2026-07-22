import { describe, it, expect } from "vitest";
import {
  FedosNobleTestNostrSigningAuthority,
  fedosTestSecretKeyFromSeed,
  signFedosDeletionRequestRecordV1,
  verifyFedosSignedDeletionRequestV1,
  type FedosSignedDeletionRequestV1,
} from "../src/conversation/deletion_request/fedos_deletion_request_signing.js";
import type { FedosDeletionRequestRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_request_record.js";
import {
  signFedosDeletionAcknowledgementRecordV1,
  verifyFedosSignedDeletionAcknowledgementV1,
} from "../src/conversation/deletion_request/fedos_deletion_acknowledgement_signing.js";
import type { FedosDeletionAcknowledgementRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_acknowledgement_record.js";

/**
 * Secure Runtime Alpha 5641-5720 -- real signing/verification boundary.
 * `FedosNobleTestNostrSigningAuthority` produces GENUINE, independently
 * verifiable BIP-340 Schnorr signatures (no WASM/Master Seed needed) --
 * every test here exercises the SAME real `validateInboundNostrEvent`
 * chain a production caller would use.
 */

const ALICE_INDEX = 0;
const BOB_INDEX = 1;

function makeAuthority(): FedosNobleTestNostrSigningAuthority {
  return new FedosNobleTestNostrSigningAuthority([
    { accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") },
    { accountIndex: BOB_INDEX, secretKey: fedosTestSecretKeyFromSeed("bob") },
  ]);
}

function baseRecord(overrides: Partial<FedosDeletionRequestRecordV1> = {}): FedosDeletionRequestRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    requesterAccountRef: "alice-account",
    requesterDeviceRef: null,
    recipientAccountRef: "bob-account",
    recipientDeviceRef: "bob-device-a",
    conversationId: "board-a::direct::thread-1",
    targetEnvelopeId: "envelope-1",
    scope: "local-history-and-index",
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_100_000,
    nonce: "b".repeat(32),
    capabilityVersion: 1,
    reasonCode: null,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 5641-5720 -- real signing produces a genuinely verifiable request", () => {
  it("1. a request signed by Alice verifies successfully end to end", async () => {
    const authority = makeAuthority();
    const record = baseRecord();
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    expect(signed).not.toBeNull();
    expect(verifyFedosSignedDeletionRequestV1(signed!)).toBe(true);
  });

  it("2. the wire event's own pubkey matches Alice's own real derived public identity", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const identity = await authority.publicIdentityForAccount(ALICE_INDEX);
    expect(signed!.wireEvent.pubkey).toBe(identity!.publicKeyHex);
  });

  it("3. an unregistered accountIndex fails closed to null, never throws", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: 999 });
    expect(signed).toBeNull();
  });

  it("4. a malformed record is refused before any signing attempt", async () => {
    const authority = makeAuthority();
    const malformed = { ...baseRecord(), extraField: "nope" } as unknown as FedosDeletionRequestRecordV1;
    const signed = await signFedosDeletionRequestRecordV1(malformed, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    expect(signed).toBeNull();
  });
});

describe("Secure Runtime Alpha 5641-5720 -- one-byte mutation invalidates the real signature", () => {
  it("5. mutating ANY field of the record after signing (content/record mismatch) fails verification", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const tampered: FedosSignedDeletionRequestV1 = { ...signed!, record: { ...signed!.record, requesterAccountRef: "mallory-account" } };
    expect(verifyFedosSignedDeletionRequestV1(tampered)).toBe(false);
  });

  it("6. mutating the wire event's own sig by one hex character fails verification", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const flippedChar = signed!.wireEvent.sig[0] === "a" ? "b" : "a";
    const tampered: FedosSignedDeletionRequestV1 = { ...signed!, wireEvent: { ...signed!.wireEvent, sig: flippedChar + signed!.wireEvent.sig.slice(1) } };
    expect(verifyFedosSignedDeletionRequestV1(tampered)).toBe(false);
  });

  it("7. mutating the wire event's own id (without re-signing) fails verification (id self-consistency check)", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const flippedChar = signed!.wireEvent.id[0] === "a" ? "b" : "a";
    const tampered: FedosSignedDeletionRequestV1 = { ...signed!, wireEvent: { ...signed!.wireEvent, id: flippedChar + signed!.wireEvent.id.slice(1) } };
    expect(verifyFedosSignedDeletionRequestV1(tampered)).toBe(false);
  });

  it("8. substituting a DIFFERENT (but validly signed) event's content -- signed by the SAME key -- still fails, since it no longer matches the claimed record's own canonical bytes", async () => {
    const authority = makeAuthority();
    const signedA = await signFedosDeletionRequestRecordV1(baseRecord({ targetEnvelopeId: "envelope-1" }), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const signedB = await signFedosDeletionRequestRecordV1(baseRecord({ targetEnvelopeId: "envelope-2" }), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    // Splice B's own genuinely-valid wire event onto A's own claimed record -- the wire event is
    // internally self-consistent (its own id/sig verify against ITS OWN content), but that content
    // is envelope-2's, not envelope-1's -- this Arc's own content-binding check must catch it.
    const spliced: FedosSignedDeletionRequestV1 = { record: signedA!.record, wireEvent: signedB!.wireEvent };
    expect(verifyFedosSignedDeletionRequestV1(spliced)).toBe(false);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- wrong-account / wrong-key rejection", () => {
  it("9. a request claiming Alice as requesterAccountRef but actually signed by Bob's key still passes THIS file's own signature check (pubkey binding is an authorization-layer concern, not a signing-layer one) -- documents the boundary explicitly", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord({ requesterAccountRef: "alice-account" }), { signingAuthority: authority, requesterAccountIndex: BOB_INDEX });
    // The wire event is genuinely, validly signed -- by BOB's key. verifyFedosSignedDeletionRequestV1
    // only proves "someone signed exactly this content" -- binding the PUBKEY to the CLAIMED
    // requesterAccountRef is `fedos_deletion_request_authorization_assessment.ts`'s own job.
    expect(verifyFedosSignedDeletionRequestV1(signed!)).toBe(true);
    const bobIdentity = await authority.publicIdentityForAccount(BOB_INDEX);
    expect(signed!.wireEvent.pubkey).toBe(bobIdentity!.publicKeyHex);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- acknowledgement signing mirrors request signing", () => {
  function baseAck(overrides: Partial<FedosDeletionAcknowledgementRecordV1> = {}): FedosDeletionAcknowledgementRecordV1 {
    return {
      schemaVersion: 1,
      requestId: "a".repeat(64),
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      outcome: "applied-local-history-and-index",
      appliedScopes: ["local-history", "local-index"],
      retainedScopes: [],
      evidenceClass: "local-verified",
      acknowledgedAt: 1_700_050_000,
      protocolVersion: 1,
      ...overrides,
    };
  }

  it("10. an acknowledgement signed by Bob verifies successfully", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionAcknowledgementRecordV1(baseAck(), { signingAuthority: authority, recipientAccountIndex: BOB_INDEX });
    expect(signed).not.toBeNull();
    expect(verifyFedosSignedDeletionAcknowledgementV1(signed!)).toBe(true);
  });

  it("11. a tampered acknowledgement outcome fails verification", async () => {
    const authority = makeAuthority();
    const signed = await signFedosDeletionAcknowledgementRecordV1(baseAck(), { signingAuthority: authority, recipientAccountIndex: BOB_INDEX });
    const tampered = { ...signed!, record: { ...signed!.record, outcome: "failed" as const } };
    expect(verifyFedosSignedDeletionAcknowledgementV1(tampered)).toBe(false);
  });

  it("12. a malformed acknowledgement (unknown extra field) is refused before signing", async () => {
    const authority = makeAuthority();
    const malformed = { ...baseAck(), extra: true } as unknown as FedosDeletionAcknowledgementRecordV1;
    const signed = await signFedosDeletionAcknowledgementRecordV1(malformed, { signingAuthority: authority, recipientAccountIndex: BOB_INDEX });
    expect(signed).toBeNull();
  });
});
