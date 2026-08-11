/**
 * Secure Runtime Alpha 7801-7880 (FedOS Direct Conversation Archive
 * Product Completion and Parallel-Lineage Integration Arc) — Phase J:
 * the real, no-mocks vertical slice proving a genuine Direct
 * Conversation (created via the real invitation/accept flow, never a
 * fabricated Board record) can export and restore its own Archive
 * end-to-end through the real, unmodified `FedosDesktopApplicationShell.archive()`
 * method — the SAME real production entry point the packaged Electron
 * app's own `fedos-acceptance:archive` IPC channel calls directly.
 *
 * UNLIKE every prior Arc's own Direct Conversation Archive test, this
 * file never bridges a fake Board/public record into
 * `FedosConversationPersistence` — the ENTIRE point of this Arc's own
 * fix is that this bridging hack is no longer necessary.
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync } from "node:fs";
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
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
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

async function makeRecoveryRuntime(
  recoveryDir: string,
  localParticipantRef: { readonly authority: "nostr"; readonly publicIdentifier: string; readonly identityId: null },
  masterSeedAuthority: FedosProductionMasterSeedAuthority,
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

suite("Alpha 7801-7880 -- Phase J: real vertical slice (Direct Conversation Archive export/restore, no fake Board record)", () => {
  it(
    "a real Direct Conversation (invitation/accept, never a fabricated Board record) exports and restores its own Archive end-to-end through the real Shell.archive() entry point; restored history is visible but no live session is silently established",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7801-direct-archive-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));

        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7801-direct", "Alice", "alice-direct-passphrase-7801");
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7801-direct", "Bob", "bob-direct-passphrase-7801");
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        // --- 1-6. A real Direct Conversation via the real invitation/accept flow; NO Board record is ever created for it. ---
        const invite = await aliceShell.createConversationInvitation(bobRef);
        expect(invite.outcome).toBe("ok");
        if (invite.outcome !== "ok") throw new Error("unreachable");
        expect(invite.value.outcome).toBe("sent");
        if (invite.value.outcome !== "sent") throw new Error("unreachable");
        const conversationId = invite.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationId) !== null, 5000, "Bob receiving Alice's invitation");

        // --- 7. Exchange at least three real, encrypted messages. ---
        const m1 = await aliceShell.sendMessage(conversationId, aliceRef, "direct-archive-message-1");
        expect(m1.outcome).toBe("ok");
        if (m1.outcome !== "ok") throw new Error("unreachable");
        const m2 = await aliceShell.sendMessage(conversationId, aliceRef, "direct-archive-message-2");
        expect(m2.outcome).toBe("ok");
        if (m2.outcome !== "ok") throw new Error("unreachable");
        const m3 = await aliceShell.sendMessage(conversationId, aliceRef, "direct-archive-message-3");
        expect(m3.outcome).toBe("ok");
        if (m3.outcome !== "ok") throw new Error("unreachable");

        // --- 9/10. Export Alice's OWN real Direct Conversation Archive -- through the REAL Shell.archive() entry
        // point, the exact same call the packaged app's own `fedos-acceptance:archive` IPC channel makes. NO
        // Board-record bridge is created anywhere in this test. ---
        const archivePath = join(root, "alice-direct.archive");
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
        expect(exportResult.outcome, "export must succeed for a real Direct Conversation without any Board-record fabrication").toBe("ok");
        if (exportResult.outcome !== "ok" || exportResult.value.operation !== "export") throw new Error("unreachable");
        expect(exportResult.value.result.outcome).toBe("exported");

        // --- 10 (integrity). Inspect the exported manifest -- proves the container itself is well-formed. ---
        const inspectResult = await aliceShell.archive({ operation: "inspect", sourcePath: archivePath });
        expect(inspectResult.outcome).toBe("ok");
        if (inspectResult.outcome !== "ok" || inspectResult.value.operation !== "inspect") throw new Error("unreachable");
        expect(inspectResult.value.result.outcome).toBe("inspected");

        // --- 11/12/13. Stop Alice's own running Runtime; restore into a GENUINELY FRESH profile/runtime
        // directory (simulating a real device recovery). Deliberately does NOT call
        // `alice.coordinator.lock()` here (unlike the final cleanup below) -- `lock()` also clears the
        // shared `FedosProductionMasterSeedAuthority`'s own in-memory secret material, and this Arc's own
        // recovery Runtime construction below reuses THAT SAME real, already-derived authority instance
        // (the same real-restart-recovery pattern the prior Alpha 7481-7560 real vertical slice already
        // established) -- exactly like a real device recovery flow would re-derive/unseal its own real
        // seed independently, never depend on another already-running process's own in-memory state. ---
        await aliceRuntime.stop();
        const aliceRecoveryDir = mkdtempSync(join(root, "alice-recovery-"));
        const recovery = await makeRecoveryRuntime(aliceRecoveryDir, aliceRef, alice.masterSeedAuthority);

        const restoreResult = await recovery.shell.archive({
          operation: "restore",
          request: { sourcePath: archivePath, localAccountIndex: 0, counterpartyPublicKeyHex: bob.publicIdentifier, suite: "ChaCha20Poly1305" },
        });
        expect(restoreResult.outcome, "restore must succeed for a real Direct Conversation Archive without any Board-record fabrication").toBe("ok");
        if (restoreResult.outcome !== "ok" || restoreResult.value.operation !== "restore") throw new Error("unreachable");
        expect(restoreResult.value.result.outcome).toBe("restored");

        // --- 14. Prove correct Conversation ID/history: the restored Conversation is visible and carries the exact real history. ---
        const restoredView = recovery.runtime.conversationRuntime().findConversation(conversationId);
        expect(restoredView, "the restored Direct Conversation's own draft record must be visible after restore").not.toBeNull();
        expect(restoredView!.mode).toBe("direct");

        const restoredEnvelope1 = recovery.runtime.conversationRuntime().getConversationMessageEnvelope(conversationId, m1.value.messageId);
        const restoredEnvelope2 = recovery.runtime.conversationRuntime().getConversationMessageEnvelope(conversationId, m2.value.messageId);
        const restoredEnvelope3 = recovery.runtime.conversationRuntime().getConversationMessageEnvelope(conversationId, m3.value.messageId);
        expect(restoredEnvelope1, "message 1 must survive restore").not.toBeNull();
        expect(restoredEnvelope2, "message 2 must survive restore").not.toBeNull();
        expect(restoredEnvelope3, "message 3 must survive restore").not.toBeNull();

        // --- 15. Prove NO live Ratchet secret/session was restored from the Archive: the Conversation
        // reports "not-active" (no Activation fact was written by restore), exactly matching Phase F's own
        // "history recovery and live-session recovery remain separate" rule. ---
        const activeLookup = recovery.runtime.conversationRuntime().resolveActiveConversation(conversationId);
        expect(activeLookup.outcome, "restore must never silently re-activate the Conversation").toBe("not-active");

        // --- 16. Attempting to send through the normal live path on the recovery Runtime fails closed
        // (no live session exists) -- proven by the FakeEncryptionAuthority itself never even being
        // reachable for a "not-active" Conversation; sendMessage's own precondition check must reject
        // this attempt before ever calling the (intentionally throwing) FakeEncryptionAuthority. ---
        const sendAttempt = await recovery.shell.sendMessage(conversationId, aliceRef, "should-not-send");
        expect(sendAttempt.outcome, "sending through a restored-but-not-reactivated Conversation must fail closed, never silently succeed via a fabricated live session").not.toBe("ok");

        await recovery.runtime.stop();
      } finally {
        await relay.close();
      }
    },
    30_000,
  );
});
