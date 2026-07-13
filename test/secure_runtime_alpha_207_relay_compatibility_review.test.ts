import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_207_relay_compatibility_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/desktop/fedos_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullEventReaderSource from "../src/desktop/null_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/nostr/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wsRelaySource from "../src/nostr/ws_relay.ts?raw";

const NEW_FILE_SOURCES: Record<string, string> = {
  "fedos_event_descriptor.ts": descriptorSource,
  "fedos_event_reader.ts": readerSource,
  "null_event_reader.ts": nullEventReaderSource,
};

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 207 -- "Future Relay Compatibility Review":
 * Stage 7 of the Nostr Event Runtime Exposure Arc. Review only.
 * Confirms FedosEventReader names no Relay/WebSocket/Subscription/
 * Filter concept, and that src/nostr/relay.ts / ws_relay.ts remain
 * unmodified and unimported.
 */
describe("Secure Runtime Alpha 207 -- Future Relay Compatibility Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: none of the three new files references Relay/WebSocket/Subscription/Filter IN CODE", () => {
    for (const [name, source] of Object.entries(NEW_FILE_SOURCES)) {
      expect(codeOnly(source), name).not.toMatch(/Relay|WebSocket|Subscription|Filter/);
    }
  });

  it("4. structural: readEvents() returns a single Promise of a finite array -- no streaming/callback/emitter shape", () => {
    expect(readerSource).toMatch(/readEvents\(\): Promise<readonly FedosEventDescriptor\[\]>;/);
    expect(readerSource).not.toMatch(/callback|emitter|on\(|subscribe/i);
  });

  it("5. structural: none of the three new files imports src/nostr/relay.ts or src/nostr/ws_relay.ts", () => {
    for (const source of Object.values(NEW_FILE_SOURCES)) {
      expect(source).not.toMatch(/from ".*nostr\/(relay|ws_relay)\.js"/);
    }
  });

  it("6. structural: src/nostr/relay.ts and src/nostr/ws_relay.ts carry no reference to this Stage's own doc or the new symbols", () => {
    for (const source of [relaySource, wsRelaySource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_207/);
      expect(source).not.toMatch(/FedosEventReader|FedosEventDescriptor|NullEventReader/);
    }
  });

  it("7. the design doc previews a hypothetical RelayEventReader without implementing one", () => {
    expect(designDocSource).toMatch(/A hypothetical `RelayEventReader`/);
  });

  it("8. the design doc's own 'does NOT do' list confirms no Relay implementation was added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* implement `RelayEventReader` or any Relay-backed/,
    );
  });

  it("9. the design doc cross-references Alpha 206, Alpha 202, Alpha 101, Alpha 103, and Alpha 200", () => {
    for (const ref of [
      "secure_runtime_alpha_206_runtime_boundary_review",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_103_source_injection",
      "secure_runtime_alpha_200_event_foundation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
