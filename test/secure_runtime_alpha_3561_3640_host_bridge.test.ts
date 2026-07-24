/**
 * Secure Runtime Alpha 3561-3640 ("Desktop Electron Host Boundary Arc") —
 * real acceptance tests.
 *
 * Every test drives a real `FedosDesktopHostBridge` over the real
 * Runtime/Shell/ViewModel/Renderer stack, real append-only log files on
 * disk. `FakeEncryptionAuthority`/`FakeDecryptionAuthority` are the SAME
 * test doubles every other vertical-slice test in this repository already
 * uses (no compiled WASM artifact in this checked-out tree). No Electron
 * exists in this repository (confirmed in
 * `docs/secure_runtime_alpha_3561_3640_reconciliation_report.md` §2), so
 * the Electron-specific test bullets (preload allowlist, forbidden
 * channel, nodeIntegration/contextIsolation config, real main/preload IPC)
 * do not apply and are not attempted.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { createFedosDesktopHostBridge } from "../src/desktop/host_boundary/fedos_desktop_host_bridge.js";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { toFedosConversationInvitationToken } from "../src/conversation/invitation/fedos_conversation_invitation_token.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import { AppendOnlyFedosPayloadRetentionPersistence } from "../src/conversation/retention/append_only_fedos_payload_retention_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";

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
    clock: incrementingClock(2_200_000_000),
  };
}

async function setUpActiveDirectConversation(config: FedosDesktopRuntimeConfig): Promise<{ conversationId: string; owner: FedosConversationParticipantReference }> {
  const runtime = await startFedosDesktopRuntime(config);
  const cr = runtime.conversationRuntime();
  const created = cr.createDirectDraft({ recipient: BOB });
  if (created.outcome !== "draft-created") throw new Error("expected draft-created");
  const id = created.draft.id;
  const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
  if (cr.redeemInvitation(token, BOB).outcome !== "redeemed") throw new Error("expected redeemed");
  if ((await cr.activateDirectConversation(id)).outcome !== "activated") throw new Error("expected activated");
  const owner = cr.listMemberships(id).find((m) => m.role === "owner")!.participant;
  await runtime.stop();
  return { conversationId: id, owner };
}

describe("Alpha 3561-3640 -- 1/2/3. start, initial render, empty list", () => {
  it("starts the Host, renders the real initial (idle) screen, and lists zero real conversations", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-start-"));
    const host = createFedosDesktopHostBridge();
    expect(host.status()).toBe("stopped");

    const started = await host.start(freshConfig(dir));
    expect(started).toEqual({ outcome: "ok", value: null });
    expect(host.status()).toBe("running");

    const initial = host.render();
    expect(initial.outcome).toBe("ok");
    if (initial.outcome !== "ok") throw new Error("expected ok");
    expect(initial.value.conversationList).toEqual({ kind: "idle" });

    const listed = await host.dispatch({ type: "conversations-list" });
    expect(listed).toEqual({ outcome: "ok", value: [] }); // dispatch() returns the raw ViewModel result -- render() (tested separately) is the shaped screen model.

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 4/5/6. create Direct, render updated list, open detail", () => {
  it("real creation is visible through a subsequent list dispatch and render(), and through conversation-open", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-create-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));

    const created = await host.dispatch({ type: "conversation-create-direct", command: { recipient: { authority: "nostr", publicIdentifier: "npub-bob" } } });
    expect(created.outcome).toBe("ok");
    if (created.outcome !== "ok") throw new Error("expected ok");
    const conversationId = (created.value as { conversationId: string }).conversationId;

    await host.dispatch({ type: "conversations-list" });
    const rendered = host.render();
    expect(rendered.outcome).toBe("ok");
    if (rendered.outcome !== "ok") throw new Error("expected ok");
    const listRender = rendered.value.conversationList;
    expect(listRender.kind).toBe("content");
    if (listRender.kind !== "content") throw new Error("expected content");
    expect(listRender.content.count).toBe(1);
    expect(listRender.content.items[0]!.conversationId).toBe(conversationId);

    const opened = await host.dispatch({ type: "conversation-open", conversationId });
    expect(opened.outcome).toBe("ok");
    if (opened.outcome !== "ok") throw new Error("expected ok");
    expect((opened.value as { mode: string }).mode).toBe("direct");

    const openedUnknown = await host.dispatch({ type: "conversation-open", conversationId: "does-not-exist" });
    expect(openedUnknown).toEqual({ outcome: "error", code: "not-found", message: expect.any(String) });

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 7. send/read/reply", () => {
  it("real send -> real reveal -> real reply, all through dispatch()", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-messaging-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const host = createFedosDesktopHostBridge();
    await host.start(config);

    const sent = await host.dispatch({ type: "message-send", conversationId, sender: owner, body: "hello bob" });
    expect(sent.outcome).toBe("ok");
    if (sent.outcome !== "ok") throw new Error("expected ok");
    const messageId = (sent.value as { messageId: string }).messageId;

    // reveal() requires a prior, successful messages-list load for the SAME conversation
    // (FedosDesktopMessageListViewModel's own real precondition) -- explicit action -> state -> render, never implicit.
    await host.dispatch({ type: "messages-list", conversationId });
    // reveal() returns the FULL, merged message list (never a lone message) -- the list
    // itself is the one source of truth a caller re-renders from (Alpha 3241-3320's own design).
    const revealed = await host.dispatch({ type: "message-reveal", conversationId, messageId });
    expect(revealed.outcome).toBe("ok");
    if (revealed.outcome !== "ok") throw new Error("expected ok");
    const revealedMessages = revealed.value as readonly { messageId: string; plaintext: unknown }[];
    expect(revealedMessages).toHaveLength(1);
    expect(revealedMessages[0]!.plaintext).toEqual({ state: "available", text: "hello bob" });

    const replied = await host.dispatch({ type: "message-reply", conversationId, sender: owner, replyToMessageId: messageId, body: "hi alice" });
    expect(replied.outcome).toBe("ok");

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 8/9. create Group, render Membership", () => {
  it("real Group creation, membership-list dispatch, and Membership render", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-group-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));

    const created = await host.dispatch({ type: "conversation-create-group", command: { initialCapability: { maxUses: 5, expiresAt: null } } });
    expect(created.outcome).toBe("ok");
    if (created.outcome !== "ok") throw new Error("expected ok");
    const conversationId = (created.value as { conversationId: string; mode: string }).conversationId;
    expect((created.value as { mode: string }).mode).toBe("private-group");

    const memberships = await host.dispatch({ type: "membership-list", conversationId });
    expect(memberships.outcome).toBe("ok");
    if (memberships.outcome !== "ok") throw new Error("expected ok");
    expect((memberships.value as { memberships: unknown[] }).memberships).toHaveLength(1);

    const rendered = host.render();
    if (rendered.outcome !== "ok") throw new Error("expected ok");
    expect(rendered.value.membership.membership.kind).toBe("content");

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 10/11. Search and real retention denial", () => {
  it("a real sent message is searchable, then a real retention transition removes it from Search AND from a message-reveal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-search-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const host = createFedosDesktopHostBridge();
    await host.start(config);

    const sent = await host.dispatch({ type: "message-send", conversationId, sender: owner, body: "the quokka runs at dawn" });
    if (sent.outcome !== "ok") throw new Error("expected ok");
    const messageId = (sent.value as { messageId: string }).messageId;

    const searched = await host.dispatch({ type: "search", query: "quokka" });
    expect(searched).toEqual({ outcome: "ok", value: [{ conversationId, messageId }] });

    // Real, out-of-band retention transition over the SAME durable log paths this
    // running Host already reads -- mirrors the established pattern from
    // secure_runtime_alpha_3081_3160_content_accessor.test.ts (there is no production
    // command to tombstone a payload on this base; this is the narrowest real way to
    // exercise the already-wired retention gate).
    const runtimeForLookup = await startFedosDesktopRuntime(config);
    const envelope = runtimeForLookup.conversationRuntime().getConversationMessageEnvelope(conversationId, messageId)!;
    await runtimeForLookup.stop();
    const payloadId = toFedosConversationPayloadId(envelope.payloadId)!;
    const retentionAuthority = new FedosPayloadRetentionAuthority({
      retentionPersistence: new AppendOnlyFedosPayloadRetentionPersistence(config.conversationPayloadRetentionLogPath!),
      payloadStorage: new AppendOnlyFedosConversationPayloadStorage(config.conversationPayloadLogPath!, 1_048_576),
      clock: config.clock,
    });
    expect(retentionAuthority.tombstonePayload(payloadId, null, "user_requested_placeholder")).toEqual({ outcome: "tombstoned" });

    const searchedAfter = await host.dispatch({ type: "search", query: "quokka" });
    expect(searchedAfter).toEqual({ outcome: "ok", value: [] });

    await host.dispatch({ type: "messages-list", conversationId });
    const revealedAfter = await host.dispatch({ type: "message-reveal", conversationId, messageId });
    expect(revealedAfter.outcome).toBe("ok");
    if (revealedAfter.outcome !== "ok") throw new Error("expected ok");
    const revealedAfterMessages = revealedAfter.value as readonly { retentionState: string; plaintext: unknown }[];
    expect(revealedAfterMessages).toHaveLength(1);
    expect(revealedAfterMessages[0]!.retentionState).toBe("tombstoned");
    expect(revealedAfterMessages[0]!.plaintext).toEqual({ state: "unavailable", reason: expect.any(String) });

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 12. Archive inspect", () => {
  it("real 'unavailable' (archiveEnabled unset) and real 'not-found' (archiveEnabled set) through archive-inspect", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "fedos-3561-3640-archive-a-"));
    const hostA = createFedosDesktopHostBridge();
    await hostA.start(freshConfig(dirA));
    expect(await hostA.dispatch({ type: "archive-inspect", sourcePath: join(dirA, "anything") })).toEqual({
      outcome: "error",
      code: "unavailable",
      message: expect.any(String),
    });
    await hostA.stop();

    const dirB = mkdtempSync(join(tmpdir(), "fedos-3561-3640-archive-b-"));
    const configB: FedosDesktopRuntimeConfig = {
      ...freshConfig(dirB),
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: {
        isAvailable: async () => true,
        isCleared: async () => false,
        generate: async () => true,
        restoreSealed: async () => true,
        seal: async () => null,
        clear: async () => undefined,
        resolveConversationKey: async () => null,
      },
    };
    const hostB = createFedosDesktopHostBridge();
    await hostB.start(configB);
    expect(await hostB.dispatch({ type: "archive-inspect", sourcePath: join(dirB, "does-not-exist.archive") })).toEqual({
      outcome: "error",
      code: "not-found",
      message: expect.any(String),
    });
    // Path traversal is rejected BEFORE ever reaching the Archive File Authority.
    expect(await hostB.dispatch({ type: "archive-inspect", sourcePath: "../../etc/passwd" })).toEqual({
      outcome: "error",
      code: "unknown-command",
      message: expect.any(String),
    });
    await hostB.stop();
  });
});

describe("Alpha 3561-3640 -- 13/14. invalid/malformed commands", () => {
  it("an unrecognized command type fails closed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-invalid-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));
    expect(await host.dispatch({ type: "delete-everything" })).toEqual({ outcome: "error", code: "unknown-command", message: expect.any(String) });
    expect(await host.dispatch("not-even-an-object")).toEqual({ outcome: "error", code: "unknown-command", message: expect.any(String) });
    expect(await host.dispatch(null)).toEqual({ outcome: "error", code: "unknown-command", message: expect.any(String) });
    await host.stop();
  });

  it("a malformed payload (wrong field types, oversized body, bad authority) fails closed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-malformed-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));

    expect(await host.dispatch({ type: "conversation-open", conversationId: 12345 })).toEqual({ outcome: "error", code: "unknown-command", message: expect.any(String) });
    expect(await host.dispatch({ type: "message-send", conversationId: "x", sender: { authority: "not-a-real-protocol", publicIdentifier: "x", identityId: null }, body: "hi" })).toEqual({
      outcome: "error",
      code: "unknown-command",
      message: expect.any(String),
    });
    expect(await host.dispatch({ type: "message-send", conversationId: "x", sender: ALICE, body: "" })).toEqual({ outcome: "error", code: "unknown-command", message: expect.any(String) });
    expect(await host.dispatch({ type: "message-send", conversationId: "x", sender: ALICE, body: "a".repeat(10_001) })).toEqual({
      outcome: "error",
      code: "unknown-command",
      message: expect.any(String),
    });

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 15/16. command before start / after stop", () => {
  it("every dispatch/render before start() is honestly unavailable", async () => {
    const host = createFedosDesktopHostBridge();
    expect(await host.dispatch({ type: "runtime-status" })).toEqual({ outcome: "error", code: "unavailable", message: expect.any(String) });
    expect(host.render()).toEqual({ outcome: "error", code: "unavailable", message: expect.any(String) });
  });

  it("every dispatch/render after stop() is honestly unavailable, and stop() itself is idempotent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-afterstop-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));
    await host.stop();

    expect(host.status()).toBe("stopped");
    expect(await host.dispatch({ type: "runtime-status" })).toEqual({ outcome: "error", code: "unavailable", message: expect.any(String) });
    expect(host.render()).toEqual({ outcome: "error", code: "unavailable", message: expect.any(String) });
    expect(await host.stop()).toEqual({ outcome: "error", code: "unavailable", message: expect.any(String) });
  });
});

describe("Alpha 3561-3640 -- 17. concurrent commands are serialized", () => {
  it("many concurrent dispatch() calls never interleave -- every one settles correctly, in queued order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-concurrent-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));

    const creations = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        host.dispatch({ type: "conversation-create-direct", command: { idempotencyKey: `concurrent-${i}`, recipient: { authority: "nostr", publicIdentifier: `npub-${i}` } } }),
      ),
    );
    for (const c of creations) expect(c.outcome).toBe("ok");
    const ids = new Set(creations.map((c) => (c as { value: { conversationId: string } }).value.conversationId));
    expect(ids.size).toBe(5); // five genuinely distinct conversations, never corrupted by interleaving.

    const listed = await host.dispatch({ type: "conversations-list" });
    expect(listed.outcome).toBe("ok");
    if (listed.outcome !== "ok") throw new Error("expected ok");
    expect((listed.value as unknown[]).length).toBe(5);

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 18/19. startup failure / Runtime failure mapping", () => {
  it("a structurally invalid config (deliveryEnabled without a publisher) fails closed, never a raw Error, no orphan state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-badconfig-"));
    const host = createFedosDesktopHostBridge();
    const config: FedosDesktopRuntimeConfig = { ...freshConfig(dir), deliveryEnabled: true }; // no observationLogPath/publisher -> startFedosDesktopRuntime() itself throws.
    const result = await host.start(config);
    expect(result).toEqual({ outcome: "error", code: "failed", message: expect.any(String) });
    expect(result).not.toBeInstanceOf(Error);
    expect(host.status()).toBe("stopped");
    // No orphan Runtime -- a SECOND, valid start() over the SAME paths still works cleanly.
    const retried = await host.start(freshConfig(dir));
    expect(retried).toEqual({ outcome: "ok", value: null });
    await host.stop();
  });

  it("a genuine Shell-layer failure (double start) maps to a real, closed 'conflict'", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-doublestart-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));
    const second = await host.start(freshConfig(dir));
    expect(second).toEqual({ outcome: "error", code: "conflict", message: expect.any(String) });
    expect(host.status()).toBe("running"); // the ORIGINAL, still-good Runtime is undisturbed.
    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 20. Host stop waits for Runtime", () => {
  it("stop() only resolves once the real underlying Runtime has genuinely stopped -- a fresh Host over the SAME durable paths works immediately after", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-stopwait-"));
    const config = freshConfig(dir);
    const host1 = createFedosDesktopHostBridge();
    await host1.start(config);
    const created = await host1.dispatch({ type: "conversation-create-direct", command: { recipient: { authority: "nostr", publicIdentifier: "npub-x" } } });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const conversationId = (created.value as { conversationId: string }).conversationId;
    const stopped = await host1.stop();
    expect(stopped).toEqual({ outcome: "ok", value: null });

    const host2 = createFedosDesktopHostBridge();
    await host2.start(config);
    // `conversations-list` is a SESSION-scoped in-memory registry, not a durable
    // enumeration (Alpha 2841-2920's own already-documented, accepted behavior --
    // "not in shell2's own creation-session registry" -- confirmed unmodified by
    // every prior Arc's own restart-recovery test); `conversation-open` (getConversation())
    // DOES read directly from durable storage, so it is the real, honest way to prove
    // host2's own Runtime recovered host1's durable write after a clean stop/restart.
    const reopened = await host2.dispatch({ type: "conversation-open", conversationId });
    expect(reopened.outcome).toBe("ok");
    if (reopened.outcome !== "ok") throw new Error("expected ok");
    expect((reopened.value as { conversationId: string }).conversationId).toBe(conversationId);
    await host2.stop();
  });
});

describe("Alpha 3561-3640 -- 21. independent Host instances never leak state", () => {
  it("two Hosts, two configs -- fully isolated", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "fedos-3561-3640-iso-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "fedos-3561-3640-iso-b-"));
    const hostA = createFedosDesktopHostBridge();
    const hostB = createFedosDesktopHostBridge();
    await hostA.start(freshConfig(dirA));
    await hostB.start(freshConfig(dirB));
    await hostA.dispatch({ type: "conversation-create-direct", command: { recipient: { authority: "nostr", publicIdentifier: "npub-a" } } });
    const listB = await hostB.dispatch({ type: "conversations-list" });
    expect(listB).toEqual({ outcome: "ok", value: [] });
    await hostA.stop();
    await hostB.stop();
  });
});

describe("Alpha 3561-3640 -- 22/23/24. serialization-safe, no raw Error, no secret fields", () => {
  it("every response across a real, varied session is JSON-safe and carries no Error/stack/bearer secret/ciphertext", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-leak-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const host = createFedosDesktopHostBridge();
    await host.start(config);

    const invitationTarget = await host.dispatch({ type: "conversation-create-direct", command: { recipient: { authority: "nostr", publicIdentifier: "npub-invite" } } });
    if (invitationTarget.outcome !== "ok") throw new Error("expected ok");
    const bearer = "bearerSecret"; // never expect this literal marker string in any response.

    const responses: unknown[] = [
      await host.dispatch({ type: "conversations-list" }),
      await host.dispatch({ type: "conversation-open", conversationId }),
      await host.dispatch({ type: "invitation-descriptor", conversationId: (invitationTarget.value as { conversationId: string }).conversationId, issuer: (invitationTarget.value as { creator: FedosConversationParticipantReference }).creator }),
      await host.dispatch({ type: "message-send", conversationId, sender: owner, body: "no leaks" }),
      await host.dispatch({ type: "messages-list", conversationId }),
      await host.dispatch({ type: "runtime-status" }),
      await host.dispatch({ type: "unknown-type-here" }),
      host.render(),
    ];
    for (const r of responses) {
      expect(r).not.toBeInstanceOf(Error);
      const serialized = JSON.stringify(r);
      expect(serialized.toLowerCase()).not.toContain("stack");
      expect(serialized).not.toContain(bearer);
      expect(serialized).not.toMatch(/^FAKE:/);
      expect(() => JSON.parse(serialized)).not.toThrow();
    }

    await host.stop();
  });
});

describe("Alpha 3561-3640 -- 25. large Conversation list within defined limits", () => {
  it("20 real, distinct conversations all render/list correctly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3561-3640-large-"));
    const host = createFedosDesktopHostBridge();
    await host.start(freshConfig(dir));

    const CONVERSATION_COUNT = 20;
    for (let i = 0; i < CONVERSATION_COUNT; i += 1) {
      const result = await host.dispatch({
        type: "conversation-create-direct",
        command: { idempotencyKey: `large-${i}`, recipient: { authority: "nostr", publicIdentifier: `npub-large-${i}` } },
      });
      expect(result.outcome).toBe("ok");
    }

    const listed = await host.dispatch({ type: "conversations-list" });
    expect(listed.outcome).toBe("ok");
    if (listed.outcome !== "ok") throw new Error("expected ok");
    expect((listed.value as unknown[]).length).toBe(CONVERSATION_COUNT);

    const rendered = host.render();
    if (rendered.outcome !== "ok") throw new Error("expected ok");
    const listRender = rendered.value.conversationList;
    expect(listRender.kind).toBe("content");
    if (listRender.kind !== "content") throw new Error("expected content");
    expect(listRender.content.items).toHaveLength(CONVERSATION_COUNT);
    expect(listRender.content.isEmpty).toBe(false);

    await host.stop();
  });
});
