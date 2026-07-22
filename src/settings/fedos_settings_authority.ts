/**
 * Secure Runtime Alpha 4901-4980 — Phase B: the ONE settings authority.
 *
 * `FedosSettingsAuthority` composes the descriptor vocabulary, validator,
 * codec, and persistence port into the single durable, fail-closed surface
 * every higher layer (the desktop Controller, the ViewModel, the Host
 * Bridge) sits on top of. It owns NO framework concern, NO Electron import,
 * NO renderer, NO crypto — only load / save / reset / export / import over
 * one injected `FedosSettingsPersistence`.
 *
 * Every method returns a closed, coarse `FedosSettingsResult<T>` — mirrors
 * `FedosDesktopShellResult`'s own `{outcome:"ok",value} | {outcome,reason}`
 * ethos so the layers above can map it straight onto their own vocabularies
 * without re-deriving anything. NEVER throws, NEVER returns a raw `Error`,
 * a stack, or a partially-applied descriptor.
 *
 * Fail-closed semantics (Phase H):
 *   - `load()` of a corrupt/tampered file → `{outcome:"corrupt"}` (never a
 *     silently-defaulted descriptor). `load()` on first run → the canonical
 *     default, persisted so the next load is stable.
 *   - `save()`/`import()` of an invalid candidate → `{outcome:"invalid",
 *     errors}` and NOTHING is written (fail closed — the durable value is
 *     never left half-updated).
 */

import {
  defaultFedosSettingsDescriptorV1,
  type FedosSettingsDescriptorV1,
} from "./fedos_settings_descriptor.js";
import {
  fedosSettingsValidationErrors,
  isWellFormedFedosSettingsDescriptorV1,
  type FedosSettingsValidationErrorCode,
} from "./fedos_settings_validator.js";
import {
  decodeFedosSettingsDescriptorV1,
  encodeFedosSettingsDescriptorV1,
} from "./fedos_settings_codec.js";
import {
  FedosSettingsCorruptError,
  type FedosSettingsPersistence,
} from "./fedos_settings_persistence.js";

export type FedosSettingsOutcome = "ok" | "invalid" | "corrupt" | "failed";

export type FedosSettingsResult<T> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "invalid"; readonly reason: string; readonly errors: readonly FedosSettingsValidationErrorCode[] }
  | { readonly outcome: "corrupt"; readonly reason: string }
  | { readonly outcome: "failed"; readonly reason: string };

function ok<T>(value: T): FedosSettingsResult<T> {
  return Object.freeze({ outcome: "ok", value });
}
function invalid<T = never>(errors: readonly FedosSettingsValidationErrorCode[]): FedosSettingsResult<T> {
  return Object.freeze({ outcome: "invalid", reason: "settings failed validation", errors: Object.freeze([...errors]) });
}
function corrupt<T = never>(): FedosSettingsResult<T> {
  return Object.freeze({ outcome: "corrupt", reason: "stored settings are not a well-formed descriptor" });
}
function failed<T = never>(reason: string): FedosSettingsResult<T> {
  return Object.freeze({ outcome: "failed", reason });
}

export class FedosSettingsAuthority {
  readonly #persistence: FedosSettingsPersistence;

  constructor(persistence: FedosSettingsPersistence) {
    this.#persistence = persistence;
  }

  /**
   * Loads the durable settings. On first run (nothing persisted) writes and
   * returns the canonical default. On a corrupt/tampered file returns
   * `{outcome:"corrupt"}` — NEVER a silent default (that would mask
   * tampering). Never throws.
   */
  load(): FedosSettingsResult<FedosSettingsDescriptorV1> {
    let existing: FedosSettingsDescriptorV1 | null;
    try {
      existing = this.#persistence.read();
    } catch (error) {
      if (error instanceof FedosSettingsCorruptError) return corrupt();
      return failed("settings read failed");
    }
    if (existing !== null) return ok(existing);

    // First run — persist the canonical default so the next load is stable.
    const fallback = defaultFedosSettingsDescriptorV1();
    const write = this.#persistence.write(fallback);
    if (write !== "written") return failed("initial settings write failed");
    return ok(fallback);
  }

  /**
   * Validates then durably writes a candidate descriptor. An invalid
   * candidate writes NOTHING and returns `{outcome:"invalid",errors}` (fail
   * closed). Returns the re-decoded, canonical stored value on success.
   */
  save(candidate: unknown): FedosSettingsResult<FedosSettingsDescriptorV1> {
    const errors = fedosSettingsValidationErrors(candidate);
    if (errors.length > 0) return invalid(errors);
    const descriptor = candidate as FedosSettingsDescriptorV1;
    const write = this.#persistence.write(descriptor);
    if (write !== "written") return failed("settings write failed");
    return ok(descriptor);
  }

  /** Restores and persists the canonical default. Never an erase — a `write()` of the default (Phase H "reset"). */
  reset(): FedosSettingsResult<FedosSettingsDescriptorV1> {
    const fallback = defaultFedosSettingsDescriptorV1();
    const write = this.#persistence.write(fallback);
    if (write !== "written") return failed("settings reset write failed");
    return ok(fallback);
  }

  /** Pure structural validation of a candidate — no persistence side effect (Phase D `validate()`). */
  validate(candidate: unknown): FedosSettingsResult<FedosSettingsDescriptorV1> {
    const errors = fedosSettingsValidationErrors(candidate);
    if (errors.length > 0) return invalid(errors);
    return ok(candidate as FedosSettingsDescriptorV1);
  }

  /**
   * Exports the CURRENT durable settings as the ONE canonical JSON string
   * (Phase D `export()`). Fails closed to `corrupt` if the stored value is
   * corrupt (never exports a fabricated/defaulted value in that case). Note:
   * export reflects what is DURABLE, so it never invents content.
   */
  export(): FedosSettingsResult<string> {
    let existing: FedosSettingsDescriptorV1 | null;
    try {
      existing = this.#persistence.read();
    } catch (error) {
      if (error instanceof FedosSettingsCorruptError) return corrupt();
      return failed("settings read failed");
    }
    const descriptor = existing ?? defaultFedosSettingsDescriptorV1();
    return ok(encodeFedosSettingsDescriptorV1(descriptor));
  }

  /**
   * Imports settings from a serialized JSON string (Phase D `import()`):
   * decode → validate → persist. A malformed/tampered string decodes to
   * `null` and returns `{outcome:"invalid"}` writing NOTHING (fail closed).
   */
  import(serialized: unknown): FedosSettingsResult<FedosSettingsDescriptorV1> {
    const decoded = decodeFedosSettingsDescriptorV1(serialized);
    if (decoded === null) {
      // Distinguish "not even a string / unparseable" from "parsed but invalid" only at the coarse level.
      if (typeof serialized === "string") {
        // Try to surface field-level errors when the string parsed but failed validation.
        try {
          const parsed = JSON.parse(serialized) as unknown;
          const errors = fedosSettingsValidationErrors(parsed);
          if (errors.length > 0) return invalid(errors);
        } catch {
          /* fall through to generic invalid */
        }
      }
      return invalid(["not-an-object"]);
    }
    if (!isWellFormedFedosSettingsDescriptorV1(decoded)) return invalid(fedosSettingsValidationErrors(decoded));
    const write = this.#persistence.write(decoded);
    if (write !== "written") return failed("settings import write failed");
    return ok(decoded);
  }
}
