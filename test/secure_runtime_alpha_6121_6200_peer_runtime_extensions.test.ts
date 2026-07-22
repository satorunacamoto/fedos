import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { FedosIdentityTransitionPeerRuntime } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.js";
import { InMemoryFedosIdentityTransitionPeerObservationPersistence } from "../src/conversation/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import { InMemoryFedosIdentityTransitionManualVerificationPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import { InMemoryFedosIdentityTransitionConversationContinuityPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";
import { InMemoryFedosIdentityTransitionLocalDecisionPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_local_decision.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest, fedosIdentityTransitionContinuityProofDigest } from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

const CONVERSATION_ID = "conv-1" as unknown as FedosConversationId;

function makeBobRuntime(bobAccount: FedosDeviceBindingAccountRef, overrides: Partial<ConstructorParameters<typeof FedosIdentityTransitionPeerRuntime>[0]> = {}) {
  return new FedosIdentityTransitionPeerRuntime({
    deviceRegistry: new InMemoryFedosDeviceRegistryPersistence(),
    signingAuthority: new RealFedosNostrSigningAuthority(),
    accountIndex: 0,
    localAccountRef: bobAccount,
    localDeviceRef: "bob-desktop",
    clock: () => 5_000,
    nonceGenerator: () => "1".repeat(32),
    sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
    observationPersistence: new InMemoryFedosIdentityTransitionPeerObservationPersistence(),
    resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
    manualVerificationPersistence: new InMemoryFedosIdentityTransitionManualVerificationPersistence(),
    continuityPersistence: new InMemoryFedosIdentityTransitionConversationContinuityPersistence(),
    localDecisionPersistence: new InMemoryFedosIdentityTransitionLocalDecisionPersistence(),
    ...overrides,
  } as any);
}

async function publishAndImport(
  bobRuntime: FedosIdentityTransitionPeerRuntime,
  bobAccount: FedosDeviceBindingAccountRef,
  notificationId: string,
  options: { readonly withContinuityEvidence?: boolean } = {},
) {
  const withContinuityEvidence = options.withContinuityEvidence ?? true;
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const aliceIdentity = await signingAuthority.publicIdentityForAccount(0);
  const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
  const oldKey = schnorr.utils.randomSecretKey();
  const newKey = schnorr.utils.randomSecretKey();
  const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
  const newPub = bytesToHex(schnorr.getPublicKey(newKey));
  const record = createFedosIdentityTransitionRecordV1({
    transitionId: generateFedosIdentityTransitionId(),
    transitionType: "identity-replacement",
    oldAccountIdentity: accountRef(oldPub),
    newAccountIdentity: accountRef(newPub),
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    reasonCategory: "user-initiated-replacement",
    issuedAt: 1_000,
    expiresAt: 1_000_000,
    revision: 0,
    previousTransitionId: null,
  });
  const bodyHash = fedosIdentityTransitionBodyHash(record);
  const newKeyDigest = fedosIdentityTransitionNewKeyProofDigest({
    transitionId: record.transitionId,
    revision: 0,
    bodyHash,
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
  const continuityDigest = fedosIdentityTransitionContinuityProofDigest({
    transitionId: record.transitionId,
    revision: 0,
    bodyHash,
    oldNostrIdentity: oldPub,
    newNostrIdentity: newPub,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });

  const bobDeviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
  bobDeviceRegistry.putEvent({
    schemaVersion: 1,
    eventType: "registered",
    deviceId: "bob-desktop",
    accountAuthority: "nostr",
    accountPublicIdentifier: bobAccount.publicIdentifier,
    accountIdentityId: null,
    devicePublicKeyRef: null,
    label: null,
    initialTrustState: "pending",
    registeredAt: 0,
  });
  bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-desktop", trustedAt: 1 });

  const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
    deviceRegistry: bobDeviceRegistry,
    signingAuthority,
    accountIndex: 0,
    localAccountRef: aliceAccount,
    localDeviceRef: "alice-old-desktop",
    clock: () => 1_500,
    nonceGenerator: () => "9".repeat(32),
    sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
  });
  const published = await outbound.publishTransitionNotification({
    notificationId,
    transitionRecord: record,
    newKeyProof: {
      schemaVersion: 1,
      transitionId: record.transitionId,
      revision: 0,
      bodyHash,
      newNostrIdentity: newPub,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      signatureHex: bytesToHex(schnorr.sign(newKeyDigest, newKey)),
    },
    continuityEvidence: withContinuityEvidence
      ? {
          schemaVersion: 1,
          transitionId: record.transitionId,
          revision: 0,
          bodyHash,
          oldNostrIdentity: oldPub,
          newNostrIdentity: newPub,
          issuedAt: record.issuedAt,
          expiresAt: record.expiresAt,
          signatureHex: bytesToHex(schnorr.sign(continuityDigest, oldKey)),
        }
      : null,
    deviceCorroborations: [],
    recipientAccountRef: bobAccount,
    recipientDeviceRef: "bob-desktop",
    conversationId: CONVERSATION_ID,
  });
  if (published.outcome !== "published") throw new Error("setup failed: " + published.outcome);
  const wireContent = new TextDecoder().decode(
    encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }),
  );
  const imported = await bobRuntime.importIdentityTransitionNotification(wireContent);
  if (imported.outcome !== "recorded") throw new Error("import failed: " + imported.outcome);
  return { record, aliceAccount, transitionId: record.transitionId };
}

