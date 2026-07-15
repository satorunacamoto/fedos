/**
 * Secure Runtime Alpha 334 ("Desktop Host Dependency Assembly") /
 * Alpha 335 ("Board Hydration Ownership") / Alpha 336 ("Desktop Host
 * Access Boundary") / Alpha 337 ("Desktop Host Shutdown Contract") —
 * Stages 4, 5, 6, and 7 of the Alpha 331–340 Desktop Host Runtime
 * Foundation Arc. Alpha 382 ("Host Startup Failure Closure") / Alpha
 * 383 ("Host-Owned Query Construction") / Alpha 384 ("Host Query
 * Access Boundary") / Alpha 385 ("Board Service Access Review") —
 * Stages 2–5 of the Alpha 381–390 Canonical Board Query Host
 * Integration & Startup Failure Closure Arc. Alpha 395 ("Implement
 * Host Write API") — Stage 5 of the Alpha 391–400 Desktop Host Durable
 * Write Coordination Arc. Alpha 404 ("Host Board Access Rewiring") —
 * Stage 4 of the Alpha 401–410 Desktop Host Canonical Write Boundary
 * Closure Arc.
 *
 * `board()` (Alpha 404): REWIRED from `FedosBoardService | null` to
 * `FedosBoardReader | null` (`../../board/repository/fedos_board_reader.js`,
 * Alpha 403) — closing the LAST reachable Persistence-bypassing Board
 * mutation route: `board()?.registerPost(post)` (Alpha 385's own
 * frozen shape, Alpha 389 §12's own confirmed live example). Option C
 * (`docs/secure_runtime_alpha_402_canonical_host_write_authority_decision.md`),
 * adopted WITHOUT a transitional `readBoard()`/deprecated-`board()`
 * split (Option D) because Alpha 401 §3 confirmed, by direct search,
 * ZERO production caller anywhere in `src/` ever called `host.board()`
 * — only this repository's OWN test suite did, making a clean,
 * non-legacy replacement honest rather than a broken compatibility
 * claim. `board()` returns a `FedosBoardServiceReader` instance
 * (Alpha 403) — a REAL forwarding object, not `#boardService` merely
 * re-typed — so the returned object's own actual public surface has NO
 * `registerPost` property at all, closing the bypass even against an
 * unsafe cast, not merely against TypeScript's own static checking.
 * `#boardService` itself is UNCHANGED — still held privately, still
 * the object `submitPost()` (Alpha 395) calls
 * `previewRegistration()`/`registerPost()` on internally; only the
 * PUBLIC `board()` accessor's own return value is narrowed.
 *

 * `submitPost()` (Alpha 395): the Host becomes the single owner of
 * Canonical Board WRITE coordination — `Validate → Persistence →
 * Repository → Query visibility → Success` (Alpha 393's own adopted
 * order), closing the gap Alpha 389/390 named honestly and left open:
 * `board().registerPost()` mutates `#boardService`'s in-memory
 * Repository ONLY, never touching `#boardPersistence` at all.
 * `submitPost()` writes Persistence FIRST, Repository SECOND —
 * deliberately, NOT the reverse — because `FedosBoardPersistence`
 * (Alpha 315) has NO delete method: a failure AFTER a successful
 * Persistence write only delays Query visibility (recoverable on the
 * next `hydrateFedosBoardService()` replay); a failure AFTER a
 * successful Repository write would instead make Query show a post
 * that silently DISAPPEARS on restart — data that was never durable in
 * the first place. Step 1 (`FedosBoardService.previewRegistration()`,
 * Alpha 395) is a PURE READ that predicts step 3's own outcome before
 * step 2 ever runs — this is what prevents a domain-invalid post (a
 * genuine `"missing-parent"`/`"invalid-thread"`/`"cross-board-reply"`/
 * `"source-conflict"`/`"post-id-conflict"`) from EVER reaching durable
 * Persistence, which would otherwise PERMANENTLY poison every future
 * `hydrateFedosBoardService()` call for that log (an unresolvable post
 * makes `registerPostsInDependencyOrder()`'s own `unresolvedCount`
 * permanently `> 0`, and hydration has no delete/skip/repair path of
 * any kind — see `docs/secure_runtime_alpha_394_write_failure_policy.md`
 * §"the poisoning risk" for the full analysis). Because step 1 already
 * predicts step 3's own outcome and this repository's execution model
 * is single-threaded/synchronous with no `await` between steps 1 and
 * 3, "Repository succeeds, Persistence fails" and "Persistence
 * succeeds, Repository fails" are BOTH structurally unreachable by
 * this ordering — not merely handled, eliminated. Query visibility
 * (step 4) is NOT a separate step at all: `query()` reads the SAME
 * `#boardService` instance `registerPost()` (step 3) just mutated, so
 * visibility is automatic, immediate, with no rebuild/reload/restart
 * (Alpha 396).
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
 * between. `board()` (Alpha 404, REWIRED from its Alpha 385 shape) is
 * now the canonical READ-ONLY direct-lookup boundary
 * (`findPost()`/`listBoardPosts()`/`listThreadPosts()`, via
 * `FedosBoardReader`); `submitPost()` (Alpha 395) is the sole canonical
 * WRITE boundary; `query()` remains the canonical filtered/paginated
 * READ boundary (`recentFeed()`/`thread()`) — three DISTINCT
 * responsibilities, none merged into another. `stop()` is valid ONLY
 * from `"ready"` — a second `stop()` call, exactly like a second
 * `start()` call (Alpha 098's own `DesktopApplication` precedent),
 * THROWS rather than silently no-oping; per Alpha 337, NEITHER
 * `DesktopApplication` nor `FedosBoardService` nor `FedosBoardQuery`
 * nor `FedosBoardServiceReader` nor `InMemoryFedosBoardPersistence`
 * exposes a dispose/close method of any kind today, so `stop()`
 * performs ONLY lifecycle-state closure — `state → "stopping" →
 * "stopped"` and clearing the internal `#boardService`, `#boardQuery`,
 * AND `#boardReader` references — never a fabricated close call on an
 * object that has none. No `process.exit()`, no signal handling, and
 * no global cleanup of any kind exists in this file.
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
 *   - `#boardService`/`#boardQuery`/`#boardReader` are assigned a
 *     non-`null` value in EXACTLY ONE place in this file each —
 *     `start()`'s own final four statements, reached ONLY after
 *     hydration, Query construction, AND `DesktopApplication.start()`
 *     ALL succeed. `start()`'s own `catch` block and `stop()` (Alpha
 *     337) are the only other assignment sites, and both only ever
 *     write `null`. `#boardReader` (Alpha 404) is constructed from
 *     `hydration.service` directly — the SAME source `#boardService`
 *     itself is assigned from — never from `#boardService` after the
 *     fact, so no code path can construct a `#boardReader` wrapping a
 *     DIFFERENT `FedosBoardService` instance than `#boardService`
 *     itself observes.
 *   - `start()`'s own `catch` block NEVER swallows the caught value —
 *     it always ends with `throw error;`, unmodified, after clearing
 *     `#boardService`/`#boardQuery`/`#boardReader` and setting
 *     `state → "failed"`.
 *     `start()` performs NO automatic retry and exposes NO reset API
 *     of any kind — a `"failed"` instance stays `"failed"` forever
 *     (Alpha 333's own forbidden-transition table, unmodified).
 *   - `desktop()`/`board()`/`query()` return the owned instance ONLY
 *     when `state() === "ready"`; otherwise, ALWAYS `null` — never a
 *     partially-constructed or partially-hydrated reference, never an
 *     exception.
 *   - `board()`'s own return value (Alpha 404) is a
 *     `FedosBoardServiceReader` instance — its OWN actual public
 *     surface, inspected directly, has NO `registerPost` property, NO
 *     `previewRegistration` property, and NO reference to `#repository`/
 *     `#sourceIndex`/`#boardIndex`/`FedosBoardPersistence` of any kind —
 *     see `docs/secure_runtime_alpha_403_read_only_board_access_model.md`.
 *   - `stop()` is valid ONLY from `"ready"`; every other starting
 *     state throws. `stop()` calls NO method on `#desktopApplication`,
 *     `#boardService`, `#boardQuery`, `#boardReader`, or
 *     `#boardPersistence` — none of the five exposes a close/dispose
 *     method this Arc, and none is fabricated here.
 *   - `FedosBoardQuery` is constructed ONLY from the ALREADY-hydrated
 *     `FedosBoardService` (`hydration.service`) — never from
 *     `#boardPersistence` directly, and the Query implementation
 *     itself (`../../board/query/fedos_board_query.ts`) is never
 *     altered by this Arc.
 *   - NO `process.exit()`, NO signal handler (`SIGINT`/`SIGTERM`/etc.)
 *     of any kind anywhere in this file.
 *   - `submitPost()` (Alpha 395) throws ONLY for the `"ready"`-state
 *     guard, exactly matching `start()`/`stop()`'s own convention;
 *     every DOMAIN rejection (`"invalid-thread"`, `"missing-parent"`,
 *     `"cross-board-reply"`, `"source-conflict"`, `"post-id-conflict"`,
 *     `"persistence-failed"`) is a RETURNED token, matching
 *     `FedosBoardService.registerPost()`'s own "no exceptions for
 *     normal rejection" convention (Alpha 307).
 *   - `submitPost()` calls `#boardPersistence.putPost()` BEFORE
 *     `#boardService.registerPost()` — NEVER the reverse — and calls
 *     `#boardService.previewRegistration()` BEFORE EITHER — see this
 *     file's own header §"submitPost()" for why this exact order is
 *     load-bearing, not stylistic.
 *   - `submitPost()` performs NO retry, NO partial write, and NO
 *     silent repair of any kind — an invariant violation (step 1's
 *     prediction disagreeing with step 3's own outcome) throws rather
 *     than proceeding.
 *   - NO reference to `src/worker.ts`, `src/runtime/create_runtime.ts`,
 *     any `AppRuntime` field, Relay Pool, `StorageBackend`, or `p2p/`.
 */

