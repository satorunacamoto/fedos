/**
 * FedOS Identity Transition Foundation Arc — Append-Only Transition Fact
 * Persistence. Mirrors
 * `../../ratchet/peer_capability/persistence/append_only_fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption (one unparseable line
 * throws unconditionally), zero new dependency, no compaction/delete/
 * rewrite. This is what gives restart replay (Phase P step 12/13): a fact
 * recorded before a restart is still on file after, because `listFacts()`
 * replays this same log.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import { decodeFedosIdentityTransitionFactV1, encodeFedosIdentityTransitionFactV1, fedosIdentityTransitionFactKey, fedosIdentityTransitionLineageKeyParts, type FedosIdentityTransitionFactV1 } from "../fedos_identity_transition_fact.js";
import { determineFedosIdentityTransitionFactWriteOutcome, type FedosIdentityTransitionFactWriteOutcome } from "../fedos_identity_transition_fact_conflict_detection.js";
import type { FedosIdentityTransitionFactPersistence } from "./fedos_identity_transition_fact_persistence.js";

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

/** PRIVATE — replays the append log in file order. A parse/schema failure throws unconditionally (fail-closed on corruption); an interrupted final write is tolerated by skipping only a truly empty trailing line, never a partially-written non-empty one (that IS a corruption and must throw). */
function replayLog(filePath: string): FedosIdentityTransitionFactV1[] {
  const contents = readLogFile(filePath);
  const facts: FedosIdentityTransitionFactV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosIdentityTransitionFactV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosIdentityTransitionFactPersistence: corrupt or schema-invalid record found in log file.");
    }
    facts.push(parsed);
  }
  return facts;
}

export class AppendOnlyFedosIdentityTransitionFactPersistence implements FedosIdentityTransitionFactPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putFact(fact: FedosIdentityTransitionFactV1): FedosIdentityTransitionFactWriteOutcome {
    const existing = replayLog(this.#filePath);
    const outcome = determineFedosIdentityTransitionFactWriteOutcome(existing, fact);
    if (outcome !== "inserted") return outcome;
    try {
      appendFileSync(this.#filePath, encodeFedosIdentityTransitionFactV1(fact) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listFacts(): readonly FedosIdentityTransitionFactV1[] {
    return replayLog(this.#filePath);
  }

  getFact(transitionId: string): FedosIdentityTransitionFactV1 | null {
    return replayLog(this.#filePath).find((f) => fedosIdentityTransitionFactKey(f) === transitionId) ?? null;
  }

  listLineage(oldAccountAuthority: string, oldAccountPublicIdentifier: string, oldAccountIdentityId: string | null): readonly FedosIdentityTransitionFactV1[] {
    const key = fedosIdentityTransitionLineageKeyParts(oldAccountAuthority, oldAccountPublicIdentifier, oldAccountIdentityId);
    return replayLog(this.#filePath).filter(
      (f) => fedosIdentityTransitionLineageKeyParts(f.oldAccountIdentity.authority, f.oldAccountIdentity.publicIdentifier, f.oldAccountIdentity.identityId) === key,
    );
  }
}
