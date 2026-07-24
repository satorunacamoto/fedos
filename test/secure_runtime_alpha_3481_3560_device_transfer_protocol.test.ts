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
import type { FedosDeviceRegistryPersistence } from "../src/device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import { createFedosDeviceTransferProof } from "../src/device/transfer/fedos_device_transfer_proof.js";
import {
  createFedosDeviceTransferCoordinator,
  FedosDeviceTransferCoordinator,
} from "../src/device/transfer/fedos_device_transfer_coordinator.js";
import { InMemoryFedosDeviceTransferSessionPersistence } from "../src/device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.js";
import { AppendOnlyFedosDeviceTransferSessionPersistence } from "../src/device/transfer/persistence/append_only_fedos_device_transfer_session_persistence.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

const NOW = 1_800_000_000;

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
  if (accountAuthorization === null) throw new Error("unreachable: real signing authority failed to sign");
  const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge);
  if (deviceProof === null) throw new Error("unreachable: device proof construction failed");
  const result = await runtime.registerDevice(accountAuthorization, deviceProof, now);
  if (result.outcome !== "registered-trusted") throw new Error(`unreachable: registration failed with ${result.outcome}`);
  return keypair;
}

async function accountRefFor(signingAuthority: RealFedosNostrSigningAuthority, accountIndex: number): Promise<FedosDeviceBindingAccountRef> {
  const identity = await signingAuthority.publicIdentityForAccount(accountIndex);
  if (identity === null) throw new Error("unreachable");
  return { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
}

interface Fixture {
  readonly signingAuthority: RealFedosNostrSigningAuthority;
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly coordinator: FedosDeviceTransferCoordinator;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly initiatorKeypair: FedosDeviceSigningKeypair;
  readonly responderKeypair: FedosDeviceSigningKeypair;
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
  const accountRef = await accountRefFor(signingAuthority, 0);

  const coordinator = createFedosDeviceTransferCoordinator({
    sessionPersistence: new InMemoryFedosDeviceTransferSessionPersistence(),
    registryPersistence,
    now: () => now,
  });

  return { signingAuthority, registryPersistence, coordinator, accountRef, initiatorKeypair, responderKeypair };
}

describe("Secure Runtime Alpha 3481-3560 -- Transfer Invitation and Session creation", () => {
  it("1. createInvitation() -- real, trusted, same-account devices reach 'invited'", async () => {
    const f = await buildFixture();
    const result = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    expect(result.outcome).toBe("invited");
    expect(result.invitation?.initiatorDeviceId).toBe("phone");
    expect(result.invitation?.responderDeviceId).toBe("laptop");
    expect(f.coordinator.getSession(result.invitation!.sessionId)?.state).toBe("invited");
  });

  it("2. same-device -- initiator and responder cannot be the same deviceId", async () => {
    const f = await buildFixture();
    const result = f.coordinator.createInvitation(f.accountRef, "phone", "phone", NOW);
    expect(result.outcome).toBe("same-device");
  });

  it("3. initiator-not-trusted -- a never-registered initiator is refused", async () => {
    const f = await buildFixture();
    const result = f.coordinator.createInvitation(f.accountRef, "unknown-device", "laptop", NOW);
    expect(result.outcome).toBe("initiator-not-trusted");
  });

  it("4. responder-not-trusted -- a never-registered responder is refused", async () => {
    const f = await buildFixture();
    const result = f.coordinator.createInvitation(f.accountRef, "phone", "unknown-device", NOW);
    expect(result.outcome).toBe("responder-not-trusted");
  });

  it("5. wrong-account -- a responder belonging to a DIFFERENT account is refused", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const runtime = createFedosDeviceSyncRuntime({
      registryPersistence,
      replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
      now: () => NOW,
    });
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(runtime, signingAuthority, 0, "phone-a", NOW);
    await registerRealDevice(runtime, signingAuthority, 1, "tablet-b", NOW);
    const accountRefA = await accountRefFor(signingAuthority, 0);

    const coordinator = createFedosDeviceTransferCoordinator({
      sessionPersistence: new InMemoryFedosDeviceTransferSessionPersistence(),
      registryPersistence,
      now: () => NOW,
    });
    const result = coordinator.createInvitation(accountRefA, "phone-a", "tablet-b", NOW);
    expect(result.outcome).toBe("wrong-account");
  });
});

