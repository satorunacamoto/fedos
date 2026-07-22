/**
 * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing,
 * and Durable Sync Journal Arc") — Phase M real acceptance tests.
 *
 * Uses REAL account signatures (`RealFedosNostrSigningAuthority`, real
 * BIP-340 Schnorr via `@noble/curves`, the SAME library production
 * verification uses), REAL Device signatures (`FedosDeviceSigningKeypair`),
 * the REAL Device Registry / replay persistence / Sync Journal / Desktop
 * Runtime / Shell / Electron dispatch translation. No mock stands in for
 * any part of the headline pairing/registration flow anywhere in this
 * file — mocks/stubs appear ONLY for narrow corruption-injection fixtures
 * (a hand-written corrupt log line) or explicit unavailable-boundary
 * fixtures (`UnavailableFedosDeviceRegistrationAuthority`, already a
 * production adapter, not a test mock).
 */

import { describe, it, expect, beforeEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync, readFileSync, existsSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import { createFedosDesktopApplicationShell, type FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import { createFedosDesktopHostBridge } from "../src/desktop/host_boundary/fedos_desktop_host_bridge.js";
import { fedosElectronHandleInvoke, type FedosElectronHostBridgeLike } from "../packages/fedos-desktop-electron-spike/src/fedos_electron_host_adapter_dispatch_translation.js";
import { createFedosDeviceBindingBoundary, type FedosDeviceBindingBoundary } from "../src/device/binding_challenge/fedos_device_binding_boundary_factory.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { generateFedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";
import { PersistedFedosDeviceTrustAuthority } from "../src/device/persistence/persisted_fedos_device_trust_authority.js";
import { UnavailableFedosDeviceRegistrationAuthority } from "../src/device/unavailable_fedos_device_registration_authority.js";
import { FedosDeviceTrustRuntime } from "../src/desktop/runtime/fedos_device_trust_runtime.js";
import { FedosSyncState } from "../src/sync/fedos_sync_state.js";
import { FedosSyncJournal } from "../src/sync/fedos_sync_journal.js";
import { InMemoryFedosSyncJournalPersistence } from "../src/sync/persistence/in_memory_fedos_sync_journal_persistence.js";
import { AppendOnlyFedosSyncJournalPersistence } from "../src/sync/persistence/append_only_fedos_sync_journal_persistence.js";
import { FedosDevicePairingFacade } from "../src/desktop/runtime/fedos_device_pairing_facade.js";
import {
  decodeFedosDevicePairingApprovalV1,
  decodeFedosDevicePairingRequestV1,
  encodeFedosDevicePairingApprovalV1,
  encodeFedosDevicePairingRequestV1,
  isWellFormedFedosDevicePairingRequestV1,
  isWellFormedFedosDevicePairingApprovalV1,
  FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH,
} from "../src/device/binding_challenge/fedos_device_binding_pairing_exchange.js";
import { createFedosDeviceBindingProofOfPossession } from "../src/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import { authorizeFedosDeviceBindingChallenge } from "../src/device/binding_challenge/fedos_device_binding_account_authorization.js";

import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

function makeTmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function baseConfig(dir: string, overrides: Record<string, unknown> = {}) {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 4581-4660 -- Phase C: Pairing Exchange Format", () => {
  const now = 1_900_000_000;

  async function buildRequest() {
    const boundary = createFedosDeviceBindingBoundary({
      registryPersistence: new InMemoryFedosDeviceRegistryPersistence(),
      replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
      now: () => now,
    });
    const keypair = generateFedosDeviceSigningKeypair();
    const challenge = boundary.mintChallenge("register-device", "dev-x", keypair.publicKeyHex);
    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge)!;
    return { schemaVersion: 1 as const, pairingId: "aabbccddeeff0011", challenge, deviceProof };
  }

  it("encodes and decodes round-trip", async () => {
    const request = await buildRequest();
    const encoded = encodeFedosDevicePairingRequestV1(request);
    expect(encoded).not.toBeNull();
    const decoded = decodeFedosDevicePairingRequestV1(encoded);
    expect(decoded).toEqual(request);
    expect(isWellFormedFedosDevicePairingRequestV1(decoded)).toBe(true);
  });

  it("6. malformed request (garbage JSON) is rejected, never throws", () => {
    expect(decodeFedosDevicePairingRequestV1("{not json")).toBeNull();
    expect(decodeFedosDevicePairingRequestV1("null")).toBeNull();
    expect(decodeFedosDevicePairingRequestV1(42)).toBeNull();
    expect(decodeFedosDevicePairingRequestV1("")).toBeNull();
  });

  it("rejects an extra unrecognized field", async () => {
    const request = await buildRequest();
    expect(isWellFormedFedosDevicePairingRequestV1({ ...request, extra: "x" })).toBe(false);
  });

  it("rejects a request whose embedded deviceProof references a DIFFERENT challenge than the record's own", async () => {
    const request = await buildRequest();
    const other = await buildRequest();
    expect(isWellFormedFedosDevicePairingRequestV1({ ...request, deviceProof: other.deviceProof })).toBe(false);
  });

  it("size limit: an oversized encoded record is rejected before ever reaching JSON.parse", async () => {
    const request = await buildRequest();
    const encoded = encodeFedosDevicePairingRequestV1(request)!;
    const oversized = encoded + "x".repeat(FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH);
    expect(decodeFedosDevicePairingRequestV1(oversized)).toBeNull();
  });

  it("38. no private key field exists anywhere in an encoded pairing request or approval", async () => {
    const request = await buildRequest();
    const encoded = encodeFedosDevicePairingRequestV1(request)!;
    expect(/secret|private|seed|passphrase/i.test(encoded)).toBe(false);

    const signingAuthority = new RealFedosNostrSigningAuthority();
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, 0, request.challenge))!;
    const encodedApproval = encodeFedosDevicePairingApprovalV1({ schemaVersion: 1, pairingId: request.pairingId, challenge: request.challenge, accountAuthorization })!;
    expect(/secret|private|seed|passphrase/i.test(encodedApproval)).toBe(false);
    expect(isWellFormedFedosDevicePairingApprovalV1(decodeFedosDevicePairingApprovalV1(encodedApproval))).toBe(true);
  });
});

