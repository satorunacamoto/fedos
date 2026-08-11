/**
 * Secure Runtime Alpha 921–929 — Phase D: Conversation Runtime API and
 * read facade, Local Runtime ownership (conversationRuntime() available
 * while running, denied after stop), full end-to-end draft with real
 * durable files + restart recovery, public-runtime isolation, and the
 * security guards (no bearer in any durable log; no active state).
 */

import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";

function baseConfig(): FedosDesktopRuntimeConfig & { readonly dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "fedos-pcc-rt-"));
  return {
    dir,
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    conversationConstructionCoordinationLogPath: join(dir, "coordination.log"),
    clock: () => 1_700_002_000,
  };
}

describe("Alpha 922/923 — Conversation Runtime is owned by the Local Runtime", () => {
  it("exposes exactly one conversationRuntime() while running and denies it after stop", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    const cr1 = runtime.conversationRuntime();
    const cr2 = runtime.conversationRuntime();
    expect(cr1).toBe(cr2); // same instance every call
    await runtime.stop();
    expect(() => runtime.conversationRuntime()).toThrow(/inaccessible after stop/);
  });
});

describe("Alpha 929 — full end-to-end private-group draft with restart recovery", () => {
  it("creates a durable draft, blocks activation on encryption, recovers after restart, no active state/network", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();

    const result = cr.createPrivateGroupDraft({ idempotencyKey: "e2e-pg", initialCapability: { maxUses: 2, expiresAt: null } });
    expect(result.outcome).toBe("draft-created");
    if (result.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = result.draft.id;
    expect(result.draft.lifecycleState).toBe("draft");
    expect(result.readiness.overall).toBe("draft-ready"); // activation blocked on encryption
    expect(result.readiness.axes.find((a) => a.axis === "encryption")!.state).toBe("unavailable");
    expect(result.ownerMembership.role).toBe("owner");
    const bearer = result.capability!.bearerSecret as string;

    await runtime.stop();

    // Fresh Local Runtime over the SAME durable files — hydrates the draft.
    const restarted = await startFedosDesktopRuntime(config);
    const cr2 = restarted.conversationRuntime();
    const view = cr2.findConversation(id);
    expect(view).not.toBeNull();
    expect(view!.lifecycleState).toBe("draft");
    expect(cr2.readinessForConversation(id)!.overall).toBe("draft-ready");
    expect(cr2.listMemberships(id)).toHaveLength(1);
    expect(cr2.constructionStatus(id)).toBe("draft-completed");
    await restarted.stop();

    // Alpha 928 — the bearer secret is NEVER written to any durable log.
    for (const file of [
      config.conversationDraftLogPath!,
      config.conversationMembershipLogPath!,
      config.conversationCapabilityLogPath!,
      config.conversationConstructionCoordinationLogPath!,
    ]) {
      expect(readFileSync(file, "utf8") as string).not.toContain(bearer);
    }
  });

  it("recovers a direct draft end-to-end", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    const created = runtime.conversationRuntime().createDirectDraft({ idempotencyKey: "e2e-d", recipient: { authority: "nostr", publicIdentifier: "npub-e2e" } });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    await runtime.stop();

    const restarted = await startFedosDesktopRuntime(config);
    const view = restarted.conversationRuntime().findConversation(id);
    expect(view!.mode).toBe("direct");
    expect(view!.lifecycleState).toBe("draft");
    await restarted.stop();
  });
});

describe("Alpha 927 — public runtime isolation", () => {
  it("a private draft never appears through the public Board runtime, and the Board runtime still works", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    const created = runtime.conversationRuntime().createPrivateGroupDraft({ idempotencyKey: "iso-1" });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");

    // The public Board runtime is a separate store — it never sees the private draft.
    const boardRuntime = runtime.boardRuntime();
    expect(boardRuntime.findConversation(created.draft.id)).toBeNull();
    expect(runtime.host.state()).toBe("ready");
    await runtime.stop();
  });
});

describe("Alpha 926 — stop lifecycle", () => {
  it("throws on a second stop and both runtime handles are inaccessible after stop", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    await runtime.stop();
    await expect(runtime.stop()).rejects.toThrow(/may only be called once/);
    expect(() => runtime.boardRuntime()).toThrow();
    expect(() => runtime.conversationRuntime()).toThrow();
  });
});