describe("Secure Runtime Alpha 3481-3560 -- Transfer Challenge and Approval (real signatures)", () => {
  it("1. issueChallenge() then approveTransfer() with a real initiator Proof and real responder Approval reaches 'approved'", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const challenged = f.coordinator.issueChallenge(invited.invitation!, NOW);
    expect(challenged.outcome).toBe("challenged");

    const proof = createFedosDeviceTransferProof(f.initiatorKeypair, challenged.challenge!);
    expect(proof).not.toBeNull();

    const approved = f.coordinator.approveTransfer(invited.invitation!.sessionId, proof!, f.responderKeypair, NOW);
    expect(approved.outcome).toBe("approved");
    expect(approved.approval?.responderDeviceId).toBe("laptop");
    expect(f.coordinator.getSession(invited.invitation!.sessionId)?.state).toBe("approved");
  });

  it("2. issueChallenge() is idempotent -- a second call for an already-challenged session returns already-challenged with the SAME challenge", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const first = f.coordinator.issueChallenge(invited.invitation!, NOW);
    const second = f.coordinator.issueChallenge(invited.invitation!, NOW + 1);
    expect(second.outcome).toBe("already-challenged");
    expect(second.challenge).toEqual(first.challenge);
  });

  it("3. expired-invitation -- issueChallenge() refuses an already-expired Invitation", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const result = f.coordinator.issueChallenge(invited.invitation!, invited.invitation!.expiresAt + 1);
    expect(result.outcome).toBe("expired-invitation");
  });

  it("4. wrong-device -- a proof naming a DIFFERENT (real, registered) device's key than the challenge itself named is denied and the session fails", async () => {
    const f = await buildFixture();
    const impostorKeypair = generateFedosDeviceSigningKeypair();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const challenged = f.coordinator.issueChallenge(invited.invitation!, NOW);

    // The key-mismatch check runs BEFORE signature verification (`verifyFedosDeviceTransferProof`), so a
    // well-formed-but-arbitrary signature is enough to demonstrate the boundary: `devicePublicKeyHex` naming
    // a device other than the one the challenge itself named is refused regardless of the signature's validity.
    const forgedProof = { challenge: challenged.challenge!, devicePublicKeyHex: impostorKeypair.publicKeyHex, signatureHex: "ab".repeat(64) };

    const result = f.coordinator.approveTransfer(invited.invitation!.sessionId, forgedProof, f.responderKeypair, NOW);
    expect(result.outcome).toBe("wrong-device");
    expect(f.coordinator.getSession(invited.invitation!.sessionId)?.state).toBe("failed");
  });

  it("5. replayed -- a Proof over a DIFFERENT (non-matching) challenge is denied and the session fails", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const challenged = f.coordinator.issueChallenge(invited.invitation!, NOW);

    const tamperedChallenge = { ...challenged.challenge!, nonce: "ff".repeat(16) };
    const proofOverWrongChallenge = createFedosDeviceTransferProof(f.initiatorKeypair, tamperedChallenge);
    expect(proofOverWrongChallenge).not.toBeNull();

    const result = f.coordinator.approveTransfer(invited.invitation!.sessionId, proofOverWrongChallenge!, f.responderKeypair, NOW);
    expect(result.outcome).toBe("replayed");
    expect(f.coordinator.getSession(invited.invitation!.sessionId)?.state).toBe("failed");
  });

  it("6. expired -- a Proof over an already-expired Challenge is denied and the session fails", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const challenged = f.coordinator.issueChallenge(invited.invitation!, NOW);
    const proof = createFedosDeviceTransferProof(f.initiatorKeypair, challenged.challenge!)!;

    const result = f.coordinator.approveTransfer(invited.invitation!.sessionId, proof, f.responderKeypair, challenged.challenge!.expiresAt + 1);
    expect(result.outcome).toBe("expired");
    expect(f.coordinator.getSession(invited.invitation!.sessionId)?.state).toBe("failed");
  });

  it("7. approveTransfer() is idempotent for a byte-identical resubmission after already-approved", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const challenged = f.coordinator.issueChallenge(invited.invitation!, NOW);
    const proof = createFedosDeviceTransferProof(f.initiatorKeypair, challenged.challenge!)!;
    f.coordinator.approveTransfer(invited.invitation!.sessionId, proof, f.responderKeypair, NOW);

    const again = f.coordinator.approveTransfer(invited.invitation!.sessionId, proof, f.responderKeypair, NOW + 1);
    expect(again.outcome).toBe("already-approved");
    expect(f.coordinator.getSession(invited.invitation!.sessionId)?.state).toBe("approved");
  });
});

