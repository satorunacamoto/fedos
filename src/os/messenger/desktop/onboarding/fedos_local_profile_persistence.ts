/**
 * Secure Runtime Alpha 4661-4740 — Phase B: the durable port for the
 * NON-SECRET local profile descriptor, plus its in-memory (test) and
 * file-backed (repository-precedent) implementations.
 *
 * Mirrors `FileFedosSealedMasterSeedEnvelopePersistence`'s own established
 * discipline (Alpha 1266/1290): one file, structural fail-closed read,
 * `writeIfAbsent()` that NEVER overwrites, plus an explicit `update()` for
 * the ONE legitimate mutation this descriptor undergoes — advancing its
 * `initializationState`/`lastOpenedAt` (unlike the sealed-seed file, which
 * is truly write-once, the descriptor's coarse state legitimately advances
 * absent -> initializing -> ready across the profile's life).
 *
 * Duplicate semantics (Phase B):
 *   - `writeIfAbsent()` of an IDENTICAL descriptor to an already-occupied
 *     path returns `"already-exists"` (idempotent — no corruption).
 *   - `writeIfAbsent()` of a CONFLICTING descriptor to an occupied path
 *     ALSO returns `"already-exists"` (never silently overwrites) — the
 *     coordinator, not this port, decides whether a conflict is fatal.
 *   - A structurally-corrupt existing file makes `read()` THROW (fail
 *     closed — the coordinator maps this to `recovery-required`, never to
 *     a silent new profile).
 *
 * HARD GUARDRAILS:
 *   - No secret byte ever reaches this port — it moves only the non-secret
 *     descriptor JSON (`encode`/`decode`, `./fedos_local_profile_descriptor.ts`).
 *   - No GENERAL-PURPOSE delete method. FedOS Peer Device Discovery Arc P0
 *     Closure (Agent F) adds exactly ONE narrowly-scoped `delete()` — it
 *     removes only the ONE file this port was itself constructed against,
 *     nothing else, and is reachable ONLY through
 *     `FedosProfileInitializationCoordinator#resetInterruptedProfile()`'s
 *     own guarded reset path (never called directly by a renderer/IPC
 *     handler, never offered as a standalone "delete my profile" command).
 *     A profile is still never silently erased — see that method's own
 *     header for the guard and the required user confirmation step.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import {
  decodeFedosLocalProfileDescriptorV1,
  encodeFedosLocalProfileDescriptorV1,
  fedosLocalProfileDescriptorsIdentical,
  type FedosLocalProfileDescriptorV1,
} from "./fedos_local_profile_descriptor.js";

export type FedosLocalProfileWriteResult = "written" | "already-exists" | "failed";
export type FedosLocalProfileUpdateResult = "updated" | "not-found" | "failed";
/** FedOS Peer Device Discovery Arc P0 Closure (Agent F) — `"deleted"` whether or not a descriptor existed (idempotent), `"failed"` only on a real filesystem error. */
export type FedosLocalProfileDeleteResult = "deleted" | "failed";

/** Thrown by `read()` when a descriptor file exists but is not a well-formed descriptor — fail closed (Phase B corruption rule). */
export class FedosLocalProfileCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FedosLocalProfileCorruptError";
  }
}

export interface FedosLocalProfilePersistence {
  /** `null` when no profile has ever been written (an ordinary first-run state). THROWS `FedosLocalProfileCorruptError` if a file exists but is not a well-formed descriptor. */
  read(): FedosLocalProfileDescriptorV1 | null;
  /** NEVER overwrites — `"already-exists"` for any second write against an occupied slot (identical or conflicting alike). */
  writeIfAbsent(descriptor: FedosLocalProfileDescriptorV1): FedosLocalProfileWriteResult;
  /** Replaces an EXISTING descriptor (state advancement only). `"not-found"` if nothing was ever written. Never creates a new profile. */
  update(descriptor: FedosLocalProfileDescriptorV1): FedosLocalProfileUpdateResult;
  /** FedOS Peer Device Discovery Arc P0 Closure (Agent F) — deletes ONLY this port's own single descriptor. See this file's own header for the narrow reachability guarantee. Idempotent; never throws. */
  delete(): FedosLocalProfileDeleteResult;
}

/** In-memory backend — for tests and the transient first-run detection path. Holds one canonical encoded string; decodes on read so corruption semantics match the file backend exactly. */
export class InMemoryFedosLocalProfilePersistence implements FedosLocalProfilePersistence {
  #encoded: string | null = null;
  /** Test seam: inject a deliberately-corrupt raw string to exercise the fail-closed read path. */
  #corruptRaw: string | null = null;

