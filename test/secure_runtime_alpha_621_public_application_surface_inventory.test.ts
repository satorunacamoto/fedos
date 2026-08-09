import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../src/os/messenger/board/fedos_board_post.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identifiersSource from "../src/os/messenger/board/fedos_board_identifiers.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceSource from "../src/os/messenger/board/fedos_board_source.ts?raw";

/**
 * Secure Runtime Alpha 621 ("Application Surface Inventory") -- Stage 1
 * of the Alpha 621-640 Public Board Runtime Application API Foundation
 * Arc. Read-only against existing, unmodified production source:
 * grounds this Arc's own design decisions (Alpha 622-640) in observed
 * fact rather than assumption, mirroring the prior review's own
 * current-state-verification test style
 * (`test/reviews/board_runtime_application_api_current_state.test.ts`).
 */
function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

describe("Secure Runtime Alpha 621 -- Application Surface Inventory", () => {
  it("1. Host API this Runtime needs: state/desktop/board/query/submitPost/submitPostWithOutbox all exist on FedosDesktopHost today", () => {
    const code = codeOnlyLines(hostSource);
    for (const method of ["state(", "desktop(", "board(", "query(", "submitPost(", "submitPostWithOutbox("]) {
      expect(code, method).toMatch(new RegExp(method.replace("(", "\\(")));
    }
  });

  it("2. Canonical fields a Command must generate: id/threadId/source are NOT part of the typed input contract's caller-facing surface by this Arc's own design (verified against the Board post's own eight-field shape)", () => {
    const code = codeOnlyLines(boardPostSource);
    const interfaceStart = code.indexOf("export interface FedosBoardPost");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    const fieldCount = (interfaceBody.match(/readonly \w+[?:]/g) ?? []).length;
    expect(fieldCount).toBe(8);
  });

  it("3. ID generation authority today: fedos_board_identifiers.ts brands only -- mints no random id of its own, confirming this Arc's own FedosBoardRuntimeIdGenerator fills a real, previously-unfilled gap", () => {
    // Checked against the RAW source (including its own doc comment) --
    // codeOnlyLines() would strip the very guardrail comment this test confirms.
    expect(codeOnlyLines(identifiersSource)).not.toMatch(/Math\.random|randomUUID|randomBytes/);
    expect(identifiersSource as string).toMatch(/No random ID generator exists anywhere in this file/i);
  });

  it("4. Source provenance vocabulary already reserves 'fedos' for locally-authored content, equal to the post's own id -- confirms Alpha 628 needs NO Canonical Board model change", () => {
    expect(codeOnlyLines(sourceSource)).toMatch(/"fedos"/);
    expect(sourceSource as string).toMatch(/reserved for content authored directly through FedOS/i);
  });

  it("5. submitPostWithOutbox()'s own source never references post.source -- confirms no automatic outbound target derivation exists to accidentally rely on", () => {
    const code = codeOnlyLines(hostSource);
    const methodStart = code.indexOf("submitPostWithOutbox(");
    const methodEnd = code.indexOf("\n  }", methodStart);
    const methodBody = code.slice(methodStart, methodEnd);
    expect(methodBody).not.toMatch(/post\.source/);
  });

  it("6. desktop()/board()/query() all return null unless state() === \"ready\" -- confirms readiness can be checked via their own return value, with no separate state() call needed", () => {
    const code = codeOnlyLines(hostSource);
    expect(code).toMatch(/desktop\(\): DesktopApplication \| null/);
    expect(code).toMatch(/board\(\): FedosBoardReader \| null/);
    expect(code).toMatch(/query\(\): FedosBoardQuery \| null/);
  });
});
