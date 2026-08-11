/**
 * FedOS Commerce End-to-End Completion arc (Agent O) — public barrel for
 * `os/commerce/order`. Scoped to Agent O's own exclusive directory (not the
 * top-level `os/commerce` barrel, `../index.ts`, which is reserved for the
 * coordinator).
 */

export {
  ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  type CreateOrderInput,
  type DeliveryStatus,
  type Order,
  type OrderAction,
  type OrderActionType,
  type OrderActor,
  type OrderActorKind,
  type OrderDeliveryEvidence,
  type OrderHistoryActionType,
  type OrderPaymentEvidence,
  type OrderRejectionCode,
  type OrderStatus,
  type OrderTransitionRecord,
  type OrderTransitionResult,
  type PaymentStatus,
} from "./order_types.js";

export {
  applyOrderAction,
  createOrder,
  getAvailableActions,
  isTerminalOrderStatus,
} from "./order_state_machine.js";

export type { OrderRepository } from "./order_repository_port.js";
export { LocalOrderRepository } from "./local_order_repository.js";
// Commerce Durability arc (Agent D) -- durable, restart-surviving sibling
// of `LocalOrderRepository`, same `OrderRepository` Port, backed by an
// append-only NDJSON log file.
export { DurableOrderRepository } from "./persistence/durable_order_repository.js";

export {
  buildCreateOrderDraft,
  buildCustomerOrderStatusViewModel,
  buildMerchantIncomingOrdersViewModel,
  buildMerchantOrderDetailViewModel,
  buildOrderReviewViewModel,
  describeOrderStatus,
  type CreateOrderDraftResult,
  type MerchantIncomingOrdersViewModel,
  type MerchantOrderDetailViewModel,
  type MerchantOrderSummary,
  type OrderReviewViewModel,
  type OrderStatusViewModel,
} from "./ui/order_view_models.js";

export {
  CustomerOrderController,
  MerchantOrderController,
} from "./ui/order_ui_controller.js";
