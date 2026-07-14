/**
 * Secure Runtime Alpha 334 ("Desktop Host Dependency Assembly") /
 * Alpha 335 ("Board Hydration Ownership") / Alpha 336 ("Desktop Host
 * Access Boundary") / Alpha 337 ("Desktop Host Shutdown Contract") —
 * Stages 4, 5, 6, and 7 of the Alpha 331–340 Desktop Host Runtime
 * Foundation Arc. Alpha 382 ("Host Startup Failure Closure") / Alpha
 * 383 ("Host-Owned Query Construction") / Alpha 384 ("Host Query
 * Access Boundary") / Alpha 385 ("Board Service Access Review") —
 * Stages 2–5 of the Alpha 381–390 Canonical Board Query Host
 * Integration & Startup Failure Closure Arc.
 *
 * `FedosDesktopHost` is the first real host-runtime boundary capable
 * of owning exactly ONE `DesktopApplication` (`../desktop_application.js`,
 * Alpha 096–140), exactly ONE hydrated `FedosBoardService`
 * (`../../board/repository/fedos_board_service.js`, Alpha 307), and —
 * as of Alpha 383 — exactly ONE `FedosBoardQuery`
 * (`../../board/query/fedos_board_query.js`, Alpha 373–376) for a
 * long-lived local process — the "Option A: a class that owns
 * dependencies and lifecycle" candidate Alpha 332 adopted, over free
 * startup/shutdown functions (Option B), extending `DesktopApplication`
 * itself into the host (Option C), reusing `createRuntime()` (Option
 * D), or reusing Worker startup (Option E) — none of which is a real
 * PROCESS-level host boundary the way a dedicated class is.
 *
 * Constructor (Alpha 334): takes exactly one
 * `FedosDesktopHostDependencies` object — `desktopApplication` and
 * `boardPersistence`, injected explicitly — and performs ONLY field
 * assignment plus the initial `#state = "constructed"`. NO hydration,
 * NO `DesktopApplication.start()` call, NO `FedosBoardQuery`
 * construction, and NO I/O of any kind happens here; `start()` (below)
 * is the sole place any dependency is ever touched beyond being
 * stored.
 *
 * `start()` (Alpha 335, restructured by Alpha 382/383) fixes the
 * startup order the Objective names — `hydrate Board state →
 * construct Query over the hydrated FedosBoardService → start
 * DesktopApplication → Host ready` — as ONE `try` block wrapping every
 * step, with a single `catch` closing EVERY failure shape uniformly:
 *
 *   1. `state → "starting"`.
 *   2. Hydrate via the existing, UNMODIFIED `hydrateFedosBoardService`
 *      (`../../board/persistence/fedos_board_hydration.js`, Alpha
 *      318). A non-`"hydrated"` RETURNED outcome is converted to a
 *      thrown `Error` right here — the SAME message Alpha 335 always
 *      threw — so both a RETURNED failure and a THROWN one (Alpha 382
 *      §"the confirmed defect": `#boardPersistence.listPosts()` itself
 *      throwing, e.g. from a corrupt durable-backend log — any
 *      `FedosBoardPersistence` implementation, never a specific one
 *      named here) are handled by the exact SAME `catch` block below,
 *      uniformly.
 *   3. Construct `new FedosBoardQuery(hydration.service)` into a LOCAL
 *      variable — never assigned to `#boardQuery` yet.
 *   4. `await this.#desktopApplication.start()`.
 *   5. ONLY once every prior step succeeds: assign `#boardService`
 *      AND `#boardQuery`, then `state → "ready"`, as this method's own
 *      final three statements.
 *
 * The single `catch (error)` block (Alpha 382): sets `#boardService`
 * and `#boardQuery` BOTH to `null` (a no-op if step 2/3 never ran —
 * they were already `null` from construction/the previous `stop()`),
 * sets `state → "failed"`, and re-throws `error` COMPLETELY UNMODIFIED
 * — no wrapping, no message rewriting, preserving the ORIGINAL thrown
 * value's own identity whether it came from `hydrateFedosBoardService`
 * itself throwing, this method's own manually-thrown hydration-outcome
 * `Error`, or `DesktopApplication.start()`'s own rejection. This is
 * the ENTIRE fix for the confirmed Alpha 361/370 defect: EVERY startup
 * failure shape now reaches the SAME closing code, so `state()` can
 * NEVER remain `"starting"` once `start()`'s own `Promise` has
 * settled, by construction — there is no code path that transitions
 * INTO `"starting"` without a `try`/`catch` that transitions OUT of it
 * again before `start()` itself returns or rejects.
 *
 * `stop()`/`desktop()`/`board()`/`query()` (Alpha 336/337/384/385):
 * the minimum public Host API, narrowed by direct inspection of what
 * `DesktopApplication`/`FedosBoardService`/`FedosBoardQuery` themselves
 * already expose — NONE of the three exposes Persistence, mutable
 * indexes, an Identity Registry, Protocol Providers, a Secret Handle,
 * or a mutating method of any kind (confirmed by direct inspection,
 * `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md` §2
 * and `docs/secure_runtime_alpha_384_host_query_access_boundary.md`
 * §2), so returning the owned instances directly (Option A, both
 * Stages) is not "too broad" in practice — it is already as narrow as
 * the objects themselves. All three accessors return `null` UNLESS
 * `state() === "ready"` — fail closed both BEFORE `start()` resolves
 * and AFTER `stop()`/a failure completes, with no exception in
 * between. `board()` remains the canonical WRITE boundary
 * (`registerPost()`/`findPost()`); `query()` is the canonical READ
 * boundary (`recentFeed()`/`thread()`) — Alpha 385's own frozen
 * distinction; NEITHER is deprecated, removed, or merged into the
 * other. `stop()` is valid ONLY from `"ready"` — a second `stop()`
 * call, exactly like a second `start()` call (Alpha 098's own
 * `DesktopApplication` precedent), THROWS rather than silently
 * no-oping; per Alpha 337, NEITHER `DesktopApplication` nor
 * `FedosBoardService` nor `FedosBoardQuery` nor
 * `InMemoryFedosBoardPersistence` exposes a dispose/close method of
 * any kind today, so `stop()` performs ONLY lifecycle-state closure —
 * `state → "stopping" → "stopped"` and clearing BOTH the internal
 * `#boardService` AND `#boardQuery` references — never a fabricated
 * close call on an object that has none. No `process.exit()`, no
 * signal handling, and no global cleanup of any kind exists in this
 * file.
 *
 * HARD GUARDRAILS:
 *   - `FedosDesktopHostDependencies` and `FedosDesktopHost` are the
 *     ONLY exports.
 *   - The constructor performs NO async work, NO hydration, NO
 *     `FedosBoardQuery` construction, and NO
 *     `DesktopApplication.start()` call — construction and startup are
 *     two fully separate steps, matching `DesktopApplication`'s own
 *     Alpha 091/092 Entry Point/Bootstrap Sequence Decisions exactly.
 *   - `start()` may be called AT MOST ONCE per instance — a second
 *     call, from ANY state, throws synchronously before touching
 *     hydration, `FedosBoardQuery`, or `DesktopApplication` at all.
 *   - `#boardService`/`#boardQuery` are assigned a non-`null` value in
 *     EXACTLY ONE place in this file each — `start()`'s own final
 *     three statements, reached ONLY after hydration, Query
 *     construction, AND `DesktopApplication.start()` ALL succeed.
 *     `start()`'s own `catch` block and `stop()` (Alpha 337) are the
 *     only other assignment sites, and both only ever write `null`.
 *   - `start()`'s own `catch` block NEVER swallows the caught value —
 *     it always ends with `throw error;`, unmodified, after clearing
 *     `#boardService`/`#boardQuery` and setting `state → "failed"`.
 *     `start()` performs NO automatic retry and exposes NO reset API
 *     of any kind — a `"failed"` instance stays `"failed"` forever
 *     (Alpha 333's own forbidden-transition table, unmodified).
 *   - `desktop()`/`board()`/`query()` return the owned instance ONLY
 *     when `state() === "ready"`; otherwise, ALWAYS `null` — never a
 *     partially-constructed or partially-hydrated reference, never an
 *     exception.
 *   - `stop()` is valid ONLY from `"ready"`; every other starting
 *     state throws. `stop()` calls NO method on `#desktopApplication`,
 *     `#boardService`, `#boardQuery`, or `#boardPersistence` — none of
 *     the four exposes a close/dispose method this Arc, and none is
 *     fabricated here.
 *   - `FedosBoardQuery` is constructed ONLY from the ALREADY-hydrated
 *     `FedosBoardService` (`hydration.service`) — never from
 *     `#boardPersistence` directly, and the Query implementation
 *     itself (`../../board/query/fedos_board_query.ts`) is never
 *     altered by this Arc.
 *   - NO `process.exit()`, NO signal handler (`SIGINT`/`SIGTERM`/etc.)
 *     of any kind anywhere in this file.
 *   - NO reference to `src/worker.ts`, `src/runtime/create_runtime.ts`,
 *     any `AppRuntime` field, Relay Pool, `StorageBackend`, or `p2p/`.
 */

