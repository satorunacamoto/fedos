/**
 * FedOS Commerce End-to-End Completion arc (Agent D, Wave B) — Delivery
 * domain, repository Port.
 *
 * The smallest protocol-independent container contract for `DeliveryRecord`
 * (`./delivery_types.js`), mirroring `order/order_repository_port.ts`'s
 * convention exactly: a plain synchronous interface, one concrete
 * in-memory implementation (`./local_delivery_repository.js`), no storage/
 * network dependency of any kind at this layer.
 *
 * Like `Order`, `DeliveryRecord` values are mutated over their lifecycle by
 * `delivery_state_machine.ts`'s pure transition functions, each producing a
 * NEW record — `save()` is a plain upsert-by-id, not an insert-only
 * register.
 *
 * HARD GUARDRAILS (same posture as the rest of `os/commerce`):
 *   - Synchronous — no method returns a `Promise`.
 *   - No Storage, Runtime, Desktop, Network, or messenger dependency of
 *     any kind (enforced repo-wide by `test/architecture_boundary_commerce.test.ts`).
 *   - No mutable internal collection exposure — every list method returns
 *     a fresh `readonly DeliveryRecord[]`.
 */

import type { DeliveryRecord } from "./delivery_types.js";

export interface DeliveryRepository {
  /** Insert or overwrite the Delivery record with this `id`. */
  save(delivery: DeliveryRecord): void;
  findById(id: string): DeliveryRecord | undefined;
  /** The Delivery record bound to a given (opaque) Order id, if one exists. Order<->Delivery is 1:1 in this arc. */
  findByOrderId(orderId: string): DeliveryRecord | undefined;
  list(): readonly DeliveryRecord[];
  listByBuyer(buyerPubkey: string): readonly DeliveryRecord[];
  listBySeller(sellerPubkey: string): readonly DeliveryRecord[];
}
