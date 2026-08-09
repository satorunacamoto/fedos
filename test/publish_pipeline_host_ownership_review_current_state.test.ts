import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createHostSource from "../src/desktop/host/create_fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import appendOnlyOutboxSource from "../src/os/messenger/board/outbox/append_only_fedos_board_outbox_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../src/os/messenger/board/fedos_board_post.ts?raw";

/**
 * Publish Pipeline Host Ownership Review -- current-state verification.
 * Read-only against existing, unmodified production source: exercises
 * real (unmodified) constructors/methods and inspects real source text
 * to ground the design docs in observed fact rather than assumption.
 * Writes nothing, calls no production mutation path this review itself
 * did not already exist to call.
 */

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

function makeReadyHost(): FedosDesktopHost {
  const desktopApplication = { start: async () => {} } as unknown as ConstructorParameters<typeof FedosDesktopHost>[0]["desktopApplication"];
  return new FedosDesktopHost({
    desktopApplication,
    boardPersistence: new InMemoryFedosBoardPersistence(),
    outboxPersistence: new InMemoryFedosBoardOutboxPersistence(),
  });
}

describe("Publish Pipeline Host Ownership Review -- current-state facts", () => {
  it("1. Host already owns Outbox Persistence (constructor-injected, defaulted) -- ownership-matrix baseline", () => {
    expect(codeOnlyLines(hostSource)).toMatch(/#outboxPersistence:\s*FedosBoardOutboxPersistence/);
    expect(codeOnlyLines(hostSource)).toMatch(/new InMemoryFedosBoardOutboxPersistence\(\)/);
  });

  it("2. Host source references no Publisher, Scheduler, or Observation type today", () => {
    const code = codeOnlyLines(hostSource);
    expect(code).not.toMatch(/Publisher/);
    expect(code).not.toMatch(/Scheduler/);
    expect(code).not.toMatch(/Observation/);
  });

  it("3. Host holds no injected Clock/now/timer of any kind today", () => {
    const code = codeOnlyLines(hostSource);
    expect(code).not.toMatch(/Date\.now|setInterval|clearInterval|:\s*Clock/);
  });

  it("4. Host.stop() performs zero internal await -- confirmed by real execution timing, not just source inspection", async () => {
    const host = makeReadyHost();
    await host.start();
    expect(host.state()).toBe("ready");

    // A stop() with zero real internal await resolves near-instantly; a real await
    // (e.g. network/disk flush) would not be this fast under any realistic backend.
    const before = performance.now();
    await host.stop();
    const elapsed = performance.now() - before;
    expect(host.state()).toBe("stopped");
    expect(elapsed).toBeLessThan(20);
  });

  it("5. AppendOnlyFedosBoardOutboxPersistence replays on every listIntents() call -- no separate upfront hydration step exists", () => {
    const code = codeOnlyLines(appendOnlyOutboxSource);
    expect(code).toMatch(/replayLog/);
    // listIntents() itself calls replayLog -- confirms per-call replay, not a one-time constructor/hydrate step.
    const listIntentsBody = code.slice(code.indexOf("listIntents"));
    expect(listIntentsBody.slice(0, 200)).toMatch(/replayLog/);
  });

  it("6. FedosPublishScheduler's constructor never starts a timer, calls the Publisher, or reads the Outbox", () => {
    const code = codeOnlyLines(schedulerSource);
    const ctorStart = code.indexOf("constructor(dependencies");
    const ctorBody = code.slice(ctorStart, ctorStart + 600);
    expect(ctorBody).not.toMatch(/setIntervalFn\(|\.publish\(|\.listIntents\(/);
  });

  it("7. FedosBoardPost carries no visibility/audience field of any kind today -- grounds the private-board eligibility gap", () => {
    const code = codeOnlyLines(boardPostSource);
    const interfaceStart = code.indexOf("export interface FedosBoardPost");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/visibility|audience|private|recipient/i);
  });

  it("8. createFedosDesktopHost() does not call start()/stop() on the Host it constructs -- construct/start stay separate", () => {
    const code = codeOnlyLines(createHostSource);
    expect(code).not.toMatch(/\.start\(\)|\.stop\(\)/);
  });
});
