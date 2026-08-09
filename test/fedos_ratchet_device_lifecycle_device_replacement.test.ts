/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — Device Lifecycle derivation + Device Replacement,
 * with REAL cryptography (real Nostr account authorization signatures,
 * real Device signing keypairs/proofs of possession — no WASM required,
 * mirrors `test/secure_runtime_alpha_3161_3240_account_device_signature_boundary.test.ts`'s
 * own established test-support pattern).
 */
import { describe, it, expect } from "vitest";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { createFedosDeviceBindingBoundary } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_boundary_factory.js";
import { authorizeFedosDeviceBindingChallenge } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.js";
import { createFedosDeviceBindingProofOfPossession } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import { generateFedosDeviceSigningKeypair } from "../src/os/messenger/device/crypto/fedos_device_signing_keypair.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { InMemoryFedosDeviceReplacementPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_replacement_persistence.js";
import { FedosDeviceReplacementCoordinator } from "../src/os/messenger/device/fedos_device_replacement_coordinator.js";
import { deriveFedosDeviceLifecycleState } from "../src/os/messenger/device/fedos_device_lifecycle.js";

const ACCOUNT_INDEX = 0;

function makeBoundary(now: () => number) {
  return createFedosDeviceBindingBoundary({
    registryPersistence: new InMemoryFedosDeviceRegistryPersistence(),
    replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
    now,
  });
}

async function registerRealDevice(
  boundary: ReturnType<typeof makeBoundary>,
  signingAuthority: RealFedosNostrSigningAuthority,
  deviceId: string,
  now: number,
) {
  const keypair = generateFedosDeviceSigningKeypair();
  const challenge = boundary.mintChallenge("register-device", deviceId, keypair.publicKeyHex);
  const accountAuthorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, challenge);
  const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge);
  if (accountAuthorization === null || deviceProof === null) throw new Error("unreachable: real signing must succeed");
  const result = await boundary.registrationAuthority.registerDevice(accountAuthorization, deviceProof, now);
  return { keypair, result };
}

describe("Device Lifecycle derivation", () => {
  it("pending/trusted/unavailable map directly; revoked maps to 'revoked' with no replacement, 'replaced' with one", () => {
    const base = {
      schemaVersion: 1 as const,
      deviceId: "d1",
      accountRef: { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null },
      devicePublicKeyRef: null,
      label: null,
      createdAt: 0,
      capabilityVersion: 1 as const,
      revokedAt: null as number | null,
    };
    expect(deriveFedosDeviceLifecycleState({ ...base, trustState: "pending" }, null)).toBe("pending");
    expect(deriveFedosDeviceLifecycleState({ ...base, trustState: "trusted" }, null)).toBe("active");
    expect(deriveFedosDeviceLifecycleState({ ...base, trustState: "unavailable" }, null)).toBe("unavailable");
    expect(deriveFedosDeviceLifecycleState({ ...base, trustState: "revoked", revokedAt: 1 }, null)).toBe("revoked");
    expect(deriveFedosDeviceLifecycleState({ ...base, trustState: "revoked", revokedAt: 1 }, "d2")).toBe("replaced");
  });
});

