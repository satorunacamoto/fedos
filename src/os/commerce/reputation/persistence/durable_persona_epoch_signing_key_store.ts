/**
 * FedOS Commerce FINAL P1 Closure (Agent K1) — durable, sealed-at-rest
 * custody for the Persona Epoch identity/signing keypair, closing the P1
 * gap disclosed by the Commerce Durability arc's own final report and
 * restated verbatim in `fedos_electron_beta_main.cts`'s own
 * `commercePersonaEpochByPubkey` comment block: "resolving 'this real
 * pubkey's persona epoch' via `commercePersonaEpochForPubkey()` mints a
 * FRESH, unlinked epoch rather than resuming the pre-restart one."
 *
 * REUSE, NOT REINVENTION: this file adds NO new sealing primitive, NO new
 * at-rest format, and NO new fail-closed discipline of its own — all three
 * are the shared foundation `../../../core/vault/wasm/
 * fedos_sealed_signing_key_store.ts` already provides (read that file's
 * header first). This file is the THIN, Persona-Epoch-specific translation
 * layer on top: it knows the `purpose` string, how to turn raw sealed bytes
 * into an opaque `PersonaEpochSigningKeypair` (and never keeps the raw
 * bytes around any longer than the one call that needs them), and how to
 * distinguish "nothing sealed yet for this pubkey" (an ordinary first-use
 * state) from "something is sealed but this caller isn't allowed to create
 * a NEW one right now" — a distinction the generic foundation module
 * deliberately does not make, since only a domain caller knows its own
 * create-vs-read-only semantics.
 *
 * KEY ORIGIN DECISION: a key resolved/sealed by this module is ALWAYS a
 * fresh, independent, CSPRNG-random secp256k1 secret (via
 * `PersonaEpochSigningKeypair.generateSecretKeyBytesForSealedCustody()`) —
 * NEVER derived deterministically from the Master Seed. This mirrors
 * `persona_epoch_signing_keypair.ts`'s own header ("NEVER derived from a
 * Master Seed, Nostr identity key, or Double Ratchet chain key") and
 * `fedos_sealed_signing_key_store.ts`'s own "KEY ORIGIN DECISION" section:
 * deterministic derivation would make every sealed key silently
 * re-derivable by anyone who ever recovers the Master Seed alone (e.g. a
 * restored backup on a different device), which is a STRICTLY WORSE,
 * unbounded cross-device linkability property than "a sealed random key is
 * bound to ONE profile's ONE local sealed-storage file." Restart-durability
 * comes from SEALING the random key at rest, not from making it
 * re-derivable. This also preserves the existing "free to generate, no
 * Sybil resistance" property `commercePersonaEpochByPubkey`'s own comment
 * block documents — sealing changes WHERE the key lives, never how it is
 * generated or what it proves.
 *
 * CROSS-DEVICE SCOPE: local-device-only, no sync of any kind — the sealed
 * log file lives under this device's own `dataDir()`
 * (`commerceDurableFilePath("persona_epoch_signing_keys")`, wired by the
 * Electron main-process composition root, not this file). A second device
 * profile mints and seals its own independent key.
 *
 * RENDERER BOUNDARY: this module only ever moves an opaque
 * `PersonaEpochSigningKeypair` handle and raw bytes that live for a single
 * synchronous slice of one `async` call. It has no IPC surface of its own
 * and must never be imported by renderer code.
 *
 * MINTING ORDER (why `resolvePersonaEpochSigningKeypair` takes a
 * caller-supplied `candidateEpochIdForFreshKey` rather than generating one
 * itself): the sealed record's `keyId` must be the SAME `epochId` the
 * `PersonaEpoch` domain object built around this keypair will use (so a
 * sealed record is traceable to "which epoch"), and the `PersonaEpoch`
 * domain object's own `epochKeyPublicHex` must be THIS keypair's real
 * public key — never a separately-generated one. That rules out reusing
 * `persona_epoch_registry.ts`'s `createPersonaEpoch()` for the sealed path
 * (it generates its OWN internal keypair via
 * `PersonaEpochSigningKeypair.generate()`, whose raw bytes this opaque
 * class never exposes after construction, so that keypair could never be
 * sealed). Instead: the caller generates a candidate `epochId` (cheap — a
 * `generatePersonaEpochId()` call, no domain object yet), this module mints
 * and seals the ACTUAL keypair under that `epochId` as `keyId`, and only
 * once that succeeds does the caller build + register the real
 * `PersonaEpoch` object around the keypair this function returns — so the
 * epoch's own `epochKeyPublicHex` and the sealed key can never drift apart.
 */

