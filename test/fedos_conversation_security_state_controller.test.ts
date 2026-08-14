/**
 * Verified Secure Session UI mega-arc (Coordinator) — proves
 * `FedosConversationSecurityStateController` genuinely wires the pure
 * `deriveConversationSecurityState()` evaluator to a REAL
 * `FedosDesktopApplicationShell` (not a mock), mirroring the established
 * lightweight-fixture pattern from
 * `secure_runtime_alpha_6521_6600_failure_matrix.test.ts` (real
 * `RealFedosNostrSigningAuthority`, real `NullRelay`, no WASM/pkg
 * dependency).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";
import { FedosConversationSecurityStateController } from "../src/os/messenger/desktop/presentation/security_state/fedos_conversation_security_state_controller.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { AppendOnlyFedosIdentityTransitionConversationContinuityPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_conversation_continuity_persistence.js";
import type { FedosIdentityTransitionConversationContinuityRecordV1 } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";

async function makeShell(dir: string, continuityLogPath: string): Promise<{ readonly shell: FedosDesktopApplicationShell; readonly conversationId: string; readonly localPublicIdentifier: string }> {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const identity = await signingAuthority.publicIdentityForAccount(0);
  const config: FedosDesktopRuntimeConfig = {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false,
    conversationLogPath: join(dir, "conversation.ndjson"),
    conversationEnvelopeLogPath: join(dir, "conversation-envelope.ndjson"),
    conversationPayloadLogPath: join(dir, "conversation-payload.ndjson"),
    conversationMembershipLogPath: join(dir, "conversation-membership.ndjson"),
    deviceTrustEnabled: true,
    localDeviceId: "device-1",
    localAccountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null },
    deviceRegistryLogPath: join(dir, "device-registry.ndjson"),
    deviceBindingChallengeReplayLogPath: join(dir, "device-binding-replay.ndjson"),
    deviceBindingAccountSigningAuthority: signingAuthority,
    deviceSyncJournalLogPath: join(dir, "sync-journal.ndjson"),
    privateTransportEnabled: true,
    conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
    conversationTransportSigningAuthority: signingAuthority,
    conversationTransportObservationLogPath: join(dir, "transport-obs.ndjson"),
    identityTransitionEnabled: true,
    identityTransitionConversationContinuityLogPath: continuityLogPath,
    peerCapabilityEnabled: true,
    peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
  };
  const runtime = await startFedosDesktopRuntime(config);
  const shell = FedosDesktopApplicationShell.fromRunningRuntime(runtime);
  return { shell, conversationId: "conv-never-created", localPublicIdentifier: identity!.publicKeyHex };
}

describe("FedosConversationSecurityStateController -- real Shell wiring (not a mock)", () => {
  it("a genuinely never-seen conversation reports an honest, fully-unknown security state -- never a fabricated GOOD", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-security-state-controller-"));
    try {
      const continuityLogPath = join(dir, "identity-transition-conversation-continuity.ndjson");
      const { shell, conversationId } = await makeShell(dir, continuityLogPath);
      const controller = new FedosConversationSecurityStateController(shell);

      const state = controller.getSecurityState(conversationId, null, 1_700_000_000_000);

      expect(state.conversationId).toBe(conversationId);
      expect(state.identityContinuity.state).toBe("unknown");
      expect(state.deviceKnowledge.state).toBe("unknown");
      expect(state.encryption.state).toBe("unavailable");
      expect(state.forwardSecrecy.state).toBe("unavailable");
      // No axis ever silently reports "good" for a conversation this process has no real facts about.
      for (const axis of [state.identityContinuity, state.encryption, state.forwardSecrecy, state.deviceKnowledge]) {
        expect(axis.state).not.toBe("good");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an identity-continuity record durably present on disk is genuinely read through the real Shell -> Controller -> evaluator chain (proves the wiring, not just the pure evaluator already covered in fedos_conversation_security_state.test.ts)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-security-state-controller-continuity-"));
    try {
      const continuityLogPath = join(dir, "identity-transition-conversation-continuity.ndjson");
      const record: FedosIdentityTransitionConversationContinuityRecordV1 = {
        schemaVersion: 1,
        localDeviceRef: "device-1",
        conversationId: "conv-with-history",
        oldAccountIdentity: { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null },
        newAccountIdentity: { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null },
        transitionId: `fedos-identity-transition-${"3".repeat(32)}`,
        revision: 0,
        evidenceLevel: "accepted",
        verificationMethod: null,
        acceptedAt: 1_700_000_000,
        newSessionRequired: false,
      };
      new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(continuityLogPath).putRecord(record);

      const { shell } = await makeShell(dir, continuityLogPath);
      const controller = new FedosConversationSecurityStateController(shell);

      const state = controller.getSecurityState("conv-with-history", null, 1_700_000_000_000);

      expect(state.identityContinuity.state, "an explicitly-accepted, non-silent continuity record must read GOOD through the real chain").toBe("good");
      expect(state.identityContinuity.reasonCode).toBe("identity-change-reviewed-and-accepted");
      expect(state.identityContinuity.source).toBe("cached");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REGRESSION (found live via a real two-process installed E2E): a genuinely brand-new conversation, seconds old, with ZERO exchanged messages, must read IDENTITY_CONTINUITY: unknown -- never GOOD merely because both parties are already members (membership is not history; an earlier version of the adapter used participantCount > 0 and produced exactly this false-green)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-security-state-controller-fresh-conv-"));
    try {
      const continuityLogPath = join(dir, "identity-transition-conversation-continuity.ndjson");
      const { shell } = await makeShell(dir, continuityLogPath);
      const controller = new FedosConversationSecurityStateController(shell);

      const created = shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "c".repeat(64) } });
      expect(created.outcome, JSON.stringify(created)).toBe("ok");
      const conversationId = (created as { readonly outcome: "ok"; readonly value: { readonly conversationId: string } }).value.conversationId;

      const state = controller.getSecurityState(conversationId, { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null }, 1_700_000_000_000);

      expect(state.identityContinuity.state, "REQUIRED: a conversation with zero exchanged messages must never read GOOD -- membership alone proves nothing about identity continuity").toBe("unknown");
      expect(state.identityContinuity.reasonCode).toBe("no-history-for-this-contact");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
