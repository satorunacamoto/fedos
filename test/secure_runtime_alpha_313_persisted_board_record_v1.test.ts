import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_313_persisted_board_record_v1.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/os/messenger/board/persistence/fedos_persisted_board_post_v1.ts?raw";
import type { FedosPersistedBoardPostRecordV1 } from "../src/board/persistence/fedos_persisted_board_post_v1.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 313 -- "Persisted Board Record V1": Stage 3 of
 * the Canonical Board Persistence Boundary Arc. Adds
 * src/board/persistence/fedos_persisted_board_post_v1.ts, exporting
 * FedosPersistedBoardPostRecordV1 -- plain serializable data only, no
 * branded types, no Map/Set/functions/class instances.
 */
describe("Secure Runtime Alpha 313 -- Persisted Board Record V1", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: FedosPersistedBoardPostRecordV1 is the only export", () => {
    const exportNames = [...recordSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosPersistedBoardPostRecordV1"]);
  });

  it("3. structural: schemaVersion is the literal numeric type 1", () => {
    expect(recordSource).toMatch(/readonly schemaVersion: 1;/);
  });

  it("4. structural: defines a TYPE ONLY -- no function, class, or Map/Set IN CODE", () => {
    expect(codeOnly(recordSource)).not.toMatch(/\bfunction\b|\bclass\b|\bMap</);
    // Set<...> is used nowhere in this type-only file; a plain word-boundary check
    // avoids false-positing on unrelated words like "identifier".
    expect(codeOnly(recordSource)).not.toMatch(/\bSet</);
  });

  it("5. structural: no moderation field of any kind IN CODE", () => {
    expect(codeOnly(recordSource)).not.toMatch(/moderation|deleted|tombstone/i);
  });

  it("6. behavioral: a well-formed record round-trips through JSON losslessly (plain serializable data only)", () => {
    const record: FedosPersistedBoardPostRecordV1 = {
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
    const roundTripped = JSON.parse(JSON.stringify(record));
    expect(roundTripped).toEqual(record);
  });

  it("7. the design doc explains why the branded runtime object is not persisted blindly", () => {
    expect(designDocSource).toMatch(/Why NOT persist the branded runtime object blindly/);
  });

  it("8. the design doc adopts 'deferred' for moderation records, never embedded casually", () => {
    expect(designDocSource).toMatch(/\*\*Adopted: \(C\), deferred\.\*\*/);
  });

  it("9. the design doc cross-references Alpha 312, Alpha 252, Alpha 255, and Alpha 258", () => {
    for (const ref of [
      "secure_runtime_alpha_312_board_persistence_responsibility_decision",
      "secure_runtime_alpha_252_canonical_board_identifiers",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_258_moderation_deletion_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
