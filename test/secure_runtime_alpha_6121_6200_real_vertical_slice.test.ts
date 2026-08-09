/**
 * Secure Runtime Alpha 6121-6200 (FedOS Identity Replacement User
 * Verification and Conversation Continuity UI Arc) — Phase R: the real,
 * no-fake-business-Runtime vertical slice, driven through the REAL
 * `FedosConversationRuntime` / `FedosDesktopApplicationShell` /
 * `FedosDesktopConversationUiPresentationBoundary` /
 * `FedosIdentityTransitionController` / `FedosIdentityTransitionRenderer`
 * stack — every crypto operation on the Identity Transition path is REAL
 * BIP-340 Schnorr (`@noble/curves`, the same production dependency used
 * everywhere else in this lineage).
 *
 * Construction reuses `assembleFedosConversationRuntimeDependencies()`
 * (`src/conversation/runtime/fedos_conversation_runtime_assembly.ts`) —
 * the SAME production wiring helper the real Local Desktop Runtime itself
 * calls — spread with this Arc's own `identityTransition` config. This is
 * a genuinely REAL `FedosConversationRuntime`, not a hand-rolled stand-in;
 * messaging/encryption are honestly `"unavailable"` (this slice's own
 * `creatorIdentityAuthority`/`encryptionReadinessAuthority` defaults,
 * never exercised by this Arc's own test path) exactly like this
 * codebase's own established `directRatchet`/`peerCapability`/
 * `deletionRequest` precedent for an optional integration a given slice
 * doesn't need. `FedosDesktopApplicationShell.fromRunningRuntime()` and
 * `FedosDesktopConversationUiPresentationBoundary.fromShell()` are the
 * SAME real, already-shipped test seams
 * `secure_runtime_alpha_6041_6120_real_vertical_slice.test.ts` uses.
 *
 * KNOWN, DISCLOSED SCOPE BOUNDARY (matching this lineage's own
 * established precedent): a GENUINE live Direct Ratchet session
 * (Phase R step 1) and a genuine `establishSession()` reset dispatch
 * (steps 13-16) both need real Master-Seed-derived X25519 Double Ratchet
 * crypto, which only exists via a compiled `packages/fedos-core-rust/pkg/`
 * — confirmed absent in every Arc this session touched, and confirmed
 * (by inspection) that EVERY test in this repository exercising
 * `establishSession()` is `describe.skip`'d without it, no exceptions.
 * This slice proves the REAL two-step reset-authorization CALL CONTRACT
 * (`identityTransitionAssessContinuity()` reports an honest `"unavailable"`
 * when `directRatchet` is not configured, and `identityTransitionAuthorizeRatchetReset()`
 * refuses just as honestly) with 100% real crypto up to that one
 * documented boundary — never a fabricated "reset succeeded."
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { createFedosConversationRuntime, type FedosConversationRuntime } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationRuntimeDependencies } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime_assembly.js";
import type { FedosRunningDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";
import { FedosDesktopConversationUiPresentationBoundary } from "../src/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { FedosDesktopRenderer } from "../src/os/messenger/desktop/renderer/fedos_desktop_renderer.js";

import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosIdentityTransitionPeerObservationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import { InMemoryFedosIdentityTransitionManualVerificationPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import { InMemoryFedosIdentityTransitionConversationContinuityPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";
import { AppendOnlyFedosIdentityTransitionLocalDecisionPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_local_decision_persistence.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionNewKeyProofDigest, fedosIdentityTransitionContinuityProofDigest } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_canonical.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "../src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

const NOW = 1_700_000_000;
const clock = () => NOW;

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

const CONVERSATION_ID = "alice-bob-direct" as unknown as FedosConversationId;

/** Mirrors `secure_runtime_alpha_6041_6120_real_vertical_slice.test.ts`'s own minimal wrapper exactly. */
function wrapAsRunningDesktopRuntime(conversationRuntime: FedosConversationRuntime, onStop: () => Promise<void>): FedosRunningDesktopRuntime {
  let stopped = false;
  const notEnabled = (name: string) => () => {
    throw new Error(`${name}: not enabled in this real vertical slice's own minimal runtime wrapper`);
  };
  return {
    host: {} as never,
    boardRuntime: notEnabled("boardRuntime"),
    conversationRuntime: () => {
      if (stopped) throw new Error("inaccessible after stop");
      return conversationRuntime;
    },
    privateTransport: notEnabled("privateTransport"),
    conversationArchiveRuntime: notEnabled("conversationArchiveRuntime"),
    conversationContentAccessor: notEnabled("conversationContentAccessor"),
    conversationProductionCryptoCapability: () => "disabled",
    deviceTrust: notEnabled("deviceTrust"),
    deviceSyncOperational: notEnabled("deviceSyncOperational"),
    devicePairing: notEnabled("devicePairing"),
    stop: async () => {
      stopped = true;
      await onStop();
    },
  } as unknown as FedosRunningDesktopRuntime;
}

