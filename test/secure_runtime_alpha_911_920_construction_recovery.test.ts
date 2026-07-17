/**
 * Secure Runtime Alpha 911–920 — Phase C gate: durable construction
 * coordination, real restart recovery for both modes, no duplicate
 * creator Membership, no duplicate Capability, draft lifecycle preserved,
 * corruption fails closed, no active state, no message payload.
 */

import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { assembleFedosConversationRuntimeDependencies } from "../src/conversation/runtime/fedos_conversation_runtime_assembly.js";
import { createFedosConversationRuntime } from "../src/conversation/runtime/fedos_conversation_runtime.js";
import { FedosPrivateConversationConstructionCoordinator } from "../src/conversation/construction/fedos_private_conversation_construction_coordinator.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationConstructionCoordinationPersistence } from "../src/conversation/construction/coordination/in_memory_fedos_conversation_construction_coordination_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationCapabilityAuthority } from "../src/conversation/capability/in_memory_fedos_conversation_capability_authority.js";
import { AnonymousLocalFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { UnavailableFedosConversationEncryptionReadinessAuthority } from "../src/conversation/readiness/fedos_conversation_encryption_readiness_authority.js";
import { FedosSecureRandomConstructionIdGenerator } from "../src/conversation/construction/fedos_private_conversation_construction_coordinator.js";
import {
  FedosSecureRandomCapabilityIdGenerator,
  FedosSecureRandomCapabilitySecretGenerator,
} from "../src/conversation/runtime/fedos_conversation_capability_generators.js";

const clock = () => 1_700_001_000;

function tempPaths() {
  const dir = mkdtempSync(join(tmpdir(), "fedos-pcc-"));
  return {
    draftLogPath: join(dir, "draft.log"),
    membershipLogPath: join(dir, "membership.log"),
    capabilityLogPath: join(dir, "capability.log"),
    constructionCoordinationLogPath: join(dir, "coordination.log"),
  };
}

describe("Alpha 914/917/920 — durable restart recovery (private-group)", () => {
  it("a fresh runtime over the SAME logs recovers the draft with no duplicate Membership/Capability", () => {
    const paths = tempPaths();
    const runtimeA = createFedosConversationRuntime(assembleFedosConversationRuntimeDependencies({ clock, ...paths }));
    const created = runtimeA.createPrivateGroupDraft({ idempotencyKey: "pg-restart", initialCapability: { maxUses: 3, expiresAt: null } });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") return;
    const id = created.draft.id;

    // "Restart": brand-new runtime + backends over the same files.
    const depsB = assembleFedosConversationRuntimeDependencies({ clock, ...paths });
    const runtimeB = createFedosConversationRuntime(depsB);
    expect(runtimeB.findConversation(id)!.lifecycleState).toBe("draft");
    expect(runtimeB.constructionStatus(id)).toBe("draft-completed");
    expect(runtimeB.listMemberships(id)).toHaveLength(1);

    // Re-running the identical command converges to already-present, no dupes.
    const replay = runtimeB.createPrivateGroupDraft({ idempotencyKey: "pg-restart", initialCapability: { maxUses: 3, expiresAt: null } });
    expect(replay.outcome).toBe("already-present");
    expect(depsB.draftPersistence.listDrafts()).toHaveLength(1);
    expect(depsB.membershipAuthority.listMemberships(id)).toHaveLength(1);
    // Exactly one issued Capability recorded on the coordination fact.
    const status = runtimeB.issuedCapabilityDescriptors(id, created.draft.creator);
    expect(status).toHaveLength(1);
  });
});

describe("Alpha 917/920 — durable restart recovery (direct)", () => {
  it("recovers a direct draft and its recipient-bound Capability across restart, no duplicates", () => {
    const paths = tempPaths();
    const runtimeA = createFedosConversationRuntime(assembleFedosConversationRuntimeDependencies({ clock, ...paths }));
    const created = runtimeA.createDirectDraft({ idempotencyKey: "d-restart", recipient: { authority: "nostr", publicIdentifier: "npub-x" } });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") return;
    const id = created.draft.id;

    const depsB = assembleFedosConversationRuntimeDependencies({ clock, ...paths });
    const runtimeB = createFedosConversationRuntime(depsB);
    const replay = runtimeB.createDirectDraft({ idempotencyKey: "d-restart", recipient: { authority: "nostr", publicIdentifier: "npub-x" } });
    expect(replay.outcome).toBe("already-present");
    // No second capability minted on recovery.
    expect(depsB.membershipAuthority.listMemberships(id)).toHaveLength(1);
    const descriptors = runtimeB.issuedCapabilityDescriptors(id, created.draft.creator);
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]!.intendedRecipient!.publicIdentifier).toBe("npub-x");
  });
});