import type { SealingAuthorityPort } from "../../../core/ports/sealing_authority_port.js";
import {
  DurableSealedSigningKeyStore,
  restoreLatestSealedSigningKey,
  sealAndPersistNewSigningKey,
} from "../../../core/vault/wasm/fedos_sealed_signing_key_store.js";
import { PersonaEpochSigningKeypair } from "../persona_epoch_signing_keypair.js";

/** Domain-separates this key custody from every other purpose the shared
 * sealing primitive is reused for (e.g. the sibling Receipt-issuer key
 * closure) — see `fedos_sealed_signing_key_store.ts`'s own header on why a
 * distinct `purpose` string is the ONLY thing that needs to differ. */
export const COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE = "commerce-persona-epoch-signing-key";

/**
 * A structural, narrower-than-`SealingAuthorityPort` shape a caller may
 * hold — both methods OPTIONAL, matching how this codebase's own
 * `MasterSeedAuthorityLike` structural types are declared at call sites
 * that may or may not have a currently-unlocked, sealing-capable authority
 * (e.g. `fedos_electron_beta_main.cts`'s `activeMasterSeedAuthority`,
 * which is `null` before any profile is unlocked). `null` and
 * "present but missing/non-function methods" are both treated identically
 * as "sealing unavailable right now" — never a thrown error.
 */
