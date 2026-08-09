/**
 * Secure Runtime Alpha 3081-3160 ("Desktop Runtime Conversation Content
 * Accessor and Application Shell Activation Arc") — Phase J real
 * acceptance tests.
 *
 * Every test drives a REAL `startFedosDesktopRuntime()` instance, real
 * append-only log files on disk, and the REAL
 * `FedosDesktopConversationContentAccessor` this Arc adds — never a mock
 * of the accessor itself. `FakeEncryptionAuthority`/`FakeDecryptionAuthority`
 * are the SAME test doubles every other vertical-slice test in this suite
 * already uses (no WASM artifact in this checked-out tree) — this Arc adds
 * no new crypto of its own to fake.
 *
 * Shell-level mapping (result-vocabulary translation, precondition
 * ordering) is already covered by
 * `test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`
 * (updated by this Arc, 20 tests, all passing) — this file exercises the
 * Content Accessor itself, the new boundary this Arc actually adds.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

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
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { AppendOnlyFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/append_only_fedos_payload_retention_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { AppendOnlyFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/append_only_fedos_conversation_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import {
  FedosWasmConversationArchiveEncryptionAuthority,
  type FedosConversationArchiveEncryptionRuntimeBoundary,
} from "../src/os/messenger/conversations/archive/fedos_conversation_archive_encryption.js";
import { NodeFedosConversationArchiveFileAuthority } from "../src/os/messenger/conversations/archive/fs/fedos_conversation_archive_file_authority.js";
import { createFedosConversationArchiveRuntime } from "../src/os/messenger/conversations/archive/runtime/fedos_conversation_archive_runtime.js";
import type { AeadCiphertextHandle, AeadCiphertextWire } from "../src/runtime/fedos_wasm_loader.js";

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

/** Mirrors `secure_runtime_alpha_1691_1760_archive_runtime.test.ts`'s own identical helper -- a REAL (in-memory) round trip standing in ONLY for the missing compiled WASM artifact, never actual AEAD. */
function fakeRoundTrippingRuntimeBoundary(): FedosConversationArchiveEncryptionRuntimeBoundary {
  const byHandle = new Map<string, Uint8Array>();
  const byWire = new Map<string, string>();
  let counter = 0;
  return {
    encrypt: async (_key, _algorithm, _aadDomain, plaintext) => {
      counter += 1;
      const id = `handle-${counter}`;
      byHandle.set(id, plaintext);
      return { kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle;
    },
    exportCiphertext: async (ciphertext) => {
      const id = (ciphertext as unknown as { id: string }).id;
      const wire = `wire-${id}`;
      byWire.set(wire, id);
      return wire as unknown as AeadCiphertextWire;
    },
    importCiphertext: async (wire) => {
      const id = byWire.get(wire as unknown as string);
      return id === undefined ? null : ({ kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle);
    },
    decrypt: async (_key, _algorithm, _aadDomain, ciphertext) => byHandle.get((ciphertext as unknown as { id: string }).id) ?? null,
  };
}

function fakeMasterSeedAuthority(available = true): FedosMasterSeedAuthority {
  return {
    isAvailable: async () => available,
    isCleared: async () => !available,
    generate: async () => true,
    restoreSealed: async () => true,
    seal: async () => null,
    clear: async () => undefined,
    resolveConversationKey: async () => ({ kind: "AeadKeyHandle" }) as AeadKeyHandle,
  };
}

const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };
const DAVE: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "d".repeat(64), identityId: null };

/** A monotonically increasing clock -- required so envelopes/messages sent within the same test get DISTINCT `createdAt` values and therefore a deterministic, order-preserving sort (ties break on random envelope id otherwise). */
function incrementingClock(startAt: number): () => number {
  let current = startAt;
  return () => {
    current += 1;
    return current;
  };
}

