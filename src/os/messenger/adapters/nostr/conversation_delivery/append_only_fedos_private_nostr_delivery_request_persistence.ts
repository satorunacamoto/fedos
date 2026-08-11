/**
 * Secure Runtime Alpha 1404 — append-only `FedosPrivateNostrDeliveryRequestPersistence`
 * backend. Mirrors `AppendOnlyFedosConversationMessageEnvelopePersistence`'s
 * own NDJSON, insert-only, fail-closed-on-conflict convention.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPrivateNostrDeliveryRequestsAreEqual,
  type FedosPrivateNostrDeliveryRequest,
  type FedosPrivateNostrDeliveryRequestPersistence,
  type FedosPrivateNostrDeliveryRequestPersistenceWriteResult,
} from "./fedos_private_nostr_delivery_request.js";

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

function replayLog(filePath: string): FedosPrivateNostrDeliveryRequest[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPrivateNostrDeliveryRequest>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPrivateNostrDeliveryRequest;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPrivateNostrDeliveryRequestsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosPrivateNostrDeliveryRequestPersistence: conflicting duplicate records for id "${parsed.id}" found in log file.`);
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosPrivateNostrDeliveryRequestPersistence implements FedosPrivateNostrDeliveryRequestPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRequest(record: FedosPrivateNostrDeliveryRequest): FedosPrivateNostrDeliveryRequestPersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((r) => r.id === record.id) ?? null;
    if (existing !== null) {
      return fedosPrivateNostrDeliveryRequestsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRequest(id: string): FedosPrivateNostrDeliveryRequest | null {
    return replayLog(this.#filePath).find((r) => r.id === id) ?? null;
  }

  listRequestsForEnvelope(conversationId: string, envelopeId: string): readonly FedosPrivateNostrDeliveryRequest[] {
    return replayLog(this.#filePath).filter((r) => r.conversationId === conversationId && r.envelopeId === envelopeId);
  }
}