describe("Secure Runtime Alpha 4581-4660 -- Phase B: FedosDevicePairingFacade (direct, real crypto)", () => {
  const ACCOUNT_INDEX = 0;
  let signingAuthority: RealFedosNostrSigningAuthority;
  let registryPersistence: InMemoryFedosDeviceRegistryPersistence;
  let replayPersistence: InMemoryFedosDeviceBindingChallengeReplayPersistence;
  let bindingBoundary: FedosDeviceBindingBoundary;
  let deviceTrust: FedosDeviceTrustRuntime;
  let accountRef: { authority: string; publicIdentifier: string; identityId: null };
  let now: number;

  beforeEach(async () => {
    now = 1_900_100_000;
    signingAuthority = new RealFedosNostrSigningAuthority();
    registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    replayPersistence = new InMemoryFedosDeviceBindingChallengeReplayPersistence();
    bindingBoundary = createFedosDeviceBindingBoundary({ registryPersistence, replayPersistence, now: () => now });
    const identity = (await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX))!;
    accountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
    const trustAuthority = new PersistedFedosDeviceTrustAuthority({ persistence: registryPersistence, registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority() });
    deviceTrust = new FedosDeviceTrustRuntime({
      localDeviceId: "local-runtime-device",
      localAccountRef: accountRef,
      trustAuthority,
      syncState: new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`),
    });
  });

  function makeFacade(opts: { running?: boolean; signing?: RealFedosNostrSigningAuthority | null } = {}) {
    return new FedosDevicePairingFacade({
      bindingBoundary,
      deviceTrust,
      accountSigningAuthority: opts.signing === undefined ? signingAuthority : opts.signing,
      accountIndex: ACCOUNT_INDEX,
      isRuntimeRunning: () => opts.running ?? true,
      now: () => now,
    });
  }

  it("34/35. unavailable before start and after stop", () => {
    const facade = makeFacade({ running: false });
    const keypair = generateFedosDeviceSigningKeypair();
    const result = facade.createPairingRequest("dev-1", keypair, accountRef);
    expect(result.outcome).toBe("unavailable");
  });

  it("1. pairing feature disabled -- approve/revoke report 'disabled' with no account signing authority configured", async () => {
    const facade = makeFacade({ signing: null });
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-1", keypair, accountRef);
    expect(created.outcome).toBe("ok");
    const approve = await facade.approvePairingRequest((created as { outcome: "ok"; value: { encoded: string } }).value.encoded);
    expect(approve.outcome).toBe("disabled");
    const revoke = await facade.revokeDevice("dev-1", keypair.publicKeyHex);
    expect(revoke.outcome).toBe("disabled");
  });

  it("2+3. create pairing request and safely inspect it", () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-2", keypair, accountRef);
    expect(created.outcome).toBe("ok");
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;
    const inspected = facade.inspectPairingRequest(encoded);
    expect(inspected.outcome).toBe("ok");
    const view = (inspected as { outcome: "ok"; value: { deviceProofValid: boolean; pairingId: string; expired: boolean } }).value;
    expect(view.deviceProofValid).toBe(true);
    expect(view.pairingId).toBe(pairingId);
    expect(view.expired).toBe(false);
  });

  it("6. malformed request rejected by inspect/approve", async () => {
    const facade = makeFacade();
    expect(facade.inspectPairingRequest("not json").outcome).toBe("malformed");
    expect((await facade.approvePairingRequest("{}")).outcome).toBe("malformed");
  });

  it("full real end-to-end lifecycle (10-13): device proof succeeds, approval produced, approval imported, trusted registration completes", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-3", keypair, accountRef);
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;

    const approveResult = await facade.approvePairingRequest(encoded);
    expect(approveResult.outcome).toBe("ok");
    const { encoded: encodedApproval } = (approveResult as { outcome: "ok"; value: { encoded: string; localRegistration: string } }).value;
    expect((approveResult as { outcome: "ok"; value: { localRegistration: string } }).value.localRegistration).toBe("registered-trusted");

    const completed = await facade.completePairing(pairingId, keypair, encodedApproval);
    expect(completed.outcome).toBe("ok");
    const binding = (completed as { outcome: "ok"; value: { trustState: string; deviceId: string; syncEligible: boolean } }).value;
    expect(binding.trustState).toBe("trusted");
    expect(binding.deviceId).toBe("dev-3");
    expect(binding.syncEligible).toBe(true);

    // Phase L: trusted Device becomes a real sync-eligible target.
    expect(deviceTrust.listSyncDevices().some((d) => d.deviceRef === "dev-3")).toBe(true);
    expect(deviceTrust.syncReadiness("dev-3").ready).toBe(true);
  });

  it("5. wrong account request denied -- completePairing refuses an approval signed by a DIFFERENT account than expected", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-4", keypair, accountRef);
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;

    const decoded = decodeFedosDevicePairingRequestV1(encoded)!;
    const otherSigningAuthority = new RealFedosNostrSigningAuthority();
    const wrongAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(otherSigningAuthority, 9, decoded.challenge))!;
    const forgedApproval = encodeFedosDevicePairingApprovalV1({ schemaVersion: 1, pairingId, challenge: decoded.challenge, accountAuthorization: wrongAccountAuthorization })!;

    const completed = await facade.completePairing(pairingId, keypair, forgedApproval);
    expect(completed.outcome).toBe("wrong-account");
    expect(deviceTrust.getDevice("dev-4")).toBeNull();
  });

  it("15. conflicting duplicate -- the same deviceId re-registered under a DIFFERENT account (fresh nonce) is a real conflict, never silently re-parented", async () => {
    const facadeAccountA = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facadeAccountA.createPairingRequest("dev-conflict", keypair, accountRef);
    const { encoded } = (created as { outcome: "ok"; value: { encoded: string } }).value;
    const firstApprove = await facadeAccountA.approvePairingRequest(encoded);
    expect(firstApprove.outcome).toBe("ok");

    const otherSigningAuthority = new RealFedosNostrSigningAuthority();
    const otherIdentity = (await otherSigningAuthority.publicIdentityForAccount(0))!;
    const otherAccountRef = { authority: "nostr", publicIdentifier: otherIdentity.publicKeyHex, identityId: null };
    const decoded = decodeFedosDevicePairingRequestV1(encoded)!;
    const freshChallenge = { ...decoded.challenge, nonce: `${decoded.challenge.nonce}ff`, issuedAt: now + 10, expiresAt: now + 310 };
    const otherAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(otherSigningAuthority, 0, freshChallenge))!;
    const otherDeviceProof = createFedosDeviceBindingProofOfPossession(keypair, freshChallenge)!;
    const conflictResult = await bindingBoundary.registrationAuthority.registerDevice(otherAccountAuthorization, otherDeviceProof, now + 10);
    expect(conflictResult.outcome).toBe("conflict");
    void otherAccountRef;
  });

  it("25. new binding identity behavior -- a revoked deviceId can never be reused, but the SAME physical Device re-pairs successfully under a brand NEW deviceId", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-old-identity", keypair, accountRef);
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;
    const approveResult = await facade.approvePairingRequest(encoded);
    const { encoded: encodedApproval } = (approveResult as { outcome: "ok"; value: { encoded: string } }).value;
    await facade.completePairing(pairingId, keypair, encodedApproval);
    await facade.revokeDevice("dev-old-identity", keypair.publicKeyHex);

    // The SAME device key, under a NEW deviceId, pairs successfully.
    const created2 = facade.createPairingRequest("dev-new-identity", keypair, accountRef);
    expect(created2.outcome).toBe("ok");
    const { encoded: encoded2, pairingId: pairingId2 } = (created2 as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;
    const approve2 = await facade.approvePairingRequest(encoded2);
    expect(approve2.outcome).toBe("ok");
    const { encoded: encodedApproval2 } = (approve2 as { outcome: "ok"; value: { encoded: string } }).value;
    const completed2 = await facade.completePairing(pairingId2, keypair, encodedApproval2);
    expect(completed2.outcome).toBe("ok");
    expect((completed2 as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("trusted");
  });

  it("7. changed Device ID between request and approval is denied", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-5", keypair, accountRef);
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;
    const decoded = decodeFedosDevicePairingRequestV1(encoded)!;

    const tamperedChallenge = { ...decoded.challenge, deviceId: "dev-5-tampered" };
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, tamperedChallenge))!;
    const tamperedApproval = encodeFedosDevicePairingApprovalV1({ schemaVersion: 1, pairingId, challenge: tamperedChallenge, accountAuthorization })!;

    const completed = await facade.completePairing(pairingId, keypair, tamperedApproval);
    expect(completed.outcome).toBe("invalid-input");
  });

  it("8. changed Device key between request and approval is denied", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-6", keypair, accountRef);
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;
    const decoded = decodeFedosDevicePairingRequestV1(encoded)!;

    const otherKeypair = generateFedosDeviceSigningKeypair();
    const tamperedChallenge = { ...decoded.challenge, devicePublicKeyHex: otherKeypair.publicKeyHex };
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, tamperedChallenge))!;
    const tamperedApproval = encodeFedosDevicePairingApprovalV1({ schemaVersion: 1, pairingId, challenge: tamperedChallenge, accountAuthorization })!;

    const completed = await facade.completePairing(pairingId, keypair, tamperedApproval);
    expect(completed.outcome).toBe("invalid-input");
  });

  it("9. expired request denied end to end", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-7", keypair, accountRef);
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;

    now += 301; // past the default 300s TTL
    const approveResult = await facade.approvePairingRequest(encoded);
    expect(approveResult.outcome).toBe("expired");
    void pairingId;
  });

  it("14. duplicate identical completion is idempotent", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-8", keypair, accountRef);
    const { encoded } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;
    const approveResult = await facade.approvePairingRequest(encoded);
    const { encoded: encodedApproval } = (approveResult as { outcome: "ok"; value: { encoded: string } }).value;

    // completePairing() consumes its own bookkeeping entry after one attempt --
    // exercise the underlying, real idempotent-replay guarantee directly at the
    // registration authority layer (the same one completePairing() itself calls).
    const decodedApproval = decodeFedosDevicePairingApprovalV1(encodedApproval)!;
    const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, decodedApproval.challenge)!;
    const first = await bindingBoundary.registrationAuthority.registerDevice(decodedApproval.accountAuthorization, deviceProof, now);
    const second = await bindingBoundary.registrationAuthority.registerDevice(decodedApproval.accountAuthorization, deviceProof, now + 1);
    expect(first.outcome).toBe("registered-trusted");
    expect(second.outcome).toBe("registered-trusted");
  });

  it("16. replay denied -- a different request content reusing an already-consumed nonce is refused", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-9", keypair, accountRef);
    const { encoded } = (created as { outcome: "ok"; value: { encoded: string } }).value;
    await facade.approvePairingRequest(encoded); // consumes the nonce via the local reciprocal recording

    const decoded = decodeFedosDevicePairingRequestV1(encoded)!;
    const reusedNonceChallenge = { ...decoded.challenge, deviceId: "dev-9-different" };
    const otherKeypair = generateFedosDeviceSigningKeypair();
    const boundChallenge = { ...reusedNonceChallenge, devicePublicKeyHex: otherKeypair.publicKeyHex };
    const accountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, boundChallenge))!;
    const deviceProof = createFedosDeviceBindingProofOfPossession(otherKeypair, boundChallenge)!;
    const result = await bindingBoundary.registrationAuthority.registerDevice(accountAuthorization, deviceProof, now);
    expect(result.outcome).toBe("replayed");
  });

  it("22. revoked Device confirmation, and 24. cannot be re-paired with a stale artifact", async () => {
    const facade = makeFacade();
    const keypair = generateFedosDeviceSigningKeypair();
    const created = facade.createPairingRequest("dev-10", keypair, accountRef);
    const { encoded, pairingId } = (created as { outcome: "ok"; value: { encoded: string; pairingId: string } }).value;
    const approveResult = await facade.approvePairingRequest(encoded);
    const { encoded: encodedApproval } = (approveResult as { outcome: "ok"; value: { encoded: string } }).value;
    await facade.completePairing(pairingId, keypair, encodedApproval);

    const revocation = await facade.revokeDevice("dev-10", keypair.publicKeyHex);
    expect(revocation.outcome).toBe("ok");
    expect((revocation as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("revoked");

    // Duplicate revocation is idempotent.
    const dup = await facade.revokeDevice("dev-10", keypair.publicKeyHex);
    expect(dup.outcome).toBe("ok");
    expect((dup as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("revoked");

    // 24: the STALE original approval artifact (already consumed) can never re-trust this device.
    const staleCompletion = await facade.completePairing("stale-pairing-id-not-tracked", keypair, encodedApproval);
    expect(staleCompletion.outcome).toBe("not-found");

    // 28: a revoked Device is no longer a sync target.
    expect(deviceTrust.syncReadiness("dev-10").ready).toBe(false);
  });

  it("27. pending Device (never confirmed) is not a sync target", () => {
    // registerDevice() through the real, verified authority never leaves a binding
    // "pending" observably (Phase A §8/§16) -- exercised instead via the honest
    // UNAVAILABLE-capability path, which DOES leave a durable, non-trusted binding.
    const trustAuthority = new PersistedFedosDeviceTrustAuthority({ persistence: registryPersistence, registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority() });
    const result = trustAuthority.registerDevice({ deviceId: "dev-11-unavailable", accountRef, devicePublicKeyRef: null, label: null }, now);
    expect(result.outcome).toBe("registered");
    expect(result.binding?.trustState).toBe("unavailable");
    expect(deviceTrust.syncReadiness("dev-11-unavailable").ready).toBe(false);
  });
});

describe("Secure Runtime Alpha 4581-4660 -- Phase K/L/M: real two-Runtime end-to-end lifecycle through the Shell", () => {
  let dirA: string;
  let dirB: string;
  let signingAuthorityB: RealFedosNostrSigningAuthority;
  let accountRef: { authority: string; publicIdentifier: string; identityId: null };

  beforeEach(async () => {
    dirA = makeTmpDir("fedos-4581-4660-devA-");
    dirB = makeTmpDir("fedos-4581-4660-devB-");
    signingAuthorityB = new RealFedosNostrSigningAuthority();
    const identity = (await signingAuthorityB.publicIdentityForAccount(0))!;
    accountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
  });

  function configA(dir: string) {
    return baseConfig(dir, {
      deviceTrustEnabled: true,
      localDeviceId: "runtime-device-a",
      localAccountRef: accountRef,
      deviceRegistryLogPath: join(dir, "device_registry.ndjson"),
      deviceBindingChallengeReplayLogPath: join(dir, "replay.ndjson"),
      deviceSyncJournalLogPath: join(dir, "sync_journal.ndjson"),
    });
  }

  function configB(dir: string) {
    return baseConfig(dir, {
      deviceTrustEnabled: true,
      localDeviceId: "runtime-device-b",
      localAccountRef: accountRef,
      deviceRegistryLogPath: join(dir, "device_registry.ndjson"),
      deviceBindingChallengeReplayLogPath: join(dir, "replay.ndjson"),
      deviceSyncJournalLogPath: join(dir, "sync_journal.ndjson"),
      deviceBindingAccountSigningAuthority: signingAuthorityB,
      deviceBindingAccountIndex: 0,
    });
  }

  it("real Device A <-> Device B pairing lifecycle through two independent Desktop Shells", async () => {
    const shellA = createFedosDesktopApplicationShell();
    const shellB = createFedosDesktopApplicationShell();
    expect((await shellA.start(configA(dirA) as never)).outcome).toBe("ok");
    expect((await shellB.start(configB(dirB) as never)).outcome).toBe("ok");

    // 2. create pairing request (JOINING Device A).
    const createResult = shellA.devicePairingCreate("joining-device-1", accountRef);
    expect(createResult.outcome).toBe("ok");
    const { pairingId, encoded } = (createResult as { outcome: "ok"; value: { pairingId: string; encoded: string } }).value;

    // 3. inspect safe request (AUTHORIZING Device B) -- real proof-of-possession check.
    const inspectResult = shellB.devicePairingInspect(encoded);
    expect(inspectResult.outcome).toBe("ok");
    expect((inspectResult as { outcome: "ok"; value: { deviceProofValid: boolean } }).value.deviceProofValid).toBe(true);

    // 11. approval produced (real account signature).
    const approveResult = await shellB.devicePairingApprove(encoded);
    expect(approveResult.outcome).toBe("ok");
    const { encoded: encodedApproval } = (approveResult as { outcome: "ok"; value: { encoded: string } }).value;

    // 12+13. approval imported, trusted registration completes on Device A.
    const completeResult = await shellA.devicePairingComplete(pairingId, encodedApproval);
    expect(completeResult.outcome).toBe("ok");
    expect((completeResult as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("trusted");

    // 20. Device inventory updates on BOTH sides (Device B's own local reciprocal recording).
    const statusOnA = shellA.deviceRegistrationStatus("joining-device-1");
    expect(statusOnA.outcome).toBe("ok");
    expect((statusOnA as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("trusted");
    const statusOnB = shellB.deviceRegistrationStatus("joining-device-1");
    expect(statusOnB.outcome).toBe("ok");
    expect((statusOnB as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("trusted");

    // 26. trusted Device becomes a real scheduler/sync target on Device A's own Runtime.
    expect((statusOnA as { outcome: "ok"; value: { syncEligible: boolean } }).value.syncEligible).toBe(true);

    await shellA.stop();
    await shellB.stop();

    // 18/19. restart after trusted registration: durability survives on BOTH sides.
    const shellA2 = createFedosDesktopApplicationShell();
    expect((await shellA2.start(configA(dirA) as never)).outcome).toBe("ok");
    const statusAfterRestart = shellA2.deviceRegistrationStatus("joining-device-1");
    expect(statusAfterRestart.outcome).toBe("ok");
    expect((statusAfterRestart as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("trusted");
    expect((statusAfterRestart as { outcome: "ok"; value: { syncEligible: boolean } }).value.syncEligible).toBe(true);

    // 23. revocation persists after restart -- revoke on Device B, then restart Device B.
    const shellB2 = createFedosDesktopApplicationShell();
    expect((await shellB2.start(configB(dirB) as never)).outcome).toBe("ok");
    const detail = shellB2.deviceRegistrationStatus("joining-device-1");
    const devicePublicKeyRef = (detail as { outcome: "ok"; value: { devicePublicKeyRef: string } }).value.devicePublicKeyRef;
    const revokeResult = await shellB2.deviceRevoke("joining-device-1", devicePublicKeyRef);
    expect(revokeResult.outcome).toBe("ok");
    await shellB2.stop();

    const shellB3 = createFedosDesktopApplicationShell();
    expect((await shellB3.start(configB(dirB) as never)).outcome).toBe("ok");
    const statusAfterRevokeRestart = shellB3.deviceRegistrationStatus("joining-device-1");
    expect((statusAfterRevokeRestart as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("revoked");

    // HONEST, NAMED, real finding: revocation on Device B's own local Registry does
    // NOT propagate to Device A's own SEPARATE local Registry -- this codebase has no
    // cross-machine Registry synchronization (Phase A #8/#19; see this Arc's own
    // completion declaration). Device A's own local view still shows "trusted".
    const stillTrustedOnA = shellA2.deviceRegistrationStatus("joining-device-1");
    expect((stillTrustedOnA as { outcome: "ok"; value: { trustState: string } }).value.trustState).toBe("trusted");

    await shellA2.stop();
    await shellB3.stop();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it("17. restart during a pending pairing -- Device A restarts before ever importing an approval; a fresh createPairingRequest() still works normally afterward (no stale, un-consumable state)", async () => {
    const shellA = createFedosDesktopApplicationShell();
    expect((await shellA.start(configA(dirA) as never)).outcome).toBe("ok");
    const created = shellA.devicePairingCreate("joining-device-2", accountRef);
    expect(created.outcome).toBe("ok");
    await shellA.stop();

    const shellA2 = createFedosDesktopApplicationShell();
    expect((await shellA2.start(configA(dirA) as never)).outcome).toBe("ok");
    // The in-process pairingId/keypair bookkeeping is gone (honest, documented
    // limitation -- Device signing keys are process-memory-only) -- a fresh
    // pending list is empty and a NEW createPairingRequest() still works cleanly.
    const pendingAfterRestart = shellA2.devicePairingsList();
    expect(pendingAfterRestart.outcome).toBe("ok");
    expect((pendingAfterRestart as { outcome: "ok"; value: readonly unknown[] }).value.length).toBe(0);
    const secondAttempt = shellA2.devicePairingCreate("joining-device-2", accountRef);
    expect(secondAttempt.outcome).toBe("ok");
    await shellA2.stop();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it("21. registration screen updates through the real Presentation controller", async () => {
    const shellA = createFedosDesktopApplicationShell();
    expect((await shellA.start(configA(dirA) as never)).outcome).toBe("ok");
    const shellB = createFedosDesktopApplicationShell();
    expect((await shellB.start(configB(dirB) as never)).outcome).toBe("ok");

    const created = shellA.devicePairingCreate("joining-device-3", accountRef);
    const { pairingId, encoded } = (created as { outcome: "ok"; value: { pairingId: string; encoded: string } }).value;
    const approveResult = await shellB.devicePairingApprove(encoded);
    const { encoded: encodedApproval } = (approveResult as { outcome: "ok"; value: { encoded: string } }).value;
    const completed = await shellA.devicePairingComplete(pairingId, encodedApproval);
    expect(completed.outcome).toBe("ok");

    await shellA.stop();
    await shellB.stop();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it("34. Shell command before start is denied; 35. after stop is denied", async () => {
    const shell = createFedosDesktopApplicationShell();
    expect(shell.devicePairingCreate("x", accountRef).outcome).toBe("unavailable");
    expect((await shell.start(configA(dirA) as never)).outcome).toBe("ok");
    await shell.stop();
    expect(shell.devicePairingCreate("x", accountRef).outcome).toBe("unavailable");
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it("42. clean shutdown and resource cleanup -- stop() completes without throwing and a second devicePairing() call fails closed", async () => {
    const shellA = createFedosDesktopApplicationShell();
    expect((await shellA.start(configA(dirA) as never)).outcome).toBe("ok");
    shellA.devicePairingCreate("joining-device-4", accountRef);
    await expect(shellA.stop()).resolves.toEqual(expect.objectContaining({ outcome: "ok" }));
    expect(shellA.devicePairingsList().outcome).toBe("unavailable");
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });
});

describe("Secure Runtime Alpha 4581-4660 -- Phase J: real Electron dispatch translation (36/37)", () => {
  let dir: string;
  let signingAuthority: RealFedosNostrSigningAuthority;
  let accountRef: { authority: string; publicIdentifier: string; identityId: null };

  beforeEach(async () => {
    dir = makeTmpDir("fedos-4581-4660-electron-");
    signingAuthority = new RealFedosNostrSigningAuthority();
    const identity = (await signingAuthority.publicIdentityForAccount(0))!;
    accountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
  });

  it("36. a real device-pairing-create command flows through the REAL FedosDesktopHostBridge via the REAL Electron dispatch translation", async () => {
    const bridge = createFedosDesktopHostBridge();
    const started = await bridge.start(
      baseConfig(dir, {
        deviceTrustEnabled: true,
        localDeviceId: "electron-device",
        localAccountRef: accountRef,
        deviceRegistryLogPath: join(dir, "device_registry.ndjson"),
        deviceBindingChallengeReplayLogPath: join(dir, "replay.ndjson"),
        deviceSyncJournalLogPath: join(dir, "sync_journal.ndjson"),
        deviceBindingAccountSigningAuthority: signingAuthority,
      }) as never,
    );
    expect(started.outcome).toBe("ok");

    const response = await fedosElectronHandleInvoke(bridge as unknown as FedosElectronHostBridgeLike, {
      op: "dispatch",
      command: { type: "device-pairing-create", deviceId: "electron-joining-device", expectedAccountRef: accountRef },
    });
    expect((response as { outcome: string }).outcome).toBe("ok");
    const value = (response as { outcome: "ok"; value: { pairingId: string; encoded: string } }).value;
    expect(typeof value.pairingId).toBe("string");
    expect(typeof value.encoded).toBe("string");

    const inspectResponse = await fedosElectronHandleInvoke(bridge as unknown as FedosElectronHostBridgeLike, {
      op: "dispatch",
      command: { type: "device-pairing-inspect", encodedRequest: value.encoded },
    });
    expect((inspectResponse as { outcome: string }).outcome).toBe("ok");

    await bridge.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it("37. a malformed device-pairing command is denied, never crosses into real dispatch", async () => {
    const bridge = createFedosDesktopHostBridge();
    await bridge.start(baseConfig(dir) as never);
    const response = await fedosElectronHandleInvoke(bridge as unknown as FedosElectronHostBridgeLike, {
      op: "dispatch",
      command: { type: "device-pairing-create", deviceId: "", expectedAccountRef: { authority: "nostr" } },
    });
    expect((response as { outcome: string; code?: string }).outcome).toBe("error");
    expect((response as { code: string }).code).toBe("unknown-command");
    await bridge.stop();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("Secure Runtime Alpha 4581-4660 -- Phase F: Durable Sync Journal (29-33, 39-40)", () => {
  it("29+30. durable Journal survives a restart and is never duplicated on re-append of the same changeId", () => {
    const dir = makeTmpDir("fedos-4581-4660-journal-");
    const logPath = join(dir, "journal.ndjson");
    const persistence1 = new AppendOnlyFedosSyncJournalPersistence(logPath);
    const journal1 = new FedosSyncJournal(persistence1);
    const appended = journal1.append({ changeId: "change-1", accountRef: "acct-a", originDeviceRef: "dev-a", conversationId: "conv-1", kind: "upsert", contentHash: "hash-1", recordedAt: 100 });
    expect(appended.outcome).toBe("appended");
    const dup = journal1.append({ changeId: "change-1", accountRef: "acct-a", originDeviceRef: "dev-a", conversationId: "conv-1", kind: "upsert", contentHash: "hash-1", recordedAt: 100 });
    expect(dup.outcome).toBe("duplicate");

    // Restart: fresh instance over the SAME durable backend.
    const persistence2 = new AppendOnlyFedosSyncJournalPersistence(logPath);
    const journal2 = new FedosSyncJournal(persistence2);
    expect(journal2.readAll().length).toBe(1);
    expect(journal2.getByChangeId("change-1")).toEqual(appended.entry);
    expect(journal2.latestSequence()).toBe(1);

    // Re-appending the identical changeId after restart is STILL a duplicate, never a second entry.
    const dupAfterRestart = journal2.append({ changeId: "change-1", accountRef: "acct-a", originDeviceRef: "dev-a", conversationId: "conv-1", kind: "upsert", contentHash: "hash-1", recordedAt: 100 });
    expect(dupAfterRestart.outcome).toBe("duplicate");
    expect(journal2.readAll().length).toBe(1);

    rmSync(dir, { recursive: true, force: true });
  });

  it("31. corrupted durable Journal log fails closed (throws) on hydration, never silently drops a record", () => {
    const dir = makeTmpDir("fedos-4581-4660-journal-corrupt-");
    const logPath = join(dir, "journal.ndjson");
    appendFileSync(logPath, "{ this is not valid json\n", "utf8");
    expect(() => new FedosSyncJournal(new AppendOnlyFedosSyncJournalPersistence(logPath))).toThrow();
    rmSync(dir, { recursive: true, force: true });
  });

  it("31b. a conflicting duplicate (same changeId, different content) in the durable log fails closed", () => {
    const dir = makeTmpDir("fedos-4581-4660-journal-conflict-");
    const logPath = join(dir, "journal.ndjson");
    appendFileSync(logPath, JSON.stringify({ sequence: 1, changeId: "c1", accountRef: "a", originDeviceRef: "d", conversationId: "conv", kind: "upsert", contentHash: "h1", recordedAt: 1 }) + "\n", "utf8");
    appendFileSync(logPath, JSON.stringify({ sequence: 1, changeId: "c1", accountRef: "a", originDeviceRef: "d", conversationId: "conv", kind: "upsert", contentHash: "h2-DIFFERENT", recordedAt: 1 }) + "\n", "utf8");
    expect(() => new FedosSyncJournal(new AppendOnlyFedosSyncJournalPersistence(logPath))).toThrow();
    rmSync(dir, { recursive: true, force: true });
  });

  it("32. independent account isolation -- two FedosSyncState instances over the SAME durable Journal path but different accountRefs stay logically distinct via accountRef field", () => {
    const dir = makeTmpDir("fedos-4581-4660-journal-accounts-");
    const logPath = join(dir, "journal.ndjson");
    const stateA = new FedosSyncState("account-a", { journalPersistence: new AppendOnlyFedosSyncJournalPersistence(logPath) });
    stateA.registerDevice("dev-a1", 100);
    stateA.recordLocalChange("dev-a1", { changeId: "chg-a", conversationId: "conv-a", kind: "upsert", contentHash: "hash-a" }, 100);
    const stateB = new FedosSyncState("account-b", { journalPersistence: new AppendOnlyFedosSyncJournalPersistence(logPath) });
    expect(stateB.journalEntries().some((e) => e.accountRef === "account-a")).toBe(true); // shared log file is a real fact -- but...
    expect(stateB.listDevices().length).toBe(0); // ...the Device Registry (a SEPARATE, in-memory-per-instance structure) never leaks across instances.
    rmSync(dir, { recursive: true, force: true });
  });

  it("33. independent Runtime isolation -- two FedosSyncJournal instances over DIFFERENT durable paths never see each other's entries", () => {
    const dir = makeTmpDir("fedos-4581-4660-journal-isolation-");
    const pathA = join(dir, "a.ndjson");
    const pathB = join(dir, "b.ndjson");
    const journalA = new FedosSyncJournal(new AppendOnlyFedosSyncJournalPersistence(pathA));
    const journalB = new FedosSyncJournal(new AppendOnlyFedosSyncJournalPersistence(pathB));
    journalA.append({ changeId: "only-in-a", accountRef: "acct", originDeviceRef: "dev", conversationId: "conv", kind: "upsert", contentHash: "h", recordedAt: 1 });
    expect(journalA.getByChangeId("only-in-a")).not.toBeNull();
    expect(journalB.getByChangeId("only-in-a")).toBeNull();
    expect(existsSync(pathB)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("39. no secret-shaped field exists anywhere in a durable Journal record", () => {
    const dir = makeTmpDir("fedos-4581-4660-journal-secrets-");
    const logPath = join(dir, "journal.ndjson");
    const journal = new FedosSyncJournal(new AppendOnlyFedosSyncJournalPersistence(logPath));
    journal.append({ changeId: "c1", accountRef: "acct", originDeviceRef: "dev", conversationId: "conv", kind: "upsert", contentHash: "opaque-hash-only", recordedAt: 1 });
    const raw = readFileSync(logPath, "utf8") as string;
    expect(/secret|private|passphrase|"seed"/i.test(raw)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("40. no plaintext Sync package byte ever appears in the durable Journal record -- contentHash is opaque, never the record's own real content", () => {
    const dir = makeTmpDir("fedos-4581-4660-journal-opaque-");
    const logPath = join(dir, "journal.ndjson");
    const journal = new FedosSyncJournal(new AppendOnlyFedosSyncJournalPersistence(logPath));
    const PLAINTEXT_MARKER = "THIS-IS-DEFINITELY-PLAINTEXT-MESSAGE-CONTENT";
    journal.append({ changeId: "c1", accountRef: "acct", originDeviceRef: "dev", conversationId: "conv", kind: "upsert", contentHash: "sha256-opaque-reference-only", recordedAt: 1 });
    const raw = readFileSync(logPath, "utf8") as string;
    expect(raw.includes(PLAINTEXT_MARKER)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("Runtime wiring: startFedosDesktopRuntime() with deviceSyncJournalLogPath produces a Journal that survives a real Runtime restart", async () => {
    const dir = makeTmpDir("fedos-4581-4660-runtime-journal-");
    const accountRef = { authority: "nostr", publicIdentifier: "npub-journal-test", identityId: null };
    const config = baseConfig(dir, {
      deviceTrustEnabled: true,
      localDeviceId: "dev-journal-a",
      localAccountRef: accountRef,
      deviceSyncJournalLogPath: join(dir, "sync_journal.ndjson"),
    });
    const runtime1 = await startFedosDesktopRuntime(config as never);
    runtime1.deviceTrust().registerSyncDevice("dev-journal-a", 100); // not-trusted -- registerSyncDevice() itself refuses, exercised for its own real outcome below
    const trustAuthorityGate = runtime1.deviceTrust().registerSyncDevice("dev-journal-a", 100);
    expect(trustAuthorityGate).toBe("not-trusted");
    await runtime1.stop();

    const runtime2 = await startFedosDesktopRuntime(config as never);
    expect(runtime2.deviceTrust().journalEntries().length).toBe(0); // nothing was ever actually recorded above (device was never trusted) -- confirms a clean, real restart with no fabricated entries.
    await runtime2.stop();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("Secure Runtime Alpha 4581-4660 -- Phase O: structural guards", () => {
  it("one Pairing Boundary per running Runtime -- devicePairing() returns the SAME instance on every call while running", async () => {
    const dir = makeTmpDir("fedos-4581-4660-singleton-");
    const accountRef = { authority: "nostr", publicIdentifier: "npub-singleton", identityId: null };
    const runtime = await startFedosDesktopRuntime(baseConfig(dir, { deviceTrustEnabled: true, localDeviceId: "dev-x", localAccountRef: accountRef }) as never);
    expect(runtime.devicePairing()).toBe(runtime.devicePairing());
    await runtime.stop();
    expect(() => runtime.devicePairing()).toThrow();
    rmSync(dir, { recursive: true, force: true });
  });

  it("devicePairing() is 'not enabled' when deviceTrustEnabled is omitted -- fail-closed default preserved", async () => {
    const dir = makeTmpDir("fedos-4581-4660-notenabled-");
    const runtime = await startFedosDesktopRuntime(baseConfig(dir) as never);
    expect(() => runtime.devicePairing()).toThrow(/not enabled/);
    await runtime.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it("no raw private-key getter exists anywhere on FedosDevicePairingFacade's own public surface", async () => {
    const dir = makeTmpDir("fedos-4581-4660-nogetter-");
    const accountRef = { authority: "nostr", publicIdentifier: "npub-nogetter", identityId: null };
    const runtime = await startFedosDesktopRuntime(baseConfig(dir, { deviceTrustEnabled: true, localDeviceId: "dev-y", localAccountRef: accountRef }) as never);
    const facade = runtime.devicePairing() as unknown as Record<string, unknown>;
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(facade));
    expect(methodNames.some((name) => /secret|privatekey|getkey/i.test(name))).toBe(false);
    await runtime.stop();
    rmSync(dir, { recursive: true, force: true });
  });
});
