import { describe, it, expect } from "vitest";
import { FedosDeletionRequestController } from "../src/os/messenger/desktop/presentation/deletion_request/fedos_deletion_request_controller.js";
import type { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";
import { fedosDesktopShellOk } from "../src/os/messenger/desktop/shell/fedos_desktop_shell_result.js";
import type { FedosDeletionRequestInboxSummaryV1 } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_inbox_summary.js";
import type { FedosDeletionRecipientDecisionState } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_recipient_decision_state.js";
import type { FedosDesktopNotificationPort, FedosDesktopNotificationDeliveryResult } from "../src/os/messenger/notifications/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationView } from "../src/os/messenger/notifications/fedos_desktop_notification_types.js";

/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) -- gap-closing follow-up: Phase K
 * Notification Coordinator wiring, unit-level proof.
 *
 * `FedosDeletionRequestController` (`../src/desktop/presentation/deletion_request/
 * fedos_deletion_request_controller.ts`) composes the EXISTING, unmodified
 * `FedosDesktopNotificationCoordinator` (`4261-4340`) to raise coarse,
 * fixed-template signals on Inbox refresh and on explicit sender-side
 * triggers. This file proves, with a real `FedosDeletionRequestController`
 * and a real `FedosDesktopNotificationCoordinator` (only the terminal
 * `FedosDesktopNotificationPort` is a recording fake, mirroring this Arc's
 * OWN existing precedent of faking only the outermost transport/delivery
 * edge, never the domain logic above it):
 *   - a newly-seen pending-review item fires "deletion-request-received"
 *     exactly once, never again on a repeated refresh of the SAME item;
 *   - a newly-seen expired item fires "deletion-request-expired" exactly
 *     once, with the same never-again discipline;
 *   - every notification ever raised by this Controller carries ONLY the
 *     closed kind + an opaque `targetConversationId` (+ a short bounded
 *     `detail` for the explicit sender-side triggers) -- never a requester
 *     identity, a request id, a reason code, or any message-shaped text.
 */

function summary(overrides: Partial<FedosDeletionRequestInboxSummaryV1> = {}): FedosDeletionRequestInboxSummaryV1 {
  return {
    schemaVersion: 1,
    requestId: "req-1",
    conversationId: "conv-1",
    targetEnvelopeId: "env-1",
    requesterAccountRef: "alice",
    requesterDeviceRef: "alice-device-a",
    recipientDeviceRef: "bob-device-a",
    scope: "local-history",
    issuedAt: 1000,
    expiresAt: 2000,
    reasonCode: null,
    recordedAt: 1000,
    ...overrides,
  };
}

class RecordingNotificationPort implements FedosDesktopNotificationPort {
  readonly delivered: FedosDesktopNotificationView[] = [];

  status(): "available" {
    return "available";
  }

  async notify(view: FedosDesktopNotificationView): Promise<FedosDesktopNotificationDeliveryResult> {
    this.delivered.push(view);
    return { delivered: true, reason: "recorded" };
  }
}

function fakeShell(rows: readonly { readonly summary: FedosDeletionRequestInboxSummaryV1; readonly decisionState: FedosDeletionRecipientDecisionState | null }[]): FedosDesktopApplicationShell {
  return {
    deletionRequestListReceived: () => fedosDesktopShellOk(rows),
  } as unknown as FedosDesktopApplicationShell;
}

