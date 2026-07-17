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
 */
import { describe, it, expect } from "vitest";
import { createFedosConversationRuntime } from "../src/conversation/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationRuntimeDependencies } from "../src/conversation/runtime/fedos_conversation_runtime_assembly.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";

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

  it("4. a hand-built ACTIVE fixture injected directly into the SAME draftPersistence the runtime already holds is reachable through encryptMessage() -- confirms the wiring is real, not merely type-level", async () => {
    const deps = assembleFedosConversationRuntimeDependencies({ clock });
    const runtime = createFedosConversationRuntime(deps);

    const activeRecord: FedosPersistedConversationDraftRecordV1 = {
      schemaVersion: 1,
      id: "private-draft::direct::alpha-949-active",
      mode: "direct",
      lifecycleState: "active",
      policyReference: "direct-draft-v1",
      creatorAuthority: "fedos",
      creatorPublicIdentifier: "anonymous-local",
      creatorIdentityId: null,
      createdAt: 1_700_005_000,
    };
    // Writes directly into the SAME `FedosConversationDraftPersistence`
    // instance `deps` (and therefore the Runtime built over it) already
    // holds -- the dumb, unvalidated port `assembleFedosConversationRuntimeDependencies()`
    // itself constructs. No new constructor parameter is added anywhere.
    deps.draftPersistence.putDraft(activeRecord);

    const result = await runtime.encryptMessage({
      conversationId: activeRecord.id,
      plaintext: new TextEncoder().encode("hi"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    // No Membership exists for any local participant on this hand-built
    // Conversation, so this reaches PAST the lifecycle gate and fails
    // closed on the NEXT real check -- proving `encryptMessage()` truly
    // reached `lifecycleState === "active"` and moved on to identity/
    // Membership resolution, not that the lifecycle gate was bypassed.
    expect(result).toEqual({ outcome: "not-member" });
  });
});
