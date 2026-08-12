import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopRuntimeSource from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationRuntimeSource from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import assemblySource from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime_assembly.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 1051-1110 ("Conversation Runtime Consolidation
 * Arc") -- its own structural guards, mirroring this repository's
 * established per-Arc pattern (see e.g. Alpha 576/638/718/788/818).
 *
 * This Arc's own work was a `master`-catch-up (fast-forward merge of the
 * already-reviewed `arc/conversation-identity-resolution-encryption-
 * coordinator` integration branch, a strict superset of eight sibling
 * Arc branches) plus closing the "Public API verification" gap that
 * merge exposed -- never a redesign of the Runtime Factory, DI, Host
 * wiring, or Conversation Runtime ownership boundary those sibling Arcs
 * had already established (Alpha 606/671/672/678/921/923). These guards
 * verify that boundary landed in `master` exactly once, not duplicated
 * or re-wired.
 */
describe("Secure Runtime Alpha 1051-1110 -- Conversation Runtime Consolidation Structural Guards", () => {
  it("1. exactly ONE call site constructs FedosConversationRuntime in the entire src/ tree (no duplicate Runtime ownership)", () => {
    const callSites = [...desktopRuntimeSource.matchAll(/createFedosConversationRuntime\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("2. exactly ONE call site assembles the Conversation Runtime's dependency set (no second, competing factory)", () => {
    const callSites = [...desktopRuntimeSource.matchAll(/assembleFedosConversationRuntimeDependencies\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("3. createFedosConversationRuntime itself is defined exactly once, in its own dedicated module", () => {
    const definitions = [...conversationRuntimeSource.matchAll(/^export function createFedosConversationRuntime\(/gm)];
    expect(definitions.length).toBe(1);
  });

  it("4. assembleFedosConversationRuntimeDependencies itself is defined exactly once, in its own dedicated module", () => {
    const definitions = [...assemblySource.matchAll(/^export function assembleFedosConversationRuntimeDependencies\(/gm)];
    expect(definitions.length).toBe(1);
  });

  it("5. FedosRunningDesktopRuntime exposes both boardRuntime() and conversationRuntime() as sibling accessors -- one Local Runtime owns both Application Runtimes, neither wraps the other", () => {
    expect(desktopRuntimeSource).toMatch(/boardRuntime\(\):\s*FedosBoardRuntime;/);
    expect(desktopRuntimeSource).toMatch(/conversationRuntime\(\):\s*FedosConversationRuntime;/);
  });

  it("6. no new production dependency was introduced by this consolidation -- still exactly two", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });

  it("7. this Arc's own file added no p2p/ import anywhere in the two Runtime modules it touched", () => {
    for (const src of [desktopRuntimeSource, conversationRuntimeSource, assemblySource]) {
      expect(src).not.toMatch(/from ["'].*\/p2p\//);
    }
  });

  it("8. package.json's own scripts carry no entry point added by THIS consolidation -- genuinely stale otherwise (updated per later Arcs' own 'update historical exact-shape tests only when genuinely stale' instruction, e.g. Alpha 4101-4180): the Electron Build Spike/Node Type Isolation/Electron Host Adapter Arcs legitimately added their own entry points well after this consolidation's own scope closed.", () => {
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
});
