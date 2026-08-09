import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/conversations/persistence/append_only_fedos_conversation_persistence.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync, rmSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/append_only_fedos_conversation_persistence.js";
import type { FedosConversationPersistence } from "../src/os/messenger/conversations/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/os/messenger/conversations/persistence/fedos_persisted_conversation_record_v1.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

const RECORD: FedosPersistedConversationRecordV1 = {
  schemaVersion: 1,
  id: "board-a::thread-1",
  mode: "public",
  boardId: "board-a",
  rootThreadId: "thread-1",
  rootPostId: "thread-1",
  policyReference: "public-v1",
  createdAt: 1_700_000_000,
};

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 752 ("Append-Only Persistence") -- Stage 12 of
 * the Alpha 741-760 Canonical Conversation Identity and Record
 * Foundation Arc. Mirrors `test/secure_runtime_alpha_353_append_only_persistence_implementation.test.ts`'s
 * own established pattern.
 */
describe("Secure Runtime Alpha 752 -- AppendOnlyFedosConversationPersistence", () => {
  it("1. constructing does not create the file -- no constructor I/O", () => {
    dir = mkdtempSync(join(tmpdir(), "a752-"));
    const filePath = join(dir, "conversation.jsonl");
    new AppendOnlyFedosConversationPersistence(filePath);
    expect(existsSync(filePath)).toBe(false);
  });

  it("2. a fresh instance behaves like a fresh, empty persistence", () => {
    dir = mkdtempSync(join(tmpdir(), "a752-"));
    const filePath = join(dir, "conversation.jsonl");
    const persistence: FedosConversationPersistence = new AppendOnlyFedosConversationPersistence(filePath);
    expect(persistence.listConversations()).toEqual([]);
    expect(persistence.getConversation("anything" as FedosConversationId)).toBeNull();
  });

  it("3. putConversation appends exactly one durable record, readable after reconstruction", () => {
    dir = mkdtempSync(join(tmpdir(), "a752-"));
    const filePath = join(dir, "conversation.jsonl");
    const first = new AppendOnlyFedosConversationPersistence(filePath);
    expect(first.putConversation(RECORD)).toBe("inserted");

    const second = new AppendOnlyFedosConversationPersistence(filePath);
    expect(second.getConversation(RECORD.id as FedosConversationId)).toEqual(RECORD);
  });

  it("4. idempotent duplicate write returns already-present, never rewrites the log", () => {
    dir = mkdtempSync(join(tmpdir(), "a752-"));
    const filePath = join(dir, "conversation.jsonl");
    const persistence = new AppendOnlyFedosConversationPersistence(filePath);
    persistence.putConversation(RECORD);
    expect(persistence.putConversation({ ...RECORD })).toBe("already-present");
  });

  it("5. conflicting duplicate write returns conflict, original preserved", () => {
    dir = mkdtempSync(join(tmpdir(), "a752-"));
    const filePath = join(dir, "conversation.jsonl");
    const persistence = new AppendOnlyFedosConversationPersistence(filePath);
    persistence.putConversation(RECORD);
    expect(persistence.putConversation({ ...RECORD, createdAt: 1 })).toBe("conflict");
    expect(persistence.getConversation(RECORD.id as FedosConversationId)?.createdAt).toBe(RECORD.createdAt);
  });

  it("6. a malformed (truncated/non-JSON) trailing line fails closed -- throws, never silently repaired", () => {
    dir = mkdtempSync(join(tmpdir(), "a752-"));
    const filePath = join(dir, "conversation.jsonl");
    appendFileSync(filePath, JSON.stringify(RECORD) + "\n{not valid json", "utf8");
    const persistence = new AppendOnlyFedosConversationPersistence(filePath);
    expect(() => persistence.listConversations()).toThrow();
  });

  it("7. two lines with the same id and DIFFERENT content throw on replay -- never silently pick a winner", () => {
    dir = mkdtempSync(join(tmpdir(), "a752-"));
    const filePath = join(dir, "conversation.jsonl");
    appendFileSync(filePath, JSON.stringify(RECORD) + "\n" + JSON.stringify({ ...RECORD, createdAt: 999 }) + "\n", "utf8");
    const persistence = new AppendOnlyFedosConversationPersistence(filePath);
    expect(() => persistence.listConversations()).toThrow();
  });

  it("8. structural: AppendOnlyFedosConversationPersistence is the only export", () => {
    const exportCount = (implementationSource.match(/^export /gm) ?? []).length;
    expect(exportCount).toBe(1);
    expect(implementationSource).toMatch(/export class AppendOnlyFedosConversationPersistence implements FedosConversationPersistence \{/);
  });

  it("9. structural: no external dependency -- only node:fs, reached via the established @ts-expect-error pattern", () => {
    // `\r?\n` -- this file is checked out with CRLF line endings on this
    // platform (see e.g. `test/secure_runtime_alpha_436_...ts`'s own note).
    expect(implementationSource).toMatch(
      /\/\/ @ts-expect-error `node:fs` has no type declarations without `@types\/node` in this project's tsconfig\.\r?\nimport \{ readFileSync, appendFileSync \} from "node:fs";/,
    );
    expect(codeOnlyLines(implementationSource)).not.toMatch(/from ["'](?!\.\/|\.\.\/|node:fs)/);
  });

  it("10. structural: the constructor performs field assignment only -- no fs call in the constructor body", () => {
    const ctorMatch = implementationSource.match(/constructor\(filePath: string\) \{[\s\S]*?\n {2}\}/);
    expect(ctorMatch).not.toBeNull();
    expect(ctorMatch![0]).not.toMatch(/readFileSync|appendFileSync|existsSync/);
  });

  it("11. structural: no delete/compaction/rewrite method of any kind in actual CODE -- the header comment's own prose explaining what is deliberately absent does not count", () => {
    expect(codeOnlyLines(implementationSource)).not.toMatch(/delete\w*\s*\(|compact|rewrite|truncate/i);
  });
});