export interface PersonaEpochSigningKeySealingAuthorityLike {
  sealDirectRatchetSecret?(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<string | null>;
  restoreDirectRatchetSecret?(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null>;
}

/** Narrows a loosely-typed caller-held authority reference down to the
 * strict `SealingAuthorityPort` the shared foundation module requires, or
 * `null` if either method is absent/non-function. Never throws. */
function asSealingAuthorityPort(
  authority: PersonaEpochSigningKeySealingAuthorityLike | null,
): SealingAuthorityPort | null {
  if (authority === null) return null;
  if (typeof authority.sealDirectRatchetSecret !== "function") return null;
  if (typeof authority.restoreDirectRatchetSecret !== "function") return null;
  return authority as SealingAuthorityPort;
}

/** Used only as the defense-in-depth cross-check `restoreLatestSealedSigningKey`
 * itself calls — constructs a throwaway keypair purely to read its public
 * key hex back out; never the keypair this module ultimately returns. */
function publicKeyHexFromSecretKeyBytes(secretKeyBytes: Uint8Array): string {
  return PersonaEpochSigningKeypair.fromSecretKeyBytes(secretKeyBytes).publicKeyHex;
}

export type PersonaEpochSigningKeyResolveResult =
  | {
      /** "restored": an already-sealed key for this `subjectId` was found and
       * successfully unsealed. "created": no sealed key existed yet for this
       * `subjectId` (an ordinary first-use state) and `createIfAbsent` was
       * `true`, so a fresh one was minted and sealed at `generation: 0`. */
      readonly outcome: "restored" | "created";
      readonly keypair: PersonaEpochSigningKeypair;
      readonly generation: number;
      /** The sealed record's `keyId` — this IS the `PersonaEpoch.epochId` this
       * keypair belongs to (see this file's header, "MINTING ORDER"). The
       * caller uses this to look up (on `"restored"`) or register (on
       * `"created"`) the matching `PersonaEpoch` domain object. */
      readonly epochId: string;
    }
  /** No sealed key exists yet for this `subjectId` AND `createIfAbsent` was
   * `false` — an ordinary, expected read-only-query state, never logged as
   * an error by a caller. */
  | { readonly outcome: "not-found" }
  /** No unlocked, sealing-capable Master Seed Authority is currently
   * available — graceful degradation, not a Commerce failure; see this
   * module's caller (`fedos_electron_beta_main.cts`) for the documented
   * in-memory-only fallback this maps to. */
  | { readonly outcome: "sealing-unavailable" }
  /** Sealing WAS available but the underlying AEAD seal call itself failed
   * (distinct from `"sealing-unavailable"` only in that capability was
   * confirmed present) — same graceful-degradation handling as
   * `"sealing-unavailable"` at the caller. */
  | { readonly outcome: "seal-failed" }
  /** A sealed record exists for this `subjectId` but failed to restore —
   * tampered ciphertext, wrong key id/generation binding, or a different
   * Master Seed than the one it was sealed under. NEVER treated as
   * "not-found"; a caller must surface this loudly and must NOT silently
   * mint a replacement identity in response (arc mandate). */
  | { readonly outcome: "corrupted"; readonly reason: string };

/**
 * Resolves the durable Persona Epoch signing keypair for `subjectId` (a
 * real pubkey): tries to restore an already-sealed key first; if none
 * exists and `createIfAbsent` is `true`, mints and seals a fresh one at
 * generation 0 under `candidateEpochIdForFreshKey` as its `keyId`. If none
 * exists and `createIfAbsent` is `false`, returns `"not-found"` without
 * ever touching the sealing authority's write path — a read-only caller
 * (e.g. a Persona Board query) must never mint a new identity as a side
 * effect of looking one up.
 *
 * The raw secret key bytes generated on the `"created"` path never outlive
 * this function call — sealed, wrapped into the returned opaque
 * `PersonaEpochSigningKeypair`, then `.fill(0)`'d before returning. Bytes
 * restored on the `"restored"` path are handled identically.
 */
export async function resolvePersonaEpochSigningKeypair(
  masterSeedAuthority: PersonaEpochSigningKeySealingAuthorityLike | null,
  store: DurableSealedSigningKeyStore,
  subjectId: string,
  createIfAbsent: boolean,
  candidateEpochIdForFreshKey: string,
  nowUnixSeconds: number,
): Promise<PersonaEpochSigningKeyResolveResult> {
  const authority = asSealingAuthorityPort(masterSeedAuthority);

  const restored = await restoreLatestSealedSigningKey(
    authority,
    store,
    COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE,
    subjectId,
    publicKeyHexFromSecretKeyBytes,
  );

  if (restored.outcome === "sealing-unavailable") return { outcome: "sealing-unavailable" };
  if (restored.outcome === "corrupted") return { outcome: "corrupted", reason: restored.reason };
  if (restored.outcome === "restored") {
    // `PersonaEpochSigningKeypair.fromSecretKeyBytes()` stores the EXACT
    // array reference it is given as its own private field for the
    // keypair's whole lifetime (no internal defensive copy -- matches
    // `.generate()`'s own behavior) -- so the keypair must be built from a
    // COPY (`.slice()`), never the original `restored.secretKeyBytes`
    // array, or `.fill(0)`-ing that original immediately below would zero
    // out the keypair's own internal secret too.
    const keypair = PersonaEpochSigningKeypair.fromSecretKeyBytes(restored.secretKeyBytes.slice());
    restored.secretKeyBytes.fill(0);
    return { outcome: "restored", keypair, generation: restored.generation, epochId: restored.keyId };
  }

  // restored.outcome === "not-found" -- an ordinary first-use state.
  if (!createIfAbsent) return { outcome: "not-found" };

  const secretKeyBytes = PersonaEpochSigningKeypair.generateSecretKeyBytesForSealedCustody();
  // Same "keypair owns a COPY, never the original array" discipline as the
  // restore branch above -- `secretKeyBytes` itself is what gets sealed
  // AND `.fill(0)`'d below; the keypair's own internal secret lives in
  // independent memory this function never touches again.
  const keypair = PersonaEpochSigningKeypair.fromSecretKeyBytes(secretKeyBytes.slice());
  const sealResult = await sealAndPersistNewSigningKey(
    authority,
    store,
    COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE,
    subjectId,
    candidateEpochIdForFreshKey,
    0,
    secretKeyBytes,
    keypair.publicKeyHex,
    nowUnixSeconds,
  );
  secretKeyBytes.fill(0);

  if (sealResult.outcome === "created") {
    return { outcome: "created", keypair, generation: sealResult.generation, epochId: candidateEpochIdForFreshKey };
  }
  // sealResult.outcome is "sealing-unavailable" (unreachable in practice --
  // `restoreLatestSealedSigningKey` above already proved capability by NOT
  // returning "sealing-unavailable" itself -- kept as an explicit case
  // rather than asserted-away, since `isSealingCapable` is re-evaluated
  // independently on each call) or "seal-failed".
  return sealResult.outcome === "sealing-unavailable" ? { outcome: "sealing-unavailable" } : { outcome: "seal-failed" };
}

/**
 * Explicit, caller-decided ROTATION seam: seals a brand-new keypair for
 * `subjectId` at the generation immediately following whatever this
 * `store` currently holds as latest for that `subjectId` (0 if none yet).
 * This arc's own scope does NOT wire any automatic trigger that calls
 * this — `fedos_electron_beta_main.cts`'s `commercePersonaEpochForPubkey`
 * never calls it today. It exists so that IF a future caller ever mints a
 * genuinely NEW epoch for a `subjectId` that already has a sealed key
 * (e.g. a future rollover feature), the new keypair is sealed at the next
 * generation — never silently overwriting or reusing the old generation's
 * record (`DurableSealedSigningKeyStore.append()` itself already refuses a
 * same-generation, different-content write, but computing the RIGHT next
 * generation is this function's job, not that store's).
 */
export async function sealNextGenerationPersonaEpochSigningKeypair(
  masterSeedAuthority: PersonaEpochSigningKeySealingAuthorityLike | null,
  store: DurableSealedSigningKeyStore,
  subjectId: string,
  newEpochId: string,
  nowUnixSeconds: number,
): Promise<PersonaEpochSigningKeyResolveResult> {
  const authority = asSealingAuthorityPort(masterSeedAuthority);
  const previous = store.latestFor(subjectId);
  const nextGeneration = previous === undefined ? 0 : previous.generation + 1;

  const secretKeyBytes = PersonaEpochSigningKeypair.generateSecretKeyBytesForSealedCustody();
  // Same "keypair owns a COPY, never the original array" discipline as
  // `resolvePersonaEpochSigningKeypair` above -- see that function's own
  // comments for why.
  const keypair = PersonaEpochSigningKeypair.fromSecretKeyBytes(secretKeyBytes.slice());
  const sealResult = await sealAndPersistNewSigningKey(
    authority,
    store,
    COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE,
    subjectId,
    newEpochId,
    nextGeneration,
    secretKeyBytes,
    keypair.publicKeyHex,
    nowUnixSeconds,
  );
  secretKeyBytes.fill(0);

  if (sealResult.outcome === "created") {
    return { outcome: "created", keypair, generation: sealResult.generation, epochId: newEpochId };
  }
  return sealResult.outcome === "sealing-unavailable" ? { outcome: "sealing-unavailable" } : { outcome: "seal-failed" };
}

// Re-exported so callers (composition root and tests) can reach the
// underlying durable store type from this one domain-specific module
// without a second import path to remember.
export { DurableSealedSigningKeyStore };
