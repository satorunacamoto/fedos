/**
 * FedOS Commerce End-to-End Completion arc (Agent O) — Order domain, UI
 * module, part 2: small, framework-agnostic state controllers.
 *
 * `CustomerOrderController` and `MerchantOrderController` are the only
 * things a coordinator needs to mount against real DOM/IPC glue: each
 * wraps an `OrderRepository` + the pure `order_state_machine.ts` functions
 * behind a persona-scoped (customer or merchant pubkey) method surface.
 * Neither imports anything from `src/os/commerce/payment/`, Electron, or
 * any DOM API — synthetic demo identities/data only, per this arc's scope.
 *
 * DELIBERATE OMISSION — read before adding a method here: neither
 * controller exposes ANY method that could cause the `"paid"` or
 * `"delivered"` transition (there is no `confirmPayment`/`confirmDelivery`
 * method on either class). Those transitions require an actor of kind
 * `"payment_evidence"`/`"delivery_evidence"` (see `order_state_machine.ts`),
 * which only a genuinely verified evidence path may construct — never a
 * button a customer or merchant can click. This is the concrete UI-side
 * enforcement of the brief's requirement: "No fake payment completion
 * control anywhere in this UI." Wiring a real evidence-driven call is
 * explicitly the coordinator's/Agent P's job at the integration gate, via
 * `applyOrderAction` directly — not through this controller.
 */

import { applyOrderAction, createOrder, getAvailableActions } from "../order_state_machine.js";
import type { OrderRepository } from "../order_repository_port.js";
import type { Order, OrderTransitionResult } from "../order_types.js";
import {
  buildCreateOrderDraft,
  buildCustomerOrderStatusViewModel,
  buildMerchantIncomingOrdersViewModel,
  buildMerchantOrderDetailViewModel,
  type CreateOrderDraft,
  type MerchantIncomingOrdersViewModel,
  type MerchantOrderDetailViewModel,
  type OrderStatusViewModel,
} from "./order_view_models.js";
import type { Product } from "../../catalog/types.js";

export interface OrderControllerDeps {
  readonly repository: OrderRepository;
  /** Injectable clock for deterministic tests; defaults to `Date.now`. */
  readonly now?: () => number;
}

function notFound(orderId: string): OrderTransitionResult {
  return { ok: false, code: "invalid_state", reason: `no such order "${orderId}"` };
}

export class CustomerOrderController {
  readonly #repository: OrderRepository;
  readonly #now: () => number;
  readonly #customerPubkey: string;

  constructor(deps: OrderControllerDeps, customerPubkey: string) {
    this.#repository = deps.repository;
    this.#now = deps.now ?? (() => Date.now());
    this.#customerPubkey = customerPubkey;
  }

  /** Product Detail -> "Create Order": builds a draft from a read-only `Product`. Never persists anything. */
  buildDraft(product: Product, quantity: number) {
    return buildCreateOrderDraft(product, quantity);
  }

  /** Review -> "Submit"'s prerequisite: actually creates the Order (status `"created"`) and persists it. */
  createOrder(orderId: string, draft: CreateOrderDraft): OrderTransitionResult {
    const result = createOrder(
      {
        id: orderId,
        productId: draft.productId,
        sellerPubkey: draft.sellerPubkey,
        unitPriceCents: draft.unitPriceCents,
        currency: draft.currency,
        quantity: draft.quantity,
      },
      { kind: "customer", pubkey: this.#customerPubkey },
      this.#now(),
    );
    if (result.ok) this.#repository.save(result.order);
    return result;
  }

  /** "Submit": created -> submitted, sends the order to the merchant's Incoming Orders list. */
  submitOrder(orderId: string): OrderTransitionResult {
    return this.#apply(orderId, { type: "submit", actor: { kind: "customer", pubkey: this.#customerPubkey } });
  }

  /** Customer cancel — the state machine itself enforces "before acceptance only". */
  cancelOrder(orderId: string, reason?: string): OrderTransitionResult {
    return this.#apply(orderId, {
      type: "cancel",
      actor: { kind: "customer", pubkey: this.#customerPubkey },
      reason,
    });
  }

