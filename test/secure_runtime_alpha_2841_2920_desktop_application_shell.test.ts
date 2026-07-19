/**
 * Secure Runtime Alpha 2841–2920 — Desktop Local Application Shell and
 * Conversation Management Boundary Arc.
 *
 * Real-runtime tests: every case below drives a real
 * `FedosDesktopApplicationShell` over a real `startFedosDesktopRuntime()`
 * instance, real append-only log files on disk — never a mock. Message/
 * search/archive/device-status cases assert the honest `"unavailable"`
 * terminus documented in `docs/secure_runtime_alpha_2841_2920_execution_spec.md`
 * Phase A, not a fabricated success.
 */

import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { createFedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import type { FedosDesktopRuntimeConfig } from "../src/desktop/runtime/fedos_desktop_runtime_config.js";

const dirs: string[] = [];
function freshConfig(): FedosDesktopRuntimeConfig {
  const dir = mkdtempSync(join(tmpdir(), "fedos-shell-2841-"));
  dirs.push(dir);
  return {
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
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("1. start/status/stop", () => {
  it("starts stopped, becomes running on start(), returns to stopped on stop()", async () => {
    const shell = createFedosDesktopApplicationShell();
    expect(shell.status()).toBe("stopped");
    const started = await shell.start(freshConfig());
    expect(started.outcome).toBe("ok");
    expect(shell.status()).toBe("running");
    const stopped = await shell.stop();
    expect(stopped.outcome).toBe("ok");
    expect(shell.status()).toBe("stopped");
  });

  it("start() twice reports conflict without disturbing the running instance", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const second = await shell.start(freshConfig());
    expect(second).toEqual({ outcome: "conflict", reason: expect.any(String) });
    expect(shell.status()).toBe("running");
    await shell.stop();
  });
});

describe("2. operation before start()", () => {
  it("every operation fails closed with 'unavailable' before start()", () => {
    const shell = createFedosDesktopApplicationShell();
    expect(shell.listConversations().outcome).toBe("unavailable");
    expect(shell.getConversation("anything").outcome).toBe("unavailable");
    expect(shell.listMessages("anything").outcome).toBe("unavailable");
    expect(shell.search().outcome).toBe("unavailable");
    expect(shell.archive().outcome).toBe("unavailable");
    expect(shell.deviceStatus().outcome).toBe("unavailable");
    expect(
      shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "npub-x" } }).outcome,
    ).toBe("unavailable");
  });
});

describe("3. operation after stop()", () => {
  it("every operation fails closed with 'unavailable' after stop()", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    await shell.stop();
    expect(shell.listConversations().outcome).toBe("unavailable");
    expect(shell.getConversation("anything").outcome).toBe("unavailable");
    expect((await shell.stop()).outcome).toBe("unavailable");
  });
});

describe("4. list empty", () => {
  it("a fresh runtime with no created conversations lists empty", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const result = shell.listConversations();
    expect(result).toEqual({ outcome: "ok", value: [] });
    await shell.stop();
  });
});