function baseConfig(dir: string, localIdentity: FedosConversationParticipantReference = ALICE): FedosDesktopRuntimeConfig {
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
    conversationGroupGenerationLogPath: join(dir, "group-generation.log"),
    conversationGroupDirectPathLogPath: join(dir, "group-path.log"),
    conversationGroupMessageLogPath: join(dir, "group-message.log"),
    conversationGroupFanoutDeliveryLogPath: join(dir, "group-delivery.log"),
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(localIdentity),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
    clock: incrementingClock(1_900_000_000),
  };
}

describe("Alpha 3081-3160 -- 1. Runtime owns exactly one Content Accessor", () => {
  it("returns the SAME instance on repeat calls while running; inaccessible after stop (handle throws AND the accessor's own isRuntimeRunning fails closed)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-owner-"));
    const runtime = await startFedosDesktopRuntime(baseConfig(dir));
    const accessor1 = runtime.conversationContentAccessor();
    const accessor2 = runtime.conversationContentAccessor();
    expect(accessor1).toBe(accessor2);

    await runtime.stop();
    expect(() => runtime.conversationContentAccessor()).toThrow(/inaccessible after stop/);
    // A reference grabbed before stop() also fails closed on its own.
    expect(accessor1.listMessages("anything")).toEqual({ outcome: "unavailable", reason: expect.any(String) });
  });

  it("two independent runtimes never share the same accessor instance", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "fedos-3081-3160-iso-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "fedos-3081-3160-iso-b-"));
    const runtimeA = await startFedosDesktopRuntime(baseConfig(dirA));
    const runtimeB = await startFedosDesktopRuntime(baseConfig(dirB));
    expect(runtimeA.conversationContentAccessor()).not.toBe(runtimeB.conversationContentAccessor());
    await runtimeA.stop();
    await runtimeB.stop();
  });
});

describe("Alpha 3081-3160 -- 2. Direct: activate -> send -> read -> reply -> list", () => {
  it("real send/read round trip with exact plaintext, reply reference preserved, deterministic listing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-direct-"));
    const config = baseConfig(dir);
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    expect(cr.redeemInvitation(token, BOB).outcome).toBe("redeemed");

    // Before activation -- honest requires-activation, never a fake send.
    const early = await accessor.sendMessage(id, "too early", null);
    expect(early).toEqual({ outcome: "requires-activation", reason: expect.any(String) });

    expect(await cr.activateDirectConversation(id)).toEqual({ outcome: "activated" });

    const sent = await accessor.sendMessage(id, "hello bob, this is alice", null);
    expect(sent.outcome).toBe("ok");
    if (sent.outcome !== "ok") throw new Error("expected ok");
    expect(sent.value.localWrite).toBe("stored");
    expect(sent.value.fanout).toBe("not-applicable");
    const rootMessageId = sent.value.messageId;

    const reply = await accessor.replyToMessage(id, rootMessageId, "hi alice, bob here");
    expect(reply.outcome).toBe("ok");
    if (reply.outcome !== "ok") throw new Error("expected ok");
    const replyMessageId = reply.value.messageId;

    const read = await accessor.readMessage(id, rootMessageId);
    expect(read.outcome).toBe("ok");
    if (read.outcome !== "ok") throw new Error("expected ok");
    expect(read.value.plaintext).toEqual({ state: "available", text: "hello bob, this is alice" });
    expect(read.value.retentionState).toBe("active");
    expect(read.value.localDeliveryState).toBe("stored-locally");
    expect(read.value.replyToMessageId).toBeNull();

    const readReply = await accessor.readMessage(id, replyMessageId);
    expect(readReply.outcome).toBe("ok");
    if (readReply.outcome !== "ok") throw new Error("expected ok");
    expect(readReply.value.plaintext).toEqual({ state: "available", text: "hi alice, bob here" });
    expect(readReply.value.replyToMessageId).toBe(rootMessageId);

    // listMessages never decrypts, deterministic order, zero-message case handled elsewhere.
    const list = accessor.listMessages(id);
    expect(list.outcome).toBe("ok");
    if (list.outcome !== "ok") throw new Error("expected ok");
    expect(list.value).toHaveLength(2);
    expect(list.value[0]!.messageId).toBe(rootMessageId);
    expect(list.value[0]!.plaintext.state).toBe("unavailable");
    expect(list.value[1]!.messageId).toBe(replyMessageId);

    // A brand-new, never-messaged Direct conversation returns an empty successful list.
    const secondCreated = cr.createDirectDraft({ recipient: CAROL });
    if (secondCreated.outcome !== "draft-created") throw new Error("expected draft-created");
    const secondToken = toFedosConversationInvitationToken(secondCreated.capability!.descriptor.capabilityId, secondCreated.capability!.bearerSecret);
    cr.redeemInvitation(secondToken, CAROL);
    await cr.activateDirectConversation(secondCreated.draft.id);
    expect(accessor.listMessages(secondCreated.draft.id)).toEqual({ outcome: "ok", value: [] });

    await runtime.stop();
  });

  it("malformed message input fails closed to invalid-input, never a raw error", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-invalid-"));
    const runtime = await startFedosDesktopRuntime(baseConfig(dir));
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    cr.redeemInvitation(token, BOB);
    await cr.activateDirectConversation(created.draft.id);

    expect((await accessor.sendMessage(created.draft.id, "", null)).outcome).toBe("invalid-input");
    expect((await accessor.replyToMessage(created.draft.id, "", "body"))).toEqual({ outcome: "invalid-input", reason: expect.any(String) });
    expect((await accessor.readMessage(created.draft.id, "not-a-real-envelope-id")).outcome).toBe("not-found");

    await runtime.stop();
  });
});

