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
 * Secure Runtime Alpha 673 ("Runtime Configuration Extension") — Stage
 * 3 of Phase D of the Alpha 641–680 Public Identity, Conversation
 * Policy & Application Runtime Integration Arc. Adds exactly four new,
 * OPTIONAL fields — `publicAuthorAuthority`, `conversationPolicyAuthority`,
 * `idGenerator`, `clock` — all OBJECT dependencies passed straight
 * through to `createFedosBoardRuntime()` (`fedos_desktop_runtime.ts`,
 * Alpha 672), never interpreted or transformed here. Deliberately
 * OMITS a `publicIdentity` field of any kind: Alpha 673's own "no raw
 * identity values" prohibition means a caller wanting a real, resolved
 * public author does so by supplying a `publicAuthorAuthority`
 * implementation (e.g. a `StaticFedosPublicAuthorAuthority` wrapping an
 * already-resolved identity) — never by handing this config file a raw
 * identity snapshot to plumb through `createDesktopApplication()`
 * itself, which stays byte-for-byte unchanged, still called with no
 * argument (Alpha 606, unmodified — see Alpha 674's own rationale).
 *
 * HARD GUARDRAILS:
 *   - `FedosDesktopRuntimeConfig` is the ONLY export.
 *   - NO secret/seed/token/credential field of any kind.
 *   - NO field accepts an entire `process.env`-shaped object.
 *   - Every filesystem path is a caller-supplied, explicit string —
 *     no default path, no `cwd`-relative implicit path (Alpha 604).
 *   - `publisher` is an OBJECT dependency (Alpha 610), never a
 *     primitive credential/URL this file would need to interpret.
 *   - `publicAuthorAuthority`/`conversationPolicyAuthority`/
 *     `idGenerator`/`clock` (Alpha 673) are OBJECT/function
 *     dependencies only — no raw identity value, no policy JSON bag,
 *     no UI setting, no arbitrary untyped callback.
 */

import type { FedosBoardOutboxPublisher } from "../../board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPublicAuthorAuthority } from "../../board/runtime/identity/fedos_public_author_authority.js";
import type { FedosConversationPolicyAuthority } from "../../board/runtime/policy/fedos_conversation_policy_authority.js";
import type { FedosBoardRuntimeIdGenerator } from "../../board/runtime/fedos_board_runtime_id_generator.js";
import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";

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
  /**
   * Alpha 673 — optional; passed straight through to
   * `createFedosBoardRuntime()`. Omitted, `FedosBoardRuntime`'s own
   * existing default (`FedosDesktopPublicAuthorAuthority` wrapping this
   * runtime's own `host`) applies — anonymous-local authorship remains
   * the safe V1 default (Alpha 645/674) unless the caller injects a
   * different Authority here.
   */
  readonly publicAuthorAuthority?: FedosPublicAuthorAuthority;
  /** Alpha 673 — optional; passed straight through to `createFedosBoardRuntime()`. Omitted, `StaticFedosConversationPolicyAuthority` applies (Alpha 654/656). */
  readonly conversationPolicyAuthority?: FedosConversationPolicyAuthority;
  /** Alpha 673 — optional; passed straight through to `createFedosBoardRuntime()`. Omitted, `FedosSecureRandomBoardRuntimeIdGenerator` applies (Alpha 626, unchanged). */
  readonly idGenerator?: FedosBoardRuntimeIdGenerator;
  /** Alpha 673 — optional; passed straight through to `createFedosBoardRuntime()`. Omitted, `defaultFedosBoardRuntimeClock` applies (Alpha 625, unchanged). */
  readonly clock?: FedosBoardRuntimeClock;
}
