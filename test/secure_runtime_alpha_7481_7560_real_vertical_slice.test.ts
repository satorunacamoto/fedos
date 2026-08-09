/**
 * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention Parity
 * and Metadata Deletion Semantics Arc) — Phase I: the real, no-mocks
 * vertical slice, extending the exact real-crypto template
 * `test/secure_runtime_alpha_7241_7320_archive_search_retention_interaction.test.ts`
 * already established (real two-profile conversation, real relay, real
 * WASM-backed Archive export/restore, a genuinely fresh "new device"
 * Runtime) with the specific proofs THIS Arc's own mission requires:
 * pre-deletion vs post-deletion export semantics, restore-time
 * suppression on an ALREADY-informed device, and the honest,
 * disclosed limitation on a genuinely FOREIGN device that never learned
 * of the deletion.
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent. **`NODE_ENV` is never read or set anywhere in
 * this file.**
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { FedosProfileInitializationCoordinator, type FedosProfileInitializationDependencies } from "../src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FileFedosLocalProfilePersistence } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories, type FedosLocalProfilePaths } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/os/messenger/desktop/onboarding/fedos_profile_unlock_secret.js";
import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/os/messenger/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionNostrSigningAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_nostr_signing_authority.js";
import { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/os/messenger/desktop/node_websocket_relay_socket_factory.js";
import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { AppendOnlyFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/append_only_fedos_payload_retention_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import { AppendOnlyFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/append_only_fedos_conversation_persistence.js";
import { assessFedosLocalPayloadDeletion } from "../src/os/messenger/conversations/deletion/fedos_deletion_assessment.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function waitUntil(predicate: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!predicate()) throw new Error(`waitUntil timed out: ${label}`);
}

interface RealParty {
  readonly coordinator: FedosProfileInitializationCoordinator;
  readonly publicIdentifier: string;
  readonly paths: FedosLocalProfilePaths;
  readonly masterSeedAuthority: FedosProductionMasterSeedAuthority;
}

async function makeRealParty(dir: string, relayUrl: string, appId: string, label: string, passphrase: string): Promise<RealParty> {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  const masterSeedAuthority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  const accountSigningAuthority = new FedosProductionNostrSigningAuthority(masterSeedAuthority);
  const socketFactory = createNodeWebSocketRelaySocketFactory();
  const deps: FedosProfileInitializationDependencies = {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority,
    privateTransportEnabled: true,
    conversationTransportRelays: [new WebSocketRelay(relayUrl, socketFactory)],
    conversationInvitationEnabled: true,
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    conversationTransportIntervalMs: 100,
    archiveEnabled: true,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(created.outcome).toBe("ok");
  if (created.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, publicIdentifier: created.value.accountPublicIdentifier, paths, masterSeedAuthority };
}

class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(): Promise<FedosConversationEncryptionResult> {
    throw new Error("not used by this file -- a recovery Runtime never sends a message, only restores an Archive");
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(): Promise<FedosConversationDecryptionResult> {
    throw new Error("not used by this file -- a recovery Runtime never decrypts a live message, only restores an Archive");
  }
}
function incrementingClock(startAt: number): () => number {
  let current = startAt;
  return () => {
    current += 1;
    return current;
  };
}

function bridgePublicBoardRecord(conversationLogFile: string, conversationId: string): void {
  // Pre-existing, disclosed bridging requirement (Alpha 3081-3160's own
  // established test precedent, reused verbatim here) -- see the
  // sibling 7241-7320 test's own header for the full account. Not this
  // Arc's own gap to close.
  new AppendOnlyFedosConversationPersistence(conversationLogFile).putConversation({
    schemaVersion: 1,
    id: conversationId,
    mode: "public",
    boardId: "n/a-private-conversation",
    rootThreadId: "n/a-private-conversation",
    rootPostId: "n/a-private-conversation",
    policyReference: "public-v1",
    createdAt: 1_900_000_000,
  });
}

async function makeRecoveryRuntime(
  recoveryDir: string,
  localParticipantRef: { readonly authority: "nostr"; readonly publicIdentifier: string; readonly identityId: null },
  masterSeedAuthority: FedosProductionMasterSeedAuthority,
  retentionLogFile: string,
) {
  const config: FedosDesktopRuntimeConfig = {
    boardLogPath: join(recoveryDir, "board.log"),
    outboxLogPath: join(recoveryDir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(recoveryDir, "draft.log"),
    conversationMembershipLogPath: join(recoveryDir, "membership.log"),
    conversationCapabilityLogPath: join(recoveryDir, "capability.log"),
    conversationEnvelopeLogPath: join(recoveryDir, "envelope.log"),
    conversationPayloadLogPath: join(recoveryDir, "payload.log"),
    conversationPayloadRetentionLogPath: retentionLogFile,
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(localParticipantRef),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
    clock: incrementingClock(1_900_000_000),
    archiveEnabled: true,
    conversationArchiveMasterSeedAuthority: masterSeedAuthority,
  };
  const runtime = await startFedosDesktopRuntime(config);
  return { runtime, shell: FedosDesktopApplicationShell.fromRunningRuntime(runtime) };
}

suite("Alpha 7481-7560 -- Phase I: real vertical slice (export/restore parity, pre/post-deletion Archive semantics, foreign-restore honesty)", () => {
  it(
    "export before deletion retains everything; export after deletion excludes both content and metadata; restore on an already-informed device suppresses even a PRE-deletion Archive; restore on a genuinely foreign device does not",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7481-archive-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));

        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7481-archive", "Alice", "alice-archive-passphrase-7481");
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7481-archive", "Bob", "bob-archive-passphrase-7481");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        // --- 1/2/3. Real profile, real Direct Conversation, real messages ---
        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving Alice's invitation");

        const keep1 = await aliceShell.sendMessage(conversationId, aliceRef, "phase-i-keep-1");
        expect(keep1.outcome).toBe("ok");
        if (keep1.outcome !== "ok") throw new Error("unreachable");
        const toDelete = await aliceShell.sendMessage(conversationId, aliceRef, "phase-i-delete-me");
        expect(toDelete.outcome).toBe("ok");
        if (toDelete.outcome !== "ok") throw new Error("unreachable");
        const keep2 = await aliceShell.sendMessage(conversationId, aliceRef, "phase-i-keep-2");
        expect(keep2.outcome).toBe("ok");
        if (keep2.outcome !== "ok") throw new Error("unreachable");

        // --- 4. Index Search on Alice's own side. A dedicated, real
        // `FedosConversationSearchIndex` instance (the actual production
        // class, real retention-linked gating) is built and fed directly
        // via `indexEnvelope()`, real plaintext obtained via real
        // `readMessage()` -- this Arc's own object of study is Search's
        // real `reconcilePayloadRetention()` behavior itself, reachable
        // in production ONLY through the separate Signed-Deletion-
        // Request wire-signing subsystem (Arc 5881-5960's own domain,
        // already tested elsewhere) -- exercised here directly, on the
        // SAME real class, without that separate ceremony. ---
        const aliceSearchIndex = aliceRuntime.conversationRuntime().createSearchIndex();
        async function indexRealMessage(messageId: string): Promise<void> {
          const read = await aliceShell.readMessage(conversationId, messageId);
          expect(read.outcome).toBe("ok");
          if (read.outcome !== "ok") throw new Error("unreachable");
          const envelope = aliceRuntime.conversationRuntime().getConversationMessageEnvelope(conversationId, messageId)!;
          const text = read.value.plaintext.state === "available" ? read.value.plaintext.text : null;
          aliceSearchIndex.indexEnvelope({ envelope, text });
        }
        await indexRealMessage(keep1.value.messageId);
        await indexRealMessage(toDelete.value.messageId);
        await indexRealMessage(keep2.value.messageId);
        expect(aliceSearchIndex.searchKeyword("phase-i-delete-me").length).toBeGreaterThanOrEqual(1);

        bridgePublicBoardRecord(alice.paths.conversationLogFile, conversationId);

        // --- 5. Export Archive BEFORE deletion ---
        const preDeletionArchivePath = join(root, "alice-pre-deletion.archive");
        const preExport = await aliceShell.archive({
          operation: "export",
          request: {
            conversationId,
            destinationPath: preDeletionArchivePath,
            localParticipant: aliceRef,
            localAccountIndex: 0,
            counterpartyPublicKeyHex: bob.publicIdentifier,
            suite: "ChaCha20Poly1305",
          },
        });
        expect(preExport.outcome).toBe("ok");
        if (preExport.outcome !== "ok" || preExport.value.operation !== "export") throw new Error("unreachable");
        expect(preExport.value.result.outcome, "pre-deletion export must genuinely succeed, retaining everything").toBe("exported");

        // --- 6. Delete one message through the real Local Deletion/Retention path ---
        const deletedEnvelope = aliceRuntime.conversationRuntime().getConversationMessageEnvelope(conversationId, toDelete.value.messageId)!;
        const deletedPayloadId = toFedosConversationPayloadId(deletedEnvelope.payloadId)!;
        const aliceRetentionAuthority = new FedosPayloadRetentionAuthority({
          retentionPersistence: new AppendOnlyFedosPayloadRetentionPersistence(alice.paths.conversationPayloadRetentionLogFile),
          payloadStorage: new AppendOnlyFedosConversationPayloadStorage(alice.paths.conversationPayloadLogFile, 1_048_576),
          clock: () => Math.floor(Date.now() / 1000),
        });
        expect(aliceRetentionAuthority.tombstonePayload(deletedPayloadId, null, "user_requested_placeholder")).toEqual({ outcome: "tombstoned" });
        expect(aliceRetentionAuthority.removeLocalPayload(deletedPayloadId, null, "user_requested_placeholder")).toEqual({ outcome: "payload-removed" });

        // --- 7. Confirm live payload inaccessible ---
        expect(aliceRetentionAuthority.evaluatePayloadAccess(deletedPayloadId).outcome).toBe("denied");
        const readAfterDeletion = await aliceShell.readMessage(conversationId, toDelete.value.messageId);
        expect(readAfterDeletion.outcome === "failed" || (readAfterDeletion.outcome === "ok" && readAfterDeletion.value.plaintext.state !== "available")).toBe(true);

        // --- 8. Confirm Search purged (real reconciliation call, mirroring the existing Local Deletion execution coordinator's own discipline) ---
        aliceSearchIndex.reconcilePayloadRetention(deletedPayloadId);
        expect(aliceSearchIndex.searchKeyword("phase-i-delete-me"), "Search must no longer surface the deleted message").toHaveLength(0);
        expect(
          aliceSearchIndex.searchKeyword("phase-i-keep-1").length,
          "an unrelated kept message's own Search entry must be unaffected",
        ).toBeGreaterThanOrEqual(1);

        // --- 9. Export Archive AFTER deletion -- THIS Arc's own fix ---
        const postDeletionArchivePath = join(root, "alice-post-deletion.archive");
        const postExport = await aliceShell.archive({
          operation: "export",
          request: {
            conversationId,
            destinationPath: postDeletionArchivePath,
            localParticipant: aliceRef,
            localAccountIndex: 0,
            counterpartyPublicKeyHex: bob.publicIdentifier,
            suite: "ChaCha20Poly1305",
          },
        });
        expect(postExport.outcome).toBe("ok");
        if (postExport.outcome !== "ok" || postExport.value.operation !== "export") throw new Error("unreachable");
        expect(postExport.value.result.outcome, "post-deletion export must still genuinely succeed").toBe("exported");

        // --- 24 (checked early, cheaply): no secret/plaintext leak in either exported container ---
        for (const path of [preDeletionArchivePath, postDeletionArchivePath]) {
          const bytes = readFileSync(path);
          const text = bytes.toString("latin1");
          expect(text, `${path} must never contain the real plaintext in cleartext`).not.toContain("phase-i-delete-me");
          expect(text, `${path} must never contain the real plaintext in cleartext`).not.toContain("phase-i-keep-1");
        }

        // --- 12. Restart: a genuinely fresh "new device" Runtime for each restore scenario ---

        // --- 10/11/14/15. Restore the POST-deletion Archive into a device that ALREADY has Alice's own real, up-to-date retention log (the same-profile / already-informed case). ---
        const sameProfileRecoveryDir = mkdtempSync(join(root, "alice-recovery-same-profile-"));
        const sameProfileRecovery = await makeRecoveryRuntime(sameProfileRecoveryDir, aliceRef, alice.masterSeedAuthority, alice.paths.conversationPayloadRetentionLogFile);
        const sameProfileRestore = await sameProfileRecovery.shell.archive({
          operation: "restore",
          request: { sourcePath: postDeletionArchivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(sameProfileRestore.outcome).toBe("ok");
        if (sameProfileRestore.outcome !== "ok" || sameProfileRestore.value.operation !== "restore") throw new Error("unreachable");
        expect(sameProfileRestore.value.result.outcome).toBe("restored");
        const sameProfileConversationRuntime = sameProfileRecovery.runtime.conversationRuntime();
        expect(
          sameProfileConversationRuntime.getConversationMessageEnvelope(conversationId, toDelete.value.messageId),
          "FIXED: the deleted message's own Envelope must not restore from a POST-deletion export",
        ).toBeNull();
        expect(sameProfileConversationRuntime.getConversationMessageEnvelope(conversationId, keep1.value.messageId), "unrelated kept message 1 must restore intact").not.toBeNull();
        expect(sameProfileConversationRuntime.getConversationMessageEnvelope(conversationId, keep2.value.messageId), "unrelated kept message 2 must restore intact").not.toBeNull();

        // --- 16/17. Restore the PRE-deletion Archive (which DOES still contain the deleted message) into a device that already recorded the SAME deletion fact -- restore-time re-check must STILL suppress it. ---
        const alreadyInformedRecoveryDir = mkdtempSync(join(root, "alice-recovery-already-informed-"));
        const alreadyInformedRecovery = await makeRecoveryRuntime(alreadyInformedRecoveryDir, aliceRef, alice.masterSeedAuthority, alice.paths.conversationPayloadRetentionLogFile);
        const alreadyInformedRestore = await alreadyInformedRecovery.shell.archive({
          operation: "restore",
          request: { sourcePath: preDeletionArchivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(alreadyInformedRestore.outcome).toBe("ok");
        if (alreadyInformedRestore.outcome !== "ok" || alreadyInformedRestore.value.operation !== "restore") throw new Error("unreachable");
        expect(
          alreadyInformedRestore.value.result.outcome,
          "restoring a PRE-deletion Archive (which genuinely still contains the message) onto a device that already knows about the deletion must report partially-denied, never a clean full restore",
        ).toBe("partially-denied");
        expect(
          alreadyInformedRecovery.runtime.conversationRuntime().getConversationMessageEnvelope(conversationId, toDelete.value.messageId),
          "FIXED: restore-time re-evaluation suppresses the deleted message even from an OLDER Archive that itself still carries it",
        ).toBeNull();
        expect(
          alreadyInformedRecovery.runtime.conversationRuntime().getConversationMessageEnvelope(conversationId, keep1.value.messageId),
          "an unrelated kept message must still restore normally from the same PRE-deletion Archive",
        ).not.toBeNull();

        // --- 18/19. Restore the PRE-deletion Archive into a genuinely FOREIGN device that never learned of the deletion -- the honest, disclosed limitation. ---
        const foreignRecoveryDir = mkdtempSync(join(root, "alice-recovery-foreign-"));
        const foreignRetentionLogFile = join(foreignRecoveryDir, "never-informed-retention.log");
        const foreignRecovery = await makeRecoveryRuntime(foreignRecoveryDir, aliceRef, alice.masterSeedAuthority, foreignRetentionLogFile);
        const foreignRestore = await foreignRecovery.shell.archive({
          operation: "restore",
          request: { sourcePath: preDeletionArchivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(foreignRestore.outcome).toBe("ok");
        if (foreignRestore.outcome !== "ok" || foreignRestore.value.operation !== "restore") throw new Error("unreachable");
        expect(
          foreignRestore.value.result.outcome,
          "HONEST, DISCLOSED LIMITATION: a genuinely foreign device that never recorded the deletion fact has no basis to deny it, and restores the message from the PRE-deletion Archive -- documented, not fabricated as suppressed",
        ).toBe("restored");
        expect(
          foreignRecovery.runtime.conversationRuntime().getConversationMessageEnvelope(conversationId, toDelete.value.messageId),
          "the disclosed limitation, proven directly: the message DOES reappear on a device that never knew about the deletion",
        ).not.toBeNull();

        // --- 20. Safety Center presents the correct retained-copy warning ---
        const assessment = assessFedosLocalPayloadDeletion(deletedPayloadId, { retentionAuthority: aliceRetentionAuthority });
        expect(assessment.futureArchiveExportExcludesThis, "Safety Center's own underlying fact must correctly reflect this Arc's own fix").toBe(true);
        expect(assessment.archiveRetentionWarning, "the PRE-existing archive(s) already taken may still retain a copy -- also true, and separately tracked").toBe(true);

        // --- 22/23. Repeated restore is idempotent ---
        const repeatedRestore = await sameProfileRecovery.shell.archive({
          operation: "restore",
          request: { sourcePath: postDeletionArchivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(repeatedRestore.outcome).toBe("ok");
        if (repeatedRestore.outcome !== "ok" || repeatedRestore.value.operation !== "restore") throw new Error("unreachable");
        expect(["already-present", "restored"], "a second restore of the identical Archive must never duplicate or error").toContain(repeatedRestore.value.result.outcome);
        expect(
          sameProfileConversationRuntime.getConversationMessageEnvelope(conversationId, toDelete.value.messageId),
          "idempotent: the deleted message must STILL never reappear after a repeated restore",
        ).toBeNull();

        await sameProfileRecovery.runtime.stop();
        await alreadyInformedRecovery.runtime.stop();
        await foreignRecovery.runtime.stop();
        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    60000,
  );
});
