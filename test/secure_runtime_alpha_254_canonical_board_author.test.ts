import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_254_canonical_board_author.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import authorModuleSource from "../src/os/messenger/board/fedos_board_author.ts?raw";
import type { FedosBoardAuthorReference } from "../src/os/messenger/board/fedos_board_author.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 254 -- "Canonical Board Author Reference": Stage
 * 4 of the Canonical Board Model Foundation Arc. Adds
 * src/board/fedos_board_author.ts, exporting FedosBoardAuthorReference
 * ("Option D") -- identityId/protocol/publicIdentifier only, no
 * displayName/avatar, no key/seed/token field of any kind.
 */
describe("Secure Runtime Alpha 254 -- Canonical Board Author Reference", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc adopts Option D and reviews-and-excludes displayName/avatar with rationale", () => {
    expect(designDocSource).toMatch(/\*\*Adopted\*\*,\s+exactly this Arc's own preferred candidate/);
    expect(designDocSource).toMatch(/\*\*Decision: excluded\.\*\*/);
  });

  it("3. structural: FedosBoardAuthorReference has exactly three fields -- identityId, protocol, publicIdentifier", () => {
    expect(authorModuleSource).toMatch(
      /export interface FedosBoardAuthorReference \{\s*\n(?:\s*\/\*\*.*\*\/\s*\n)?\s*readonly identityId: string \| null;\s*\n\s*readonly protocol: FedosBoardSourceProtocol;\s*\n(?:\s*\/\*\*.*\*\/\s*\n)?\s*readonly publicIdentifier: string;\s*\n\}/,
    );
  });

  it("4. structural: no displayName/avatar field exists", () => {
    expect(codeOnly(authorModuleSource)).not.toMatch(/displayName|avatar/);
  });

  it("5. structural: no private key, Master Seed, auth/OAuth token, session cookie, nsec, or protocol credential field, IN CODE", () => {
    expect(codeOnly(authorModuleSource)).not.toMatch(
      /private ?key|master ?seed|auth.*token|oauth|session ?cookie|nsec|credential/i,
    );
  });

  it("6. behavioral: a FedosBoardAuthorReference value can be constructed with a null identityId for federated content", () => {
    const author: FedosBoardAuthorReference = {
      identityId: null,
      protocol: "nostr",
      publicIdentifier: "npub1exampleexampleexampleexampleexampleexampleexampleexamp",
    };
    expect(author.identityId).toBeNull();
    expect(author.protocol).toBe("nostr");
  });

  it("7. the design doc cross-references Alpha 253, Alpha 255, Alpha 028, and Alpha 040", () => {
    for (const ref of [
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_028_fedos_identity_descriptor",
      "secure_runtime_alpha_040_fedos_identity_record",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
