import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationSource from "../src/board/observation/fedos_delivery_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/board/observation/fedos_delivery_observation_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/board/observation/fedos_delivery_observation_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemorySource from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/board/observation/fedos_delivery_observation_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/board/observation/fedos_delivery_observation_query.ts?raw";

/**
 * Secure Runtime Alpha 468 -- "Delivery Observation Security Regression
 * Guards": Stage 8 of the Alpha 461-470 Canonical Delivery Observation
 * Arc. Mechanically re-verifies every absolute prohibition this Arc's
 * own instructions named (Publisher, Retry, Pool, GUI, Nostr signing,
 * Board, Ontology, p2p) against real source text -- not restated from
 * the Stage-by-stage doc comments alone.
 */

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

const ALL_SOURCES: Record<string, string> = {
  "fedos_delivery_observation.ts": observationSource,
  "fedos_delivery_observation_codec.ts": codecSource,
  "fedos_delivery_observation_persistence.ts": persistenceSource,
  "in_memory_fedos_delivery_observation_persistence.ts": inMemorySource,
  "fedos_delivery_observation_repository.ts": repositorySource,
  "fedos_delivery_observation_query.ts": querySource,
};

describe("Secure Runtime Alpha 468 -- Delivery Observation Security Regression Guards", () => {
  it("1. no file imports from src/board/outbox, src/board/publish, or any other Board path", () => {
    for (const [name, source] of Object.entries(ALL_SOURCES)) {
      expect(codeOnlyLines(source), name).not.toMatch(/from\s+["'].*\/(outbox|publish)\//);
      expect(codeOnlyLines(source), name).not.toMatch(/from\s+["'].*\.\.\/(fedos_board|repository|persistence\/fedos_board)/);
    }
  });

  it("2. no file references Nostr, Relay, Schnorr, Master Seed, or a signing authority", () => {
    for (const [name, source] of Object.entries(ALL_SOURCES)) {
      const code = codeOnlyLines(source);
      expect(code, name).not.toMatch(/nostr/i);
      expect(code, name).not.toMatch(/relay/i);
      expect(code, name).not.toMatch(/schnorr/i);
      expect(code, name).not.toMatch(/masterseed|master_seed/i);
      expect(code, name).not.toMatch(/signingauthority/i);
    }
  });

  it("3. no file references retry, backoff, or a connection pool", () => {
    for (const [name, source] of Object.entries(ALL_SOURCES)) {
      const code = codeOnlyLines(source);
      expect(code, name).not.toMatch(/retry/i);
      expect(code, name).not.toMatch(/backoff/i);
      expect(code, name).not.toMatch(/\bpool\b/i);
    }
  });

  it("4. no file references a GUI, Ontology, or p2p/ concern", () => {
    for (const [name, source] of Object.entries(ALL_SOURCES)) {
      const code = codeOnlyLines(source);
      expect(code, name).not.toMatch(/ontology/i);
      expect(code, name).not.toMatch(/p2p\//);
      expect(code, name).not.toMatch(/\breact\b|\bdom\b|<[a-z]+ /i);
    }
  });

  it("5. no file references the uncommitted FedosBoardOutboxObservation or FedosNostrBoardPublisher threads by name", () => {
    for (const [name, source] of Object.entries(ALL_SOURCES)) {
      const code = codeOnlyLines(source);
      expect(code, name).not.toMatch(/FedosBoardOutboxObservation/);
      expect(code, name).not.toMatch(/FedosNostrBoardPublisher/);
      expect(code, name).not.toMatch(/FedosBoardOutboxPublisher/);
      expect(code, name).not.toMatch(/FedosPublishScheduler/);
    }
  });

  it("6. fedos_delivery_observation.ts is the foundational type file -- zero imports of any kind", () => {
    expect(codeOnlyLines(observationSource)).not.toMatch(/^import/m);
  });

  it("7. no file has a mutation/setter/delete/update method name", () => {
    for (const [name, source] of Object.entries(ALL_SOURCES)) {
      const code = codeOnlyLines(source);
      expect(code, name).not.toMatch(/\bdelete[A-Z]\w*\s*\(/);
      expect(code, name).not.toMatch(/\bupdate[A-Z]\w*\s*\(/);
      expect(code, name).not.toMatch(/\bset[A-Z]\w*\s*\(/);
    }
  });
});