import type { DesktopApplication } from "../desktop_application.js";
import type { FedosBoardPersistence } from "../../board/persistence/fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../../board/persistence/fedos_board_post_codec.js";
import type { FedosBoardPost } from "../../board/fedos_board_post.js";
import {
  type FedosBoardService,
  type FedosBoardRegistrationResult,
} from "../../board/repository/fedos_board_service.js";
import { FedosBoardServiceReader, type FedosBoardReader } from "../../board/repository/fedos_board_reader.js";
import { hydrateFedosBoardService } from "../../board/persistence/fedos_board_hydration.js";
import { FedosBoardQuery } from "../../board/query/fedos_board_query.js";
import type { FedosDesktopHostState } from "./fedos_desktop_host_state.js";
import { createFedosBoardOutboxIntent, type FedosBoardOutboxTarget } from "../../board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../../board/outbox/fedos_board_outbox_codec.js";
import {
  type FedosBoardOutboxPersistence,
  type FedosBoardOutboxPersistenceWriteResult,
} from "../../board/outbox/fedos_board_outbox_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../../board/outbox/in_memory_fedos_board_outbox_persistence.js";
import {
  MockFedosBoardOutboxPublisher,
  type FedosBoardOutboxPublisher,
} from "../../board/outbox/fedos_board_outbox_publisher.js";
import { FedosPublishScheduler } from "../../board/outbox/fedos_publish_scheduler.js";
import { FedosDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../../board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../../board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryRegistry } from "../../board/observation/fedos_delivery_retry_registry.js";
import { FedosHostDeliveryController } from "./fedos_host_delivery_controller.js";

