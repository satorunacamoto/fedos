import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_345_crash_recovery_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import portSource from "../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";

import { fedosPersistedBoardPostRecordsAreEqual } from "../src/board/persistence/fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

const input: FedosBoardPostInput = {
  id: "post-345",
  boardId: "board-345",
  threadId: "post-345",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "duplicate replay check",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "ref-345" },
};

/**
 * Secure Runtime Alpha 345 -- "Crash Recovery Review": Stage 5 of the
 * Alpha 341-350 Board Durable Backend Re-evaluation & Local Backend
 * Selection Arc. Review only. Compares SQLite and append-only across
 * five failure cases; names one bounded, unsolved design gap in
 * append-only's own power-loss handling.
 */
describe("Secure Runtime Alpha 345 -- Crash Recovery Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc reviews all five required failure cases", () => {
    for (const heading of [
      "## 1. Power loss",
      "## 2. Partial write",
      "## 3. Duplicate replay",
      "## 4. Host crash",
      "## 5. Unexpected shutdown",
    ]) {
      expect(designDocSource).toContain(heading);
    }
  });

  it("3. behavioral: duplicate replay of a structurally identical record is a safe no-op, port-level, regardless of backend", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const post = validateFedosBoardPost(input)!;
    const record = serializeFedosBoardPost(post);
    expect(persistence.putPost(record)).toBe("inserted");
    expect(persistence.putPost(record)).toBe("already-present");
    expect(persistence.putPost({ ...record })).toBe("already-present"); // a fresh, structurally-identical object
  });

  it("4. structural: the port's own equality check the duplicate-replay guarantee depends on is field-by-field, not reference equality", () => {
    expect(portSource).toMatch(/export function fedosPersistedBoardPostRecordsAreEqual/);
    expect(typeof fedosPersistedBoardPostRecordsAreEqual).toBe("function");
    const post = validateFedosBoardPost(input)!;
    const a = serializeFedosBoardPost(post);
    const b = serializeFedosBoardPost(post);
    expect(a).not.toBe(b); // distinct objects
    expect(fedosPersistedBoardPostRecordsAreEqual(a, b)).toBe(true); // structurally equal
  });

  it("5. the design doc concludes SQLite tolerates all five cases without qualification", () => {
    expect(normalize(designDocSource)).toContain(
      "**SQLite, without qualification.** Every one of the five cases is",
    );
  });

  it("6. the design doc names the single most important finding -- append-only's own one open power-loss gap", () => {
    expect(normalize(designDocSource)).toContain(
      "This is the single most important finding this Stage contributes to Alpha 349's own selection:",
    );
  });

  it("7. the design doc cross-references Alpha 344, Alpha 343, Alpha 342, and Alpha 315", () => {
    for (const ref of [
      "secure_runtime_alpha_344_append_only_backend_review",
      "secure_runtime_alpha_343_sqlite_review",
      "secure_runtime_alpha_342_current_persistence_review",
      "secure_runtime_alpha_315_board_persistence_port",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
