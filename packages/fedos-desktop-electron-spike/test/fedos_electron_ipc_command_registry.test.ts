import { describe, expect, it, vi } from "vitest";
import { FedosIpcCommandRegistry, fedosIpcClosedOutcome, fedosIpcStaleGenerationOutcome, type FedosIpcMainLike } from "../src/fedos_electron_ipc_command_registry.js";

/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent I) — real concurrency regression coverage for
 * `FedosIpcCommandRegistry`. Every test in the "genuinely concurrent"
 * groups below fires TWO OR MORE real overlapping invocations (both started
 * before either resolves, via a manually-controlled deferred promise, or a
 * genuine `Promise.all` over handlers that `await` a macrotask) and asserts
 * on the guard's actual runtime behavior — never a structural/source-grep
 * check standing in for a live race.
 */

/** A promise the test controls the resolution of, so two "concurrent" invocations can be proven to genuinely overlap (both started, neither finished) before either is allowed to complete. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("FedosIpcCommandRegistry — double-submit / concurrent same-command guard", () => {
  it("a second concurrent invocation of the SAME channel is rejected 'busy' WITHOUT running the handler body, while the first is still in flight", async () => {
    const d = deferred<{ readonly outcome: "ok"; readonly value: number }>();
    const runCount = vi.fn(async (_payload: unknown) => d.promise);
    const registry = new FedosIpcCommandRegistry();
    const wrapped = registry.register("fedos-app:message-send", runCount);

    const first = wrapped({ body: "hello" });
    await flushMicrotasks(); // let `first` actually enter and start awaiting `d.promise`
    expect(registry.channelInFlightCount("fedos-app:message-send")).toBe(1);

    // Genuinely concurrent: `first` has NOT resolved yet.
    const second = await wrapped({ body: "hello-again" });
    expect(second).toEqual({ outcome: "busy", reason: "another invocation of this command is already in progress" });
    expect(runCount).toHaveBeenCalledTimes(1); // the second call never ran the real handler at all

    d.resolve({ outcome: "ok", value: 1 });
    const firstResult = await first;
    expect(firstResult).toEqual({ outcome: "ok", value: 1 });
  });

  it("prevents the real double-submit shape (setBody(A) then setBody(B) racing send()) by refusing the second call outright before its body observes any shared state", async () => {
    // Models `handleAppMessageSend()`'s own `boundary.composeMessage.setBody(body); await ...send(...)`
    // shared-mutable-state race: a shared `body` field two concurrent
    // invocations would otherwise both mutate before either sends.
    let sharedBody = "";
    const sent: string[] = [];
    const d = deferred<void>();
    const registry = new FedosIpcCommandRegistry();
    const wrapped = registry.register("fedos-app:message-send", async (payload: { readonly body: string }) => {
      sharedBody = payload.body;
      await d.promise;
      sent.push(sharedBody);
      return { outcome: "ok" as const };
    });

    const first = wrapped({ body: "A" });
    await flushMicrotasks();
    const second = await wrapped({ body: "B" }); // rejected immediately, never touches `sharedBody`
    expect(second).toMatchObject({ outcome: "busy" });
    expect(sharedBody).toBe("A"); // never clobbered by the rejected second call

    d.resolve();
    await first;
    expect(sent).toEqual(["A"]); // exactly one send, with the body it was actually given
  });

  it("allowConcurrentSelf:true lets N concurrent invocations of the SAME channel all run and all return their own real result (safe read-only polling)", async () => {
    const registry = new FedosIpcCommandRegistry();
    let callCount = 0;
    const wrapped = registry.register(
      "fedos-app:relay-status",
      async (payload: { readonly id: number }) => {
        callCount += 1;
        await Promise.resolve();
        return { outcome: "ok" as const, echoedId: payload.id };
      },
      { allowConcurrentSelf: true },
    );

    const results = await Promise.all([wrapped({ id: 1 }), wrapped({ id: 2 }), wrapped({ id: 3 })]);
    expect(callCount).toBe(3);
    expect(results.map((r) => (r as { echoedId: number }).echoedId).sort()).toEqual([1, 2, 3]);
    expect(registry.inFlightCount).toBe(0); // all fully drained after Promise.all settles
  });

  it("channel in-flight count returns to zero and a THIRD invocation succeeds after the first two finish (guard is not permanently stuck)", async () => {
    const registry = new FedosIpcCommandRegistry();
    const wrapped = registry.register("fedos-app:device-revoke", async () => ({ outcome: "ok" as const }));
    await wrapped({});
    const busy1 = wrapped({});
    const result2 = await wrapped({}); // second call while first still resolving (both microtask-fast, but exercises the same-tick guard)
    await busy1;
    const result3 = await wrapped({});
    expect(result3).toEqual({ outcome: "ok" });
    expect(registry.channelInFlightCount("fedos-app:device-revoke")).toBe(0);
    void result2; // may be "ok" or "busy" depending on exact microtask interleaving above; not the property under test here
  });
});

describe("FedosIpcCommandRegistry — group mutual exclusion (generalized `inFlight` replacement for create/unlock/lock)", () => {
  it("a command in group X blocks a DIFFERENT channel in the SAME group from starting at all", async () => {
    const registry = new FedosIpcCommandRegistry();
    const d = deferred<{ readonly outcome: "ok" }>();
    const createRun = vi.fn(async () => d.promise);
    const lockRun = vi.fn(async () => ({ outcome: "ok" as const }));
    const createWrapped = registry.register("fedos-profile:create", createRun, { group: "profile-lifecycle" });
    const lockWrapped = registry.register("fedos-profile:lock", lockRun, { group: "profile-lifecycle" });

    const createCall = createWrapped(undefined);
    await flushMicrotasks();
    expect(registry.groupInFlightCount("profile-lifecycle")).toBe(1);

    const lockResult = await lockWrapped(undefined); // genuinely concurrent with the still-pending create
    expect(lockResult).toMatchObject({ outcome: "busy" });
    expect(lockRun).not.toHaveBeenCalled(); // lock's own body never ran while create held the group

    d.resolve({ outcome: "ok" });
    await createCall;
  });

  it("a channel with NO group is never blocked by a lifecycle-group command in flight (ordinary reads/writes are not globally serialized)", async () => {
    const registry = new FedosIpcCommandRegistry();
    const d = deferred<{ readonly outcome: "ok" }>();
    const createWrapped = registry.register("fedos-profile:create", async () => d.promise, { group: "profile-lifecycle" });
    const searchWrapped = registry.register("fedos-app:search", async () => ({ outcome: "ok" as const, value: "results" }));

    const createCall = createWrapped(undefined);
    await flushMicrotasks();
    const searchResult = await searchWrapped(undefined); // unrelated channel, must proceed immediately
    expect(searchResult).toEqual({ outcome: "ok", value: "results" });

    d.resolve({ outcome: "ok" });
    await createCall;
  });
});

describe("FedosIpcCommandRegistry — stale results across a Runtime/assembly generation boundary", () => {
  it("a command still in flight when the generation is bumped mid-await returns stale-generation, discarding its real (possibly sensitive) result", async () => {
    const registry = new FedosIpcCommandRegistry();
    const d = deferred<{ readonly outcome: "ok"; readonly decryptedContent: string }>();
    const wrapped = registry.register("fedos-app:message-reveal", async () => d.promise);

    const call = wrapped({ messageId: "m1" });
    await flushMicrotasks();
    // Simulates a concurrent lock() landing while message-reveal is still
    // awaiting real crypto/relay work — exactly the audit gap #2 scenario.
    registry.bumpGeneration();
    d.resolve({ outcome: "ok", decryptedContent: "sensitive plaintext" });

    const result = await call;
    expect(result).toEqual(fedosIpcStaleGenerationOutcome());
    expect(result).not.toMatchObject({ decryptedContent: expect.anything() });
  });

  it("survives TWO bumps during the same await (lock, then a fresh unlock of a different profile) — proves this is a real equality check against the counter, not a one-shot 'did anything change' boolean", async () => {
    const registry = new FedosIpcCommandRegistry();
    const d = deferred<{ readonly outcome: "ok" }>();
    const wrapped = registry.register("fedos-app:archive", async () => d.promise);

    const call = wrapped({});
    await flushMicrotasks();
    registry.bumpGeneration(); // lock
    registry.bumpGeneration(); // a subsequent unlock (new assembly, new generation)
    d.resolve({ outcome: "ok" });

    expect(await call).toEqual(fedosIpcStaleGenerationOutcome());
  });

  it("a command that starts AFTER a generation bump (the new, legitimate generation) gets its real result normally — staleness is relative to entry, not a permanent poison", async () => {
    const registry = new FedosIpcCommandRegistry();
    registry.bumpGeneration();
    const wrapped = registry.register("fedos-app:conversations-list", async () => ({ outcome: "ok" as const, value: [] }));
    expect(await wrapped(undefined)).toEqual({ outcome: "ok", value: [] });
  });

  it("cross-channel: a slow command from the OLD generation is discarded even though a DIFFERENT fast command from the NEW generation already returned its real result first", async () => {
    const registry = new FedosIpcCommandRegistry();
    const slowD = deferred<{ readonly outcome: "ok"; readonly stale: true }>();
    const slowWrapped = registry.register("fedos-app:archive", async () => slowD.promise);
    const fastWrapped = registry.register("fedos-app:relay-status", async () => ({ outcome: "ok" as const, fresh: true }));

    const slowCall = slowWrapped({});
    await flushMicrotasks();
    registry.bumpGeneration(); // e.g. lock() landed
    const fastResult = await fastWrapped({}); // a NEW command, entered under the NEW generation
    expect(fastResult).toEqual({ outcome: "ok", fresh: true });

    slowD.resolve({ outcome: "ok", stale: true });
    expect(await slowCall).toEqual(fedosIpcStaleGenerationOutcome());
  });
});

describe("FedosIpcCommandRegistry — drain() (bounded wait before a Lock proceeds to tear the assembly down)", () => {
  it("resolves immediately when nothing is in flight", async () => {
    const registry = new FedosIpcCommandRegistry();
    const started = Date.now();
    const result = await registry.drain(5000, 5);
    expect(result).toEqual({ drained: true, remaining: 0 });
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("waits for a genuinely in-flight command to finish, then reports drained", async () => {
    const registry = new FedosIpcCommandRegistry();
    const d = deferred<{ readonly outcome: "ok" }>();
    const wrapped = registry.register("fedos-app:archive", async () => d.promise);
    const call = wrapped({});
    await flushMicrotasks();

    const drainPromise = registry.drain(5000, 5);
    setTimeout(() => d.resolve({ outcome: "ok" }), 30);
    const result = await drainPromise;
    expect(result).toEqual({ drained: true, remaining: 0 });
    await call;
  });

  it("is BOUNDED — gives up and reports undrained once the timeout elapses, never hangs indefinitely behind a straggler", async () => {
    const registry = new FedosIpcCommandRegistry();
    const neverResolves = new Promise<{ readonly outcome: "ok" }>(() => {});
    const wrapped = registry.register("fedos-app:archive", async () => neverResolves);
    void wrapped({});
    await flushMicrotasks();

    const started = Date.now();
    const result = await registry.drain(60, 5);
    expect(result.drained).toBe(false);
    expect(result.remaining).toBe(1);
    expect(Date.now() - started).toBeLessThan(500); // bounded, not hung
  });
});

describe("FedosIpcCommandRegistry — close() (shutdown/restart boundary)", () => {
  it("a NEW invocation attempted after close() is rejected immediately and the handler body never runs (stops a post-quit handleCreate()/handleUnlock() from installing a new assembly)", async () => {
    const registry = new FedosIpcCommandRegistry();
    const run = vi.fn(async () => ({ outcome: "ok" as const }));
    const wrapped = registry.register("fedos-profile:create", run, { group: "profile-lifecycle" });

    registry.close();
    const result = await wrapped(undefined);
    expect(result).toEqual(fedosIpcClosedOutcome());
    expect(run).not.toHaveBeenCalled();
  });

  it("a command already in flight when close() is called is left to finish (close() does not abort it), but its eventual result is superseded once the generation is also bumped, matching performCleanShutdown()'s own two-step close()+bumpGeneration() sequence", async () => {
    const registry = new FedosIpcCommandRegistry();
    const d = deferred<{ readonly outcome: "ok"; readonly value: string }>();
    const wrapped = registry.register("fedos-app:archive", async () => d.promise);

    const call = wrapped({});
    await flushMicrotasks();
    registry.close();
    expect(registry.inFlightCount).toBe(1); // close() alone does not forcibly cancel in-flight work

    registry.bumpGeneration(); // performCleanShutdown()'s own teardown step
    d.resolve({ outcome: "ok", value: "late" });
    expect(await call).toEqual(fedosIpcStaleGenerationOutcome());
  });

  it("close() is idempotent and safe to call more than once", () => {
    const registry = new FedosIpcCommandRegistry();
    expect(() => {
      registry.close();
      registry.close();
    }).not.toThrow();
    expect(registry.closed).toBe(true);
  });
});

describe("FedosIpcCommandRegistry — registration hygiene / registerHandle() wiring", () => {
  it("throws at registration time (not per-invocation) on a duplicate channel name — surfaces a Coordinator mistake at startup", () => {
    const registry = new FedosIpcCommandRegistry();
    registry.register("fedos-app:devices-list", async () => ({ outcome: "ok" as const }));
    expect(() => registry.register("fedos-app:devices-list", async () => ({ outcome: "ok" as const }))).toThrow(/already registered/);
  });

  it("registerHandle() wires the wrapped function to a real ipcMain-shaped object's .handle(), and the guard still applies through that path", async () => {
    const registry = new FedosIpcCommandRegistry();
    const handlers = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>();
    const fakeIpcMain: FedosIpcMainLike = {
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
    };
    const d = deferred<{ readonly outcome: "ok" }>();
    registry.registerHandle(fakeIpcMain, "fedos-app:message-send", async () => d.promise);

    const listener = handlers.get("fedos-app:message-send");
    expect(listener).toBeDefined();
    const first = listener!({}, { body: "hi" });
    await flushMicrotasks();
    const second = await listener!({}, { body: "hi-again" });
    expect(second).toMatchObject({ outcome: "busy" });
    d.resolve({ outcome: "ok" });
    expect(await first).toEqual({ outcome: "ok" });
  });
});

describe("FedosIpcCommandRegistry — bumpsOwnGeneration (Wave B fix: real reproduced Create failure, not a theoretical review)", () => {
  it("WITHOUT bumpsOwnGeneration, a handler that bumps its own generation on success has that same success incorrectly discarded as stale-generation -- reproduces the exact bug a live acceptance-test run hit (Create returning stale-generation instead of ok)", async () => {
    const registry = new FedosIpcCommandRegistry();
    const run = registry.register("fedos-profile:create", async () => {
      registry.bumpGeneration();
      return { outcome: "ok" as const };
    });
    expect(await run(undefined)).toEqual(fedosIpcStaleGenerationOutcome());
  });

  it("WITH bumpsOwnGeneration: true, that same handler's own success is preserved", async () => {
    const registry = new FedosIpcCommandRegistry();
    const run = registry.register(
      "fedos-profile:create",
      async () => {
        registry.bumpGeneration();
        return { outcome: "ok" as const };
      },
      { bumpsOwnGeneration: true },
    );
    expect(await run(undefined)).toEqual({ outcome: "ok" });
  });

  it("bumpsOwnGeneration does NOT weaken protection for every OTHER channel -- a fedos-app:* command still correctly discards its result when a DIFFERENT lifecycle command bumps the generation out from under it mid-flight", async () => {
    const registry = new FedosIpcCommandRegistry();
    const create = registry.register(
      "fedos-profile:create",
      async () => {
        registry.bumpGeneration();
        return { outcome: "ok" as const };
      },
      { group: "profile-lifecycle", bumpsOwnGeneration: true },
    );
    const d = deferred<{ readonly outcome: "ok"; readonly value: string }>();
    const appRead = registry.register("fedos-app:conversations-list", async () => d.promise, { allowConcurrentSelf: true });

    const appReadPromise = appRead(undefined);
    await flushMicrotasks();
    await create(undefined); // bumps the generation while appRead is still in flight
    d.resolve({ outcome: "ok", value: "stale content" });
    expect(await appReadPromise).toEqual(fedosIpcStaleGenerationOutcome());
  });
});