/**
 * Secure Runtime Alpha 501–520 (Durable Delivery Observation Wiring &
 * Host Delivery Lifecycle Arc) — every addition below this point is
 * ADDITIVE ONLY. No line above this comment, and no EXISTING line
 * below it, is modified by this Arc; see
 * `docs/secure_runtime_alpha_507_host_constructor_and_factory_wiring.md`
 * for the full record.
 */

/** Alpha 507 — the delivery-loop cadence default when `deliveryIntervalMs` is omitted. */
const DEFAULT_DELIVERY_INTERVAL_MS = 30_000;

/** Alpha 510 — `Host.deliveryStatus()`'s own return shape. A pure lifecycle read, never an Observation payload. */
export interface FedosHostDeliveryStatus {
  readonly running: boolean;
}

export interface FedosDesktopHostDependencies {
  readonly desktopApplication: DesktopApplication;
  readonly boardPersistence: FedosBoardPersistence;
  /**
   * Alpha 419 — OPTIONAL, defaulted in the constructor (below) to a
   * fresh `InMemoryFedosBoardOutboxPersistence()` when omitted. Kept
   * optional, unlike `boardPersistence`, so every ONE of the 29
   * pre-existing `new FedosDesktopHost({desktopApplication, boardPersistence})`
   * call sites across `test/` continues to compile and behave
   * identically — see
   * `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
   * §"ripple" for why this Arc deliberately avoids widening the
   * required-field surface of an already-established interface.
   */
  readonly outboxPersistence?: FedosBoardOutboxPersistence;
  /**
   * Alpha 502 — OPTIONAL, defaulted to a fresh
   * `MockFedosBoardOutboxPublisher()` when omitted (Alpha 503's own
   * decision) — mirrors `outboxPersistence?`'s identical discipline.
   * The Host OWNS this Publisher only; it never calls `publish()` on
   * it directly — only a `FedosPublishScheduler` this Arc constructs
   * inside `startDelivery()` ever does.
   */
  readonly publisher?: FedosBoardOutboxPublisher;
  /**
   * Alpha 502 — OPTIONAL, defaulted to a fresh, in-memory-backed
   * `FedosDeliveryObservationRepository` when omitted (Alpha 503).
   */
  readonly observationRepository?: FedosDeliveryObservationRepository;
  /** Alpha 502 — OPTIONAL, defaulted to `DEFAULT_DELIVERY_INTERVAL_MS` (30s) when omitted. */
  readonly deliveryIntervalMs?: number;
}

