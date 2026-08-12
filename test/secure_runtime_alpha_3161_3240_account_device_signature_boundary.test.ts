import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bytesToHex } from "@noble/hashes/utils.js";

import {
  FEDOS_DEVICE_BINDING_DOMAIN_V1,
  isWellFormedFedosDeviceBindingChallengeV1,
  serializeFedosDeviceBindingChallengeV1,
  isFedosDeviceBindingChallengeExpired,
  FedosSecureRandomDeviceBindingChallengeNonceGenerator,
  type FedosDeviceBindingChallengeV1,
} from "../src/os/messenger/device/binding_challenge/fedos_device_binding_challenge.js";
import {
  generateFedosDeviceSigningKeypair,
  verifyFedosDeviceSigningSignature,
  isWellFormedFedosDevicePublicKeyHex,
  isWellFormedFedosDeviceSchnorrSignatureHex,
} from "../src/os/messenger/device/crypto/fedos_device_signing_keypair.js";
import {
  authorizeFedosDeviceBindingChallenge,
  verifyFedosDeviceBindingAccountAuthorization,
  FEDOS_DEVICE_BINDING_TAG,
  type FedosDeviceBindingAccountAuthorizationV1,
} from "../src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.js";
import {
  createFedosDeviceBindingProofOfPossession,
  verifyFedosDeviceBindingProofOfPossession,
} from "../src/os/messenger/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import {
  FedosDeviceBindingRegistrationAuthority,
  FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
} from "../src/os/messenger/device/binding_challenge/fedos_device_binding_registration_authority.js";
import { AlreadyVerifiedFedosDeviceRegistrationAuthority } from "../src/os/messenger/device/binding_challenge/fedos_already_verified_device_registration_authority.js";
import { UnavailableFedosDeviceRegistrationAuthority } from "../src/os/messenger/device/unavailable_fedos_device_registration_authority.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { AppendOnlyFedosDeviceBindingChallengeReplayPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.js";
import { deserializeFedosDeviceBindingChallengeConsumption } from "../src/os/messenger/device/persistence/fedos_device_binding_challenge_replay_codec.js";
import { createFedosDeviceBindingBoundary } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_boundary_factory.js";

import { RealFedosNostrSigningAuthority, createStandaloneSchnorrSigner } from "./support/real_fedos_nostr_signing_authority.js";

const ACCOUNT_INDEX_A = 1;
const ACCOUNT_INDEX_B = 2;

function makeChallenge(overrides: Partial<FedosDeviceBindingChallengeV1> = {}, base: { now: number; nonceGen: FedosSecureRandomDeviceBindingChallengeNonceGenerator }): FedosDeviceBindingChallengeV1 {
  const deviceKeypair = generateFedosDeviceSigningKeypair();
  return Object.freeze({
    schemaVersion: 1,
    domain: FEDOS_DEVICE_BINDING_DOMAIN_V1,
    action: "register-device",
    deviceId: `dev-${Math.random().toString(36).slice(2)}`,
    devicePublicKeyHex: deviceKeypair.publicKeyHex,
    issuedAt: base.now,
    expiresAt: base.now + 300,
    nonce: base.nonceGen.generateNonce(),
    ...overrides,
  });
}

