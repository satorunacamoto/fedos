/**
 * Secure Runtime Alpha 4181-4260 — Phase B/C: Multi-Window State Model,
 * Window Lifecycle, Pin State, Recent List, Navigation State Persistence
 * — real acceptance tests. Same fixture pattern as
 * `secure_runtime_alpha_4181_4260_window_controller.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendFileSync } from "node:fs";

import { createFedosDesktopConversationUiPresentationBoundary } from "../src/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import { toFedosConversationInvitationToken } from "../src/os/messenger/conversations/invitation/fedos_conversation_invitation_token.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { FedosDesktopConversationWindowRegistry } from "../src/os/messenger/desktop/navigation/fedos_desktop_conversation_window_registry.js";
import { AppendOnlyFedosDesktopNavigationPersistence } from "../src/os/messenger/desktop/navigation/append_only_fedos_desktop_navigation_persistence.js";

function fakeMarker(request: { localAccountIndex: number; counterpartyPublicKeyHex: string }): Uint8Array {
  return new TextEncoder().encode(`FAKE:${request.localAccountIndex}:${request.counterpartyPublicKeyHex}:`);
}
class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    const marker = fakeMarker(request);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    const marker = fakeMarker(request);
    if (request.ciphertext.length < marker.length) return { outcome: "failed" };
    for (let i = 0; i < marker.length; i += 1) {
      if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    }
    return { outcome: "decrypted", plaintext: request.ciphertext.subarray(marker.length) };
  }
}

const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };

function incrementingClock(startAt: number): () => number {
  let current = startAt;
  return () => {
    current += 1;
    return current;
  };
}

function freshConfig(dir: string): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    conversationConstructionCoordinationLogPath: join(dir, "construction-coordination.log"),
    conversationEnvelopeLogPath: join(dir, "envelope.log"),
    conversationPayloadLogPath: join(dir, "payload.log"),
    conversationEncryptionCoordinationLogPath: join(dir, "encryption-coordination.log"),
    conversationActivationCoordinationLogPath: join(dir, "activation.log"),
    conversationPayloadRetentionLogPath: join(dir, "retention.log"),
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(ALICE),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
    clock: incrementingClock(2_400_000_000),
  };
}

async function activateDirectConversation(config: FedosDesktopRuntimeConfig, counterparty: FedosConversationParticipantReference): Promise<string> {
  const runtime = await startFedosDesktopRuntime(config);
  const cr = runtime.conversationRuntime();
  const created = cr.createDirectDraft({ recipient: counterparty });
  if (created.outcome !== "draft-created") throw new Error("expected draft-created");
  const id = created.draft.id;
  const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
  if (cr.redeemInvitation(token, counterparty).outcome !== "redeemed") throw new Error("expected redeemed");
  if ((await cr.activateDirectConversation(id)).outcome !== "activated") throw new Error("expected activated");
  await runtime.stop();
  return id;
}

describe("Alpha 4181-4260 -- Window Registry: multi-window lifecycle", () => {
  it("creates independent windows with independent navigation state, over the SAME running Boundary", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4181-4260-registry-multiwindow-"));
    const config = freshConfig(dir);
    const bobConversationId = await activateDirectConversation(config, BOB);
    const carolConversationId = await activateDirectConversation(config, CAROL);

    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));

    expect(registry.openWindowIds).toEqual([]);
    const windowA = registry.createWindow("win-a");
    const windowB = registry.createWindow("win-b");
    expect([...registry.openWindowIds].sort()).toEqual(["win-a", "win-b"]);

    await windowA.openConversation(bobConversationId);
    await windowB.openConversation(carolConversationId);

    // Each window kept its OWN conversation open -- neither clobbered the other's state
    // (the multi-window safety property this Arc's own Phase A inventory documents).
    expect(windowA.navigationState).toEqual({ kind: "open", conversationId: bobConversationId });
    expect(windowB.navigationState).toEqual({ kind: "open", conversationId: carolConversationId });
    expect(registry.getWindow("win-a")).toBe(windowA);
    expect(registry.getWindow("win-c")).toBeNull();

    // Window lifecycle: disposing one window never affects the other.
    expect(registry.disposeWindow("win-a")).toBe(true);
    expect(registry.openWindowIds).toEqual(["win-b"]);
    expect(windowB.navigationState).toEqual({ kind: "open", conversationId: carolConversationId });
    expect(registry.disposeWindow("win-a")).toBe(false);

    await boundary.runtimeStatus.stop();
  });

  it("createWindow rejects a duplicate window id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4181-4260-registry-dup-"));
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(freshConfig(dir));
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    registry.createWindow("win-1");
    expect(() => registry.createWindow("win-1")).toThrow(/already exists/);
    await boundary.runtimeStatus.stop();
  });
});

describe("Alpha 4181-4260 -- Window Registry: pin state / recent list / navigation persistence", () => {
  it("pin/unpin, recent list, and last-opened all survive a real Registry restart (fresh process simulation)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4181-4260-registry-persist-"));
    const config = freshConfig(dir);
    const bobConversationId = await activateDirectConversation(config, BOB);
    const carolConversationId = await activateDirectConversation(config, CAROL);
    const navigationLogPath = join(dir, "navigation.log");

    // --- "Session 1" ---
    {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      await boundary.runtimeStatus.start(config);
      const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, navigationLogPath);
      const window = registry.createWindow("win-1");

      await window.openConversation(bobConversationId);
      registry.recordConversationOpened(bobConversationId);
      registry.pinConversation(bobConversationId);

      await window.switchConversation(carolConversationId);
      registry.recordConversationOpened(carolConversationId);

      expect(registry.isPinned(bobConversationId)).toBe(true);
      expect(registry.isPinned(carolConversationId)).toBe(false);
      expect(registry.pinnedConversationIds).toEqual([bobConversationId]);
      expect(registry.recentConversationIds).toEqual([carolConversationId, bobConversationId]);
      expect(registry.lastOpenedConversationId).toBe(carolConversationId);

      await boundary.runtimeStatus.stop();
    }

    // --- "Session 2" -- a fresh Registry/Boundary/Runtime over the SAME durable paths,
    // simulating a real process restart. Nothing above is held across this boundary.
    {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      await boundary.runtimeStatus.start(config);
      const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, navigationLogPath);

      // Navigation state persistence (Phase C) -- pin/recent/last-opened all read back correctly.
      expect(registry.isPinned(bobConversationId)).toBe(true);
      expect(registry.pinnedConversationIds).toEqual([bobConversationId]);
      expect(registry.recentConversationIds).toEqual([carolConversationId, bobConversationId]);
      expect(registry.lastOpenedConversationId).toBe(carolConversationId);

      // Last-opened restoration: a fresh window restores real, live content for that id.
      const restoredWindow = registry.createWindow("win-restored");
      const restored = await restoredWindow.restoreLastOpened(registry.lastOpenedConversationId);
      expect(restored).toEqual({ kind: "open", conversationId: carolConversationId });

      registry.unpinConversation(bobConversationId);
      expect(registry.isPinned(bobConversationId)).toBe(false);
      expect(registry.pinnedConversationIds).toEqual([]);

      await boundary.runtimeStatus.stop();
    }

    // --- "Session 3" -- the unpin is durable too.
    {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      await boundary.runtimeStatus.start(config);
      const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, navigationLogPath);
      expect(registry.isPinned(bobConversationId)).toBe(false);
      await boundary.runtimeStatus.stop();
    }
  });

  it("restoreLastOpened(null) leaves a fresh window empty, recording no history", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4181-4260-registry-restore-null-"));
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(freshConfig(dir));
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    expect(registry.lastOpenedConversationId).toBeNull();
    const window = registry.createWindow("win-1");
    const state = await window.restoreLastOpened(null);
    expect(state).toEqual({ kind: "empty" });
    expect(window.canGoBack).toBe(false);
    await boundary.runtimeStatus.stop();
  });

  it("recent list is bounded and moves a re-touched conversation to the front", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4181-4260-registry-recent-bound-"));
    const persistence = new AppendOnlyFedosDesktopNavigationPersistence(join(dir, "navigation.log"));
    for (let i = 0; i < 5; i += 1) {
      persistence.recordEvent({ type: "recent-touch", conversationId: `c${i}`, at: i });
    }
    persistence.recordEvent({ type: "recent-touch", conversationId: "c1", at: 100 });
    const snapshot = persistence.snapshot(3);
    expect(snapshot.recentConversationIds).toEqual(["c1", "c4", "c3"]);
  });

  it("a malformed line in the navigation log fails closed (throws), never silently repaired", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4181-4260-registry-corrupt-"));
    const logPath = join(dir, "navigation.log");
    appendFileSync(logPath, "not json at all\n", "utf8");
    const persistence = new AppendOnlyFedosDesktopNavigationPersistence(logPath);
    expect(() => persistence.snapshot()).toThrow();
  });
});