/**
 * Alpha 419 — one entry per caller-supplied `FedosBoardOutboxTarget`,
 * reporting `FedosBoardOutboxPersistence.putIntent()`'s own exact
 * result token for that target. Empty whenever `submitPostWithOutbox()`
 * never reaches the Outbox-write step at all (see that method's own
 * header).
 */
export interface FedosDesktopHostOutboxIntentResult {
  readonly target: FedosBoardOutboxTarget;
  readonly result: FedosBoardOutboxPersistenceWriteResult;
}

export interface FedosDesktopHostSubmitWithOutboxResult {
  readonly post: FedosDesktopHostSubmitPostResult;
  readonly outbox: readonly FedosDesktopHostOutboxIntentResult[];
}

/**
 * Alpha 395 ("Implement Host Write API") -- Stage 5 of the Alpha
 * 391–400 Desktop Host Durable Write Coordination Arc. Mirrors
 * `FedosBoardRegistrationResult` (`../../board/repository/fedos_board_service.js`,
 * Alpha 307) plus exactly one new outcome -- `"persistence-failed"` --
 * the same additive-mirroring pattern `FedosBoardPersistenceWriteResult`
 * (Alpha 315) already established over `FedosBoardRepositoryWriteResult`
 * (Alpha 302).
 */
export type FedosDesktopHostSubmitPostResult = FedosBoardRegistrationResult | "persistence-failed";

