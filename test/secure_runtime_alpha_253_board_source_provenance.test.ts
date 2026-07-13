import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_253_board_source_provenance.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceModuleSource from "../src/board/fedos_board_source.ts?raw";
import {
  FEDOS_BOARD_SOURCE_PROTOCOLS,
  isFedosBoardSourceProtocol,
  fedosBoardSourceKey,
  type FedosBoardSourceReference,
} from "../src/board/fedos_board_source.js";

/**
 * Secure Runtime Alpha 253 -- "Board Source Provenance": Stage 3 of the
 * Canonical Board Model Foundation Arc. Adds
 * src/board/fedos_board_source.ts, exporting FedosBoardSourceProtocol
 * (a closed five-value union) and FedosBoardSourceReference (protocol +
 * opaque reference, exactly two fields).
 */
describe("Secure Runtime Alpha 253 -- Board Source Provenance", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. FEDOS_BOARD_SOURCE_PROTOCOLS carries exactly the five named protocols", () => {
    expect([...FEDOS_BOARD_SOURCE_PROTOCOLS].sort()).toEqual(
      ["activitypub", "atproto", "fedos", "nostr", "session"].sort(),
    );
  });

  it("3. isFedosBoardSourceProtocol accepts every known protocol and rejects unknown/malformed values", () => {
    for (const protocol of FEDOS_BOARD_SOURCE_PROTOCOLS) {
      expect(isFedosBoardSourceProtocol(protocol)).toBe(true);
    }
    expect(isFedosBoardSourceProtocol("bluesky")).toBe(false);
    expect(isFedosBoardSourceProtocol("")).toBe(false);
    expect(isFedosBoardSourceProtocol("Nostr")).toBe(false); // case-sensitive
  });

  it("4. fedosBoardSourceKey names the duplicate-import identity rule: same protocol + reference -> same key", () => {
    const a: FedosBoardSourceReference = { protocol: "nostr", reference: "abc123" };
    const b: FedosBoardSourceReference = { protocol: "nostr", reference: "abc123" };
    const c: FedosBoardSourceReference = { protocol: "activitypub", reference: "abc123" };
    expect(fedosBoardSourceKey(a)).toBe(fedosBoardSourceKey(b));
    expect(fedosBoardSourceKey(a)).not.toBe(fedosBoardSourceKey(c));
  });

  it("5. structural: FedosBoardSourceReference carries exactly two fields -- no metadata bag, no token/credential field", () => {
    expect(sourceModuleSource).toMatch(
      /export interface FedosBoardSourceReference \{\s*\n\s*readonly protocol: FedosBoardSourceProtocol;\s*\n\s*readonly reference: string;\s*\n\}/,
    );
    const codeOnly = sourceModuleSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
      .join("\n");
    expect(codeOnly).not.toMatch(/token|credential|signature|metadata:|\[key: string\]/i);
  });

  it("6. the design doc cross-references Alpha 252 and Alpha 259", () => {
    for (const ref of [
      "secure_runtime_alpha_252_canonical_board_identifiers",
      "secure_runtime_alpha_259_protocol_neutrality_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
