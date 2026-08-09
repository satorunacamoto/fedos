import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_218_relay_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const RELAY_SYMBOLS = ["FedosRelay", "NullRelay", "WebSocketRelay", "FedosRelaySocket", "FedosRelaySocketFactory"];
const RUNTIME_WORKER_DESKTOP_FILES: Record<string, string> = {
  "create_runtime.ts": createRuntimeSource,
  "types.ts": runtimeTypesSource,
  "worker.ts": workerSource,
  "desktop_application.ts": desktopApplicationSource,
  "create_desktop_application.ts": createDesktopApplicationSource,
};

/**
 * Secure Runtime Alpha 218 -- "Relay Boundary Review": Stage 8 of the
 * Nostr Relay Foundation Arc. Review only. Confirms Desktop owns the
 * Relay boundary (all three new files live under src/desktop/,
 * unimported by desktop_application.ts) and Runtime remains
 * Relay-independent (zero reference from AppRuntime/create_runtime.ts/
 * types.ts/worker.ts).
 */
describe("Secure Runtime Alpha 218 -- Relay Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: zero reference to any of the five Relay symbols across all five Runtime/Worker/Desktop files", () => {
    for (const [name, source] of Object.entries(RUNTIME_WORKER_DESKTOP_FILES)) {
      for (const symbol of RELAY_SYMBOLS) {
        expect(source, `${name} should not reference ${symbol}`).not.toMatch(new RegExp(`\\b${symbol}\\b`));
      }
    }
  });

  it("4. structural: none of the three new Relay files imports desktop_application.ts or create_desktop_application.ts", () => {
    for (const source of [relaySource, nullRelaySource, websocketRelaySource]) {
      expect(source).not.toMatch(/desktop_application|create_desktop_application/);
    }
  });

  it("5. structural: package.json dependency count remains 2 -- unchanged across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("6. the design doc's own §5 records the five-symbol/five-file grep with zero matches", () => {
    expect(designDocSource).toMatch(/zero matches, all five/);
  });

  it("7. the design doc cross-references Alpha 217, Alpha 206, Alpha 198, Alpha 089, and Alpha 211", () => {
    for (const ref of [
      "secure_runtime_alpha_217_relay_foundation_verification",
      "secure_runtime_alpha_206_runtime_boundary_review",
      "secure_runtime_alpha_198_event_runtime_boundary_review",
      "secure_runtime_alpha_089_desktop_runtime_separation_review",
      "secure_runtime_alpha_211_relay_code_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. Regression: none of the five Runtime/Worker/Desktop files carries a reference to this Stage's own doc", () => {
    for (const source of Object.values(RUNTIME_WORKER_DESKTOP_FILES)) {
      expect(source).not.toMatch(/secure_runtime_alpha_218/);
    }
  });
});