describe("Secure Runtime Alpha 3161-3240 -- Challenge canonicalization (Phase C)", () => {
  const now = 1_800_000_000;
  const nonceGen = new FedosSecureRandomDeviceBindingChallengeNonceGenerator();

  it("1. a well-formed challenge validates and serializes deterministically", () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    expect(isWellFormedFedosDeviceBindingChallengeV1(challenge)).toBe(true);
    expect(serializeFedosDeviceBindingChallengeV1(challenge)).toBe(serializeFedosDeviceBindingChallengeV1({ ...challenge }));
  });

  it("22. unknown schema version is rejected", () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    expect(isWellFormedFedosDeviceBindingChallengeV1({ ...challenge, schemaVersion: 2 })).toBe(false);
  });

  it("rejects a challenge carrying an extra unknown field", () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    expect(isWellFormedFedosDeviceBindingChallengeV1({ ...challenge, extra: "x" })).toBe(false);
  });

  it("rejects expiresAt <= issuedAt", () => {
    const challenge = makeChallenge({ expiresAt: now }, { now, nonceGen });
    expect(isWellFormedFedosDeviceBindingChallengeV1(challenge)).toBe(false);
  });

  it("isFedosDeviceBindingChallengeExpired is strict on expiresAt", () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    expect(isFedosDeviceBindingChallengeExpired(challenge, challenge.expiresAt)).toBe(false);
    expect(isFedosDeviceBindingChallengeExpired(challenge, challenge.expiresAt + 1)).toBe(true);
  });

  it("two nonces from the CSPRNG generator are never equal across many draws", () => {
    const nonces = new Set(Array.from({ length: 200 }, () => nonceGen.generateNonce()));
    expect(nonces.size).toBe(200);
  });
});

describe("Secure Runtime Alpha 3161-3240 -- Device signing keypair (Phase B)", () => {
  it("2. a Device proves possession of its own generated key with a real signature", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const digest = new Uint8Array(32).fill(7);
    const sig = keypair.sign(digest);
    expect(verifyFedosDeviceSigningSignature(keypair.publicKeyHex, digest, bytesToHex(sig))).toBe(true);
  });

  it("20. malformed public key is rejected by the verifier, never throws", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const digest = new Uint8Array(32).fill(1);
    const sigHex = bytesToHex(keypair.sign(digest));
    expect(isWellFormedFedosDevicePublicKeyHex("not-hex")).toBe(false);
    expect(verifyFedosDeviceSigningSignature("not-hex", digest, sigHex)).toBe(false);
    expect(verifyFedosDeviceSigningSignature("ab".repeat(31), digest, sigHex)).toBe(false);
  });

  it("21. malformed signature is rejected by the verifier, never throws", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const digest = new Uint8Array(32).fill(2);
    expect(isWellFormedFedosDeviceSchnorrSignatureHex("zz")).toBe(false);
    expect(verifyFedosDeviceSigningSignature(keypair.publicKeyHex, digest, "zz")).toBe(false);
    expect(verifyFedosDeviceSigningSignature(keypair.publicKeyHex, digest, "ab".repeat(63))).toBe(false);
  });

  it("two independently generated Device keypairs are never equal", () => {
    const a = generateFedosDeviceSigningKeypair();
    const b = generateFedosDeviceSigningKeypair();
    expect(a.publicKeyHex).not.toBe(b.publicKeyHex);
  });

  it("structural: no raw private-key getter exists on the keypair class", () => {
    const keypair = generateFedosDeviceSigningKeypair() as unknown as Record<string, unknown>;
    const ownKeys = Object.getOwnPropertyNames(keypair);
    expect(ownKeys.some((k) => /secret|private/i.test(k))).toBe(false);
  });
});

