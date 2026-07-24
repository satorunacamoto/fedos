/**
 * Secure Runtime Alpha 6121–6200 — Append-Only Manual Verification Fact
 * Persistence. Mirrors every other append-only backend in this domain.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosIdentityTransitionManualVerificationFactV1,
  encodeFedosIdentityTransitionManualVerificationFactV1,
  fedosIdentityTransitionManualVerificationKey,
  fedosIdentityTransitionManualVerificationLineageKey,
  fedosIdentityTransitionManualVerificationFactsAreEqual,
  type FedosIdentityTransitionManualVerificationFactV1,
  type FedosIdentityTransitionManualVerificationPersistence,
} from "../fedos_identity_transition_manual_verification.js";
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";

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

function replayLog(filePath: string): FedosIdentityTransitionManualVerificationFactV1[] {
  const contents = readLogFile(filePath);
  const facts: FedosIdentityTransitionManualVerificationFactV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosIdentityTransitionManualVerificationFactV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosIdentityTransitionManualVerificationPersistence: corrupt or schema-invalid record found in log file.");
    }
    facts.push(parsed);
  }
  return facts;
}

export class AppendOnlyFedosIdentityTransitionManualVerificationPersistence implements FedosIdentityTransitionManualVerificationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putFact(fact: FedosIdentityTransitionManualVerificationFactV1): "inserted" | "already-present" | "conflict" | "stale-revision" | "failed" {
    const existing = replayLog(this.#filePath);
    const sameKey = existing.find((f) => fedosIdentityTransitionManualVerificationKey(f) === fedosIdentityTransitionManualVerificationKey(fact));
    if (sameKey !== undefined) {
      return fedosIdentityTransitionManualVerificationFactsAreEqual(sameKey, fact) ? "already-present" : "conflict";
    }
    const lineage = existing.filter((f) => fedosIdentityTransitionManualVerificationLineageKey(f) === fedosIdentityTransitionManualVerificationLineageKey(fact));
    const maxRevision = lineage.reduce((max, f) => Math.max(max, f.revision), -1);
    if (fact.revision <= maxRevision) return "stale-revision";
    try {
      appendFileSync(this.#filePath, encodeFedosIdentityTransitionManualVerificationFactV1(fact) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getLatestFact(localDeviceRef: string, verifierAccountRef: FedosDeviceBindingAccountRef, transitionId: string): FedosIdentityTransitionManualVerificationFactV1 | null {
    const lineageKey = JSON.stringify([localDeviceRef, verifierAccountRef.authority, verifierAccountRef.publicIdentifier, verifierAccountRef.identityId, transitionId]);
    const matches = replayLog(this.#filePath).filter((f) => fedosIdentityTransitionManualVerificationLineageKey(f) === lineageKey);
    if (matches.length === 0) return null;
    return matches.reduce((latest, f) => (f.revision > latest.revision ? f : latest));
  }

  listFacts(): readonly FedosIdentityTransitionManualVerificationFactV1[] {
    return replayLog(this.#filePath);
  }
}
