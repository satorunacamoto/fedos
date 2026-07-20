import { describe, it, expect, vi } from "vitest";
import { createFedosDeviceSyncRuntime, FedosDeviceSyncRuntime } from "../src/device/runtime/fedos_device_sync_runtime.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { generateFedosDeviceSigningKeypair, type FedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";
import { authorizeFedosDeviceBindingChallenge } from "../src/device/binding_challenge/fedos_device_binding_account_authorization.js";
import { createFedosDeviceBindingProofOfPossession } from "../src/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import type { FedosDeviceRegistryPersistence } from "../src/device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import { prepareFedosDeviceSyncSession } from "../src/device/sync_session/fedos_device_sync_session.js";
import {
  FedosWasmDeviceSyncPackageEncryptionAuthority,
  type FedosDeviceSyncPackageEncryptionAuthority,
  type FedosDeviceSyncPackageEncryptionRuntimeBoundary,
} from "../src/device/sync_package/fedos_device_sync_package_encryption.js";
import { createFedosDeviceTransferProof } from "../src/device/transfer/fedos_device_transfer_proof.js";
import { createFedosDeviceTransferCoordinator, FedosDeviceTransferCoordinator } from "../src/device/transfer/fedos_device_transfer_coordinator.js";
import { InMemoryFedosDeviceTransferSessionPersistence } from "../src/device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.js";
import type { FedosDeviceTransferPackageV1 } from "../src/device/transfer/fedos_device_transfer_package.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";

const NOW = 1_800_000_000;
const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

async function registerRealDevice(
  runtime: FedosDeviceSyncRuntime,
  signingAuthority: RealFedosNostrSigningAuthority,
  accountIndex: number,
  deviceId: string,
  now: number,
): Promise<FedosDeviceSigningKeypair> {
  const keypair = generateFedosDeviceSigningKeypair();
  const challenge = runtime.mintChallenge("register-device", deviceId, keypair.publicKeyHex);
  const accountAuthorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, accountIndex, challenge);
  if (accountAuthorization === null) throw new Error("unreachable");
  const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge);
  if (deviceProof === null) throw new Error("unreachable");
  const result = await runtime.registerDevice(accountAuthorization, deviceProof, now);
  if (result.outcome !== "registered-trusted") throw new Error(`unreachable: ${result.outcome}`);
  return keypair;
}

function fakeMasterSeedAuthority(resolveConversationKey: FedosMasterSeedAuthority["resolveConversationKey"]): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey,
  };
}