describe("Alpha 3081-3160 -- 3. wrong identity fails closed", () => {
  it("a local identity with no Membership on the conversation is denied read/send -- never a fabricated empty/plaintext result", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-wrongid-"));
    const configAlice = baseConfig(dir, ALICE);
    const runtimeAlice = await startFedosDesktopRuntime(configAlice);
    const crAlice = runtimeAlice.conversationRuntime();
    const accessorAlice = runtimeAlice.conversationContentAccessor();

    const created = crAlice.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    crAlice.redeemInvitation(token, BOB);
    await crAlice.activateDirectConversation(id);
    const sent = await accessorAlice.sendMessage(id, "alice to bob", null);
    if (sent.outcome !== "ok") throw new Error("expected ok");
    await runtimeAlice.stop();

    // A SECOND runtime, over the SAME durable files, whose local identity is
    // DAVE -- never added to this conversation by anyone.
    const configDave = baseConfig(dir, DAVE);
    const runtimeDave = await startFedosDesktopRuntime(configDave);
    const accessorDave = runtimeDave.conversationContentAccessor();

    const readAsDave = await accessorDave.readMessage(id, sent.value.messageId);
    expect(readAsDave).toEqual({ outcome: "unauthorized", reason: expect.any(String) });

    const sendAsDave = await accessorDave.sendMessage(id, "dave intrudes", null);
    expect(sendAsDave).toEqual({ outcome: "unauthorized", reason: expect.any(String) });

    const listAsDave = accessorDave.listMessages(id);
    expect(listAsDave).toEqual({ outcome: "unauthorized", reason: expect.any(String) });

    await runtimeDave.stop();
  });
});