  read(): FedosLocalProfileDescriptorV1 | null {
    if (this.#corruptRaw !== null) {
      const decoded = decodeFedosLocalProfileDescriptorV1(this.#corruptRaw);
      if (decoded === null) {
        throw new FedosLocalProfileCorruptError("InMemoryFedosLocalProfilePersistence: stored descriptor is corrupt.");
      }
      return decoded;
    }
    if (this.#encoded === null) return null;
    const decoded = decodeFedosLocalProfileDescriptorV1(this.#encoded);
    if (decoded === null) {
      throw new FedosLocalProfileCorruptError("InMemoryFedosLocalProfilePersistence: stored descriptor is corrupt.");
    }
    return decoded;
  }

  writeIfAbsent(descriptor: FedosLocalProfileDescriptorV1): FedosLocalProfileWriteResult {
    if (this.#encoded !== null || this.#corruptRaw !== null) return "already-exists";
    this.#encoded = encodeFedosLocalProfileDescriptorV1(descriptor);
    return "written";
  }

  update(descriptor: FedosLocalProfileDescriptorV1): FedosLocalProfileUpdateResult {
    if (this.#encoded === null) return "not-found";
    this.#encoded = encodeFedosLocalProfileDescriptorV1(descriptor);
    return "updated";
  }

  /** TEST-ONLY seam — plants a raw corrupt string so `read()` fails closed, mirroring a corrupt on-disk file. */
  plantCorruptForTest(raw: string): void {
    this.#corruptRaw = raw;
    this.#encoded = null;
  }

  delete(): FedosLocalProfileDeleteResult {
    this.#encoded = null;
    this.#corruptRaw = null;
    return "deleted";
  }
}

/** File-backed backend — one JSON file, mirroring `FileFedosSealedMasterSeedEnvelopePersistence`. Synchronous, like every other filesystem-backed port here. */
export class FileFedosLocalProfilePersistence implements FedosLocalProfilePersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  read(): FedosLocalProfileDescriptorV1 | null {
    if (!existsSync(this.#filePath)) return null;
    const contents = (readFileSync(this.#filePath, "utf8") as string).trim();
    const decoded = decodeFedosLocalProfileDescriptorV1(contents);
    if (decoded === null) {
      throw new FedosLocalProfileCorruptError(
        `FileFedosLocalProfilePersistence: file at "${this.#filePath}" exists but is not a well-formed local profile descriptor.`,
      );
    }
    return decoded;
  }

  writeIfAbsent(descriptor: FedosLocalProfileDescriptorV1): FedosLocalProfileWriteResult {
    if (existsSync(this.#filePath)) return "already-exists";
    try {
      mkdirSync(dirname(this.#filePath), { recursive: true });
      writeFileSync(this.#filePath, encodeFedosLocalProfileDescriptorV1(descriptor), "utf8");
    } catch {
      return "failed";
    }
    return "written";
  }

  update(descriptor: FedosLocalProfileDescriptorV1): FedosLocalProfileUpdateResult {
    if (!existsSync(this.#filePath)) return "not-found";
    try {
      writeFileSync(this.#filePath, encodeFedosLocalProfileDescriptorV1(descriptor), "utf8");
    } catch {
      return "failed";
    }
    return "updated";
  }

  /** FedOS Peer Device Discovery Arc P0 Closure (Agent F) — deletes ONLY `this.#filePath` (the ONE file this instance was constructed against). Idempotent: a missing file is `"deleted"`, not `"failed"`. */
  delete(): FedosLocalProfileDeleteResult {
    try {
      if (existsSync(this.#filePath)) {
        unlinkSync(this.#filePath);
      }
      return "deleted";
    } catch {
      return "failed";
    }
  }
}

/**
 * Classifies a would-be second write against an already-present descriptor:
 * `"identical-duplicate"` (idempotent, safe) vs `"conflicting-duplicate"`
 * (a different profile at the same slot — the coordinator treats this as a
 * refusal, never an overwrite). Pure helper; reads nothing.
 */
export function classifyFedosLocalProfileDuplicate(
  existing: FedosLocalProfileDescriptorV1,
  candidate: FedosLocalProfileDescriptorV1,
): "identical-duplicate" | "conflicting-duplicate" {
  return fedosLocalProfileDescriptorsIdentical(existing, candidate)
    ? "identical-duplicate"
    : "conflicting-duplicate";
}
