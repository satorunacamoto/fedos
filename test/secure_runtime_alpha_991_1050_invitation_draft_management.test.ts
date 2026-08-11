/**
 * Secure Runtime Alpha 991–1050 — Conversation Invitation Transport & Draft
 * Management Arc.
 *
 * Covers: the additive invitation-revocation registry backends (in-memory +
 * append-only, idempotency + conflict + replay); the draft-management-state
 * persistence backends (revision keying, resolve-current, conflict); the
 * invitation transport facade over the frozen Capability boundary
 * (create/redeem/expire/exhaust/recipient-mismatch/revoke + revocation gate +
 * authorization + listing, and the bearer-secret-only-once channel); the draft
 * manager (list/search/soft-delete/restore, tombstone lifecycle, authorization,
 * no data loss); and full end-to-end runtime + desktop integration with durable
 * files and restart recovery, including the "no bearer secret in any durable
 * log" guard extended to the two new logs.
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

import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { InMemoryFedosConversationCapabilityAuthority } from "../src/os/messenger/conversations/capability/in_memory_fedos_conversation_capability_authority.js";
import {
  toFedosConversationCapabilityBearerSecret,
  type FedosConversationCapabilityBearerSecret,
} from "../src/os/messenger/conversations/capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationCapabilityId } from "../src/os/messenger/conversations/capability/fedos_conversation_capability_id.js";

import { FedosConversationInvitationTransport } from "../src/os/messenger/conversations/invitation/fedos_conversation_invitation_transport.js";
import { InMemoryFedosConversationInvitationRevocationRegistry } from "../src/os/messenger/conversations/invitation/in_memory_fedos_conversation_invitation_revocation_registry.js";
import { AppendOnlyFedosConversationInvitationRevocationRegistry } from "../src/os/messenger/conversations/invitation/append_only_fedos_conversation_invitation_revocation_registry.js";
import type { FedosPersistedConversationInvitationRevocationV1 } from "../src/os/messenger/conversations/invitation/fedos_persisted_conversation_invitation_revocation_v1.js";

import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationDraftManagementPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_management_persistence.js";
import { AppendOnlyFedosConversationDraftManagementPersistence } from "../src/os/messenger/conversations/construction/append_only_fedos_conversation_draft_management_persistence.js";
import { FedosConversationDraftManager } from "../src/os/messenger/conversations/construction/fedos_conversation_draft_manager.js";
import { validateFedosConversationDraftRecord } from "../src/os/messenger/conversations/construction/fedos_conversation_draft_record_validator.js";
import { serializeFedosConversationDraftRecord } from "../src/os/messenger/conversations/construction/fedos_conversation_draft_record_codec.js";

// ---------------------------------------------------------------------------
// Small deterministic generators (this Arc mints no real randomness itself).
// ---------------------------------------------------------------------------

function counterIdGenerator(prefix: string): { generateCapabilityId(): string } {
  let n = 0;
  return { generateCapabilityId: () => `${prefix}-${(n += 1)}` };
}
function counterSecretGenerator(prefix: string): { generateBearerSecret(): FedosConversationCapabilityBearerSecret } {
  let n = 0;
  return { generateBearerSecret: () => toFedosConversationCapabilityBearerSecret(`${prefix}-secret-${(n += 1)}`)! };
}

const ISSUER: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "issuer-1", identityId: null };
const REDEEMER: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "npub-redeemer", identityId: null };
const OTHER: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "npub-other", identityId: null };
const CONV = "conv-invite-1" as FedosConversationId;

function buildTransport(nowRef: { now: number }) {
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const capabilityAuthority = new InMemoryFedosConversationCapabilityAuthority({
    idGenerator: counterIdGenerator("cap"),
    secretGenerator: counterSecretGenerator("cap"),
    existenceCheck: () => true,
    authorizationCheck: () => true,
    membershipAuthority,
  });
  const revocationRegistry = new InMemoryFedosConversationInvitationRevocationRegistry();
  const transport = new FedosConversationInvitationTransport({
    issuerAuthority: capabilityAuthority,
    redemptionAuthority: capabilityAuthority,
    revocationRegistry,
    // Only the original issuer may revoke (a real, non-always-true check).
    revocationAuthorizationCheck: (descriptor, revoker) =>
      descriptor.issuer.authority === revoker.authority && descriptor.issuer.publicIdentifier === revoker.publicIdentifier,
    clock: () => nowRef.now,
  });
  return { transport, revocationRegistry };
}

// ---------------------------------------------------------------------------
// Invitation transport (facade over the frozen Capability boundary).
// ---------------------------------------------------------------------------

describe("Alpha 991/993/994 — invitation create/validate/redeem over the Capability boundary", () => {
  it("creates an invitation carrying a token, and redeems it once", () => {
    const nowRef = { now: 1000 };
    const { transport } = buildTransport(nowRef);

    const created = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 2, expiresAt: null });
    expect(created.outcome).toBe("created");
    if (created.outcome !== "created") throw new Error("expected created");
    expect(created.token.capabilityId).toBe(created.descriptor.capabilityId);
    expect(typeof (created.token.bearerSecret as string)).toBe("string");

    const redeemed = transport.redeemInvitation(created.token, REDEEMER);
    expect(redeemed.outcome).toBe("redeemed");

    // Same redeemer again → already-redeemed (delegated to the frozen authority).
    expect(transport.redeemInvitation(created.token, REDEEMER).outcome).toBe("already-redeemed");
  });

  it("collapses a wrong secret to invalid-invitation (never reveals almost-correct)", () => {
    const nowRef = { now: 1000 };
    const { transport } = buildTransport(nowRef);
    const created = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 1, expiresAt: null });
    if (created.outcome !== "created") throw new Error("expected created");
    const wrong = { capabilityId: created.token.capabilityId, bearerSecret: toFedosConversationCapabilityBearerSecret("nope")! };
    expect(transport.redeemInvitation(wrong, REDEEMER).outcome).toBe("invalid-invitation");
  });

  it("delegates expiration and exhaustion to the frozen redemption authority", () => {
    const nowRef = { now: 1000 };
    const { transport } = buildTransport(nowRef);

    // Expiration — expiresAt in the past relative to the clock.
    const expiring = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 1, expiresAt: 500 });
    if (expiring.outcome !== "created") throw new Error("expected created");
    expect(transport.redeemInvitation(expiring.token, REDEEMER).outcome).toBe("expired");

    // Exhaustion — maxUses 1, a second DISTINCT redeemer.
    const single = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 1, expiresAt: null });
    if (single.outcome !== "created") throw new Error("expected created");
    expect(transport.redeemInvitation(single.token, REDEEMER).outcome).toBe("redeemed");
    expect(transport.redeemInvitation(single.token, OTHER).outcome).toBe("exhausted");
  });

  it("enforces an intended recipient (recipient-mismatch)", () => {
    const nowRef = { now: 1000 };
    const { transport } = buildTransport(nowRef);
    const created = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: REDEEMER, maxUses: 1, expiresAt: null });
    if (created.outcome !== "created") throw new Error("expected created");
    expect(transport.redeemInvitation(created.token, OTHER).outcome).toBe("recipient-mismatch");
    expect(transport.redeemInvitation(created.token, REDEEMER).outcome).toBe("redeemed");
  });
});

describe("Alpha 995 — invitation revocation (this Arc's genuinely-new operation)", () => {
  it("revokes before redemption; a revoked invitation never redeems whatever the secret", () => {
    const nowRef = { now: 1000 };
    const { transport } = buildTransport(nowRef);
    const created = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 5, expiresAt: null });
    if (created.outcome !== "created") throw new Error("expected created");

    expect(transport.revokeInvitation(created.token.capabilityId, ISSUER).outcome).toBe("revoked");
    // Redemption with the CORRECT token now fails closed.
    expect(transport.redeemInvitation(created.token, REDEEMER).outcome).toBe("revoked");
    // Revoking again is idempotent.
    expect(transport.revokeInvitation(created.token.capabilityId, ISSUER).outcome).toBe("already-revoked");
  });

  it("rejects an unauthorized revoker and an unknown invitation", () => {
    const nowRef = { now: 1000 };
    const { transport } = buildTransport(nowRef);
    const created = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 1, expiresAt: null });
    if (created.outcome !== "created") throw new Error("expected created");
    expect(transport.revokeInvitation(created.token.capabilityId, OTHER).outcome).toBe("unauthorized");
    expect(transport.revokeInvitation("no-such-capability" as FedosConversationCapabilityId, ISSUER).outcome).toBe("not-found");
    // Still redeemable — an unauthorized/unknown revoke changed nothing.
    expect(transport.redeemInvitation(created.token, REDEEMER).outcome).toBe("redeemed");
  });

  it("lists and inspects invitations as non-secret summaries with a revoked flag", () => {
    const nowRef = { now: 1000 };
    const { transport } = buildTransport(nowRef);
    const a = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 1, expiresAt: null });
    const b = transport.createInvitation({ conversationId: CONV, issuer: ISSUER, intendedRecipient: null, maxUses: 1, expiresAt: null });
    if (a.outcome !== "created" || b.outcome !== "created") throw new Error("expected created");
    transport.revokeInvitation(a.token.capabilityId, ISSUER);

    const summaries = transport.listConversationInvitations(CONV);
    expect(summaries).toHaveLength(2);
    const byId = new Map(summaries.map((s) => [s.descriptor.capabilityId, s.revoked]));
    expect(byId.get(a.token.capabilityId)).toBe(true);
    expect(byId.get(b.token.capabilityId)).toBe(false);

    const inspected = transport.inspectInvitation(a.token.capabilityId);
    expect(inspected!.revoked).toBe(true);
    // A summary never carries a bearer secret.
    expect(JSON.stringify(summaries)).not.toContain("secret");
  });
});

// ---------------------------------------------------------------------------
// Revocation registry backends.
// ---------------------------------------------------------------------------

describe("Alpha 996/997/998 — invitation revocation registry backends", () => {
  function record(capabilityId: string, revokedAt: number): FedosPersistedConversationInvitationRevocationV1 {
    return {
      schemaVersion: 1,
      capabilityId,
      conversationId: "conv-x",
      revokedByAuthority: "fedos",
      revokedByPublicIdentifier: "issuer-1",
      revokedByIdentityId: null,
      revokedAt,
    };
  }

  it("in-memory: insert, idempotent re-insert, and conflict on differing content", () => {
    const registry = new InMemoryFedosConversationInvitationRevocationRegistry();
    expect(registry.putRevocation(record("cap-1", 10))).toBe("inserted");
    expect(registry.isRevoked("cap-1")).toBe(true);
    expect(registry.isRevoked("cap-2")).toBe(false);
    expect(registry.putRevocation(record("cap-1", 10))).toBe("already-present");
    expect(registry.putRevocation(record("cap-1", 99))).toBe("conflict");
    expect(registry.listConversationRevocations("conv-x")).toHaveLength(1);
  });

  it("append-only: persists across a fresh instance and fails closed on a conflicting duplicate line", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-rev-"));
    const file = join(dir, "revocations.log");
    const a = new AppendOnlyFedosConversationInvitationRevocationRegistry(file);
    expect(a.putRevocation(record("cap-1", 10))).toBe("inserted");

    // Fresh instance over the same file replays the fact.
    const b = new AppendOnlyFedosConversationInvitationRevocationRegistry(file);
    expect(b.isRevoked("cap-1")).toBe(true);
    expect(b.getRevocation("cap-1")!.revokedAt).toBe(10);
    expect(b.putRevocation(record("cap-1", 10))).toBe("already-present");
    expect(b.putRevocation(record("cap-1", 77))).toBe("conflict");
  });
});

// ---------------------------------------------------------------------------
// Draft manager (listing / search / soft-delete / restore).
// ---------------------------------------------------------------------------

const CREATOR: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "creator-1", identityId: null };

function seedDraft(
  draftPersistence: InMemoryFedosConversationDraftPersistence,
  id: string,
  mode: "private-group" | "direct",
  createdAt: number,
  creator: FedosConversationParticipantReference = CREATOR,
): void {
  const record = validateFedosConversationDraftRecord({
    id,
    mode,
    lifecycleState: "draft",
    policyReference: mode === "private-group" ? "private-group-draft-v1" : "direct-draft-v1",
    creator,
    createdAt,
  });
  if (record === null) throw new Error("failed to build draft record");
  draftPersistence.putDraft(serializeFedosConversationDraftRecord(record));
}

function buildManager() {
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  const managementPersistence = new InMemoryFedosConversationDraftManagementPersistence();
  const manager = new FedosConversationDraftManager({
    draftPersistence,
    managementPersistence,
    authorizationCheck: (draft, actor) =>
      draft.creator.authority === actor.authority && draft.creator.publicIdentifier === actor.publicIdentifier,
    clock: () => 1_700_000_500,
  });
  return { draftPersistence, managementPersistence, manager };
}

describe("Alpha 1006 — draft listing and search", () => {
  it("lists all drafts with their managed state and filters by a closed query", () => {
    const { draftPersistence, manager } = buildManager();
    seedDraft(draftPersistence, "d-pg", "private-group", 1_700_000_100);
    seedDraft(draftPersistence, "d-direct", "direct", 1_700_000_200);
    seedDraft(draftPersistence, "d-other", "private-group", 1_700_000_300, OTHER);

    expect(manager.listDrafts()).toHaveLength(3);
    expect(manager.listDrafts().every((s) => s.managedState === "draft")).toBe(true);

    expect(manager.searchDrafts({ mode: "direct" }).map((s) => s.id)).toEqual(["d-direct"]);
    expect(manager.searchDrafts({ creator: CREATOR }).map((s) => s.id).sort()).toEqual(["d-direct", "d-pg"]);
    expect(manager.searchDrafts({ createdAtFrom: 1_700_000_250 }).map((s) => s.id)).toEqual(["d-other"]);
  });
});

describe("Alpha 1006 — soft-delete (tombstone) and restore", () => {
  it("tombstones and restores without ever removing the base record, and enforces authorization", () => {
    const { draftPersistence, manager } = buildManager();
    seedDraft(draftPersistence, "d1", "private-group", 1_700_000_100);

    // Non-creator cannot manage it.
    expect(manager.deleteDraft("d1", OTHER).outcome).toBe("unauthorized");

    const deleted = manager.deleteDraft("d1", CREATOR);
    expect(deleted.outcome).toBe("deleted");
    if (deleted.outcome !== "deleted") throw new Error("expected deleted");
    expect(deleted.summary.managedState).toBe("tombstoned");

    // The base record is NEVER physically removed (no data loss).
    expect(draftPersistence.getDraft("d1" as FedosConversationId)).not.toBeNull();

    // Now reflected in listing/search.
    expect(manager.searchDrafts({ managedState: "tombstoned" }).map((s) => s.id)).toEqual(["d1"]);
    expect(manager.searchDrafts({ managedState: "draft" })).toHaveLength(0);

    // Deleting again is idempotent.
    expect(manager.deleteDraft("d1", CREATOR).outcome).toBe("already-deleted");

    // Restore transitions it back.
    const restored = manager.restoreDraft("d1", CREATOR);
    expect(restored.outcome).toBe("restored");
    if (restored.outcome !== "restored") throw new Error("expected restored");
    expect(restored.summary.managedState).toBe("draft");
    expect(manager.searchDrafts({ managedState: "draft" }).map((s) => s.id)).toEqual(["d1"]);

    // Restore when not deleted → not-deleted.
    expect(manager.restoreDraft("d1", CREATOR).outcome).toBe("not-deleted");
  });

  it("fails closed for an unknown draft", () => {
    const { manager } = buildManager();
    expect(manager.deleteDraft("missing", CREATOR).outcome).toBe("not-found");
    expect(manager.restoreDraft("missing", CREATOR).outcome).toBe("not-found");
  });

  it("append-only management state persists across a fresh backend (revision resolution)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-mgmt-"));
    const file = join(dir, "management.log");
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    seedDraft(draftPersistence, "d1", "private-group", 1_700_000_100);

    const managementA = new AppendOnlyFedosConversationDraftManagementPersistence(file);
    const managerA = new FedosConversationDraftManager({
      draftPersistence,
      managementPersistence: managementA,
      authorizationCheck: () => true,
      clock: () => 1_700_000_500,
    });
    expect(managerA.deleteDraft("d1", CREATOR).outcome).toBe("deleted");

    // Fresh management backend over the same file resolves the highest revision.
    const managementB = new AppendOnlyFedosConversationDraftManagementPersistence(file);
    expect(managementB.getCurrentManagementState("d1")!.managedState).toBe("tombstoned");
    expect(managementB.getCurrentManagementState("d1")!.revision).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// End-to-end runtime + desktop integration with durable files.
// ---------------------------------------------------------------------------

function baseConfig(): FedosDesktopRuntimeConfig & { readonly dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "fedos-inv-rt-"));
  return {
    dir,
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    conversationConstructionCoordinationLogPath: join(dir, "coordination.log"),
    conversationInvitationRevocationLogPath: join(dir, "revocation.log"),
    conversationDraftManagementLogPath: join(dir, "management.log"),
    clock: () => 1_700_002_000,
  };
}

describe("Alpha 1011 — runtime integration end-to-end with restart recovery", () => {
  it("creates a draft, an invitation, redeems it, revokes it, deletes+restores, all durable across restart", async () => {
    const config = baseConfig();
    const runtime = await startFedosDesktopRuntime(config);
    const cr = runtime.conversationRuntime();

    const created = cr.createPrivateGroupDraft({ idempotencyKey: "e2e-inv", initialCapability: { maxUses: 1, expiresAt: null } });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const id = created.draft.id;
    const issuer = created.ownerMembership.participant;

    // Create an invitation via the runtime (issuer = the active owner creator).
    const invite = cr.createInvitation({ conversationId: id as FedosConversationId, issuer, intendedRecipient: null, maxUses: 2, expiresAt: null });
    expect(invite.outcome).toBe("created");
    if (invite.outcome !== "created") throw new Error("expected created");
    const bearer = invite.token.bearerSecret as string;

    // Redeem it.
    expect(cr.redeemInvitation(invite.token, REDEEMER).outcome).toBe("redeemed");

    // Listing shows the construction capability + our invitation.
    expect(cr.listConversationInvitations(id).length).toBeGreaterThanOrEqual(2);

    // Revoke it, then a fresh redeemer is rejected.
    expect(cr.revokeInvitation(invite.token.capabilityId, issuer).outcome).toBe("revoked");
    expect(cr.redeemInvitation(invite.token, OTHER).outcome).toBe("revoked");

    // Soft-delete then restore the draft.
    expect(cr.deleteDraft(id, issuer).outcome).toBe("deleted");
    expect(cr.listDrafts().find((s) => s.id === id)!.managedState).toBe("tombstoned");
    expect(cr.restoreDraft(id, issuer).outcome).toBe("restored");
    expect(cr.listDrafts().find((s) => s.id === id)!.managedState).toBe("draft");

    // Delete again so we can assert durability of a tombstone across restart.
    expect(cr.deleteDraft(id, issuer).outcome).toBe("deleted");

    await runtime.stop();

    // Fresh runtime over the same durable files.
    const restarted = await startFedosDesktopRuntime(config);
    const cr2 = restarted.conversationRuntime();
    // Revocation persisted.
    expect(cr2.redeemInvitation(invite.token, REDEEMER).outcome).toBe("revoked");
    expect(cr2.inspectInvitation(invite.token.capabilityId)!.revoked).toBe(true);
    // Tombstone persisted; the base draft record is still readable (no data loss).
    expect(cr2.listDrafts().find((s) => s.id === id)!.managedState).toBe("tombstoned");
    expect(cr2.findConversation(id)).not.toBeNull();
    await restarted.stop();

    // Alpha 928 extended — the bearer secret is in NO durable log, including the two new ones.
    for (const file of [
      config.conversationDraftLogPath!,
      config.conversationMembershipLogPath!,
      config.conversationCapabilityLogPath!,
      config.conversationConstructionCoordinationLogPath!,
      config.conversationInvitationRevocationLogPath!,
      config.conversationDraftManagementLogPath!,
    ]) {
      expect(readFileSync(file, "utf8") as string).not.toContain(bearer);
    }
  });
});
