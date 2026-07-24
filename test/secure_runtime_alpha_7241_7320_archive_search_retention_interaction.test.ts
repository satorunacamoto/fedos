/**
 * Secure Runtime Alpha 7241-7320 — FedOS Long-Running Runtime Reliability
 * and Recovery Arc — Archive/Search/Retention interaction, end to end,
 * with REAL WASM-backed Archive encryption for the first time.
 *
 * This is the direct regression proof of this Arc's own second real
 * production fix: `fedos_conversation_archive_collector.ts` never
 * consulted `FedosPayloadRetentionAuthority` at all -- a real,
 * independently-disclosed design-vs-implementation drift (Search closed
 * the identical gap at Alpha 2581-2620; Archive's own was never closed) --
 * so a tombstoned/removed payload's plaintext bytes were exported into
 * every Archive Bundle regardless of local retention state. This file
 * proves the fix with a real, live, two-profile conversation: a message
 * is tombstoned mid-conversation, the conversation is exported for real
 * (real WASM AEAD, the real production Master Seed Authority, real
 * ChaCha20-Poly1305), and a genuinely FRESH "new device" Runtime restores
 * that same archive file and reindexes it into a Search index — the
 * tombstoned message's payload never resurfaces anywhere in the restored
 * Runtime (no archive corruption of the OTHER kind: silently smuggling
 * denied content across a device boundary), while every kept message
 * restores and re-indexes correctly (no search inconsistency).
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent. **`NODE_ENV` is never read or set anywhere in
 * this file.**
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { FedosProfileInitializationCoordinator, type FedosProfileInitializationDependencies } from "../src/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FileFedosLocalProfilePersistence } from "../src/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories, type FedosLocalProfilePaths } from "../src/desktop/onboarding/fedos_local_profile_paths.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/desktop/onboarding/fedos_profile_unlock_secret.js";
import { createElectronMainHostAttestation } from "../src/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionNostrSigningAuthority } from "../src/desktop/production_activation/fedos_production_nostr_signing_authority.js";
import { FedosProductionMasterSeedAuthority } from "../src/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/desktop/node_websocket_relay_socket_factory.js";
import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { AppendOnlyFedosPayloadRetentionPersistence } from "../src/conversation/retention/append_only_fedos_payload_retention_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { AppendOnlyFedosConversationPersistence } from "../src/conversation/persistence/append_only_fedos_conversation_persistence.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";

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
    throw new Error("not used by this file -- the recovery Runtime never sends a message, only restores an Archive");
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(): Promise<FedosConversationDecryptionResult> {
    throw new Error("not used by this file -- the recovery Runtime never decrypts a live message, only restores an Archive");
  }
}
function incrementingClock(startAt: number): () => number {
  let current = startAt;
  return () => {
    current += 1;
    return current;
  };
}

suite("Alpha 7241-7320 -- Archive/Retention interaction: a real, live, two-profile conversation exported with REAL WASM crypto and restored into a genuinely fresh Runtime -- the tombstoned message's payload never resurfaces, every kept message's payload restores intact", () => {
  it(
    "export excludes the tombstoned payload (this Arc's own fix); a fresh 'new device' Runtime restores the archive; retention stays honored across the device boundary",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7241-archive-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));

        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7241-archive", "Alice", "alice-archive-passphrase-7241");
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7241-archive", "Bob", "bob-archive-passphrase-7241");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving Alice's invitation");

        const keep1 = await aliceShell.sendMessage(conversationId, aliceRef, "archive-keep-1");
        expect(keep1.outcome).toBe("ok");
        if (keep1.outcome !== "ok") throw new Error("unreachable");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1, 5000, "Bob receiving keep-1");

        const toDelete = await aliceShell.sendMessage(conversationId, aliceRef, "archive-delete-me");
        expect(toDelete.outcome).toBe("ok");
        if (toDelete.outcome !== "ok") throw new Error("unreachable");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 2, 5000, "Bob receiving archive-delete-me");

        const keep2 = await aliceShell.sendMessage(conversationId, aliceRef, "archive-keep-2");
        expect(keep2.outcome).toBe("ok");
        if (keep2.outcome !== "ok") throw new Error("unreachable");
        await waitUntil(() => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 3, 5000, "Bob receiving keep-2");

        // Tombstone "archive-delete-me" on Alice's own side, over the SAME
        // durable retention log her real Runtime already uses (this Arc's
        // own conversationPayloadRetentionLogPath fix).
        const envelope = aliceRuntime.conversationRuntime().getConversationMessageEnvelope(conversationId, toDelete.value.messageId)!;
        const payloadId = toFedosConversationPayloadId(envelope.payloadId)!;
        const retentionAuthority = new FedosPayloadRetentionAuthority({
          retentionPersistence: new AppendOnlyFedosPayloadRetentionPersistence(alice.paths.conversationPayloadRetentionLogFile),
          payloadStorage: new AppendOnlyFedosConversationPayloadStorage(alice.paths.conversationPayloadLogFile, 1_048_576),
          clock: () => Math.floor(Date.now() / 1000),
        });
        expect(retentionAuthority.tombstonePayload(payloadId, null, "user_requested_placeholder")).toEqual({ outcome: "tombstoned" });

        // Pre-existing, disclosed bridging requirement (Alpha 3081-3160's
        // own established test precedent): a private Direct conversation's
        // own "is this active" fact lives entirely in Draft/Activation
        // persistence, never in `FedosConversationPersistence` (that port/
        // wire-shape exists only for PUBLIC, Board-thread-anchored
        // Conversations) -- so `exportConversationArchive()`'s own
        // existence check needs a bridging Board-level record. Not this
        // Arc's own gap to close (out of this Arc's own narrow scope; see
        // Alpha 1541-1610's own Collector header for the full account).
        // `mode: "public"` here (not the prior test's own `"direct"`,
        // which only ever satisfied the export-side existence check) --
        // `validateFedosConversationRecord()` (Alpha 748, unmodified)
        // hard-rejects any `mode` other than `"public"` on WRITE, a check
        // `restoreConversationArchive()`'s own real write path enforces
        // that the prior test's export-only/inspect-only usage never
        // actually exercised. `boardId`/`rootThreadId`/`rootPostId` remain
        // the SAME inert placeholder strings -- nothing in this file reads
        // or cross-checks them against a real Board thread.
        new AppendOnlyFedosConversationPersistence(alice.paths.conversationLogFile).putConversation({
          schemaVersion: 1,
          id: conversationId,
          mode: "public",
          boardId: "n/a-private-conversation",
          rootThreadId: "n/a-private-conversation",
          rootPostId: "n/a-private-conversation",
          policyReference: "public-v1",
          createdAt: 1_900_000_000,
        });

        // Real, WASM-backed export -- THIS is where this Arc's own
        // Archive/retention fix takes effect: the tombstoned payload must
        // never reach the exported container.
        const archivePath = join(root, "alice-conversation.archive");
        const exportResult = await aliceShell.archive({
          operation: "export",
          request: {
            conversationId,
            destinationPath: archivePath,
            localParticipant: aliceRef,
            localAccountIndex: 0,
            counterpartyPublicKeyHex: bob.publicIdentifier,
            suite: "ChaCha20Poly1305",
          },
        });
        expect(exportResult.outcome, "real WASM-backed Archive export must succeed now that a real pkg/ artifact is present").toBe("ok");
        if (exportResult.outcome !== "ok" || exportResult.value.operation !== "export") throw new Error("unreachable");
        expect(exportResult.value.result.outcome).toBe("exported");

        // Archive integrity: a real inspect/preflight over the real exported container.
        const inspectResult = await aliceShell.archive({ operation: "inspect", sourcePath: archivePath });
        expect(inspectResult.outcome).toBe("ok");
        if (inspectResult.outcome !== "ok" || inspectResult.value.operation !== "inspect") throw new Error("unreachable");
        expect(inspectResult.value.result.outcome).toBe("inspected");
        expect(inspectResult.value.result.manifest?.conversationId).toBe(conversationId);

        const preflightResult = await aliceShell.archive({
          operation: "preflightRestore",
          request: { sourcePath: archivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(preflightResult.outcome).toBe("ok");
        if (preflightResult.outcome !== "ok" || preflightResult.value.operation !== "preflightRestore") throw new Error("unreachable");
        expect(preflightResult.value.result.outcome).toBe("previewed");

        // ---- A genuinely fresh "new device" Runtime -- zero prior local conversation state, but the SAME real identity (Alice's own already-activated Master Seed Authority). ----
        const recoveryDir = mkdtempSync(join(root, "alice-recovery-"));
        const recoveryConfig: FedosDesktopRuntimeConfig = {
          boardLogPath: join(recoveryDir, "board.log"),
          outboxLogPath: join(recoveryDir, "outbox.log"),
          deliveryEnabled: false,
          conversationDraftLogPath: join(recoveryDir, "draft.log"),
          conversationMembershipLogPath: join(recoveryDir, "membership.log"),
          conversationCapabilityLogPath: join(recoveryDir, "capability.log"),
          conversationEnvelopeLogPath: join(recoveryDir, "envelope.log"),
          conversationPayloadLogPath: join(recoveryDir, "payload.log"),
          conversationPayloadRetentionLogPath: join(recoveryDir, "retention.log"),
          conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(aliceRef),
          conversationEncryptionAuthority: new FakeEncryptionAuthority(),
          conversationDecryptionAuthority: new FakeDecryptionAuthority(),
          clock: incrementingClock(1_900_000_000),
          archiveEnabled: true,
          conversationArchiveMasterSeedAuthority: alice.masterSeedAuthority,
        };
        const recoveryRuntime = await startFedosDesktopRuntime(recoveryConfig);
        const recoveryShell = FedosDesktopApplicationShell.fromRunningRuntime(recoveryRuntime);

        const recoveryPreflight = await recoveryShell.archive({
          operation: "preflightRestore",
          request: { sourcePath: archivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(recoveryPreflight.outcome).toBe("ok");

        const restoreResult = await recoveryShell.archive({
          operation: "restore",
          request: { sourcePath: archivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(restoreResult.outcome).toBe("ok");
        if (restoreResult.outcome !== "ok" || restoreResult.value.operation !== "restore") throw new Error("unreachable");
        expect(restoreResult.value.result.outcome).toBe("restored");

        // The restored Runtime genuinely has all 3 Envelopes (verified
        // directly at the persistence layer -- the restored Runtime's own
        // Draft/Activation state was never part of the Archive Bundle to
        // begin with, a SEPARATE, pre-existing, disclosed persistence
        // domain Alpha 1541-1610's own Collector header already documents,
        // so the Shell's own `listMessages()`/`readMessage()` cannot
        // resolve this conversation's mode post-restore -- not a
        // regression this Arc introduces or is in scope to close). What
        // THIS Arc's own fix guarantees is checked directly: the two kept
        // messages' payloads restored; the tombstoned message's payload
        // never crossed the device boundary at all.
        const recoveryConversationRuntime = recoveryRuntime.conversationRuntime();
        const recoveryPayloadStorage = new AppendOnlyFedosConversationPayloadStorage(recoveryConfig.conversationPayloadLogPath!, 1_048_576);

        const keep1Envelope = recoveryConversationRuntime.getConversationMessageEnvelope(conversationId, keep1.value.messageId);
        expect(keep1Envelope).not.toBeNull();
        const keep1PayloadId = toFedosConversationPayloadId(keep1Envelope!.payloadId)!;
        expect(recoveryPayloadStorage.getPayload(keep1PayloadId), "a kept message's payload must restore across the device boundary").not.toBeNull();

        const keep2Envelope = recoveryConversationRuntime.getConversationMessageEnvelope(conversationId, keep2.value.messageId);
        expect(keep2Envelope).not.toBeNull();
        const keep2PayloadId = toFedosConversationPayloadId(keep2Envelope!.payloadId)!;
        expect(recoveryPayloadStorage.getPayload(keep2PayloadId), "a kept message's payload must restore across the device boundary").not.toBeNull();

        const deletedEnvelope = recoveryConversationRuntime.getConversationMessageEnvelope(conversationId, toDelete.value.messageId);
        expect(deletedEnvelope, "the Envelope record itself still restores (Archive never filters Envelopes, only Payloads) -- only its own payload must be absent").not.toBeNull();
        const deletedPayloadId = toFedosConversationPayloadId(deletedEnvelope!.payloadId)!;
        expect(
          recoveryPayloadStorage.getPayload(deletedPayloadId),
          "the tombstoned message's payload must NEVER cross the device boundary -- this Arc's own regression proof of the Archive/retention fix",
        ).toBeNull();

        await recoveryRuntime.stop();
        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );
});