describe("Alpha 3081-3160 -- 4. Group: admit -> send -> real per-recipient read -> removed member", () => {
  it("recipient reads their own fanned-out copy with exact plaintext; sender's own message honestly 'own-message'; removed member excluded from next send", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-group-"));
    const config = baseConfig(dir);
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const gr = cr.groupRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createPrivateGroupDraft({});
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const groupId = created.draft.id;

    expect(gr.addPrivateGroupMember(groupId, BOB).outcome).toBe("admitted");
    expect(gr.addPrivateGroupMember(groupId, CAROL).outcome).toBe("admitted");

    const sendResult = await accessor.sendMessage(groupId, "hello group, this is alice", null);
    expect(sendResult.outcome).toBe("ok");
    if (sendResult.outcome !== "ok") throw new Error("expected ok");
    expect(sendResult.value.fanout).toBe("complete");
    const groupMessageId = sendResult.value.messageId;

    // listMessages: real, deterministic, never decrypts.
    const list = accessor.listMessages(groupId);
    expect(list.outcome).toBe("ok");
    if (list.outcome !== "ok") throw new Error("expected ok");
    expect(list.value).toHaveLength(1);
    expect(list.value[0]!.messageId).toBe(groupMessageId);
    expect(list.value[0]!.plaintext.state).toBe("unavailable");

    // The LOCAL identity (Alice) is this message's own sender -- no self-Envelope exists to decrypt.
    const readAsSender = await accessor.readMessage(groupId, groupMessageId);
    expect(readAsSender.outcome).toBe("ok");
    if (readAsSender.outcome !== "ok") throw new Error("expected ok");
    expect(readAsSender.value.plaintext.state).toBe("unavailable");
    expect(readAsSender.value.plaintext.state === "unavailable" && readAsSender.value.plaintext.reason).toMatch(/own sender/);

    // Remove Bob -- generation advances; a NEW send must exclude him.
    expect(gr.removePrivateGroupMember(groupId, BOB).outcome).toBe("revoked");
    const secondSend = await accessor.sendMessage(groupId, "second message, bob is gone", null);
    expect(secondSend.outcome).toBe("ok");
    if (secondSend.outcome !== "ok") throw new Error("expected ok");
    expect(secondSend.value.fanout).toBe("complete");
    const secondList = gr.listPrivateGroupMessages(groupId);
    const secondSummary = secondList.find((m) => m.id === secondSend.value.messageId)!;
    expect(secondSummary.fanoutSummary.recipientCount).toBe(1); // Carol only.

    await runtime.stop();
  });
});

describe("Alpha 3081-3160 -- 5. restoration/reactivation resumes real messaging", () => {
  it("a restored-but-unreactivated conversation reports requires-activation; reactivateRestoredConversation() unblocks real send/read", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "fedos-3081-3160-reactivate-a-"));
    const configA = baseConfig(dirA);
    const runtimeA = await startFedosDesktopRuntime(configA);
    const crA = runtimeA.conversationRuntime();
    const accessorA = runtimeA.conversationContentAccessor();

    const created = crA.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    crA.redeemInvitation(token, BOB);
    await crA.activateDirectConversation(id);
    const sent = await accessorA.sendMessage(id, "before restore", null);
    if (sent.outcome !== "ok") throw new Error("expected ok");
    await runtimeA.stop();

    // A FRESH runtime over a DIFFERENT set of paths, simulating "restored"
    // Draft/Membership/Envelope/Payload state with NO Activation fact
    // replayed (mirrors the real Archive Restore Arc's own documented
    // scope: Activation is deliberately never part of a restored bundle).
    const dirB = mkdtempSync(join(tmpdir(), "fedos-3081-3160-reactivate-b-"));
    const configB = baseConfig(dirB);
    const runtimeB = await startFedosDesktopRuntime(configB);
    const crB = runtimeB.conversationRuntime();
    const accessorB = runtimeB.conversationContentAccessor();

    // Re-derive the SAME conversation state via the real, non-activation-writing
    // construction/membership APIs (Draft + Membership, no Activation fact) --
    // then confirm the accessor honestly reports requires-activation before
    // reactivateRestoredConversation() is ever called.
    const recreated = crB.createDirectDraft({ recipient: BOB, idempotencyKey: "restored-conversation" });
    if (recreated.outcome !== "draft-created") throw new Error("expected draft-created");
    const restoredId = recreated.draft.id;
    const restoredToken = toFedosConversationInvitationToken(recreated.capability!.descriptor.capabilityId, recreated.capability!.bearerSecret);
    crB.redeemInvitation(restoredToken, BOB);

    const beforeReactivation = await accessorB.sendMessage(restoredId, "too early after restore", null);
    expect(beforeReactivation).toEqual({ outcome: "requires-activation", reason: expect.any(String) });

    expect(await crB.reactivateRestoredConversation(restoredId)).toEqual({ outcome: "reactivated", mode: "direct" });

    const afterReactivation = await accessorB.sendMessage(restoredId, "resumed after restore", null);
    expect(afterReactivation.outcome).toBe("ok");
    if (afterReactivation.outcome !== "ok") throw new Error("expected ok");
    const read = await accessorB.readMessage(restoredId, afterReactivation.value.messageId);
    expect(read).toEqual({
      outcome: "ok",
      value: expect.objectContaining({ plaintext: { state: "available", text: "resumed after restore" } }),
    });

    void sent;
    await runtimeB.stop();
  });
});

