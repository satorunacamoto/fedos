/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent S) — Task 1: old-key continuity auto-accept VISIBILITY recovery.
 *
 * `FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY.autoAcceptOldKeyContinuity`
 * stays `true` (unchanged, out of scope) -- these tests pin that the
 * silent auto-accept it produces is now DETECTABLE and SURFACED, without
 * ever flagging a normal, explicitly-reviewed identity continuity flow as
 * a false positive.
 *
 * Three layers, matching this codebase's own established test structure:
 *   1. The pure detector, `isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity()`.
 *   2. Real end-to-end wiring through `FedosIdentityTransitionPeerRuntime`
 *      (real crypto, mirrors `secure_runtime_alpha_6121_6200_peer_runtime_extensions.test.ts`'s
 *      own `publishAndImport()` helper).
 *   3. The Safety Center summary aggregation
 *      (`fedosSafetyCenterBuildSummary()`), pure/fixture-based.
 */
import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { FedosIdentityTransitionPeerRuntime } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.js";
import { InMemoryFedosIdentityTransitionPeerObservationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import { InMemoryFedosIdentityTransitionManualVerificationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import { InMemoryFedosIdentityTransitionConversationContinuityPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";
import { InMemoryFedosIdentityTransitionLocalDecisionPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_local_decision.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_id.js";
import {
  fedosIdentityTransitionBodyHash,
  fedosIdentityTransitionNewKeyProofDigest,
  fedosIdentityTransitionContinuityProofDigest,
} from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_canonical.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "../src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_silent_acceptance_detection.js";
import { fedosSafetyCenterBuildSummary, type FedosSafetyCenterRawFacts } from "../src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_summary.js";

// ---------------------------------------------------------------------
// Layer 1: the pure detector.
// ---------------------------------------------------------------------

describe("isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity -- pure detector", () => {
  it("detects the risky case: locally-acceptable + accepted + not superseded", () => {
    expect(
      isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity({
        evidenceOutcome: "locally-acceptable",
        acceptanceState: "accepted",
        superseded: false,
      }),
    ).toBe(true);
  });

  it("never fires once superseded, even if the raw outcome was locally-acceptable", () => {
    expect(
      isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity({
        evidenceOutcome: "locally-acceptable",
        acceptanceState: "accepted",
        superseded: true,
      }),
    ).toBe(false);
  });

  it("NO false warning: an explicitly-accepted transition (evidenceOutcome NOT locally-acceptable) is never flagged", () => {
    // This models a real "manual-review-required" transition the user
    // reviewed and explicitly accepted through the Identity Transition
    // screen's own Accept button -- acceptanceState reaches "accepted"
    // ONLY via that explicit decision here, never via the evaluator alone.
    expect(
      isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity({
        evidenceOutcome: "manual-verification-required",
        acceptanceState: "accepted",
        superseded: false,
      }),
    ).toBe(false);
    expect(
      isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity({
        evidenceOutcome: "continuity-old-key-only",
        acceptanceState: "accepted",
        superseded: false,
      }),
    ).toBe(false);
    expect(
      isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity({
        evidenceOutcome: "device-corroborated",
        acceptanceState: "accepted",
        superseded: false,
      }),
    ).toBe(false);
  });

  it("NO false warning: every other closed outcome/state combination is quiet", () => {
    const outcomes = [
      "invalid",
      "new-key-unproven",
      "continuity-unproven",
      "continuity-old-key-only",
      "device-corroborated",
      "manual-verification-required",
      "rejected",
      "stale",
      "rollback-detected",
      "conflicting",
      "superseded",
      "unsupported",
      "unavailable",
    ] as const;
    for (const evidenceOutcome of outcomes) {
      expect(
        isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity({
          evidenceOutcome,
          acceptanceState: "accepted",
          superseded: false,
        }),
      ).toBe(false);
    }
  });

  it("a still-pending (not-yet-accepted) transition is never flagged", () => {
    expect(
      isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity({
        evidenceOutcome: "locally-acceptable",
        acceptanceState: "manual-review-required",
        superseded: false,
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Layer 2: real end-to-end wiring (real Schnorr crypto, real persistence,
// real evaluator) -- mirrors `secure_runtime_alpha_6121_6200_peer_runtime_extensions.test.ts`.
// ---------------------------------------------------------------------

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

const CONVERSATION_ID = "conv-task1" as unknown as FedosConversationId;

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
  options: { readonly withContinuityEvidence?: boolean; readonly reasonCategory?: string } = {},
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
    reasonCategory: (options.reasonCategory as any) ?? "user-initiated-replacement",
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

describe("Task 1 -- real end-to-end: old-key continuity silent auto-accept, real crypto", () => {
  it("SECURITY FIX (FedOS red-team P0 closure): an old-key-only continuity claim under the DEFAULT policy no longer silently auto-accepts -- it stays pending (manual-review-required), never flagged as silently accepted because it never reaches 'accepted' without an explicit decision", async () => {
    const bobAccount = accountRef("aa".repeat(32));
    // No localPolicy override -- exercises FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY.
    // `autoAcceptOldKeyContinuity: true` no longer has any effect on
    // evidence evaluation (see `fedos_identity_transition_evidence_evaluation.ts`'s
    // own SECURITY FIX comment) -- old-key-only continuity, with no
    // Device corroboration, now ALWAYS caps out at "continuity-old-key-only",
    // which requires an explicit local decision before it can become
    // "accepted". This closes the exact vulnerability this Task's
    // detector was built to surface, so the detector correctly stays
    // quiet here now (nothing silent is happening anymore).
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "task1-n1");

    const status = runtime.inspectPeerIdentityTransitionStatus(aliceAccount, "alice-old-desktop", transitionId);
    expect(status?.evidenceOutcome).toBe("continuity-old-key-only");
    expect(status?.acceptanceState).not.toBe("accepted");
    expect(status?.acceptanceState).toBe("manual-review-required");
    // Never asked -- no explicit decision was ever recorded, and evidence
    // alone no longer reaches "accepted" either.
    expect(status?.silentlyAutoAcceptedWithoutAsking).toBe(false);

    const safeView = runtime.getIdentityTransitionSafeView(aliceAccount, "alice-old-desktop", transitionId);
    expect(safeView?.silentlyAutoAcceptedWithoutAsking).toBe(false);
    expect(safeView?.warnings).not.toContain("identity-replacement-auto-accepted-without-asking");

    const inbox = runtime.listIdentityTransitionInbox(10, 0);
    const row = inbox.find((r) => r.transitionId === transitionId);
    expect(row?.silentlyAutoAcceptedWithoutAsking).toBe(false);

    // The positive path still works: an explicit local decision to accept
    // must still succeed.
    const afterAccept = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    expect(afterAccept?.acceptanceState).toBe("accepted");
    expect(afterAccept?.silentlyAutoAcceptedWithoutAsking).toBe(false);
  });

  it("NO false warning: the SAME old-key-only claim under the conservative policy (autoAcceptOldKeyContinuity: false), explicitly reviewed and accepted by the user, is never flagged", async () => {
    const bobAccount = accountRef("bb".repeat(32));
    const runtime = makeBobRuntime(bobAccount, { localPolicy: { autoAcceptOldKeyContinuity: false } } as any);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "task1-n2");

    // Before any decision: evaluator alone must NOT have reached "accepted".
    const before = runtime.inspectPeerIdentityTransitionStatus(aliceAccount, "alice-old-desktop", transitionId);
    expect(before?.evidenceOutcome).toBe("continuity-old-key-only");
    expect(before?.acceptanceState).not.toBe("accepted");
    expect(before?.silentlyAutoAcceptedWithoutAsking).toBe(false);

    // The user reviews it and explicitly clicks Accept.
    const after = runtime.recordIdentityTransitionDecision(aliceAccount, "alice-old-desktop", transitionId, "accept");
    expect(after?.acceptanceState).toBe("accepted");
    // Reached "accepted" ONLY via the explicit decision -- must never be reported as "accepted without asking".
    expect(after?.silentlyAutoAcceptedWithoutAsking).toBe(false);

    const safeView = runtime.getIdentityTransitionSafeView(aliceAccount, "alice-old-desktop", transitionId);
    expect(safeView?.silentlyAutoAcceptedWithoutAsking).toBe(false);
    expect(safeView?.warnings).not.toContain("identity-replacement-auto-accepted-without-asking");
  });

  it("NO false warning: a still-pending item (no evidence yet reaching an accept-eligible state) is never flagged", async () => {
    const bobAccount = accountRef("cc".repeat(32));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "task1-n3", { withContinuityEvidence: false });

    const status = runtime.inspectPeerIdentityTransitionStatus(aliceAccount, "alice-old-desktop", transitionId);
    expect(status?.acceptanceState).not.toBe("accepted");
    expect(status?.silentlyAutoAcceptedWithoutAsking).toBe(false);
  });

  it("NO false warning: a compromise-reason transition (old key alone is never sufficient there, by the evaluator's own Absolute Prohibition) is never flagged even though continuity evidence is present", async () => {
    const bobAccount = accountRef("dd".repeat(32));
    const runtime = makeBobRuntime(bobAccount);
    const { aliceAccount, transitionId } = await publishAndImport(runtime, bobAccount, "task1-n4", { reasonCategory: "key-compromise-suspected" });

    const status = runtime.inspectPeerIdentityTransitionStatus(aliceAccount, "alice-old-desktop", transitionId);
    expect(status?.evidenceOutcome).toBe("manual-verification-required");
    expect(status?.acceptanceState).not.toBe("accepted");
    expect(status?.silentlyAutoAcceptedWithoutAsking).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Layer 3: Safety Center summary aggregation -- pure, fixture-based.
// ---------------------------------------------------------------------

function safetyFacts(over: Partial<FedosSafetyCenterRawFacts> = {}): FedosSafetyCenterRawFacts {
  return {
    profileLifecycleState: "ready",
    productionCrypto: "available",
    trustedDeviceCount: 1,
    revokedDeviceCount: 0,
    totalKnownDeviceCount: 1,
    deviceSyncRunning: null,
    pendingSyncConflictCount: 0,
    ratchetSessionStatuses: [],
    peerCapabilityStatuses: [],
    peerCapabilityRuntimeConfigured: true,
    pendingIdentityReplacementCount: 0,
    accountSilentlyAcceptedIdentityReplacementCount: 0,
    identityReplacementRuntimeConfigured: true,
    pendingDeletionConsentCount: 0,
    mixedOrUnknownDeletionOutcomeCount: 0,
    deletionRequestRuntimeConfigured: true,
    notificationsEnabled: true,
    backgroundSyncEnabled: true,
    ...over,
  };
}

function identitySectionOf(summary: ReturnType<typeof fedosSafetyCenterBuildSummary>) {
  return summary.sections.find((s) => s.section === "identity-replacement");
}

describe("Task 1 -- Safety Center summary surfaces the silent auto-accept fact", () => {
  it("raises the identity section to 'warning' (a real concern, ranked above mere attention) when a silent auto-accept exists", () => {
    const summary = fedosSafetyCenterBuildSummary(safetyFacts({ accountSilentlyAcceptedIdentityReplacementCount: 1 }));
    const identity = identitySectionOf(summary);
    expect(identity?.state).toBe("warning");
    expect(identity?.reason).toMatch(/accepted automatically without asking/);
    expect(summary.accountSilentlyAcceptedIdentityReplacementCount).toBe(1);
  });

  it("ranks an already-accepted (silent) replacement ABOVE a merely pending one -- the accepted case is worse", () => {
    const summary = fedosSafetyCenterBuildSummary(
      safetyFacts({ accountSilentlyAcceptedIdentityReplacementCount: 1, pendingIdentityReplacementCount: 5 }),
    );
    const identity = identitySectionOf(summary);
    expect(identity?.state).toBe("warning");
    expect(identity?.reason).toMatch(/accepted automatically/);
  });

  it("NO false warning: a merely-pending replacement (nothing silently accepted) stays at the pre-existing 'attention' level, unaffected", () => {
    const summary = fedosSafetyCenterBuildSummary(safetyFacts({ pendingIdentityReplacementCount: 2 }));
    const identity = identitySectionOf(summary);
    expect(identity?.state).toBe("attention");
    expect(identity?.reason).toMatch(/pending review/);
  });

  it("NO false warning: zero of both counts stays 'ready'", () => {
    const summary = fedosSafetyCenterBuildSummary(safetyFacts());
    expect(identitySectionOf(summary)?.state).toBe("ready");
  });

  it("the silently-accepted count folds into the one overview attentionCount", () => {
    const summary = fedosSafetyCenterBuildSummary(safetyFacts({ accountSilentlyAcceptedIdentityReplacementCount: 3 }));
    expect(summary.attentionCount).toBeGreaterThanOrEqual(3);
  });

  it("Runtime-not-configured stays honestly 'unavailable', never fabricated as a warning", () => {
    const summary = fedosSafetyCenterBuildSummary(
      safetyFacts({ identityReplacementRuntimeConfigured: false, accountSilentlyAcceptedIdentityReplacementCount: 1 }),
    );
    expect(identitySectionOf(summary)?.state).toBe("unavailable");
  });
});
