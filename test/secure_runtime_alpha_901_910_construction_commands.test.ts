/**
 * Secure Runtime Alpha 901–910 — Phase B gate: private-group and direct
 * draft commands, caller-field prohibitions, identity failure, duplicate
 * (idempotent) construction, recipient-bound Capability, no active
 * lifecycle, no bearer in the durable record, no messages/encryption.
 */

import { describe, it, expect } from "vitest";
import { assembleFedosConversationRuntimeDependencies } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime_assembly.js";
import { createFedosConversationRuntime } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime.js";
import {
  StaticFedosConversationCreatorIdentityAuthority,
  type FedosConversationCreatorIdentityAuthority,
  type FedosConversationCreatorIdentityResolution,
} from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";

const FIXED_NOW = 1_700_000_500;
const clock = () => FIXED_NOW;

function makeRuntime(overrides: Partial<Parameters<typeof assembleFedosConversationRuntimeDependencies>[0]> = {}) {
  const deps = assembleFedosConversationRuntimeDependencies({ clock, ...overrides });
  return { runtime: createFedosConversationRuntime(deps), deps };
}

class UnavailableCreatorIdentityAuthority implements FedosConversationCreatorIdentityAuthority {
  resolveCreator(): FedosConversationCreatorIdentityResolution {
    return { outcome: "unavailable" };
  }
}

describe("Alpha 901/905 — private-group draft", () => {
  it("creates a draft with a durable owner creator Membership, no capability requested", () => {
    const { runtime, deps } = makeRuntime();
    const result = runtime.createPrivateGroupDraft({ idempotencyKey: "pg-1" });
    expect(result.outcome).toBe("draft-created");
    if (result.outcome !== "draft-created") return;
    expect(result.draft.mode).toBe("private-group");
    expect(result.draft.lifecycleState).toBe("draft");
    expect(result.ownerMembership.role).toBe("owner");
    expect(result.ownerMembership.state).toBe("active");
    expect(result.capability).toBeUndefined();
    expect(result.readiness.overall).toBe("draft-ready");
    // Owner Membership is durable and idempotent.
    const memberships = deps.membershipAuthority.listMemberships(result.draft.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.role).toBe("owner");
  });

  it("optionally issues a general join Capability and returns the bearer exactly once", () => {
    const { runtime } = makeRuntime();
    const result = runtime.createPrivateGroupDraft({ idempotencyKey: "pg-2", initialCapability: { maxUses: 5, expiresAt: null } });
    expect(result.outcome).toBe("draft-created");
    if (result.outcome !== "draft-created") return;
    expect(result.capability).toBeDefined();
    expect(result.capability!.descriptor.intendedRecipient).toBeNull();
    expect(result.capability!.descriptor.maxUses).toBe(5);
    expect(typeof result.capability!.bearerSecret).toBe("string");
    expect(result.readiness.overall).toBe("draft-ready");
  });
});

describe("Alpha 902/906/907 — direct draft", () => {
  it("admits the creator and binds the recipient via an intendedRecipient Capability (never a fabricated Membership)", () => {
    const { runtime, deps } = makeRuntime();
    const result = runtime.createDirectDraft({ idempotencyKey: "d-1", recipient: { authority: "nostr", publicIdentifier: "npub-recipient" } });
    expect(result.outcome).toBe("draft-created");
    if (result.outcome !== "draft-created") return;
    expect(result.draft.mode).toBe("direct");
    expect(result.capability).toBeDefined();
    expect(result.capability!.descriptor.intendedRecipient).toEqual({ authority: "nostr", publicIdentifier: "npub-recipient", identityId: null });
    expect(result.capability!.descriptor.maxUses).toBe(1);
    // Only the creator is an active Member — the recipient is NOT fabricated.
    const memberships = deps.membershipAuthority.listMemberships(result.draft.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.participant.publicIdentifier).not.toBe("npub-recipient");
  });

  it("rejects a direct draft whose recipient equals the creator", () => {
    const creator = { authority: "fedos" as const, publicIdentifier: "same", identityId: null };
    const { runtime } = makeRuntime({ creatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(creator) });
    const result = runtime.createDirectDraft({ recipient: { authority: "fedos", publicIdentifier: "same" } });
    expect(result.outcome).toBe("invalid-command");
  });
});

describe("Alpha 901/903 — caller-field prohibitions and invalid commands", () => {
  it("rejects a malformed initial capability request", () => {
    const { runtime } = makeRuntime();
    expect(runtime.createPrivateGroupDraft({ initialCapability: { maxUses: 0, expiresAt: null } }).outcome).toBe("invalid-command");
  });

  it("rejects a malformed direct recipient", () => {
    const { runtime } = makeRuntime();
    expect(runtime.createDirectDraft({ recipient: { authority: "not-a-real-authority" as never, publicIdentifier: "x" } }).outcome).toBe("invalid-command");
  });

  it("rejects an idempotency key containing the reserved separator", () => {
    const { runtime } = makeRuntime();
    expect(runtime.createPrivateGroupDraft({ idempotencyKey: "a::b" }).outcome).toBe("invalid-command");
  });
});

describe("Alpha 904 — creator identity authority", () => {
  it("fails closed when identity is unavailable — NO durable write", () => {
    const { runtime, deps } = makeRuntime({ creatorIdentityAuthority: new UnavailableCreatorIdentityAuthority() });
    const result = runtime.createPrivateGroupDraft({ idempotencyKey: "id-x" });
    expect(result.outcome).toBe("identity-unavailable");
    expect(deps.draftPersistence.listDrafts()).toHaveLength(0);
  });

  it("fails closed for anonymous-local when a resolved identity is required", () => {
    const { runtime } = makeRuntime({ requireResolvedCreatorIdentity: true });
    expect(runtime.createPrivateGroupDraft({ idempotencyKey: "id-y" }).outcome).toBe("identity-unavailable");
  });
});

describe("Alpha 909 — duplicate construction is idempotent", () => {
  it("a retried command with the same idempotency key returns already-present, never a second draft/Membership/Capability", () => {
    const { runtime, deps } = makeRuntime();
    const first = runtime.createDirectDraft({ idempotencyKey: "dup-1", recipient: { authority: "nostr", publicIdentifier: "npub-r" } });
    expect(first.outcome).toBe("draft-created");
    const second = runtime.createDirectDraft({ idempotencyKey: "dup-1", recipient: { authority: "nostr", publicIdentifier: "npub-r" } });
    expect(second.outcome).toBe("already-present");
    if (second.outcome !== "already-present") return;
    // No bearer re-issued on replay.
    expect(second.capability).toBeUndefined();
    expect(deps.draftPersistence.listDrafts()).toHaveLength(1);
    expect(deps.membershipAuthority.listMemberships(second.draft.id)).toHaveLength(1);
  });
});

describe("Alpha 903/928 — no active lifecycle, no bearer in the durable record", () => {
  it("never produces an active lifecycle state and never stores a bearer secret on the draft record", () => {
    const { runtime, deps } = makeRuntime();
    const result = runtime.createPrivateGroupDraft({ idempotencyKey: "sec-1", initialCapability: { maxUses: 1, expiresAt: null } });
    expect(result.outcome).toBe("draft-created");
    if (result.outcome !== "draft-created") return;
    const bearer = result.capability!.bearerSecret as string;
    const persisted = deps.draftPersistence.getDraft(result.draft.id);
    expect(persisted!.lifecycleState).toBe("draft");
    // The full serialized record must not contain the bearer anywhere.
    expect(JSON.stringify(persisted)).not.toContain(bearer);
  });
});
