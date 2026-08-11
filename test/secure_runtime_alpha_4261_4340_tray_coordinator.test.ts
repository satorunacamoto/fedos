/**
 * Secure Runtime Alpha 4261-4340 — Phase C: System Tray Boundary, real
 * acceptance tests. Same fixture pattern as
 * `secure_runtime_alpha_4181_4260_window_registry.test.ts` — a real running
 * Runtime/Shell/Presentation Boundary/Window Registry, never a stub.
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
import { TrayCoordinator } from "../src/os/messenger/desktop/tray/fedos_desktop_tray_coordinator.js";
import { fedosDesktopTrayMenuItems, validateFedosDesktopTrayActionRequest, FEDOS_DESKTOP_TRAY_ACTIONS } from "../src/os/messenger/desktop/tray/fedos_desktop_tray_types.js";

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

describe("Alpha 4261-4340 -- Tray types: closed vocabulary + menu", () => {
  it("the closed action vocabulary is exactly the six documented actions", () => {
    expect(new Set(FEDOS_DESKTOP_TRAY_ACTIONS)).toEqual(
      new Set(["open-window", "recent-conversations", "device-sync-status", "pause-sync", "resume-sync", "exit"]),
    );
  });

  it("fedosDesktopTrayMenuItems renders all six items in a fixed order, honoring disabledActions", () => {
    const items = fedosDesktopTrayMenuItems(new Set(["pause-sync"]));
    expect(items.map((i) => i.action)).toEqual(FEDOS_DESKTOP_TRAY_ACTIONS);
    expect(items.find((i) => i.action === "pause-sync")?.enabled).toBe(false);
    expect(items.find((i) => i.action === "resume-sync")?.enabled).toBe(true);
  });

  it("rejects a malformed/unrecognized action -- fails closed to null", () => {
    expect(validateFedosDesktopTrayActionRequest({ action: "not-a-real-action" })).toBeNull();
    expect(validateFedosDesktopTrayActionRequest(null)).toBeNull();
    expect(validateFedosDesktopTrayActionRequest({ action: "open-window", conversationId: 5 })).toBeNull();
  });
});

describe("Alpha 4261-4340 -- Tray Coordinator: real dispatch scenarios (Phase G)", () => {
  it("tray open -- 'open-window' with no explicit id reports the Registry's own last-opened conversation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4261-4340-tray-open-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    const window = registry.createWindow("win-1");
    await window.openConversation(bobId);
    registry.recordConversationOpened(bobId);

    const coordinator = new TrayCoordinator(registry, boundary.deviceSyncStatus);
    const outcome = await coordinator.dispatch({ action: "open-window" });
    expect(outcome).toEqual({ action: "open-window", outcome: "ok", conversationId: bobId });

    const explicit = await coordinator.dispatch({ action: "open-window", conversationId: "some-other-id" });
    expect(explicit).toEqual({ action: "open-window", outcome: "ok", conversationId: "some-other-id" });

    await boundary.runtimeStatus.stop();
  });

  it("recent conversations -- lists the Registry's own recent-conversation ids, most-recent first", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4261-4340-tray-recent-"));
    const config = freshConfig(dir);
    const bobId = await activateDirectConversation(config, BOB);
    const carolId = await activateDirectConversation(config, CAROL);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    const window = registry.createWindow("win-1");
    await window.openConversation(bobId);
    registry.recordConversationOpened(bobId);
    await window.switchConversation(carolId);
    registry.recordConversationOpened(carolId);

    const coordinator = new TrayCoordinator(registry, boundary.deviceSyncStatus);
    const outcome = await coordinator.dispatch({ action: "recent-conversations" });
    expect(outcome).toEqual({ action: "recent-conversations", outcome: "ok", conversationIds: [carolId, bobId] });

    await boundary.runtimeStatus.stop();
  });

  it("device sync status / pause sync / resume sync -- real dispatch through FedosDesktopDeviceSyncStatusViewModel (honestly 'unsupported' on this base config, exactly like deviceStatus()'s own documented behavior)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4261-4340-tray-sync-"));
    const config = freshConfig(dir);
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(config);
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    const coordinator = new TrayCoordinator(registry, boundary.deviceSyncStatus);

    const status = await coordinator.dispatch({ action: "device-sync-status" });
    expect(status.action).toBe("device-sync-status");
    expect(status.outcome).toBe("error");

    const pause = await coordinator.dispatch({ action: "pause-sync" });
    expect(pause.action).toBe("pause-sync");
    expect(pause.outcome).toBe("error");

    const resume = await coordinator.dispatch({ action: "resume-sync" });
    expect(resume.action).toBe("resume-sync");
    expect(resume.outcome).toBe("error");

    await boundary.runtimeStatus.stop();
  });

  it("tray exit -- reports a closed 'ok' outcome; this Coordinator itself never calls process/app APIs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4261-4340-tray-exit-"));
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(freshConfig(dir));
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    const coordinator = new TrayCoordinator(registry, boundary.deviceSyncStatus);
    const outcome = await coordinator.dispatch({ action: "exit" });
    expect(outcome).toEqual({ action: "exit", outcome: "ok" });
    await boundary.runtimeStatus.stop();
  });

  it("unexpected command -- an unrecognized action is rejected, never dispatched", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-4261-4340-tray-unexpected-"));
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    await boundary.runtimeStatus.start(freshConfig(dir));
    const registry = new FedosDesktopConversationWindowRegistry(boundary, ALICE, join(dir, "navigation.log"));
    const coordinator = new TrayCoordinator(registry, boundary.deviceSyncStatus);
    const outcome = await coordinator.dispatch({ action: "launch-nukes" });
    expect(outcome).toEqual({ action: "rejected", outcome: "rejected", reason: "malformed or unrecognized tray action" });
    await boundary.runtimeStatus.stop();
  });
});
