/**
 * FedOS Commerce End-to-End Completion arc (Agent O) — Order domain, the
 * first (and this arc's only) concrete `OrderRepository`
 * (`./order_repository_port.js`).
 *
 * Follows the private-field `Map`-backed class convention already used
 * repeatedly in this repository for a process-local container
 * (`InMemoryProductDirectory`, `catalog/directory.ts`;
 * `InMemoryFedosBoardRepository`, `os/messenger/board/repository/`).
 *
 * HARD GUARDRAILS:
 *   - Deterministic, synchronous, no constructor side effects.
 *   - Independent instances never share state — no module-level mutable
 *     state exists in this file.
 *   - Every list method returns a NEW array every call — no live
 *     reference to the internal `Map` is ever exposed.
 *   - Dies with the process — this is explicitly a LOCAL/dev-shaped
 *     adapter, same posture as `InMemoryProductDirectory`; a durable
 *     implementation is future work, not this arc's scope.
 */

import type { Order } from "./order_types.js";
import type { OrderRepository } from "./order_repository_port.js";

export class LocalOrderRepository implements OrderRepository {
  readonly #orders = new Map<string, Order>();

  save(order: Order): void {
    this.#orders.set(order.id, order);
  }

  findById(id: string): Order | undefined {
    return this.#orders.get(id);
  }

  list(): readonly Order[] {
    return [...this.#orders.values()];
  }

  listByBuyer(buyerPubkey: string): readonly Order[] {
    return [...this.#orders.values()].filter((order) => order.buyerPubkey === buyerPubkey);
  }

  listBySeller(sellerPubkey: string): readonly Order[] {
    return [...this.#orders.values()].filter((order) => order.sellerPubkey === sellerPubkey);
  }
}
