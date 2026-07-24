/**
 * Secure Runtime Alpha 7641-7720 (FedOS Delivery Observation Repository
 * Subject Index and Query Scalability Arc) — Phase L: structural
 * guards, proving by direct source/diff inspection what this Arc
 * actually built and did NOT touch.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";
// @ts-expect-error see above.
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "1e79c831";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

function porcelainStatus(): string {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_STATUS_FAILED";
  }
}

describe("Secure Runtime Alpha 7641-7720 -- structural guards", () => {
  it("1. per-subject queries use the derived index, not a repeated full-log scan -- historyFor() calls listForSubject(), never list()+filter()", () => {
    const querySource = stripComments(read("src/board/observation/fedos_delivery_observation_query.ts"));
    expect(querySource).toMatch(/historyFor\(subjectId: FedosDeliveryObservationSubjectId\)[\s\S]{0,120}return \[\.\.\.this\.#repository\.listForSubject\(subjectId\)\]\.sort\(compareByObservedAtThenId\);/);
    expect(querySource).not.toMatch(/historyFor[\s\S]{0,10}\.list\(\)\s*\n?\s*\.filter/);
  });

  it("2. listByState() and list() are BYTE-FOR-BYTE UNCHANGED -- the genuinely cross-subject full-scan path is preserved, not removed", () => {
    const querySource = stripComments(read("src/board/observation/fedos_delivery_observation_query.ts"));
    expect(querySource).toMatch(/listByState\(state: FedosDeliveryObservation\["state"\]\): readonly FedosDeliveryObservation\[\] \{\s*return this\.#repository\s*\.list\(\)\s*\.filter\(\(observation\) => observation\.state === state\)\s*\.sort\(compareByObservedAtThenId\);\s*\}/);
    const repositorySource = stripComments(read("src/board/observation/fedos_delivery_observation_repository.ts"));
    expect(repositorySource).toMatch(/list\(\): readonly FedosDeliveryObservation\[\] \{\s*const observations: FedosDeliveryObservation\[\] = \[\];\s*for \(const record of this\.#persistence\.listObservations\(\)\) \{\s*const observation = deserializeFedosDeliveryObservation\(record\);\s*if \(observation !== null\) observations\.push\(observation\);\s*\}\s*return observations;\s*\}/);
  });

  it("3. the durable FedosDeliveryObservationPersistence remains the sole source of truth -- the new index is never serialized, never itself read back from disk, and is rebuilt from persistence at every construction", () => {
    const repositorySource = stripComments(read("src/board/observation/fedos_delivery_observation_repository.ts"));
    expect(repositorySource).toMatch(/constructor\(persistence: FedosDeliveryObservationPersistence\) \{\s*this\.#persistence = persistence;\s*for \(const record of this\.#persistence\.listObservations\(\)\)/);
    // The index is never written to any file, never passed to JSON.stringify, never given its own persistence port.
    expect(repositorySource).not.toMatch(/JSON\.stringify\(this\.#bySubject/);
    expect(repositorySource).not.toMatch(/writeFileSync|appendFileSync/);
  });

  it("4. no persistent secondary index -- #bySubject is a private, in-memory-only field; no new persistence port, no new file format, no new schema version anywhere in this Arc's own diff", () => {
    expect(diffNames("src/board/observation/fedos_delivery_observation_persistence.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/in_memory_fedos_delivery_observation_persistence.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/append_only_fedos_delivery_observation_persistence.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation_codec.ts").trim()).toBe("");
  });

  it("5. no lossy compaction -- record() never removes, rewrites, or drops a durable fact; the index only ever grows on a successful new write, never shrinks", () => {
    const repositorySource = stripComments(read("src/board/observation/fedos_delivery_observation_repository.ts"));
    expect(repositorySource).not.toMatch(/\.delete\(|\.splice\(|\.pop\(|\.shift\(/);
  });

  it("6. no delivery semantics change -- FedosDeliveryObservationState, the transition graph, and the write validator are ALL untouched", () => {
    expect(diffNames("src/board/observation/fedos_delivery_observation.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation_transition_graph.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation_write_validator.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_retry_query.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_retry_registry.ts").trim()).toBe("");
  });

  it("7. no removal of receiver-side dedup -- the NIP-17 inbound import coordinator and recipient-side dedup machinery are completely untouched", () => {
    expect(diffNames("src/conversation/delivery/nostr/nip17").trim()).toBe("");
    expect(diffNames("src/nostr").trim()).toBe("");
  });

  it("8. Board and Conversation share this Arc's own fix safely -- neither the Board Outbox/Scheduler nor the Conversation Outbox/Scheduler/Transport files were touched; only the shared Observation Repository/Query changed", () => {
    expect(diffNames("src/board/outbox").trim()).toBe("");
    expect(diffNames("src/conversation/transport").trim()).toBe("");
    expect(diffNames("src/desktop/host/fedos_delivery_recovery_hydration.ts").trim()).toBe("");
    expect(diffNames("src/desktop/runtime/fedos_desktop_runtime.ts").trim()).toBe("");
  });

  it("9. no Archive/Retention/Deletion file of any kind was touched -- this Arc's own domain boundary from the sibling parallel Arc B", () => {
    expect(diffNames("src/conversation/archive").trim()).toBe("");
    expect(diffNames("src/conversation/retention").trim()).toBe("");
    expect(diffNames("src/conversation/deletion").trim()).toBe("");
    expect(diffNames("src/desktop/presentation/safety_center").trim()).toBe("");
  });

  it("10. no new transport protocol, no new NIP, no new crypto -- zero Rust/Cargo/WASM diff, zero Ratchet/Identity Transition diff", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet").trim()).toBe("");
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
  });

  it("11. no second Observation Repository or second Query class -- exactly one of each in production source", () => {
    const repositorySource = read("src/board/observation/fedos_delivery_observation_repository.ts");
    expect((repositorySource.match(/export class FedosDeliveryObservationRepository\b/g) ?? []).length).toBe(1);
    const querySource = read("src/board/observation/fedos_delivery_observation_query.ts");
    expect((querySource.match(/export class FedosDeliveryObservationQuery\b/g) ?? []).length).toBe(1);
    const diffFileList = diffNames()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    expect(diffFileList.filter((f) => /_repository_v2|_repository2|_query_v2|_query2/.test(f))).toEqual([]);
  });

  it("12. zero p2p/ or .tmp_gen/ changes -- this Arc's own worktree never touches either directory", () => {
    expect(diffNames("p2p").trim()).toBe("");
    expect(diffNames(".tmp_gen").trim()).toBe("");
    const status = porcelainStatus();
    expect(status).not.toMatch(/(^| )p2p\//m);
    expect(status).not.toMatch(/\.tmp_gen\//);
  });

  it("13. this Arc's own required production files are present in the diff against its own base commit, and nothing under Archive/Retention/Deletion/Outbox/Scheduler/p2p/.tmp_gen appears anywhere in the FULL diff (not just the spot-checked paths above)", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (const required of [
      "src/board/observation/fedos_delivery_observation_repository.ts",
      "src/board/observation/fedos_delivery_observation_query.ts",
    ]) {
      expect(modifiedLines, `required file missing from diff: ${required}`).toContain(required);
    }
    const forbiddenPrefixes = [
      "src/conversation/archive/",
      "src/conversation/retention/",
      "src/conversation/deletion/",
      "src/desktop/presentation/safety_center/",
      "src/board/outbox/",
      "src/conversation/transport/",
      "src/device/relay_sync/",
      "src/device/sync_scheduler/",
      "src/conversation/ratchet/",
      "src/conversation/identity_transition/",
      "packages/fedos-core-rust/",
      "p2p/",
      ".tmp_gen/",
    ];
    for (const line of modifiedLines) {
      for (const prefix of forbiddenPrefixes) {
        expect(line.startsWith(prefix), `unexpected diff under a protected/prohibited domain: ${line}`).toBe(false);
      }
    }
  });
});
