/**
 * Secure Runtime Alpha 606 ("Runtime Assembly") — Stage 6 of the Alpha
 * 601–620 Desktop Local Runtime Entry Point & Publish Pipeline
 * Ownership Arc.
 *
 * `startFedosDesktopRuntime()` is the FIRST real production caller of
 * `FedosDesktopHost`/`createFedosDesktopHost` this repository has
 * (Alpha 601's own inventory: none existed before this Arc). It
 * assembles durable Persistence backends from caller-supplied paths
 * (Alpha 607/608/609), constructs one `FedosDesktopHost`, calls
 * `start()`, optionally calls `startDelivery()` (Alpha 611), and
 * returns a narrow `FedosRunningDesktopRuntime` handle — never the
 * Host's own internal Persistence/Scheduler objects (this Stage's own
 * instruction: "低レベルPersistenceやSchedulerを外へ返さない").
 *
 * This function performs NO process-lifecycle work of any kind — no
 * `process.on`, no `process.exit`, no signal registration (Alpha 613
 * owns that, one layer up, in `run_fedos_desktop_runtime.ts`). It is
 * directly `import`able and callable from a test, exactly like every
 * other constructor/factory in this repository (Alpha 617's own "no
 * implicit startup" guard: importing THIS file performs no filesystem
 * access, no Host construction, no timer, of any kind — only CALLING
 * `startFedosDesktopRuntime()` does).
 *
 * HARD GUARDRAILS:
 *   - `startFedosDesktopRuntime` and `FedosRunningDesktopRuntime` are
 *     the ONLY exports.
 *   - No module-level mutable state — no singleton Host, no shared
 *     Persistence instance across calls (Alpha 618's own "no shared
 *     singleton" guard). Two calls produce two fully independent
 *     runtimes, even if pointed at the same paths (the SAME
 *     "construct a fresh instance over the same durable backend" shape
 *     `docs/secure_runtime_alpha_589_real_restart_verification.md`
 *     already established and verifies).
 *   - `deliveryEnabled: true` without `observationLogPath` or without
 *     `publisher` is a configuration error, thrown synchronously,
 *     BEFORE any Persistence backend or Host is constructed — never a
 *     silent fallback to an in-memory Observation backend or a Mock
 *     Publisher (Alpha 609/610/614).
 *   - No `process.env` read anywhere in this file.
 *   - No Worker (`../../worker.js`), Ontology, Humanizer, AI, `p2p/`,
 *     Relay Pool, or new Protocol Publisher import of any kind.
 *   - Board/Outbox/Observation Persistence, Scheduler, Retry Registry,
 *     and Retry semantics are all constructed from EXISTING,
 *     byte-for-byte UNCHANGED classes — this file assembles, it does
 *     not modify or extend any of them.
 *
 * Secure Runtime Alpha 671 ("Running Runtime Ownership Decision") /
 * Alpha 672 ("Application Runtime Construction") — Stages 1/2 of Phase
 * D of the Alpha 641–680 Public Identity, Conversation Policy &
 * Application Runtime Integration Arc. Compares:
 *   A. `FedosRunningDesktopRuntime` exposes `boardRuntime()` — ADOPTED.
 *   B. caller constructs `FedosBoardRuntime` from `runtime.host` —
 *      rejected; every caller would duplicate the SAME construction,
 *      and a caller could inject a DIFFERENT `FedosDesktopHost` by
 *      mistake, defeating the "one Application Runtime per running
 *      runtime" guarantee.
 *   C. `startFedosDesktopRuntime` returns both `host`/`boardRuntime` as
 *      SIBLING fields — rejected; `boardRuntime()` as a METHOD (Option
 *      A) is what lets this Arc enforce "inaccessible after stop"
 *      (Alpha 678) — a plain field could not fail closed after `stop()`
 *      without the field itself becoming stale/dangling.
 *
 * `startFedosDesktopRuntime()` now constructs EXACTLY ONE
 * `FedosBoardRuntime` per running runtime — via `createFedosBoardRuntime()`
 * (Alpha 623, unmodified) over the SAME `host` this function already
 * constructs — using whichever `publicAuthorAuthority`/
 * `conversationPolicyAuthority`/`idGenerator`/`clock` the caller
 * supplied in `config` (Alpha 673), or `FedosBoardRuntime`'s own
 * existing, already-documented defaults when omitted (Alpha 642/654 —
 * no default is duplicated or overridden here). No singleton — a
 * second `startFedosDesktopRuntime()` call constructs a fully
 * independent `FedosBoardRuntime`, exactly mirroring this function's
 * own pre-existing "no shared Host" guarantee (Alpha 618).
 *
 * Secure Runtime Alpha 758 ("Local Runtime Ownership") — Stage 18 of
 * the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc. `startFedosDesktopRuntime()` now OWNS the one
 * `FedosConversationPersistence` this running runtime uses —
 * `AppendOnlyFedosConversationPersistence(config.conversationLogPath)`
 * when supplied, or an explicit, freshly-constructed
 * `InMemoryFedosConversationPersistence()` otherwise (constructed HERE,
 * not left to `FedosBoardRuntime`'s own internal default, so this
 * function always holds a concrete reference to hydrate against, per
 * Alpha 756, and pass through explicitly). After `host.start()`
 * succeeds (Board state is hydrated, `host.board()` is real) and
 * BEFORE `createFedosBoardRuntime()` is called,
 * `hydrateFedosConversations()` verifies every persisted Conversation
 * record against that hydrated Board state; a non-`"hydrated"` outcome
 * throws, mirroring this function's own existing "convert a corrupt
 * Board log into a thrown Error" discipline for `host.start()` itself.
 * Conversation reads are exposed entirely through
 * `runtime.boardRuntime()`'s own new `findConversation()`/
 * `conversationForThread()`/`listBoardConversations()` methods (Alpha
 * 757) — no new accessor is added to `FedosRunningDesktopRuntime`
 * itself, matching Alpha 671's own "`FedosBoardRuntime` is the one
 * thing a caller holds a reference to" precedent. No filesystem
 * internal (the persistence object itself, a raw file handle, etc.) is
 * ever exposed to a caller.
 */

