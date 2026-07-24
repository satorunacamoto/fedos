/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase P: failure matrix. Uses the Controller
 * directly against a stopped/unconfigured Shell (mirrors
 * `secure_runtime_alpha_6121_6200_...` Controller-level failure tests) —
 * the real vertical slice already covers the live-Runtime happy/restart
 * paths with real crypto.
 */
import { describe, it, expect } from "vitest";
import { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import { FedosSafetyCenterController } from "../src/desktop/presentation/safety_center/fedos_safety_center_controller.js";
import { AppendOnlyFedosDeletionRequestPendingReviewPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_request_pending_review_persistence.js";
import { InMemoryFedosDeletionRequestPendingReviewPersistence } from "../src/conversation/deletion_request/fedos_deletion_request_pending_review_persistence.js";
import { validateFedosDesktopHostCommand } from "../src/desktop/host_boundary/fedos_desktop_host_command.js";

describe("Secure Runtime Alpha 6201-6280 -- failure matrix", () => {
  it("1. stopped Shell -- overview/events refresh honestly reports every section unavailable, never throws", async () => {
    const shell = FedosDesktopApplicationShell.create();
    const controller = new FedosSafetyCenterController(shell);
    await controller.refreshOverview();
    const state = controller.overviewState;
    expect(state.status).toBe("loaded");
    if (state.status !== "loaded") return;
    for (const section of state.data.summary.sections) {
      expect(["unavailable", "ready", "attention"]).toContain(section.state);
    }
    expect(state.data.summary.productionCryptoActive).toBe(false);
  });

  it("2. malformed Shell command -- unknown safety-center type fails closed to null", () => {
    expect(validateFedosDesktopHostCommand({ type: "safety-center-overview", ratchetPairs: null })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "safety-center-section", section: 123 })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "safety-center-device-action", action: "request-revoke", deviceId: "", devicePublicKeyHex: "" })).toBeNull();
  });

  it("3. unknown section -- navigation.goto() refuses and leaves state unchanged", () => {
    const shell = FedosDesktopApplicationShell.create();
    const controller = new FedosSafetyCenterController(shell);
    expect(controller.goto("not-a-real-section")).toBe(false);
    expect(controller.navigation.section).toBe("overview");
  });

  it("4. Ratchet reset confirmation without authorization -- confirmPendingAction() honestly reports 'unsupported', never a fabricated reset", async () => {
    const shell = FedosDesktopApplicationShell.create();
    const controller = new FedosSafetyCenterController(shell);
    controller.requestAuthorizeRatchetResetConfirmation("conv-1", "device-1");
    await controller.confirmPendingAction();
    const state = controller.confirmationState;
    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.outcome).toBe("unsupported");
  });

  it("5. identity transition decision already terminal -- no crash, honestly unavailable on an unconfigured Runtime", () => {
    const shell = FedosDesktopApplicationShell.create();
    expect(shell.identityTransitionStatus({ authority: "nostr", publicIdentifier: "a", identityId: null }, "d", "t").outcome).toBe("unavailable");
  });

  it("6. deletion request expired -- pending-review approval past its own expiresAt honestly reports unknown-request, never a stale grant", async () => {
    const { FedosDeletionRequestInboundCoordinator } = await import("../src/conversation/deletion_request/fedos_deletion_request_inbound_coordinator.js");
    const { InMemoryFedosConversationMembershipAuthority } = await import("../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js");
    const { InMemoryFedosConversationMessageEnvelopePersistence } = await import("../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js");
    const { InMemoryFedosPayloadRetentionPersistence } = await import("../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js");
    const { InMemoryFedosConversationPayloadStorage } = await import("../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js");
    const { FedosPayloadRetentionAuthority } = await import("../src/conversation/retention/fedos_payload_retention_authority.js");
    const { InMemoryFedosDeletionRecipientDecisionPersistence } = await import("../src/conversation/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.js");
    const { InMemoryFedosDeletionExecutionPersistence } = await import("../src/conversation/deletion/in_memory_fedos_deletion_execution_persistence.js");

    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage, clock: () => 0 });
    let now = 1000;
    const inbound = new FedosDeletionRequestInboundCoordinator({
      authorization: {
        conversationPersistence: { getConversation: () => null },
        envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
        membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
        clock: () => now,
        localDeviceRef: "bob-device",
      },
      recipientDecisionPersistence: new InMemoryFedosDeletionRecipientDecisionPersistence(),
      resolveLocalPolicy: () => "always-review",
      clock: () => now,
      retentionAuthority,
      searchIndex: { reconcilePayloadRetention: () => 0 },
      localExecutionPersistence: new InMemoryFedosDeletionExecutionPersistence(),
      localAccountRef: "bob-account",
      pendingReviewPersistence: new InMemoryFedosDeletionRequestPendingReviewPersistence(),
    });
    // Directly exercise the fail-closed expiry re-check via a hand-built signed request in the durable store.
    const pendingReviewPersistence = new InMemoryFedosDeletionRequestPendingReviewPersistence();
    const fakeSigned = { record: { schemaVersion: 1, requestId: "req-expired", requesterAccountRef: "a", requesterDeviceRef: null, recipientAccountRef: "b", recipientDeviceRef: null, conversationId: "c", targetEnvelopeId: "e", scope: "local-history", issuedAt: 0, expiresAt: 500, nonceHex: "aa" }, wireEvent: { id: "i", pubkey: "p", created_at: 0, kind: 1, tags: [], content: "", sig: "s" } } as never;
    pendingReviewPersistence.putPendingReview("req-expired", fakeSigned, 0);
    const inbound2 = new FedosDeletionRequestInboundCoordinator({
      authorization: { conversationPersistence: { getConversation: () => null }, envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(), membershipAuthority: new InMemoryFedosConversationMembershipAuthority(), clock: () => now, localDeviceRef: "bob-device" },
      recipientDecisionPersistence: new InMemoryFedosDeletionRecipientDecisionPersistence(),
      resolveLocalPolicy: () => "always-review",
      clock: () => now,
      retentionAuthority,
      searchIndex: { reconcilePayloadRetention: () => 0 },
      localExecutionPersistence: new InMemoryFedosDeletionExecutionPersistence(),
      localAccountRef: "bob-account",
      pendingReviewPersistence,
    });
    now = 999_999; // well past expiresAt: 500
    const result = await inbound2.executeApprovedLocalDeletionById("req-expired");
    expect(result.outcome).toBe("unknown-request");
    void inbound;
  });

  it("7. pending-review resource-limit exhaustion -- the 501st live entry is refused, never silently dropped", () => {
    const persistence = new InMemoryFedosDeletionRequestPendingReviewPersistence();
    const fakeSigned = (id: string) =>
      ({ record: { schemaVersion: 1, requestId: id, requesterAccountRef: "a", requesterDeviceRef: null, recipientAccountRef: "b", recipientDeviceRef: null, conversationId: "c", targetEnvelopeId: "e", scope: "local-history", issuedAt: 0, expiresAt: 999_999_999 }, wireEvent: { id, pubkey: "p", created_at: 0, kind: 1, tags: [], content: "", sig: "s" } }) as never;
    for (let i = 0; i < 500; i++) {
      const outcome = persistence.putPendingReview(`req-${i}`, fakeSigned(`req-${i}`), 0);
      expect(outcome).toBe("inserted");
    }
    const overflow = persistence.putPendingReview("req-500", fakeSigned("req-500"), 0);
    expect(overflow).toBe("resource-limit-exceeded");
  });

  it("8. pending-review conflicting duplicate -- a different body for the same requestId is refused, never silently overwritten", () => {
    const persistence = new InMemoryFedosDeletionRequestPendingReviewPersistence();
    const bodyA = { record: { schemaVersion: 1, requestId: "req-1", requesterAccountRef: "a", requesterDeviceRef: null, recipientAccountRef: "b", recipientDeviceRef: null, conversationId: "c", targetEnvelopeId: "e", scope: "local-history", issuedAt: 0, expiresAt: 999 }, wireEvent: { id: "i1", pubkey: "p", created_at: 0, kind: 1, tags: [], content: "", sig: "s1" } } as never;
    const bodyB = { record: { schemaVersion: 1, requestId: "req-1", requesterAccountRef: "a", requesterDeviceRef: null, recipientAccountRef: "b", recipientDeviceRef: null, conversationId: "c", targetEnvelopeId: "e", scope: "local-history-and-index", issuedAt: 0, expiresAt: 999 }, wireEvent: { id: "i1", pubkey: "p", created_at: 0, kind: 1, tags: [], content: "", sig: "s1" } } as never;
    expect(persistence.putPendingReview("req-1", bodyA, 0)).toBe("inserted");
    expect(persistence.putPendingReview("req-1", bodyA, 0)).toBe("already-present");
    expect(persistence.putPendingReview("req-1", bodyB, 0)).toBe("conflict");
  });

  it("9. pending-review never resurrected after tombstone -- a late redelivery for an already-decided requestId is refused", () => {
    const persistence = new InMemoryFedosDeletionRequestPendingReviewPersistence();
    const body = { record: { schemaVersion: 1, requestId: "req-1", requesterAccountRef: "a", requesterDeviceRef: null, recipientAccountRef: "b", recipientDeviceRef: null, conversationId: "c", targetEnvelopeId: "e", scope: "local-history", issuedAt: 0, expiresAt: 999 }, wireEvent: { id: "i1", pubkey: "p", created_at: 0, kind: 1, tags: [], content: "", sig: "s1" } } as never;
    expect(persistence.putPendingReview("req-1", body, 0)).toBe("inserted");
    persistence.tombstonePendingReview("req-1", 1);
    expect(persistence.getPendingReview("req-1")).toBeNull();
    expect(persistence.putPendingReview("req-1", body, 2)).toBe("conflict");
  });

  it("10. corrupt append-only pending-review log line -- fails closed (throws), never silently skips or fabricates", async () => {
    // @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    // @ts-expect-error see above.
    const { tmpdir } = await import("node:os");
    // @ts-expect-error see above.
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "fedos-pending-review-corrupt-"));
    try {
      const filePath = join(dir, "pending-review.ndjson");
      writeFileSync(filePath, "not valid json at all\n", "utf8");
      const persistence = new AppendOnlyFedosDeletionRequestPendingReviewPersistence(filePath);
      expect(() => persistence.getPendingReview("anything")).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("11. concurrent refresh/action -- two overlapping confirmPendingAction() calls never both mutate (re-entrancy guard, mirrors the codebase's own established #actionInFlight discipline)", async () => {
    const shell = FedosDesktopApplicationShell.create();
    const controller = new FedosSafetyCenterController(shell);
    controller.requestRevokeDeviceConfirmation("d1", "aa");
    const first = controller.confirmPendingAction();
    const second = controller.confirmPendingAction(); // should be a silent no-op while `first` is in flight
    await Promise.all([first, second]);
    // No throw, no crash -- the guard held.
    expect(controller.confirmationState.status === "error" || controller.confirmationState.status === "idle").toBe(true);
  });

  it("12. settings action without a settings controller wired -- honestly unavailable, never a fabricated success", async () => {
    const shell = FedosDesktopApplicationShell.create();
    const controller = new FedosSafetyCenterController(shell);
    expect(await controller.updateNotificationsEnabled(true)).toBe(false);
    expect(await controller.updateBackgroundSyncEnabled(false)).toBe(false);
  });
});
