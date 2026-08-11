/**
 * FedOS Commerce End-to-End Completion arc (Agent D, Wave B) — Delivery
 * domain, the first (and this arc's only) concrete `DeliveryRepository`
 * (`./delivery_repository_port.js`).
 *
 * Follows the private-field `Map`-backed class convention already used
 * repeatedly in this repository for a process-local container
 * (`LocalOrderRepository`, `order/local_order_repository.ts`;
 * `InMemoryProductDirectory`, `catalog/directory.ts`).
 *
 * HARD GUARDRAILS:
 *   - Deterministic, synchronous, no constructor side effects.
 *   - Independent instances never share state — no module-level mutable
 *     state exists in this file.
 *   - Every list method returns a NEW array every call — no live
 *     reference to the internal `Map` is ever exposed.
 *   - Dies with the process — this is explicitly a LOCAL/dev-shaped
 *     adapter, same posture as `LocalOrderRepository`; a durable
 *     implementation is future work, not this arc's scope.
 */

import type { DeliveryRecord } from "./delivery_types.js";
import type { DeliveryRepository } from "./delivery_repository_port.js";

export class LocalDeliveryRepository implements DeliveryRepository {
  readonly #deliveries = new Map<string, DeliveryRecord>();

  save(delivery: DeliveryRecord): void {
    this.#deliveries.set(delivery.id, delivery);
  }

  findById(id: string): DeliveryRecord | undefined {
    return this.#deliveries.get(id);
  }

  findByOrderId(orderId: string): DeliveryRecord | undefined {
    return [...this.#deliveries.values()].find((delivery) => delivery.orderId === orderId);
  }

  list(): readonly DeliveryRecord[] {
    return [...this.#deliveries.values()];
  }

  listByBuyer(buyerPubkey: string): readonly DeliveryRecord[] {
    return [...this.#deliveries.values()].filter((delivery) => delivery.buyerPubkey === buyerPubkey);
  }

  listBySeller(sellerPubkey: string): readonly DeliveryRecord[] {
    return [...this.#deliveries.values()].filter((delivery) => delivery.sellerPubkey === sellerPubkey);
  }
}