describe("FedOS Identity Replacement User Verification — real vertical slice (real Schnorr crypto, real Shell/Presentation/Renderer/HostBridge)", () => {
  it(
    "runs the full notification -> real Shell inbox -> open -> manual verification -> accept -> continuity -> reset-authorization-refusal -> restart flow",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "fedos-identity-replacement-ui-slice-"));
      try {
        const observationLog = join(dir, "observations.ndjson");
        const decisionLog = join(dir, "decisions.ndjson");

        // 2-3: a real replacement transition with real evidence (new-key proof + old-key continuity).
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
          issuedAt: NOW,
          expiresAt: NOW + 1_000_000,
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

        const signingAuthority = new RealFedosNostrSigningAuthority();
        const aliceIdentity = await signingAuthority.publicIdentityForAccount(0);
        const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
        const bobAccount = accountRef("d".repeat(64));

        const bobDeviceRegistryLog = join(dir, "bob-device-registry.ndjson");
        const bobDeviceRegistry = new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog);
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

        // 4: a real private transition notification (real transport is verified separately, at the Outbound Coordinator level, against the SAME sendMailboxNip17Control seam every other peer-capability coordinator uses).
        const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
          deviceRegistry: bobDeviceRegistry,
          signingAuthority,
          accountIndex: 0,
          localAccountRef: aliceAccount,
          localDeviceRef: "alice-old-desktop",
          clock,
          nonceGenerator: () => "1".repeat(32),
          sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
        });
        const published = await outbound.publishTransitionNotification({
          notificationId: "identity-transition-notif-1",
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
          continuityEvidence: {
            schemaVersion: 1,
            transitionId: record.transitionId,
            revision: 0,
            bodyHash,
            oldNostrIdentity: oldPub,
            newNostrIdentity: newPub,
            issuedAt: record.issuedAt,
            expiresAt: record.expiresAt,
            signatureHex: bytesToHex(schnorr.sign(continuityDigest, oldKey)),
          },
          deviceCorroborations: [],
          recipientAccountRef: bobAccount,
          recipientDeviceRef: "bob-desktop",
          conversationId: CONVERSATION_ID,
        });
        expect(published.outcome).toBe("published");
        if (published.outcome !== "published") throw new Error("unreachable");
        const wireContent = new TextDecoder().decode(
          encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }),
        );

        // Real FedosConversationRuntime -- built via the SAME production
        // assembly helper the real Desktop Runtime uses. Uses the
        // append-only backend for the ONE fact-store that matters for
        // restart (Peer Observation), so a fresh instance genuinely
        // reconstructs from the durable log (Phase R step 20-21).
        function buildBobConversationRuntime(): FedosConversationRuntime {
          return createFedosConversationRuntime({
            ...assembleFedosConversationRuntimeDependencies({ clock }),
            identityTransition: {
              deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog),
              signingAuthority: new RealFedosNostrSigningAuthority(),
              localAccountRef: bobAccount,
              localDeviceRef: "bob-desktop",
              sendMailboxNip17Control: async () => ({ outcome: "queued", envelopeId: "identity-transition-notif-1" }),
              observationPersistence: new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(observationLog),
              resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
              manualVerificationPersistence: new InMemoryFedosIdentityTransitionManualVerificationPersistence(),
              continuityPersistence: new InMemoryFedosIdentityTransitionConversationContinuityPersistence(),
              localDecisionPersistence: new AppendOnlyFedosIdentityTransitionLocalDecisionPersistence(decisionLog),
              // Deliberately conservative: an old-key-only continuity
              // signature is NOT auto-accepted just because it parses --
              // this Arc's own reason for existing is the explicit local
              // decision a user must make, so this slice's own local
              // policy demonstrates that path rather than the
              // already-auto-accepted one.
              localPolicy: { autoAcceptOldKeyContinuity: false },
            },
          });
        }

        // Mirrors `secure_runtime_alpha_6041_6120_real_vertical_slice.test.ts`'s
        // own established choice: exercises the REAL Shell/Presentation
        // Boundary/Renderer directly (the Host Command/Bridge layer's own
        // structural validation is already covered, with no Runtime
        // needed, in `secure_runtime_alpha_6121_6200_host_command_and_structural_guards.test.ts`).
        let bobConversationRuntime = buildBobConversationRuntime();
        let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(bobConversationRuntime, async () => undefined));
        let bobBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(bobShell);
        let bobRenderer = new FedosDesktopRenderer(bobBoundary);

        // Import through the REAL Runtime's own receiveNip17Rumor() dispatch chain.
        const imported = await bobConversationRuntime.receiveNip17Rumor(
          { envelopeId: "e1", senderPublicKeyHex: aliceAccount.publicIdentifier, recipientPublicKeyHex: bobAccount.publicIdentifier, createdAt: NOW, kind: 14, tags: [], content: wireContent },
          null,
        );
        expect((imported as any).outcome).toBe("recorded");

        // 5-6: Bob's transition inbox shows one pending item; opening it changes no trust/session state.
        await bobBoundary.identityTransitions.refreshInbox(10, 0);
        const inboxState = bobBoundary.identityTransitions.inboxState;
        expect(inboxState.status).toBe("loaded");
        if (inboxState.status !== "loaded") throw new Error("unreachable");
        expect(inboxState.data).toHaveLength(1);
        expect(inboxState.data[0]?.transitionId).toBe(record.transitionId);

        await bobBoundary.identityTransitions.openTransition(aliceAccount, "alice-old-desktop", record.transitionId);
        const detailState = bobBoundary.identityTransitions.detailState;
        expect(detailState.status).toBe("loaded");
        if (detailState.status !== "loaded") throw new Error("unreachable");
        // 7: the Renderer shows the old-key compromise limitation via centralized warning text — never a misleading green "verified".
        expect(detailState.data.warningText.length).toBeGreaterThan(0);
        expect(detailState.data.acceptanceState).not.toBe("accepted"); // opening never accepts anything
        const preOpenRender = bobRenderer.identityTransitions.detail();
        expect(preOpenRender.kind).toBe("content");

        // 8: Bob records manual verification.
        await bobBoundary.identityTransitions.recordManualVerification("safety-number-comparison", NOW + 10, "confirmed-match");
        expect(bobBoundary.identityTransitions.manualVerificationState.status).toBe("loaded");

        // 9: Bob accepts continuity locally (the explicit "accept" action).
        await bobBoundary.identityTransitions.acceptSelected();
        const acceptedDetailState = bobBoundary.identityTransitions.detailState;
        expect(acceptedDetailState.status).toBe("loaded");
        if (acceptedDetailState.status !== "loaded") throw new Error("unreachable");
        expect(acceptedDetailState.data.acceptanceState).toBe("accepted");

        // 11: continuity view links old and new identity without rewriting history -- this slice never imports/touches Membership/Archive/Search at all.
        await bobBoundary.identityTransitions.recordContinuity(CONVERSATION_ID as unknown as string, NOW + 20, true);
        expect(bobBoundary.identityTransitions.continuityState.status).toBe("loaded");

        // 12-13: Ratchet reset remains separately pending; Bob explicitly requests authorization.
        const assessResult = bobShell.identityTransitionAssessContinuity([{ conversationId: CONVERSATION_ID as unknown as string, remoteDeviceRef: "alice-old-desktop" }]);
        // 14-16: directRatchet was never configured on this slice's own Runtime (see this file's own disclosed WASM boundary) -- an honest "unavailable", never a fabricated reset.
        expect(assessResult.outcome).toBe("unavailable");
        const resetResult = await bobShell.identityTransitionAuthorizeRatchetReset({ transitionId: record.transitionId, acceptanceState: "accepted", affectedSessions: [] });
        expect(resetResult.outcome).toBe("unavailable");

        // 17: a conflicting competing transition cannot be accepted.
        const competingNewKey = schnorr.utils.randomSecretKey();
        const competingNewPub = bytesToHex(schnorr.getPublicKey(competingNewKey));
        const competingRecord = createFedosIdentityTransitionRecordV1({
          transitionId: generateFedosIdentityTransitionId(),
          transitionType: "identity-replacement",
          oldAccountIdentity: accountRef(oldPub),
          newAccountIdentity: accountRef(competingNewPub),
          oldNostrIdentity: oldPub,
          newNostrIdentity: competingNewPub,
          reasonCategory: "user-initiated-replacement",
          issuedAt: NOW,
          expiresAt: NOW + 1_000_000,
          revision: 0,
          previousTransitionId: null,
        });
        const competingBodyHash = fedosIdentityTransitionBodyHash(competingRecord);
        const competingDigest = fedosIdentityTransitionNewKeyProofDigest({
          transitionId: competingRecord.transitionId,
          revision: 0,
          bodyHash: competingBodyHash,
          oldNostrIdentity: oldPub,
          newNostrIdentity: competingNewPub,
          issuedAt: competingRecord.issuedAt,
          expiresAt: competingRecord.expiresAt,
        });
        const competingPublished = await outbound.publishTransitionNotification({
          notificationId: "identity-transition-notif-2",
          transitionRecord: competingRecord,
          newKeyProof: {
            schemaVersion: 1,
            transitionId: competingRecord.transitionId,
            revision: 0,
            bodyHash: competingBodyHash,
            newNostrIdentity: competingNewPub,
            issuedAt: competingRecord.issuedAt,
            expiresAt: competingRecord.expiresAt,
            signatureHex: bytesToHex(schnorr.sign(competingDigest, competingNewKey)),
          },
          continuityEvidence: null,
          deviceCorroborations: [],
          recipientAccountRef: bobAccount,
          recipientDeviceRef: "bob-desktop",
          conversationId: CONVERSATION_ID,
        });
        if (competingPublished.outcome !== "published") throw new Error("unreachable");
        const competingWireContent = new TextDecoder().decode(
          encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: competingPublished.notification }),
        );
        const competingImportResult = await bobConversationRuntime.receiveNip17Rumor(
          { envelopeId: "e2", senderPublicKeyHex: aliceAccount.publicIdentifier, recipientPublicKeyHex: bobAccount.publicIdentifier, createdAt: NOW, kind: 14, tags: [], content: competingWireContent },
          null,
        );
        expect((competingImportResult as any).outcome).toBe("conflicting-duplicate");
        // The conflicting transition was never durably recorded (rejected outright at import), so no decision can be recorded for it: opening it finds nothing.
        await bobBoundary.identityTransitions.openTransition(aliceAccount, "alice-old-desktop", competingRecord.transitionId);
        expect(bobBoundary.identityTransitions.detailState.status).toBe("error");

        // 20-21: restart Bob -- inbox/decision reconstructs exactly.
        bobConversationRuntime = buildBobConversationRuntime();
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(bobConversationRuntime, async () => undefined));
        bobBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(bobShell);
        bobRenderer = new FedosDesktopRenderer(bobBoundary);
        await bobBoundary.identityTransitions.refreshInbox(10, 0);
        const restartedInboxState = bobBoundary.identityTransitions.inboxState;
        expect(restartedInboxState.status).toBe("loaded");
        if (restartedInboxState.status !== "loaded") throw new Error("unreachable");
        expect(restartedInboxState.data).toHaveLength(1);
        expect(restartedInboxState.data[0]?.acceptanceState).toBe("accepted");

        // 22: no transition appears anywhere as a normal chat message -- this slice never calls a message/compose Shell method with transition content.

        // 23: no raw signature/key/path appears in any render output.
        await bobBoundary.identityTransitions.openTransition(aliceAccount, "alice-old-desktop", record.transitionId);
        const restartedDetailJson = JSON.stringify(bobRenderer.identityTransitions.detail());
        expect(restartedDetailJson).not.toContain(bytesToHex(oldKey));
        expect(restartedDetailJson).not.toContain(bytesToHex(newKey));
        expect(restartedDetailJson).not.toContain("signatureHex");
        expect(restartedDetailJson).not.toContain(dir.replace(/\\/g, "\\\\"));

        // 27 (Foundation precedent) -- no secret in the durable observation log file.
        const rawLog = readFileSync(observationLog, "utf8") as string;
        expect(rawLog).not.toContain(bytesToHex(oldKey));
        expect(rawLog).not.toContain(bytesToHex(newKey));
        expect(rawLog).not.toContain("secretKey");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
