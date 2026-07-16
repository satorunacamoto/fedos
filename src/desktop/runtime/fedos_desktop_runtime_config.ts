/**
 * Secure Runtime Alpha 603 ("Local Runtime Configuration Model") —
 * Stage 3 of the Alpha 601–620 Desktop Local Runtime Entry Point &
 * Publish Pipeline Ownership Arc.
 *
 * The minimal configuration surface `startFedosDesktopRuntime()`
 * (`./fedos_desktop_runtime.js`, Alpha 606) accepts. See
 * `docs/secure_runtime_alpha_603_local_runtime_configuration_model.md`
 * for the full rationale.
 *
 * HARD GUARDRAILS:
 *   - `FedosDesktopRuntimeConfig` is the ONLY export.
 *   - NO secret/seed/token/credential field of any kind.
 *   - NO field accepts an entire `process.env`-shaped object.
 *   - Every filesystem path is a caller-supplied, explicit string —
 *     no default path, no `cwd`-relative implicit path (Alpha 604).
 *   - `publisher` is an OBJECT dependency (Alpha 610), never a
 *     primitive credential/URL this file would need to interpret.
 */

import type { FedosBoardOutboxPublisher } from "../../board/outbox/fedos_board_outbox_publisher.js";

export interface FedosDesktopRuntimeConfig {
  /** Explicit, caller-supplied path to the Board append-only log file. */
  readonly boardLogPath: string;
  /** Explicit, caller-supplied path to the Outbox append-only log file. */
  readonly outboxLogPath: string;
  /**
   * Explicit, caller-supplied path to the Delivery Observation
   * append-only log file. REQUIRED when `deliveryEnabled` is `true`
   * (Alpha 609/614) — omitted entirely when delivery is disabled,
   * since nothing would ever read or write it.
   */
  readonly observationLogPath?: string;
  /** When `false` (the safe default a caller must override), the runtime reaches `"ready"` without ever calling `startDelivery()`. */
  readonly deliveryEnabled: boolean;
  /** Optional — omitted, `FedosDesktopHost`'s own existing default interval applies (Alpha 507, unchanged). */
  readonly deliveryIntervalMs?: number;
  /**
   * REQUIRED when `deliveryEnabled` is `true` (Alpha 610/614) — this
   * runtime constructs no Publisher of its own (no Signing Authority,
   * no Relay, no crypto touched here, per this Arc's own Absolute
   * Prohibitions). The caller supplies a real, fully-constructed
   * `FedosBoardOutboxPublisher`; omitted when `deliveryEnabled` is
   * `false`.
   */
  readonly publisher?: FedosBoardOutboxPublisher;
}
