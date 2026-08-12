/**
 * Secure Runtime Alpha 4341-4420 ("Desktop Unread Badge and Menu Bar Count
 * Integration Arc") — Phase B: Desktop Badge Boundary, real acceptance
 * tests. Same fixture pattern as
 * `secure_runtime_alpha_4261_4340_tray_coordinator.test.ts` — a real
 * running Runtime/Shell/Presentation Boundary/Window Registry, never a
 * stub. `FakeTrackingBadgePort` below is a real, total
 * `FedosDesktopBadgePort` implementation (the same style as
 * `NoopFedosDesktopBadgePort`, just with an inspectable log), not a mock
 * library.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
import {
  FedosDesktopBadgeCoordinator,
  type FedosDesktopBadgeRegistryView,
} from "../src/os/messenger/desktop/badge/fedos_desktop_badge_coordinator.js";
import { NoopFedosDesktopBadgePort } from "../src/os/messenger/desktop/badge/fedos_desktop_badge_port.js";
import type { FedosDesktopBadgePort } from "../src/os/messenger/desktop/badge/fedos_desktop_badge_port.js";
import {
  FEDOS_DESKTOP_BADGE_STATES,
  fedosDesktopBadgeCount,
  fedosDesktopBadgeNone,
  fedosDesktopBadgeViewsEqual,
  type FedosDesktopBadgeView,
} from "../src/os/messenger/desktop/badge/fedos_desktop_badge_types.js";

class FakeTrackingBadgePort implements FedosDesktopBadgePort {
  readonly rendered: FedosDesktopBadgeView[] = [];

  status(): "available" | "unavailable" {
    return "available";
  }

  render(view: FedosDesktopBadgeView): void {
    this.rendered.push(view);
  }
}

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
    clock: incrementingClock(2_500_000_000),
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

/** Sends one real message through the SAME `FedosDesktopComposeMessageViewModel` a real UI already uses (never `boundary.shell.sendMessage()` directly -- that getter is documented as present only "so tests can assert every ViewModel shares the identical Shell instance", not as a general-purpose test shortcut). */
async function sendMessage(
  boundary: ReturnType<typeof createFedosDesktopConversationUiPresentationBoundary>,
  conversationId: string,
  body: string,
): Promise<void> {
  boundary.composeMessage.setBody(body);
  const result = await boundary.composeMessage.send(conversationId, ALICE);
  if (result.status !== "loaded") throw new Error(`expected message send to succeed, got status "${result.status}"`);
}

describe("Alpha 4341-4420 -- Badge types: closed vocabulary + view construction", () => {
  it("the closed state vocabulary is exactly the five documented states", () => {
    expect(new Set(FEDOS_DESKTOP_BADGE_STATES)).toEqual(new Set(["none", "count", "attention", "synchronizing", "error"]));
  });

  it("fedosDesktopBadgeViewsEqual is a structural, never a reference, comparison", () => {
    const a = fedosDesktopBadgeCount(3);
    const b = fedosDesktopBadgeCount(3);
    expect(a).not.toBe(b);
    expect(fedosDesktopBadgeViewsEqual(a, b)).toBe(true);
    expect(fedosDesktopBadgeViewsEqual(a, fedosDesktopBadgeCount(4))).toBe(false);
    expect(fedosDesktopBadgeViewsEqual(a, fedosDesktopBadgeNone())).toBe(false);
  });

  it("NoopFedosDesktopBadgePort is permanently unavailable and never throws on render", () => {
    const port = new NoopFedosDesktopBadgePort();
    expect(port.status()).toBe("unavailable");
    expect(() => port.render(fedosDesktopBadgeCount(5))).not.toThrow();
  });
});

