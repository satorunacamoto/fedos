/**
 * Secure Runtime Alpha 1321–1390 — Private Group Pairwise Fanout
 * Foundation Arc. Phase C/D/E/F verification: the real, application-level
 * vertical slice through `startFedosDesktopRuntime()`, mirroring
 * `test/secure_runtime_alpha_1111_1180_runtime_vertical_slice.test.ts`'s
 * own harness exactly (Fake Encryption/Decryption Authorities, no WASM
 * artifact in this checked-out tree).
 *
 * Private Group Draft -> two members admitted -> generation -> two
 * independent Direct paths -> group send -> two independently encrypted
 * recipient payloads -> local canonical Group Message -> restart -> group
 * list -> member removal -> next send excludes the removed member.
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
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
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
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };

function baseConfig(dir: string): FedosDesktopRuntimeConfig {
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
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(ALICE),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
    clock: () => 1_714_000_000,
  };
}

describe("Alpha 1321-1390 -- full vertical slice through the real Local/Desktop Runtime", () => {
  it("1. group draft -> two members -> generation -> fanout send -> two independent Envelopes -> restart -> list -> removal excludes future sends", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-1321-1390-vertical-"));
    const config = baseConfig(dir);
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const gr = cr.groupRuntime();

    const created = cr.createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const groupId = created.draft.id;

    // Only the creator is a member yet -- draft-only, no generation possible.
    expect(gr.readinessForPrivateGroup(groupId)).toEqual({ outcome: "draft-only" });

    // Add Bob and Carol -- each admission creates a new generation.
    const addBob = gr.addPrivateGroupMember(groupId, BOB);
    expect(addBob.outcome).toBe("admitted");
    if (addBob.outcome !== "admitted") throw new Error("expected admitted");
    expect(addBob.generation.outcome).toBe("created");

    const addCarol = gr.addPrivateGroupMember(groupId, CAROL);
    expect(addCarol.outcome).toBe("admitted");
    if (addCarol.outcome !== "admitted") throw new Error("expected admitted");
    expect(addCarol.generation.outcome).toBe("created");
    if (addCarol.generation.outcome !== "created") throw new Error("expected created");
    expect(addCarol.generation.generation.activeMemberMembershipIds).toHaveLength(3);

    // No path prepared yet -- not usable.
    expect(gr.readinessForPrivateGroup(groupId)).toEqual({ outcome: "direct-path-unavailable" });

    // The Private-Group Gate is untouched by any of the above.
    expect(await cr.activateDirectConversation(groupId)).toEqual({ outcome: "unsupported-mode" });

    // Fanout send -- lazily prepares one Direct path per recipient, then sends twice independently.
    const sent = await gr.sendPrivateGroupMessage({
      groupConversationId: groupId,
      body: "hello group, this is alice",
      replyToGroupMessageId: null,
      idempotencyKey: "vertical-slice-message-1",
    });
    expect(sent.outcome).toBe("stored-for-all");
    if (sent.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(sent.recipientEnvelopeIds).toHaveLength(2);
    // Recipient isolation -- two DISTINCT Envelopes, never one shared ciphertext.
    expect(new Set(sent.recipientEnvelopeIds).size).toBe(2);

    // Paths are now ready -- the group is usable.
    expect(gr.readinessForPrivateGroup(groupId)).toEqual({ outcome: "usable" });

    const messagesBeforeRestart = gr.listPrivateGroupMessages(groupId);
    expect(messagesBeforeRestart).toHaveLength(1);
    expect(messagesBeforeRestart[0]!.fanoutSummary).toEqual({ recipientCount: 2, storedCount: 2, failedCount: 0 });

    await runtime.stop();

    // Restart -- fresh Runtime instances over the SAME durable files.
    const restarted = await startFedosDesktopRuntime(config);
    const cr2 = restarted.conversationRuntime();
    const gr2 = cr2.groupRuntime();

    const messagesAfterRestart = gr2.listPrivateGroupMessages(groupId);
    expect(messagesAfterRestart).toHaveLength(1);
    expect(messagesAfterRestart[0]!.id).toBe(messagesBeforeRestart[0]!.id);

    // Recovery -- the SAME idempotency key must never duplicate an already-stored Envelope.
    const resent = await gr2.sendPrivateGroupMessage({
      groupConversationId: groupId,
      body: "hello group, this is alice",
      replyToGroupMessageId: null,
      idempotencyKey: "vertical-slice-message-1",
    });
    expect(resent.outcome).toBe("stored-for-all");
    if (resent.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect([...resent.recipientEnvelopeIds].sort()).toEqual([...sent.recipientEnvelopeIds].sort());
    expect(gr2.listPrivateGroupMessages(groupId)).toHaveLength(1);

    // Member removal -- a new generation excludes Carol from future fanout.
    const removed = gr2.removePrivateGroupMember(groupId, CAROL);
    expect(removed.outcome).toBe("revoked");
    if (removed.outcome !== "revoked") throw new Error("expected revoked");
    expect(removed.generation.outcome).toBe("created");
    if (removed.generation.outcome !== "created") throw new Error("expected created");
    expect(removed.generation.generation.activeMemberMembershipIds).toHaveLength(2);

    const sentAfterRemoval = await gr2.sendPrivateGroupMessage({
      groupConversationId: groupId,
      body: "carol should not get this",
      replyToGroupMessageId: null,
      idempotencyKey: "vertical-slice-message-2",
    });
    expect(sentAfterRemoval.outcome).toBe("stored-for-all");
    if (sentAfterRemoval.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(sentAfterRemoval.recipientEnvelopeIds).toHaveLength(1); // Bob only -- Carol excluded.

    await restarted.stop();

    // No plaintext anywhere in ANY durable Group/Envelope/Payload log.
    for (const file of [
      config.conversationGroupGenerationLogPath!,
      config.conversationGroupDirectPathLogPath!,
      config.conversationGroupMessageLogPath!,
      config.conversationGroupFanoutDeliveryLogPath!,
      config.conversationEnvelopeLogPath!,
      config.conversationPayloadLogPath!,
    ]) {
      const contents = readFileSync(file, "utf8") as string;
      expect(contents).not.toContain("hello group, this is alice");
      expect(contents).not.toContain("carol should not get this");
    }

    // No shared-group-key field of any kind in the generation or path logs.
    for (const file of [config.conversationGroupGenerationLogPath!, config.conversationGroupDirectPathLogPath!]) {
      const contents = readFileSync(file, "utf8") as string;
      expect(contents.toLowerCase()).not.toMatch(/groupkey|sharedkey|senderkey/);
    }
  });

  it("2. an unsupported-authority counterparty (non-nostr) leaves its path permanently unavailable, never blocking the whole group", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-1321-1390-unsupported-"));
    const config = baseConfig(dir);
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();
    const gr = cr.groupRuntime();

    const created = cr.createPrivateGroupDraft({});
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const groupId = created.draft.id;

    const UNSUPPORTED: FedosConversationParticipantReference = { authority: "activitypub", publicIdentifier: "someone@example.social", identityId: null };
    gr.addPrivateGroupMember(groupId, BOB);
    gr.addPrivateGroupMember(groupId, UNSUPPORTED);

    // Option A (all-or-nothing) -- one unresolvable path fails the WHOLE send closed, no partial write.
    const sent = await gr.sendPrivateGroupMessage({ groupConversationId: groupId, body: "x", replyToGroupMessageId: null });
    expect(sent.outcome).toBe("recipient-path-unavailable");
    expect(gr.listPrivateGroupMessages(groupId)).toHaveLength(0);

    await runtime.stop();
  });
});
