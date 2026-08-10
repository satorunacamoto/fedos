/**
 * Secure Runtime Alpha 1273 ("Production Authority Factory") — Phase C of
 * the Alpha 1261–1320 Production Conversation Crypto Runtime Activation
 * Arc.
 *
 * The ONE narrow factory that assembles a coherent, real, WASM-backed
 * Conversation crypto graph — composed ENTIRELY over EXISTING, unmodified
 * machinery this file invents no cryptography for:
 *
 *   - `FedosWasmMasterSeedAuthority` (Alpha 438) — owns the opaque WASM
 *     Master Seed handle; this factory NEVER reads a raw seed byte from
 *     it.
 *   - `FedosWasmNostrSigningAuthority` (Alpha 445), constructed sharing
 *     the SAME `FedosWasmMasterSeedAuthority` instance (via its own
 *     `accessForNostrSigningAuthorityInternalUse()` accessor) — the real
 *     local public identity (Alpha 1270/1271), never a second signing
 *     identity (Alpha 1114's own "one coherent graph" rule, reused here
 *     verbatim).
 *   - `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority`
 *     (Alpha 870/871) — the real, already-reviewed Direct-mode ECDH+AEAD
 *     path, constructed over the SAME Master Seed Authority instance.
 *   - `FedosSigningAuthorityNostrAuthorBinding` (Alpha 688) — the real
 *     Nostr identity-binding check `FedosConversationKeyResolver` (Alpha
 *     935, unmodified) already calls for a `"nostr"`-authority local
 *     participant.
 *
 * The pre-existing, unmodified "Dev-only Gate"
 * (`FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`,
 * `src/runtime/fedos_wasm_loader.ts`) is NEVER touched, bypassed, or
 * re-derived here — this factory calls through the SAME
 * `attemptDevOnly*Call()` methods every other real WASM-backed Authority
 * in this codebase already uses, and inherits that gate's own, already-
 * reviewed, PERMANENT "Development only — never Production, never Worker"
 * restriction exactly as-is. See this Arc's own completion declaration
 * for why extending that specific gate to Production is explicitly OUT
 * of this Arc's scope (Alpha 1289's own "A. keep development-only" —
 * architecture-frozen forbids redesigning an already-reviewed security
 * boundary).
 *
 * Every failure mode collapses to ONE of `FedosConversationProductionCryptoCapabilityResult`'s
 * nine closed outcomes (Alpha 1263) — never a raw loader `Error`, never a
 * provider message, never a stack trace.
 */

import { FedosWasmLoaderSkeleton } from "../../../../core/vault/wasm/fedos_wasm_loader.js";
import { FedosWasmMasterSeedAuthority } from "../../../../core/vault/wasm/fedos_wasm_master_seed_authority.js";
import type { FedosMasterSeedAuthority } from "../../../../core/vault/wasm/fedos_master_seed_authority.js";
import type { FedosSealedMasterSeedEnvelopePersistence } from "../../../../core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import type { FedosPassphraseProvider } from "../../../../core/vault/wasm/fedos_passphrase_provider.js";
import { FedosWasmNostrSigningAuthority } from "../../../adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../../../board/runtime/identity/fedos_nostr_author_binding_authority.js";
import type { FedosNostrAuthorBindingAuthority } from "../../../board/runtime/identity/fedos_nostr_author_binding_types.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../../construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationCreatorIdentityAuthority } from "../../construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationParticipantReference } from "../../membership/fedos_conversation_participant_reference.js";
import { FedosWasmConversationEncryptionAuthority } from "../fedos_wasm_conversation_encryption_authority.js";
import { FedosWasmConversationDecryptionAuthority } from "../fedos_wasm_conversation_decryption_authority.js";
import type { FedosConversationEncryptionAuthority } from "../fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority } from "../fedos_conversation_decryption_authority.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../identity/fedos_conversation_local_account_index_authority.js";
import type { FedosConversationLocalAccountIndexAuthority } from "../identity/fedos_conversation_local_account_index_authority.js";
import type { FedosConversationProductionCryptoCapabilityOutcome } from "./fedos_conversation_production_crypto_capability_result.js";

const U32_MAX = 4_294_967_295;

export interface FedosConversationProductionCryptoConfig {
  /** Alpha 1264/1289 — the explicit, non-inferred activation flag. `false`/omitted denies every capability below. */
  readonly enabled: boolean;
  readonly sealedSeedPersistence: FedosSealedMasterSeedEnvelopePersistence;
  readonly passphraseProvider: FedosPassphraseProvider;
  /** Optional — default `0` (mirrors `FixedFedosConversationLocalAccountIndexAuthority`'s own default, Alpha 689/933). */
  readonly accountIndex?: number;
  /** Alpha 1268 — optional, default `false`: a seed is restored from an existing sealed file only, never generated, unless the caller explicitly opts in. */
  readonly allowSeedCreation?: boolean;
}

/** Alpha 1273/1277 — the coherent graph one running Runtime owns. `masterSeedAuthority` is exposed ONLY so a caller can `clear()` it on stop (Alpha 1278) — never for raw access. */
export interface FedosConversationProductionCryptoGraph {
  readonly creatorIdentityAuthority: FedosConversationCreatorIdentityAuthority;
  readonly encryptionAuthority: FedosConversationEncryptionAuthority;
  readonly decryptionAuthority: FedosConversationDecryptionAuthority;
  readonly accountIndexAuthority: FedosConversationLocalAccountIndexAuthority;
  readonly nostrAuthorBindingAuthority: FedosNostrAuthorBindingAuthority;
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
}

export type FedosConversationProductionCryptoCapabilityResult =
  | { readonly outcome: "available"; readonly graph: FedosConversationProductionCryptoGraph }
  | { readonly outcome: Exclude<FedosConversationProductionCryptoCapabilityOutcome, "available"> };

