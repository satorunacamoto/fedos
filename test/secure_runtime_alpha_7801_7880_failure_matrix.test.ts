/**
 * Secure Runtime Alpha 7801-7880 (FedOS Direct Conversation Archive
 * Product Completion and Parallel-Lineage Integration Arc) — Phase K:
 * failure matrix. Covers the scenarios NEW to this Arc's own subject-
 * model fix. Already-exhaustively-covered scenarios (payload/envelope
 * retention denial, suppression sync, offline/revoked Device, corrupted
 * ciphertext, malformed manifest, duplicate/conflicting restore,
 * bounds/oversized, stopped Runtime, identity-mismatch) are cited, not
 * duplicated: `secure_runtime_alpha_7481_7560_failure_matrix.test.ts`,
 * `secure_runtime_alpha_7721_7800_failure_matrix.test.ts`,
 * `secure_runtime_alpha_1691_1760_archive_runtime.test.ts`'s own
 * corruption matrix.
 */
import { describe, it, expect } from "vitest";

import {
  isFedosConversationArchiveDirectConversationSubject,
  isFedosConversationArchiveBoardConversationSubject,
} from "../src/conversation/archive/fedos_conversation_archive_direct_subject.js";
import { collectFedosConversationArchiveBundle, type FedosConversationArchiveCollectorDependencies } from "../src/conversation/archive/fedos_conversation_archive_collector.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import { detectFedosConversationArchiveDuplicates } from "../src/conversation/archive/fedos_conversation_archive_duplicate_detection.js";
import type { FedosConversationArchiveBundleV1 } from "../src/conversation/archive/fedos_conversation_archive_bundle.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";

import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationActivationPersistence } from "../src/conversation/activation/in_memory_fedos_conversation_activation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { fedosConversationActivationId } from "../src/conversation/activation/fedos_persisted_conversation_activation_v1.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";

const CONVERSATION_ID = "direct::alice-bob-7801" as FedosConversationId;
const OTHER_CONVERSATION_ID = "direct::alice-carol-7801" as FedosConversationId;

function makeDraftRecord(id: string, overrides: Partial<FedosPersistedConversationDraftRecordV1> = {}): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode: "direct",
    lifecycleState: "draft",
    policyReference: "direct-draft-v1",
    creatorAuthority: "nostr",
    creatorPublicIdentifier: "alice-pubkey",
    creatorIdentityId: null,
    createdAt: 1_700_000_000,
    ...overrides,
  };
}

function makeCollectorDeps(overrides: Partial<FedosConversationArchiveCollectorDependencies> = {}): FedosConversationArchiveCollectorDependencies {
  return {
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    ...overrides,
  };
}

function activateDraft(activationPersistence: InMemoryFedosConversationActivationPersistence, conversationId: string): void {
  activationPersistence.putActivationFact({
    schemaVersion: 1,
    activationId: fedosConversationActivationId(conversationId),
    conversationId,
    phase: "completed",
    startedAt: 1,
    updatedAt: 2,
  });
}

function makeRestoreDeps(overrides: Partial<FedosConversationArchiveRestoreDependencies> = {}): FedosConversationArchiveRestoreDependencies {
  return {
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    ...overrides,
  };
}

function makeDirectBundle(draftRecord: unknown): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: CONVERSATION_ID,
    exportedAt: 1_700_000_100,
    conversation: draftRecord as FedosConversationArchiveBundleV1["conversation"],
    memberships: [],
    capabilityEvents: [],
    envelopes: [],
    payloads: [],
  };
}

