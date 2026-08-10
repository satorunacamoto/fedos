/**
 * Trust — offline issuer secret-loading boundary.
 *
 * Follows the injected-provider discipline established by
 * `src/os/core/vault/wasm/fedos_passphrase_provider.ts` (a narrow injected
 * boundary between "something obtains a secret" and "the caller uses it
 * ephemerally") — applied here to the offline issuer's own signing key
 * instead of a vault passphrase.
 *
 * HARD RULES (mirrors that file's own guardrails):
 *   - The core issuer logic (`fedos_trust_issuer_cli_core.ts`) never reads
 *     `process.env`, a CLI argument, or any file path itself — it only ever
 *     asks an INJECTED `FedosTrustIssuerSecretProvider`, at the moment of
 *     use.
 *   - A raw secret is NEVER accepted as a CLI argument (visible in shell
 *     history, `ps`/Task Manager process listings, and most shell/terminal
 *     logs) — only a FILE PATH is, and only via an env var, never a
 *     positional/flag argument either (env vars are still visible to
 *     `ps`/`/proc` on some platforms, but meaningfully less exposed than an
 *     argv entry logged by a shell history file or a CI transcript).
 *   - `FEDOS_ISSUER_KEY_FILE` (or whatever env var name is configured)
 *     holds a PATH, never the secret's bytes/hex directly.
 *   - The file this env var points to (the operator's actual issuer key
 *     file) must NEVER be committed to this repository and must never be
 *     logged. It lives entirely outside version control, at a path the
 *     operator chooses (see `docs/operations/` for the runbook once
 *     written).
 *   - Callers must zero/discard the returned buffer after use where
 *     feasible.
 */

import { readFileSync } from "node:fs";
import { parseFedosTrustIssuerSecretFromFileStorage } from "./fedos_trust_issuer_keypair.js";

export interface FedosTrustIssuerSecretProvider {
  /** Loads the issuer's raw 32-byte secret key. Throws if unavailable —
   * there is no silent "no key" case for an offline issuer operation, since
   * every subcommand that needs a key genuinely cannot proceed without one. */
  loadSecretKeyBytes(): Uint8Array;
}

/** The one real implementation this module ships: reads the key file path
 * from an env var (default `FEDOS_ISSUER_KEY_FILE`), then reads and parses
 * that file's hex contents. The env var never holds the secret itself —
 * only a path to a file the operator manages entirely outside this repo. */
export class FedosTrustIssuerEnvFileSecretProvider implements FedosTrustIssuerSecretProvider {
  readonly #envVarName: string;

  constructor(envVarName: string = "FEDOS_ISSUER_KEY_FILE") {
    this.#envVarName = envVarName;
  }

  loadSecretKeyBytes(): Uint8Array {
    const keyFilePath = process.env[this.#envVarName];
    if (keyFilePath === undefined || keyFilePath.length === 0) {
      throw new Error(
        `fedos trust issuer: environment variable "${this.#envVarName}" is not set — it must hold the ` +
          "path to an operator-controlled key file (never the secret itself). See scripts/fedos_trust_issuer_cli.mjs.",
      );
    }
    const fileContents = readFileSync(keyFilePath, "utf8");
    return parseFedosTrustIssuerSecretFromFileStorage(fileContents);
  }
}