// @ts-expect-error `node:fs`/`node:path` have no type declarations without `@types/node` in this project's tsconfig.
import { mkdirSync } from "node:fs";
// @ts-expect-error see above.
import { dirname } from "node:path";
import type { FedosDesktopHost } from "../host/fedos_desktop_host.js";
import { createFedosDesktopHost } from "../host/create_fedos_desktop_host.js";
import { createDesktopApplication } from "../create_desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../../board/persistence/append_only_fedos_board_persistence.js";
import { AppendOnlyFedosBoardOutboxPersistence } from "../../board/outbox/append_only_fedos_board_outbox_persistence.js";
import { AppendOnlyFedosDeliveryObservationPersistence } from "../../board/observation/append_only_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_repository.js";
import type { FedosDesktopRuntimeConfig } from "./fedos_desktop_runtime_config.js";
import { createFedosBoardRuntime, type FedosBoardRuntime } from "../../board/runtime/fedos_board_runtime.js";
import type { FedosConversationPersistence } from "../../conversation/persistence/fedos_conversation_persistence.js";
import { AppendOnlyFedosConversationPersistence } from "../../conversation/persistence/append_only_fedos_conversation_persistence.js";
import { InMemoryFedosConversationPersistence } from "../../conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { hydrateFedosConversations } from "../../conversation/fedos_conversation_hydration.js";

export interface FedosRunningDesktopRuntime {
  readonly host: FedosDesktopHost;
  /**
   * Alpha 671/678 — the Application Runtime this running Local Runtime
   * owns. Returns the SAME `FedosBoardRuntime` instance on every call
   * while this runtime is running; throws once `stop()` has been
   * called (Alpha 678's own "inaccessible after stop" requirement) —
   * mirroring `stop()`'s own established "fail closed on misuse rather
   * than return something stale" convention in this exact file, rather
   * than a Host-accessor-style `null` return (this handle, unlike
   * `FedosDesktopHost`, has no intermediate "not yet ready" state to
   * return `null` for — it exists only once the runtime already
   * started successfully).
   */
  boardRuntime(): FedosBoardRuntime;
  /**
   * Alpha 612 — ordering enforced: (1) no further calls into this
   * runtime are meaningful once called; (2) if delivery was started,
   * `host.stopDelivery()` first (itself already guarantees "no new
   * tick starts, in-flight tick completes," Alpha 505/506/564,
   * unchanged); (3) `host.stop()`. Throws on a SECOND call — mirrors
   * `FedosDesktopHost.stop()`'s own non-idempotent, "may only be
   * called once, from the ready/running state" contract exactly,
   * rather than silently absorbing a repeat call.
   */
  stop(): Promise<void>;
}