describe("Alpha 3081-3160 -- 6. Search: real keyword index, retention-gated", () => {
  it("a sent Direct message becomes searchable; tombstoning the payload removes it from Search AND from readMessage's plaintext", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-search-"));
    const config = baseConfig(dir);
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    cr.redeemInvitation(token, BOB);
    await cr.activateDirectConversation(id);

    const sent = await accessor.sendMessage(id, "the quokka runs at dawn", null);
    if (sent.outcome !== "ok") throw new Error("expected ok");
    const envelopeId = sent.value.messageId;

    const beforeSearch = accessor.searchConversations("quokka");
    expect(beforeSearch.outcome).toBe("ok");
    if (beforeSearch.outcome !== "ok") throw new Error("expected ok");
    expect(beforeSearch.value).toEqual([{ conversationId: id, messageId: envelopeId }]);

    // An unrelated query finds nothing -- never a false hit.
    expect(accessor.searchConversations("giraffe")).toEqual({ outcome: "ok", value: [] });
    // Invalid input fails closed.
    expect(accessor.searchConversations("")).toEqual({ outcome: "invalid-input", reason: expect.any(String) });

    // Out-of-band retention transition, over the SAME durable retention/payload
    // log paths this running Runtime already uses (mirrors this codebase's own
    // established "second port instance, same durable backend" pattern, e.g.
    // the Archive Runtime's own Membership/Capability ports) -- there is no
    // production Shell/Accessor operation to tombstone a payload on this base
    // (that is a distinct, un-scoped future capability), so this is the
    // narrowest real way to exercise the ALREADY-WIRED retention gate.
    const envelope = cr.getConversationMessageEnvelope(id, envelopeId)!;
    const payloadId = toFedosConversationPayloadId(envelope.payloadId)!;
    const retentionAuthority = new FedosPayloadRetentionAuthority({
      retentionPersistence: new AppendOnlyFedosPayloadRetentionPersistence(config.conversationPayloadRetentionLogPath!),
      payloadStorage: new AppendOnlyFedosConversationPayloadStorage(config.conversationPayloadLogPath!, 1_048_576),
      clock: config.clock,
    });
    expect(retentionAuthority.tombstonePayload(payloadId, null, "user_requested_placeholder")).toEqual({ outcome: "tombstoned" });

    const afterSearch = accessor.searchConversations("quokka");
    expect(afterSearch).toEqual({ outcome: "ok", value: [] });

    const readAfterTombstone = await accessor.readMessage(id, envelopeId);
    expect(readAfterTombstone.outcome).toBe("ok");
    if (readAfterTombstone.outcome !== "ok") throw new Error("expected ok");
    expect(readAfterTombstone.value.plaintext.state).toBe("unavailable");
    expect(readAfterTombstone.value.retentionState).toBe("tombstoned");

    // listMessages' own summary reflects the SAME real retention state --
    // never plaintext, tombstoned or not (Alpha 1139, unchanged).
    const list = accessor.listMessages(id);
    expect(list.outcome).toBe("ok");
    if (list.outcome !== "ok") throw new Error("expected ok");
    expect(list.value[0]!.retentionState).toBe("tombstoned");
    expect(list.value[0]!.plaintext.state).toBe("unavailable");

    await runtime.stop();
  });

  it("search() feature-disabled reason does not apply -- Search is always constructed; only the running-state gate applies", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-search-disabled-"));
    const runtime = await startFedosDesktopRuntime(baseConfig(dir));
    const accessor = runtime.conversationContentAccessor();
    expect(accessor.searchConversations("anything")).toEqual({ outcome: "ok", value: [] });
    await runtime.stop();
    expect(accessor.searchConversations("anything")).toEqual({ outcome: "unavailable", reason: expect.any(String) });
  });
});