/** A REAL (in-memory, not cryptographic) round-trip fake -- mirrors `fakeRoundTrippingRuntimeBoundary()` in `secure_runtime_alpha_3321_3400_sync_session_and_package.test.ts`, exercising build()->read() end to end without a compiled WASM artifact (this checkout has no `pkg/` -- see `project_worktree_missing_wasm_artifact`). */
function fakeRoundTrippingRuntimeBoundary(
  overrides: Partial<FedosDeviceSyncPackageEncryptionRuntimeBoundary> = {},
): FedosDeviceSyncPackageEncryptionRuntimeBoundary {
  const byHandle = new Map<string, Uint8Array>();
  const byWire = new Map<string, string>();
  let counter = 0;
  return {
    encrypt: vi.fn(async (_key, _algorithm, _aadDomain, plaintext) => {
      counter += 1;
      const id = `handle-${counter}`;
      byHandle.set(id, plaintext);
      return { kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle;
    }),
    exportCiphertext: vi.fn(async (ciphertext) => {
      const id = (ciphertext as unknown as { id: string }).id;
      const wire = `wire-${id}`;
      byWire.set(wire, id);
      return wire as unknown as AeadCiphertextWire;
    }),
    importCiphertext: vi.fn(async (wire) => {
      const id = byWire.get(wire as unknown as string);
      if (id === undefined) return null;
      return { kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle;
    }),
    decrypt: vi.fn(async (_key, _algorithm, _aadDomain, ciphertext) => {
      const id = (ciphertext as unknown as { id: string }).id;
      return byHandle.get(id) ?? null;
    }),
    ...overrides,
  };
}

interface Fixture {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly coordinator: FedosDeviceTransferCoordinator;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly initiatorKeypair: FedosDeviceSigningKeypair;
  readonly responderKeypair: FedosDeviceSigningKeypair;
  readonly encryptionAuthority: FedosDeviceSyncPackageEncryptionAuthority;
}

async function buildFixture(now = NOW): Promise<Fixture> {
  const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
  const runtime = createFedosDeviceSyncRuntime({
    registryPersistence,
    replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
    now: () => now,
  });
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const initiatorKeypair = await registerRealDevice(runtime, signingAuthority, 0, "phone", now);
  const responderKeypair = await registerRealDevice(runtime, signingAuthority, 0, "laptop", now);
  const identity = await signingAuthority.publicIdentityForAccount(0);
  const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };

  const coordinator = createFedosDeviceTransferCoordinator({
    sessionPersistence: new InMemoryFedosDeviceTransferSessionPersistence(),
    registryPersistence,
    now: () => now,
  });

  const encryptionAuthority = new FedosWasmDeviceSyncPackageEncryptionAuthority(
    fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
    fakeRoundTrippingRuntimeBoundary(),
  );

  return { registryPersistence, coordinator, accountRef, initiatorKeypair, responderKeypair, encryptionAuthority };
}

/** Drives a fixture through invited -> challenged -> approved, returning the sessionId and Approval needed to build a Transfer Package. */
async function driveToApproved(f: Fixture, now = NOW) {
  const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", now);
  const challenged = f.coordinator.issueChallenge(invited.invitation!, now);
  const proof = createFedosDeviceTransferProof(f.initiatorKeypair, challenged.challenge!)!;
  const approved = f.coordinator.approveTransfer(invited.invitation!.sessionId, proof, f.responderKeypair, now);
  return { sessionId: invited.invitation!.sessionId, approval: approved.approval! };
}

const BUILD_FIELDS = { suite: "ChaCha20Poly1305" as const, localAccountIndex: 0, selfAccountPublicKeyHex: "ab".repeat(32) };

describe("Secure Runtime Alpha 3481-3560 -- Transfer Package build/verify/completion (real AEAD)", () => {
  it("1. build() then verify() recovers the identical Sync Session, and completeTransfer() reaches completed", async () => {
    const f = await buildFixture();
    const { sessionId, approval } = await driveToApproved(f);

    const prep = prepareFedosDeviceSyncSession({ registryPersistence: f.registryPersistence, accountRef: f.accountRef, targetDeviceId: "laptop", now: NOW });
    expect(prep.outcome).toBe("prepared");

    const built = await f.coordinator.buildTransferPackage(
      { sessionId, approval, syncSession: prep.session!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW,
    );
    expect(built.outcome).toBe("package-sent");
    expect(f.coordinator.getSession(sessionId)?.state).toBe("package-sent");

    const verified = await f.coordinator.verifyTransferPackage(
      { transferPackage: built.package!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW,
    );
    expect(verified.outcome).toBe("verified");
    expect(verified.session).toEqual(prep.session);
    expect(f.coordinator.getSession(sessionId)?.state).toBe("verified");

    const completed = f.coordinator.completeTransfer(sessionId, NOW + 1);
    expect(completed).toBe("completed");
  });

  it("2. duplicate-package -- resubmitting the SAME already-verified package is idempotent and still recovers the session", async () => {
    const f = await buildFixture();
    const { sessionId, approval } = await driveToApproved(f);
    const prep = prepareFedosDeviceSyncSession({ registryPersistence: f.registryPersistence, accountRef: f.accountRef, targetDeviceId: "laptop", now: NOW });
    const built = await f.coordinator.buildTransferPackage(
      { sessionId, approval, syncSession: prep.session!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW,
    );
    await f.coordinator.verifyTransferPackage({ transferPackage: built.package!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS }, NOW);

    const again = await f.coordinator.verifyTransferPackage(
      { transferPackage: built.package!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW + 5,
    );
    expect(again.outcome).toBe("duplicate-package");
    expect(again.session).toEqual(prep.session);
    // Idempotent -- the session stays "verified", not re-mutated.
    expect(f.coordinator.getSession(sessionId)?.state).toBe("verified");
  });

  it("3. conflict (tampering in transit) -- a package whose bytes differ from the one recorded at build time is refused BEFORE any decrypt, and the session fails", async () => {
    const f = await buildFixture();
    const { sessionId, approval } = await driveToApproved(f);
    const prep = prepareFedosDeviceSyncSession({ registryPersistence: f.registryPersistence, accountRef: f.accountRef, targetDeviceId: "laptop", now: NOW });
    const built = await f.coordinator.buildTransferPackage(
      { sessionId, approval, syncSession: prep.session!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW,
    );

    const tampered: FedosDeviceTransferPackageV1 = {
      ...built.package!,
      syncPackage: { ...built.package!.syncPackage, ciphertext: `${built.package!.syncPackage.ciphertext}-tampered` as unknown as AeadCiphertextWire },
    };

    const result = await f.coordinator.verifyTransferPackage({ transferPackage: tampered, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS }, NOW + 1);
    expect(result.outcome).toBe("conflict");
    expect(f.coordinator.getSession(sessionId)?.state).toBe("failed");
  });

  it("4. a non-'opened' read() outcome bubbles through verifyTransferPackage and fails the session", async () => {
    const f = await buildFixture();
    const { sessionId, approval } = await driveToApproved(f);
    const prep = prepareFedosDeviceSyncSession({ registryPersistence: f.registryPersistence, accountRef: f.accountRef, targetDeviceId: "laptop", now: NOW });
    const built = await f.coordinator.buildTransferPackage(
      { sessionId, approval, syncSession: prep.session!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW,
    );

    const alwaysFailsAuthority: FedosDeviceSyncPackageEncryptionAuthority = {
      build: f.encryptionAuthority.build.bind(f.encryptionAuthority),
      read: vi.fn(async () => ({ outcome: "failed" as const })),
    };

    const result = await f.coordinator.verifyTransferPackage({ transferPackage: built.package!, encryptionAuthority: alwaysFailsAuthority, ...BUILD_FIELDS }, NOW + 1);
    expect(result.outcome).toBe("failed");
    expect(f.coordinator.getSession(sessionId)?.state).toBe("failed");
  });

  it("5. a non-'built' outcome (e.g. key-unavailable) bubbles through buildTransferPackage WITHOUT failing the session -- a transient/environmental failure stays retryable", async () => {
    const f = await buildFixture();
    const { sessionId, approval } = await driveToApproved(f);
    const prep = prepareFedosDeviceSyncSession({ registryPersistence: f.registryPersistence, accountRef: f.accountRef, targetDeviceId: "laptop", now: NOW });

    const keyUnavailableAuthority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => null)), fakeRoundTrippingRuntimeBoundary());
    const result = await f.coordinator.buildTransferPackage(
      { sessionId, approval, syncSession: prep.session!, encryptionAuthority: keyUnavailableAuthority, ...BUILD_FIELDS },
      NOW,
    );
    expect(result.outcome).toBe("key-unavailable");
    expect(f.coordinator.getSession(sessionId)?.state).toBe("approved");

    // Retrying with a working authority still succeeds.
    const retry = await f.coordinator.buildTransferPackage(
      { sessionId, approval, syncSession: prep.session!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW + 1,
    );
    expect(retry.outcome).toBe("package-sent");
  });

  it("6. wrong-state -- buildTransferPackage before 'approved', and verifyTransferPackage before 'package-sent'", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const prep = prepareFedosDeviceSyncSession({ registryPersistence: f.registryPersistence, accountRef: f.accountRef, targetDeviceId: "laptop", now: NOW });

    const fakeApproval = { challenge: { schemaVersion: 1 as const, domain: "x", sessionId: invited.invitation!.sessionId, initiatorDeviceId: "phone", initiatorDevicePublicKeyHex: "0".repeat(64), issuedAt: 0, expiresAt: 1, nonce: "0".repeat(32) }, responderDeviceId: "laptop", responderDevicePublicKeyHex: "0".repeat(64), signatureHex: "0".repeat(128), approvedAt: 0 };
    const buildResult = await f.coordinator.buildTransferPackage(
      { sessionId: invited.invitation!.sessionId, approval: fakeApproval, syncSession: prep.session!, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS },
      NOW,
    );
    expect(buildResult.outcome).toBe("wrong-state");

    const { sessionId, approval } = await driveToApproved(f, NOW + 100);
    const verifyBeforeSent = await f.coordinator.verifyTransferPackage(
      { transferPackage: { formatVersion: 1, sessionId, syncPackage: { formatVersion: 1, manifest: { schemaVersion: 1, accountAuthority: "nostr", accountPublicIdentifier: "x", targetDeviceId: "laptop", preparedAt: 0, expiresAt: 1, deviceCount: 0, contentHash: "0".repeat(64) }, ciphertext: "irrelevant" as unknown as AeadCiphertextWire } },
        encryptionAuthority: f.encryptionAuthority,
        ...BUILD_FIELDS,
      },
      NOW + 101,
    );
    expect(verifyBeforeSent.outcome).toBe("wrong-state");
    void approval;
  });

  it("7. malformed -- verifyTransferPackage rejects a structurally-invalid package before any session lookup", async () => {
    const f = await buildFixture();
    const result = await f.coordinator.verifyTransferPackage({ transferPackage: { garbage: true } as never, encryptionAuthority: f.encryptionAuthority, ...BUILD_FIELDS }, NOW);
    expect(result.outcome).toBe("malformed");
  });

  it("8. not-found -- buildTransferPackage/verifyTransferPackage against an unknown sessionId", async () => {
    const f = await buildFixture();
    const buildResult = await f.coordinator.buildTransferPackage(
      {
        sessionId: "no-such-session",
        approval: (await driveToApproved(f)).approval,
        syncSession: prepareFedosDeviceSyncSession({ registryPersistence: f.registryPersistence, accountRef: f.accountRef, targetDeviceId: "laptop", now: NOW }).session!,
        encryptionAuthority: f.encryptionAuthority,
        ...BUILD_FIELDS,
      },
      NOW,
    );
    expect(buildResult.outcome).toBe("not-found");

    const verifyResult = await f.coordinator.verifyTransferPackage(
      {
        transferPackage: {
          formatVersion: 1,
          sessionId: "no-such-session",
          syncPackage: {
            formatVersion: 1,
            manifest: { schemaVersion: 1, accountAuthority: "nostr", accountPublicIdentifier: "x", targetDeviceId: "laptop", preparedAt: 0, expiresAt: 1, deviceCount: 0, contentHash: "0".repeat(64) },
            ciphertext: "irrelevant" as unknown as AeadCiphertextWire,
          },
        },
        encryptionAuthority: f.encryptionAuthority,
        ...BUILD_FIELDS,
      },
      NOW,
    );
    expect(verifyResult.outcome).toBe("not-found");
  });
});
