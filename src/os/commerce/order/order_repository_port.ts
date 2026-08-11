/**
 * FedOS Commerce End-to-End Completion arc (Agent O) — Order domain,
 * repository Port.
 *
 * The smallest protocol-independent container contract for `Order`
 * (`./order_types.js`), mirroring the existing repository-Port convention
 * used elsewhere in this repository (e.g.
 * `src/os/messenger/board/repository/fedos_board_repository.ts`): a plain
 * synchronous interface, one concrete in-memory implementation
 * (`./local_order_repository.js`), no storage/network dependency of any
 * kind at this layer.
 *
 * Unlike `FedosBoardRepository` (posts are immutable once registered),
 * `Order` values are mutated over their lifecycle by
 * `order_state_machine.ts`'s pure transition functions, each producing a
 * NEW `Order` object — `save()` is therefore a plain upsert-by-id, not an
 * insert-only register.
 *
 * HARD GUARDRAILS (same posture as the rest of `os/commerce`):
 *   - Synchronous — no method returns a `Promise`.
 *   - No Storage, Runtime, Desktop, Network, or messenger dependency of
 *     any kind (enforced repo-wide by `test/architecture_boundary_commerce.test.ts`).
 *   - No mutable internal collection exposure — every list method returns
 *     a fresh `readonly Order[]`.
 */

import type { Order } from "./order_types.js";

export interface OrderRepository {
  /** Insert or overwrite the Order with this `id`. */
  save(order: Order): void;
  findById(id: string): Order | undefined;
  list(): readonly Order[];
  listByBuyer(buyerPubkey: string): readonly Order[];
  listBySeller(sellerPubkey: string): readonly Order[];
}