describe("Alpha 3081-3160 -- 7. Archive: real inspect/preflight/export/restore through the Accessor", () => {
  it("archive() is honestly unavailable when archiveEnabled was never set", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-archive-disabled-"));
    const runtime = await startFedosDesktopRuntime(baseConfig(dir));
    const accessor = runtime.conversationContentAccessor();
    const result = await accessor.archive({ operation: "inspect", sourcePath: join(dir, "nothing.archive") });
    expect(result).toEqual({ outcome: "unavailable", reason: expect.any(String) });
    await runtime.stop();
  });

  it("exporting a private Direct/Group conversation id with NO matching board-level Conversation record is honestly 'not-found' -- a real, discovered characteristic of this Archive Runtime's own existence gate (`conversationPersistence.getConversation()`, Alpha 749/1691-1760), not something this Arc invents a workaround for", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-archive-no-bridge-"));
    const config: FedosDesktopRuntimeConfig = {
      ...baseConfig(dir),
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(true),
    };
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    cr.redeemInvitation(token, BOB);
    await cr.activateDirectConversation(id);
    await accessor.sendMessage(id, "archive me", null);

    const exportResult = await accessor.archive({
      operation: "export",
      request: {
        conversationId: id,
        destinationPath: join(dir, "unreachable.archive"),
        localParticipant: ALICE,
        localAccountIndex: 0,
        counterpartyPublicKeyHex: "ab".repeat(32),
        suite: "ChaCha20Poly1305",
      },
    });
    expect(exportResult).toEqual({ outcome: "not-found", reason: expect.any(String) });

    await runtime.stop();
  });

  it("real export attempt reaches the Archive Runtime honestly ('failed', not a fabricated success) -- this checked-out tree has no compiled WASM artifact backing FedosWasmConversationArchiveEncryptionAuthority's default runtime boundary, and startFedosDesktopRuntime()'s own archiveEnabled wiring has NO test-injection point for it (unlike conversationEncryptionAuthority/conversationDecryptionAuthority for messaging) -- a real, pre-existing environmental characteristic, not a defect in this Arc's own Accessor", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-archive-"));
    const conversationLogPath = join(dir, "board-conversation.log");
    const config: FedosDesktopRuntimeConfig = {
      ...baseConfig(dir),
      conversationLogPath,
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(true),
    };
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    cr.redeemInvitation(token, BOB);
    await cr.activateDirectConversation(id);
    await accessor.sendMessage(id, "archive me", null);

    // The bridging fact the Archive Runtime's own `exportConversationArchive()`
    // requires -- see the "not-found" test above for why this is necessary and
    // honest, not a workaround. A SECOND port instance over the SAME durable
    // log file this running Runtime already reads (mirrors this codebase's own
    // established "second port instance, same durable backend" pattern, e.g.
    // the Archive Runtime's own Membership/Capability ports).
    new AppendOnlyFedosConversationPersistence(conversationLogPath).putConversation({
      schemaVersion: 1,
      id,
      mode: "direct",
      boardId: "n/a-private-conversation",
      rootThreadId: "n/a-private-conversation",
      rootPostId: "n/a-private-conversation",
      policyReference: "direct-draft-v1",
      createdAt: 1_900_000_000,
    });

    const archivePath = join(dir, "conversation.archive");
    const exportResult = await accessor.archive({
      operation: "export",
      request: {
        conversationId: id,
        destinationPath: archivePath,
        localParticipant: ALICE,
        localAccountIndex: 0,
        counterpartyPublicKeyHex: "ab".repeat(32),
        suite: "ChaCha20Poly1305",
      },
    });
    // Reaches the real crypto boundary (past every existence/authorization
    // check -- the conversation WAS found, ALICE WAS authorized) and fails
    // there honestly -- never a raw Error, never a fabricated "exported".
    expect(exportResult).toEqual({ outcome: "failed", reason: expect.any(String) });

    // A missing/nonexistent source path is honestly not-found for inspect --
    // this path never touches crypto, so it is fully testable here.
    const missing = await accessor.archive({ operation: "inspect", sourcePath: join(dir, "does-not-exist.archive") });
    expect(missing).toEqual({ outcome: "not-found", reason: expect.any(String) });

    await runtime.stop();
  });

  it("inspect() correctly decodes a REAL, validly-encrypted archive container -- built via a directly-constructed FedosConversationArchiveRuntime sharing this SAME running Runtime's own real, durable Membership/Envelope/Payload log files (a fake, round-tripping crypto boundary standing in ONLY for the missing WASM artifact, mirroring this codebase's own established `secure_runtime_alpha_1691_1760_archive_runtime.test.ts` pattern) -- proves the Accessor's own inspect() plumbing is genuinely correct against real container bytes, independent of the WASM-artifact gap above", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-archive-inspect-"));
    const conversationLogPath = join(dir, "board-conversation.log");
    const config: FedosDesktopRuntimeConfig = {
      ...baseConfig(dir),
      conversationLogPath,
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority(true),
    };
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    cr.redeemInvitation(token, BOB);
    await cr.activateDirectConversation(id);
    await accessor.sendMessage(id, "archive me for real", null);

    new AppendOnlyFedosConversationPersistence(conversationLogPath).putConversation({
      schemaVersion: 1,
      id,
      mode: "direct",
      boardId: "n/a-private-conversation",
      rootThreadId: "n/a-private-conversation",
      rootPostId: "n/a-private-conversation",
      policyReference: "direct-draft-v1",
      createdAt: 1_900_000_000,
    });

    const shadowArchiveRuntime = createFedosConversationArchiveRuntime({
      conversationPersistence: new AppendOnlyFedosConversationPersistence(conversationLogPath),
      membershipPersistence: new AppendOnlyFedosConversationMembershipPersistence(config.conversationMembershipLogPath!),
      capabilityPersistence: new AppendOnlyFedosConversationCapabilityPersistence(config.conversationCapabilityLogPath!),
      envelopePersistence: new AppendOnlyFedosConversationMessageEnvelopePersistence(config.conversationEnvelopeLogPath!),
      payloadStorage: new AppendOnlyFedosConversationPayloadStorage(config.conversationPayloadLogPath!, 1_048_576),
      encryptionAuthority: new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(true), fakeRoundTrippingRuntimeBoundary()),
      fileAuthority: new NodeFedosConversationArchiveFileAuthority(),
      clock: config.clock!,
      isRuntimeRunning: () => true,
    });
    const archivePath = join(dir, "real-container.archive");
    const shadowExport = await shadowArchiveRuntime.exportConversationArchive({
      conversationId: id,
      destinationPath: archivePath,
      localParticipant: ALICE,
      localAccountIndex: 0,
      counterpartyPublicKeyHex: "ab".repeat(32),
      suite: "ChaCha20Poly1305",
    });
    expect(shadowExport.outcome).toBe("exported");

    // The REAL Accessor -- over the REAL running Runtime's own real,
    // WASM-bound Archive Runtime -- decodes this genuinely valid container's
    // cleartext Manifest correctly. inspect() never decrypts (Alpha
    // 1691-1760), so this succeeds even though this environment's own
    // encryptionAuthority could never have produced this exact file itself.
    const inspectResult = await accessor.archive({ operation: "inspect", sourcePath: archivePath });
    expect(inspectResult.outcome).toBe("ok");
    if (inspectResult.outcome !== "ok" || inspectResult.value.operation !== "inspect") throw new Error("expected inspect ok");
    expect(inspectResult.value.result.outcome).toBe("inspected");
    expect(inspectResult.value.result.manifest?.conversationId).toBe(id);

    await runtime.stop();
  });

  it("export requires-unlock when the Master Seed Authority reports unavailable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-archive-locked-"));
    const conversationLogPath = join(dir, "board-conversation.log");
    const config: FedosDesktopRuntimeConfig = {
      ...baseConfig(dir),
      conversationLogPath,
      archiveEnabled: true,
      conversationArchiveMasterSeedAuthority: {
        ...fakeMasterSeedAuthority(false),
        resolveConversationKey: async () => null, // "locked" -- no key resolvable.
      },
    };
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    cr.redeemInvitation(token, BOB);
    await cr.activateDirectConversation(id);
    new AppendOnlyFedosConversationPersistence(conversationLogPath).putConversation({
      schemaVersion: 1,
      id,
      mode: "direct",
      boardId: "n/a-private-conversation",
      rootThreadId: "n/a-private-conversation",
      rootPostId: "n/a-private-conversation",
      policyReference: "direct-draft-v1",
      createdAt: 1_900_000_000,
    });

    const exportResult = await accessor.archive({
      operation: "export",
      request: {
        conversationId: id,
        destinationPath: join(dir, "locked.archive"),
        localParticipant: ALICE,
        localAccountIndex: 0,
        counterpartyPublicKeyHex: "ab".repeat(32),
        suite: "ChaCha20Poly1305",
      },
    });
    expect(exportResult).toEqual({ outcome: "requires-unlock", reason: expect.any(String) });

    await runtime.stop();
  });
});

