import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxObservationSource from "../src/board/outbox/fedos_board_outbox_observation.ts?raw";
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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";

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
 * Secure Runtime Alpha 485 -- "Observation/Publisher Awareness Review":
 * Stage 5 of the Alpha 481-490 Publish Pipeline Integration Review Arc.
 * Review test only.
 */
describe("Secure Runtime Alpha 485 -- Observation/Publisher Awareness Review", () => {
  const deliveryObservationSources = [
    observationTypeSource,
    observationCodecSource,
    observationPersistenceSource,
    observationInMemorySource,
    observationRepositorySource,
    observationQuerySource,
  ];

  it("1. no file under src/board/observation/ references Publisher in any form", () => {
    for (const source of deliveryObservationSources) {
      expect(codeOnlyLines(source)).not.toMatch(/Publisher/);
    }
  });

  it("2. fedos_board_outbox_observation.ts references no Publisher type", () => {
    expect(codeOnlyLines(outboxObservationSource)).not.toMatch(/Publisher/);
  });

  it("3. the Scheduler is the sole file referencing both a Publisher type and an Observation constructor -- the intended integration point", () => {
    const code = codeOnlyLines(schedulerSource);
    expect(code).toMatch(/FedosBoardOutboxPublisher/);
    expect(code).toMatch(/createFedosBoardOutboxObservation/);
  });
});
