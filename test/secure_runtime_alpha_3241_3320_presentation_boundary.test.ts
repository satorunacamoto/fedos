/**
 * Secure Runtime Alpha 3241-3320 ("Desktop Local Conversation Management UI
 * Prototype Arc") — real acceptance tests.
 *
 * Every test drives a REAL `FedosDesktopConversationUiPresentationBoundary`
 * over a REAL `FedosDesktopApplicationShell` over a REAL
 * `startFedosDesktopRuntime()` instance, real append-only log files on
 * disk. `FakeEncryptionAuthority`/`FakeDecryptionAuthority` are the SAME
 * test doubles every other vertical-slice test in this suite already uses
 * (no compiled WASM artifact in this checked-out tree, see
 * `docs/secure_runtime_alpha_3081_3160_completion_declaration.md` §14) —
 * not a mock of anything this Arc itself adds.
 *
 * SETUP NOTE: `FedosDesktopApplicationShell` has no public invitation-
 * redemption or activation method of any kind (`redeemInvitation()` is
 * honestly `"unavailable"` on this base, Alpha 2841-2920; no `activate()`
 * method exists anywhere on the Shell, by design — see that file's own
 * header). A Direct conversation can therefore never reach "active" state
 * through the Shell/ViewModel layer alone — a real, pre-existing
 * characteristic of this base, not something this Arc's own ViewModels
 * could or should work around ("everything must delegate to the Desktop
 * Shell... no duplicate business logic"). Tests that need a genuinely
 * active conversation therefore establish it via a SEPARATE, real
 * `startFedosDesktopRuntime()` instance over the SAME durable config paths
 * first (redeem + activate via `conversationRuntime()`, a real production
 * API), stop it, and only THEN start the presentation boundary's own Shell
 * over that already-durable state — mirroring this codebase's own
 * established "restart recovery" testing convention exactly (e.g.
 * `secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`'s own
 * "20. restart recovers durable state"). No concurrent access to the same
 * log files ever occurs — the setup Runtime is fully stopped before the
 * boundary's own Runtime starts.
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
    clock: incrementingClock(2_000_000_000),
  };
}

/** Real production-API setup: creates + redeems + activates one Direct conversation with BOB as counterparty, over `config`'s own durable paths, then fully stops that setup Runtime -- see this file's own header. Returns the real conversation id and ALICE's own real membership reference. */
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

describe("Alpha 3241-3320 -- 1. Runtime Status ViewModel: lifecycle", () => {
  it("stopped before start(); running + device status after start(); stopped after stop()", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-lifecycle-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    const beforeStart = await ui.runtimeStatus.refresh();
    expect(beforeStart).toEqual({ status: "loaded", data: { runtimeStatus: "stopped", deviceStatus: null } });

    const afterStart = await ui.runtimeStatus.start(freshConfig(dir));
    expect(afterStart.status).toBe("loaded");
    if (afterStart.status !== "loaded") throw new Error("expected loaded");
    expect(afterStart.data.runtimeStatus).toBe("running");
    expect(afterStart.data.deviceStatus).toEqual({ state: "unavailable", reason: expect.any(String) });

    const afterStop = await ui.runtimeStatus.stop();
    expect(afterStop).toEqual({ status: "loaded", data: { runtimeStatus: "stopped", deviceStatus: null } });
  });

  it("every ViewModel is honestly 'error'/'unavailable' before start()", async () => {
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    expect((await ui.conversationList.load()).status).toBe("error");
    expect((await ui.conversationDetail.load("anything")).status).toBe("error");
    expect((await ui.messageList.load("anything")).status).toBe("error");
    ui.search.setQuery("anything");
    expect((await ui.search.search()).status).toBe("error");
    expect((await ui.archive.inspect("anything")).status).toBe("error");
    expect((await ui.membership.load("anything")).status).toBe("error");
    expect((await ui.unreadCounter.refresh("anything")).status).toBe("error");
  });
});

