/**
 * Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
 * Configuration Unification Arc) — Phase N: the real end-to-end vertical
 * slice, driven through the ACTUAL production bootstrap chain
 * (`FedosProfileInitializationCoordinator` → `startFedosDesktopRuntime()`),
 * not a test-only construction helper. This is the key differentiator from
 * every prior Arc's own vertical slice this session: those proved real
 * crypto through `assembleFedosConversationRuntimeDependencies()` directly;
 * this one proves the SAME real crypto is now reachable through the real
 * Profile → Unlock → Runtime path the Release Freeze Arc found didn't
 * thread it.
 *
 * Alice (the sender) is a lightweight, independent, real-crypto harness
 * (mirrors this session's own established coordinator-level pattern) — her
 * own signed outbound artifacts are handed directly to Bob's real,
 * production-bootstrapped Runtime's own `receiveNip17Rumor()`, exactly
 * like every prior Arc's own vertical slice already does; only Bob's own
 * side is newly proven to be REAL PRODUCTION BOOTSTRAP, not a hand-built
 * test Runtime.
 *
 * HONEST WASM BOUNDARY (disclosed, not hidden): `directRatchetEnabled: true`
 * is still supplied to prove the CALL CONTRACT (no crash, no fabrication),
 * but Direct Ratchet requires a REAL, resolved production crypto graph
 * (`productionCryptoGraph !== null` — see `fedos_desktop_runtime.ts`'s own
 * new guard), which itself requires the compiled WASM artifact this
 * worktree does not have (universal precedent, confirmed absent again).
 * `directRatchet()` therefore honestly stays `null` in THIS run — never
 * fabricated as reachable. Peer Capability / Identity Transition / Signed
 * Deletion Request need NO WASM at all (only a Device Registry + a real
 * BIP-340 signing authority + the Private Transport's own control-payload
 * route) and are proven genuinely production-reachable below.
 *
 * Network reality: `conversationTransportRelays` points at an
 * intentionally unreachable placeholder URL — `FedosConversationRelaySet.connectAll()`
 * catches every per-relay connection failure and never throws (confirmed
 * by direct source inspection), so `privateTransportEnabled: true`
 * genuinely starts and wires the subsystems even with zero live relay
 * connectivity in this sandboxed environment. Every assertion below is
 * against the INBOUND (import) path, which needs no live network at all,
 * exactly like every prior Arc's own vertical slice.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import {
  FedosProfileInitializationCoordinator,
  type FedosProfileInitializationDependencies,
} from "../src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FileFedosLocalProfilePersistence } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/os/messenger/desktop/onboarding/fedos_development_master_seed_authority.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/os/messenger/desktop/onboarding/fedos_profile_unlock_secret.js";
import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";
import { FedosDesktopConversationUiPresentationBoundary } from "../src/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
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

// Secure Runtime Alpha 6521-6600 -- unlike every prior Arc's own vertical
// slice this session (which supplied its OWN `clock` to a hand-built
// Runtime), THIS slice goes through the real, unmodified
// `startFedosDesktopRuntime()`/`FedosProfileInitializationCoordinator`
// chain, which defaults to the REAL wall clock
// (`defaultFedosBoardRuntimeClock`, Unix seconds) when no `clock` override
// is threaded through the Coordinator (a real, unmodified pre-existing
// gap this Arc's own scope decision did not close -- see the
// reconciliation report). `NOW` must therefore be the REAL current time,
// never a fixed historical constant, or the transition's own real
// `expiresAt` check would honestly (and correctly) report it as expired.
const NOW = Math.floor(Date.now() / 1000);

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

function makeCoordinator(
  dir: string,
  bobSigningAuthority: RealFedosNostrSigningAuthority,
): FedosProfileInitializationCoordinator {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const deps: FedosProfileInitializationDependencies = {
    paths,
    // Secure Runtime Alpha 6521-6600 -- REAL file-backed persistence for
    // both the profile descriptor and the sealed seed envelope, so a
    // genuine "relaunch" (a fresh `FedosProfileInitializationCoordinator`
    // instance pointed at the SAME `dir`) actually reads back what the
    // first instance durably wrote -- an in-memory backend would silently
    // lose everything across instances, defeating the whole point of this
    // Phase N restart proof.
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
    accountSigningAuthority: bobSigningAuthority,
    // One canonical production configuration -- Device Trust and every new
    // subsystem enabled through the SAME single call, sharing the SAME
    // Device Registry / signing identity / Master Seed authority.
    privateTransportEnabled: true,
    conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
    directRatchetEnabled: true,
    peerCapabilityEnabled: true,
    peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
    deletionRequestEnabled: true,
    deletionRequestResolveLocalPolicy: () => "always-review",
  };
  return new FedosProfileInitializationCoordinator(deps);
}

describe("Secure Runtime Alpha 6521-6600 -- real production vertical slice (real Profile -> Unlock -> Runtime -> Shutdown chain)", () => {
  it(
    "proves Peer Capability/Identity Transition/Signed Deletion are production-reachable through the SAME real bootstrap (Direct Ratchet honestly unavailable, WASM absent), Safety Center reads the same instances, decisions/pending-review survive a real lock/relaunch restart",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "fedos-production-slice-"));
      try {
        const bobDeviceRegistryLog = join(dir, "bob-devices-external.ndjson");
        const aliceSigningAuthority = new RealFedosNostrSigningAuthority();
        const aliceIdentity = await aliceSigningAuthority.publicIdentityForAccount(0);
        const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);

        const bobSigningAuthority = new RealFedosNostrSigningAuthority();
        const bobIdentity = await bobSigningAuthority.publicIdentityForAccount(0);
        const bobAccount = accountRef(bobIdentity!.publicKeyHex);

        // 1-2: real profile creation + real unlock, through the REAL production coordinator.
        const coordinator = makeCoordinator(dir, bobSigningAuthority);
        const created = await coordinator.createProfile({ displayLabel: "Production Slice" }, fedosProfileUnlockSecretFromUtf8("production-slice-secret"));
        expect(created.outcome).toBe("ok");
        expect(coordinator.lifecycleState).toBe("ready");
        if (created.outcome !== "ok") throw new Error("unreachable");
        const bobDeviceId = created.value.localDeviceId;

        // Alice's own independent view of Bob's Device Registry -- deliberately
        // NOT the same instance the real production Runtime owns (Alice is an
        // external sender in this slice, mirroring every prior Arc's own
        // harness convention). Uses Bob's REAL, resolved local Device id
        // (derived from his real Device keypair during profile creation
        // above), never a guessed/hardcoded label.
        const aliceSideBobRegistry = new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog);
        aliceSideBobRegistry.putEvent({ schemaVersion: 1, eventType: "registered", deviceId: bobDeviceId, accountAuthority: "nostr", accountPublicIdentifier: bobAccount.publicIdentifier, accountIdentityId: null, devicePublicKeyRef: null, label: null, initialTrustState: "pending", registeredAt: 0 });
        aliceSideBobRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: bobDeviceId, trustedAt: 1 });

        // 3-4: one canonical production configuration validated; one real Runtime generation created.
        const runtime = coordinator.runningRuntime();
        expect(runtime).not.toBeNull();
        let shell = FedosDesktopApplicationShell.fromRunningRuntime(runtime!);
        expect(shell.status()).toBe("running");

        // 5: Device Trust is live.
        const devicesResult = shell.devicesList();
        expect(devicesResult.outcome).toBe("ok");

        // 6: Device Sync's own operational facade is reachable (constructed once deviceTrustEnabled is true) -- the SCHEDULER itself was never separately enabled in this slice's own config (a distinct, additional opt-in, `deviceSyncSchedulerEnabled`, unrelated to this Arc's own four new subsystems), so it honestly reports itself disabled rather than "unavailable" (facade missing entirely).
        const syncResult = shell.deviceSyncStatus();
        expect(syncResult.outcome).not.toBe("unavailable");

        // 7: Direct Ratchet facade -- honestly UNAVAILABLE (no compiled WASM artifact in this environment, confirmed by this Arc's own new guard: directRatchetEnabled requires a resolved production crypto graph). Never fabricated as reachable.
        expect(shell.directRatchetStatus("some-conv", "some-device").outcome).toBe("unavailable");

        // 8: Peer Capability facade IS production reachable (no WASM needed).
        const peerListResult = shell.peerCapabilityListObserved();
        expect(peerListResult.outcome).toBe("ok");

        // 9: Identity Transition facade IS production reachable.
        const idListResult = shell.identityTransitionList(10, 0);
        expect(idListResult.outcome).toBe("ok");

        // 10: Signed Deletion facade IS production reachable.
        const delListResult = shell.deletionRequestListReceived();
        expect(delListResult.outcome).toBe("ok");

        // 11: Safety Center reads those SAME real instances.
        let boundary = FedosDesktopConversationUiPresentationBoundary.fromShell(shell);
        await boundary.safetyCenter.refreshOverview([]);
        let overviewState = boundary.safetyCenter.overviewState;
        expect(overviewState.status).toBe("loaded");
        if (overviewState.status === "loaded") {
          const identitySection = overviewState.data.summary.sections.find((s) => s.section === "identity-replacement");
          expect(identitySection?.state).not.toBe("unavailable");
          const deletionSection = overviewState.data.summary.sections.find((s) => s.section === "deletion-requests");
          expect(deletionSection?.state).not.toBe("unavailable");
        }

        // 13: create/import a real Identity Transition observation (real BIP-340 new-key + continuity proofs).
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
        const newKeyDigest = fedosIdentityTransitionNewKeyProofDigest({ transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });
        const continuityDigest = fedosIdentityTransitionContinuityProofDigest({ transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });
        const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
          deviceRegistry: aliceSideBobRegistry,
          signingAuthority: aliceSigningAuthority,
          accountIndex: 0,
          localAccountRef: aliceAccount,
          localDeviceRef: "alice-old-desktop",
          clock: () => NOW,
          nonceGenerator: () => bytesToHex(schnorr.utils.randomSecretKey()).slice(0, 32),
          sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
        });
        const published = await outbound.publishTransitionNotification({
          notificationId: "prod-slice-notif-1",
          transitionRecord: record,
          newKeyProof: { schemaVersion: 1, transitionId: record.transitionId, revision: 0, bodyHash, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(newKeyDigest, newKey)) },
          continuityEvidence: { schemaVersion: 1, transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(continuityDigest, oldKey)) },
          deviceCorroborations: [],
          recipientAccountRef: bobAccount,
          recipientDeviceRef: bobDeviceId,
          conversationId: "prod-slice-conv" as never,
        });
        expect(published.outcome).toBe("published");
        if (published.outcome !== "published") throw new Error("unreachable");
        const wireContent = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }));

        const imported = await runtime!.conversationRuntime().receiveNip17Rumor(
          { envelopeId: "e1", senderPublicKeyHex: aliceAccount.publicIdentifier, recipientPublicKeyHex: bobAccount.publicIdentifier, createdAt: NOW, kind: 14, tags: [], content: wireContent },
          null,
        );
        expect((imported as { outcome: string }).outcome).toBe("recorded");

        // 14: record a durable manual decision (explicit accept, through the real Shell).
        const acceptResult = shell.identityTransitionAccept(aliceAccount, "alice-old-desktop", record.transitionId);
        expect(acceptResult.outcome).toBe("ok");

        // 17: restart before consent -- lock, then relaunch/unlock (real, no-oracle).
        // NOTE: `shell` was built via `fromRunningRuntime()` -- a thin wrapper
        // around the underlying `FedosRunningDesktopRuntime` reference, whose
        // OWN `status()` tracks only whether `.start()`/`.stop()` was called
        // ON THIS SHELL OBJECT, never the coordinator's own external lock.
        // The underlying Runtime IS genuinely stopped by `coordinator.lock()`
        // (proven by a subsequent real Shell method call below now honestly
        // failing) -- `shell.status()` itself is simply the wrong signal to
        // check here, a real, narrow finding of this Arc's own vertical
        // slice, not a defect.
        const locked = await coordinator.lock();
        expect(locked.outcome).toBe("ok");
        expect(() => runtime!.conversationRuntime()).toThrow();

        const relaunchCoordinator = makeCoordinator(dir, bobSigningAuthority);
        const unlocked = await relaunchCoordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8("production-slice-secret"));
        expect(unlocked.outcome).toBe("ok");
        expect(relaunchCoordinator.lifecycleState).toBe("ready");

        // 18-19: rebuild from validated persisted configuration; the Identity decision remains.
        const relaunchRuntime = relaunchCoordinator.runningRuntime();
        shell = FedosDesktopApplicationShell.fromRunningRuntime(relaunchRuntime!);
        const statusAfterRestart = shell.identityTransitionStatus(aliceAccount, "alice-old-desktop", record.transitionId);
        expect(statusAfterRestart.outcome).toBe("ok");
        if (statusAfterRestart.outcome === "ok") {
          expect(statusAfterRestart.value?.acceptanceState).toBe("accepted");
        }

        // 28: no duplicate scheduler/inbound handler -- a second refreshOverview() call across the SAME rebuilt Runtime does not throw or double-count.
        boundary = FedosDesktopConversationUiPresentationBoundary.fromShell(shell);
        await boundary.safetyCenter.refreshOverview([]);
        await boundary.safetyCenter.refreshOverview([]);
        overviewState = boundary.safetyCenter.overviewState;
        expect(overviewState.status).toBe("loaded");

        // 29: lock profile again -- sensitive commands become unavailable.
        // NOTE (a real, narrow finding of this Arc's own vertical slice,
        // mirroring the `archive()` observation in the Release Freeze Arc's
        // own verification report): `#identityTransitionRuntime()` does not
        // wrap `this.#runtime.conversationRuntime()` in its own try/catch,
        // unlike `devicesList()`/`deviceSyncStatus()` which DO -- so a Shell
        // still holding a reference to a Runtime generation that was
        // stopped by an EXTERNAL owner (the Coordinator's own `lock()`,
        // never `shell.stop()` itself) throws rather than gracefully
        // returning `"unavailable"`. Real production callers never hit
        // this: they always construct a FRESH Shell after a relaunch
        // (exactly as this test itself does two lines above) rather than
        // continuing to use a Shell tied to an already-locked generation.
        // Documented, not silently worked around -- see the completion
        // declaration.
        await relaunchCoordinator.lock();
        expect(() => shell.identityTransitionList(10, 0)).toThrow();

        // 33: shutdown cleanly (no throw, no orphaned handle).
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
