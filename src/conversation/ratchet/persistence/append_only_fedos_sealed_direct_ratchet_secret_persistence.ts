/**
 * Secure Runtime Alpha 5401-5480 — Phase G: the append-only, durable
 * `FedosSealedDirectRatchetSecretPersistence` backend. NDJSON, one
 * `FedosSealedDirectRatchetSecretRecordV1` per line, insert-only --
 * mirrors `AppendOnlyFedosDirectRatchetSessionPersistence`'s own
 * fail-closed replay discipline exactly (a malformed/unrecognized line,
 * or a conflicting duplicate key, THROWS on replay). No plaintext secret
 * byte is ever written to this file -- every record's own `sealedBlob`
 * field is already opaque, Rust-produced ciphertext
 * (`../fedos_sealed_direct_ratchet_secret_record.ts`'s own header).
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosSealedDirectRatchetSecretRecordKey,
  isWellFormedFedosSealedDirectRatchetSecretRecordV1,
  type FedosSealedDirectRatchetSecretRecordV1,
} from "../fedos_sealed_direct_ratchet_secret_record.js";
import type {
  FedosSealedDirectRatchetSecretPersistence,
  FedosSealedDirectRatchetSecretPersistenceWriteResult,
} from "./fedos_sealed_direct_ratchet_secret_persistence.js";

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

function recordsAreIdenticalByValue(
  a: FedosSealedDirectRatchetSecretRecordV1,
  b: FedosSealedDirectRatchetSecretRecordV1,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function replayLog(filePath: string): FedosSealedDirectRatchetSecretRecordV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosSealedDirectRatchetSecretRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error("AppendOnlyFedosSealedDirectRatchetSecretPersistence: malformed line found in log file.");
    }
    if (!isWellFormedFedosSealedDirectRatchetSecretRecordV1(parsed)) {
      throw new Error("AppendOnlyFedosSealedDirectRatchetSecretPersistence: malformed line found in log file.");
    }
    const key = fedosSealedDirectRatchetSecretRecordKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!recordsAreIdenticalByValue(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosSealedDirectRatchetSecretPersistence: conflicting duplicate records for key "${key}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosSealedDirectRatchetSecretPersistence implements FedosSealedDirectRatchetSecretPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putSealedSecret(record: FedosSealedDirectRatchetSecretRecordV1): FedosSealedDirectRatchetSecretPersistenceWriteResult {
    const key = fedosSealedDirectRatchetSecretRecordKey(record);
    const existing = this.getSealedSecret(key);
    if (existing !== null) {
      return recordsAreIdenticalByValue(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "written";
  }

  getSealedSecret(recordKey: string): FedosSealedDirectRatchetSecretRecordV1 | null {
    return this.listSealedSecrets().find((record) => fedosSealedDirectRatchetSecretRecordKey(record) === recordKey) ?? null;
  }

  listSealedSecrets(): readonly FedosSealedDirectRatchetSecretRecordV1[] {
    return replayLog(this.#filePath);
  }
}
