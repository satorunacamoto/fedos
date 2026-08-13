/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent I) — IPC race-guard foundation.
 *
 * AUDIT FINDING this module closes (read directly against the current
 * `fedos_electron_beta_main.cts`, not any historical branch's own
 * description of it): the single module-level `let inFlight = false;`
 * declared just above `handleCreate()` only ever guards THREE channels
 * against each other — `fedos-profile:create` / `fedos-profile:unlock` /
 * `fedos-profile:lock`. None of the ~90 other `ipcMain.handle(...)`
 * registrations (`fedos-beta:*`, `fedos-acceptance:*`, `fedos-app:*`) read
 * or set it at all. Concretely, that means:
 *
 *   1. DOUBLE-SUBMIT is wide open on every one of those ~90 channels. E.g.
 *      `handleAppMessageSend()` calls `boundary.composeMessage.setBody(body)`
 *      then `await boundary.composeMessage.send(...)` — two concurrent
 *      invocations race on that SAME shared `composeMessage` ViewModel
 *      (`setBody(A)`, `setBody(B)`, `send()`, `send()` can interleave in any
 *      order), which can send the wrong body or send twice.
 *
 *   2. STALE RESULTS ACROSS A GENERATION BOUNDARY. Every `fedos-app:*` /
 *      `fedos-acceptance:*` handler captures `shell`/`boundary` synchronously
 *      at entry via `requireShell()`/`requireBoundary()` (a snapshot of the
 *      module-level `activeAssembly` at that instant), then `await`s real
 *      work (crypto, relay I/O, archive I/O) against that captured
 *      reference. `handleLock()` is checked against `inFlight` only for
 *      OTHER create/unlock/lock calls — it is never blocked by, and never
 *      waits for, any in-flight `fedos-app:*`/`fedos-acceptance:*` call. If
 *      a lock (or a fresh unlock of a DIFFERENT profile) lands mid-await, it
 *      nulls `activeAssembly`/`activeCoordinator` and calls
 *      `assembly.shutdown()`/`coordinator.lock()` (which clears the Master
 *      Seed) WHILE the older call is still running against its now-stale
 *      captured reference — and once that older call's `await` finally
 *      resolves, its result (potentially decrypted content read under the
 *      OLD profile) is still returned to the Renderer with no check that
 *      the generation it was produced under still exists. This is the exact
 *      class of bug the `hardening/rc1-security-phase2` branch's own commit
 *      `1c737862` (`git show 1c737862 -- '*fedos_electron_beta_main.cts'`,
 *      consulted read-only for this design, never merged/checked out) found
 *      and named `assemblyGeneration`/`appCommandsInFlight` for — re-derived
 *      here from scratch against the CURRENT file, which has since grown
 *      far beyond that commit's own ~50-channel count (now ~90) and never
 *      actually carries that fix (this repository's history is not a single
 *      linear branch; that commit lives on a sibling line this arc never
 *      merged).
 *
 *   3. SHUTDOWN DOES NOT QUIESCE IN-FLIGHT WORK. `performCleanShutdown()`
 *      nulls the active references and tears the assembly down without
 *      waiting for any `fedos-app:*`/`fedos-acceptance:*` call that is
 *      mid-flight, and — worse — without checking `inFlight` either. A
 *      `handleCreate()`/`handleUnlock()` call that is still awaiting
 *      `buildFreshCoordinator()`/`createProfile()`/`unlockProfile()` when
 *      shutdown begins sees `activeCoordinator === null` (unchanged, since
 *      shutdown found it `null` too and did nothing) and, once its own
 *      await resolves, proceeds to install a brand-new live, unlocked
 *      `activeCoordinator`/`activeAssembly` — AFTER `app.quit()` was already
 *      invoked and after `performCleanShutdown()`'s own `if (shutdownInitiated)
 *      return;` guard means it will never run a second time to tear that
 *      new assembly back down.
 *
 *   4. NO PER-CHANNEL PROTECTION AT ALL for anything outside the three
 *      lifecycle channels — not even the coarse kind `inFlight` gives
 *      create/unlock/lock.
 *
 * DESIGN — a single general registration seam, `FedosIpcCommandRegistry`,
 * meant to replace `inFlight` EVERYWHERE (not just at the three lifecycle
 * channels the historical branch left it guarding) so there is exactly ONE
 * concurrency-guard mechanism in this file, not two parallel ones:
 *
 *   - Every registration goes through `register()`/`registerHandle()`. Each
 *     gets its OWN per-channel in-flight guard (`allowConcurrentSelf` opts
 *     a channel OUT of that guard for handlers that are genuinely safe to
 *     run concurrently with themselves — pure reads a page polls on a
 *     timer, e.g. `fedos-app:relay-status`).
 *   - Channels that must be mutually exclusive with EACH OTHER (the
 *     create/unlock/lock trio) opt into a shared `group` — this is the
 *     direct, generalized replacement for the single global `inFlight`
 *     boolean, now scoped to only the channels that actually need it
 *     instead of implicitly covering (and blocking) everything.
 *   - A single monotonic `generation` counter, bumped by the Coordinator at
 *     every point that replaces or destroys the one live assembly (a
 *     successful create/unlock, the start of `lock()`'s teardown, the start
 *     of shutdown's teardown). Every registered command captures the
 *     generation at entry and, after its `await`, discards its own result in
 *     favor of a `stale-generation` outcome if the generation moved — this
 *     is what stops decrypted content from a since-locked profile ever
 *     reaching the Renderer.
 *   - `drain(timeoutMs)` — a bounded wait for in-flight commands to finish,
 *     for `handleLock()` to call BEFORE tearing the assembly down. Bounded,
 *     never a refusal: `1c737862`'s own report already found (and this
 *     design agrees) that a Lock action which a background poll can block
 *     is a worse property than the race it replaces — the page polls chat
 *     and Relay status on timers, so an unbounded wait can hang Lock
 *     indefinitely. Past the deadline, the caller proceeds regardless; the
 *     generation bump is the second, independent guard for any straggler.
 *   - `close()` — for `performCleanShutdown()`: synchronously refuses every
 *     NEW invocation from this instant on (closes gap #3 above — a
 *     `handleCreate()`/`handleUnlock()` invoked after shutdown begins is
 *     rejected before its body ever runs, so it can never install a new
 *     assembly post-quit), then the Coordinator still calls `drain()` +
 *     `bumpGeneration()` for whatever was already in flight when `close()`
 *     was called.
 *
 * ELECTRON-FREE BY DESIGN: this file has no `import "electron"` of any
 * kind (mirrors `fedos_electron_host_adapter_dispatch_translation.ts`'s own
 * documented reason) — the registry's core is plain, directly unit-testable
 * under vitest with a hand-written `IpcMainLike` double or no Electron
 * object at all. `registerHandle()` is a THIN, OPTIONAL convenience for a
 * real `ipcMain`-shaped object; nothing else in this file depends on it.
 *
 * INTEGRATION (Wave B, the Coordinator's job — see this module's own
 * closing doc block below for the full per-channel table; NOT done in this
 * file/this wave, deliberately, to avoid a Wave-A edit conflict with Agent
 * M/Agent S's own concurrent edits to the SAME `fedos_electron_beta_main.cts`):
 * replace `let inFlight = false;` and its four call sites with one
 * `const ipcCommands = new FedosIpcCommandRegistry();` instance, replace
 * every `ipcMain.handle("channel", async (_e, payload) => handler(payload))`
 * with `ipcCommands.registerHandle(ipcMain, "channel", (payload) =>
 * handler(payload), { group, allowConcurrentSelf })`, call
 * `ipcCommands.bumpGeneration()` at the exact points marked below, and call
 * `ipcCommands.close(); await ipcCommands.drain(SHUTDOWN_DRAIN_TIMEOUT_MS);`
 * as the FIRST lines of `performCleanShutdown()` (before its existing body
 * touches `activeCoordinator`/`activeAssembly`).
 */

/** A command's own result, or one of the three closed rejection shapes this registry can produce instead of running/returning it. Every rejection reuses the exact `{outcome:"busy"|"unavailable", reason:string}` vocabulary this file's handlers already return elsewhere (`acceptanceGateRejection()`, the existing `inFlight` "busy" literal) — no new failure shape for the Renderer's own `describeOutcome()`/`OUTCOME_TEXT` table to learn. */
export type FedosIpcCommandResult<T> = T | FedosIpcBusyOutcome | FedosIpcStaleGenerationOutcome | FedosIpcClosedOutcome;

export interface FedosIpcBusyOutcome {
  readonly outcome: "busy";
  readonly reason: string;
}

export interface FedosIpcStaleGenerationOutcome {
  readonly outcome: "unavailable";
  readonly reason: "stale-generation";
}

export interface FedosIpcClosedOutcome {
  readonly outcome: "unavailable";
  readonly reason: "shutting-down";
}

export function fedosIpcStaleGenerationOutcome(): FedosIpcStaleGenerationOutcome {
  return { outcome: "unavailable", reason: "stale-generation" };
}

export function fedosIpcClosedOutcome(): FedosIpcClosedOutcome {
  return { outcome: "unavailable", reason: "shutting-down" };
}

function fedosIpcBusyOutcome(reason: string): FedosIpcBusyOutcome {
  return { outcome: "busy", reason };
}

export interface FedosIpcCommandRegistrationOptions {
  /**
   * Channels sharing the same non-empty `group` are mutually exclusive: a
   * command in flight in a group blocks every OTHER command (any channel)
   * in that same group from starting, exactly like the historical single
   * `inFlight` boolean did for create/unlock/lock — but scoped only to the
   * channels that opt in, never implicitly covering unrelated reads.
   * Omit for a channel with no cross-channel exclusivity requirement.
   */
  readonly group?: string;
  /**
   * When `true`, a second concurrent invocation of THIS SAME channel is
   * allowed to run in parallel with the first, rather than being rejected
   * as busy. Reserve this for handlers proven safe to run concurrently with
   * themselves — ordinary read-only queries a page polls on a timer
   * (status/list/get calls that touch no shared mutable ViewModel field).
   * Default `false`: a channel guards itself against its own concurrent
   * re-invocation, which is what stops the `composeMessage.setBody()`/
   * `.send()` double-submit race described in this module's header.
   */
  readonly allowConcurrentSelf?: boolean;
}

/** Structural-only — mirrors this package's own established "never import a root `electron` type into an isolated, unit-testable module" discipline (see `fedos_electron_host_adapter_dispatch_translation.ts`'s header). Satisfied by the real `ipcMain` without any cast. */
export interface FedosIpcMainLike {
  handle(channel: string, listener: (event: unknown, payload: unknown) => Promise<unknown>): void;
}

interface FedosIpcCommandRegistrySnapshot {
  readonly generation: number;
  readonly closed: boolean;
  readonly totalInFlight: number;
  readonly channelsInFlight: readonly string[];
  readonly groupsInFlight: readonly string[];
}

/**
 * The one command-registration seam this file's `registerIpcHandlers()`
 * should route every channel through (see this module's header for the
 * full rationale and the exact integration steps).
 *
 * Every method here is synchronous bookkeeping except `drain()`, and none
 * of it ever throws — a registry that could itself fail closed-unsafely
 * would defeat the point.
 */
export class FedosIpcCommandRegistry {
  #generation = 0;
  #closed = false;
  #totalInFlight = 0;
  readonly #registeredChannels = new Set<string>();
  readonly #channelInFlight = new Map<string, number>();
  readonly #groupInFlight = new Map<string, number>();

  /** The current generation. Commands capture this at entry; a command whose captured value no longer matches this getter after its `await` had its result discarded in favor of `stale-generation`. */
  get generation(): number {
    return this.#generation;
  }

  get closed(): boolean {
    return this.#closed;
  }

  /** Total commands currently between entry and completion, across every channel. */
  get inFlightCount(): number {
    return this.#totalInFlight;
  }

  channelInFlightCount(channel: string): number {
    return this.#channelInFlight.get(channel) ?? 0;
  }

  groupInFlightCount(group: string): number {
    return this.#groupInFlight.get(group) ?? 0;
  }

  /** A frozen, JSON-safe point-in-time snapshot — handy for a diagnostics/status surface, never required for the guard itself to function. */
  snapshot(): FedosIpcCommandRegistrySnapshot {
    return Object.freeze({
      generation: this.#generation,
      closed: this.#closed,
      totalInFlight: this.#totalInFlight,
      channelsInFlight: Object.freeze([...this.#channelInFlight.entries()].filter(([, n]) => n > 0).map(([c]) => c)),
      groupsInFlight: Object.freeze([...this.#groupInFlight.entries()].filter(([, n]) => n > 0).map(([g]) => g)),
    });
  }

  /**
   * Increments and returns the new generation. The Coordinator calls this
   * at every point that replaces or destroys the one live assembly: a
   * successful `handleCreate()`/`handleUnlock()` (a NEW assembly exists),
   * the start of `handleLock()`'s teardown, and the start of
   * `performCleanShutdown()`'s teardown (both DESTROY the assembly).
   */
  bumpGeneration(): number {
    this.#generation += 1;
    return this.#generation;
  }

  /**
   * Registers one command. Returns a plain `(payload) => Promise<result>`
   * function — call it directly from a test, or hand it to
   * `registerHandle()` below to wire it to a real `ipcMain`. Throws
   * (construction-time, not per-invocation) if `channel` was already
   * registered on this instance — the same "never silently double-register
   * a channel" discipline `ipcMain.handle()` itself already enforces
   * natively (it throws on a second `.handle()` for the same channel), made
   * explicit here one layer up so a Coordinator mistake surfaces at startup
   * rather than as an inexplicable runtime double-guard.
   */
  register<TPayload, TResult>(
    channel: string,
    run: (payload: TPayload) => Promise<TResult>,
    options: FedosIpcCommandRegistrationOptions = {},
  ): (payload: TPayload) => Promise<FedosIpcCommandResult<TResult>> {
    if (this.#registeredChannels.has(channel)) {
      throw new Error(`FedosIpcCommandRegistry: channel "${channel}" is already registered`);
    }
    this.#registeredChannels.add(channel);
    const group = options.group;
    const allowConcurrentSelf = options.allowConcurrentSelf ?? false;

    return async (payload: TPayload): Promise<FedosIpcCommandResult<TResult>> => {
      if (this.#closed) return fedosIpcClosedOutcome();
      if (group !== undefined && this.groupInFlightCount(group) > 0) {
        return fedosIpcBusyOutcome(`another command in group "${group}" is in progress`);
      }
      if (!allowConcurrentSelf && this.channelInFlightCount(channel) > 0) {
        return fedosIpcBusyOutcome("another invocation of this command is already in progress");
      }
      const enteredGeneration = this.#generation;
      this.#enter(channel, group);
      try {
        const result = await run(payload);
        if (this.#generation !== enteredGeneration) return fedosIpcStaleGenerationOutcome();
        return result;
      } finally {
        this.#exit(channel, group);
      }
    };
  }

  /** Convenience: registers via `register()` AND wires the wrapped function straight to a real (or fake) `ipcMain.handle()`. Purely additive sugar — `register()` alone is enough for a unit test that never touches `ipcMain`. */
  registerHandle<TPayload, TResult>(
    ipcMain: FedosIpcMainLike,
    channel: string,
    run: (payload: TPayload) => Promise<TResult>,
    options: FedosIpcCommandRegistrationOptions = {},
  ): void {
    const wrapped = this.register(channel, run, options);
    ipcMain.handle(channel, async (_event: unknown, payload: unknown) => wrapped(payload as TPayload));
  }

  /**
   * Synchronously refuses every NEW invocation from this instant on
   * (existing in-flight commands are unaffected until they finish or the
   * generation moves). Idempotent. The Coordinator calls this as the FIRST
   * line of `performCleanShutdown()`, before that function's existing body
   * touches `activeCoordinator`/`activeAssembly` — this is what stops a
   * `handleCreate()`/`handleUnlock()` invoked after shutdown begins from
   * ever installing a new assembly post-quit (audit gap #3 in this
   * module's header).
   */
  close(): void {
    this.#closed = true;
  }

  /**
   * Waits until no command is in flight, or until `timeoutMs` elapses,
   * whichever comes first. Never throws, never blocks indefinitely, and
   * never itself signals failure — the caller (`handleLock()`/
   * `performCleanShutdown()`) proceeds to tear the assembly down either
   * way; `bumpGeneration()` remains the backstop for anything still
   * running past the deadline. Polls rather than a condition variable
   * because every mutation to the in-flight counters happens on this same
   * single main-process event loop turn.
   */
  async drain(timeoutMs: number, pollIntervalMs = 10): Promise<{ readonly drained: boolean; readonly remaining: number }> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (this.#totalInFlight > 0 && Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return { drained: this.#totalInFlight === 0, remaining: this.#totalInFlight };
  }

  #enter(channel: string, group: string | undefined): void {
    this.#totalInFlight += 1;
    this.#channelInFlight.set(channel, this.channelInFlightCount(channel) + 1);
    if (group !== undefined) this.#groupInFlight.set(group, this.groupInFlightCount(group) + 1);
  }

  #exit(channel: string, group: string | undefined): void {
    this.#totalInFlight -= 1;
    this.#channelInFlight.set(channel, Math.max(0, this.channelInFlightCount(channel) - 1));
    if (group !== undefined) this.#groupInFlight.set(group, Math.max(0, this.groupInFlightCount(group) - 1));
  }
}

/**
 * -----------------------------------------------------------------------
 * COORDINATOR INTEGRATION TABLE (Wave B) — exactly how to replace `inFlight`
 * at every current `ipcMain.handle(...)` site in `fedos_electron_beta_main.cts`.
 * Deliberately not applied in this Wave-A file to avoid an edit conflict
 * with Agent M/Agent S's own concurrent changes to the same shared file.
 * -----------------------------------------------------------------------
 *
 * 1. `const ipcCommands = new FedosIpcCommandRegistry();` at module scope,
 *    replacing `let inFlight = false;`.
 *
 * 2. Lifecycle trio — `group: "profile-lifecycle"` (reproduces the OLD
 *    global-`inFlight` mutual exclusion exactly, scoped to just these
 *    three instead of implicitly reaching every other channel):
 *      fedos-profile:create  -> registerHandle(ipcMain, ch, handleCreate, { group: "profile-lifecycle" })
 *      fedos-profile:unlock  -> registerHandle(ipcMain, ch, handleUnlock, { group: "profile-lifecycle" })
 *      fedos-profile:lock    -> registerHandle(ipcMain, ch, handleLock,   { group: "profile-lifecycle" })
 *    Inside `handleCreate()`/`handleUnlock()`, call `ipcCommands.bumpGeneration()`
 *    at the SAME point `activeAssembly = assembly;` is assigned (a new
 *    assembly is a new generation). Inside `handleLock()`, call
 *    `await ipcCommands.drain(2000)` BEFORE the `if (activeCoordinator === null)`
 *    check (bounded drain of any in-flight `fedos-app:*`/`fedos-acceptance:*`
 *    command — mirrors `1c737862`'s own `LOCK_DRAIN_TIMEOUT_MS` reasoning:
 *    an unbounded wait can hang Lock behind a page's own background polling
 *    timers, which is a worse property than the race it replaces), then
 *    call `ipcCommands.bumpGeneration()` at the SAME point
 *    `activeAssembly = null;` is assigned. Leave the OLD manual
 *    `if (inFlight) return {outcome:"busy",...}; inFlight = true; try {...} finally { inFlight = false; }`
 *    bodies OUT — `registerHandle()`'s own `group` already gives the exact
 *    same guarantee.
 *
 * 3. `fedos-profile:quit` and `performCleanShutdown()` — do NOT route quit
 *    itself through `register()` (it does not need a per-channel guard, and
 *    wrapping it would let a stale generation swallow a quit request, which
 *    must never be silently dropped). Instead, as the literal FIRST two
 *    lines of `performCleanShutdown()`, before its existing
 *    `if (shutdownInitiated) return;`:
 *      ipcCommands.close();
 *      await ipcCommands.drain(2000);
 *    then keep the existing body, and call `ipcCommands.bumpGeneration()`
 *    at the SAME point `activeAssembly = null;` is assigned inside it.
 *
 * 4. Every remaining `fedos-beta:*`/`fedos-acceptance:*`/`fedos-app:*`
 *    channel -> `ipcCommands.registerHandle(ipcMain, "<channel>", (payload) => handler(payload), options)`,
 *    with NO `group` (they must never block each other or the lifecycle
 *    trio from STARTING — only the generation check protects their
 *    RESULT once lock/shutdown lands mid-flight) and `options` chosen as:
 *
 *    `{ allowConcurrentSelf: true }` — pure reads with no shared mutable
 *    ViewModel field, safe for a page to poll concurrently with itself:
 *      fedos-profile:status, fedos-beta:status, fedos-app:conversations-list,
 *      fedos-app:devices-list, fedos-app:device-detail, fedos-app:device-sync-status,
 *      fedos-app:identity-transition-list, fedos-app:identity-transition-open,
 *      fedos-app:deletion-request-list-received, fedos-app:deletion-request-open,
 *      fedos-app:safety-center-overview, fedos-app:settings-load, fedos-app:relay-status,
 *      fedos-app:archive-workflow-warnings, fedos-app:commerce-catalog-list,
 *      fedos-app:commerce-product-detail, fedos-app:commerce-merchant-products-list,
 *      fedos-app:commerce-orders-list-mine, fedos-app:commerce-orders-list-incoming,
 *      fedos-app:commerce-delivery-status, fedos-app:commerce-receipt-lookup,
 *      fedos-app:commerce-merchant-product-media-list, fedos-app:commerce-activity-summary,
 *      fedos-app:commerce-network-profile-get, fedos-app:commerce-persona-board-query,
 *      fedos-acceptance:list-messages, fedos-acceptance:direct-ratchet-status,
 *      fedos-app:messages-list, fedos-app:membership-list, fedos-app:invitations-list.
 *
 *    default (no options — per-channel self-guard ON) — everything else:
 *    every mutating/one-shot action (message-send, order create/submit/
 *    cancel/accept/reject/fulfill/complete, payment-request/simulate,
 *    delivery-acknowledge-receipt, receipt-issue, product create/update/
 *    publish/unpublish, product-image-attach, product-content-attach,
 *    media-grant-redeem, share-product-issue, share-open,
 *    network-profile-set, create-invitation/create-conversation-invitation,
 *    activate-direct-conversation/conversation-activate, device-pairing-*,
 *    device-revoke, establish-direct-ratchet-session,
 *    identity-transition-accept/reject/defer/record-manual-verification,
 *    deletion-request-approve/reject, archive, archive-choose-*,
 *    settings-plan/settings-apply, tray-action, badge-mark-viewed,
 *    fedos-acceptance:read-message, fedos-acceptance:establish-direct-ratchet-session,
 *    fedos-acceptance:create-direct-conversation, fedos-acceptance:device-pairing-*,
 *    fedos-acceptance:create-conversation-invitation, fedos-acceptance:archive,
 *    fedos-app:search / fedos-acceptance:search (default guarded is the SAFE
 *    choice here even though a search-as-you-type UI may want
 *    `allowConcurrentSelf` — left to the Coordinator's own UX judgment,
 *    called out explicitly rather than silently picked).
 *
 * 5. Any handler that itself does `requireShell()`/`requireBoundary()` and
 *    fails closed to `acceptanceGateRejection()` when `null` is UNCHANGED —
 *    this registry is a second, independent layer, not a replacement for
 *    that existing runtime check.
 */
