/**
 * FedOS Commerce End-to-End Completion arc (Agent D, Wave B) — public
 * barrel for `os/commerce/delivery`. Scoped to Agent D's own exclusive
 * directory (not the top-level `os/commerce` barrel, `../index.ts`, which
 * is reserved for the coordinator) — mirrors `order/index.ts`'s own
 * per-agent barrel convention.
 */

export {
  AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES,
  DELIVERY_STATUSES,
  TERMINAL_DELIVERY_STATUSES,
  type CreateDeliveryInput,
  type DeliveryAction,
  type DeliveryActionType,
  type DeliveryActor,
  type DeliveryActorKind,
  type DeliveryEvidence,
  type DeliveryEvidenceProvenance,
  type DeliveryHistoryActionType,
  type DeliveryReceiptArtifact,
  type DeliveryRecord,
  type DeliveryRejectionCode,
  type DeliveryStatus,
  type DeliveryTransitionRecord,
  type DeliveryTransitionResult,
  type MerchantDeliveryClaim,
} from "./delivery_types.js";

export { buildDeliveryReceiptArtifact } from "./delivery_artifact.js";

export {
  applyDeliveryAction,
  createDelivery,
  getAvailableDeliveryActions,
  isTerminalDeliveryStatus,
} from "./delivery_state_machine.js";

export type { DeliveryRepository } from "./delivery_repository_port.js";
export { LocalDeliveryRepository } from "./local_delivery_repository.js";
// Commerce Durability arc (Agent D) -- durable, restart-surviving sibling
// of `LocalDeliveryRepository`, same `DeliveryRepository` Port, backed by
// an append-only NDJSON log file.
export { DurableDeliveryRepository } from "./persistence/durable_delivery_repository.js";
