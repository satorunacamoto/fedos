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

export interface FedosRunningDesktopRuntime {
  readonly host: FedosDesktopHost;
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

  const boardPersistence = new AppendOnlyFedosBoardPersistence(config.boardLogPath);
  const outboxPersistence = new AppendOnlyFedosBoardOutboxPersistence(config.outboxLogPath);
  const observationRepository =
    config.observationLogPath !== undefined
      ? new FedosDeliveryObservationRepository(
          new AppendOnlyFedosDeliveryObservationPersistence(config.observationLogPath),
        )
      : undefined;

  const host = createFedosDesktopHost({
    desktopApplication: createDesktopApplication(),
    boardPersistence,
    outboxPersistence,
    observationRepository,
    publisher: config.publisher,
    deliveryIntervalMs: config.deliveryIntervalMs,
  });

  await host.start(); // propagates unmodified on a corrupt Board log — Host itself sets state "failed" (Alpha 614)

  let deliveryStarted = false;
  if (config.deliveryEnabled) {
    host.startDelivery(); // propagates unmodified on a corrupt Outbox/Observation log
    deliveryStarted = true;
  }

  let stopped = false;
  return {
    host,
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
