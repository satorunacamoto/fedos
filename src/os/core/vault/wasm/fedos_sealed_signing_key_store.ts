/**
 * FedOS Commerce FINAL P1 Closure (coordinator, shared foundation) —
 * generic, domain-agnostic sealed-at-rest persistence for a
 * caller-generated signing-key secret, reusing the EXISTING sealed-secret
 * boundary rather than inventing a new one (arc mandate §4).
 *
 * Two Commerce keys are disclosed by the Commerce Durability arc's own
 * final report (`docs/commerce/COMMERCE-E2E-COMPLETION-FINAL-REPORT.md`
 * line 20) as process-lifetime-only, in-memory raw secp256k1 secret keys:
 * the Persona Epoch identity-minting keypair and the demo Receipt-issuer
 * signing keypair. This module is the ONE shared piece both closures
 * build on (see `src/os/commerce/reputation/persistence/
 * durable_persona_epoch_signing_key_store.ts` and `src/os/trust/issuer/
 * durable_receipt_issuer_signing_key_store.ts`), so the two closures do
 * not each invent their own at-rest format or fail-closed discipline.
 *
 * REUSE, NOT REINVENTION: the actual sealing primitive is
 * `sealDirectRatchetSecret`/`restoreDirectRatchetSecret` — the SAME
 * generic AEAD-sealing pair `FedosProductionMasterSeedAuthority`
 * (`src/os/messenger/desktop/production_activation/
 * fedos_production_master_seed_authority.ts`) already exposes for Direct
 * Ratchet secrets, declared here as `SealingAuthorityPort`
 * (`../../ports/sealing_authority_port.ts`). Despite the "DirectRatchet"
 * name, the underlying Rust (`seal_direct_ratchet_secret`/
 * `restore_direct_ratchet_secret`, `packages/fedos-core-rust/src/lib.rs`)
 * is a generic secret sealer domain-separated purely by the caller-supplied
 * 4-tuple (`localDeviceRef`, `remoteDeviceRef`, `conversationId`,
 * `generation`) folded into the derived AEAD key — nothing Ratchet-specific
 * is baked into the primitive itself. This module reuses that primitive
 * with a distinct, non-colliding tuple namespace per purpose (see
 * `resolveOrCreateSealedSigningKey`'s own `purpose`/`subjectId`/`keyId`
 * parameters below) instead of adding new Rust/WASM surface or a
 * plaintext JSON key store.
 *
 * AT-REST FORMAT: this codebase's own established NDJSON-append-only-log
 * discipline (identical replay/corruption discipline to
 * `DurablePersonaEpochRegistry`,
 * `src/os/commerce/reputation/persistence/durable_persona_epoch_registry.ts`):
 * insert-only, one line per (subjectId, generation), `schemaVersion`-gated,
 * ANY structurally-invalid or unknown-`schemaVersion` line throws (voids
 * the whole store) — fail CLOSED, never a silent skip, never a silently
 * regenerated replacement identity (arc mandate §9). The ONLY field ever
 * written to disk is the OPAQUE `sealedBlob` string
 * `sealDirectRatchetSecret` returns, plus the key's own PUBLIC key hex —
 * never a raw secret byte, never a passphrase, never derived key material.
 *
 * KEY ORIGIN DECISION (arc mandate §14): a key sealed here is always a
 * FRESH, INDEPENDENT, CSPRNG-random secret the CALLER generates (this
 * module never generates key material itself — see
 * `sealAndPersistNewSigningKey`'s own `secretKeyBytes` parameter) — never
 * derived deterministically from the Master Seed. `persona_epoch_signing_
 * keypair.ts`'s own header already documents why for Persona Epoch
 * specifically ("NEVER derived from a Master Seed, Nostr identity key, or
 * Double Ratchet chain key"); the same reasoning applies to the
 * Receipt-issuer key by symmetry — deterministic derivation would make
 * every sealed key silently re-derivable by anyone who ever recovers the
 * Master Seed alone (e.g. a backup restored to a different device), which
 * is a STRICTLY WORSE, unbounded cross-device linkability property than
 * this design's actual one (a sealed random key is bound to ONE profile's
 * ONE local sealed-storage file; a Master Seed backup alone, without that
 * file, recovers nothing). Restart-durability is provided by SEALING the
 * random key at rest, not by making it re-derivable.
 *
 * CROSS-DEVICE SCOPE (arc mandate §15): local-device-only. No sync of any
 * kind. A second device profile mints and seals its OWN independent key.
 *
 * RENDERER BOUNDARY (arc mandate §11): this module only ever moves opaque
 * blob strings and raw bytes between the main-process
 * `SealingAuthorityPort` and a main-process-only file. It has no IPC
 * surface of its own and must never be imported by renderer code.
 *
 * This file must never import from `src/conversation`, `src/os/messenger`,
 * `src/commerce`/`src/os/commerce`, `src/os/trust`, or any other
 * domain-specific module — same discipline `sealing_authority_port.ts`
 * itself already documents.
 */

