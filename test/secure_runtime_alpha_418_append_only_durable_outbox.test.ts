import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync, rmSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardOutboxPersistence } from "../src/board/outbox/append_only_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPersistence } from "../src/board/outbox/fedos_board_outbox_persistence.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const postId = toFedosBoardPostId("post-1")!;
const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1_700_000_000)!;
const record = serializeFedosBoardOutboxIntent(intent);

/**
 * Secure Runtime Alpha 418 -- "Append-Only Durable Outbox Persistence":
 * Stage 8 of the Alpha 411-420 Canonical Board Durable Outbox
 * Foundation Arc.
 */
describe("Secure Runtime Alpha 418 -- Append-Only Durable Outbox Persistence", () => {
  it("1. constructing performs no filesystem I/O -- zero constructor side effects", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const filePath = join(dir, "outbox.jsonl");
    new AppendOnlyFedosBoardOutboxPersistence(filePath);
    expect(existsSync(filePath)).toBe(false);
  });

  it("2. a fresh instance over a missing file behaves like an empty log", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const filePath = join(dir, "outbox.jsonl");
    const persistence: FedosBoardOutboxPersistence = new AppendOnlyFedosBoardOutboxPersistence(filePath);
    expect(persistence.listIntents()).toEqual([]);
    expect(persistence.getIntent("anything")).toBeNull();
  });

  it("3. putIntent appends exactly one JSON line per genuinely new record, then insert/already-present/conflict match InMemory semantics", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const filePath = join(dir, "outbox.jsonl");
    const persistence = new AppendOnlyFedosBoardOutboxPersistence(filePath);
    expect(persistence.putIntent(record)).toBe("inserted");
    expect(persistence.putIntent(record)).toBe("already-present");
    expect(persistence.putIntent({ ...record, createdAt: record.createdAt + 1 })).toBe("conflict");
    expect(persistence.listIntents()).toHaveLength(1);
  });

  it("4. records survive restart -- a fresh instance over the same path recovers every written intent", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const filePath = join(dir, "outbox.jsonl");
    new AppendOnlyFedosBoardOutboxPersistence(filePath).putIntent(record);
    const reopened = new AppendOnlyFedosBoardOutboxPersistence(filePath);
    expect(reopened.getIntent(record.id)).toEqual(record);
    expect(reopened.listIntents()).toEqual([record]);
  });

  it("5. a malformed trailing line throws on replay -- fail closed, never silently repaired", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const filePath = join(dir, "outbox.jsonl");
    appendFileSync(filePath, JSON.stringify(record) + "\n" + "{not valid json" + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardOutboxPersistence(filePath);
    expect(() => persistence.listIntents()).toThrow();
  });

  it("6. a conflicting duplicate id in the log itself throws on replay", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const filePath = join(dir, "outbox.jsonl");
    const conflicting = { ...record, createdAt: record.createdAt + 1 };
    appendFileSync(filePath, JSON.stringify(record) + "\n" + JSON.stringify(conflicting) + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardOutboxPersistence(filePath);
    expect(() => persistence.listIntents()).toThrow();
  });

  it("7. is an independent file from a Board-post append-only log at a different path", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const outboxPath = join(dir, "outbox.jsonl");
    const boardPath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardOutboxPersistence(outboxPath);
    persistence.putIntent(record);
    expect(existsSync(boardPath)).toBe(false);
  });

  it("8. type-level: AppendOnlyFedosBoardOutboxPersistence satisfies FedosBoardOutboxPersistence", () => {
    dir = mkdtempSync(join(tmpdir(), "a418-"));
    const filePath = join(dir, "outbox.jsonl");
    const persistence: FedosBoardOutboxPersistence = new AppendOnlyFedosBoardOutboxPersistence(filePath);
    expect(typeof persistence.putIntent).toBe("function");
  });
});
