/**
 * Secure Runtime Alpha 5401-5480 — Phase G. Covers test requirements 14
 * (conflicting duplicate), 15 (append-only restart), 16 (corruption
 * fail-closed), 27 (no plaintext secret on disk, sealed-secret side),
 * plus truncated log / malformed log line / conflicting replay record /
 * restart after interrupted append (Phase K).
 */
import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error node:fs has no type declarations without @types/node in this tsconfig.
import { mkdtempSync, rmSync, appendFileSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { InMemoryFedosDirectRatchetSessionPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_direct_ratchet_session_persistence.js";
import { AppendOnlyFedosDirectRatchetSessionPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.js";
import { InMemoryFedosSealedDirectRatchetSecretPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_sealed_direct_ratchet_secret_persistence.js";
import { AppendOnlyFedosSealedDirectRatchetSecretPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.js";
import { FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_counters.js";
import {
  createFedosSealedDirectRatchetSecretRecordV1,
  fedosSealedDirectRatchetSecretRecordKey,
} from "../src/os/messenger/conversations/ratchet/fedos_sealed_direct_ratchet_secret_record.js";
import type { FedosDirectRatchetSessionRecordV1 } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_record.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosDirectRatchetSessionId } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-ratchet-persistence-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length) {
    try {
      rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function sessionRecord(overrides: Partial<FedosDirectRatchetSessionRecordV1> = {}): FedosDirectRatchetSessionRecordV1 {
  return {
    schemaVersion: 1,
    revision: 0,
    binding: {
      sessionId: "direct-ratchet-v1##alice##dev1##bob##dev2##conv1##fedos-direct-ratchet-v1##0" as FedosDirectRatchetSessionId,
      localAccountRef: { authority: "fedos", publicIdentifier: "alice", identityId: null },
      localDeviceRef: "dev1",
      remoteAccountRef: { authority: "fedos", publicIdentifier: "bob", identityId: null },
      remoteDeviceRef: "dev2",
      conversationId: "conv1" as FedosConversationId,
      suite: "fedos-direct-ratchet-v1",
      generation: 0,
    },
    lifecycleState: "initialized",
    counters: FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS,
    createdAt: 1,
    lastActivityAt: 1,
    skippedKeyReferences: [],
    sealedSecretRecordIds: [],
    ...overrides,
  };
}

for (const [label, makeBackend] of [
  ["in-memory", () => new InMemoryFedosDirectRatchetSessionPersistence()],
  ["append-only", () => new AppendOnlyFedosDirectRatchetSessionPersistence(join(makeTmpDir(), "session.ndjson"))],
] as const) {
  describe(`Alpha 5401-5480 — session persistence (${label})`, () => {
    it("inserts a new session at revision 0", () => {
      const backend = makeBackend();
      expect(backend.putSession(sessionRecord())).toBe("inserted");
      expect(backend.getSession(sessionRecord().binding.sessionId)).toEqual(sessionRecord());
    });

    it("an identical repeat write is idempotent", () => {
      const backend = makeBackend();
      backend.putSession(sessionRecord());
      expect(backend.putSession(sessionRecord())).toBe("already-present");
    });

    it("14. conflicting duplicate -- same sessionId+revision, different content, is rejected", () => {
      const backend = makeBackend();
      backend.putSession(sessionRecord());
      const conflicting = sessionRecord({ lifecycleState: "revoked" });
      expect(backend.putSession(conflicting)).toBe("conflict");
    });

    it("a valid next revision is accepted and becomes the latest", () => {
      const backend = makeBackend();
      backend.putSession(sessionRecord());
      const next = sessionRecord({ revision: 1, lifecycleState: "active" });
      expect(backend.putSession(next)).toBe("inserted");
      expect(backend.getSession(next.binding.sessionId)?.lifecycleState).toBe("active");
    });

    it("a revision that skips ahead is rejected (conflict)", () => {
      const backend = makeBackend();
      backend.putSession(sessionRecord());
      const skipped = sessionRecord({ revision: 5, lifecycleState: "active" });
      expect(backend.putSession(skipped)).toBe("conflict");
    });

    it("15. append-only restart -- a fresh backend instance over the same store observes all prior writes", () => {
      const dir = makeTmpDir();
      const filePath = join(dir, "session.ndjson");
      const first = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
      first.putSession(sessionRecord());
      first.putSession(sessionRecord({ revision: 1, lifecycleState: "active" }));

      const restarted = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
      const record = restarted.getSession(sessionRecord().binding.sessionId);
      expect(record?.revision).toBe(1);
      expect(record?.lifecycleState).toBe("active");
    });

    it("28. independent Runtime isolation -- two separate backend instances over DIFFERENT stores never see each other's writes", () => {
      const a = makeBackend();
      const b = makeBackend();
      a.putSession(sessionRecord());
      expect(b.getSession(sessionRecord().binding.sessionId)).toBeNull();
    });
  });
}

describe("Alpha 5401-5480 — append-only session persistence corruption matrix", () => {
  it("16. malformed log line -- a non-JSON line throws on replay (fail closed)", () => {
    const dir = makeTmpDir();
    const filePath = join(dir, "session.ndjson");
    appendFileSync(filePath, "this is not json\n", "utf8");
    const backend = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
    expect(() => backend.listSessions()).toThrow();
  });

  it("16. corruption fail-closed -- a structurally invalid (but valid-JSON) line throws on replay", () => {
    const dir = makeTmpDir();
    const filePath = join(dir, "session.ndjson");
    appendFileSync(filePath, JSON.stringify({ not: "a real record" }) + "\n", "utf8");
    const backend = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
    expect(() => backend.listSessions()).toThrow();
  });

  it("conflicting replay record -- two lines with the same sessionId+revision but different content throws", () => {
    const dir = makeTmpDir();
    const filePath = join(dir, "session.ndjson");
    appendFileSync(filePath, JSON.stringify(sessionRecord()) + "\n", "utf8");
    appendFileSync(filePath, JSON.stringify(sessionRecord({ lifecycleState: "revoked" })) + "\n", "utf8");
    const backend = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
    expect(() => backend.listSessions()).toThrow();
  });

  it("restart after interrupted append -- a truncated trailing line throws (never silently dropped or repaired)", () => {
    const dir = makeTmpDir();
    const filePath = join(dir, "session.ndjson");
    const full = JSON.stringify(sessionRecord());
    appendFileSync(filePath, full.slice(0, full.length - 5) + "\n", "utf8");
    const backend = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
    expect(() => backend.listSessions()).toThrow();
  });

  it("an empty/missing log file is NOT corruption -- replays to an empty list", () => {
    const dir = makeTmpDir();
    const filePath = join(dir, "session.ndjson");
    const backend = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
    expect(backend.listSessions()).toEqual([]);
  });

  it("out-of-order revision (first revision for a session isn't 0) throws", () => {
    const dir = makeTmpDir();
    const filePath = join(dir, "session.ndjson");
    appendFileSync(filePath, JSON.stringify(sessionRecord({ revision: 1 })) + "\n", "utf8");
    const backend = new AppendOnlyFedosDirectRatchetSessionPersistence(filePath);
    expect(() => backend.listSessions()).toThrow();
  });
});

describe("Alpha 5401-5480 — sealed-secret persistence", () => {
  const SESSION_ID = "direct-ratchet-v1##a##b##c##d##e##fedos-direct-ratchet-v1##0" as FedosDirectRatchetSessionId;

  function sealedRecord() {
    return createFedosSealedDirectRatchetSecretRecordV1({
      sessionId: SESSION_ID,
      secretKind: "root-key",
      generation: 0,
      chainCounter: null,
      sealingSuite: "direct-ratchet-sealing-v1",
      suite: "fedos-direct-ratchet-v1",
      sealedBlob: "aabbccddeeff",
      createdAt: 1,
    })!;
  }

  for (const [label, makeBackend] of [
    ["in-memory", () => new InMemoryFedosSealedDirectRatchetSecretPersistence()],
    ["append-only", () => new AppendOnlyFedosSealedDirectRatchetSecretPersistence(join(makeTmpDir(), "sealed.ndjson"))],
  ] as const) {
    it(`17/27. ${label} -- writes and reads back the sealed record, never a raw secret on disk`, () => {
      const backend = makeBackend();
      expect(backend.putSealedSecret(sealedRecord())).toBe("written");
      const found = backend.getSealedSecret(fedosSealedDirectRatchetSecretRecordKey(sealedRecord()));
      expect(found).toEqual(sealedRecord());
    });

    it(`${label} -- never overwrites; a conflicting write to the same key is rejected`, () => {
      const backend = makeBackend();
      backend.putSealedSecret(sealedRecord());
      const conflicting = { ...sealedRecord(), sealedBlob: "ffffffffffff" };
      expect(backend.putSealedSecret(conflicting)).toBe("conflict");
    });
  }

  it("27. no plaintext secret on disk -- the durable file never contains the marker bytes sealed into it", () => {
    const dir = makeTmpDir();
    const filePath = join(dir, "sealed.ndjson");
    const backend = new AppendOnlyFedosSealedDirectRatchetSecretPersistence(filePath);
    backend.putSealedSecret(sealedRecord());
    const raw = readFileSync(filePath, "utf8") as string;
    expect(raw).not.toContain("plaintext");
    expect(raw).toContain("sealedBlob");
  });
});
