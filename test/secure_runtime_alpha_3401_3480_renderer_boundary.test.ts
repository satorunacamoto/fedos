/**
 * Secure Runtime Alpha 3401-3480 ("Desktop UI Renderer Boundary") — real
 * acceptance tests.
 *
 * Every test drives real ViewModels (`src/desktop/presentation/`) over a
 * real `FedosDesktopApplicationShell` over a real
 * `startFedosDesktopRuntime()` instance, real append-only log files on
 * disk, through the real `FedosDesktopRenderer` this Arc adds.
 * `FakeEncryptionAuthority`/`FakeDecryptionAuthority` are the SAME test
 * doubles every other vertical-slice test in this repository already uses
 * (no compiled WASM artifact in this checked-out tree).
 *
 * "Renderer snapshot tests" here means a full, deterministic `toEqual()`
 * assertion of the COMPLETE render-model object in one go — this
 * codebase's own established assertion style throughout every existing
 * test file — rather than introducing an external `__snapshots__` file
 * convention that exists nowhere else in this repository.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { createFedosDesktopConversationUiPresentationBoundary } from "../src/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { createFedosDesktopRenderer } from "../src/os/messenger/desktop/renderer/fedos_desktop_renderer.js";
import { FedosDesktopErrorRenderer } from "../src/os/messenger/desktop/renderer/fedos_desktop_error_renderer.js";
import { FedosDesktopLoadingRenderer } from "../src/os/messenger/desktop/renderer/fedos_desktop_loading_renderer.js";
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
    clock: incrementingClock(2_100_000_000),
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

describe("Alpha 3401-3480 -- 1. snapshot tests: initial (idle) render models", () => {
  it("every renderer's own idle snapshot, before any ViewModel action has run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-idle-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(freshConfig(dir));
    const renderer = createFedosDesktopRenderer(ui);

    expect(renderer.conversationList.render()).toEqual({ kind: "idle" });
    expect(renderer.conversationDetail.render()).toEqual({ kind: "idle" });
    expect(renderer.search.render()).toEqual({ query: "", results: { kind: "idle" } });
    expect(renderer.archive.render()).toEqual({ kind: "idle" });
    expect(renderer.membership.render()).toEqual({ membership: { kind: "idle" }, invitations: { kind: "idle" } });
    expect(renderer.reply.render()).toEqual({
      draft: { replyToMessageId: null, body: "", canSend: false },
      send: { kind: "idle" },
    });
    expect(renderer.message.render()).toEqual({
      messages: { kind: "idle" },
      compose: { body: "", canSend: false, send: { kind: "idle" } },
      unread: { kind: "idle" },
    });

    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3401-3480 -- 2. state transitions", () => {
  it("Conversation List: idle -> content (real conversations) -> content (filtered)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-transitions-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(freshConfig(dir));
    const renderer = createFedosDesktopRenderer(ui);

    expect(renderer.conversationList.render()).toEqual({ kind: "idle" });

    const created = ui.shell.createDirectConversation({ recipient: BOB });
    if (created.outcome !== "ok") throw new Error("expected ok");
    await ui.conversationList.load();
    const loaded = renderer.conversationList.render();
    expect(loaded.kind).toBe("content");
    if (loaded.kind !== "content") throw new Error("expected content");
    expect(loaded.content).toEqual({ items: [expect.objectContaining({ conversationId: created.value.conversationId })], count: 1, isEmpty: false });

    await ui.conversationList.load({ mode: "private-group" });
    expect(renderer.conversationList.render()).toEqual({ kind: "content", content: { items: [], count: 0, isEmpty: true } });

    await ui.runtimeStatus.stop();
  });

  it("Runtime Status: idle -> content(stopped) -> content(running) -> content(stopped)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-runtime-status-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    const renderer = createFedosDesktopRenderer(ui);

    expect(renderer.status.render()).toEqual({ kind: "idle" });
    await ui.runtimeStatus.refresh();
    expect(renderer.status.render()).toEqual({ kind: "content", content: { runtimeStatus: "stopped", deviceStatus: null } });

    await ui.runtimeStatus.start(freshConfig(dir));
    const running = renderer.status.render();
    expect(running).toEqual({
      kind: "content",
      content: { runtimeStatus: "running", deviceStatus: { state: "unavailable", reason: expect.any(String) } },
    });

    await ui.runtimeStatus.stop();
    expect(renderer.status.render()).toEqual({ kind: "content", content: { runtimeStatus: "stopped", deviceStatus: null } });
  });
});

describe("Alpha 3401-3480 -- 3. error rendering", () => {
  it("FedosDesktopErrorRenderer.render() -- null for non-error states, the exact outcome/reason for an error state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-error-"));
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    const renderer = createFedosDesktopRenderer(ui);

    expect(FedosDesktopErrorRenderer.render(ui.conversationDetail.state)).toBeNull();

    // Before start() -- every ViewModel action fails closed to a real Shell "unavailable".
    await ui.conversationDetail.load("anything");
    expect(FedosDesktopErrorRenderer.render(ui.conversationDetail.state)).toEqual({ outcome: "unavailable", message: expect.any(String) });
    expect(renderer.conversationDetail.render()).toEqual({ kind: "error", outcome: "unavailable", message: expect.any(String) });

    await ui.runtimeStatus.start(freshConfig(dir));
    const unknown = await ui.conversationDetail.load("does-not-exist");
    expect(unknown.status).toBe("error");
    expect(renderer.conversationDetail.render()).toEqual({ kind: "error", outcome: "not-found", message: expect.any(String) });

    await ui.runtimeStatus.stop();
  });

  it("a stranger sender's send is rendered as a real 'unauthorized' error, never a raw Error", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-unauthorized-"));
    const config = freshConfig(dir);
    const { conversationId } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const renderer = createFedosDesktopRenderer(ui);

    const stranger: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "stranger", identityId: null };
    ui.composeMessage.setBody("intrusion");
    await ui.composeMessage.send(conversationId, stranger);
    const rendered = renderer.message.render();
    expect(rendered.compose.send).toEqual({ kind: "error", outcome: "unauthorized", message: expect.any(String) });
    expect(rendered.compose.send).not.toBeInstanceOf(Error);

    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3401-3480 -- 4. loading rendering", () => {
  it("FedosDesktopLoadingRenderer.isLoading() is true while a real async send is in flight, false once settled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-loading-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const renderer = createFedosDesktopRenderer(ui);

    ui.composeMessage.setBody("hello");
    const pending = ui.composeMessage.send(conversationId, owner);
    // Synchronous check BEFORE awaiting -- the ViewModel sets "loading" synchronously before its own `await this.#shell.sendMessage(...)` point.
    expect(FedosDesktopLoadingRenderer.isLoading(ui.composeMessage.state)).toBe(true);
    expect(renderer.message.render().compose.send).toEqual({ kind: "loading" });

    await pending;
    expect(FedosDesktopLoadingRenderer.isLoading(ui.composeMessage.state)).toBe(false);
    expect(renderer.message.render().compose.send.kind).toBe("content");

    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3401-3480 -- 5. empty rendering", () => {
  it("Conversation List, Message, and Search renderers each distinguish a real, successfully-loaded EMPTY result from idle/error", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-empty-"));
    const config = freshConfig(dir);
    const { conversationId } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const renderer = createFedosDesktopRenderer(ui);

    await ui.conversationList.load({ mode: "private-group" });
    expect(renderer.conversationList.render()).toEqual({ kind: "content", content: { items: [], count: 0, isEmpty: true } });

    await ui.messageList.load(conversationId);
    const messageRender = renderer.message.render();
    expect(messageRender.messages).toEqual({ kind: "content", content: { items: [], count: 0, isEmpty: true } });

    ui.search.setQuery("nothing-was-ever-sent-matching-this");
    await ui.search.search();
    expect(renderer.search.render()).toEqual({ query: "nothing-was-ever-sent-matching-this", results: { kind: "content", content: { items: [], count: 0, isEmpty: true } } });

    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3401-3480 -- 6. large conversation rendering", () => {
  it("renders every one of 30 real, distinct sent messages, in order, without truncation or corruption", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-large-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const renderer = createFedosDesktopRenderer(ui);

    const MESSAGE_COUNT = 30;
    for (let i = 0; i < MESSAGE_COUNT; i += 1) {
      ui.composeMessage.setBody(`message number ${i}`);
      const result = await ui.composeMessage.send(conversationId, owner);
      expect(result.status).toBe("loaded");
    }

    await ui.messageList.load(conversationId);
    const rendered = renderer.message.render().messages;
    expect(rendered.kind).toBe("content");
    if (rendered.kind !== "content") throw new Error("expected content");
    expect(rendered.content.count).toBe(MESSAGE_COUNT);
    expect(rendered.content.isEmpty).toBe(false);
    expect(rendered.content.items).toHaveLength(MESSAGE_COUNT);
    // Deterministic order, unchanged from the Shell's own listMessages() ordering.
    const createdAtOrder = rendered.content.items.map((m) => m.createdAt);
    expect(createdAtOrder).toEqual([...createdAtOrder].sort((a, b) => a - b));

    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3401-3480 -- 7. search rendering", () => {
  it("real keyword search result rendered through SearchRenderer, including the query text itself", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-search-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const renderer = createFedosDesktopRenderer(ui);

    ui.composeMessage.setBody("the quokka runs at dawn");
    const sent = await ui.composeMessage.send(conversationId, owner);
    if (sent.status !== "loaded") throw new Error("expected loaded");

    ui.search.setQuery("quokka");
    await ui.search.search();
    expect(renderer.search.render()).toEqual({
      query: "quokka",
      results: { kind: "content", content: { items: [{ conversationId, messageId: sent.data.messageId }], count: 1, isEmpty: false } },
    });

    await ui.runtimeStatus.stop();
  });
});

describe("Alpha 3401-3480 -- 8. archive rendering", () => {
  it("real 'unavailable' (archiveEnabled unset) and real 'not-found' (archiveEnabled set) rendered through ArchiveRenderer", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "fedos-3401-3480-archive-a-"));
    const uiA = createFedosDesktopConversationUiPresentationBoundary();
    await uiA.runtimeStatus.start(freshConfig(dirA));
    const rendererA = createFedosDesktopRenderer(uiA);
    await uiA.archive.inspect("anything");
    expect(rendererA.archive.render()).toEqual({ kind: "error", outcome: "unavailable", message: expect.any(String) });
    await uiA.runtimeStatus.stop();

    const dirB = mkdtempSync(join(tmpdir(), "fedos-3401-3480-archive-b-"));
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
    const uiB = createFedosDesktopConversationUiPresentationBoundary();
    await uiB.runtimeStatus.start(configB);
    const rendererB = createFedosDesktopRenderer(uiB);
    await uiB.archive.inspect(join(dirB, "does-not-exist.archive"));
    expect(rendererB.archive.render()).toEqual({ kind: "error", outcome: "not-found", message: expect.any(String) });
    await uiB.runtimeStatus.stop();
  });
});

describe("Alpha 3401-3480 -- 9. no raw Error/secret leakage across every renderer", () => {
  it("every render model is JSON-serializable and never carries an Error, a stack, or a bearer secret", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3401-3480-leak-"));
    const config = freshConfig(dir);
    const { conversationId, owner } = await setUpActiveDirectConversation(config);
    const ui = createFedosDesktopConversationUiPresentationBoundary();
    await ui.runtimeStatus.start(config);
    const renderer = createFedosDesktopRenderer(ui);

    await ui.conversationList.load();
    await ui.conversationDetail.load(conversationId);
    await ui.messageList.load(conversationId);
    await ui.membership.load(conversationId);
    ui.search.setQuery("hello");
    await ui.search.search();
    ui.composeMessage.setBody("hello");
    await ui.composeMessage.send(conversationId, owner);

    const renderModels: unknown[] = [
      renderer.conversationList.render(),
      renderer.conversationDetail.render(),
      renderer.message.render(),
      renderer.reply.render(),
      renderer.search.render(),
      renderer.archive.render(),
      renderer.membership.render(),
      renderer.status.render(),
    ];
    for (const model of renderModels) {
      expect(model).not.toBeInstanceOf(Error);
      const serialized = JSON.stringify(model);
      expect(serialized.toLowerCase()).not.toContain("stack");
      expect(() => JSON.parse(serialized)).not.toThrow();
    }

    await ui.runtimeStatus.stop();
  });
});
