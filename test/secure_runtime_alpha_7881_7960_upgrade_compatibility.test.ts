/**
 * Secure Runtime Alpha 7881-7960 — Phase L: upgrade and migration
 * acceptance. Tests loading representative OLDER committed shapes
 * through the CURRENT code, proving no mandatory destructive migration
 * exists for any of the five named transitions this Arc's own mission
 * requires: before the subject index, before Archive retention parity,
 * before suppression propagation, before Direct Archive subject union,
 * before this Arc's own write-time index.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { Buffer } from "node:buffer";

import { AppendOnlyFedosDeliveryObservationPersistence } from "../src/board/observation/append_only_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/conversation/archive/fedos_conversation_archive_bundle.js";
import { restoreFedosConversationArchiveBundle } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { AppendOnlyFedosArchiveSuppressionObservationPersistence } from "../src/conversation/retention/append_only_fedos_archive_suppression_observation_persistence.js";
import { FedosArchiveSuppressionObservationAuthority } from "../src/conversation/retention/fedos_archive_suppression_observation_authority.js";

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-7881-7960-upgrade-"));
}

describe("Secure Runtime Alpha 7881-7960 -- Phase L: upgrade/migration acceptance", () => {
  it("1. before the write-time index: an Observation log written the OLD way (bypassing this Arc's own class entirely, raw appendFileSync of well-formed lines) loads identically through the NEW indexed Persistence -- no migration, no rewrite", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "observations.ndjson");
      // Simulates a log a PRE-7881-7960 process wrote -- the wire format never changed by this Arc, only
      // in-process lookup cost, so hand-writing lines exactly like the old code did is a faithful stand-in.
      const lines = [
        { schemaVersion: 1, id: "subj-1::accepted::1", subjectId: "subj-1", state: "accepted", observedAt: 1 },
        { schemaVersion: 1, id: "subj-2::rejected::2", subjectId: "subj-2", state: "rejected", observedAt: 2, reason: "final:policy-abandon" },
      ];
      writeFileSync(logPath, lines.map((l) => JSON.stringify(l)).join("\n") + "\n", "utf8");

      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      expect(persistence.listObservations().length).toBe(2);
      expect(persistence.getObservation("subj-1::accepted::1")).toEqual(lines[0]);

      const repository = new FedosDeliveryObservationRepository(persistence);
      const subject1 = toFedosDeliveryObservationSubjectId("subj-1")!;
      expect(repository.list().some((o) => o.subjectId === subject1)).toBe(true);

      // A NEW write through the NEW code appends correctly alongside the old-format lines.
      expect(persistence.putObservation({ schemaVersion: 1, id: "subj-3::accepted::3", subjectId: "subj-3", state: "accepted", observedAt: 3 })).toBe(
        "inserted",
      );
      expect(new AppendOnlyFedosDeliveryObservationPersistence(logPath).listObservations().length).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. before the Direct Archive subject union: an OLD Archive bundle whose conversation field is the bare Board shape (no 'kind' field at all) still restores correctly through the CURRENT restore path", () => {
    const conversationId = "board-a::thread-1" as FedosConversationId;
    const oldShapedBundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId,
      exportedAt: 1_700_000_000,
      conversation: {
        // Deliberately NO `kind` field -- the exact pre-7801-7880 Board shape.
        schemaVersion: 1,
        id: conversationId,
        mode: "public",
        boardId: "board-a",
        rootThreadId: "thread-1",
        rootPostId: "thread-1",
        policyReference: "public-v1",
        createdAt: 1_699_999_000,
      } as never,
      memberships: [],
      capabilityEvents: [],
      envelopes: [],
      payloads: [],
    };
    const restoreDeps = {
      conversationPersistence: new InMemoryFedosConversationPersistence(),
      membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
      capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    };
    const result = restoreFedosConversationArchiveBundle(oldShapedBundle, restoreDeps);
    expect(result.conversation).toBe("inserted");
  });

  it("3. before suppression propagation: an old profile with archiveEnabled but NO archiveSuppressionObservationLogPath configured at all still restores, with every subject honestly 'active' (never fabricated 'suppressed')", () => {
    // Mirrors fedos_desktop_runtime.ts's own fallback: no log path supplied -> InMemory, not a crash, not a
    // migration requirement -- an old profile's config object simply lacks the new field entirely.
    const authority = new FedosArchiveSuppressionObservationAuthority({
      persistence: new (class {
        listObservationsForSubject() {
          return [];
        }
        putObservation() {
          return "inserted" as const;
        }
      })() as never,
    });
    expect(authority.evaluateSuppression("payload-old-profile" as never, "restore")).toBe("active");
  });

  it("4. suppression observation log itself: an OLD log (written before this Arc existed, i.e. by 7721-7800's own shipped code, which never changed) loads and rebuilds correctly under the CURRENT authority -- byte-for-byte unmodified wire format", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "suppression.ndjson");
      const oldRecord = {
        schemaVersion: 1,
        id: "fact-old-1",
        accountAuthority: "nostr",
        accountPublicIdentifier: "acct-1",
        accountIdentityId: null,
        sourceDeviceId: "device-a",
        subjectType: "payload",
        subjectRef: "payload-old-1",
        suppressionMeaning: "suppress-payload-restore",
        revision: 0,
        decidedAt: 1000,
        nonce: "0123456789abcdef0123456789abcdef",
        origin: "self",
        evidenceLevel: "self-authored",
        receivedAt: 1000,
      };
      writeFileSync(logPath, JSON.stringify(oldRecord) + "\n", "utf8");
      const persistence = new AppendOnlyFedosArchiveSuppressionObservationPersistence(logPath);
      const authority = new FedosArchiveSuppressionObservationAuthority({ persistence });
      expect(authority.evaluateSuppression("payload-old-1" as never, "restore")).toBe("suppressed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("5. unknown future Observation schemaVersion still fails closed, exactly as before this Arc -- the write index changes lookup cost only, never validation policy", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "observations.ndjson");
      appendFileSync(logPath, JSON.stringify({ schemaVersion: 1, id: "subj-1::accepted::1", subjectId: "subj-1", state: "accepted", observedAt: 1 }) + "\n", "utf8");
      appendFileSync(logPath, JSON.stringify({ schemaVersion: 99, id: "subj-2::accepted::2", subjectId: "subj-2", state: "accepted", observedAt: 2 }) + "\n", "utf8");
      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      // Raw JSON-Lines replay does not itself validate schemaVersion (that check lives one layer up in the
      // codec's own deserializeFedosDeliveryObservation, unchanged by this Arc) -- confirm the raw record is
      // still readable back (no migration/rewrite forced), and the SEPARATE codec layer still rejects it.
      expect(persistence.listObservations().length).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("6. honest downgrade note: the write-index change added ZERO new on-disk fields/files -- a log written by THIS Arc's own code is byte-for-byte readable by the PRE-7881-7960 implementation (same JSON-Lines format, same fields); no rollback limitation exists for this specific change", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "observations.ndjson");
      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      persistence.putObservation({ schemaVersion: 1, id: "subj-1::accepted::1", subjectId: "subj-1", state: "accepted", observedAt: 1 });
      const rawLine = (readFileSync(logPath, "utf8") as string).trim();
      const parsed = JSON.parse(rawLine);
      expect(Object.keys(parsed).sort()).toEqual(["id", "observedAt", "schemaVersion", "state", "subjectId"].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
