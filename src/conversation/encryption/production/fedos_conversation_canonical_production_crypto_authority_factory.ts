/**
 * Secure Runtime Alpha 7161-7240 ("FedOS Conversation-Level Production
 * Crypto and Identity Authority Wiring Arc") — the missing sibling to
 * `assembleFedosConversationProductionCryptoGraph()`
 * (`./fedos_conversation_production_crypto_authority_factory.ts`).
 *
 * That factory always constructs a SECOND, independent, `NODE_ENV`-gated
 * `FedosWasmMasterSeedAuthority` instance — exactly the pattern Secure
 * Runtime Alpha 6841-6920 already eliminated for Direct Ratchet
 * (`conversationDirectRatchetMasterSeedAuthority`, `fedos_desktop_runtime.ts`),
 * but never extended to Conversation-level identity/encryption. This
 * factory closes that remaining gap: it assembles the SAME
 * `FedosConversationProductionCryptoGraph` shape, but ENTIRELY over
 * authorities the caller's own Coordinator already activated (the
 * canonical `FedosMasterSeedAuthority`/`FedosNostrSigningAuthority` a
 * real profile unlock already constructed) — never a second WASM
 * instance, never a `NODE_ENV` dependency, never new cryptography.
 *
 * Every class instantiated below is EXISTING and UNMODIFIED (beyond this
 * Arc's own narrow `encryptNip44Wire`/`decryptNip44Wire` addition to
 * `FedosProductionMasterSeedAuthority`, a separate file):
 *   - `StaticFedosConversationCreatorIdentityAuthority` (Alpha 904)
 *   - `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority`
 *     (Alpha 870/871) — both already accept the GENERIC
 *     `FedosMasterSeedAuthority` interface, not the concrete Wasm class;
 *     "Wasm" in the name is a historical label, not a type constraint.
 *   - `FixedFedosConversationLocalAccountIndexAuthority` (Alpha 933)
 *   - `FedosSigningAuthorityNostrAuthorBinding` (Alpha 688) — already
 *     accepts the generic `FedosNostrSigningAuthority` interface.
 *
 * Never throws. `publicIdentityForAccount()` failing (no seed held, a
 * locked profile, or any other reason) is the ONLY real failure mode —
 * every other step below is pure, synchronous object construction that
 * cannot fail.
 */

import type { FedosMasterSeedAuthority } from "../../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosNostrSigningAuthority } from "../../../nostr/sign/fedos_nostr_signing_authority.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../../../board/runtime/identity/fedos_nostr_author_binding_authority.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../../construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationParticipantReference } from "../../membership/fedos_conversation_participant_reference.js";
import { FedosWasmConversationEncryptionAuthority } from "../fedos_wasm_conversation_encryption_authority.js";
import { FedosWasmConversationDecryptionAuthority } from "../fedos_wasm_conversation_decryption_authority.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../identity/fedos_conversation_local_account_index_authority.js";
import type { FedosConversationProductionCryptoGraph } from "./fedos_conversation_production_crypto_authority_factory.js";
import type { FedosProductionConversationAeadHandleSource } from "../../../desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.js";
import {
  FedosProductionConversationEncryptionRuntimeBoundary,
  FedosProductionConversationDecryptionRuntimeBoundary,
} from "../../../desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.js";

const U32_MAX = 4_294_967_295;

/**
 * Secure Runtime Alpha 7161-7240 — a pure structural shape check (never
 * `instanceof`, never a concrete-class import), mirroring
 * `isFedosDirectRatchetSealingAuthority()`'s own established discipline
 * (`fedos_desktop_runtime.ts`) for the ONE additional capability
 * `FedosProductionMasterSeedAuthority` provides but the generic
 * `FedosMasterSeedAuthority` interface does not.
 */
function isFedosProductionConversationAeadHandleSource(
  authority: FedosMasterSeedAuthority,
): authority is FedosMasterSeedAuthority & FedosProductionConversationAeadHandleSource {
  const candidate = authority as Partial<FedosProductionConversationAeadHandleSource>;
  return (
    typeof candidate.encryptAead === "function" &&
    typeof candidate.decryptAead === "function" &&
    typeof candidate.serializeAeadCiphertext === "function" &&
    typeof candidate.deserializeAeadCiphertext === "function"
  );
}

/**
 * The canonical, already-activated authorities a real Coordinator holds
 * — never constructed by this factory, only composed. Mirrors
 * `conversationDirectRatchetMasterSeedAuthority`'s own "already-
 * activated canonical production authority" contract exactly.
 */
export interface FedosConversationCanonicalCryptoAuthorityConfig {
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  readonly signingAuthority: FedosNostrSigningAuthority;
  /** The SAME account index the Coordinator's own device/account binding already resolved. */
  readonly accountIndex: number;
}

/**
 * Assembles a `FedosConversationProductionCryptoGraph` over the supplied
 * canonical authorities. Returns `null` (never throws) when the real
 * per-account identity cannot be resolved (e.g. a cleared/locked
 * authority) — the caller falls back to its own existing default,
 * unchanged, exactly like `assembleFedosConversationProductionCryptoGraph()`'s
 * own closed-outcome discipline.
 */
export async function assembleFedosConversationCanonicalProductionCryptoGraph(
  config: FedosConversationCanonicalCryptoAuthorityConfig,
): Promise<FedosConversationProductionCryptoGraph | null> {
  if (!Number.isInteger(config.accountIndex) || config.accountIndex < 0 || config.accountIndex > U32_MAX) {
    return null;
  }

  const identity = await config.signingAuthority.publicIdentityForAccount(config.accountIndex);
  if (identity === null) return null;

  const creator: FedosConversationParticipantReference = Object.freeze({
    authority: "nostr",
    publicIdentifier: identity.publicKeyHex,
    identityId: null,
  });

  // Secure Runtime Alpha 7161-7240 -- when the canonical authority also
  // provides the AEAD bridge (real for `FedosProductionMasterSeedAuthority`),
  // supply the production-safe runtime boundary instead of
  // `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority`'s own
  // default (`fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts`'s
  // dev-only, second-module-instantiation boundary) -- absent, both
  // classes fall back to their own existing default, unchanged.
  const productionBoundarySource = isFedosProductionConversationAeadHandleSource(config.masterSeedAuthority)
    ? config.masterSeedAuthority
    : null;

  return Object.freeze({
    creatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(creator),
    encryptionAuthority: new FedosWasmConversationEncryptionAuthority(
      config.masterSeedAuthority,
      productionBoundarySource !== null ? new FedosProductionConversationEncryptionRuntimeBoundary(productionBoundarySource) : undefined,
    ),
    decryptionAuthority: new FedosWasmConversationDecryptionAuthority(
      config.masterSeedAuthority,
      productionBoundarySource !== null ? new FedosProductionConversationDecryptionRuntimeBoundary(productionBoundarySource) : undefined,
    ),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(config.accountIndex),
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(config.signingAuthority),
    masterSeedAuthority: config.masterSeedAuthority,
  });
}
