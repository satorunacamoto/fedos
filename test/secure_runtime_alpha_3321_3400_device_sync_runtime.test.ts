import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { createFedosDeviceSyncRuntime, FedosDeviceSyncRuntime } from "../src/device/runtime/fedos_device_sync_runtime.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDeviceBindingChallengeReplayPersistence } from "../src/device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.js";
import { generateFedosDeviceSigningKeypair, type FedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";
import { authorizeFedosDeviceBindingChallenge } from "../src/device/binding_challenge/fedos_device_binding_account_authorization.js";
import { createFedosDeviceBindingProofOfPossession } from "../src/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import type { FedosDeviceBindingChallengeNonceGenerator } from "../src/device/binding_challenge/fedos_device_binding_challenge.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

const ACCOUNT_INDEX = 0;
const NOW = 1_700_000_000;

async function registerRealDevice(
  runtime: FedosDeviceSyncRuntime,
  signingAuthority: RealFedosNostrSigningAuthority,
  deviceId: string,
  now: number,
  keypair: FedosDeviceSigningKeypair = generateFedosDeviceSigningKeypair(),
) {
  const challenge = runtime.mintChallenge("register-device", deviceId, keypair.publicKeyHex);
  const accountAuthorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, challenge);
  if (accountAuthorization === null) throw new Error("unreachable: real signing authority failed to sign");
  const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge);
  if (deviceProof === null) throw new Error("unreachable: device proof construction failed");
  const result = await runtime.registerDevice(accountAuthorization, deviceProof, now);
  return { result, keypair, challenge, accountAuthorization, deviceProof };
}

async function revokeRealDevice(
  runtime: FedosDeviceSyncRuntime,
  signingAuthority: RealFedosNostrSigningAuthority,
  deviceId: string,
  devicePublicKeyHex: string,
  now: number,
) {
  const challenge = runtime.mintChallenge("revoke-device", deviceId, devicePublicKeyHex);
  const accountAuthorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, challenge);
  if (accountAuthorization === null) throw new Error("unreachable: real signing authority failed to sign");
  return runtime.revokeDevice(accountAuthorization, now);
}