// FedOS Commerce FINAL P1 Closure arc (Agent T) -- `@ts-ignore`, not this
// repo's usual `@ts-expect-error`, is deliberate for these two lines only:
// `commerce_e2e_restart_persistence_real_electron.test.ts`/
// `commerce_e2e_sealed_key_corruption_real_electron.test.ts`
// (`packages/fedos-desktop-electron-spike/test/`) are the first files to
// import this module transitively, which now also type-checks it under
// `packages/fedos-desktop-electron-spike/tsconfig.test.json` -- that
// tsconfig declares `"types": ["node"]` (unlike the repo-root
// `tsconfig.json` `typecheck:core` uses, which does not), so `@types/node`
// IS ambiently visible there and an `@ts-expect-error` here would itself
// error as "unused" under that program. `@ts-ignore` tolerates being
// unnecessary in exactly the contexts where `@types/node` happens to be
// visible, while still suppressing the real "no type declarations" error
// under `typecheck:core`'s own program, where it is not.
// @ts-ignore `node:fs` has no type declarations without `@types/node` in some of this repo's tsconfigs (see comment above).
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
// @ts-ignore `node:path` has no type declarations without `@types/node` in some of this repo's tsconfigs (see comment above).
import { dirname } from "node:path";
import type { SealingAuthorityPort } from "../../ports/sealing_authority_port.js";

const SEALED_SIGNING_KEY_SCHEMA_VERSION_1 = 1 as const;

const PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** One persisted line: ONE (subjectId, generation) key's sealed record. Never a raw secret byte. */
export interface PersistedSealedSigningKeyRecordV1 {
  readonly schemaVersion: 1;
  readonly purpose: string;
  readonly subjectId: string;
  readonly keyId: string;
  readonly generation: number;
  readonly publicKeyHex: string;
  readonly sealedBlob: string;
  readonly createdAt: number;
}

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

/** Strict structural validation only — does NOT authenticate `sealedBlob`; that is exclusively the sealing authority's `restoreDirectRatchetSecret()` job (matches `fedos_sealed_direct_ratchet_secret_record.ts`'s own precedent). Never throws. */
function isWellFormedPersistedSealedSigningKeyRecordV1(candidate: unknown): candidate is PersistedSealedSigningKeyRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const c = candidate as Record<string, unknown>;
  if (c.schemaVersion !== SEALED_SIGNING_KEY_SCHEMA_VERSION_1) return false;
  if (typeof c.purpose !== "string" || c.purpose.length === 0) return false;
  if (typeof c.subjectId !== "string" || c.subjectId.length === 0) return false;
  if (typeof c.keyId !== "string" || c.keyId.length === 0) return false;
  if (typeof c.generation !== "number" || !Number.isInteger(c.generation) || c.generation < 0) return false;
  if (typeof c.publicKeyHex !== "string" || !PUBLIC_KEY_HEX_PATTERN.test(c.publicKeyHex)) return false;
  if (typeof c.sealedBlob !== "string" || c.sealedBlob.length === 0) return false;
  if (typeof c.createdAt !== "number" || !Number.isFinite(c.createdAt)) return false;
  return true;
}

function recordsConflict(a: PersistedSealedSigningKeyRecordV1, b: PersistedSealedSigningKeyRecordV1): boolean {
  return a.publicKeyHex !== b.publicKeyHex || a.sealedBlob !== b.sealedBlob || a.keyId !== b.keyId || a.createdAt !== b.createdAt;
}

/**
 * PRIVATE — replays the append log into `Map<subjectId, Map<generation, record>>`.
 * A parse failure, an unrecognized `schemaVersion`, a structurally-invalid
 * record, OR an irreconcilable duplicate (same subjectId+generation, DIFFERENT
 * content) throws unconditionally — fail closed, never a silent skip (arc
 * mandate §13).
 */