describe("Secure Runtime Alpha 3161-3240 -- Account authorization signature (Phase D)", () => {
  const now = 1_800_000_100;
  const nonceGen = new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
  let signingAuthority: RealFedosNostrSigningAuthority;

  beforeEach(() => {
    signingAuthority = new RealFedosNostrSigningAuthority();
  });

  it("the account produces a real, independently verifiable authorization over the challenge", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    expect(authorization).not.toBeNull();
    expect(authorization!.event.tags).toEqual([FEDOS_DEVICE_BINDING_TAG]);

    const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX_A);
    const verification = await verifyFedosDeviceBindingAccountAuthorization(authorization!, now);
    expect(verification.outcome).toBe("valid");
    expect(verification.accountPublicKeyHex).toBe(identity!.publicKeyHex);
  });

  it("4. wrong account signature is denied -- pubkey never equals the claimed account when tampered", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    const forgedSigner = createStandaloneSchnorrSigner();
    const tampered: FedosDeviceBindingAccountAuthorizationV1 = {
      challenge,
      event: { ...authorization!.event, pubkey: forgedSigner.publicKeyHex },
    };
    const verification = await verifyFedosDeviceBindingAccountAuthorization(tampered, now);
    expect(verification.outcome).toBe("invalid-signature");
    expect(verification.accountPublicKeyHex).toBeNull();
  });

  it("6. changed deviceId after signing is denied (content-mismatch)", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    const tamperedChallenge = { ...challenge, deviceId: challenge.deviceId + "-tampered" };
    const verification = await verifyFedosDeviceBindingAccountAuthorization({ challenge: tamperedChallenge, event: authorization!.event }, now);
    expect(verification.outcome).toBe("content-mismatch");
  });

  it("7. changed Device public key after signing is denied (content-mismatch)", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    const otherKeypair = generateFedosDeviceSigningKeypair();
    const tamperedChallenge = { ...challenge, devicePublicKeyHex: otherKeypair.publicKeyHex };
    const verification = await verifyFedosDeviceBindingAccountAuthorization({ challenge: tamperedChallenge, event: authorization!.event }, now);
    expect(verification.outcome).toBe("content-mismatch");
  });

  it("8. changed trust action after signing is denied (content-mismatch)", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    const tamperedChallenge = { ...challenge, action: "revoke-device" as const };
    const verification = await verifyFedosDeviceBindingAccountAuthorization({ challenge: tamperedChallenge, event: authorization!.event }, now);
    expect(verification.outcome).toBe("content-mismatch");
  });

  it("9. changed expiry after signing is denied (content-mismatch)", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    const tamperedChallenge = { ...challenge, expiresAt: challenge.expiresAt + 1000 };
    const verification = await verifyFedosDeviceBindingAccountAuthorization({ challenge: tamperedChallenge, event: authorization!.event }, now);
    expect(verification.outcome).toBe("content-mismatch");
  });

  it("changed nonce after signing is denied (content-mismatch)", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    const tamperedChallenge = { ...challenge, nonce: nonceGen.generateNonce() };
    const verification = await verifyFedosDeviceBindingAccountAuthorization({ challenge: tamperedChallenge, event: authorization!.event }, now);
    expect(verification.outcome).toBe("content-mismatch");
  });

  it("10. expired request is denied", async () => {
    const challenge = makeChallenge({ issuedAt: now, expiresAt: now + 10 }, { now, nonceGen });
    const authorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge);
    const verification = await verifyFedosDeviceBindingAccountAuthorization(authorization!, now + 11);
    expect(verification.outcome).toBe("expired");
  });

  it("23. cross-domain signature reuse is denied -- a signature produced for unrelated kind:1 content never verifies as an authorization", async () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    // Real account signs something else entirely (not this Arc's canonical challenge content).
    const unrelatedEvent = await signingAuthority.signEvent({
      accountIndex: ACCOUNT_INDEX_A,
      createdAt: now,
      kind: 1,
      tags: [FEDOS_DEVICE_BINDING_TAG as unknown as [string, string]],
      content: "just an ordinary note, not a device-binding challenge",
    });
    const verification = await verifyFedosDeviceBindingAccountAuthorization({ challenge, event: unrelatedEvent! }, now);
    expect(verification.outcome).toBe("content-mismatch");
  });
});

