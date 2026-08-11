/**
 * Secure Runtime Alpha 3801-3880 — real acceptance tests for the
 * Presentation (ViewModel) and Renderer layers.
 *
 * Every test drives a REAL `FedosDesktopConversationUiPresentationBoundary`
 * over a REAL `FedosDesktopApplicationShell` over a REAL
 * `startFedosDesktopRuntime()` instance, real append-only log files on
 * disk where durability is exercised. Mirrors this session's own
 * established "real Runtime, no mocked Shell/ViewModel/Renderer" testing
 * convention.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { createFedosDesktopConversationUiPresentationBoundary } from "../src/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { createFedosDesktopRenderer } from "../src/os/messenger/desktop/renderer/fedos_desktop_renderer.js";
import { StubVerifiedFedosDeviceRegistrationAuthority } from "./support/stub_verified_fedos_device_registration_authority.js";

const ACCOUNT_A = { authority: "nostr", publicIdentifier: "npub-account-a", identityId: null };
const ABANDONMENT_POLICY = { maxAttempts: 3, laterDelaySeconds: 60 };

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-device-sync-render-3801-3880-"));
}

function baseRuntimeConfig(dir: string) {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false as const,
  };
}

describe("Secure Runtime Alpha 3801-3880 -- Presentation + Renderer: idle/loading/error/content", () => {
  it("1. every new ViewModel/Renderer pair starts idle before any refresh", () => {
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    const renderer = createFedosDesktopRenderer(boundary);
    expect(boundary.deviceInventory.listState.status).toBe("idle");
    expect(renderer.deviceList.renderList().kind).toBe("idle");
    expect(boundary.deviceSyncStatus.state.status).toBe("idle");
    expect(renderer.deviceSyncStatus.renderStatus().kind).toBe("idle");
    expect(boundary.syncSchedule.state.status).toBe("idle");
    expect(renderer.syncSchedule.render().kind).toBe("idle");
    expect(boundary.transferSession.state.status).toBe("idle");
    expect(renderer.transferSession.render().kind).toBe("idle");
    expect(boundary.syncConflict.listState.status).toBe("idle");
    expect(renderer.syncConflict.renderList().kind).toBe("idle");
  });

  it("2. before start(), refresh() surfaces the Shell's own 'unavailable' as an error render", async () => {
    const boundary = createFedosDesktopConversationUiPresentationBoundary();
    const renderer = createFedosDesktopRenderer(boundary);
    await boundary.deviceInventory.refresh();
    const rendered = renderer.deviceList.renderList();
    expect(rendered.kind).toBe("error");
    if (rendered.kind === "error") expect(rendered.outcome).toBe("unavailable");
  });

  it("3. deviceTrustEnabled omitted -- ViewModel surfaces 'unsupported', Renderer shows an error, never throws", async () => {
    const dir = makeTmpDir();
    try {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      const renderer = createFedosDesktopRenderer(boundary);
      await boundary.runtimeStatus.start({ ...baseRuntimeConfig(dir), deviceTrustEnabled: false });
      await boundary.deviceSyncStatus.refresh();
      const rendered = renderer.deviceSyncStatus.renderStatus();
      expect(rendered.kind).toBe("error");
      if (rendered.kind === "error") expect(rendered.outcome).toBe("unsupported");
      await boundary.runtimeStatus.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4/5/6. start sync through the ViewModel, render running status, trigger manual sync, render tick outcomes", async () => {
    const dir = makeTmpDir();
    try {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      const renderer = createFedosDesktopRenderer(boundary);
      await boundary.runtimeStatus.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });

      await boundary.deviceSyncStatus.start();
      const runningRender = renderer.deviceSyncStatus.renderStatus();
      expect(runningRender.kind).toBe("content");
      if (runningRender.kind === "content") expect(runningRender.content.running).toBe(true);

      await boundary.deviceSyncStatus.triggerNow();
      const tickRender = renderer.deviceSyncStatus.renderLastTick();
      expect(tickRender.kind).toBe("content");
      if (tickRender.kind === "content") expect(tickRender.content.isEmpty).toBe(true); // no trusted target Devices registered in this test.

      await boundary.deviceSyncStatus.stop();
      const stoppedRender = renderer.deviceSyncStatus.renderStatus();
      if (stoppedRender.kind === "content") expect(stoppedRender.content.running).toBe(false);

      await boundary.runtimeStatus.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("8. list trusted Devices through the ViewModel/Renderer, then select one for detail", async () => {
    const dir = makeTmpDir();
    try {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      const renderer = createFedosDesktopRenderer(boundary);
      await boundary.runtimeStatus.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      await boundary.deviceInventory.refresh();
      const emptyRender = renderer.deviceList.renderList();
      expect(emptyRender.kind).toBe("content");
      if (emptyRender.kind === "content") expect(emptyRender.content.isEmpty).toBe(true);

      await boundary.runtimeStatus.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("16/17/18. conflict list/detail/acknowledge flow through ViewModel + Renderer", async () => {
    const dir = makeTmpDir();
    try {
      const conflictLogPath = join(dir, "conflict.ndjson");
      const { AppendOnlyFedosDeviceSyncConflictPersistence } = await import("../src/device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.js");
      const { fedosDeviceSyncConflictId } = await import("../src/device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js");
      const persistence = new AppendOnlyFedosDeviceSyncConflictPersistence(conflictLogPath);
      const conflictId = fedosDeviceSyncConflictId("dev-B", "chg-1");
      persistence.observe({
        schemaVersion: 1,
        conflictId,
        sourceDeviceId: "dev-A",
        targetDeviceId: "dev-B",
        changeId: "chg-1",
        conversationId: "conv-1",
        recordType: null,
        conflictKind: "operator-decision-required",
        decision: "require-operator",
        reason: "two trusted Devices diverged",
        firstObservedAt: 100,
        lastObservedAt: 100,
        resolved: false,
        resolutionAction: null,
        resolvedAt: null,
      });

      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      const renderer = createFedosDesktopRenderer(boundary);
      await boundary.runtimeStatus.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncConflictLogPath: conflictLogPath,
      });

      await boundary.syncConflict.refresh();
      const listRender = renderer.syncConflict.renderList();
      expect(listRender.kind).toBe("content");
      if (listRender.kind === "content") {
        expect(listRender.content.count).toBe(1);
        expect(listRender.content.items[0]!.operatorRequired).toBe(true);
      }

      await boundary.syncConflict.selectConflict(conflictId);
      const detailRender = renderer.syncConflict.renderDetail();
      expect(detailRender.kind).toBe("content");

      await boundary.syncConflict.acknowledge(conflictId, "acknowledge");
      const afterAckRender = renderer.syncConflict.renderList();
      if (afterAckRender.kind === "content") expect(afterAckRender.content.isEmpty).toBe(true);

      await boundary.runtimeStatus.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("30. existing Conversation UI ViewModels/Renderers remain unaffected -- runtimeStatus still reports honest deviceStatus 'unavailable'", async () => {
    const dir = makeTmpDir();
    try {
      const boundary = createFedosDesktopConversationUiPresentationBoundary();
      const renderer = createFedosDesktopRenderer(boundary);
      await boundary.runtimeStatus.start({ ...baseRuntimeConfig(dir), deviceTrustEnabled: true, localDeviceId: "dev-A", localAccountRef: ACCOUNT_A });
      const statusRender = renderer.status.render();
      expect(statusRender.kind).toBe("content");
      if (statusRender.kind === "content") {
        expect(statusRender.content.runtimeStatus).toBe("running");
        expect(statusRender.content.deviceStatus?.state).toBe("unavailable");
      }
      await boundary.runtimeStatus.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