export class FedosDesktopHost {
  readonly #desktopApplication: DesktopApplication;
  readonly #boardPersistence: FedosBoardPersistence;
  readonly #outboxPersistence: FedosBoardOutboxPersistence;
  #state: FedosDesktopHostState = "constructed";
  #boardService: FedosBoardService | null = null;
  #boardQuery: FedosBoardQuery | null = null;
  #boardReader: FedosBoardReader | null = null;
  // Alpha 507 additions below -- new fields only, no existing field touched.
  readonly #publisher: FedosBoardOutboxPublisher;
  readonly #observationRepository: FedosDeliveryObservationRepository;
  readonly #deliveryIntervalMs: number;
  #deliveryController: FedosHostDeliveryController | null = null;
  /**
   * Alpha 531 (Alpha 521-540 Durable Delivery Retry Coordination Arc,
   * ripple fix): constructed ONCE, alongside the other Host-owned
   * fields, and passed to EVERY `FedosHostDeliveryController` this
   * class ever constructs (`startDelivery()`, below) -- never a fresh
   * one per call. This is what makes attempt numbering survive a
   * `stopDelivery()`/`startDelivery()` cycle for the SAME still-pending
   * intent; a fresh registry per call (this field's own absence, before
   * this Stage) silently re-used already-terminal attempt-scoped
   * subject ids after a restart, which the unchanged validator
   * correctly, but silently, rejected again.
   */
  readonly #deliveryRetryRegistry = new FedosDeliveryRetryRegistry();

  constructor(dependencies: FedosDesktopHostDependencies) {
    this.#desktopApplication = dependencies.desktopApplication;
    this.#boardPersistence = dependencies.boardPersistence;
    this.#outboxPersistence = dependencies.outboxPersistence ?? new InMemoryFedosBoardOutboxPersistence();
    // Alpha 507 additions below -- new assignments only, the three lines above are unchanged.
    this.#publisher = dependencies.publisher ?? new MockFedosBoardOutboxPublisher();
    this.#observationRepository =
      dependencies.observationRepository ??
      new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    this.#deliveryIntervalMs = dependencies.deliveryIntervalMs ?? DEFAULT_DELIVERY_INTERVAL_MS;
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
      this.#boardReader = new FedosBoardServiceReader(hydration.service);
      this.#state = "ready";
    } catch (error) {
      this.#boardService = null;
      this.#boardQuery = null;
      this.#boardReader = null;
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
    this.#boardReader = null;
    this.#state = "stopped";
  }

  desktop(): DesktopApplication | null {
    return this.#state === "ready" ? this.#desktopApplication : null;
  }

  board(): FedosBoardReader | null {
    return this.#state === "ready" ? this.#boardReader : null;
  }

  query(): FedosBoardQuery | null {
    return this.#state === "ready" ? this.#boardQuery : null;
  }