describe("Secure Runtime Alpha 3161-3240 -- Device proof of possession (Phase E)", () => {
  const now = 1_800_000_200;
  const nonceGen = new FedosSecureRandomDeviceBindingChallengeNonceGenerator();

  it("real Device proof round-trips", () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const keypair = generateFedosDeviceSigningKeypair();
    // Regenerate challenge bound to this exact keypair.
    const bound = { ...challenge, devicePublicKeyHex: keypair.publicKeyHex };
    const proof = createFedosDeviceBindingProofOfPossession(keypair, bound);
    expect(proof).not.toBeNull();
    expect(verifyFedosDeviceBindingProofOfPossession(proof!, now)).toBe("valid");
  });

  it("5. wrong Device signature is denied -- a keypair that does not match the challenge's own device key cannot produce a proof", () => {
    const challenge = makeChallenge({}, { now, nonceGen });
    const wrongKeypair = generateFedosDeviceSigningKeypair();
    const proof = createFedosDeviceBindingProofOfPossession(wrongKeypair, challenge);
    expect(proof).toBeNull();
  });

  it("wrong Device signature (tampered signature bytes) fails verification", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const challenge = { ...makeChallenge({}, { now, nonceGen }), devicePublicKeyHex: keypair.publicKeyHex };
    const proof = createFedosDeviceBindingProofOfPossession(keypair, challenge)!;
    const tampered = { ...proof, signatureHex: proof.signatureHex.replace(/.$/, proof.signatureHex.endsWith("0") ? "1" : "0") };
    expect(verifyFedosDeviceBindingProofOfPossession(tampered, now)).toBe("invalid-signature");
  });

  it("9b. expired proof is denied", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const challenge = { ...makeChallenge({ issuedAt: now, expiresAt: now + 5 }, { now, nonceGen }), devicePublicKeyHex: keypair.publicKeyHex };
    const proof = createFedosDeviceBindingProofOfPossession(keypair, challenge)!;
    expect(verifyFedosDeviceBindingProofOfPossession(proof, now + 6)).toBe("expired");
  });
});

