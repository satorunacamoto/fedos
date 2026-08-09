/**
 * Secure Runtime Alpha 4901-4980 — Phase D: `FedosDesktopSettingsController`.
 *
 * The desktop-facing controller over the framework-neutral
 * `FedosSettingsAuthority` (`../../settings/fedos_settings_authority.ts`).
 * It owns exactly the SIX operations Phase D names — `load` / `save` /
 * `reset` / `validate` / `export` / `import` — delegating each to the
 * authority one-for-one and adding NO business rule of its own. It imports
 * NO Electron, NO renderer, NO Shell, NO Runtime, NO crypto — it is a pure
 * seam between the presentation layer and the settings domain.
 *
 * Two factories mirror the onboarding persistence precedent exactly:
 *   - `createFileBackedFedosDesktopSettingsController(filePath)` — the real,
 *     durable path (one JSON file, `FileFedosSettingsPersistence`, the SAME
 *     file-backed pattern `FileFedosLocalProfilePersistence` established).
 *   - `createInMemoryFedosDesktopSettingsController()` — the transient/test
 *     path.
 *
 * `fedosDesktopSettingsFilePath(root)` derives the ONE settings file leaf
 * from a profile root deterministically (a fixed `settings.json` segment
 * joined to the caller-supplied absolute root) — never interpolating any
 * caller string into a subpath, mirroring `planFedosLocalProfilePaths`'s own
 * no-traversal discipline. It is additive: it does NOT modify
 * `fedos_local_profile_paths.ts`.
 */

// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join, isAbsolute } from "node:path";
import type { FedosSettingsDescriptorV1 } from "../../../../settings/fedos_settings_descriptor.js";
import {
  FedosSettingsAuthority,
  type FedosSettingsResult,
} from "../../../../settings/fedos_settings_authority.js";
import {
  FileFedosSettingsPersistence,
  InMemoryFedosSettingsPersistence,
  type FedosSettingsPersistence,
} from "../../../../settings/fedos_settings_persistence.js";

/** Derives the deterministic `settings.json` leaf under a profile root, or `null` if the root is not an absolute path. Pure; creates no file. */
export function fedosDesktopSettingsFilePath(root: string): string | null {
  if (typeof root !== "string" || root.length === 0) return null;
  if (!isAbsolute(root)) return null;
  return join(root, "settings.json");
}

export class FedosDesktopSettingsController {
  readonly #authority: FedosSettingsAuthority;

  constructor(persistence: FedosSettingsPersistence) {
    this.#authority = new FedosSettingsAuthority(persistence);
  }

  load(): FedosSettingsResult<FedosSettingsDescriptorV1> {
    return this.#authority.load();
  }

  save(candidate: unknown): FedosSettingsResult<FedosSettingsDescriptorV1> {
    return this.#authority.save(candidate);
  }

  reset(): FedosSettingsResult<FedosSettingsDescriptorV1> {
    return this.#authority.reset();
  }

  validate(candidate: unknown): FedosSettingsResult<FedosSettingsDescriptorV1> {
    return this.#authority.validate(candidate);
  }

  export(): FedosSettingsResult<string> {
    return this.#authority.export();
  }

  import(serialized: unknown): FedosSettingsResult<FedosSettingsDescriptorV1> {
    return this.#authority.import(serialized);
  }
}

/** Real, durable controller over one JSON file. */
export function createFileBackedFedosDesktopSettingsController(filePath: string): FedosDesktopSettingsController {
  return new FedosDesktopSettingsController(new FileFedosSettingsPersistence(filePath));
}

/** Transient/test controller. */
export function createInMemoryFedosDesktopSettingsController(): FedosDesktopSettingsController {
  return new FedosDesktopSettingsController(new InMemoryFedosSettingsPersistence());
}
