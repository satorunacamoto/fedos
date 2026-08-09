import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_315_board_persistence_port.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import portSource from "../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";
import { fedosPersistedBoardPostRecordsAreEqual } from "../src/os/messenger/board/persistence/fedos_board_persistence.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/os/messenger/board/persistence/fedos_persisted_board_post_v1.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const RECORD: FedosPersistedBoardPostRecordV1 = {
  schemaVersion: 1,
  id: "post-1",
  boardId: "board-1",
  threadId: "post-1",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "Hello board world",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "abc123" },
};

/**
 * Secure Runtime Alpha 315 -- "Board Persistence Port": Stage 5 of the
 * Canonical Board Persistence Boundary Arc. Adds
 * src/board/persistence/fedos_board_persistence.ts, exporting
 * FedosBoardPersistence, FedosBoardPersistenceWriteResult, and
 * fedosPersistedBoardPostRecordsAreEqual -- no delete this Arc.
 */
describe("Secure Runtime Alpha 315 -- Board Persistence Port", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: the port has no delete method", () => {
    expect(codeOnly(portSource)).not.toMatch(/deletePost|removePost/);
  });

  it("3. structural: FedosBoardPersistenceWriteResult is a fixed four-value union", () => {
    expect(portSource).toMatch(
      /export type FedosBoardPersistenceWriteResult = "inserted" \| "already-present" \| "conflict" \| "failed";/,
    );
  });

  it("4. behavioral: fedosPersistedBoardPostRecordsAreEqual is true for two independently-built, field-equal records", () => {
    const a: FedosPersistedBoardPostRecordV1 = { ...RECORD };
    const b: FedosPersistedBoardPostRecordV1 = {
      ...RECORD,
      author: { ...RECORD.author },
      source: { ...RECORD.source },
    };
    expect(a).not.toBe(b);
    expect(fedosPersistedBoardPostRecordsAreEqual(a, b)).toBe(true);
  });

  it("5. behavioral: fedosPersistedBoardPostRecordsAreEqual is false when any single field differs", () => {
    expect(fedosPersistedBoardPostRecordsAreEqual(RECORD, { ...RECORD, body: "different" })).toBe(false);
    expect(
      fedosPersistedBoardPostRecordsAreEqual(RECORD, {
        ...RECORD,
        author: { ...RECORD.author, publicIdentifier: "different" },
      }),
    ).toBe(false);
    expect(
      fedosPersistedBoardPostRecordsAreEqual(RECORD, {
        ...RECORD,
        source: { ...RECORD.source, reference: "different" },
      }),
    ).toBe(false);
  });

  it("6. structural: no database-specific vocabulary, SQL, KV, filesystem, or Secure Runtime handle reference IN CODE", () => {
    expect(codeOnly(portSource)).not.toMatch(
      /\btable\b|\brow\b|\bSQL\b|\bquery\b|\btransaction\b|AeadCiphertextWire|RuntimeStorageBackend|\bpath\b/i,
    );
  });

  it("7. structural: no network, no async function anywhere in the file", () => {
    expect(portSource).not.toMatch(/fetch\(|WebSocket|async function|Promise</);
  });

  it("8. the design doc documents the future async-port strategy explicitly", () => {
    expect(designDocSource).toMatch(/mirroring\s+`SpaceDirectory`\/`AsyncSpaceDirectory`'s own existing\s+SEPARATE-interface/);
  });

  it("9. the design doc cross-references Alpha 313, Alpha 302, Alpha 311, and Alpha 316", () => {
    for (const ref of [
      "secure_runtime_alpha_313_persisted_board_record_v1",
      "secure_runtime_alpha_302_board_repository_contract",
      "secure_runtime_alpha_311_existing_board_persistence_inventory",
      "secure_runtime_alpha_316_in_memory_board_persistence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