function replayLog(filePath: string): Map<string, Map<number, PersistedSealedSigningKeyRecordV1>> {
  const contents = readLogFile(filePath);
  const bySubject = new Map<string, Map<number, PersistedSealedSigningKeyRecordV1>>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`DurableSealedSigningKeyStore: corrupt (non-JSON) record found in log file "${filePath}".`);
    }
    if (!isWellFormedPersistedSealedSigningKeyRecordV1(parsed)) {
      throw new Error(`DurableSealedSigningKeyStore: corrupt or schema-invalid record found in log file "${filePath}" (unknown schemaVersion or malformed shape — fail closed, never silently skipped or replaced).`);
    }
    const record = parsed;
    let byGeneration = bySubject.get(record.subjectId);
    if (byGeneration === undefined) {
      byGeneration = new Map<number, PersistedSealedSigningKeyRecordV1>();
      bySubject.set(record.subjectId, byGeneration);
    }
    const existing = byGeneration.get(record.generation);
    if (existing !== undefined && recordsConflict(existing, record)) {
      throw new Error(`DurableSealedSigningKeyStore: conflicting duplicate records for subjectId "${record.subjectId}" generation ${record.generation} found in log file "${filePath}".`);
    }
    byGeneration.set(record.generation, record);
  }
  return bySubject;
}

/**
 * The durable, append-only, fail-closed record store. Holds ONLY sealed
 * blobs + public keys — never a raw secret byte. One store instance is
 * meant to hold every generation of every subject for ONE `purpose`
 * (callers typically point this at one file per purpose, e.g.
 * `commerceDurableFilePath("persona_epoch_signing_keys")`).
 */
