/**
 * TEST-ONLY. Secure Runtime Alpha 3641–3720 — shared fixture builder for
 * the Relay-Assisted Device Synchronization test files. Registers two
 * real, trusted Devices ("phone" = initiator/source, "laptop" =
 * responder/target) under one real account via
 * `RealFedosNostrSigningAuthority` (the SAME test-only real-BIP-340-Schnorr
 * stand-in Alpha 3161–3240 established), and drives a real
 * `FedosDeviceTransferCoordinator` Transfer Session all the way to
 * `"approved"` — the exact scope boundary
 * `fedos_device_relay_sync_inbound_handler.ts`'s own header documents:
 * this Arc's own new work begins AFTER that handshake.
 */

import { vi } from "vitest";
import { createFedosDeviceSyncRuntime, FedosDeviceSyncRuntime } from "../../src/os/messenger/device/runtime/fedos_device_sync_runtime.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../../src/os/messenger/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import type { FedosDeviceRegistryPersistence } from "../../src/os/messenger/device/persistence/fedos_device_registry_persistence.js";
import { generateFedosDeviceSigningKeypair, type FedosDeviceSigningKeypair } from "../../src/os/messenger/device/crypto/fedos_device_signing_keypair.js";
import { authorizeFedosDeviceBindingChallenge } from "../../src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.js";
import { createFedosDeviceBindingProofOfPossession } from "../../src/os/messenger/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import type { FedosDeviceBindingAccountRef } from "../../src/os/messenger/device/fedos_device_binding.js";
import { createFedosDeviceTransferProof } from "../../src/os/messenger/device/transfer/fedos_device_transfer_proof.js";
import { createFedosDeviceTransferCoordinator, FedosDeviceTransferCoordinator } from "../../src/os/messenger/device/transfer/fedos_device_transfer_coordinator.js";
import { InMemoryFedosDeviceTransferSessionPersistence } from "../../src/os/messenger/device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.js";
import { prepareFedosDeviceSyncSession, type FedosDeviceSyncSessionV1 } from "../../src/os/messenger/device/sync_session/fedos_device_sync_session.js";
import {
  FedosWasmDeviceSyncPackageEncryptionAuthority,
  type FedosDeviceSyncPackageEncryptionRuntimeBoundary,
} from "../../src/os/messenger/device/sync_package/fedos_device_sync_package_encryption.js";
import type { FedosMasterSeedAuthority } from "../../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../src/runtime/fedos_wasm_loader.js";
import { RealFedosNostrSigningAuthority } from "./real_fedos_nostr_signing_authority.js";

export const DEVICE_RELAY_SYNC_KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

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

export function fakeMasterSeedAuthority(resolveConversationKey: FedosMasterSeedAuthority["resolveConversationKey"]): FedosMasterSeedAuthority {
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

/** A REAL (in-memory, not cryptographic) round-trip fake -- the SAME technique established in `secure_runtime_alpha_3321_3400_sync_session_and_package.test.ts`. */
export function fakeRoundTrippingRuntimeBoundary(
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

export interface DeviceRelaySyncFixture {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly signingAuthority: RealFedosNostrSigningAuthority;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly initiatorKeypair: FedosDeviceSigningKeypair;
  readonly responderKeypair: FedosDeviceSigningKeypair;
  readonly transferCoordinator: FedosDeviceTransferCoordinator;
  readonly encryptionAuthority: FedosWasmDeviceSyncPackageEncryptionAuthority;
}

export const INITIATOR_DEVICE_ID = "phone";
export const RESPONDER_DEVICE_ID = "laptop";
export const ACCOUNT_INDEX = 0;

export async function buildDeviceRelaySyncFixture(
  now: number,
  registryPersistence: FedosDeviceRegistryPersistence = new InMemoryFedosDeviceRegistryPersistence(),
  transferCoordinator: FedosDeviceTransferCoordinator = createFedosDeviceTransferCoordinator({
    sessionPersistence: new InMemoryFedosDeviceTransferSessionPersistence(),
    registryPersistence,
    now: () => now,
  }),
): Promise<DeviceRelaySyncFixture> {
  const runtime = createFedosDeviceSyncRuntime({
    registryPersistence,
    replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
    now: () => now,
  });
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const initiatorKeypair = await registerRealDevice(runtime, signingAuthority, ACCOUNT_INDEX, INITIATOR_DEVICE_ID, now);
  const responderKeypair = await registerRealDevice(runtime, signingAuthority, ACCOUNT_INDEX, RESPONDER_DEVICE_ID, now);
  const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
  const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };

  const encryptionAuthority = new FedosWasmDeviceSyncPackageEncryptionAuthority(
    fakeMasterSeedAuthority(vi.fn(async () => DEVICE_RELAY_SYNC_KEY_HANDLE)),
    fakeRoundTrippingRuntimeBoundary(),
  );

  return { registryPersistence, signingAuthority, accountRef, initiatorKeypair, responderKeypair, transferCoordinator, encryptionAuthority };
}

/** Drives a fixture's Transfer Session through invited -> challenged -> approved, returning the sessionId and Approval a caller needs to build a Transfer Package. */
export async function driveDeviceRelaySyncSessionToApproved(fixture: DeviceRelaySyncFixture, now: number) {
  const invited = fixture.transferCoordinator.createInvitation(fixture.accountRef, INITIATOR_DEVICE_ID, RESPONDER_DEVICE_ID, now);
  if (invited.outcome !== "invited") throw new Error(`unreachable: ${invited.outcome}`);
  const challenged = fixture.transferCoordinator.issueChallenge(invited.invitation!, now);
  if (challenged.outcome !== "challenged") throw new Error(`unreachable: ${challenged.outcome}`);
  const proof = createFedosDeviceTransferProof(fixture.initiatorKeypair, challenged.challenge!);
  if (proof === null) throw new Error("unreachable");
  const approved = fixture.transferCoordinator.approveTransfer(invited.invitation!.sessionId, proof, fixture.responderKeypair, now);
  if (approved.outcome !== "approved") throw new Error(`unreachable: ${approved.outcome}`);
  return { sessionId: invited.invitation!.sessionId, approval: approved.approval! };
}

export function prepareDeviceRelaySyncSyncSession(fixture: DeviceRelaySyncFixture, targetDeviceId: string, now: number): FedosDeviceSyncSessionV1 {
  const prep = prepareFedosDeviceSyncSession({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, targetDeviceId, now });
  if (prep.outcome !== "prepared") throw new Error(`unreachable: ${prep.outcome}`);
  return prep.session!;
}

export const DEVICE_RELAY_SYNC_BUILD_FIELDS = { suite: "ChaCha20Poly1305" as const, localAccountIndex: ACCOUNT_INDEX };
