/**
 * Secure Runtime Alpha 4661-4740 — Phase I: the recovery-material UX
 * boundary.
 *
 * This Arc reviewed what recovery/export capability ACTUALLY exists and
 * found: the sealed Master Seed envelope file (`master-seed.sealed.json`,
 * Alpha 435) plus the non-secret profile descriptor are the only durable
 * account-recovery inputs that exist. There is NO reviewed plaintext-seed
 * export boundary, NO mnemonic/BIP-39 export, and NO custodial/cloud
 * recovery (all forbidden by the Absolute Prohibitions). A narrow
 * Archive-based *conversation* export exists (`src/conversation/archive/*`),
 * but that recovers message DATA, not account authority.
 *
 * So this boundary produces an HONEST, non-secret backup requirement
 * descriptor — the list of files a user must back up, and the plain
 * statement that **losing the unlock secret may make the profile
 * unrecoverable** (no reset path exists). It NEVER displays the Master Seed
 * as plaintext (this Arc has no authorization to add a plaintext-seed
 * display, and none exists to reuse — Phase I).
 *
 * Product Durability mega-arc — every OTHER durable concern this profile
 * owns (conversations, message history, Device trust, Direct Ratchet
 * sessions, Commerce products/orders/receipts/purchased-content bytes,
 * Signed Deletion state, Identity Transition state, app settings) is ALSO
 * just a plain file directly under this SAME profile `root` directory
 * (`fedos_local_profile_paths.ts` — every `*LogFile` field is
 * `join(root, "<name>")`, zero subdirectories). This was previously true
 * but undisclosed here: this notice named only the 2 files required for
 * IDENTITY recovery, never told the user that backing up the WHOLE root
 * directory recovers everything else too. `wholeProfileDirectoryRecommendation`
 * states this honestly as a separate, additive fact — it does not change
 * the 2-item `backupItems` list, which remains the correct MINIMUM for
 * identity recovery alone.
 *
 * HARD GUARDRAILS:
 *   - No secret, no sealed byte, no passphrase in the notice — only file
 *     PATHS and fixed human-readable strings.
 *   - Never claims the sealed file alone is sufficient (it also names the
 *     descriptor, and states the forgotten-secret irrecoverability).
 */

import type { FedosLocalProfilePaths } from "./fedos_local_profile_paths.js";

/** One item the user must back up. `path` is a non-secret file path; `sensitivity` flags whether the file is secret-bearing (sealed) — so a UI can warn appropriately, never to expose contents. */
export interface FedosProfileBackupItem {
  readonly label: string;
  readonly path: string;
  readonly sensitivity: "sealed-secret-bearing" | "non-secret";
  readonly required: boolean;
}

export interface FedosProfileRecoveryNotice {
  /** Fixed, honest headline. */
  readonly headline: string;
  /** The files the user must back up to be able to unlock this profile on another machine or after data loss. */
  readonly backupItems: readonly FedosProfileBackupItem[];
  /** The plain, non-negotiable warnings. */
  readonly warnings: readonly string[];
  /** True — this codebase has NO forgotten-secret reset/recovery path; stated so no UI implies one. */
  readonly forgottenSecretIsUnrecoverable: true;
  /** Whether a conversation-data Archive export is separately available (recovers messages, NOT account authority). */
  readonly conversationArchiveExportAvailable: boolean;
  /**
   * Product Durability mega-arc — additive, honest fact: this profile's
   * `root` directory (a non-secret path) contains every other durable
   * concern this profile owns, not just the 2 `backupItems` above. Backing
   * up the WHOLE directory (not just those 2 files) additionally recovers
   * conversations, message history, Device trust, Direct Ratchet sessions,
   * Commerce data, Signed Deletion state, Identity Transition state, and
   * app settings — none of which the 2-item minimum list above covers on
   * its own. This is a RECOMMENDATION, not a new requirement: the 2-item
   * list remains independently sufficient for identity recovery alone.
   */
  readonly wholeProfileDirectoryRecommendation: {
    readonly path: string;
    readonly text: string;
  };
}

const RECOVERY_WARNINGS: readonly string[] = Object.freeze([
  "Your unlock secret is never stored anywhere. If you forget it, this profile cannot be unlocked — there is no reset, no custodial recovery, and no cloud recovery.",
  "The sealed Master Seed file is encrypted with your unlock secret. Backing it up WITHOUT also remembering the secret does not let you recover the profile.",
  "Back up BOTH the sealed Master Seed file AND the profile descriptor. The sealed file alone is not sufficient to describe which account/device this profile belongs to.",
  "Never share the sealed Master Seed file together with your unlock secret; anyone holding both can open your account.",
]);

/**
 * Builds the honest recovery notice for a profile. Pure; never reads a
 * file; never touches a secret. `conversationArchiveExportAvailable`
 * reflects whether the caller's Runtime was assembled with the Archive
 * capability (the coordinator passes this through) — the notice never
 * assumes it.
 */
export function buildFedosProfileRecoveryNotice(
  paths: FedosLocalProfilePaths,
  options: { readonly conversationArchiveExportAvailable: boolean },
): FedosProfileRecoveryNotice {
  return Object.freeze({
    headline: "Back up your recovery material now — it cannot be regenerated later.",
    backupItems: Object.freeze([
      Object.freeze({
        label: "Sealed Master Seed",
        path: paths.sealedMasterSeedFile,
        sensitivity: "sealed-secret-bearing" as const,
        required: true,
      }),
      Object.freeze({
        label: "Profile descriptor",
        path: paths.profileDescriptorFile,
        sensitivity: "non-secret" as const,
        required: true,
      }),
    ]),
    warnings: RECOVERY_WARNINGS,
    forgottenSecretIsUnrecoverable: true,
    conversationArchiveExportAvailable: options.conversationArchiveExportAvailable,
    wholeProfileDirectoryRecommendation: Object.freeze({
      path: paths.root,
      text:
        "For a more complete backup, copy this ENTIRE folder (not just the two files above) somewhere safe. " +
        "It also contains your conversations, message history, Device trust, Direct Ratchet sessions, Commerce data, " +
        "deletion and identity-change records, and app settings. This is a recommendation, not a requirement — " +
        "the two files above are still all you need to recover your identity alone.",
    }),
  });
}
