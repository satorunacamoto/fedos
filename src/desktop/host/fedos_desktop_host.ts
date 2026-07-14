/**
 * Secure Runtime Alpha 334 ("Desktop Host Dependency Assembly") /
 * Alpha 335 ("Board Hydration Ownership") / Alpha 336 ("Desktop Host
 * Access Boundary") / Alpha 337 ("Desktop Host Shutdown Contract") —
 * Stages 4, 5, 6, and 7 of the Alpha 331–340 Desktop Host Runtime
 * Foundation Arc.
 *
 * `FedosDesktopHost` is the first real host-runtime boundary capable
 * of owning exactly ONE `DesktopApplication` (`../desktop_application.js`,
 * Alpha 096–140) and exactly ONE hydrated `FedosBoardService`
 * (`../../board/repository/fedos_board_service.js`, Alpha 307) for a
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
 * NO `DesktopApplication.start()` call, and NO I/O of any kind happens
 * here; `start()` (below) is the sole place either dependency is ever
 * touched beyond being stored.
 *
 * `start()` (Alpha 335) fixes the startup order the Objective names —
 * `hydrate Board state → start DesktopApplication → Host ready` — as
 * exactly five steps: (1) guard against a second call; (2) `state →
 * "starting"`; (3) hydrate via the existing, UNMODIFIED
 * `hydrateFedosBoardService` (`../../board/persistence/fedos_board_hydration.js`,
 * Alpha 318) — on any non-`"hydrated"` outcome, `state → "failed"`
 * and this method REJECTS, `DesktopApplication.start()` is NEVER
 * called, and NO Board reference is ever stored (fail closed, no
 * empty-Board fallback of any kind); (4) `await
 * this.#desktopApplication.start()` — on rejection, `state →
 * "failed"` and the SAME rejection propagates, and the
 * already-hydrated `FedosBoardService` from step 3 is discarded,
 * never assigned to `#boardService`, so a Desktop startup failure can
 * NEVER leave a "ready" Board exposed through a "failed" Host; (5)
 * ONLY once both prior steps succeed, `#boardService` is assigned and
 * `state → "ready"`, atomically, as this method's own last two
 * statements.
 *
 * `stop()`/`desktop()`/`board()` (Alpha 336/337): the minimum public
 * Host API Alpha 336 named, narrowed by direct inspection of what
 * `DesktopApplication`/`FedosBoardService` themselves already expose —
 * NEITHER class exposes Persistence, mutable indexes, an Identity
 * Registry, Protocol Providers, or a Secret Handle of any kind
 * (confirmed by direct inspection, `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md`
 * §2), so returning the owned instances directly (Option A) is not
 * "too broad" in practice — it is already as narrow as the objects
 * themselves. `desktop()`/`board()` return `null` UNLESS `state() ===
 * "ready"` — fail closed both BEFORE `start()` resolves and AFTER
 * `stop()` completes, with no exception in between. `stop()` is valid
 * ONLY from `"ready"` — a second `stop()` call, exactly like a second
 * `start()` call (Alpha 098's own `DesktopApplication` precedent),
 * THROWS rather than silently no-oping; per Alpha 337, NEITHER
 * `DesktopApplication` nor `FedosBoardService` nor
 * `InMemoryFedosBoardPersistence` exposes a dispose/close method of
 * any kind today, so `stop()` performs ONLY lifecycle-state closure —
 * `state → "stopping" → "stopped"` and clearing the internal
 * `#boardService` reference — never a fabricated close call on an
 * object that has none. No `process.exit()`, no signal handling, and
 * no global cleanup of any kind exists in this file.
 *
 * HARD GUARDRAILS:
 *   - `FedosDesktopHostDependencies` and `FedosDesktopHost` are the
 *     ONLY exports.
 *   - The constructor performs NO async work, NO hydration, and NO
 *     `DesktopApplication.start()` call — construction and startup are
 *     two fully separate steps, matching `DesktopApplication`'s own
 *     Alpha 091/092 Entry Point/Bootstrap Sequence Decisions exactly.
 *   - `start()` may be called AT MOST ONCE per instance — a second
 *     call, from ANY state, throws synchronously before touching
 *     hydration or `DesktopApplication` at all.
 *   - `#boardService` is assigned a non-`null` value in EXACTLY ONE
 *     place in this file — `start()`'s own final two statements,
 *     reached ONLY after BOTH hydration AND `DesktopApplication.start()`
 *     succeed. `stop()` (Alpha 337) is the only other assignment site,
 *     and only ever writes `null`.
 *   - `desktop()`/`board()` return the owned instance ONLY when
 *     `state() === "ready"`; otherwise, ALWAYS `null` — never a
 *     partially-constructed or partially-hydrated reference, never an
 *     exception.
 *   - `stop()` is valid ONLY from `"ready"`; every other starting
 *     state throws. `stop()` calls NO method on `#desktopApplication`
 *     or `#boardService`/`#boardPersistence` — neither object exposes
 *     a close/dispose method this Arc, and none is fabricated here.
 *   - NO `process.exit()`, NO signal handler (`SIGINT`/`SIGTERM`/etc.)
 *     of any kind anywhere in this file.
 *   - NO reference to `src/worker.ts`, `src/runtime/create_runtime.ts`,
 *     any `AppRuntime` field, Relay Pool, `StorageBackend`, or `p2p/`.
 */

import type { DesktopApplication } from "../desktop_application.js";
import type { FedosBoardPersistence } from "../../board/persistence/fedos_board_persistence.js";
import type { FedosBoardService } from "../../board/repository/fedos_board_service.js";
import { hydrateFedosBoardService } from "../../board/persistence/fedos_board_hydration.js";
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

    const hydration = hydrateFedosBoardService(this.#boardPersistence);
    if (hydration.outcome !== "hydrated" || hydration.service === null) {
      this.#state = "failed";
      throw new Error(`FedosDesktopHost failed to hydrate Board state: ${hydration.outcome}`);
    }

    try {
      await this.#desktopApplication.start();
    } catch (err) {
      this.#state = "failed";
      throw err;
    }

    this.#boardService = hydration.service;
    this.#state = "ready";
  }

  async stop(): Promise<void> {
    if (this.#state !== "ready") {
      throw new Error("FedosDesktopHost.stop() may only be called from the ready state.");
    }
    this.#state = "stopping";
    this.#boardService = null;
    this.#state = "stopped";
  }

  desktop(): DesktopApplication | null {
    return this.#state === "ready" ? this.#desktopApplication : null;
  }

  board(): FedosBoardService | null {
    return this.#state === "ready" ? this.#boardService : null;
  }
}