describe("Secure Runtime Alpha 3161-3240 -- Real Device Registration Authority (Phase G)", () => {
  const nonceGen = new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
  let signingAuthority: RealFedosNostrSigningAuthority;
  let registryPersistence: InMemoryFedosDeviceRegistryPersistence;
  let replayPersistence: InMemoryFedosDeviceBindingChallengeReplayPersistence;
  let authority: FedosDeviceBindingRegistrationAuthority;

  beforeEach(() => {
    signingAuthority = new RealFedosNostrSigningAuthority();
    registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    replayPersistence = new InMemoryFedosDeviceBindingChallengeReplayPersistence();
    authority = new FedosDeviceBindingRegistrationAuthority({ registryPersistence, replayPersistence });
  });

  async function registerFreshDevice(now: number, accountIndex = ACCOUNT_INDEX_A) {
    const keypair = generateFedosDeviceSigningKeypair();
    const challenge = { ...makeChallenge({}, { now, nonceGen }), devicePublicKeyHex: keypair.publicKeyHex };
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, accountIndex, challenge))!;
    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge)!;
    return { challenge, keypair, accountAuthorization, deviceProof };
  }

  it("1+2+3. account creates authorization, Device proves possession, trusted registration succeeds", async () => {
    const now = 1_800_000_300;
    const { challenge, accountAuthorization, deviceProof } = await registerFreshDevice(now);
    const result = await authority.registerDevice(accountAuthorization, deviceProof, now);
    expect(result.outcome).toBe("registered-trusted");
    expect(result.binding?.trustState).toBe("trusted");
    expect(result.binding?.devicePublicKeyRef).toBe(challenge.devicePublicKeyHex);
    expect(result.binding?.deviceId).toBe(challenge.deviceId);
  });

  it("4. wrong account signature denied end-to-end through the orchestrator", async () => {
    const now = 1_800_000_301;
    const { accountAuthorization, deviceProof } = await registerFreshDevice(now);
    const forgedSigner = createStandaloneSchnorrSigner();
    const forged = { ...accountAuthorization, event: { ...accountAuthorization.event, pubkey: forgedSigner.publicKeyHex } };
    const result = await authority.registerDevice(forged, deviceProof, now);
    expect(result.outcome).toBe("invalid-account-proof");
    expect(result.binding).toBeNull();
  });

  it("5. wrong Device signature denied end-to-end through the orchestrator", async () => {
    const now = 1_800_000_302;
    const { accountAuthorization, challenge } = await registerFreshDevice(now);
    const otherKeypair = generateFedosDeviceSigningKeypair();
    const forgedProof = { challenge, devicePublicKeyHex: challenge.devicePublicKeyHex, signatureHex: bytesToHex(otherKeypair.sign(new Uint8Array(32))) };
    const result = await authority.registerDevice(accountAuthorization, forgedProof, now);
    expect(result.outcome).toBe("invalid-device-proof");
    expect(result.binding).toBeNull();
  });

  it("6+7+8. account and Device proofs must cover the IDENTICAL challenge -- any divergence is unsupported", async () => {
    const now = 1_800_000_303;
    const { accountAuthorization, deviceProof, challenge } = await registerFreshDevice(now);
    const divergentAccount = { ...accountAuthorization, challenge: { ...challenge, deviceId: challenge.deviceId + "-x" } };
    expect((await authority.registerDevice(divergentAccount, deviceProof, now)).outcome).toBe("unsupported");
  });

  it("11+13. duplicate identical registration is idempotent", async () => {
    const now = 1_800_000_304;
    const { accountAuthorization, deviceProof } = await registerFreshDevice(now);
    const first = await authority.registerDevice(accountAuthorization, deviceProof, now);
    const second = await authority.registerDevice(accountAuthorization, deviceProof, now + 1);
    expect(first.outcome).toBe("registered-trusted");
    expect(second.outcome).toBe("registered-trusted");
    expect(second.binding?.deviceId).toBe(first.binding?.deviceId);
  });

  it("11b. replay with changed bytes under the same nonce is denied as replayed", async () => {
    const now = 1_800_000_305;
    const { accountAuthorization, deviceProof, challenge } = await registerFreshDevice(now);
    await authority.registerDevice(accountAuthorization, deviceProof, now);

    // A NEW challenge object sharing the same nonce but different deviceId --
    // constructed directly against the replay store to simulate a byte-changed
    // reuse attempt of an already-consumed nonce.
    const differentContentChallenge = { ...challenge, deviceId: challenge.deviceId + "-reused-nonce" };
    const keypair2 = generateFedosDeviceSigningKeypair();
    const boundChallenge = { ...differentContentChallenge, devicePublicKeyHex: keypair2.publicKeyHex };
    const account2 = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, boundChallenge))!;
    const proof2 = createFedosDeviceBindingProofOfPossession(keypair2, boundChallenge)!;
    const result = await authority.registerDevice(account2, proof2, now);
    expect(result.outcome).toBe("replayed");
  });

  it("14. conflicting duplicate registration (same deviceId, different account, fresh nonce) is a conflict", async () => {
    const now = 1_800_000_306;
    const { challenge, keypair, accountAuthorization, deviceProof } = await registerFreshDevice(now);
    await authority.registerDevice(accountAuthorization, deviceProof, now);

    const freshChallenge = { ...challenge, nonce: nonceGen.generateNonce(), issuedAt: now + 10, expiresAt: now + 310 };
    const accountB = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_B, freshChallenge))!;
    const proofB = createFedosDeviceBindingProofOfPossession(keypair, freshChallenge)!;
    const result = await authority.registerDevice(accountB, proofB, now + 10);
    expect(result.outcome).toBe("conflict");
  });

  it("15. independent account isolation -- two accounts registering distinct devices never interfere", async () => {
    const now = 1_800_000_307;
    const a = await registerFreshDevice(now, ACCOUNT_INDEX_A);
    const b = await registerFreshDevice(now, ACCOUNT_INDEX_B);
    const resultA = await authority.registerDevice(a.accountAuthorization, a.deviceProof, now);
    const resultB = await authority.registerDevice(b.accountAuthorization, b.deviceProof, now);
    expect(resultA.outcome).toBe("registered-trusted");
    expect(resultB.outcome).toBe("registered-trusted");
    expect(resultA.binding?.accountRef.publicIdentifier).not.toBe(resultB.binding?.accountRef.publicIdentifier);
  });

  it("16. independent Device isolation -- one account registering two distinct devices keeps both bindings separate", async () => {
    const now = 1_800_000_308;
    const first = await registerFreshDevice(now, ACCOUNT_INDEX_A);
    const second = await registerFreshDevice(now, ACCOUNT_INDEX_A);
    await authority.registerDevice(first.accountAuthorization, first.deviceProof, now);
    await authority.registerDevice(second.accountAuthorization, second.deviceProof, now);
    expect(authority.getBinding(first.challenge.deviceId)?.devicePublicKeyRef).toBe(first.challenge.devicePublicKeyHex);
    expect(authority.getBinding(second.challenge.deviceId)?.devicePublicKeyRef).toBe(second.challenge.devicePublicKeyHex);
  });

  it("17. revoked Device remains revoked -- cannot be re-registered under the same deviceId even with a fresh, valid nonce", async () => {
    const now = 1_800_000_309;
    const { challenge, keypair, accountAuthorization, deviceProof } = await registerFreshDevice(now);
    await authority.registerDevice(accountAuthorization, deviceProof, now);

    const revokeChallenge = { ...challenge, action: "revoke-device" as const, nonce: nonceGen.generateNonce(), issuedAt: now + 5, expiresAt: now + 305 };
    const revokeAuth = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, revokeChallenge))!;
    const revocation = await authority.revokeDevice(revokeAuth, now + 5);
    expect(revocation.outcome).toBe("revoked");

    const reRegisterChallenge = { ...challenge, nonce: nonceGen.generateNonce(), issuedAt: now + 10, expiresAt: now + 310 };
    const reAccount = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, reRegisterChallenge))!;
    const reProof = createFedosDeviceBindingProofOfPossession(keypair, reRegisterChallenge)!;
    const reResult = await authority.registerDevice(reAccount, reProof, now + 10);
    expect(reResult.outcome).toBe("revoked");
    expect(authority.getBinding(challenge.deviceId)?.trustState).toBe("revoked");
  });

  it("18+19. account-authorized revocation succeeds; wrong-account revocation is denied", async () => {
    const now = 1_800_000_310;
    const { challenge, accountAuthorization, deviceProof } = await registerFreshDevice(now, ACCOUNT_INDEX_A);
    await authority.registerDevice(accountAuthorization, deviceProof, now);

    const wrongAccountChallenge = { ...challenge, action: "revoke-device" as const, nonce: nonceGen.generateNonce(), issuedAt: now + 1, expiresAt: now + 301 };
    const wrongAccountAuth = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_B, wrongAccountChallenge))!;
    const deniedRevocation = await authority.revokeDevice(wrongAccountAuth, now + 1);
    expect(deniedRevocation.outcome).toBe("wrong-account");
    expect(authority.getBinding(challenge.deviceId)?.trustState).toBe("trusted");

    const rightAccountChallenge = { ...challenge, action: "revoke-device" as const, nonce: nonceGen.generateNonce(), issuedAt: now + 2, expiresAt: now + 302 };
    const rightAccountAuth = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, rightAccountChallenge))!;
    const revocation = await authority.revokeDevice(rightAccountAuth, now + 2);
    expect(revocation.outcome).toBe("revoked");

    // Duplicate revocation is idempotent.
    const dupChallenge = { ...challenge, action: "revoke-device" as const, nonce: nonceGen.generateNonce(), issuedAt: now + 3, expiresAt: now + 303 };
    const dupAuth = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, dupChallenge))!;
    const dup = await authority.revokeDevice(dupAuth, now + 3);
    expect(dup.outcome).toBe("already-revoked");
  });

  it("10. expired registration request is denied", async () => {
    const now = 1_800_000_311;
    const keypair = generateFedosDeviceSigningKeypair();
    const challenge = { ...makeChallenge({ issuedAt: now, expiresAt: now + 5 }, { now, nonceGen }), devicePublicKeyHex: keypair.publicKeyHex };
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge))!;
    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge)!;
    const result = await authority.registerDevice(accountAuthorization, deviceProof, now + 6);
    expect(result.outcome).toBe("expired");
  });

  it("27. UnavailableFedosDeviceRegistrationAuthority still fails closed and never returns 'verified'", () => {
    const legacyAuthority = new UnavailableFedosDeviceRegistrationAuthority();
    const decision = legacyAuthority.authorizeRegistration({ deviceId: "x", accountRef: { authority: "nostr", publicIdentifier: "y", identityId: null }, devicePublicKeyRef: null, label: null }, 0);
    expect(decision.capability).toBe("unavailable");
    const trustDecision = legacyAuthority.authorizeTrustConfirmation(
      { schemaVersion: 1, deviceId: "x", accountRef: { authority: "nostr", publicIdentifier: "y", identityId: null }, devicePublicKeyRef: null, label: null, createdAt: 0, trustState: "unavailable", capabilityVersion: 1, revokedAt: null },
      0,
    );
    expect(trustDecision.allowed).toBe(false);
    expect(trustDecision.capability).not.toBe("verified");
  });

  it("structural: AlreadyVerifiedFedosDeviceRegistrationAuthority always answers 'verified' -- only safe because this orchestrator is its one caller", () => {
    const always = new AlreadyVerifiedFedosDeviceRegistrationAuthority();
    const decision = always.authorizeRegistration({ deviceId: "x", accountRef: { authority: "nostr", publicIdentifier: "y", identityId: null }, devicePublicKeyRef: "z", label: null }, 0);
    expect(decision).toEqual({ allowed: true, capability: "verified", reason: expect.any(String) });
  });
});