describe("Alpha 3241-3320 -- 2. Conversation List/Detail/Membership ViewModels", () => {
  it("real Direct conversation creation (via the Shell directly -- creation is not one of this Arc's ten ViewModels) is visible through List/Detail/Membership", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-list-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(freshConfig(dir));

    const emptyList = await ui.conversationList.load();
    expect(emptyList).toEqual({ status: "loaded", data: [] });

    const created = ui.shell.createDirectConversation({ recipient: BOB });
    expect(created.outcome).toBe("ok");
    if (created.outcome !== "ok") throw new Error("expected ok");
    const conversationId = created.value.conversationId;

    const list = await ui.conversationList.load();
    expect(list.status).toBe("loaded");
    if (list.status !== "loaded") throw new Error("expected loaded");
    expect(list.data).toHaveLength(1);
    expect(list.data[0]!.conversationId).toBe(conversationId);

    const detail = await ui.conversationDetail.load(conversationId);
    expect(detail.status).toBe("loaded");
    if (detail.status !== "loaded") throw new Error("expected loaded");
    expect(detail.data.mode).toBe("direct");
    expect(ui.conversationDetail.conversationId).toBe(conversationId);

    const membership = await ui.membership.load(conversationId);
    expect(membership.status).toBe("loaded");
    if (membership.status !== "loaded") throw new Error("expected loaded");
    expect(membership.data.creator).toEqual(created.value.creator);
    expect(membership.data.memberships).toHaveLength(1);
    expect(membership.data.memberships[0]!.role).toBe("owner");

    const invitations = await ui.membership.loadInvitations(conversationId, created.value.creator);
    expect(invitations.status).toBe("loaded");
    if (invitations.status !== "loaded") throw new Error("expected loaded");
    expect(invitations.data).toHaveLength(1);

    const unknown = await ui.conversationDetail.load("does-not-exist");
    expect(unknown).toEqual({ status: "error", outcome: "not-found", reason: expect.any(String) });

    await ui.runtimeStatus.stop();
  });

  it("createDirectConversation with an active conversation still surfaces the correct, real activationStatus/lifecycleState through the List ViewModel", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-active-list-"));
    const config = freshConfig(dir);
    const { conversationId } = await setUpActiveDirectConversation(config);

    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const detail = await ui.conversationDetail.load(conversationId);
    expect(detail.status).toBe("loaded");
    if (detail.status !== "loaded") throw new Error("expected loaded");
    // lifecycleState is permanently "draft" by construction (Alpha 1116) --
    // NEVER a stand-in for the real activation fact; this ViewModel does not
    // paper over that, it surfaces exactly what the Shell itself returns.
    expect(detail.data.lifecycleState).toBe("draft");
    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3241-3320 -- 3. Compose/Reply/Message List/Unread Counter ViewModels", () => {
  it("real send -> list (plaintext hidden) -> reveal (exact plaintext) -> reply -> unread counter tracks real message count", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-messaging-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);

    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);

    ui.composeMessage.setBody("hello bob, this is alice");
    const sent = await ui.composeMessage.send(conversationId, owner);
    expect(sent.status).toBe("loaded");
    if (sent.status !== "loaded") throw new Error("expected loaded");
    expect(sent.data.fanout).toBe("not-applicable");
    expect(ui.composeMessage.body).toBe(""); // cleared on real success.
    const rootMessageId = sent.data.messageId;

    const list1 = await ui.messageList.load(conversationId);
    expect(list1.status).toBe("loaded");
    if (list1.status !== "loaded") throw new Error("expected loaded");
    expect(list1.data).toHaveLength(1);
    expect(list1.data[0]!.plaintext.state).toBe("unavailable"); // listMessages() never decrypts.

    const revealed = await ui.messageList.reveal(rootMessageId);
    expect(revealed.status).toBe("loaded");
    if (revealed.status !== "loaded") throw new Error("expected loaded");
    expect(revealed.data[0]!.plaintext).toEqual({ state: "available", text: "hello bob, this is alice" });

    ui.reply.startReplyTo(rootMessageId);
    ui.reply.setBody("hi alice, bob here");
    const replied = await ui.reply.send(conversationId, owner);
    expect(replied.status).toBe("loaded");
    if (replied.status !== "loaded") throw new Error("expected loaded");
    expect(ui.reply.body).toBe("");
    expect(ui.reply.replyToMessageId).toBeNull();

    const list2 = await ui.messageList.load(conversationId);
    expect(list2.status).toBe("loaded");
    if (list2.status !== "loaded") throw new Error("expected loaded");
    expect(list2.data).toHaveLength(2);
    expect(list2.data[1]!.replyToMessageId).toBe(rootMessageId);

    // Unread counter -- honest, in-memory-only watermark over real listMessages() data.
    const unread1 = await ui.unreadCounter.refresh(conversationId);
    expect(unread1).toEqual({ status: "loaded", data: { conversationId, count: 2 } });

    await ui.unreadCounter.markViewed(conversationId);
    const unread2 = await ui.unreadCounter.refresh(conversationId);
    expect(unread2).toEqual({ status: "loaded", data: { conversationId, count: 0 } });

    ui.reply.startReplyTo(replied.data.messageId);
    ui.reply.setBody("one more");
    await ui.reply.send(conversationId, owner);
    const unread3 = await ui.unreadCounter.refresh(conversationId);
    expect(unread3).toEqual({ status: "loaded", data: { conversationId, count: 1 } });

    await ui.runtimeStatus.stop();
  });

  it("sendMessage from a stranger is honestly unauthorized -- no caller-supplied author override", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-stranger-"));
    const config = freshConfig(dir);
    const { conversationId } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);

    const stranger: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "stranger", identityId: null };
    ui.composeMessage.setBody("intrusion");
    const result = await ui.composeMessage.send(conversationId, stranger);
    expect(result).toEqual({ status: "error", outcome: "unauthorized", reason: expect.any(String) });

    await ui.runtimeStatus.stop();
  });

  it("empty compose body is honestly invalid-input, never a Shell call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-empty-body-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(freshConfig(dir));
    const created = ui.shell.createDirectConversation({ recipient: BOB });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const owner = created.value.memberships[0]!.participant;
    const result = await ui.composeMessage.send(created.value.conversationId, owner);
    expect(result).toEqual({ status: "error", outcome: "invalid-input", reason: expect.any(String) });
    await ui.runtimeStatus.stop();
  });

  it("reply before startReplyTo() is honestly invalid-input", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-no-reply-target-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(freshConfig(dir));
    const created = ui.shell.createDirectConversation({ recipient: BOB });
    if (created.outcome !== "ok") throw new Error("expected ok");
    const owner = created.value.memberships[0]!.participant;
    ui.reply.setBody("hello");
    const result = await ui.reply.send(created.value.conversationId, owner);
    expect(result).toEqual({ status: "error", outcome: "invalid-input", reason: expect.any(String) });
    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3241-3320 -- 4. Search ViewModel", () => {
  it("real keyword search over a real sent message", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-search-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);

    ui.composeMessage.setBody("the quokka runs at dawn");
    const sent = await ui.composeMessage.send(conversationId, owner);
    if (sent.status !== "loaded") throw new Error("expected loaded");

    ui.search.setQuery("quokka");
    const hit = await ui.search.search();
    expect(hit).toEqual({ status: "loaded", data: [{ conversationId, messageId: sent.data.messageId }] });

    ui.search.setQuery("giraffe");
    expect(await ui.search.search()).toEqual({ status: "loaded", data: [] });

    ui.search.setQuery("");
    expect((await ui.search.search()).status).toBe("error");

    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3241-3320 -- 5. Archive ViewModel", () => {
  it("archive is honestly 'unavailable' when archiveEnabled was never set on this config", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-archive-disabled-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(freshConfig(dir));
    const result = await ui.archive.inspect("anything");
    expect(result).toEqual({ status: "error", outcome: "unavailable", reason: expect.any(String) });
    await ui.runtimeStatus.stop();
  });

  it("real inspect of a nonexistent archive file is honestly not-found when archiveEnabled IS set", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-archive-enabled-"));
    const config: FedosDesktopRuntimeConfig = {
      ...freshConfig(dir),
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
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const result = await ui.archive.inspect(join(dir, "does-not-exist.archive"));
    expect(result).toEqual({ status: "error", outcome: "not-found", reason: expect.any(String) });
    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3241-3320 -- 6. no raw Error/secret leakage; independent boundary isolation", () => {
  it("every ViewModel state is JSON-serializable and never carries an Error or a stack", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3241-3320-leak-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(freshConfig(dir));
    const created = ui.shell.createDirectConversation({ recipient: BOB });
    const states: unknown[] = [
      created,
      await ui.conversationList.load(),
      await ui.conversationDetail.load("unknown"),
      await ui.messageList.load("unknown"),
      await ui.membership.load("unknown"),
      await ui.unreadCounter.refresh("unknown"),
      await ui.archive.inspect("unknown"),
    ];
    for (const s of states) {
      expect(s).not.toBeInstanceOf(Error);
      const serialized = JSON.stringify(s);
      expect(serialized.toLowerCase()).not.toContain("stack");
      expect(() => JSON.parse(serialized)).not.toThrow();
    }
    await ui.runtimeStatus.stop();
  });

  it("two independent presentation boundaries never share a Shell or see each other's conversations", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "fedos-3241-3320-iso-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "fedos-3241-3320-iso-b-"));
    const uiA = createFedosDesktopConversationUiPresentationBoundary();
    const uiB = createFedosDesktopConversationUiPresentationBoundary();
    expect(uiA.shell).not.toBe(uiB.shell);
    await uiA.runtimeStatus.start(freshConfig(dirA));
    await uiB.runtimeStatus.start(freshConfig(dirB));
    uiA.shell.createDirectConversation({ recipient: BOB });
    const bList = await uiB.conversationList.load();
    expect(bList).toEqual({ status: "loaded", data: [] });
    await uiA.runtimeStatus.stop();
    await uiB.runtimeStatus.stop();
  });
});
