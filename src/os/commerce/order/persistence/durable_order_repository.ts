/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — Order domain, DURABLE `OrderRepository` adapter.
 *
 * Closes P1 "all Commerce domain state is in-memory only" for the Order
 * domain. Follows the SAME NDJSON append-only log discipline already
 * established twice in this repository —
 * `src/os/messenger/sync/persistence/append_only_fedos_sync_journal_persistence.ts`
 * and
 * `src/os/messenger/device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.ts`
 * — rather than inventing a new persistence mechanism: independent log
 * file, `node:fs` readFileSync/appendFileSync, replay-on-construction into
 * an in-memory `Map`, fail-CLOSED on any corruption.
 *
 * `Domain -> Port <- Adapter`: this file implements `OrderRepository`
 * (`../order_repository_port.js`) exactly as written — no Port change, no
 * `Order` shape change (`../order_types.js`) — as a SIBLING of
 * `../local_order_repository.ts`, never a replacement of it. Neither
 * `order_state_machine.ts` nor `order_types.ts` is touched by this file
 * (Agent O's territory).
 *
 * UPSERT, NOT INSERT-ONLY: unlike the two precedent files above (whose
 * records are write-once by key), `OrderRepository.save()` is an explicit
 * upsert — the SAME `Order.id` is legitimately saved many times over its
 * lifecycle as `order_state_machine.ts`'s pure transition functions move it
 * through `created -> submitted -> accepted -> paid -> ...`. Every
 * mutating call therefore appends the entity's FULL current state (not a
 * diff), tagged `schemaVersion: 1`, and replay applies each record in
 * append order so the last record for a given `id` wins for its MUTABLE
 * fields.
 *
 * WHAT STILL COUNTS AS CORRUPTION FOR AN UPSERT DOMAIN: an `Order`'s
 * identity fields (`id`, `productId`, `buyerPubkey`, `sellerPubkey`,
 * `quantity`, `unitPriceCents`, `currency`, `createdAt`) are, by
 * `order_state_machine.ts`'s own design, NEVER mutated by any transition —
 * every real transition function only ever changes `status`/`updatedAt`/
 * `paymentId`/`paymentStatus`/`deliveryId`/`deliveryStatus`/`history`. Two
 * persisted records sharing the same `id` but disagreeing on any identity
 * field can therefore never be produced by honest use of this Port — it is
 * exactly the "duplicate id with conflicting content" corruption case this
 * arc requires fail-closed handling for, and `replayLog`/`save()` both
 * reject it unconditionally.
 *
 * CONSISTENCY INVARIANT THIS FILE PRESERVES (per-repository, no fake
 * cross-entity atomicity — see this arc's own "no 2PC" instruction): an
 * `Order`'s persisted `status`/`paymentId`/`paymentStatus`/`deliveryId`/
 * `deliveryStatus` are exactly what was true at the last `save()` call that
 * durably completed (i.e. whose `appendFileSync` returned). Replaying the
 * log can therefore never show `"paid"` if the `save()` that set it never
 * durably landed — there is no possible intermediate/partial state, because
 * `save()` always appends ONE complete, self-contained `Order` snapshot,
 * never a partial field update.
 */

import { readFileSync, appendFileSync } from "node:fs";
import type { Order } from "../order_types.js";
import type { OrderRepository } from "../order_repository_port.js";

const ORDER_SCHEMA_VERSION_1 = 1 as const;

/** One persisted line: the entity's FULL current state, never a diff. */
interface PersistedOrderRecordV1 {
  readonly schemaVersion: 1;
  readonly order: Order;
}

/**
 * Fields fixed for the lifetime of an `Order` — `order_state_machine.ts`
 * never mutates any of these. Any two persisted records for the same `id`
 * MUST agree on every one of these fields, or the log is corrupt.
 */
const ORDER_IMMUTABLE_FIELDS: readonly (keyof Order)[] = [
  "id",
  "productId",
  "buyerPubkey",
  "sellerPubkey",
  "quantity",
  "unitPriceCents",
  "currency",
  "createdAt",
];

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/**
 * Minimal structural well-formedness check for a replayed `Order` record.
 * Deliberately NOT a re-implementation of `order_state_machine.ts`'s
 * business rules (out of this adapter's scope — this file only durably
 * stores whatever shape `Order` already is) — just enough to reject a
 * truncated/garbled line rather than silently accepting a hollowed-out
 * object.
 */
function isWellFormedOrderShape(value: unknown): value is Order {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== "string" || c.id.length === 0) return false;
  if (typeof c.productId !== "string") return false;
  if (typeof c.buyerPubkey !== "string") return false;
  if (typeof c.sellerPubkey !== "string") return false;
  if (typeof c.status !== "string") return false;
  if (typeof c.quantity !== "number" || !Number.isFinite(c.quantity)) return false;
  if (typeof c.unitPriceCents !== "number" || !Number.isFinite(c.unitPriceCents)) return false;
  if (typeof c.currency !== "string") return false;
  if (typeof c.createdAt !== "number" || !Number.isFinite(c.createdAt)) return false;
  if (typeof c.updatedAt !== "number" || !Number.isFinite(c.updatedAt)) return false;
  if (!Array.isArray(c.history)) return false;
  return true;
}

function orderIdentityFieldsMatch(a: Order, b: Order): boolean {
  return ORDER_IMMUTABLE_FIELDS.every((key) => a[key] === b[key]);
}

/**
 * PRIVATE — replays the append log into a `Map<id, Order>`. A parse
 * failure, an unrecognized `schemaVersion`, a schema-invalid record, OR an
 * irreconcilable identity-field conflict between two records sharing the
 * same `id` throws unconditionally — fail-closed on corruption, exactly
 * like every sibling append-only backend in this codebase.
 */
function replayLog(filePath: string): Map<string, Order> {
  const contents = readLogFile(filePath);
  const byId = new Map<string, Order>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurableOrderRepository: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== ORDER_SCHEMA_VERSION_1) {
      throw new Error(
        `DurableOrderRepository: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (!isWellFormedOrderShape(candidate.order)) {
      throw new Error("DurableOrderRepository: corrupt or schema-invalid Order record found in log file.");
    }
    const order = candidate.order;
    const existing = byId.get(order.id);
    if (existing !== undefined && !orderIdentityFieldsMatch(existing, order)) {
      throw new Error(
        `DurableOrderRepository: conflicting duplicate records for order id "${order.id}" found in log file (identity fields disagree).`,
      );
    }
    byId.set(order.id, order);
  }
  return byId;
}

export class DurableOrderRepository implements OrderRepository {
  readonly #filePath: string;
  #orders: Map<string, Order>;

  /**
   * `filePath` is caller-supplied and never guessed/constructed by this
   * class — no Electron API of any kind is imported here, so this stays
   * callable directly from a Node test. Replays the existing log
   * immediately (missing file => empty state, exactly like the two
   * precedent files' own ENOENT handling).
   */
  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#orders = replayLog(filePath);
  }

  save(order: Order): void {
    const existing = this.#orders.get(order.id);
    if (existing !== undefined && !orderIdentityFieldsMatch(existing, order)) {
      throw new Error(
        `DurableOrderRepository: save() for order id "${order.id}" would change an identity field that must never change -- rejected.`,
      );
    }
    const record: PersistedOrderRecordV1 = { schemaVersion: ORDER_SCHEMA_VERSION_1, order };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
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