  /** Customer confirms receipt after delivery — closes the order. Carries no payment/delivery claim of any kind. */
  completeOrder(orderId: string): OrderTransitionResult {
    return this.#apply(orderId, { type: "complete", actor: { kind: "customer", pubkey: this.#customerPubkey } });
  }

  listMyOrders(): readonly Order[] {
    return this.#repository.listByBuyer(this.#customerPubkey);
  }

  getOrder(orderId: string): Order | undefined {
    return this.#repository.findById(orderId);
  }

  /** The customer's "Order status view" screen. */
  getOrderStatusViewModel(orderId: string): OrderStatusViewModel | undefined {
    const order = this.#repository.findById(orderId);
    return order === undefined ? undefined : buildCustomerOrderStatusViewModel(order, "customer");
  }

  #apply(orderId: string, action: Parameters<typeof applyOrderAction>[1]): OrderTransitionResult {
    const order = this.#repository.findById(orderId);
    if (order === undefined) return notFound(orderId);
    const result = applyOrderAction(order, action, this.#now());
    if (result.ok) this.#repository.save(result.order);
    return result;
  }
}

export class MerchantOrderController {
  readonly #repository: OrderRepository;
  readonly #now: () => number;
  readonly #merchantPubkey: string;

  constructor(deps: OrderControllerDeps, merchantPubkey: string) {
    this.#repository = deps.repository;
    this.#now = deps.now ?? (() => Date.now());
    this.#merchantPubkey = merchantPubkey;
  }

  /** The "Incoming Orders" list, grouped by what needs merchant attention. */
  getIncomingOrdersViewModel(): MerchantIncomingOrdersViewModel {
    return buildMerchantIncomingOrdersViewModel(this.#repository.listBySeller(this.#merchantPubkey));
  }

  listOrders(): readonly Order[] {
    return this.#repository.listBySeller(this.#merchantPubkey);
  }

  getOrder(orderId: string): Order | undefined {
    return this.#repository.findById(orderId);
  }

  /** Inspect one order -> Accept/Reject/Fulfillment view. */
  getOrderDetailViewModel(orderId: string): MerchantOrderDetailViewModel | undefined {
    const order = this.#repository.findById(orderId);
    return order === undefined ? undefined : buildMerchantOrderDetailViewModel(order);
  }

  acceptOrder(orderId: string): OrderTransitionResult {
    return this.#apply(orderId, { type: "accept", actor: { kind: "merchant", pubkey: this.#merchantPubkey } });
  }

  rejectOrder(orderId: string, reason?: string): OrderTransitionResult {
    return this.#apply(orderId, {
      type: "reject",
      actor: { kind: "merchant", pubkey: this.#merchantPubkey },
      reason,
    });
  }

  /** Starts fulfillment (paid -> fulfilling). This is the ONLY merchant-facing fulfillment control — reaching `"delivered"` requires delivery evidence, never a button here. */
  fulfillOrder(orderId: string): OrderTransitionResult {
    return this.#apply(orderId, { type: "fulfill", actor: { kind: "merchant", pubkey: this.#merchantPubkey } });
  }

  /** Merchant may also close a delivered order (see `order_state_machine.ts`'s `complete` authority — no money/delivery claim is involved at this step). */
  completeOrder(orderId: string): OrderTransitionResult {
    return this.#apply(orderId, { type: "complete", actor: { kind: "merchant", pubkey: this.#merchantPubkey } });
  }

  #apply(orderId: string, action: Parameters<typeof applyOrderAction>[1]): OrderTransitionResult {
    const order = this.#repository.findById(orderId);
    if (order === undefined) return notFound(orderId);
    const result = applyOrderAction(order, action, this.#now());
    if (result.ok) this.#repository.save(result.order);
    return result;
  }
}

// Re-exported so a coordinator building a UI shell can call this directly
// for "which buttons should I show" without constructing a controller.
export { getAvailableActions };
