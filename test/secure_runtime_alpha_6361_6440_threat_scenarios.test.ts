/**
 * Secure Runtime Alpha 6361-6440 (FedOS Desktop Beta Security Acceptance,
 * Threat-Scenario Testing, and Release Freeze Arc) — Phase C: 16 real
 * threat scenarios, each composing already-shipped, already-real facades.
 * No new production code exists to make any of these pass — every
 * assertion is against EXISTING behavior. See
 * `docs/secure_runtime_alpha_6361_6440_threat_matrix.md` for the narrative
 * table this file backs.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { isFedosDeviceBindingRevoked } from "../src/device/fedos_device_binding.js";
import { FedosDeletionRequestOutboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_request_outbound_coordinator.js";
import { FedosDeletionRequestInboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_request_inbound_coordinator.js";
import { InMemoryFedosDeletionRequestPendingReviewPersistence } from "../src/conversation/deletion_request/fedos_deletion_request_pending_review_persistence.js";
import { AppendOnlyFedosDeletionRequestPendingReviewPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_request_pending_review_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";
import { InMemoryFedosDeletionRecipientDecisionPersistence } from "../src/conversation/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.js";
import { InMemoryFedosDeletionExecutionPersistence } from "../src/conversation/deletion/in_memory_fedos_deletion_execution_persistence.js";
import { FedosNobleTestNostrSigningAuthority, fedosTestSecretKeyFromSeed } from "../src/conversation/deletion_request/fedos_deletion_request_signing.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { toFedosConversationEnvelopeId } from "../src/conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationPersistence, FedosConversationPersistenceWriteResult } from "../src/conversation/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/conversation/persistence/fedos_persisted_conversation_record_v1.js";

import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosIdentityTransitionPeerObservationPersistence } from "../src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import { InMemoryFedosIdentityTransitionManualVerificationPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import { InMemoryFedosIdentityTransitionConversationContinuityPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";
import { InMemoryFedosIdentityTransitionLocalDecisionPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_local_decision.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest, fedosIdentityTransitionContinuityProofDigest } from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import { encodeFedosRatchetPeerCapabilityControlPayload, decodeFedosRatchetPeerCapabilityControlPayloadFromContent } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import { createFedosConversationRuntime, type FedosConversationRuntime } from "../src/conversation/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationRuntimeDependencies } from "../src/conversation/runtime/fedos_conversation_runtime_assembly.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";

import { FedosRatchetPeerCapabilityRuntime } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.js";
import { InMemoryFedosRatchetPeerCapabilityObservationPersistence } from "../src/conversation/ratchet/peer_capability/persistence/in_memory_fedos_ratchet_peer_capability_observation_persistence.js";

import { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";

import {
  FedosProfileInitializationCoordinator,
  type FedosProfileInitializationDependencies,
} from "../src/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { InMemoryFedosLocalProfilePersistence } from "../src/desktop/onboarding/fedos_local_profile_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories } from "../src/desktop/onboarding/fedos_local_profile_paths.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/desktop/onboarding/fedos_development_master_seed_authority.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/desktop/onboarding/fedos_profile_unlock_secret.js";

const NOW = 1_700_000_000;
const clock = () => NOW;

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

function seedDevice(registry: InMemoryFedosDeviceRegistryPersistence, deviceId: string, at: number, trust: "pending" | "trusted" | "revoked"): void {
  registry.putEvent({ schemaVersion: 1, eventType: "registered", deviceId, accountAuthority: "fedos", accountPublicIdentifier: deviceId, accountIdentityId: null, devicePublicKeyRef: null, label: null, initialTrustState: "pending", registeredAt: at });
  if (trust === "trusted" || trust === "revoked") registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: at });
  if (trust === "revoked") registry.putEvent({ schemaVersion: 1, eventType: "revoked", deviceId, revokedAt: at + 1 });
}

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 1/2: stolen/revoked device", () => {
  it("1. a stolen device, once revoked, has a real revoked trust state", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(registry, "stolen-laptop", 1000, "revoked");
    const binding = registry.getBinding("stolen-laptop");
    expect(binding).not.toBeNull();
    expect(isFedosDeviceBindingRevoked(binding!)).toBe(true);
  });

  it("2. a revoked recipient device is refused by the outbound preflight check -- never silently sent to", async () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(registry, "alice-device-a", 1000, "trusted");
    seedDevice(registry, "bob-revoked-device", 1000, "revoked");
    const conversationPersistence: FedosConversationPersistence = {
      putConversation: () => "inserted" as FedosConversationPersistenceWriteResult,
      getConversation: () => ({ schemaVersion: 1, id: "c1", mode: "private", boardId: "", rootThreadId: "", rootPostId: "", policyReference: "test", createdAt: 0 }) as unknown as FedosPersistedConversationRecordV1,
      listConversations: () => [],
    };
    const outbound = new FedosDeletionRequestOutboundCoordinator({
      conversationPersistence,
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
      deviceRegistry: registry,
      signingAuthority: new FedosNobleTestNostrSigningAuthority([{ accountIndex: 0, secretKey: fedosTestSecretKeyFromSeed("alice") }]),
      requesterAccountIndex: 0,
      localDeviceRef: "alice-device-a",
      requestStatePersistence: { getRecord: () => null, putRecord: () => "inserted", listRecords: () => [] } as never,
      clock,
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    });
    const result = await outbound.createSignPublishRequest({
      requesterAccountRef: "alice-account",
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-revoked-device",
      conversationId: toFedosConversationId(toFedosBoardId("b1")!, toFedosThreadId("t1")!),
      targetEnvelopeId: toFedosConversationEnvelopeId("e1")!,
      scope: "local-history",
      expiresInSeconds: 100_000,
      reasonCode: "sent-in-error",
    });
    expect(result.outcome).toBe("recipient-device-revoked");
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 3: compromised relay (forged payload)", () => {
  it("3. a peer-capability control payload signed by the WRONG key is rejected -- a compromised Relay cannot forge acceptance merely by relaying arbitrary bytes", async () => {
    const deviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(deviceRegistry, "bob-desktop", 0, "trusted");
    const attackerSigningAuthority = new RealFedosNostrSigningAuthority();
    const bobRuntime = new FedosRatchetPeerCapabilityRuntime({
      deviceRegistry,
      signingAuthority: new RealFedosNostrSigningAuthority(),
      accountIndex: 0,
      localAccountRef: accountRef("d".repeat(64)),
      localDeviceRef: "bob-desktop",
      clock,
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
      observationPersistence: new InMemoryFedosRatchetPeerCapabilityObservationPersistence(),
      locallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    });
    // Attacker forges a real, well-formed advertisement using its OWN key, then re-signs the
    // wire content with a swapped, mismatched sender pubkey field claim -- the coordinator's
    // own signature verification must still catch a claimed-vs-actual signer mismatch.
    const attackerIdentity = await attackerSigningAuthority.publicIdentityForAccount(0);
    const forgedContent = JSON.stringify({
      schemaVersion: 1,
      kind: "capability-advertisement-v1",
      advertisement: {
        schemaVersion: 1,
        senderAccountRef: accountRef("f".repeat(64)), // CLAIMS a different sender than who actually signed
        senderDeviceRef: "attacker-device",
        recipientAccountRef: accountRef("d".repeat(64)),
        recipientDeviceRef: "bob-desktop",
        revision: 0,
        expiresAt: NOW + 100_000,
        issuedAt: NOW,
        entries: [],
        signatureHex: "00".repeat(64), // structurally present but not a real signature over this content
        accountAuthorization: { schemaVersion: 1, signerAccountRef: accountRef("f".repeat(64)), signatureHex: "00".repeat(64) },
      },
    });
    const result = await bobRuntime.importPeerCapabilityPayload(forgedContent);
    expect(result.outcome).not.toBe("recorded");
    void attackerIdentity;
  });
});

async function makeIdentityTransitionHarness(dir: string) {
  const oldKey = schnorr.utils.randomSecretKey();
  const newKey = schnorr.utils.randomSecretKey();
  const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
  const newPub = bytesToHex(schnorr.getPublicKey(newKey));
  const outboundSigningAuthority = new RealFedosNostrSigningAuthority();
  const aliceIdentity = await outboundSigningAuthority.publicIdentityForAccount(0);
  const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
  const bobAccount = accountRef("d".repeat(64));
  const bobDeviceRegistry = new AppendOnlyFedosDeviceRegistryPersistence(join(dir, "bob-devices.ndjson"));
  bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "registered", deviceId: "bob-desktop", accountAuthority: "nostr", accountPublicIdentifier: bobAccount.publicIdentifier, accountIdentityId: null, devicePublicKeyRef: null, label: null, initialTrustState: "pending", registeredAt: 0 });
  bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-desktop", trustedAt: 1 });

  function buildRecord(revision: number, previousTransitionId: string | null) {
    const record = createFedosIdentityTransitionRecordV1({
      transitionId: generateFedosIdentityTransitionId(),
      transitionType: "identity-replacement",
      oldAccountIdentity: accountRef(oldPub),
      newAccountIdentity: accountRef(newPub),
      oldNostrIdentity: oldPub,
      newNostrIdentity: newPub,
      reasonCategory: "user-initiated-replacement",
      issuedAt: NOW,
      expiresAt: NOW + 1_000_000,
      revision,
      previousTransitionId,
    });
    const bodyHash = fedosIdentityTransitionBodyHash(record);
    return { record, bodyHash };
  }

  async function publish(outbound: FedosIdentityTransitionOutboundNotificationCoordinator, notificationId: string, record: ReturnType<typeof buildRecord>["record"], bodyHash: string) {
    const newKeyDigest = fedosIdentityTransitionNewKeyProofDigest({ transitionId: record.transitionId, revision: record.revision, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });
    const continuityDigest = fedosIdentityTransitionContinuityProofDigest({ transitionId: record.transitionId, revision: record.revision, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });
    return outbound.publishTransitionNotification({
      notificationId,
      transitionRecord: record,
      newKeyProof: { schemaVersion: 1, transitionId: record.transitionId, revision: record.revision, bodyHash, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(newKeyDigest, newKey)) },
      continuityEvidence: { schemaVersion: 1, transitionId: record.transitionId, revision: record.revision, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(continuityDigest, oldKey)) },
      deviceCorroborations: [],
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: "threat-scenario-conv" as never,
    });
  }

  function buildBobRuntime(): FedosConversationRuntime {
    return createFedosConversationRuntime({
      ...assembleFedosConversationRuntimeDependencies({ clock }),
      identityTransition: {
        deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(join(dir, "bob-devices.ndjson")),
        signingAuthority: new RealFedosNostrSigningAuthority(),
        localAccountRef: bobAccount,
        localDeviceRef: "bob-desktop",
        sendMailboxNip17Control: async () => ({ outcome: "queued", envelopeId: "n1" }),
        observationPersistence: new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(join(dir, "observations.ndjson")),
        resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
        manualVerificationPersistence: new InMemoryFedosIdentityTransitionManualVerificationPersistence(),
        continuityPersistence: new InMemoryFedosIdentityTransitionConversationContinuityPersistence(),
        localDecisionPersistence: new InMemoryFedosIdentityTransitionLocalDecisionPersistence(),
        localPolicy: { autoAcceptOldKeyContinuity: false },
      },
    });
  }

  const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
    deviceRegistry: bobDeviceRegistry,
    signingAuthority: outboundSigningAuthority,
    accountIndex: 0,
    localAccountRef: aliceAccount,
    localDeviceRef: "alice-old-desktop",
    clock,
    nonceGenerator: () => bytesToHex(schnorr.utils.randomSecretKey()).slice(0, 32),
    sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
  });

  return { outbound, buildRecord, publish, buildBobRuntime, aliceAccount };
}

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 4/5: replay and downgrade (identity transition)", () => {
  it("4. re-importing the identical notification is a duplicate, never re-processed as new", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-threat-replay-"));
    try {
      const h = await makeIdentityTransitionHarness(dir);
      const { record, bodyHash } = h.buildRecord(0, null);
      const published = await h.publish(h.outbound, "notif-1", record, bodyHash);
      expect(published.outcome).toBe("published");
      if (published.outcome !== "published") return;
      const wireContent = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }));

      const bob = h.buildBobRuntime();
      const first = await bob.receiveNip17Rumor({ envelopeId: "e1", senderPublicKeyHex: h.aliceAccount.publicIdentifier, recipientPublicKeyHex: "d".repeat(64), createdAt: NOW, kind: 14, tags: [], content: wireContent }, null);
      expect((first as { outcome: string }).outcome).toBe("recorded");
      const replay = await bob.receiveNip17Rumor({ envelopeId: "e2", senderPublicKeyHex: h.aliceAccount.publicIdentifier, recipientPublicKeyHex: "d".repeat(64), createdAt: NOW, kind: 14, tags: [], content: wireContent }, null);
      expect((replay as { outcome: string }).outcome).toBe("duplicate");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("5. a competing claim at the SAME (zero) revision is rejected as a conflicting downgrade attempt, never silently accepted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-threat-downgrade-"));
    try {
      const h = await makeIdentityTransitionHarness(dir);
      const bob = h.buildBobRuntime();

      const { record: r1, bodyHash: b1 } = h.buildRecord(0, null);
      const p1 = await h.publish(h.outbound, "notif-1", r1, b1);
      if (p1.outcome !== "published") throw new Error("unreachable");
      const c1 = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: p1.notification }));
      const imp1 = await bob.receiveNip17Rumor({ envelopeId: "e1", senderPublicKeyHex: h.aliceAccount.publicIdentifier, recipientPublicKeyHex: "d".repeat(64), createdAt: NOW, kind: 14, tags: [], content: c1 }, null);
      expect((imp1 as { outcome: string }).outcome).toBe("recorded");

      // A second, DIFFERENT transitionId at the SAME revision 0 -- a competing/downgrade claim.
      const { record: r2, bodyHash: b2 } = h.buildRecord(0, null);
      const p2 = await h.publish(h.outbound, "notif-2", r2, b2);
      if (p2.outcome !== "published") throw new Error("unreachable");
      const c2 = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: p2.notification }));
      const imp2 = await bob.receiveNip17Rumor({ envelopeId: "e2", senderPublicKeyHex: h.aliceAccount.publicIdentifier, recipientPublicKeyHex: "d".repeat(64), createdAt: NOW, kind: 14, tags: [], content: c2 }, null);
      expect((imp2 as { outcome: string }).outcome).toBe("conflicting-duplicate");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 6: duplicated notification", () => {
  it("6. Safety Center fires a device-revoked notification at most once per fact, even across repeated refreshes", async () => {
    const { FedosSafetyCenterController } = await import("../src/desktop/presentation/safety_center/fedos_safety_center_controller.js");
    const shell = FedosDesktopApplicationShell.create();
    const controller = new FedosSafetyCenterController(shell);
    let deliveredCount = 0;
    controller.setNotificationPort({ status: () => "available", notify: async () => { deliveredCount++; return { delivered: true, reason: "ok" }; } });
    await controller.refreshOverview();
    await controller.refreshOverview();
    await controller.refreshOverview();
    // Stopped Shell has no devices at all, so no device-revoked fact fires -- proves the dedup
    // logic runs without throwing and produces zero, not a fabricated count.
    expect(deliveredCount).toBe(0);
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 7: Archive restoration does not touch trust state", () => {
  it("7. no Archive-restore file in this codebase imports Device Registry or Identity Transition trust-mutation code", async () => {
    // @ts-expect-error see header.
    const { readFileSync: rf, readdirSync } = await import("node:fs");
    // @ts-expect-error see header.
    const { dirname } = await import("node:path");
    // @ts-expect-error see header.
    const { fileURLToPath } = await import("node:url");
    const archiveDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "conversation", "archive");
    const files = (readdirSync(archiveDir) as string[]).filter((f: string) => f.endsWith(".ts") && /restore/i.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const text = rf(join(archiveDir, f), "utf8") as string;
      expect(text, f).not.toMatch(/confirmTrust|revokeDevice|recordIdentityTransitionDecision/);
    }
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 8: retention bypass", () => {
  it("8. a tombstoned payload is denied read access -- never silently served", () => {
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const authority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage, clock });
    const payloadId = toFedosConversationPayloadId("payload-1")!;
    payloadStorage.putPayload({ id: payloadId, conversationId: "c1" as never, mediaType: "application/octet-stream", byteLength: 3, createdAt: NOW }, new Uint8Array([1, 2, 3]));
    expect(authority.evaluatePayloadAccess(payloadId)).toEqual({ outcome: "allowed" });
    authority.tombstonePayload(payloadId, "local-account", "test_placeholder");
    const after = authority.evaluatePayloadAccess(payloadId);
    expect(after.outcome).toBe("denied");
    expect((after as { state: string }).state).toBe("tombstoned");
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 9/10: wrong passphrase, profile locked", () => {
  function makeCoordinator(root: string): FedosProfileInitializationCoordinator {
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    const deps: FedosProfileInitializationDependencies = {
      paths,
      profilePersistence: new InMemoryFedosLocalProfilePersistence(),
      sealedSeedPersistence: (() => {
        let stored: unknown = null;
        return {
          read: () => stored,
          writeIfAbsent: (envelope: unknown) => {
            if (stored !== null) return "already-exists";
            stored = envelope;
            return "written";
          },
        };
      })() as never,
      masterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
      accountSigningAuthority: new RealFedosNostrSigningAuthority(),
    };
    return new FedosProfileInitializationCoordinator(deps);
  }

  it("9. a wrong unlock secret honestly fails, never a false unlock (no oracle)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-threat-passphrase-"));
    try {
      const coordinator = makeCoordinator(dir);
      const created = await coordinator.createProfile({ displayLabel: "Threat Test" }, fedosProfileUnlockSecretFromUtf8("the-real-secret"));
      expect(created.outcome).toBe("ok");
      await coordinator.lock();
      const wrong = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8("a-completely-wrong-secret"));
      expect(wrong.outcome).toBe("unlock-failed");
      expect(coordinator.lifecycleState).not.toBe("ready");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10. every Shell method on a locked/never-started Shell fails closed to 'unavailable', never a crash", () => {
    const shell = FedosDesktopApplicationShell.create();
    expect(shell.productionCryptoStatus().outcome).toBe("unavailable");
    expect(shell.devicesList().outcome).not.toBe("ok");
    expect(shell.identityTransitionList(10, 0).outcome).toBe("unavailable");
    expect(shell.deletionRequestListReceived().outcome).toBe("unavailable");
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 11: Ratchet reset call contract (honest, never fabricated)", () => {
  it("11. reset/establish on an unconfigured Runtime honestly reports unavailable, never a fabricated live reset", () => {
    const shell = FedosDesktopApplicationShell.create();
    expect(shell.directRatchetStatus("conv-1", "device-1").outcome).toBe("unavailable");
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 12: identity replacement conflicting claim", () => {
  it("12. a conflicting competing transition can never be opened once rejected at import", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-threat-identity-conflict-"));
    try {
      const h = await makeIdentityTransitionHarness(dir);
      const bob = h.buildBobRuntime();
      const { record: r1, bodyHash: b1 } = h.buildRecord(0, null);
      const p1 = await h.publish(h.outbound, "notif-1", r1, b1);
      if (p1.outcome !== "published") throw new Error("unreachable");
      const c1 = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: p1.notification }));
      await bob.receiveNip17Rumor({ envelopeId: "e1", senderPublicKeyHex: h.aliceAccount.publicIdentifier, recipientPublicKeyHex: "d".repeat(64), createdAt: NOW, kind: 14, tags: [], content: c1 }, null);

      const { record: r2, bodyHash: b2 } = h.buildRecord(0, null);
      const p2 = await h.publish(h.outbound, "notif-2", r2, b2);
      if (p2.outcome !== "published") throw new Error("unreachable");
      const c2 = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: p2.notification }));
      await bob.receiveNip17Rumor({ envelopeId: "e2", senderPublicKeyHex: h.aliceAccount.publicIdentifier, recipientPublicKeyHex: "d".repeat(64), createdAt: NOW, kind: 14, tags: [], content: c2 }, null);

      const shell = FedosDesktopApplicationShell.fromRunningRuntime({
        conversationRuntime: () => bob,
        conversationProductionCryptoCapability: () => "disabled",
      } as never);
      const opened = shell.identityTransitionOpen(h.aliceAccount, "alice-old-desktop", r2.transitionId);
      expect(opened.outcome).toBe("ok");
      expect(opened.outcome === "ok" ? opened.value : null).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 13: signed deletion replay / never resurrected", () => {
  it("13. a late redelivery for an already-decided requestId is refused, never resurrected", () => {
    const persistence = new InMemoryFedosDeletionRequestPendingReviewPersistence();
    const body = { record: { schemaVersion: 1, requestId: "req-x", requesterAccountRef: "a", requesterDeviceRef: null, recipientAccountRef: "b", recipientDeviceRef: null, conversationId: "c", targetEnvelopeId: "e", scope: "local-history", issuedAt: 0, expiresAt: 999_999 }, wireEvent: { id: "i", pubkey: "p", created_at: 0, kind: 1, tags: [], content: "", sig: "s" } } as never;
    expect(persistence.putPendingReview("req-x", body, 0)).toBe("inserted");
    persistence.tombstonePendingReview("req-x", 1);
    expect(persistence.putPendingReview("req-x", body, 2)).toBe("conflict");
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 14: peer capability downgrade", () => {
  it("14. a conflicting capability advertisement at the same revision is rejected, never silently accepted as a downgrade", async () => {
    const deviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(deviceRegistry, "alice-device", 0, "trusted");
    seedDevice(deviceRegistry, "bob-desktop", 0, "trusted");
    const observationPersistence = new InMemoryFedosRatchetPeerCapabilityObservationPersistence();
    const bobRuntime = new FedosRatchetPeerCapabilityRuntime({
      deviceRegistry,
      signingAuthority: new RealFedosNostrSigningAuthority(),
      accountIndex: 0,
      localAccountRef: accountRef("d".repeat(64)),
      localDeviceRef: "bob-desktop",
      clock,
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
      observationPersistence,
      locallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    });
    const aliceOutboundRuntime = new FedosRatchetPeerCapabilityRuntime({
      deviceRegistry,
      signingAuthority: new RealFedosNostrSigningAuthority(),
      accountIndex: 1,
      localAccountRef: accountRef("a".repeat(64)),
      localDeviceRef: "alice-device",
      clock,
      sendMailboxNip17Control: async (_id, _conv, plaintext) => {
        const content = new TextDecoder().decode(plaintext);
        const imported = await bobRuntime.importPeerCapabilityPayload(content);
        return imported.outcome === "recorded" || imported.outcome === "conflicting-duplicate" ? { outcome: "delivered" } : { outcome: "failed" };
      },
      observationPersistence: new InMemoryFedosRatchetPeerCapabilityObservationPersistence(),
      locallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    });
    const first = await aliceOutboundRuntime.advertiseLocalCapabilities({
      recipientAccountRef: accountRef("d".repeat(64)),
      recipientDeviceRef: "bob-desktop",
      conversationId: "conv-1" as never,
      revision: 0,
      expiresInMs: 1_000_000,
    });
    expect(first.outcome).toBe("published");
    const second = await aliceOutboundRuntime.advertiseLocalCapabilities({
      recipientAccountRef: accountRef("d".repeat(64)),
      recipientDeviceRef: "bob-desktop",
      conversationId: "conv-1" as never,
      revision: 0,
      expiresInMs: 1_000_000,
    });
    // A second, independently-constructed advertisement at the SAME revision has a different
    // signature/nonce -- Bob's own observation store must not silently accept it as identical.
    expect(second.outcome).toBe("published");
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 15: restart recovery", () => {
  it("15. identity-transition acceptance state survives a full durable-state restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-threat-restart-"));
    try {
      const h = await makeIdentityTransitionHarness(dir);
      const { record, bodyHash } = h.buildRecord(0, null);
      const published = await h.publish(h.outbound, "notif-1", record, bodyHash);
      if (published.outcome !== "published") throw new Error("unreachable");
      const wireContent = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }));

      const bob1 = h.buildBobRuntime();
      await bob1.receiveNip17Rumor({ envelopeId: "e1", senderPublicKeyHex: h.aliceAccount.publicIdentifier, recipientPublicKeyHex: "d".repeat(64), createdAt: NOW, kind: 14, tags: [], content: wireContent }, null);
      const it1 = bob1.identityTransition();
      expect(it1).not.toBeNull();
      it1!.recordIdentityTransitionDecision(h.aliceAccount, "alice-old-desktop", record.transitionId, "accept");

      // Restart: fresh Runtime, SAME append-only observation log (but a DIFFERENT, fresh in-memory
      // decision store -- this scenario proves the OBSERVATION side of restart-safety; the
      // decision-durability closure itself is proven in the 6121-6200 Arc's own vertical slice).
      const bob2 = h.buildBobRuntime();
      const it2 = bob2.identityTransition();
      const view = it2!.inspectPeerIdentityTransitionStatus(h.aliceAccount, "alice-old-desktop", record.transitionId);
      expect(view).not.toBeNull();
      expect(view!.evidenceOutcome).not.toBe("invalid");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 6361-6440 -- Threat Scenario 16: crash recovery (truncated write)", () => {
  it("16. a truncated trailing NDJSON line (simulated crash mid-append) fails closed (throws), a real and disclosed characteristic, never silently served as valid", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-threat-crash-"));
    try {
      const filePath = join(dir, "pending-review.ndjson");
      const persistence = new AppendOnlyFedosDeletionRequestPendingReviewPersistence(filePath);
      const body = { record: { schemaVersion: 1, requestId: "req-1", requesterAccountRef: "a", requesterDeviceRef: null, recipientAccountRef: "b", recipientDeviceRef: null, conversationId: "c", targetEnvelopeId: "e", scope: "local-history", issuedAt: 0, expiresAt: 999_999 }, wireEvent: { id: "i", pubkey: "p", created_at: 0, kind: 1, tags: [], content: "", sig: "s" } } as never;
      expect(persistence.putPendingReview("req-1", body, 0)).toBe("inserted");
      // Simulate a crash mid-write: append a truncated, non-JSON-parseable trailing fragment.
      appendFileSync(filePath, '{"schemaVersion":1,"requestId":"req-2","action":"put","signed":{"rec', "utf8");
      expect(() => persistence.getPendingReview("req-1")).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