import type { DesktopApplication } from "../desktop_application.js";
import type { FedosBoardPersistence } from "../../board/persistence/fedos_board_persistence.js";
import type { FedosBoardService } from "../../board/repository/fedos_board_service.js";
import { hydrateFedosBoardService } from "../../board/persistence/fedos_board_hydration.js";
import { FedosBoardQuery } from "../../board/query/fedos_board_query.js";
import type { FedosDesktopHostState } from "./fedos_desktop_host_state.js";

export interface FedosDesktopHostDependencies {
  readonly desktopApplication: DesktopApplication;
  readonly boardPersistence: FedosBoardPersistence;
}

export class FedosDesktopHost {
  readonly #desktopApplication: DesktopApplication;
  readonly #boardPersistence: FedosBoardPersistence;
  #state: FedosDesktopHostState = "constructed";
  #boardService: FedosBoardService | null = null;
  #boardQuery: FedosBoardQuery | null = null;

  constructor(dependencies: FedosDesktopHostDependencies) {
    this.#desktopApplication = dependencies.desktopApplication;
    this.#boardPersistence = dependencies.boardPersistence;
  }

  state(): FedosDesktopHostState {
    return this.#state;
  }

  async start(): Promise<void> {
    if (this.#state !== "constructed") {
      throw new Error("FedosDesktopHost.start() may only be called once, from the constructed state.");
    }
    this.#state = "starting";

    try {
      const hydration = hydrateFedosBoardService(this.#boardPersistence);
      if (hydration.outcome !== "hydrated" || hydration.service === null) {
        throw new Error(`FedosDesktopHost failed to hydrate Board state: ${hydration.outcome}`);
      }
      const boardQuery = new FedosBoardQuery(hydration.service);

      await this.#desktopApplication.start();

      this.#boardService = hydration.service;
      this.#boardQuery = boardQuery;
      this.#state = "ready";
    } catch (error) {
      this.#boardService = null;
      this.#boardQuery = null;
      this.#state = "failed";
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.#state !== "ready") {
      throw new Error("FedosDesktopHost.stop() may only be called from the ready state.");
    }
    this.#state = "stopping";
    this.#boardService = null;
    this.#boardQuery = null;
    this.#state = "stopped";
  }

  desktop(): DesktopApplication | null {
    return this.#state === "ready" ? this.#desktopApplication : null;
  }

  board(): FedosBoardService | null {
    return this.#state === "ready" ? this.#boardService : null;
  }

  query(): FedosBoardQuery | null {
    return this.#state === "ready" ? this.#boardQuery : null;
  }
}