describe("Alpha 4341-4420 -- Badge Coordinator: reuses the Window Registry's own recentConversationIds", () => {
  it("with zero recent conversations, refresh() reports 'none' and count 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-empty-"));
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(freshConfig(dir));
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    const port = new FakeTrackingBadgePort();
    const coordinator = new FedosDesktopBadgeCoordinator(registry, boundary.unreadCounter, port);

    const view = await coordinator.refresh();
    expect(view).toEqual({ state: "none", count: 0, reason: "no unread messages" });
    expect(port.rendered).toHaveLength(1);

    await boundary.runtimeStatus.stop();
  });

  it("unread increments -- a real new message in a recent conversation is reflected via the REUSED FedosDesktopUnreadCounterViewModel, never independently computed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-increment-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    registry.recordConversationOpened(bobId);
    const port = new FakeTrackingBadgePort();
    const coordinator = new FedosDesktopBadgeCoordinator(registry, boundary.unreadCounter, port);

    // A fresh recent conversation with no messages yet is a baseline -- "count", never "attention".
    const baseline = await coordinator.refresh();
    expect(baseline).toEqual({ state: "none", count: 0, reason: "no unread messages" });

    await sendMessage(boundary, bobId, "hello from alice");
    const afterSend = await coordinator.refresh();
    expect(afterSend.state).toBe("attention");
    expect(afterSend.count).toBe(1);

    // A second refresh with nothing new -- the count is the SAME (already observed), so "count" not "attention".
    const steady = await coordinator.refresh();
    expect(steady.state).toBe("count");
    expect(steady.count).toBe(1);

    await boundary.runtimeStatus.stop();
  });

  it("unread clears -- markViewed() (reused verbatim from FedosDesktopUnreadCounterViewModel) brings the badge back to 'none'", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-clear-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    registry.recordConversationOpened(bobId);
    const port = new FakeTrackingBadgePort();
    const coordinator = new FedosDesktopBadgeCoordinator(registry, boundary.unreadCounter, port);

    await sendMessage(boundary, bobId, "hello");
    const beforeClear = await coordinator.refresh();
    expect(beforeClear.count).toBe(1);

    await boundary.unreadCounter.markViewed(bobId);
    const afterClear = await coordinator.refresh();
    expect(afterClear).toEqual({ state: "none", count: 0, reason: "no unread messages" });

    await boundary.runtimeStatus.stop();
  });

  it("multiple conversations -- the aggregate is the real SUM of every recent conversation's own unread count", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-multi-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const carolId = await activateDirectConversation(config, CAROL);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    registry.recordConversationOpened(bobId);
    registry.recordConversationOpened(carolId);
    const port = new FakeTrackingBadgePort();
    const coordinator = new FedosDesktopBadgeCoordinator(registry, boundary.unreadCounter, port);

    await sendMessage(boundary, bobId, "one");
    await sendMessage(boundary, carolId, "two");
    await sendMessage(boundary, carolId, "three");
    const view = await coordinator.refresh();
    expect(view.count).toBe(3);
    // First-ever observation for this Coordinator instance -- a baseline, not a false "new arrival".
    expect(view.state).toBe("count");

    await boundary.runtimeStatus.stop();
  });

  it("restart -- a freshly constructed Coordinator over the SAME persisted Registry/watermark state never double-counts or fabricates a false 'attention'", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-restart-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    registry.recordConversationOpened(bobId);
    await sendMessage(boundary, bobId, "hello");

    // Simulates a process restart: a brand-new Coordinator instance, own fresh in-memory bookkeeping.
    const freshPort = new FakeTrackingBadgePort();
    const freshCoordinator = new FedosDesktopBadgeCoordinator(registry, boundary.unreadCounter, freshPort);
    const view = await freshCoordinator.refresh();
    expect(view.count).toBe(1);
    // First-ever observation for this Coordinator instance -- a baseline, not a false "new arrival".
    expect(view.state).toBe("count");

    await boundary.runtimeStatus.stop();
  });
});

describe("Alpha 4341-4420 -- Badge Coordinator: no duplicate badge updates (Phase G)", () => {
  it("two consecutive refresh() calls with nothing changed call the Port exactly once", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-dedup-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    registry.recordConversationOpened(bobId);
    const port = new FakeTrackingBadgePort();
    const coordinator = new FedosDesktopBadgeCoordinator(registry, boundary.unreadCounter, port);

    await coordinator.refresh();
    expect(coordinator.renderCount).toBe(1);
    await coordinator.refresh();
    expect(coordinator.renderCount).toBe(1);
    expect(port.rendered).toHaveLength(1);

    // A real state change (a new message) DOES trigger a second render.
    await sendMessage(boundary, bobId, "hi");
    await coordinator.refresh();
    expect(coordinator.renderCount).toBe(2);
    expect(port.rendered).toHaveLength(2);

    await boundary.runtimeStatus.stop();
  });
});

describe("Alpha 4341-4420 -- Badge Coordinator: synchronizing (Phase D)", () => {
  it("setSynchronizing(true) reports 'synchronizing' with the real current count on the NEXT refresh, never inferred on its own", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-sync-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    registry.recordConversationOpened(bobId);
    const port = new FakeTrackingBadgePort();
    const coordinator = new FedosDesktopBadgeCoordinator(registry, boundary.unreadCounter, port);

    await sendMessage(boundary, bobId, "hi");
    coordinator.setSynchronizing(true);
    const view = await coordinator.refresh();
    expect(view.state).toBe("synchronizing");
    expect(view.count).toBe(1);

    coordinator.setSynchronizing(false);
    const after = await coordinator.refresh();
    expect(after.state).toBe("count");

    await boundary.runtimeStatus.stop();
  });
});

describe("Alpha 4341-4420 -- Badge Coordinator: fails closed on a genuine unread-refresh error", () => {
  it("a recent conversation id the Shell no longer recognizes reports 'error', never a fabricated count", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4341-4420-badge-error-"));
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(freshConfig(dir));
    // A real object satisfying the Coordinator's own narrow `FedosDesktopBadgeRegistryView` --
    // never a mock of the Registry's own business logic, just a fixed list of ids (the Coordinator
    // itself does not care HOW the list was produced, only what it contains).
    const registryView: FedosDesktopBadgeRegistryView = { recentConversationIds: ["never-activated-conversation-id"] };
    const port = new FakeTrackingBadgePort();
    const coordinator = new FedosDesktopBadgeCoordinator(registryView, boundary.unreadCounter, port);

    const view = await coordinator.refresh();
    expect(view.state).toBe("error");
    expect(view.count).toBe(0);

    await boundary.runtimeStatus.stop();
  });
});