describe("FedosDeviceReplacementCoordinator — real crypto", () => {
  it("registers the new Device, revokes the old one, and records the informational replacement link (real Nostr + real Device signatures)", async () => {
    let now = 1000;
    const boundary = makeBoundary(() => now);
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const replacementPersistence = new InMemoryFedosDeviceReplacementPersistence();
    const coordinator = new FedosDeviceReplacementCoordinator({
      registrationAuthority: boundary.registrationAuthority,
      replacementPersistence,
      now: () => now,
    });

    const oldDevice = await registerRealDevice(boundary, signingAuthority, "alice-old-laptop", now);
    expect(oldDevice.result.outcome).toBe("registered-trusted");

    now += 10;
    const newKeypair = generateFedosDeviceSigningKeypair();
    const registerChallenge = boundary.mintChallenge("register-device", "alice-new-laptop", newKeypair.publicKeyHex);
    const newDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, registerChallenge))!;
    const newDeviceProof = createFedosDeviceBindingProofOfPossession(newKeypair, registerChallenge)!;

    const revokeChallenge = boundary.mintChallenge("revoke-device", "alice-old-laptop", oldDevice.keypair.publicKeyHex);
    const oldDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, revokeChallenge))!;

    const outcome = await coordinator.replaceDevice(
      "alice-old-laptop",
      newDeviceAccountAuthorization,
      newDeviceProof,
      oldDeviceAccountAuthorization,
      "lost",
    );
    expect(outcome.outcome).toBe("replaced");
    if (outcome.outcome !== "replaced") throw new Error("unreachable");
    expect(outcome.newBinding.deviceId).toBe("alice-new-laptop");
    expect(outcome.newBinding.trustState).toBe("trusted");

    const oldBinding = boundary.registrationAuthority.getBinding("alice-old-laptop")!;
    expect(oldBinding.trustState).toBe("revoked");

    const replacement = replacementPersistence.getReplacementForOldDevice("alice-old-laptop");
    expect(replacement?.newDeviceId).toBe("alice-new-laptop");
    expect(replacement?.reason).toBe("lost");

    expect(deriveFedosDeviceLifecycleState(oldBinding, replacement?.newDeviceId ?? null)).toBe("replaced");
  });

  it("never inherits the old Device's identity or key — the new binding's deviceId/key are independent, and the old binding's key is never reused", async () => {
    let now = 2000;
    const boundary = makeBoundary(() => now);
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const coordinator = new FedosDeviceReplacementCoordinator({
      registrationAuthority: boundary.registrationAuthority,
      replacementPersistence: new InMemoryFedosDeviceReplacementPersistence(),
      now: () => now,
    });

    const oldDevice = await registerRealDevice(boundary, signingAuthority, "bob-phone", now);
    now += 5;
    const newKeypair = generateFedosDeviceSigningKeypair();
    expect(newKeypair.publicKeyHex).not.toBe(oldDevice.keypair.publicKeyHex);

    const registerChallenge = boundary.mintChallenge("register-device", "bob-new-phone", newKeypair.publicKeyHex);
    const newDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, registerChallenge))!;
    const newDeviceProof = createFedosDeviceBindingProofOfPossession(newKeypair, registerChallenge)!;
    const revokeChallenge = boundary.mintChallenge("revoke-device", "bob-phone", oldDevice.keypair.publicKeyHex);
    const oldDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, revokeChallenge))!;

    const outcome = await coordinator.replaceDevice("bob-phone", newDeviceAccountAuthorization, newDeviceProof, oldDeviceAccountAuthorization, "routine");
    expect(outcome.outcome).toBe("replaced");
    if (outcome.outcome !== "replaced") throw new Error("unreachable");
    expect(outcome.newBinding.devicePublicKeyRef).toBe(newKeypair.publicKeyHex);
    expect(outcome.newBinding.devicePublicKeyRef).not.toBe(oldDevice.keypair.publicKeyHex);
  });

  it("rejects reusing the old deviceId as the 'new' device (a replacement must be a genuinely new identity)", async () => {
    let now = 3000;
    const boundary = makeBoundary(() => now);
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const coordinator = new FedosDeviceReplacementCoordinator({
      registrationAuthority: boundary.registrationAuthority,
      replacementPersistence: new InMemoryFedosDeviceReplacementPersistence(),
      now: () => now,
    });
    const oldDevice = await registerRealDevice(boundary, signingAuthority, "carol-tablet", now);
    now += 1;
    const registerChallenge = boundary.mintChallenge("register-device", "carol-tablet", oldDevice.keypair.publicKeyHex);
    const newDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, registerChallenge))!;
    const newDeviceProof = createFedosDeviceBindingProofOfPossession(oldDevice.keypair, registerChallenge)!;
    const revokeChallenge = boundary.mintChallenge("revoke-device", "carol-tablet", oldDevice.keypair.publicKeyHex);
    const oldDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, revokeChallenge))!;

    const outcome = await coordinator.replaceDevice("carol-tablet", newDeviceAccountAuthorization, newDeviceProof, oldDeviceAccountAuthorization, "routine");
    expect(outcome.outcome).toBe("invalid-input");
  });

  it("is idempotent: a second replaceDevice() call for the same oldDeviceId is refused as already-replaced, without re-registering or re-revoking", async () => {
    let now = 4000;
    const boundary = makeBoundary(() => now);
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const replacementPersistence = new InMemoryFedosDeviceReplacementPersistence();
    const coordinator = new FedosDeviceReplacementCoordinator({
      registrationAuthority: boundary.registrationAuthority,
      replacementPersistence,
      now: () => now,
    });
    const oldDevice = await registerRealDevice(boundary, signingAuthority, "dave-desktop", now);
    now += 1;
    const newKeypair = generateFedosDeviceSigningKeypair();
    const registerChallenge = boundary.mintChallenge("register-device", "dave-new-desktop", newKeypair.publicKeyHex);
    const newDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, registerChallenge))!;
    const newDeviceProof = createFedosDeviceBindingProofOfPossession(newKeypair, registerChallenge)!;
    const revokeChallenge = boundary.mintChallenge("revoke-device", "dave-desktop", oldDevice.keypair.publicKeyHex);
    const oldDeviceAccountAuthorization = (await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, revokeChallenge))!;

    const first = await coordinator.replaceDevice("dave-desktop", newDeviceAccountAuthorization, newDeviceProof, oldDeviceAccountAuthorization, "routine");
    expect(first.outcome).toBe("replaced");

    const second = await coordinator.replaceDevice("dave-desktop", newDeviceAccountAuthorization, newDeviceProof, oldDeviceAccountAuthorization, "routine");
    expect(second.outcome).toBe("already-replaced");
    expect(replacementPersistence.listReplacements()).toHaveLength(1);
  });
});
