/**
 * Secure Runtime Alpha 1111–1180 — Phase E/F: the real, application-level
 * vertical slice through `startFedosDesktopRuntime()` (Alpha 1148/1149/1157).
 *
 * Direct Draft -> Identity Resolution -> Durable Membership -> Capability
 * Admission -> Pairwise Key Readiness -> Activation Coordinator -> Active
 * Direct Conversation -> Encrypt -> Envelope Metadata + Opaque Payload ->
 * Restart -> Authorized Decrypt/Read.
 *
 * Runs entirely IN-PROCESS (never spawns a real OS subprocess) -- Alpha
 * 1149's own documented escape hatch: "If command injection for send/read
 * is not supported, test the same graph in-process and document the
 * subprocess boundary." This repository's `start:runtime` CLI entry point
 * (`run_fedos_desktop_runtime.ts`) accepts no send/read command of any kind
 * (this Arc ships no CLI/Worker/GUI, per its own Absolute Prohibitions), so
 * there is no real subprocess boundary for this Arc's own new commands to
 * cross in the first place -- `startFedosDesktopRuntime()` IS the real
 * production entry point this test drives directly.
 *
 * Uses `FakeConversationEncryptionAuthority`/`DecryptionAuthority` test
 * doubles injected through the config, mirroring every other coordinator
 * test in this suite -- no WASM artifact exists in this checked-out tree
 * (see the integrated inventory's own §5); the real
 * `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority` slot into
 * the SAME `conversationEncryptionAuthority`/`conversationDecryptionAuthority`
 * config fields unchanged once a real Master Seed Authority is available.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { toFedosConversationInvitationToken } from "../src/conversation/invitation/fedos_conversation_invitation_token.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

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

function baseConfig(): FedosDesktopRuntimeConfig {
  const dir = mkdtempSync(join(tmpdir(), "fedos-1111-1180-vertical-"));
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
    clock: () => 1_713_000_000,
  };
}

describe("Alpha 1148/1149/1157 -- full vertical slice through the real Local/Desktop Runtime", () => {
  it("1. Direct Draft -> invitation -> redemption -> activation -> send -> restart -> authorized decrypt", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();

    // Direct Draft -- creator + recipient-bound Capability, never active yet.
    const created = cr.createDirectDraft({ recipient: BOB });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    expect(created.draft.lifecycleState).toBe("draft");
    expect(created.capability).toBeDefined();

    // Capability Admission -- BOB redeems the recipient-bound invitation.
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    expect(cr.redeemInvitation(token, BOB).outcome).toBe("redeemed");
    expect(cr.listMemberships(id).filter((m) => m.state === "active")).toHaveLength(2);

    // Before activation, sending/reading is honestly denied -- never a silent success.
    expect((await cr.sendDirectMessage({ conversationId: id, body: "too early", replyToEnvelopeId: null })).outcome).toBe("conversation-not-active");

    // Activation Coordinator -- every readiness fact proven, then Active Direct Conversation.
    expect(await cr.activateDirectConversation(id)).toEqual({ outcome: "activated" });
    expect(await cr.activateDirectConversation(id)).toEqual({ outcome: "already-active" });
    // The immutable draft record's own lifecycleState is UNCHANGED -- activation
    // is a separate durable fact, never a rewrite (Alpha 1116).
    expect(cr.findConversation(id)!.lifecycleState).toBe("draft");

    // Encrypt -> Envelope Metadata + Opaque Payload.
    const sent = await cr.sendDirectMessage({ conversationId: id, body: "hello bob, this is alice", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") throw new Error("expected sent-locally");

    const summariesBeforeRestart = cr.listDirectMessages(id);
    expect(summariesBeforeRestart).toHaveLength(1);
    expect(summariesBeforeRestart[0]!.envelopeId).toBe(sent.envelopeId);

    await runtime.stop();

    // Restart -- fresh Runtime instances over the SAME durable files.
    const restarted = await startFedosDesktopRuntime(config);
    const cr2 = restarted.conversationRuntime();

    // Lifecycle remains active; readiness remains valid.
    expect(await cr2.activateDirectConversation(id)).toEqual({ outcome: "already-active" });

    // Authorized Decrypt/Read -- exact plaintext match.
    const read = await cr2.readDirectMessage({ conversationId: id, envelopeId: sent.envelopeId });
    expect(read.outcome).toBe("decrypted");
    if (read.outcome !== "decrypted") throw new Error("expected decrypted");
    expect(new TextDecoder().decode(read.plaintext)).toBe("hello bob, this is alice");

    // No duplicate write from restart recovery.
    expect(cr2.listDirectMessages(id)).toHaveLength(1);

    await restarted.stop();

    // No bearer secret, no plaintext, in ANY durable log.
    const bearer = token.bearerSecret as unknown as string;
    for (const file of [
      config.conversationDraftLogPath!,
      config.conversationMembershipLogPath!,
      config.conversationCapabilityLogPath!,
      config.conversationEnvelopeLogPath!,
      config.conversationPayloadLogPath!,
      config.conversationActivationCoordinationLogPath!,
    ]) {
      const contents = readFileSync(file, "utf8") as string;
      expect(contents).not.toContain(bearer);
      expect(contents).not.toContain("hello bob, this is alice");
    }
  });

  it("2. private-group draft never activates and public/local draft management remain unaffected", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();

    const created = cr.createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");

    expect(await cr.activateDirectConversation(created.draft.id)).toEqual({ outcome: "unsupported-mode" });
    expect((await cr.sendDirectMessage({ conversationId: created.draft.id, body: "x", replyToEnvelopeId: null })).outcome).toBe("conversation-not-active");

    // Draft read/management (Alpha 891–1050, pre-existing) is fully unaffected.
    expect(cr.findConversation(created.draft.id)).not.toBeNull();
    expect(cr.listDrafts().some((d) => d.id === created.draft.id)).toBe(true);

    // Public Board Runtime is unaffected -- still constructible and reachable
    // through the SAME running Local Runtime, entirely independent of the
    // private-Conversation graph above (full public-path regression is
    // covered by this repository's own pre-existing Board Runtime suites,
    // run unmodified as part of `npm test`).
    expect(typeof runtime.boardRuntime).toBe("function");
    expect(runtime.boardRuntime()).not.toBeNull();

    await runtime.stop();
  });

  it("3. missing crypto configuration -- direct activation/messaging stays unavailable, public/draft use remains unaffected (Alpha 1115/1162)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-1111-1180-no-crypto-"));
    const config: FedosDesktopRuntimeConfig = {
      boardLogPath: join(dir, "board.log"),
      outboxLogPath: join(dir, "outbox.log"),
      deliveryEnabled: false,
      conversationDraftLogPath: join(dir, "draft.log"),
      conversationMembershipLogPath: join(dir, "membership.log"),
      conversationCapabilityLogPath: join(dir, "capability.log"),
      conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(ALICE),
      // No conversationEncryptionAuthority/conversationDecryptionAuthority supplied.
      clock: () => 1_713_000_100,
    };
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();

    const created = cr.createDirectDraft({ recipient: BOB });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    expect(cr.redeemInvitation(token, BOB).outcome).toBe("redeemed");

    expect(await cr.activateDirectConversation(created.draft.id)).toEqual({ outcome: "encryption-unavailable" });
    expect((await cr.sendDirectMessage({ conversationId: created.draft.id, body: "x", replyToEnvelopeId: null })).outcome).toBe("conversation-not-active");

    // Draft creation/read/invitation remain fully usable without any crypto configured.
    expect(cr.findConversation(created.draft.id)).not.toBeNull();

    await runtime.stop();
  });
});