export class DurableSealedSigningKeyStore {
  readonly #filePath: string;
  #bySubject: Map<string, Map<number, PersistedSealedSigningKeyRecordV1>>;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#bySubject = replayLog(filePath);
  }

  /** The highest-`generation` record currently known for `subjectId`, or `undefined` if none exists yet (an ordinary, expected first-use state). */
  latestFor(subjectId: string): PersistedSealedSigningKeyRecordV1 | undefined {
    const byGeneration = this.#bySubject.get(subjectId);
    if (byGeneration === undefined || byGeneration.size === 0) return undefined;
    let latest: PersistedSealedSigningKeyRecordV1 | undefined;
    for (const record of byGeneration.values()) {
      if (latest === undefined || record.generation > latest.generation) latest = record;
    }
    return latest;
  }

  /** Every generation ever sealed for `subjectId`, oldest first — for audit/rotation-history display only; never used to pick which key to restore (always `latestFor`). */
  historyFor(subjectId: string): readonly PersistedSealedSigningKeyRecordV1[] {
    const byGeneration = this.#bySubject.get(subjectId);
    if (byGeneration === undefined) return [];
    return [...byGeneration.values()].sort((a, b) => a.generation - b.generation);
  }

  /**
   * Appends a NEW sealed record. Idempotent no-op if a byte-identical
   * record already exists for this exact (subjectId, generation); throws
   * if a DIFFERENT record already occupies that exact (subjectId,
   * generation) pair — a sealed record is immutable once written, exactly
   * like `DurablePersonaEpochRegistry.register()`'s own discipline.
   * Callers rotating a key MUST pass a strictly higher `generation`, never
   * reuse the current one.
   */
  append(record: PersistedSealedSigningKeyRecordV1): void {
    let byGeneration = this.#bySubject.get(record.subjectId);
    const existing = byGeneration?.get(record.generation);
    if (existing !== undefined) {
      if (recordsConflict(existing, record)) {
        throw new Error(`DurableSealedSigningKeyStore: subjectId "${record.subjectId}" generation ${record.generation} is already sealed with different content — rejected.`);
      }
      return;
    }
    mkdirSync(dirname(this.#filePath), { recursive: true });
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    if (byGeneration === undefined) {
      byGeneration = new Map<number, PersistedSealedSigningKeyRecordV1>();
      this.#bySubject.set(record.subjectId, byGeneration);
    }
    byGeneration.set(record.generation, record);
  }
}

/** Structural narrowing — a live authority that actually implements the sealing port (not every `MasterSeedAuthorityLike` structural type does). */
function isSealingCapable(authority: SealingAuthorityPort | null): authority is SealingAuthorityPort {
  return authority !== null && typeof authority.sealDirectRatchetSecret === "function" && typeof authority.restoreDirectRatchetSecret === "function";
}

export type SealedSigningKeyRestoreOutcome =
  | { readonly outcome: "not-found" }
  | { readonly outcome: "sealing-unavailable" }
  | { readonly outcome: "corrupted"; readonly reason: string }
  | {
      readonly outcome: "restored";
      readonly secretKeyBytes: Uint8Array;
      readonly generation: number;
      readonly keyId: string;
      readonly publicKeyHex: string;
    };

/**
 * Restores the LATEST sealed key for `subjectId`, if one exists. Never
 * mints a replacement key itself — a caller seeing `"not-found"` decides
 * whether minting+sealing a fresh one (via `sealAndPersistNewSigningKey`)
 * is the right response (arc mandate §9: "If regeneration is the only
 * safe recovery, make the identity discontinuity explicit" — `"not-found"`
 * vs. `"corrupted"` is exactly that distinction: `"not-found"` is an
 * ordinary first-use state a caller may safely treat as "mint one";
 * `"corrupted"` is NOT — a caller must surface that explicitly, never
 * silently mint a replacement and pretend continuity).
 *
 * `publicKeyHexFromSecretBytes` lets the caller cross-check the restored
 * bytes reconstruct the exact public key this record claims — defense in
 * depth on top of the sealing authority's own AEAD authentication
 * (`restoreDirectRatchetSecret` already fails closed to `null` on any
 * tamper/wrong-binding; this is an extra, cheap, independent check).
 */
export async function restoreLatestSealedSigningKey(
  masterSeedAuthority: SealingAuthorityPort | null,
  store: DurableSealedSigningKeyStore,
  purpose: string,
  subjectId: string,
  publicKeyHexFromSecretBytes: (secretKeyBytes: Uint8Array) => string,
): Promise<SealedSigningKeyRestoreOutcome> {
  const record = store.latestFor(subjectId);
  if (record === undefined) return { outcome: "not-found" };
  if (!isSealingCapable(masterSeedAuthority)) return { outcome: "sealing-unavailable" };

  const restored = await masterSeedAuthority.restoreDirectRatchetSecret(purpose, subjectId, record.keyId, record.generation, record.sealedBlob);
  if (restored === null) {
    return {
      outcome: "corrupted",
      reason: `sealed signing key (purpose "${purpose}", subject "${subjectId}", generation ${record.generation}) failed to restore — tampered ciphertext, wrong key id/generation binding, or a different Master Seed than the one it was sealed under.`,
    };
  }
  if (restored.length !== 32) {
    restored.fill(0);
    return { outcome: "corrupted", reason: `restored secret key material for subject "${subjectId}" was ${restored.length} bytes, expected 32.` };
  }
  let publicKeyHex: string;
  try {
    publicKeyHex = publicKeyHexFromSecretBytes(restored);
  } catch {
    restored.fill(0);
    return { outcome: "corrupted", reason: `restored secret key material for subject "${subjectId}" did not reconstruct a valid public key.` };
  }
  if (publicKeyHex !== record.publicKeyHex) {
    restored.fill(0);
    return { outcome: "corrupted", reason: `restored secret key for subject "${subjectId}" does not reconstruct its own recorded public key — refusing to use it.` };
  }
  return { outcome: "restored", secretKeyBytes: restored, generation: record.generation, keyId: record.keyId, publicKeyHex: record.publicKeyHex };
}

export type SealAndPersistOutcome =
  | { readonly outcome: "created"; readonly generation: number }
  | { readonly outcome: "sealing-unavailable" }
  | { readonly outcome: "seal-failed" };

/**
 * Seals `secretKeyBytes` (a CALLER-generated, fresh, independent secret —
 * this module never generates key material itself, see this file's own
 * "KEY ORIGIN DECISION" header) and appends the record to `store`. Used
 * both for first-ever creation (`generation` = 0) and for an explicit,
 * caller-decided rotation (`generation` = previous `generation` + 1,
 * arc mandate §6's "rotation intentionally creates a new keypair" —
 * never automatic, never inferred by this module).
 */
export async function sealAndPersistNewSigningKey(
  masterSeedAuthority: SealingAuthorityPort | null,
  store: DurableSealedSigningKeyStore,
  purpose: string,
  subjectId: string,
  keyId: string,
  generation: number,
  secretKeyBytes: Uint8Array,
  publicKeyHex: string,
  nowUnixSeconds: number,
): Promise<SealAndPersistOutcome> {
  if (!isSealingCapable(masterSeedAuthority)) return { outcome: "sealing-unavailable" };
  const sealedBlob = await masterSeedAuthority.sealDirectRatchetSecret(purpose, subjectId, keyId, generation, secretKeyBytes);
  if (sealedBlob === null) return { outcome: "seal-failed" };
  store.append({
    schemaVersion: SEALED_SIGNING_KEY_SCHEMA_VERSION_1,
    purpose,
    subjectId,
    keyId,
    generation,
    publicKeyHex,
    sealedBlob,
    createdAt: nowUnixSeconds,
  });
  return { outcome: "created", generation };
}
