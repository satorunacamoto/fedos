import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopRuntimeSource from "../src/desktop/runtime/fedos_desktop_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import privateTransportSource from "../src/conversation/transport/fedos_private_transport.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/conversation/transport/fedos_conversation_transport_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import eventSource from "../src/conversation/transport/fedos_conversation_transport_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import multiRelayPublisherSource from "../src/conversation/transport/relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySetSource from "../src/conversation/transport/relay/fedos_conversation_relay_set.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inboundSubscriptionSource from "../src/conversation/transport/relay/fedos_conversation_inbound_subscription.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/** Import-statement-shaped patterns only -- this arc's own doc comments legitimately NAME Tor/onion/ActivityPub/AT-Protocol as explicit exclusions (the SAME "No Worker, Ontology, p2p/" guardrail-prose convention `fedos_desktop_runtime.ts`'s own header already uses), so a blind whole-file text scan would flag its own guardrail comments. Mirrors the Alpha 1051-1110 guard's own `/from ["'].*\/p2p\//` import-only pattern. */
const FORBIDDEN_IMPORT_PATTERNS = [
  /from ["'][^"']*[/_]tor[/_.]/i,
  /from ["'][^"']*onion[^"']*["']/i,
  /from ["'][^"']*activitypub[^"']*["']/i,
  /from ["'][^"']*atproto[^"']*["']/i,
];

/**
 * Secure Runtime Alpha 1471-1540 ("Private Transport Boundary and
 * Multi-Relay Delivery Arc") — its own structural guards, mirroring this
 * repository's established per-Arc pattern (see e.g. Alpha 1051-1110's
 * own `test/secure_runtime_alpha_1051_1110_structural_guards.test.ts`).
 */
describe("Secure Runtime Alpha 1471-1540 -- Private Transport Structural Guards", () => {
  it("1. exactly ONE call site constructs FedosPrivateTransport in the entire src/ tree (no duplicate Transport ownership)", () => {
    const callSites = [...desktopRuntimeSource.matchAll(/new FedosPrivateTransport\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("2. FedosRunningDesktopRuntime exposes privateTransport() as a sibling accessor to boardRuntime()/conversationRuntime()", () => {
    expect(desktopRuntimeSource).toMatch(/privateTransport\(\):\s*FedosPrivateTransport;/);
    expect(desktopRuntimeSource).toMatch(/boardRuntime\(\):\s*FedosBoardRuntime;/);
    expect(desktopRuntimeSource).toMatch(/conversationRuntime\(\):\s*FedosConversationRuntime;/);
  });

  it("3. no new production dependency was introduced by this arc -- still exactly @noble/curves and @noble/hashes", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string> };
    expect(Object.keys(parsed.dependencies).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("4. package.json's own scripts carry no entry point added by THIS arc -- genuinely stale otherwise (updated per later Arcs' own 'update historical exact-shape tests only when genuinely stale' instruction, e.g. Alpha 4101-4180): the Electron Build Spike/Node Type Isolation/Electron Host Adapter Arcs legitimately added their own entry points well after this arc's own scope closed.", () => {
    const parsed = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    expect(Object.keys(parsed.scripts).sort()).toEqual(
      [
        "build:electron-spike",
        "build:host-bridge",
        "build:runtime",
        "build:wasm",
        "package:electron-spike",
        "start:electron-host-adapter",
        "start:electron-spike",
        "start:runtime",
        "test",
        "test:electron-spike",
        "test:watch",
        "typecheck",
        "typecheck:core",
        "typecheck:electron",
      ].sort(),
    );
  });

  it("5. the wire-packaging event builder hard-fixes kind to the shared FedOS proprietary kind (Alpha 1615's own Kind-1 Closure -- no new Nostr kind is invented, and kind 1 is never used for private ciphertext)", () => {
    expect(eventSource).toMatch(/kind:\s*FEDOS_PRIVATE_NOSTR_DELIVERY_KIND,/);
    expect(eventSource).not.toMatch(/kind:\s*1,/);
  });

  it("6. no import anywhere under the new transport module or its runtime wiring references a Tor/onion/ActivityPub/AT-Protocol module (doc-comment mentions of these as explicit EXCLUSIONS are expected and legitimate -- see e.g. this file's own header)", () => {
    const sources = [
      desktopRuntimeSource,
      privateTransportSource,
      schedulerSource,
      eventSource,
      multiRelayPublisherSource,
      relaySetSource,
      inboundSubscriptionSource,
    ];
    for (const source of sources) {
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it("7. no GUI or Worker reference anywhere under the new transport module or its runtime wiring", () => {
    const sources = [privateTransportSource, schedulerSource, multiRelayPublisherSource, relaySetSource, inboundSubscriptionSource];
    for (const source of sources) {
      expect(source).not.toMatch(/from ["'].*\/worker\.js["']/);
      expect(source).not.toMatch(/from ["'].*\/p2p\//);
    }
  });

  it("8. the Multi-Relay Publisher registers its onRelayMessage listener exactly once per relay (at construction), never inside publish()", () => {
    const constructorMatch = multiRelayPublisherSource.match(/constructor\([\s\S]*?\n  \}/);
    const publishMatch = multiRelayPublisherSource.match(/async publish\([\s\S]*?\n  \}/);
    expect(constructorMatch).not.toBeNull();
    expect(publishMatch).not.toBeNull();
    expect(publishMatch![0]).not.toMatch(/onRelayMessage/);
  });

  it("9. the Mailbox Scheduler imports the Retry Registry / attempt-subject-id / retry-reason codec from the EXISTING board/observation module, never a redefinition", () => {
    expect(schedulerSource).toMatch(/from ["']\.\.\/\.\.\/board\/observation\/fedos_delivery_retry_registry\.js["']/);
    expect(schedulerSource).toMatch(/from ["']\.\.\/\.\.\/board\/observation\/fedos_delivery_attempt_subject_id\.js["']/);
    expect(schedulerSource).toMatch(/from ["']\.\.\/\.\.\/board\/observation\/fedos_delivery_retry_reason_codec\.js["']/);
  });
});
