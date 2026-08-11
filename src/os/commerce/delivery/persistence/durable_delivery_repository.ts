/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — Delivery domain, DURABLE `DeliveryRepository`
 * adapter.
 *
 * Closes P1 "all Commerce domain state is in-memory only" for the Delivery
 * domain. Same NDJSON append-only log discipline as
 * `../../order/persistence/durable_order_repository.ts` (see that file's
 * header for the full precedent citation).
 *
 * `Domain -> Port <- Adapter`: this file implements `DeliveryRepository`
 * (`../delivery_repository_port.js`) exactly as written — no Port change,
 * no `DeliveryRecord` shape change (`../delivery_types.js`) — as a SIBLING
 * of `../local_delivery_repository.ts`, never a replacement of it.
 *
 * UPSERT, NOT INSERT-ONLY (mirrors Order): `DeliveryRepository.save()` is
 * an explicit upsert — the same `DeliveryRecord.id` is saved repeatedly as
 * `delivery_state_machine.ts`'s pure transition functions move it through
 * `pending -> fulfilling -> delivered -> completed`. `id`, `orderId`,
 * `buyerPubkey`, `sellerPubkey`, and `createdAt` are never mutated by any
 * real transition — two persisted records for the same `id` disagreeing on
 * any of those is corruption, never a legitimate update.
 *
 * CONSISTENCY INVARIANT THIS FILE PRESERVES: a Delivery record's persisted
 * `status`/`evidenceSource`/`artifact` are exactly what was true at the
 * last `save()` call that durably completed. There is no partial-write
 * state — every `save()` appends ONE complete `DeliveryRecord` snapshot.
 */

import { readFileSync, appendFileSync } from "node:fs";
import type { DeliveryRecord } from "../delivery_types.js";
import type { DeliveryRepository } from "../delivery_repository_port.js";

const DELIVERY_SCHEMA_VERSION_1 = 1 as const;

/** One persisted line: the entity's FULL current state, never a diff. */
interface PersistedDeliveryRecordV1 {
  readonly schemaVersion: 1;
  readonly delivery: DeliveryRecord;
}

/** Fields no real transition in `delivery_state_machine.ts` ever changes once a Delivery record exists. */
const DELIVERY_IMMUTABLE_FIELDS: readonly (keyof DeliveryRecord)[] = ["id", "orderId", "buyerPubkey", "sellerPubkey", "createdAt"];

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

/** Minimal structural well-formedness check for a replayed `DeliveryRecord`. Not a re-implementation of `delivery_state_machine.ts`'s rules -- just enough to reject a truncated/garbled line. */
function isWellFormedDeliveryShape(value: unknown): value is DeliveryRecord {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== "string" || c.id.length === 0) return false;
  if (typeof c.orderId !== "string") return false;
  if (typeof c.buyerPubkey !== "string") return false;
  if (typeof c.sellerPubkey !== "string") return false;
  if (typeof c.status !== "string") return false;
  if (typeof c.createdAt !== "number" || !Number.isFinite(c.createdAt)) return false;
  if (typeof c.updatedAt !== "number" || !Number.isFinite(c.updatedAt)) return false;
  if (!Array.isArray(c.history)) return false;
  return true;
}

function deliveryIdentityFieldsMatch(a: DeliveryRecord, b: DeliveryRecord): boolean {
  return DELIVERY_IMMUTABLE_FIELDS.every((key) => a[key] === b[key]);
}

/**
 * PRIVATE — replays the append log into a `Map<id, DeliveryRecord>`. A
 * parse failure, an unrecognized `schemaVersion`, a schema-invalid record,
 * OR an irreconcilable identity-field conflict between two records sharing
 * the same `id` throws unconditionally.
 */
function replayLog(filePath: string): Map<string, DeliveryRecord> {
  const contents = readLogFile(filePath);
  const byId = new Map<string, DeliveryRecord>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurableDeliveryRepository: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== DELIVERY_SCHEMA_VERSION_1) {
      throw new Error(
        `DurableDeliveryRepository: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (!isWellFormedDeliveryShape(candidate.delivery)) {
      throw new Error("DurableDeliveryRepository: corrupt or schema-invalid DeliveryRecord found in log file.");
    }
    const delivery = candidate.delivery;
    const existing = byId.get(delivery.id);
    if (existing !== undefined && !deliveryIdentityFieldsMatch(existing, delivery)) {
      throw new Error(
        `DurableDeliveryRepository: conflicting duplicate records for delivery id "${delivery.id}" found in log file (identity fields disagree).`,
      );
    }
    byId.set(delivery.id, delivery);
  }
  return byId;
}

export class DurableDeliveryRepository implements DeliveryRepository {
  readonly #filePath: string;
  #deliveries: Map<string, DeliveryRecord>;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#deliveries = replayLog(filePath);
  }

  save(delivery: DeliveryRecord): void {
    const existing = this.#deliveries.get(delivery.id);
    if (existing !== undefined && !deliveryIdentityFieldsMatch(existing, delivery)) {
      throw new Error(
        `DurableDeliveryRepository: save() for delivery id "${delivery.id}" would change an identity field that must never change -- rejected.`,
      );
    }
    const record: PersistedDeliveryRecordV1 = { schemaVersion: DELIVERY_SCHEMA_VERSION_1, delivery };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
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
