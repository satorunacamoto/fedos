/**
 * OS Capability Modularization — Factory/Port Completion pass. Public API
 * barrel for `os/core`.
 *
 * `os/core` in this repo's own Ports-and-Adapters framing (see
 * `docs/architecture/OS-CAPABILITY-BOUNDARIES.md`) is genuinely public as
 * the five PORT CONTRACTS other capabilities depend on — those are the
 * ONLY things re-exported here.
 *
 * DELIBERATELY NOT RE-EXPORTED: `identity/`, `crypto/`, `settings/`,
 * `storage/`, `vault/` (including `vault/wasm/`). These directories hold
 * concrete implementation detail, not contract — several are pre-pivot
 * scaffolding with zero production consumers (see each directory's own
 * README/doc comments; `storage/` and `vault/` in particular are
 * documented reserved/placeholder seams, not live capability). A consumer
 * that genuinely needs one of those concrete pieces (e.g. the real
 * `FedosWasmMasterSeedAuthority`, `os/core/vault/wasm/fedos_wasm_master_seed_authority.js`)
 * imports it directly from its own path — re-exporting it here would
 * blur the "Port is the public surface" discipline this barrel exists to
 * enforce, and would risk this barrel becoming a second, competing import
 * path for code that already has one canonical location.
 *
 * BOUNDARY CHECK (re-verify after any future edit to this file): `os/core`
 * must never import `os/messenger` or `os/commerce`
 * (`test/architecture_boundary_core.test.ts`) — every export below is a
 * pure interface/type re-export from `./ports/*`, which already satisfies
 * that rule on its own, so this barrel adds no new edge. Re-run
 * `node scripts/architecture_cycle_detector.mjs` after changing this file.
 */

export type {
  ConversationId,
  MessageId,
  MessagePayload,
  MessageSendFailureReason,
  SendResult,
  MessageReadFailureReason,
  MessageReadResult,
  MessageRetentionState,
  MessageSummary,
  InboundMessage,
  MessageHandler,
  Unsubscribe,
  MessageSendPort,
  MessageHistoryPort,
  MessageInboundPort,
  MessagingPort,
} from "./ports/messaging_port.js";

export type {
  ConversationId as MessengerConversationId,
  CounterpartyRef,
  ConversationMode,
  ConversationDescriptor,
  ConversationResult,
  ConversationCreationPort,
  ConversationQueryPort,
  MembershipMutationOutcome,
  MembershipMutationResult,
  ConversationMembershipPort,
  ConversationReadinessOverall,
  ConversationReadiness,
  ConversationReadinessPort,
  ConversationPort,
} from "./ports/conversation_port.js";

export type { NotificationMeta, NotificationPort } from "./ports/notification_port.js";

export type { SealingAuthorityPort } from "./ports/sealing_authority_port.js";

export type { LocalAIContext, LocalAIProvider } from "./ports/local_ai_provider.js";
