import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxTypesSource from "../src/board/outbox/fedos_board_outbox_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxPersistenceSource from "../src/board/outbox/fedos_board_outbox_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxCodecSource from "../src/board/outbox/fedos_board_outbox_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationTypeSource from "../src/board/observation/fedos_delivery_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationCodecSource from "../src/board/observation/fedos_delivery_observation_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationPersistenceSource from "../src/board/observation/fedos_delivery_observation_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationInMemorySource from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationRepositorySource from "../src/board/observation/fedos_delivery_observation_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationQuerySource from "../src/board/observation/fedos_delivery_observation_query.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/**
 * Secure Runtime Alpha 489 -- "Publish Pipeline Boundary Dependency
 * Audit": Stage 9 of the Alpha 481-490 Publish Pipeline Integration
 * Review Arc. Review test only.
 */
describe("Secure Runtime Alpha 489 -- Publish Pipeline Boundary Dependency Audit", () => {
  it("1. Outbox core files never reach Desktop, Runtime, WASM, Rust, Publisher, Scheduler, or Observation", () => {
    for (const source of [outboxTypesSource, outboxPersistenceSource, outboxCodecSource]) {
      const code = codeOnlyLines(source);
      expect(code).not.toMatch(/from\s+["'].*desktop/);
      expect(code).not.toMatch(/from\s+["'].*runtime/);
      expect(code).not.toMatch(/from\s+["'].*nostr/);
      expect(code).not.toMatch(/Publisher|Scheduler|Observation/);
    }
  });

  it("2. Outbox core files' only outgoing edge is to Board core identifiers", () => {
    const importLines = codeOnlyLines(outboxTypesSource)
      .split("\n")
      .filter((line) => line.trim().startsWith("import"));
    for (const line of importLines) {
      expect(line).toMatch(/from\s+["']\.\.\/fedos_board_identifiers\.js["']/);
    }
  });

  it("3. FedosDeliveryObservation (src/board/observation/*) has zero outgoing edges outside its own directory", () => {
    const sources = [
      observationTypeSource,
      observationCodecSource,
      observationPersistenceSource,
      observationInMemorySource,
      observationRepositorySource,
      observationQuerySource,
    ];
    for (const source of sources) {
      const fromPaths = [...codeOnlyLines(source).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const path of fromPaths) {
        expect(path).toMatch(/^\.\/fedos_delivery_observation/);
      }
    }
  });
});