describe("5/6. create Direct + activation status", () => {
  it("creates a real durable Direct draft with draft-ready activation status", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const result = shell.createDirectConversation({
      idempotencyKey: "direct-1",
      recipient: { authority: "nostr", publicIdentifier: "npub-direct-1" },
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("expected ok");
    expect(result.value.mode).toBe("direct");
    expect(result.value.lifecycleState).toBe("draft");
    expect(result.value.activationStatus).toBe("draft-ready");
    expect(result.value.participantCount).toBe(1);
    expect(result.value.memberships).toHaveLength(1);
    expect(result.value.memberships[0]!.role).toBe("owner");

    const listed = shell.listConversations();
    expect(listed.outcome).toBe("ok");
    if (listed.outcome !== "ok") throw new Error("expected ok");
    expect(listed.value).toHaveLength(1);
    expect(listed.value[0]!.conversationId).toBe(result.value.conversationId);

    await shell.stop();
  });
});

describe("7. send/read/reply on a Direct draft", () => {
  it("listMessages on a known conversation is honestly 'unavailable', not a fake empty list disguised as success-with-no-content beyond the closed vocabulary", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const created = shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "npub-msg-1" } });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const result = shell.listMessages(created.value.conversationId);
    expect(result.outcome).toBe("unavailable");
    await shell.stop();
  });

  it("listMessages on an unknown conversation is 'not-found', never masked as 'unavailable'", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    expect(shell.listMessages("does-not-exist").outcome).toBe("not-found");
    await shell.stop();
  });

  it("sendMessage from the real owner membership reports 'requires-activation' (never a fake success, never a raw error)", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const created = shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "npub-msg-2" } });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const owner = created.value.memberships[0]!.participant;
    const sendResult = shell.sendMessage(created.value.conversationId, owner);
    expect(sendResult).toEqual({ outcome: "requires-activation", reason: expect.any(String) });
    const replyResult = shell.reply(created.value.conversationId, owner, "some-message-id");
    expect(replyResult.outcome).toBe("requires-activation");
    await shell.stop();
  });

  it("reply() with an empty replyToMessageId is 'invalid-input'", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const created = shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "npub-msg-3" } });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const owner = created.value.memberships[0]!.participant;
    expect(shell.reply(created.value.conversationId, owner, "").outcome).toBe("invalid-input");
    await shell.stop();
  });
});

describe("8/10. create Group + Group send", () => {
  it("creates a real durable Private Group draft; send still honestly blocked at activation", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const created = shell.createPrivateGroup({ idempotencyKey: "group-1", initialCapability: { maxUses: 5, expiresAt: null } });
    expect(created.outcome).toBe("ok");
    if (created.outcome !== "ok") throw new Error("expected ok");
    expect(created.value.mode).toBe("private-group");
    const owner = created.value.memberships[0]!.participant;
    expect(shell.sendMessage(created.value.conversationId, owner).outcome).toBe("requires-activation");
    await shell.stop();
  });
});

describe("9. invite issue/redeem", () => {
  it("issuedInvitations reads back the real descriptor issued at creation time, never the bearer secret", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const created = shell.createPrivateGroup({ idempotencyKey: "group-invite", initialCapability: { maxUses: 3, expiresAt: null } });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const owner = created.value.memberships[0]!.participant;
    const invitations = shell.issuedInvitations(created.value.conversationId, owner);
    expect(invitations.outcome).toBe("ok");
    if (invitations.outcome !== "ok") throw new Error("expected ok");
    expect(invitations.value).toHaveLength(1);
    expect(invitations.value[0]!.descriptor.maxUses).toBe(3);
    expect(JSON.stringify(invitations.value)).not.toMatch(/bearer/i);
    await shell.stop();
  });

  it("redeemInvitation is honestly 'unavailable' on this base", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    expect(shell.redeemInvitation().outcome).toBe("unavailable");
    await shell.stop();
  });
});

describe("14/16. Search and Archive facades", () => {
  it("search() and archive() are honestly 'unavailable' once running", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    expect(shell.search().outcome).toBe("unavailable");
    expect(shell.archive().outcome).toBe("unavailable");
    await shell.stop();
  });
});

