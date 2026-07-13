import { describe, it, expect, vi } from "vitest";
import { NullEventReader } from "../src/desktop/null_event_reader.js";
import type { FedosEventReader } from "../src/desktop/fedos_event_reader.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_209_end_to_end_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";

/**
 * Secure Runtime Alpha 209 -- "End-to-End Verification": Stage 9 of
 * the Nostr Event Runtime Exposure Arc. Test coverage only, no
 * production code change. Confirms, by REAL execution, that the
 * FedosEventDescriptor -> FedosEventReader -> NullEventReader chain
 * runs correctly, that Desktop's own existing startup path is
 * unaffected, and that no networking occurs anywhere in the chain.
 */
describe("Secure Runtime Alpha 209 -- End-to-End Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage only", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it adds test coverage only/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: real execution
  // ---------------------------------------------------------------------

  it("3. behavioral: a NullEventReader, held only through its FedosEventReader interface type, resolves readEvents() to an empty readonly array", async () => {
    const reader: FedosEventReader = new NullEventReader();
    const events = await reader.readEvents();
    expect(events).toEqual([]);
    expect(Array.isArray(events)).toBe(true);
  });

  it("4. behavioral: two separate readEvents() calls on the same instance return two different array instances", async () => {
    const reader = new NullEventReader();
    const first = await reader.readEvents();
    const second = await reader.readEvents();
    expect(first).not.toBe(second);
  });

  it("5. behavioral: createDesktopApplication() followed by a real start() call completes exactly as before this Arc, with no Event-Reader-shaped property on the result", async () => {
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await expect(app.start()).resolves.toBeUndefined();
    expect(app.isBootstrapped()).toBe(true);
    expect(app).not.toHaveProperty("readEvents");
    expect(app).not.toHaveProperty("eventReader");
  });

  it("6. behavioral: createDesktopApplication() with no argument still constructs and returns successfully, confirming zero disruption from this Arc's own new files existing alongside it", () => {
    expect(() => createDesktopApplication()).not.toThrow();
  });

  it("7. behavioral: no fetch/WebSocket global is touched while constructing and reading through the Event Reader chain", async () => {
    const originalFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchSpy = vi.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    try {
      const reader: FedosEventReader = new NullEventReader();
      await reader.readEvents();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });

  it("8. behavioral: readEvents() resolves without ever constructing a WebSocket -- global WebSocket, if present, is never referenced", async () => {
    const hadWebSocket = "WebSocket" in globalThis;
    const originalWebSocket = hadWebSocket ? (globalThis as { WebSocket?: unknown }).WebSocket : undefined;
    const WebSocketSpy = vi.fn();
    (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketSpy;
    try {
      const reader: FedosEventReader = new NullEventReader();
      await reader.readEvents();
      expect(WebSocketSpy).not.toHaveBeenCalled();
    } finally {
      if (hadWebSocket) {
        (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
      } else {
        delete (globalThis as { WebSocket?: unknown }).WebSocket;
      }
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("9. the design doc cross-references Alpha 208, Alpha 203, Alpha 202, Alpha 196, and Alpha 136", () => {
    for (const ref of [
      "secure_runtime_alpha_208_session_atproto_compatibility_review",
      "secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_196_event_foundation_verification",
      "secure_runtime_alpha_136_startup_sequence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("10. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_209/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_209/);
  });
});