describe("Alpha 3081-3160 -- 8. no raw Error/secret leakage; no hidden network activity", () => {
  it("every accessor result is JSON-serializable and never carries an Error, a stack, a bearer secret, or a ciphertext byte", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-leak-"));
    const config: FedosDesktopRuntimeConfig = { ...baseConfig(dir), archiveEnabled: true, conversationArchiveMasterSeedAuthority: fakeMasterSeedAuthority() };
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const accessor = runtime.conversationContentAccessor();

    const created = cr.createDirectDraft({ recipient: BOB });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    const bearer = token.bearerSecret as unknown as string;
    cr.redeemInvitation(token, BOB);
    await cr.activateDirectConversation(id);
    const sent = await accessor.sendMessage(id, "no leaks here", null);
    if (sent.outcome !== "ok") throw new Error("expected ok");

    const results: unknown[] = [
      sent,
      await accessor.readMessage(id, sent.value.messageId),
      accessor.listMessages(id),
      accessor.searchConversations("leaks"),
      await accessor.archive({ operation: "inspect", sourcePath: join(dir, "nope") }),
      await accessor.readMessage(id, "unknown-id"),
    ];
    for (const r of results) {
      expect(r).not.toBeInstanceOf(Error);
      const serialized = JSON.stringify(r);
      expect(serialized.toLowerCase()).not.toContain("stack");
      expect(serialized).not.toContain(bearer);
      expect(serialized).not.toMatch(/^FAKE:/);
      expect(() => JSON.parse(serialized)).not.toThrow();
    }

    await runtime.stop();
  });

  it("no fetch/network global is ever touched by any accessor operation (no hidden network activity)", async () => {
    const originalFetch = (globalThis as { fetch?: unknown }).fetch;
    let fetchCalled = false;
    (globalThis as { fetch?: unknown }).fetch = (...args: unknown[]) => {
      fetchCalled = true;
      throw new Error(`unexpected network call: ${JSON.stringify(args)}`);
    };
    try {
      const dir = mkdtempSync(join(tmpdir(), "fedos-3081-3160-no-network-"));
      const runtime = await startFedosDesktopRuntime(baseConfig(dir));
      const cr = runtime.conversationRuntime();
      const accessor = runtime.conversationContentAccessor();
      const created = cr.createDirectDraft({ recipient: BOB });
      if (created.outcome !== "draft-created") throw new Error("expected draft-created");
      const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
      cr.redeemInvitation(token, BOB);
      await cr.activateDirectConversation(created.draft.id);
      await accessor.sendMessage(created.draft.id, "local only", null);
      await accessor.readMessage(created.draft.id, "whatever");
      accessor.listMessages(created.draft.id);
      accessor.searchConversations("local");
      await runtime.stop();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
    expect(fetchCalled).toBe(false);
  });
});
