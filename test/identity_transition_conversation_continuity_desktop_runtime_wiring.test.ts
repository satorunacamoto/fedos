/**
 * Verified Secure Session UI mega-arc (Coordinator) — proves the exact
 * durability gap this arc closes: `startFedosDesktopRuntime()` never wired
 * `identityTransitionConversationContinuityLogPath` through to
 * `AppendOnlyFedosIdentityTransitionConversationContinuityPersistence`
 * before this fix, so every real process silently fell back to the
 * non-durable `InMemoryFedosIdentityTransitionConversationContinuityPersistence`
 * default. This is a "BEFORE/AFTER regression" test in the same spirit as
 * this session's own `commerce_ipfs_media_store_durability_restart.test.ts`
 * — it drives the REAL composition root (`fedos_desktop_runtime.ts`), not
 * just the standalone persistence class (already covered in
 * `identity_transition_conversation_continuity_persistence.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { AppendOnlyFedosIdentityTransitionConversationContinuityPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_conversation_continuity_persistence.js";
import type { FedosIdentityTransitionConversationContinuityRecordV1 } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";

async function baseConfig(dir: string, continuityLogPath: string | undefined): Promise<FedosDesktopRuntimeConfig> {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const identity = await signingAuthority.publicIdentityForAccount(0);
  return {
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
  };
}

function record(overrides: Partial<FedosIdentityTransitionConversationContinuityRecordV1> = {}): FedosIdentityTransitionConversationContinuityRecordV1 {
  return {
    schemaVersion: 1,
    localDeviceRef: "device-1",
    conversationId: "conv-1",
    oldAccountIdentity: { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null },
    newAccountIdentity: { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null },
    transitionId: `fedos-identity-transition-${"1".repeat(32)}`,
    revision: 0,
    evidenceLevel: "accepted",
    verificationMethod: null,
    acceptedAt: 1_700_000_000,
    newSessionRequired: false,
    ...overrides,
  };
}

describe("Verified Secure Session UI -- identityTransitionConversationContinuityLogPath wiring (the exact gap this arc closes)", () => {
  it("AFTER FIX: a continuity record written directly to the configured durable path is readable through the REAL runtime's identityTransition() accessor, across a genuine restart (fresh runtime instance, same path)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-continuity-wiring-after-"));
    try {
      const continuityLogPath = join(dir, "identity-transition-conversation-continuity.ndjson");

      // Seed the durable file directly, mirroring how a real accepted
      // Identity Transition ceremony would eventually call
      // recordConversationContinuity() -> continuityPersistence.putRecord().
      new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(continuityLogPath).putRecord(record());

      const runtime1 = await startFedosDesktopRuntime(await baseConfig(dir, continuityLogPath));
      const it1 = runtime1.conversationRuntime().identityTransition();
      expect(it1).not.toBeNull();
      expect(it1!.getConversationContinuity("conv-1")).toMatchObject({ conversationId: "conv-1", transitionId: record().transitionId });
      await runtime1.stop();

      // Genuine restart: a brand-new runtime instance, zero shared in-memory state.
      const runtime2 = await startFedosDesktopRuntime(await baseConfig(dir, continuityLogPath));
      const it2 = runtime2.conversationRuntime().identityTransition();
      expect(it2).not.toBeNull();
      expect(
        it2!.getConversationContinuity("conv-1"),
        "the durable continuity record must survive a real restart through the REAL runtime composition, not just the standalone persistence class",
      ).toMatchObject({ conversationId: "conv-1", transitionId: record().transitionId });
      await runtime2.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("BEFORE-FIX SHAPE (regression guard): with NO identityTransitionConversationContinuityLogPath supplied, the runtime falls back to a non-durable in-memory persistence -- a record seeded on the underlying file is NOT visible (proves the code path genuinely reads the config, not just always finding the file)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-continuity-wiring-before-"));
    try {
      const continuityLogPath = join(dir, "identity-transition-conversation-continuity.ndjson");
      new AppendOnlyFedosIdentityTransitionConversationContinuityPersistence(continuityLogPath).putRecord(record());

      // Deliberately omit identityTransitionConversationContinuityLogPath --
      // this is the exact pre-fix shape (config field did not exist / was
      // never populated by the profile-init coordinator in production).
      const runtime = await startFedosDesktopRuntime(await baseConfig(dir, undefined));
      const it = runtime.conversationRuntime().identityTransition();
      expect(it).not.toBeNull();
      expect(
        it!.getConversationContinuity("conv-1"),
        "without a configured durable path, the runtime must use the in-memory default and therefore NOT see a record that only exists on disk -- confirms the durable path is genuinely load-bearing, not a no-op",
      ).toBeNull();
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