describe("Secure Runtime Alpha 3481-3560 -- Interrupted transfer, cancellation, and Transfer Failure", () => {
  it("1. abortTransfer() cancels an in-progress transfer at the 'challenged' step", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    f.coordinator.issueChallenge(invited.invitation!, NOW);

    const abort = f.coordinator.abortTransfer(invited.invitation!.sessionId, NOW + 1);
    expect(abort).toBe("aborted");
    expect(f.coordinator.getSession(invited.invitation!.sessionId)?.state).toBe("aborted");
  });

  it("2. a transfer interrupted (aborted) mid-flow cannot be resumed -- approveTransfer() on an aborted session is refused", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const challenged = f.coordinator.issueChallenge(invited.invitation!, NOW);
    f.coordinator.abortTransfer(invited.invitation!.sessionId, NOW + 1);

    const proof = createFedosDeviceTransferProof(f.initiatorKeypair, challenged.challenge!)!;
    const result = f.coordinator.approveTransfer(invited.invitation!.sessionId, proof, f.responderKeypair, NOW + 2);
    expect(result.outcome).toBe("wrong-state");
  });

  it("3. abortTransfer() refuses an already-terminal session (already-terminal), never re-aborts", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    f.coordinator.abortTransfer(invited.invitation!.sessionId, NOW);
    const second = f.coordinator.abortTransfer(invited.invitation!.sessionId, NOW + 1);
    expect(second).toBe("already-terminal");
  });

  it("4. failTransfer() explicitly marks a session failed with a recorded reason", async () => {
    const f = await buildFixture();
    const invited = f.coordinator.createInvitation(f.accountRef, "phone", "laptop", NOW);
    const result = f.coordinator.failTransfer(invited.invitation!.sessionId, "out-of-band cancellation", NOW + 1);
    expect(result).toBe("failed");
    expect(f.coordinator.getSession(invited.invitation!.sessionId)?.failureReason).toBe("out-of-band cancellation");
  });

  it("5. failTransfer()/abortTransfer() on an unknown sessionId reports not-found", async () => {
    const f = await buildFixture();
    expect(f.coordinator.failTransfer("no-such-session", "reason", NOW)).toBe("not-found");
    expect(f.coordinator.abortTransfer("no-such-session", NOW)).toBe("not-found");
  });
});

describe("Secure Runtime Alpha 3481-3560 -- restart recovery", () => {
  it("1. a second, independent Coordinator constructed over the SAME durable log files recovers an identical, resumable session", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-device-transfer-"));
    const registryLogPath = join(dir, "device-registry.ndjson");
    const replayLogPath = join(dir, "challenge-replay.ndjson");
    const transferLogPath = join(dir, "transfer-sessions.ndjson");
    try {
      const registryPersistenceA = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
      const runtimeA = createFedosDeviceSyncRuntime({
        registryPersistence: registryPersistenceA,
        replayPersistence: new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(replayLogPath),
        now: () => NOW,
      });
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const initiatorKeypair = await registerRealDevice(runtimeA, signingAuthority, 0, "phone", NOW);
      const responderKeypair = await registerRealDevice(runtimeA, signingAuthority, 0, "laptop", NOW);
      const accountRef = await accountRefFor(signingAuthority, 0);

      const coordinatorA = createFedosDeviceTransferCoordinator({
        sessionPersistence: new AppendOnlyFedosDeviceTransferSessionPersistence(transferLogPath),
        registryPersistence: registryPersistenceA,
        now: () => NOW,
      });
      const invited = coordinatorA.createInvitation(accountRef, "phone", "laptop", NOW);
      const challenged = coordinatorA.issueChallenge(invited.invitation!, NOW);
      expect(challenged.outcome).toBe("challenged");

      // Simulate a process restart: fresh Registry + Transfer Session persistence instances over the SAME files.
      const registryPersistenceB = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
      const coordinatorB = createFedosDeviceTransferCoordinator({
        sessionPersistence: new AppendOnlyFedosDeviceTransferSessionPersistence(transferLogPath),
        registryPersistence: registryPersistenceB,
        now: () => NOW + 10,
      });

      const recovered = coordinatorB.getSession(invited.invitation!.sessionId);
      expect(recovered?.state).toBe("challenged");
      expect(recovered?.challengeNonce).toBe(challenged.challenge!.nonce);

      // The recovered Coordinator can resume the SAME transfer end to end.
      const proof = createFedosDeviceTransferProof(initiatorKeypair, challenged.challenge!)!;
      const approved = coordinatorB.approveTransfer(invited.invitation!.sessionId, proof, responderKeypair, NOW + 20);
      expect(approved.outcome).toBe("approved");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
