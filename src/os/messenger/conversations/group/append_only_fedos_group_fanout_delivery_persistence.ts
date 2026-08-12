/**
 * Secure Runtime Alpha 1346 — append-only
 * `FedosGroupFanoutDeliveryPersistence` backend. Mirrors
 * `AppendOnlyFedosConversationActivationPersistence`'s own NDJSON,
 * insert-only, fail-closed-on-conflict convention (Alpha 1121).
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosGroupFanoutDeliveryRecordKey,
  fedosGroupFanoutDeliveryRecordsAreEqual,
  resolveCurrentGroupFanoutDeliveryRecord,
  toFedosGroupFanoutDeliveryId,
  type FedosGroupFanoutDeliveryPersistence,
  type FedosGroupFanoutDeliveryPersistenceWriteResult,
  type FedosGroupFanoutDeliveryRecord,
} from "./fedos_group_fanout_delivery.js";

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

function replayLog(filePath: string): FedosGroupFanoutDeliveryRecord[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosGroupFanoutDeliveryRecord>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosGroupFanoutDeliveryRecord;
    const deliveryId = toFedosGroupFanoutDeliveryId(parsed.groupMessageId, parsed.recipientMembershipId);
    const key = fedosGroupFanoutDeliveryRecordKey(deliveryId, parsed.state);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosGroupFanoutDeliveryRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosGroupFanoutDeliveryPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosGroupFanoutDeliveryPersistence implements FedosGroupFanoutDeliveryPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putDeliveryFact(record: FedosGroupFanoutDeliveryRecord): FedosGroupFanoutDeliveryPersistenceWriteResult {
    const deliveryId = toFedosGroupFanoutDeliveryId(record.groupMessageId, record.recipientMembershipId);
    const key = fedosGroupFanoutDeliveryRecordKey(deliveryId, record.state);
    const existing =
      replayLog(this.#filePath).find(
        (r) => fedosGroupFanoutDeliveryRecordKey(toFedosGroupFanoutDeliveryId(r.groupMessageId, r.recipientMembershipId), r.state) === key,
      ) ?? null;
    if (existing !== null) {
      return fedosGroupFanoutDeliveryRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getDelivery(groupMessageId: string, recipientMembershipId: string): FedosGroupFanoutDeliveryRecord | null {
    const deliveryId = toFedosGroupFanoutDeliveryId(groupMessageId, recipientMembershipId);
    const facts = replayLog(this.#filePath).filter(
      (r) => toFedosGroupFanoutDeliveryId(r.groupMessageId, r.recipientMembershipId) === deliveryId,
    );
    return resolveCurrentGroupFanoutDeliveryRecord(facts);
  }

  listDeliveriesForMessage(groupMessageId: string): readonly FedosGroupFanoutDeliveryRecord[] {
    const byDeliveryId = new Map<string, FedosGroupFanoutDeliveryRecord[]>();
    for (const record of replayLog(this.#filePath)) {
      if (record.groupMessageId !== groupMessageId) continue;
      const deliveryId = toFedosGroupFanoutDeliveryId(record.groupMessageId, record.recipientMembershipId);
      const list = byDeliveryId.get(deliveryId) ?? [];
      list.push(record);
      byDeliveryId.set(deliveryId, list);
    }
    const result: FedosGroupFanoutDeliveryRecord[] = [];
    for (const facts of byDeliveryId.values()) {
      const current = resolveCurrentGroupFanoutDeliveryRecord(facts);
      if (current !== null) result.push(current);
    }
    return result;
  }
}