  /**
   * Alpha 395: the canonical Host-owned write boundary --
   * `Validate → Persistence → Repository → Query visibility → Success`
   * (Alpha 393). See this file's own header §"submitPost()" for the
   * full ordering rationale and why every step is a RETURNED token,
   * never a thrown rejection, except the `"ready"`-state guard itself.
   */
  submitPost(post: FedosBoardPost): FedosDesktopHostSubmitPostResult {
    if (this.#state !== "ready" || this.#boardService === null) {
      throw new Error("FedosDesktopHost.submitPost() may only be called from the ready state.");
    }
    const boardService = this.#boardService;

    // 1. Validate -- pure read, before Persistence is ever touched.
    const preview = boardService.previewRegistration(post);
    if (preview !== null) return preview;

    // 2. Persistence -- the first mutating call.
    const record = serializeFedosBoardPost(post);
    const persistResult = this.#boardPersistence.putPost(record);
    if (persistResult === "failed") return "persistence-failed";
    if (persistResult === "conflict") return "post-id-conflict";

    // 3. Repository -- guaranteed to accept `post`, by construction:
    // step 1 already predicted this exact outcome, and no other write
    // to `boardService` can interleave between step 1 and here in this
    // repository's single-threaded, synchronous execution model.
    const registerResult = boardService.registerPost(post);
    if (registerResult !== "inserted" && registerResult !== "already-present") {
      // Fail closed: never silently repair a state that step 1's own
      // prediction says cannot happen. See design doc Alpha 394 §"the
      // structurally unreachable case".
      throw new Error(
        `FedosDesktopHost.submitPost() invariant violated: previewRegistration() predicted acceptance but registerPost() returned "${registerResult}".`,
      );
    }

    // 4. Query visibility -- automatic: query() reads the SAME
    // #boardService instance registerPost() just mutated. No separate
    // step, no rebuild, no reload.
    return registerResult;
  }

  /**
   * Alpha 419 -- the ADDITIVE explicit-outbound-targets entry point.
   * `submitPost()` (above) remains completely unchanged and
   * local-only: it never queues, never publishes, and calling it
   * directly is still a fully legitimate, first-class product action.
   * `submitPostWithOutbox()` never infers targets from `post.source`
   * or any other provenance field -- `targets` is the caller's own
   * EXPLICIT delivery intent (Alpha 414's own required decision).
   *
   * Honest ordering (never described as one atomic transaction -- see
   * this file's own header and
   * `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
   * §"two-file atomicity"): this method delegates the ENTIRE canonical
   * write to the EXISTING, unmodified `submitPost()` first. Only once
   * that call returns `"inserted"` or `"already-present"` -- meaning
   * the post is genuinely durable and visible -- does this method
   * attempt any Outbox write at all. A domain rejection or
   * `"persistence-failed"` from `submitPost()` short-circuits with an
   * EMPTY `outbox` array: no Outbox intent is ever created for a post
   * that was never durably accepted.
   *
   * `targets` is deduplicated by its own deterministic
   * `FedosBoardOutboxId` (Alpha 413) before any write, so passing the
   * same logical target twice produces exactly ONE result entry, not
   * two. An EMPTY `targets` array delegates entirely to `submitPost()`
   * (chosen over rejecting outright -- see the design doc's own
   * "empty targets" section) -- `submitPostWithOutbox(post, [])` and
   * `submitPost(post)` are then behaviorally identical except for the
   * wrapper shape of the returned value.
   *
   * Each Outbox intent's own `createdAt` reuses `post.createdAt`
   * (this class holds no injected Clock) -- see the design doc's own
   * "intent timestamp" section for why this keeps the whole call
   * deterministic rather than introducing a new `Date.now()` dependency.
   *
   * A durable Outbox write failing AFTER a successful canonical write
   * NEVER rolls back, retries, or otherwise touches the already-durable
   * post -- Persistence has no delete method (Alpha 315), and this Arc
   * introduces no compensating-transaction machinery of any kind.
   */
  submitPostWithOutbox(
    post: FedosBoardPost,
    targets: readonly FedosBoardOutboxTarget[],
  ): FedosDesktopHostSubmitWithOutboxResult {
    if (this.#state !== "ready") {
      throw new Error("FedosDesktopHost.submitPostWithOutbox() may only be called from the ready state.");
    }

    if (targets.length === 0) {
      return { post: this.submitPost(post), outbox: [] };
    }

    const postResult = this.submitPost(post);
    if (postResult !== "inserted" && postResult !== "already-present") {
      return { post: postResult, outbox: [] };
    }

    const seenIds = new Set<string>();
    const outbox: FedosDesktopHostOutboxIntentResult[] = [];
    for (const target of targets) {
      const intent = createFedosBoardOutboxIntent(post.id, target, post.createdAt);
      if (intent === null) {
        outbox.push({ target, result: "failed" });
        continue;
      }
      if (seenIds.has(intent.id)) continue; // Alpha 419: dedupe by deterministic id, first occurrence wins.
      seenIds.add(intent.id);

      const record = serializeFedosBoardOutboxIntent(intent);
      const result = this.#outboxPersistence.putIntent(record);
      outbox.push({ target, result });
    }

    return { post: postResult, outbox };
  }