async function accountRefFor(signingAuthority: RealFedosNostrSigningAuthority): Promise<FedosDeviceBindingAccountRef> {
  const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
  if (identity === null) throw new Error("unreachable");
  return { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
}

function inMemoryRuntime(now: () => number = () => NOW): FedosDeviceSyncRuntime {
  return createFedosDeviceSyncRuntime({
    registryPersistence: new InMemoryFedosDeviceRegistryPersistence(),
    replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
    now,
  });
}

describe("Secure Runtime Alpha 3321-3400 -- Runtime Device Registration/Activation", () => {
  it("1. registerDevice() -- real end-to-end mint + account authorization + device proof reaches registered-trusted", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const { result } = await registerRealDevice(runtime, signingAuthority, "device-a", NOW);
    expect(result.outcome).toBe("registered-trusted");
    expect(result.binding?.trustState).toBe("trusted");
    expect(runtime.getDevice("device-a")?.trustState).toBe("trusted");
  });

  it("2. duplicate registration -- a SECOND, freshly-minted challenge for the SAME device+account is refused as already-present, never re-mutated", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const { keypair } = await registerRealDevice(runtime, signingAuthority, "device-a", NOW);

    // A fresh challenge (different nonce) for the SAME deviceId/key/account.
    const { result: second } = await registerRealDevice(runtime, signingAuthority, "device-a", NOW + 10, keypair);
    expect(second.outcome).toBe("already-present");
    expect(runtime.listDevices(await accountRefFor(signingAuthority))).toHaveLength(1);
  });

  it("3. replay -- a SECOND, DIFFERENT registration reusing an already-consumed nonce is refused as replayed, never registered", async () => {
    let fixedNonce = "aa".repeat(16);
    const nonceGenerator: FedosDeviceBindingChallengeNonceGenerator = { generateNonce: () => fixedNonce };
    const runtime = createFedosDeviceSyncRuntime({
      registryPersistence: new InMemoryFedosDeviceRegistryPersistence(),
      replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
      now: () => NOW,
      nonceGenerator,
    });
    const signingAuthority = new RealFedosNostrSigningAuthority();

    const { result: first } = await registerRealDevice(runtime, signingAuthority, "device-a", NOW);
    expect(first.outcome).toBe("registered-trusted");

    // A DIFFERENT device, but the nonce generator hands out the SAME nonce again.
    const { result: second } = await registerRealDevice(runtime, signingAuthority, "device-b", NOW);
    expect(second.outcome).toBe("replayed");
    expect(runtime.getDevice("device-b")).toBeNull();
  });

  it("4. idempotent resubmission -- the IDENTICAL account authorization + device proof replays the SAME recorded outcome, never throws", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const { accountAuthorization, deviceProof } = await registerRealDevice(runtime, signingAuthority, "device-a", NOW);

    const again = await runtime.registerDevice(accountAuthorization, deviceProof, NOW);
    expect(again.outcome).toBe("registered-trusted");
  });

  it("5. unauthorized device -- a device proof signed by a DIFFERENT keypair than the one the challenge names is denied as invalid-device-proof", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const namedKeypair = generateFedosDeviceSigningKeypair();

    const challenge = runtime.mintChallenge("register-device", "device-a", namedKeypair.publicKeyHex);
    const accountAuthorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, challenge);
    if (accountAuthorization === null) throw new Error("unreachable");

    // createFedosDeviceBindingProofOfPossession() itself refuses a keypair/challenge key mismatch (null) --
    // an impostor must fabricate a same-shaped proof object naming a key it does not hold.
    const forgedProof = { challenge, devicePublicKeyHex: namedKeypair.publicKeyHex, signatureHex: "00".repeat(64) };
    const result = await runtime.registerDevice(accountAuthorization, forgedProof, NOW);
    expect(result.outcome).toBe("invalid-device-proof");
    expect(runtime.getDevice("device-a")).toBeNull();
  });

  it("6. revocation -- account-authorization-only revoke reaches revoked, is reflected in inventory/status, and cannot be reinstated", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const { keypair } = await registerRealDevice(runtime, signingAuthority, "device-a", NOW);

    const revocation = await revokeRealDevice(runtime, signingAuthority, "device-a", keypair.publicKeyHex, NOW + 10);
    expect(revocation.outcome).toBe("revoked");

    const accountRef = await accountRefFor(signingAuthority);
    expect(runtime.deviceStatus("device-a")).toEqual({ deviceId: "device-a", found: true, trustState: "revoked", active: false });
    expect(runtime.listActiveDevices(accountRef)).toHaveLength(0);
    expect(runtime.listDevices(accountRef)).toHaveLength(1);

    // A second revocation is refused, not silently re-applied.
    const again = await revokeRealDevice(runtime, signingAuthority, "device-a", keypair.publicKeyHex, NOW + 20);
    expect(again.outcome).toBe("already-revoked");
  });

  it("7. Local Device Inventory / Device Status Queries -- multiple devices, mixed states, deviceStatus for an unknown device", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(runtime, signingAuthority, "device-a", NOW);
    const { keypair: bKeypair } = await registerRealDevice(runtime, signingAuthority, "device-b", NOW);
    await revokeRealDevice(runtime, signingAuthority, "device-b", bKeypair.publicKeyHex, NOW + 5);

    const accountRef = await accountRefFor(signingAuthority);
    expect(runtime.listDevices(accountRef)).toHaveLength(2);
    expect(runtime.listActiveDevices(accountRef).map((b) => b.deviceId)).toEqual(["device-a"]);
    expect(runtime.deviceStatus("device-unknown")).toEqual({ deviceId: "device-unknown", found: false, trustState: "unknown", active: false });
  });

  it("8. restart recovery -- a second, independent Runtime constructed over the SAME durable log files recovers an identical trusted binding", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-device-sync-runtime-"));
    const registryLogPath = join(dir, "device-registry.ndjson");
    const replayLogPath = join(dir, "challenge-replay.ndjson");
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const runtimeA = createFedosDeviceSyncRuntime({
        registryPersistence: new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath),
        replayPersistence: new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(replayLogPath),
        now: () => NOW,
      });
      const { result } = await registerRealDevice(runtimeA, signingAuthority, "device-a", NOW);
      expect(result.outcome).toBe("registered-trusted");

      const runtimeB = createFedosDeviceSyncRuntime({
        registryPersistence: new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath),
        replayPersistence: new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(replayLogPath),
        now: () => NOW + 100,
      });
      const recovered = runtimeB.getDevice("device-a");
      expect(recovered?.trustState).toBe("trusted");

      const accountRef = await accountRefFor(signingAuthority);
      expect(runtimeB.listActiveDevices(accountRef)).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 3321-3400 -- Sync Session Preparation via the Runtime", () => {
  it("1. prepareSyncSession() refuses an unauthorized (never-registered) target Device", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(runtime, signingAuthority, "device-a", NOW);
    const accountRef = await accountRefFor(signingAuthority);

    const prep = runtime.prepareSyncSession(accountRef, "device-never-registered", NOW);
    expect(prep.outcome).toBe("target-not-found");
    expect(prep.session).toBeNull();
  });

  it("2. prepareSyncSession() refuses a revoked target Device", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const { keypair } = await registerRealDevice(runtime, signingAuthority, "device-a", NOW);
    await revokeRealDevice(runtime, signingAuthority, "device-a", keypair.publicKeyHex, NOW + 5);
    const accountRef = await accountRefFor(signingAuthority);

    const prep = runtime.prepareSyncSession(accountRef, "device-a", NOW + 10);
    expect(prep.outcome).toBe("target-not-trusted");
  });

  it("3. prepareSyncSession() for a trusted target lists every currently-trusted device, sorted, and validateSyncSession() confirms it valid", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(runtime, signingAuthority, "device-b", NOW);
    await registerRealDevice(runtime, signingAuthority, "device-a", NOW);
    const accountRef = await accountRefFor(signingAuthority);

    const prep = runtime.prepareSyncSession(accountRef, "device-a", NOW);
    expect(prep.outcome).toBe("prepared");
    expect(prep.session?.devices.map((d) => d.deviceId)).toEqual(["device-a", "device-b"]);

    expect(runtime.validateSyncSession(prep.session, NOW + 1)).toBe("valid");
  });

  it("4. validateSyncSession() reports stale-device-list once a listed sibling Device is revoked after preparation", async () => {
    const runtime = inMemoryRuntime();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(runtime, signingAuthority, "device-a", NOW);
    const { keypair: bKeypair } = await registerRealDevice(runtime, signingAuthority, "device-b", NOW);
    const accountRef = await accountRefFor(signingAuthority);

    const prep = runtime.prepareSyncSession(accountRef, "device-a", NOW);
    expect(prep.outcome).toBe("prepared");

    await revokeRealDevice(runtime, signingAuthority, "device-b", bKeypair.publicKeyHex, NOW + 5);
    expect(runtime.validateSyncSession(prep.session, NOW + 10)).toBe("stale-device-list");
  });
});