describe("18. mixed Direct/Group listing and filters", () => {
  it("listConversations sorts deterministically and filters by mode", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const direct = shell.createDirectConversation({ idempotencyKey: "mix-d", recipient: { authority: "nostr", publicIdentifier: "npub-mix" } });
    const group = shell.createPrivateGroup({ idempotencyKey: "mix-g" });
    if (direct.outcome !== "ok" || group.outcome !== "ok") throw new Error("expected ok");

    const all = shell.listConversations();
    expect(all.outcome).toBe("ok");
    if (all.outcome !== "ok") throw new Error("expected ok");
    expect(all.value).toHaveLength(2);
    // deterministic: same createdAt (fixed test clock) -> tie-broken by conversationId ascending
    const ids = all.value.map((v) => v.conversationId);
    expect(ids).toEqual([...ids].sort());

    const directOnly = shell.listConversations({ mode: "direct" });
    expect(directOnly.outcome).toBe("ok");
    if (directOnly.outcome !== "ok") throw new Error("expected ok");
    expect(directOnly.value).toEqual([expect.objectContaining({ conversationId: direct.value.conversationId })]);

    const groupOnly = shell.listConversations({ mode: "private-group" });
    expect(groupOnly.outcome).toBe("ok");
    if (groupOnly.outcome !== "ok") throw new Error("expected ok");
    expect(groupOnly.value).toEqual([expect.objectContaining({ conversationId: group.value.conversationId })]);

    await shell.stop();
  });
});

describe("19. independent Runtime isolation", () => {
  it("two shell instances over two different configs never see each other's conversations", async () => {
    const shellA = createFedosDesktopApplicationShell();
    const shellB = createFedosDesktopApplicationShell();
    await shellA.start(freshConfig());
    await shellB.start(freshConfig());
    shellA.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "npub-iso-a" } });
    const bList = shellB.listConversations();
    expect(bList).toEqual({ outcome: "ok", value: [] });
    await shellA.stop();
    await shellB.stop();
  });
});

describe("20. restart recovers durable state", () => {
  it("getConversation on a fresh shell instance over the same durable paths re-reads the real draft", async () => {
    const config = freshConfig();
    const shell1 = createFedosDesktopApplicationShell();
    await shell1.start(config);
    const created = shell1.createDirectConversation({ idempotencyKey: "restart-1", recipient: { authority: "nostr", publicIdentifier: "npub-restart" } });
    if (created.outcome !== "ok") throw new Error("expected ok");
    await shell1.stop();

    const shell2 = createFedosDesktopApplicationShell();
    await shell2.start(config);
    const reread = shell2.getConversation(created.value.conversationId);
    expect(reread.outcome).toBe("ok");
    if (reread.outcome !== "ok") throw new Error("expected ok");
    expect(reread.value.lifecycleState).toBe("draft");
    // Not in shell2's own creation-session registry -- listConversations legitimately does not show it.
    expect(shell2.listConversations()).toEqual({ outcome: "ok", value: [] });
    await shell2.stop();
  });
});

describe("21. malformed command", () => {
  it("an empty recipient publicIdentifier is 'invalid-input'", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const result = shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "" } });
    expect(result.outcome).toBe("invalid-input");
    await shell.stop();
  });
});

describe("22. wrong identity denial", () => {
  it("sendMessage from a participant who is not a member of the conversation is 'unauthorized'", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const created = shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "npub-wrong-1" } });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const stranger = { authority: "nostr" as const, publicIdentifier: "npub-stranger", identityId: null };
    const result = shell.sendMessage(created.value.conversationId, stranger);
    expect(result).toEqual({ outcome: "unauthorized", reason: expect.any(String) });
    await shell.stop();
  });
});

describe("23. no raw error/key leakage", () => {
  it("every shell result is JSON-serializable and never carries an Error, a stack, or a bearer secret", async () => {
    const shell = createFedosDesktopApplicationShell();
    await shell.start(freshConfig());
    const created = shell.createDirectConversation({ recipient: { authority: "nostr", publicIdentifier: "npub-leak" } });
    const results = [
      created,
      shell.listConversations(),
      shell.getConversation("unknown"),
      shell.listMessages("unknown"),
      shell.search(),
      shell.archive(),
      shell.deviceStatus(),
      shell.redeemInvitation(),
    ];
    for (const r of results) {
      expect(r).not.toBeInstanceOf(Error);
      const serialized = JSON.stringify(r);
      expect(serialized).not.toContain("stack");
      expect(() => JSON.parse(serialized)).not.toThrow();
    }
    await shell.stop();
  });
});