  /**
   * Alpha 508 -- constructs (never reuses across a stop/start cycle) a
   * real `FedosPublishScheduler` over the Host-owned `#outboxPersistence`/
   * `#publisher`/`#deliveryIntervalMs`, and a `FedosHostDeliveryController`
   * (Alpha 505/506) over a `FedosValidatingDeliveryObservationRepository`
   * wrapping the Host-owned `#observationRepository`, then starts the
   * controller. Callable only once per running cycle, from the Host's
   * own `"ready"` state -- mirrors `start()`/`stop()`'s own "may only be
   * called once, from state X" convention exactly. `FedosDesktopHost`
   * itself never calls `.publish()`/`.publishOne()` anywhere in this
   * method -- only the newly-constructed `FedosPublishScheduler` does,
   * exactly as this Arc's own "HostがPublishしない、SchedulerだけがPublish
   * する" instruction requires.
   */
  startDelivery(): void {
    if (this.#state !== "ready") {
      throw new Error("FedosDesktopHost.startDelivery() may only be called from the ready state.");
    }
    if (this.#deliveryController !== null) {
      throw new Error("FedosDesktopHost.startDelivery() may only be called while delivery is not already running.");
    }
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: this.#outboxPersistence,
      publisher: this.#publisher,
      intervalMs: this.#deliveryIntervalMs,
    });
    const query = new FedosDeliveryObservationQuery(this.#observationRepository);
    const validatingRepository = new FedosValidatingDeliveryObservationRepository(this.#observationRepository, query);
    this.#deliveryController = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validatingRepository,
      intervalMs: this.#deliveryIntervalMs,
      retryRegistry: this.#deliveryRetryRegistry,
    });
    this.#deliveryController.start();
  }

  /**
   * Alpha 509 -- delegates entirely to `FedosHostDeliveryController.stop()`
   * (Alpha 506), which itself guarantees Scheduler停止 -> tick終了待ち
   * before its own `Promise` resolves; this method resolves only after
   * that guarantee holds, which is what makes "Host停止" (in the sense
   * of "delivery is genuinely, verifiably stopped") true for any caller
   * awaiting this call. Throws (does not silently no-op) when delivery
   * is not currently running.
   */
  async stopDelivery(): Promise<void> {
    if (this.#deliveryController === null) {
      throw new Error("FedosDesktopHost.stopDelivery() may only be called while delivery is running.");
    }
    const controller = this.#deliveryController;
    this.#deliveryController = null;
    await controller.stop();
  }

  /** Alpha 510 -- a pure, synchronous lifecycle read; never throws, never touches the Observation Repository. */
  deliveryStatus(): FedosHostDeliveryStatus {
    return { running: this.#deliveryController !== null && this.#deliveryController.isRunning() };
  }

  /**
   * Alpha 510 -- the canonical READ boundary over the Host-owned
   * `#observationRepository`, mirroring `query()`'s own identical
   * "owned instance, read-only, `null` unless `state() === \"ready\"`"
   * shape. A caller uses this to independently verify Observation
   * History / Current State consistency against whatever
   * `startDelivery()`'s own Scheduler run actually recorded -- this
   * method itself never writes.
   */
  observationQuery(): FedosDeliveryObservationQuery | null {
    return this.#state === "ready" ? new FedosDeliveryObservationQuery(this.#observationRepository) : null;
  }
}