describe("FedosIdentityTransitionPeerRuntime — Phase B/C/D/F/J extensions", () => {
  it("durably persists an accept decision — a fresh inspect call (no decision passed) still sees it accepted", async () => {
    const bobAccount = accountRef("d".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "n-1");

    const view1 = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    expect(view1?.acceptanceState).toBe("accepted");

    const view2 = runtime.inspectPeerIdentityTransitionStatus(aliceAccount, "alice-old-desktop", transitionId);
    expect(view2?.acceptanceState).toBe("accepted");
  });

  it("reject after accept overrides to rejected (a later, higher-revision decision wins)", async () => {
    const bobAccount = accountRef("e".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "n-2");
    runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    const rejected = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "reject");
    expect(rejected?.acceptanceState).toBe("rejected");
  });

  it("defer never changes acceptanceState away from its evidence-only baseline", async () => {
    const bobAccount = accountRef("f".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "n-3");
    const before = runtime.inspectPeerIdentityTransitionStatus(aliceAccount, "alice-old-desktop", transitionId);
    const deferred = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "defer");
    expect(deferred?.acceptanceState).toBe(before?.acceptanceState);
  });

  it("getIdentityTransitionSafeView returns a full, closed DTO with warnings and no manual verification yet", async () => {
    const bobAccount = accountRef("1".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "n-4");
    const view = runtime.getIdentityTransitionSafeView(aliceAccount, "alice-old-desktop", transitionId);
    expect(view).not.toBeNull();
    expect(view!.manualVerification).toBeNull();
    expect(view!.deviceEvidence).toHaveLength(1);
    expect(view!.warnings).toContain("replacement-not-rotation");
  });

  it("recordManualVerification is reflected in the safe view afterward", async () => {
    const bobAccount = accountRef("2".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "n-5");
    const result = runtime.recordManualVerification({ transitionId, method: "safety-number-comparison", verifiedAt: 9_000, noteCode: "confirmed-match" });
    expect(result).toBe("recorded");
    const view = runtime.getIdentityTransitionSafeView(aliceAccount, "alice-old-desktop", transitionId);
    expect(view!.manualVerification).toEqual({ method: "safety-number-comparison", verifiedAt: 9_000, noteCode: "confirmed-match" });
  });

  it("unknown manual verification method fails closed", async () => {
    const bobAccount = accountRef("3".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { transitionId } = await publishAndImport(runtime, bobAccount, "n-6");
    const result = runtime.recordManualVerification({ transitionId, method: "smoke-signal" as any, verifiedAt: 1, noteCode: "confirmed-match" });
    expect(result).toBe("unavailable");
  });

  it("recordConversationContinuity refuses unless the transition is already accepted", async () => {
    const bobAccount = accountRef("4".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { transitionId } = await publishAndImport(runtime, bobAccount, "n-7", { withContinuityEvidence: false });
    const result = runtime.recordConversationContinuity({ conversationId: "conv-x", transitionId, acceptedAt: 1, newSessionRequired: true });
    expect(result).toBe("not-accepted");
  });

  it("recordConversationContinuity succeeds once accepted, and getConversationContinuity reads it back", async () => {
    const bobAccount = accountRef("5".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "n-8");
    runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    const writeResult = runtime.recordConversationContinuity({ conversationId: "conv-x", transitionId, acceptedAt: 9_999, newSessionRequired: true });
    expect(writeResult).toBe("inserted");
    const read = runtime.getConversationContinuity("conv-x");
    expect(read?.transitionId).toBe(transitionId);
    expect(read?.newSessionRequired).toBe(true);
    expect(read?.superseded).toBe(false);
  });

  it("listIdentityTransitionInbox shows one row per logical transition, bounded and deterministic", async () => {
    const bobAccount = accountRef("6".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    await publishAndImport(runtime, bobAccount, "n-9a");
    await publishAndImport(runtime, bobAccount, "n-9b");
    const inbox = runtime.listIdentityTransitionInbox(10, 0);
    expect(inbox).toHaveLength(2);
    const inboxPage1 = runtime.listIdentityTransitionInbox(1, 0);
    expect(inboxPage1).toHaveLength(1);
  });

  it("a stopped runtime returns empty/null/unavailable everywhere, never throws", async () => {
    const bobAccount = accountRef("7".repeat(64));
    const runtime = makeBobRuntime(bobAccount);
    runtime.stop();
    expect(runtime.listIdentityTransitionInbox(10, 0)).toEqual([]);
    expect(runtime.inspectPeerIdentityTransitionStatus(accountRef("a".repeat(64)), "d", "fedos-identity-transition-" + "0".repeat(32))).toBeNull();
    expect(runtime.recordManualVerification({ transitionId: "fedos-identity-transition-" + "0".repeat(32), method: "in-person-confirmation", verifiedAt: 1, noteCode: "none" })).toBe("unavailable");
  });
});
