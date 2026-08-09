/**
 * Secure Runtime Alpha 949 — Encryption Runtime Wiring. Confirms
 * `FedosConversationRuntime.encryptMessage()`/`decryptMessage()` are
 * reachable through `runtime.conversationRuntime()` (the SAME pattern
 * `createPrivateGroupDraft()`/`createDirectDraft()` already established),
 * that `assembleFedosConversationRuntimeDependencies()`'s EXISTING,
 * unmodified call shape (no new REQUIRED config) continues to build a
 * working runtime, and that the DEFAULT wiring is fail-closed end to end
 * over a REAL private-group draft this repository's own real construction
 * pipeline can actually build (still `"draft"`, never `"active"` --
 * `encryptMessage()` on it is expected, honestly, to fail closed).
 *
 * Secure Runtime Alpha 1111–1180 -- test 4 below originally hand-wrote
 * `lifecycleState: "active"` directly onto a persisted draft record to
 * prove the gate's wiring was real, not merely type-level, because
 * nothing in this repository could construct genuine activation yet. That
 * bypass is now genuinely obsolete: the draft record's own
 * `lifecycleState` field is NEVER consulted for this gate anymore (Alpha
 * 1116) -- `resolveFedosConversationActiveConversation()`
 * (`../src/conversation/activation/fedos_conversation_active_lookup.ts`)
 * consults a SEPARATE, durable Activation fact instead. Updated to prove
 * the identical property (the wiring is real, not merely type-level)
 * through the NEW mechanism.
 */
import { describe, it, expect } from "vitest";
import { createFedosConversationRuntime } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationRuntimeDependencies } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime_assembly.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js";
import { fedosConversationActivationId } from "../src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.js";

const clock = () => 1_700_005_000;

describe("Alpha 949 -- FedosConversationRuntime.encryptMessage()/decryptMessage() default wiring", () => {
  it("1. an EXISTING caller's config shape (no new fields at all) still builds a runtime that exposes both methods", async () => {
    const runtime = createFedosConversationRuntime(assembleFedosConversationRuntimeDependencies({ clock }));
    expect(typeof runtime.encryptMessage).toBe("function");
    expect(typeof runtime.decryptMessage).toBe("function");
  });

  it("2. a real private-group draft this repository's own construction pipeline builds is genuinely 'draft', so encryptMessage() fails closed to 'conversation-not-active' -- never throws, never fakes success", async () => {
    const runtime = createFedosConversationRuntime(assembleFedosConversationRuntimeDependencies({ clock }));
    const created = runtime.createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") return;

    const result = await runtime.encryptMessage({
      conversationId: created.draft.id,
      plaintext: new TextEncoder().encode("hello"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    expect(result).toEqual({ outcome: "conversation-not-active" });
  });

  it("3. decryptMessage() against an unknown envelope id on that SAME real runtime fails closed to 'envelope-not-found'", async () => {
    const runtime = createFedosConversationRuntime(assembleFedosConversationRuntimeDependencies({ clock }));
    const created = runtime.createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") return;

    const result = await runtime.decryptMessage({ conversationId: created.draft.id, envelopeId: "never-existed" });
    expect(result).toEqual({ outcome: "envelope-not-found" });
  });

  it("4. a hand-built ACTIVE fixture (draft record + completed Activation fact) injected directly into the SAME backends the runtime already holds is reachable through encryptMessage() -- confirms the wiring is real, not merely type-level", async () => {
    const deps = assembleFedosConversationRuntimeDependencies({ clock });
    const runtime = createFedosConversationRuntime(deps);

    const draftRecord: FedosPersistedConversationDraftRecordV1 = {
      schemaVersion: 1,
      id: "private-draft::direct::alpha-949-active",
      mode: "direct",
      lifecycleState: "draft",
      policyReference: "direct-draft-v1",
      creatorAuthority: "fedos",
      creatorPublicIdentifier: "anonymous-local",
      creatorIdentityId: null,
      createdAt: 1_700_005_000,
    };
    // Writes directly into the SAME `FedosConversationDraftPersistence` AND
    // `FedosConversationActivationPersistence` instances `deps` (and
    // therefore the Runtime built over it) already holds -- both dumb,
    // unvalidated ports `assembleFedosConversationRuntimeDependencies()`
    // itself constructs. No new constructor parameter is added anywhere.
    deps.draftPersistence.putDraft(draftRecord);
    const activationId = fedosConversationActivationId(draftRecord.id);
    deps.activationPersistence!.putActivationFact({
      schemaVersion: 1,
      activationId,
      conversationId: draftRecord.id,
      phase: "completed",
      startedAt: 1_700_005_000,
      updatedAt: 1_700_005_000,
    });

    const result = await runtime.encryptMessage({
      conversationId: draftRecord.id,
      plaintext: new TextEncoder().encode("hi"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    // No Membership exists for any local participant on this hand-built
    // Conversation, so this reaches PAST the activation gate and fails
    // closed on the NEXT real check -- proving `encryptMessage()` truly
    // reached "active" and moved on to identity/Membership resolution, not
    // that the activation gate was bypassed.
    expect(result).toEqual({ outcome: "not-member" });
  });
});
