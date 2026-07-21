/**
 * Secure Runtime Alpha 4901-4980 — Phase B: the durable port for the
 * NON-SECRET settings descriptor, plus its in-memory (test) and file-backed
 * (repository-precedent) implementations.
 *
 * REUSES the file-backed pattern established by
 * `FileFedosLocalProfilePersistence`
 * (`src/desktop/onboarding/fedos_local_profile_persistence.ts`, Alpha
 * 4661-4740) — one JSON file, synchronous `fs`, structural fail-closed
 * `read()` that THROWS on a corrupt file (never silently defaults),
 * `mkdirSync(dirname, {recursive:true})` before write. This Arc adds NO new
 * persistence mechanism (Phase B: "reuse the existing persistence
 * approach") — the ONE difference from the profile port is intentional and
 * documented: settings are user-editable, so this port exposes an
 * overwriting `write()` (upsert) rather than the profile's write-once
 * `writeIfAbsent()`. A profile descriptor is created once; settings change
 * every time the user hits Save. There is still NO delete method — `reset()`
 * is a `write()` of the default descriptor, never an erase.
 *
 * HARD GUARDRAILS:
 *   - No secret byte ever reaches this port — only the non-secret settings
 *     JSON (`encode/decode`, `./fedos_settings_codec.ts`).
 *   - A structurally-corrupt existing file makes `read()` THROW
 *     `FedosSettingsCorruptError` (fail closed) — the authority maps this to
 *     a closed "corrupt" outcome, never to a silent default.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { dirname } from "node:path";
import {
  decodeFedosSettingsDescriptorV1,
  encodeFedosSettingsDescriptorV1,
} from "./fedos_settings_codec.js";
import type { FedosSettingsDescriptorV1 } from "./fedos_settings_descriptor.js";

export type FedosSettingsWriteResult = "written" | "failed";

/** Thrown by `read()` when a settings file exists but is not a well-formed descriptor — fail closed (Phase H corruption/tamper rule). */
export class FedosSettingsCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FedosSettingsCorruptError";
  }
}

export interface FedosSettingsPersistence {
  /** `null` when no settings have ever been written (first-run). THROWS `FedosSettingsCorruptError` if a file exists but is not a well-formed descriptor. */
  read(): FedosSettingsDescriptorV1 | null;
  /** Upsert — writes (overwriting any prior value) the descriptor. Returns `"failed"` on any filesystem error, never throws. */
  write(descriptor: FedosSettingsDescriptorV1): FedosSettingsWriteResult;
}

/** In-memory backend — for tests and any transient path. Holds one canonical encoded string; decodes on read so corruption semantics match the file backend exactly. */
export class InMemoryFedosSettingsPersistence implements FedosSettingsPersistence {
  #encoded: string | null = null;
  #corruptRaw: string | null = null;

  read(): FedosSettingsDescriptorV1 | null {
    if (this.#corruptRaw !== null) {
      const decoded = decodeFedosSettingsDescriptorV1(this.#corruptRaw);
      if (decoded === null) {
        throw new FedosSettingsCorruptError("InMemoryFedosSettingsPersistence: stored settings are corrupt.");
      }
      return decoded;
    }
    if (this.#encoded === null) return null;
    const decoded = decodeFedosSettingsDescriptorV1(this.#encoded);
    if (decoded === null) {
      throw new FedosSettingsCorruptError("InMemoryFedosSettingsPersistence: stored settings are corrupt.");
    }
    return decoded;
  }

  write(descriptor: FedosSettingsDescriptorV1): FedosSettingsWriteResult {
    this.#corruptRaw = null;
    this.#encoded = encodeFedosSettingsDescriptorV1(descriptor);
    return "written";
  }

  /** TEST-ONLY seam — plants a raw corrupt string so `read()` fails closed, mirroring a corrupt/tampered on-disk file. */
  plantCorruptForTest(raw: string): void {
    this.#corruptRaw = raw;
    this.#encoded = null;
  }
}

/** File-backed backend — one JSON file, mirroring `FileFedosLocalProfilePersistence`. Synchronous, like every other filesystem-backed port here. */
export class FileFedosSettingsPersistence implements FedosSettingsPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  read(): FedosSettingsDescriptorV1 | null {
    if (!existsSync(this.#filePath)) return null;
    const contents = (readFileSync(this.#filePath, "utf8") as string).trim();
    const decoded = decodeFedosSettingsDescriptorV1(contents);
    if (decoded === null) {
      throw new FedosSettingsCorruptError(
        `FileFedosSettingsPersistence: file at "${this.#filePath}" exists but is not a well-formed settings descriptor.`,
      );
    }
    return decoded;
  }

  write(descriptor: FedosSettingsDescriptorV1): FedosSettingsWriteResult {
    try {
      mkdirSync(dirname(this.#filePath), { recursive: true });
      writeFileSync(this.#filePath, encodeFedosSettingsDescriptorV1(descriptor), "utf8");
    } catch {
      return "failed";
    }
    return "written";
  }
}
