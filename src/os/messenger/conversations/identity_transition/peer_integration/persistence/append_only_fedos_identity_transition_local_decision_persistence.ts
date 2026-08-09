/**
 * Secure Runtime Alpha 6121–6200 — Append-Only Local Decision
 * Persistence. Mirrors every other append-only backend in this domain.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosIdentityTransitionLocalDecisionFactV1,
  encodeFedosIdentityTransitionLocalDecisionFactV1,
  fedosIdentityTransitionLocalDecisionFactsAreEqual,
  fedosIdentityTransitionLocalDecisionKey,
  fedosIdentityTransitionLocalDecisionLineageKey,
  type FedosIdentityTransitionLocalDecisionFactV1,
  type FedosIdentityTransitionLocalDecisionPersistence,
} from "../../../../../../conversation/identity_transition/peer_integration/fedos_identity_transition_local_decision.js";
import type { FedosDeviceBindingAccountRef } from "../../../../../../device/fedos_device_binding.js";
import type { FedosIdentityTransitionExplicitLocalDecision } from "../../../../../../conversation/identity_transition/fedos_identity_transition_acceptance_state.js";

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

function replayLog(filePath: string): FedosIdentityTransitionLocalDecisionFactV1[] {
  const contents = readLogFile(filePath);
  const facts: FedosIdentityTransitionLocalDecisionFactV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosIdentityTransitionLocalDecisionFactV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosIdentityTransitionLocalDecisionPersistence: corrupt or schema-invalid record found in log file.");
    }
    facts.push(parsed);
  }
  return facts;
}

function latestOf(matches: readonly FedosIdentityTransitionLocalDecisionFactV1[]): FedosIdentityTransitionExplicitLocalDecision {
  if (matches.length === 0) return "none";
  const latest = matches.reduce((best, f) => (f.revision > best.revision ? f : best));
  return latest.decision === "defer" ? "none" : latest.decision;
}

export class AppendOnlyFedosIdentityTransitionLocalDecisionPersistence implements FedosIdentityTransitionLocalDecisionPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putDecision(fact: FedosIdentityTransitionLocalDecisionFactV1): "inserted" | "already-present" | "conflict" | "stale-revision" | "failed" {
    const existing = replayLog(this.#filePath);
    const existingByKey = existing.find((f) => fedosIdentityTransitionLocalDecisionKey(f) === fedosIdentityTransitionLocalDecisionKey(fact));
    if (existingByKey !== undefined) {
      return fedosIdentityTransitionLocalDecisionFactsAreEqual(existingByKey, fact) ? "already-present" : "conflict";
    }
    const lineage = existing.filter((f) => fedosIdentityTransitionLocalDecisionLineageKey(f) === fedosIdentityTransitionLocalDecisionLineageKey(fact));
    const maxRevision = lineage.reduce((max, f) => Math.max(max, f.revision), -1);
    if (fact.revision <= maxRevision) return "stale-revision";
    try {
      appendFileSync(this.#filePath, encodeFedosIdentityTransitionLocalDecisionFactV1(fact) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getLatestDecision(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionExplicitLocalDecision {
    const lineageKey = fedosIdentityTransitionLocalDecisionLineageKey({ localDeviceRef, peerAccountRef, peerDeviceRef, transitionId });
    const matches = replayLog(this.#filePath).filter((f) => fedosIdentityTransitionLocalDecisionLineageKey(f) === lineageKey);
    return latestOf(matches);
  }

  getLatestDecisionFact(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionLocalDecisionFactV1 | null {
    const lineageKey = fedosIdentityTransitionLocalDecisionLineageKey({ localDeviceRef, peerAccountRef, peerDeviceRef, transitionId });
    const matches = replayLog(this.#filePath).filter((f) => fedosIdentityTransitionLocalDecisionLineageKey(f) === lineageKey);
    if (matches.length === 0) return null;
    return matches.reduce((best, f) => (f.revision > best.revision ? f : best));
  }

  listDecisions(): readonly FedosIdentityTransitionLocalDecisionFactV1[] {
    return replayLog(this.#filePath);
  }
}