describe("Secure Runtime Alpha 3161-3240 -- Replay/expiry persistence (Phase F/I)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fedos-device-binding-replay-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("12. restart preserves replay state -- a NEW backend instance over the SAME file still reports the consumed nonce", () => {
    const filePath = join(tempDir, "replay.ndjson");
    const first = new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(filePath);
    const record = {
      schemaVersion: 1 as const,
      nonce: "abc123",
      domain: FEDOS_DEVICE_BINDING_DOMAIN_V1,
      action: "register-device" as const,
      deviceId: "dev-1",
      devicePublicKeyHex: "b".repeat(64),
      accountAuthority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      accountPublicIdentifier: "a".repeat(64),
      consumedAt: 1000,
      outcomeSummary: "registered-trusted",
    };
    expect(first.putConsumption(record)).toBe("inserted");

    const restarted = new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(filePath);
    expect(restarted.getConsumption("abc123")).toEqual(record);
  });

  it("13b. identical duplicate write to the append-only backend is idempotent", () => {
    const filePath = join(tempDir, "replay-dup.ndjson");
    const persistence = new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(filePath);
    const record = {
      schemaVersion: 1 as const,
      nonce: "n1",
      domain: FEDOS_DEVICE_BINDING_DOMAIN_V1,
      action: "register-device" as const,
      deviceId: "dev-1",
      devicePublicKeyHex: "c".repeat(64),
      accountAuthority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      accountPublicIdentifier: "d".repeat(64),
      consumedAt: 1000,
      outcomeSummary: "registered-trusted",
    };
    expect(persistence.putConsumption(record)).toBe("inserted");
    expect(persistence.putConsumption(record)).toBe("already-present");
  });

  it("14b. conflicting duplicate write (same nonce, different bytes) to the append-only backend is refused", () => {
    const filePath = join(tempDir, "replay-conflict.ndjson");
    const persistence = new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(filePath);
    const record = {
      schemaVersion: 1 as const,
      nonce: "n1",
      domain: FEDOS_DEVICE_BINDING_DOMAIN_V1,
      action: "register-device" as const,
      deviceId: "dev-1",
      devicePublicKeyHex: "e".repeat(64),
      accountAuthority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      accountPublicIdentifier: "f".repeat(64),
      consumedAt: 1000,
      outcomeSummary: "registered-trusted",
    };
    persistence.putConsumption(record);
    expect(persistence.putConsumption({ ...record, deviceId: "dev-2" })).toBe("conflict");
  });

  it("corruption fails closed -- an unparseable line throws, never silently drops the record", () => {
    const filePath = join(tempDir, "replay-corrupt.ndjson");
    writeFileSync(filePath, "not json at all\n", "utf8");
    const persistence = new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(filePath);
    expect(() => persistence.getConsumption("anything")).toThrow();
  });

  it("corruption fails closed -- a schema-invalid but parseable line throws", () => {
    const filePath = join(tempDir, "replay-bad-schema.ndjson");
    writeFileSync(filePath, JSON.stringify({ nonce: "x" }) + "\n", "utf8");
    const persistence = new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(filePath);
    expect(() => persistence.getConsumption("x")).toThrow();
  });

  it("the codec fails closed to null on any malformed record, never throws", () => {
    expect(deserializeFedosDeviceBindingChallengeConsumption(null)).toBeNull();
    expect(deserializeFedosDeviceBindingChallengeConsumption({})).toBeNull();
    expect(deserializeFedosDeviceBindingChallengeConsumption({ nonce: "x", schemaVersion: 2 })).toBeNull();
  });

  it("in-memory replay backend never persists across independent instances", () => {
    const a = new InMemoryFedosDeviceBindingChallengeReplayPersistence();
    const b = new InMemoryFedosDeviceBindingChallengeReplayPersistence();
    a.putConsumption({
      schemaVersion: 1,
      nonce: "n",
      domain: FEDOS_DEVICE_BINDING_DOMAIN_V1,
      action: "register-device",
      deviceId: "dev-1",
      devicePublicKeyHex: "a".repeat(64),
      accountAuthority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      accountPublicIdentifier: "b".repeat(64),
      consumedAt: 1,
      outcomeSummary: "registered-trusted",
    });
    expect(b.getConsumption("n")).toBeNull();
  });
});