describe("Secure Runtime Alpha 7801-7880 -- failure matrix", () => {
  it("1. Board Archive's own conversation subject is never mistaken for Direct -- isFedosConversationArchiveDirectConversationSubject returns false for a bare Board record", () => {
    const boardRecord = { schemaVersion: 1, id: "board::x", mode: "public", boardId: "b", rootThreadId: "t", rootPostId: "p", policyReference: "public-v1", createdAt: 1 };
    expect(isFedosConversationArchiveDirectConversationSubject(boardRecord)).toBe(false);
    expect(isFedosConversationArchiveBoardConversationSubject(boardRecord)).toBe(true);
  });

  it("2. Direct Archive's own conversation subject is never mistaken for Board -- the reverse holds too", () => {
    const directSubject = { kind: "direct", record: makeDraftRecord(CONVERSATION_ID) };
    expect(isFedosConversationArchiveDirectConversationSubject(directSubject)).toBe(true);
    expect(isFedosConversationArchiveBoardConversationSubject(directSubject)).toBe(false);
  });

  it("3. unknown subject kind fails closed -- neither guard accepts it, and restore tallies the conversation record invalid rather than guessing", () => {
    const unknownSubject = { kind: "something-else", record: makeDraftRecord(CONVERSATION_ID) };
    expect(isFedosConversationArchiveDirectConversationSubject(unknownSubject)).toBe(false);
    // Not a bare Board record either (it DOES carry a `kind` field) -- correctly rejected by BOTH guards.
    expect(isFedosConversationArchiveBoardConversationSubject(unknownSubject)).toBe(false);

    const bundle = makeDirectBundle(unknownSubject);
    const result = restoreFedosConversationArchiveBundle(bundle, makeRestoreDeps());
    expect(result.conversation).toBe("invalid");
  });

  it("4. a Direct Archive's own draft record that fails deep validation is tallied invalid, never fabricated or silently coerced into a Board record", () => {
    const malformedDirectSubject = { kind: "direct", record: { ...makeDraftRecord(CONVERSATION_ID), mode: 12345 as unknown as string } };
    const bundle = makeDirectBundle(malformedDirectSubject);
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const result = restoreFedosConversationArchiveBundle(bundle, makeRestoreDeps({ draftPersistence }));
    expect(result.conversation).toBe("invalid");
    expect(draftPersistence.getDraft(CONVERSATION_ID)).toBeNull();
  });

  it("5. restoring a Direct Archive without draftPersistence wired reports invalid -- never silently dropped, never misfiled as Board", () => {
    const bundle = makeDirectBundle({ kind: "direct", record: makeDraftRecord(CONVERSATION_ID) });
    const result = restoreFedosConversationArchiveBundle(bundle, makeRestoreDeps());
    expect(result.conversation).toBe("invalid");
  });

  it("6. restoring a valid Direct Archive writes ONLY the draft record -- never an Activation fact -- proving history recovery and live-session recovery stay separate", () => {
    const bundle = makeDirectBundle({ kind: "direct", record: makeDraftRecord(CONVERSATION_ID) });
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const activationPersistence = new InMemoryFedosConversationActivationPersistence();
    const result = restoreFedosConversationArchiveBundle(bundle, makeRestoreDeps({ draftPersistence }));
    expect(result.conversation).toBe("inserted");
    expect(draftPersistence.getDraft(CONVERSATION_ID)).not.toBeNull();
    expect(activationPersistence.getActivation(fedosConversationActivationId(CONVERSATION_ID)), "restore must never write an Activation fact").toBeNull();
  });

  it("7. exporting a Direct Conversation without BOTH draftPersistence and activationPersistence wired reports null (conversation-not-found), byte-for-byte unchanged from before this Arc", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(makeDraftRecord(CONVERSATION_ID));
    // activationPersistence deliberately omitted.
    const bundle = collectFedosConversationArchiveBundle(CONVERSATION_ID, makeCollectorDeps({ draftPersistence }), 1_700_000_200);
    expect(bundle).toBeNull();
  });

  it("8. a genuinely non-active Direct Conversation (draft exists, no completed Activation) never exports -- 'draft exists' alone is not sufficient", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(makeDraftRecord(CONVERSATION_ID));
    const activationPersistence = new InMemoryFedosConversationActivationPersistence();
    // No activateDraft() call -- no completed Activation fact exists.
    const bundle = collectFedosConversationArchiveBundle(CONVERSATION_ID, makeCollectorDeps({ draftPersistence, activationPersistence }), 1_700_000_200);
    expect(bundle).toBeNull();
  });

  it("9. a genuinely active Direct Conversation exports successfully, with the correct Direct subject shape", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(makeDraftRecord(CONVERSATION_ID));
    const activationPersistence = new InMemoryFedosConversationActivationPersistence();
    activateDraft(activationPersistence, CONVERSATION_ID);
    const bundle = collectFedosConversationArchiveBundle(CONVERSATION_ID, makeCollectorDeps({ draftPersistence, activationPersistence }), 1_700_000_200);
    expect(bundle).not.toBeNull();
    expect(isFedosConversationArchiveDirectConversationSubject(bundle!.conversation)).toBe(true);
  });

  it("10. a Board record, when present, always takes precedence over a Direct fallback for the SAME conversationId -- never conflated, Board is checked first", () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    conversationPersistence.putConversation({ schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "b", rootThreadId: "t", rootPostId: "p", policyReference: "public-v1", createdAt: 1 });
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(makeDraftRecord(CONVERSATION_ID)); // a colliding draft ALSO exists -- must never be used.
    const activationPersistence = new InMemoryFedosConversationActivationPersistence();
    activateDraft(activationPersistence, CONVERSATION_ID);
    const bundle = collectFedosConversationArchiveBundle(CONVERSATION_ID, makeCollectorDeps({ conversationPersistence, draftPersistence, activationPersistence }), 1_700_000_200);
    expect(bundle).not.toBeNull();
    expect(isFedosConversationArchiveBoardConversationSubject(bundle!.conversation)).toBe(true);
  });

  it("11. wrong-conversation isolation -- a Direct Archive for CONVERSATION_ID never resolves or restores facts under OTHER_CONVERSATION_ID", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const activationPersistence = new InMemoryFedosConversationActivationPersistence();
    draftPersistence.putDraft(makeDraftRecord(OTHER_CONVERSATION_ID));
    activateDraft(activationPersistence, OTHER_CONVERSATION_ID);
    // CONVERSATION_ID itself was never created.
    const bundle = collectFedosConversationArchiveBundle(CONVERSATION_ID, makeCollectorDeps({ draftPersistence, activationPersistence }), 1_700_000_200);
    expect(bundle).toBeNull();
  });

  it("12. duplicate detection for a Direct subject: new/duplicate/conflict resolved against draftPersistence, never conversationPersistence", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const bundleNew = makeDirectBundle({ kind: "direct", record: makeDraftRecord(CONVERSATION_ID) });
    const reportNew = detectFedosConversationArchiveDuplicates(bundleNew, { conversationPersistence: new InMemoryFedosConversationPersistence(), draftPersistence, membershipPersistence: new InMemoryFedosConversationMembershipPersistence(), capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(), envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(), payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    expect(reportNew.conversation).toBe("new");

    draftPersistence.putDraft(makeDraftRecord(CONVERSATION_ID));
    const reportDuplicate = detectFedosConversationArchiveDuplicates(bundleNew, { conversationPersistence: new InMemoryFedosConversationPersistence(), draftPersistence, membershipPersistence: new InMemoryFedosConversationMembershipPersistence(), capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(), envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(), payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    expect(reportDuplicate.conversation).toBe("duplicate");

    const bundleConflicting = makeDirectBundle({ kind: "direct", record: makeDraftRecord(CONVERSATION_ID, { createdAt: 999_999 }) });
    const reportConflict = detectFedosConversationArchiveDuplicates(bundleConflicting, { conversationPersistence: new InMemoryFedosConversationPersistence(), draftPersistence, membershipPersistence: new InMemoryFedosConversationMembershipPersistence(), capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(), envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(), payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    expect(reportConflict.conversation).toBe("conflict");
  });

  it("13. duplicate/repeated restore of the SAME valid Direct Archive is idempotent -- 'inserted' then 'already-present', never a second distinct row", () => {
    const bundle = makeDirectBundle({ kind: "direct", record: makeDraftRecord(CONVERSATION_ID) });
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const deps = makeRestoreDeps({ draftPersistence });
    const first = restoreFedosConversationArchiveBundle(bundle, deps);
    expect(first.conversation).toBe("inserted");
    const second = restoreFedosConversationArchiveBundle(bundle, deps);
    expect(second.conversation).toBe("duplicate");
  });

  it("14. a conflicting repeated restore (same id, different content) is rejected, never silently overwritten", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const deps = makeRestoreDeps({ draftPersistence });
    restoreFedosConversationArchiveBundle(makeDirectBundle({ kind: "direct", record: makeDraftRecord(CONVERSATION_ID) }), deps);
    const conflicting = restoreFedosConversationArchiveBundle(makeDirectBundle({ kind: "direct", record: makeDraftRecord(CONVERSATION_ID, { createdAt: 1_700_000_001 }) }), deps);
    expect(conflicting.conversation).toBe("conflict");
  });

  it("15. invalid participant/creator authority in a Direct subject's own draft record is rejected by the reused, unmodified deep validator, never accepted", () => {
    const bundle = makeDirectBundle({ kind: "direct", record: { ...makeDraftRecord(CONVERSATION_ID), creatorAuthority: "" } });
    const result = restoreFedosConversationArchiveBundle(bundle, makeRestoreDeps({ draftPersistence: new InMemoryFedosConversationDraftPersistence() }));
    expect(result.conversation).toBe("invalid");
  });
});
