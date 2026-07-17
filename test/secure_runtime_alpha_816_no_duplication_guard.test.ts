import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationRecordSource from "../src/conversation/fedos_conversation_record.ts?raw";

/**
 * Secure Runtime Alpha 816 ("No Conversation Record Duplication Guard")
 * -- Stage 26 of the Alpha 791-820 Conversation Retention & Private
 * Payload Storage Boundary Foundation Arc. Verifies, against REAL git
 * state and real source, that this Arc did not touch or duplicate the
 * existing Conversation persistence layer.
 *
 * Pinned to this Arc's own single commit (not a `BASE..HEAD` range) so
 * this check stays scoped to what Alpha 791-820 itself changed, and
 * stays meaningful regardless of how much later, unrelated history
 * (e.g. the Policy Arc's own src/board/runtime/policy/, or Alpha
 * 921/923's conversationRuntime() wiring in src/desktop/runtime/,
 * both landed by the Alpha 1051-1110 Conversation Runtime Consolidation
 * Arc) accumulates on top of it.
 */
const ARC_COMMIT_SHA = "dd7149f";

function diffAgainstBase(path: string): string {
  return execFileSync("git", ["diff", `${ARC_COMMIT_SHA}^`, ARC_COMMIT_SHA, "--", path], { encoding: "utf8" }) as string;
}

describe("Secure Runtime Alpha 816 -- No Conversation Record Duplication Guard", () => {
  it("1. FedosConversationRecord itself is byte-for-byte unchanged by this Arc", () => {
    expect(diffAgainstBase("src/conversation/fedos_conversation_record.ts").trim()).toBe("");
  });

  it("2. src/conversation/persistence/ (Conversation metadata persistence, Alpha 749) is untouched by this Arc", () => {
    expect(diffAgainstBase("src/conversation/persistence/").trim()).toBe("");
  });

  it("3. Board persistence (src/board/persistence/) is untouched by this Arc", () => {
    expect(diffAgainstBase("src/board/persistence/").trim()).toBe("");
  });

  it("4. payload bytes never enter FedosConversationRecord -- it still has exactly 7 fields, none byte/payload-shaped", () => {
    const interfaceStart = conversationRecordSource.indexOf("export interface FedosConversationRecord");
    const interfaceBody = conversationRecordSource.slice(interfaceStart, conversationRecordSource.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/bytes|payload|Uint8Array/i);
  });

  it("5. no second Conversation repository/reader is introduced -- FedosConversationReader/hydration (Alpha 753/756) are untouched", () => {
    expect(diffAgainstBase("src/conversation/fedos_conversation_reader.ts").trim()).toBe("");
    expect(diffAgainstBase("src/conversation/fedos_conversation_hydration.ts").trim()).toBe("");
  });

  it("6. no reference to Outbox Publisher, Board post body, or Relay anywhere under the new retention/payload_storage modules", () => {
    for (const dir of ["src/conversation/retention", "src/conversation/payload_storage"]) {
      const files = (readdirSync(dir) as string[]).filter((name) => name.endsWith(".ts"));
      expect(files.length).toBeGreaterThan(0);
      for (const name of files) {
        const code = readFileSync(join(dir, name), "utf8") as string;
        expect(code, name).not.toMatch(/FedosBoardOutboxPublisher|FedosBoardPost\.body|FedosRelay/);
      }
    }
  });

  it("7. src/board/outbox/ and src/board/observation/ are untouched by this Arc", () => {
    expect(diffAgainstBase("src/board/outbox/").trim()).toBe("");
    expect(diffAgainstBase("src/board/observation/").trim()).toBe("");
  });

  it("8. src/board/runtime/ (FedosBoardRuntime and its command types) is untouched by this Arc -- no Runtime wiring, per Alpha 815's own Option A decision", () => {
    expect(diffAgainstBase("src/board/runtime/").trim()).toBe("");
  });

  it("9. src/desktop/runtime/ (startFedosDesktopRuntime) is untouched by this Arc -- confirms Alpha 815's Option A (port/backends only, no Runtime wiring)", () => {
    expect(diffAgainstBase("src/desktop/runtime/").trim()).toBe("");
  });
});
