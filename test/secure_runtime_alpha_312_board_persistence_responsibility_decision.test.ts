import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_312_board_persistence_responsibility_decision.md?raw";

/**
 * Secure Runtime Alpha 312 -- "Board Persistence Responsibility
 * Decision": Stage 2 of the Canonical Board Persistence Boundary Arc.
 * A design-decision Stage (no new production file). Confirms Option A
 * is adopted against all fifteen required evaluation criteria and that
 * the three named options are explicitly rejected.
 */
describe("Secure Runtime Alpha 312 -- Board Persistence Responsibility Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc adopts Option A as the required preferred candidate", () => {
    expect(designDocSource).toMatch(
      /\*\*Option A\s+—\s+Persist\s+`FedosBoardPost`\s+directly\s+through\s+a\s+dedicated\s+Board\s+persistence\s+boundary\.\*\*\s+\*\*Adopted\*\*/,
    );
  });

  it("3. the design doc's own comparison table covers all fifteen required criteria", () => {
    for (const criterion of [
      "Authority",
      "Protocol neutrality",
      "Rebuildability",
      "Migration",
      "Corruption isolation",
      "Schema evolution",
      "Moderation",
      "Source deduplication",
      "Testing",
      "Backend portability",
      "Storage boundary integrity",
      "Ontology separation",
      "Recovery",
      "Atomicity",
      "Conflict behavior",
    ]) {
      expect(designDocSource).toContain(`**${criterion}**`);
    }
  });

  it("4. the design doc explicitly rejects all three named options", () => {
    expect(designDocSource).toMatch(/Secure Runtime Storage as an arbitrary object store/);
    expect(designDocSource).toMatch(/Ontology Engine as canonical storage/);
    expect(designDocSource).toMatch(/Feed\/Index snapshots as authoritative state/);
  });

  it("5. the design doc rejects Options B, C, D, and E individually", () => {
    expect(designDocSource).toMatch(/Option\s+B\s+—\s+Serialize\s+Board\s+posts\s+and\s+put\s+them\s+into\s+Secure\s+Runtime\s+ciphertext\s+storage\.\s+Rejected\./);
    expect(designDocSource).toMatch(/Option\s+C\s+—\s+Persist\s+only\s+protocol-native\s+source\s+objects\s+and\s+rebuild\s+Board\s+posts\.\s+Rejected\./);
    expect(designDocSource).toMatch(/Option\s+D\s+—\s+Use\s+the\s+P2P\s+Ontology\s+Engine\s+as\s+canonical\s+persistence\.\s+Rejected\./);
    expect(designDocSource).toMatch(/Option\s+E\s+—\s+Persist\s+Repository\/Index\/Feed\s+snapshots\s+as\s+one\s+aggregate\.\s+Rejected\./);
  });

  it("6. the design doc cross-references Alpha 311, Alpha 255, Alpha 302, and Alpha 313", () => {
    for (const ref of [
      "secure_runtime_alpha_311_existing_board_persistence_inventory",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_302_board_repository_contract",
      "secure_runtime_alpha_313_persisted_board_record_v1",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