/**
 * Assembles the real crypto graph, or names exactly which of the nine
 * closed outcomes blocked it. Never throws — every internal failure
 * (missing artifact, closed Dev-only Gate, absent/corrupt/wrong-passphrase
 * seed, unresolvable identity) collapses to a closed outcome.
 */
export async function assembleFedosConversationProductionCryptoGraph(
  config: FedosConversationProductionCryptoConfig,
): Promise<FedosConversationProductionCryptoCapabilityResult> {
  if (!config.enabled) return { outcome: "disabled" };

  const accountIndex = config.accountIndex ?? 0;
  if (!Number.isInteger(accountIndex) || accountIndex < 0 || accountIndex > U32_MAX) {
    return { outcome: "failed" };
  }

  // One loader instance, held by this factory only long enough to read its
  // own diagnostics after each attempt -- never exposed on the returned
  // graph (Alpha 1266's own "must not expose a raw... handle" rule).
  const loader = new FedosWasmLoaderSkeleton();

  // Primes the SAME three-step chain `attemptDevOnlyRuntimeEncrypt()`
  // (`../../../runtime/fedos_runtime_encrypt.ts`, unmodified) already
  // performs internally before its own `attemptDevOnlyEncryptCall()` --
  // `FedosWasmMasterSeedAuthority#ensureConstructed()` (Alpha 438,
  // unmodified) calls ONLY `attemptDevOnlyMasterSeedAuthorityConstructCall()`
  // directly, whose own gate requires `generatedArtifactCheckResult`/
  // `devOnlyGateEvaluation`/`importReadiness`/`importExecution`/
  // `jsGlueModule`/`wasmInitialization` to ALREADY be populated on this
  // SAME loader instance (`fedos_wasm_loader.ts`'s own `planLoad()` /
  // `attemptDevOnlyJsGlueImport()` / `attemptDevOnlyWasmInitialization()`
  // populate exactly those fields as real, recorded side effects). This
  // factory reuses that EXACT established sequence rather than modifying
  // `FedosWasmMasterSeedAuthority` itself (an already-reviewed file this
  // Arc does not touch) to auto-prime on construction.
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();

  const masterSeedAuthority = new FedosWasmMasterSeedAuthority(loader);

  // Triggers real WASM authority construction (Alpha 1265's own build
  // reproducibility target) -- the boolean result itself is not yet
  // meaningful (no seed is loaded yet); this call exists to populate the
  // loader's own diagnostics for the mapping below.
  await masterSeedAuthority.isAvailable();

  const artifactCheck = loader.generatedArtifactCheckResult();
  if (artifactCheck !== null && !artifactCheck.artifactsExist) {
    return { outcome: "artifact-missing" };
  }

  const gateEvaluation = loader.devOnlyGateEvaluation();
  if (gateEvaluation !== null && !gateEvaluation.developmentAllowed) {
    return { outcome: "unsupported-runtime" };
  }

  const constructExecution = loader.masterSeedAuthorityConstructExecution();
  if (constructExecution === null || !constructExecution.succeeded) {
    if (constructExecution?.reason === "InvalidAuthorityShape" || constructExecution?.reason === "ConstructorUnavailable") {
      return { outcome: "artifact-incompatible" };
    }
    return { outcome: "unsupported-runtime" };
  }

  // Seed restoration or (only when explicitly allowed) first-run creation.
  let sealedEnvelope;
  try {
    sealedEnvelope = config.sealedSeedPersistence.read();
  } catch {
    // A structurally malformed sealed-seed file -- fail closed, never
    // overwritten automatically (Alpha 1296).
    return { outcome: "seed-restore-failed" };
  }

  if (sealedEnvelope === null) {
    if (config.allowSeedCreation !== true) return { outcome: "seed-unavailable" };
    const passphraseResult = await config.passphraseProvider.obtainPassphrase();
    if (passphraseResult.outcome !== "provided") return { outcome: "seed-unavailable" };
    const generated = await masterSeedAuthority.generate();
    if (!generated) return { outcome: "failed" };
    const sealed = await masterSeedAuthority.seal(passphraseResult.passphrase);
    if (sealed === null) return { outcome: "failed" };
    const writeResult = config.sealedSeedPersistence.writeIfAbsent(sealed);
    if (writeResult !== "written") return { outcome: "failed" };
  } else {
    const passphraseResult = await config.passphraseProvider.obtainPassphrase();
    if (passphraseResult.outcome !== "provided") return { outcome: "seed-unavailable" };
    const restored = await masterSeedAuthority.restoreSealed(sealedEnvelope, passphraseResult.passphrase);
    if (!restored) return { outcome: "seed-restore-failed" };
  }

  // Real local public identity (Alpha 1270/1271) -- sharing the SAME
  // Master Seed Authority instance the Encryption/Decryption Authorities
  // below also share; never a second signing identity.
  const nostrSigningAuthority = new FedosWasmNostrSigningAuthority(masterSeedAuthority, loader);
  const identity = await nostrSigningAuthority.publicIdentityForAccount(accountIndex);
  if (identity === null) return { outcome: "identity-unavailable" };

  const creator: FedosConversationParticipantReference = Object.freeze({
    authority: "nostr",
    publicIdentifier: identity.publicKeyHex,
    identityId: null,
  });

  const graph: FedosConversationProductionCryptoGraph = Object.freeze({
    creatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(creator),
    encryptionAuthority: new FedosWasmConversationEncryptionAuthority(masterSeedAuthority),
    decryptionAuthority: new FedosWasmConversationDecryptionAuthority(masterSeedAuthority),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(accountIndex),
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(nostrSigningAuthority),
    masterSeedAuthority,
  });

  return { outcome: "available", graph };
}
