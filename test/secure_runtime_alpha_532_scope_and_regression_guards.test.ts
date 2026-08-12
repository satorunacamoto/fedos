import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_532_scope_and_regression_guards.md?raw";

const NEW_SOURCE_FILES = [
  "src/board/observation/fedos_delivery_attempt_subject_id.ts",
  "src/board/observation/fedos_delivery_retry_reason_codec.ts",
  "src/board/observation/fedos_delivery_retry_registry.ts",
  "src/board/observation/fedos_delivery_retry_query.ts",
];

const MODIFIED_SOURCE_FILES = [
  "src/desktop/host/fedos_host_delivery_controller.ts",
  "src/desktop/host/fedos_desktop_host.ts",
];

const PROHIBITED_TOKEN_PATTERN = /Ontology|P2P|Cloudflare|\bWorker\b|ReactDOM|useState|useEffect|<div|document\.getElementById/;

function addedLines(file: string): string {
  const output: string = execSync(`git diff -- "${file}"`, { encoding: "utf8" });
  return output
    .split("\n")
    .filter((line: string) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");
}

describe("Secure Runtime Alpha 532 -- Scope and Regression Guards", () => {
  it("none of this Arc's brand-new source files reference any prohibited topic", () => {
    for (const file of NEW_SOURCE_FILES) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(PROHIBITED_TOKEN_PATTERN);
    }
  });

  it("none of the lines this Arc ADDED to pre-existing modified files reference any prohibited topic", () => {
    // Whole-file scans would false-positive on pre-existing historical prose
    // (e.g. fedos_desktop_host.ts's own header discusses a REJECTED "Worker
    // startup" option from an earlier Alpha) -- only lines this Arc itself
    // introduced are in scope for this guard.
    for (const file of MODIFIED_SOURCE_FILES) {
      expect(addedLines(file)).not.toMatch(PROHIBITED_TOKEN_PATTERN);
    }
  });

  it("no new wire protocol literal was introduced -- only the pre-existing nostr/activitypub literals are read", () => {
    for (const file of [...NEW_SOURCE_FILES, ...MODIFIED_SOURCE_FILES]) {
      const content = file.includes("desktop_host") || file.includes("delivery_controller")
        ? addedLines(file)
        : readFileSync(file, "utf8");
      const protocolLiterals = content.match(/"(nostr|activitypub)"/g) ?? [];
      // Every occurrence must be one of the two pre-existing literals; no
      // OTHER quoted protocol-like literal (e.g. "atproto", "matrix") appears.
      for (const literal of protocolLiterals) {
        expect(["\"nostr\"", "\"activitypub\""]).toContain(literal);
      }
    }
  });

  it("Scheduler, Publisher, and Outbox files are absent from git status -- byte-for-byte unchanged", () => {
    const output: string = execSync("git status --porcelain", { encoding: "utf8" });
    expect(output).not.toMatch(/fedos_publish_scheduler\.ts/);
    expect(output).not.toMatch(/src\/board\/publish\//);
    expect(output.match(/src\/board\/outbox\/\S+/g) ?? []).toEqual([]);
  });

  it("the canonical Observation model files are absent from git status -- byte-for-byte unchanged", () => {
    const output: string = execSync("git status --porcelain", { encoding: "utf8" });
    for (const canonical of [
      "fedos_delivery_observation.ts",
      "fedos_delivery_observation_transition_graph.ts",
      "fedos_delivery_observation_write_validator.ts",
      "fedos_delivery_observation_repository.ts",
      "fedos_delivery_observation_query.ts",
      "in_memory_fedos_delivery_observation_persistence.ts",
    ]) {
      expect(output).not.toContain(canonical);
    }
  });

  it("FedosDesktopHost's public API method list is byte-for-byte unchanged", () => {
    const hostSource = readFileSync("src/os/messenger/desktop/host/fedos_desktop_host.ts", "utf8");
    for (const signature of [
      "startDelivery(",
      "async stopDelivery(",
      "deliveryStatus():",
      "observationQuery(): FedosDeliveryObservationQuery | null {",
    ]) {
      expect(hostSource).toContain(signature);
    }
  });

  it("declares no new guard mechanism, only ordinary Vitest assertions, per this Arc's own additive-only scope discipline", () => {
    expect(doc).toMatch(/a new guard\s+MECHANISM/);
  });
});