describe("Secure Runtime Alpha 6041-6120 gap-closing -- Notification Coordinator wiring", () => {
  it("1. a newly-seen pending-review item fires 'deletion-request-received' exactly once, never again on a repeated refresh", async () => {
    const port = new RecordingNotificationPort();
    const controller = new FedosDeletionRequestController(fakeShell([{ summary: summary({ requestId: "req-1" }), decisionState: "received" }]), port);

    await controller.refreshReceivedInbox();
    await controller.refreshReceivedInbox();
    await controller.refreshReceivedInbox();

    const received = port.delivered.filter((v) => v.kind === "deletion-request-received");
    expect(received).toHaveLength(1);
    expect(received[0]?.targetConversationId).toBe("conv-1");
  });

  it("2. a newly-seen expired item fires 'deletion-request-expired' exactly once, never again on a repeated refresh", async () => {
    const port = new RecordingNotificationPort();
    const controller = new FedosDeletionRequestController(fakeShell([{ summary: summary({ requestId: "req-2" }), decisionState: "expired" }]), port);

    await controller.refreshReceivedInbox();
    await controller.refreshReceivedInbox();

    const expired = port.delivered.filter((v) => v.kind === "deletion-request-expired");
    expect(expired).toHaveLength(1);
  });

  it("3. two distinct new items in the SAME refresh each notify exactly once; a later refresh with only the same two items notifies neither again", async () => {
    const port = new RecordingNotificationPort();
    const rows = [
      { summary: summary({ requestId: "req-a" }), decisionState: "received" as const },
      { summary: summary({ requestId: "req-b" }), decisionState: "policy-pending" as const },
    ];
    const controller = new FedosDeletionRequestController(fakeShell(rows), port);

    await controller.refreshReceivedInbox();
    expect(port.delivered.filter((v) => v.kind === "deletion-request-received")).toHaveLength(2);

    await controller.refreshReceivedInbox();
    expect(port.delivered.filter((v) => v.kind === "deletion-request-received")).toHaveLength(2);
  });

  it("4. a non-pending, non-expired status (e.g. 'policy-rejected') never fires any notification", async () => {
    const port = new RecordingNotificationPort();
    const controller = new FedosDeletionRequestController(fakeShell([{ summary: summary({ requestId: "req-3" }), decisionState: "policy-rejected" }]), port);

    await controller.refreshReceivedInbox();

    expect(port.delivered).toHaveLength(0);
  });

  it("5. explicit sender-side triggers deliver the exact closed kind with only an opaque conversationId and a short bounded detail -- never a request id, requester ref, or reason code", async () => {
    const port = new RecordingNotificationPort();
    const controller = new FedosDeletionRequestController(fakeShell([]), port);

    await controller.notifyRecipientResponded("conv-9");
    await controller.notifySomeDevicesPending("conv-9", 3);
    await controller.notifyPartiallyApplied("conv-9");

    expect(port.delivered.map((v) => v.kind)).toEqual(["deletion-request-responded", "deletion-request-pending-devices", "deletion-request-partial"]);
    for (const view of port.delivered) {
      expect(view.targetConversationId).toBe("conv-9");
      expect(view).not.toHaveProperty("requestId");
      expect(view).not.toHaveProperty("requesterAccountRef");
      expect(view).not.toHaveProperty("reasonCode");
    }
    const pendingView = port.delivered.find((v) => v.kind === "deletion-request-pending-devices");
    expect(pendingView?.body).toContain("3 device(s) pending");
  });

  it("6. no notification body/title ever contains a raw request id, a conversation id fragment beyond the fixed template, or anything resembling a signature/hex blob", async () => {
    const port = new RecordingNotificationPort();
    const secretLookingConversationId = "conv-with-a-very-long-opaque-ref-1234567890abcdef";
    const controller = new FedosDeletionRequestController(
      fakeShell([{ summary: summary({ requestId: "req-secret-id-should-never-leak", conversationId: secretLookingConversationId }), decisionState: "received" }]),
      port,
    );

    await controller.refreshReceivedInbox();

    for (const view of port.delivered) {
      expect(view.title).not.toContain("req-secret-id-should-never-leak");
      expect(view.body).not.toContain("req-secret-id-should-never-leak");
      expect(view.title).not.toContain(secretLookingConversationId);
      expect(view.body).not.toContain(secretLookingConversationId);
    }
  });

  it("7. the default constructor (no Port supplied) uses the safe Noop backend -- refreshing an inbox with a new pending item never throws even with no real backend configured", async () => {
    const controller = new FedosDeletionRequestController(fakeShell([{ summary: summary({ requestId: "req-4" }), decisionState: "received" }]));
    await expect(controller.refreshReceivedInbox()).resolves.toBeUndefined();
    expect(controller.notificationCoordinator.deliveredCount).toBe(0);
  });

  it("8. setNotificationPort() swaps the backend -- a later refresh uses the NEW port, not the original default", async () => {
    const controller = new FedosDeletionRequestController(fakeShell([{ summary: summary({ requestId: "req-5" }), decisionState: "received" }]));
    const port = new RecordingNotificationPort();
    controller.setNotificationPort(port);

    await controller.refreshReceivedInbox();

    expect(port.delivered.filter((v) => v.kind === "deletion-request-received")).toHaveLength(1);
  });
});