/** PRIVATE — ensures a caller-supplied file's own parent directory exists (Alpha 604). Never creates the file itself. */
function ensureParentDirectoryExists(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export async function startFedosDesktopRuntime(
  config: FedosDesktopRuntimeConfig,
): Promise<FedosRunningDesktopRuntime> {
  if (config.deliveryEnabled) {
    if (config.observationLogPath === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: deliveryEnabled is true but observationLogPath was not supplied — a durable Observation backend is required to activate delivery honestly (see Alpha 609).",
      );
    }
    if (config.publisher === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: deliveryEnabled is true but no publisher was supplied — this runtime constructs no Signing Authority or Relay of its own (see Alpha 610).",
      );
    }
  }

  ensureParentDirectoryExists(config.boardLogPath);
  ensureParentDirectoryExists(config.outboxLogPath);
  if (config.observationLogPath !== undefined) {
    ensureParentDirectoryExists(config.observationLogPath);
  }
  if (config.conversationLogPath !== undefined) {
    ensureParentDirectoryExists(config.conversationLogPath);
  }

  const boardPersistence = new AppendOnlyFedosBoardPersistence(config.boardLogPath);
  const outboxPersistence = new AppendOnlyFedosBoardOutboxPersistence(config.outboxLogPath);
  const observationRepository =
    config.observationLogPath !== undefined
      ? new FedosDeliveryObservationRepository(
          new AppendOnlyFedosDeliveryObservationPersistence(config.observationLogPath),
        )
      : undefined;
  // Alpha 758 -- constructed explicitly HERE (not left to
  // FedosBoardRuntime's own internal default) so this function always
  // holds a concrete reference to hydrate against, below.
  const conversationPersistence: FedosConversationPersistence =
    config.conversationLogPath !== undefined
      ? new AppendOnlyFedosConversationPersistence(config.conversationLogPath)
      : new InMemoryFedosConversationPersistence();

  const host = createFedosDesktopHost({
    desktopApplication: createDesktopApplication(),
    boardPersistence,
    outboxPersistence,
    observationRepository,
    publisher: config.publisher,
    deliveryIntervalMs: config.deliveryIntervalMs,
  });

  await host.start(); // propagates unmodified on a corrupt Board log — Host itself sets state "failed" (Alpha 614)

  // Alpha 756/758 -- verifies every persisted Conversation record
  // against the Board state host.start() just hydrated, BEFORE any
  // FedosBoardRuntime Conversation read is ever reachable. A
  // non-"hydrated" outcome throws, mirroring the exact same "convert a
  // corrupt log into a thrown Error" discipline host.start() itself
  // already uses for a corrupt Board log.
  const boardReaderForHydration = host.board();
  if (boardReaderForHydration === null) {
    throw new Error("startFedosDesktopRuntime: Host reported ready but board() returned null -- unreachable under normal operation.");
  }
  const conversationHydration = hydrateFedosConversations(conversationPersistence, boardReaderForHydration);
  if (conversationHydration.outcome !== "hydrated") {
    throw new Error(`startFedosDesktopRuntime failed to hydrate Conversation state: ${conversationHydration.outcome}`);
  }

  let deliveryStarted = false;
  if (config.deliveryEnabled) {
    host.startDelivery(); // propagates unmodified on a corrupt Outbox/Observation log
    deliveryStarted = true;
  }

  // Alpha 672 -- exactly one FedosBoardRuntime per running runtime,
  // over the SAME host, using whichever Authority/idGenerator/clock
  // the caller supplied (or FedosBoardRuntime's own existing defaults).
  // Alpha 758 -- conversationPersistence is always the concrete
  // instance constructed above, never omitted here.
  const boardRuntimeInstance = createFedosBoardRuntime({
    host,
    idGenerator: config.idGenerator,
    clock: config.clock,
    publicAuthorAuthority: config.publicAuthorAuthority,
    conversationPolicyAuthority: config.conversationPolicyAuthority,
    nostrAuthorBindingAuthority: config.nostrAuthorBindingAuthority,
    nostrAccountIndex: config.nostrAccountIndex,
    conversationPersistence,
  });

  let stopped = false;
  return {
    host,
    boardRuntime(): FedosBoardRuntime {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.boardRuntime() is inaccessible after stop().");
      }
      return boardRuntimeInstance;
    },
    async stop(): Promise<void> {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.stop() may only be called once.");
      }
      stopped = true;
      if (deliveryStarted) {
        await host.stopDelivery();
      }
      await host.stop();
    },
  };
}