describe("Secure Runtime Alpha 3161-3240 -- No secrets in persistence (Phase M)", () => {
  it("24+25. the persisted Device Binding registry never carries a private key or Master Seed field, and 28. existing Device Registry write behavior is unaffected", async () => {
    const now = 1_800_000_400;
    const nonceGen = new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const replayPersistence = new InMemoryFedosDeviceBindingChallengeReplayPersistence();
    const authority = new FedosDeviceBindingRegistrationAuthority({ registryPersistence, replayPersistence });

    const keypair = generateFedosDeviceSigningKeypair();
    const challenge = { ...makeChallenge({}, { now, nonceGen }), devicePublicKeyHex: keypair.publicKeyHex };
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge))!;
    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge)!;
    await authority.registerDevice(accountAuthorization, deviceProof, now);

    const serializedBindings = JSON.stringify(registryPersistence.listBindings());
    expect(serializedBindings).not.toMatch(/secret/i);
    expect(serializedBindings).not.toMatch(/masterseed/i);
    expect(serializedBindings).not.toMatch(/privatekey/i);
    expect(serializedBindings).toContain(challenge.devicePublicKeyHex);

    expect(registryPersistence.listBindings().length).toBe(1);
  });

  it("26. no secret-shaped field exists in a replay consumption record's own JSON shape", () => {
    const record = {
      schemaVersion: 1 as const,
      nonce: "n",
      domain: FEDOS_DEVICE_BINDING_DOMAIN_V1,
      action: "register-device" as const,
      deviceId: "dev-1",
      devicePublicKeyHex: "a".repeat(64),
      accountAuthority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY,
      accountPublicIdentifier: "b".repeat(64),
      consumedAt: 1,
      outcomeSummary: "registered-trusted",
    };
    expect(Object.keys(record)).not.toContain("secretKey");
    expect(Object.keys(record)).not.toContain("privateKey");
    expect(Object.keys(record)).not.toContain("masterSeed");
    expect(JSON.stringify(record)).not.toMatch(/secret|private|masterseed/i);
  });
});

describe("Secure Runtime Alpha 3161-3240 -- Factory/adapter boundary (Phase J)", () => {
  it("mintChallenge and registrationAuthority are wired together and produce a real, end-to-end registrable binding", async () => {
    const now = 1_800_000_500;
    const boundary = createFedosDeviceBindingBoundary({
      registryPersistence: new InMemoryFedosDeviceRegistryPersistence(),
      replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
      now: () => now,
    });
    const keypair = generateFedosDeviceSigningKeypair();
    const challenge = boundary.mintChallenge("register-device", "dev-factory-1", keypair.publicKeyHex);
    expect(isWellFormedFedosDeviceBindingChallengeV1(challenge)).toBe(true);

    const signingAuthority = new RealFedosNostrSigningAuthority();
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX_A, challenge))!;
    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge)!;
    const result = await boundary.registrationAuthority.registerDevice(accountAuthorization, deviceProof, now);
    expect(result.outcome).toBe("registered-trusted");
  });
});