describe("Alpha 916 — forward recovery from partial construction", () => {
  it("a direct draft built without a Capability authority is partial, then completes when one is available", () => {
    // Shared, durable-ish (in-memory but shared across both coordinators) backends.
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const coordinationPersistence = new InMemoryFedosConversationConstructionCoordinationPersistence();
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const shared = {
      draftPersistence,
      coordinationPersistence,
      membershipAuthority,
      creatorIdentityAuthority: new AnonymousLocalFedosConversationCreatorIdentityAuthority(),
      encryptionReadinessAuthority: new UnavailableFedosConversationEncryptionReadinessAuthority(),
      idGenerator: new FedosSecureRandomConstructionIdGenerator(),
      clock,
    };

    // Attempt 1 — NO capability authority: direct construction is partial.
    const coordinatorA = new FedosPrivateConversationConstructionCoordinator(shared);
    const first = coordinatorA.createDirectDraft({ idempotencyKey: "d-partial", recipient: { authority: "nostr", publicIdentifier: "npub-p" } });
    expect(first.outcome).toBe("partial-construction");
    if (first.outcome !== "partial-construction") return;
    expect(first.detail).toBe("recipient-capability-pending");
    expect(first.ownerMembership).not.toBeNull();
    expect(draftPersistence.listDrafts()).toHaveLength(1);

    // Attempt 2 — same backends, now WITH a capability authority: completes forward.
    const capabilityIssuerAuthority = new InMemoryFedosConversationCapabilityAuthority({
      idGenerator: new FedosSecureRandomCapabilityIdGenerator(),
      secretGenerator: new FedosSecureRandomCapabilitySecretGenerator(),
      existenceCheck: (cid) => draftPersistence.getDraft(cid) !== null,
      authorizationCheck: (cid, issuer) => {
        const m = membershipAuthority.findMembership(cid, issuer);
        return m !== null && m.state === "active" && (m.role === "owner" || m.role === "moderator");
      },
      membershipAuthority,
    });
    const coordinatorB = new FedosPrivateConversationConstructionCoordinator({ ...shared, capabilityIssuerAuthority });
    const second = coordinatorB.createDirectDraft({ idempotencyKey: "d-partial", recipient: { authority: "nostr", publicIdentifier: "npub-p" } });
    expect(second.outcome).toBe("draft-created");
    if (second.outcome !== "draft-created") return;
    expect(second.capability).toBeDefined();
    // Still exactly one draft, one creator Membership.
    expect(draftPersistence.listDrafts()).toHaveLength(1);
    expect(membershipAuthority.listMemberships(second.draft.id)).toHaveLength(1);
  });
});

describe("Alpha 918 — corruption fails closed", () => {
  it("a corrupt draft log line throws on replay, never silently repaired", () => {
    const paths = tempPaths();
    const runtime = createFedosConversationRuntime(assembleFedosConversationRuntimeDependencies({ clock, ...paths }));
    runtime.createPrivateGroupDraft({ idempotencyKey: "corrupt-1" });
    appendFileSync(paths.draftLogPath, "this-is-not-json\n", "utf8");
    const freshDeps = assembleFedosConversationRuntimeDependencies({ clock, ...paths });
    expect(() => freshDeps.draftPersistence.listDrafts()).toThrow();
  });

  it("an empty/missing log is NOT corruption", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-pcc-empty-"));
    const deps = assembleFedosConversationRuntimeDependencies({ clock, draftLogPath: join(dir, "nope.log") });
    expect(deps.draftPersistence.listDrafts()).toEqual([]);
    void writeFileSync; // referenced to keep import intentional across environments
  });
});
