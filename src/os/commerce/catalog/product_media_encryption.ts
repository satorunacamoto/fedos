/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (§8:
 * "Encrypt-before-content-addressing").
 *
 * REQUIRED FLOW for `classification: "protected"` media (§8, verbatim):
 * plaintext -> encrypt locally -> ciphertext -> content-address the
 * CIPHERTEXT -> store/reference. Never expose a plaintext hash by
 * default. This file is the orchestration of that pipeline —
 * `encryptThenContentAddressProtectedMedia()` below — PLUS an explicit
 * account of why the actual encryption STEP is a Port, not a wired
 * implementation, in this pass.
 *
 * ============================================================
 * WHY THIS DOES NOT WIRE A REAL ENCRYPTION ADAPTER (read before use)
 * ============================================================
 * This arc's own instruction is explicit: "Do NOT invent custom
 * cryptography... Reuse existing FedOS primitives... find and reuse, do
 * not add a new crypto dependency or hand-roll anything," and to STOP
 * and report (not force through) if "encrypt-before-CAS can't be done
 * with existing primitives without inventing crypto." That is exactly
 * the situation found here, verified by direct inspection:
 *
 *   1. This repository's ONLY real symmetric-AEAD encryption primitive
 *      is the Rust/WASM Runtime path
 *      (`src/os/core/vault/wasm/fedos_runtime_encrypt.ts`'s `encrypt()`).
 *      It requires an opaque `AeadKeyHandle` resolved by
 *      `FedosMasterSeedAuthority.resolveConversationKey()` — a key
 *      derivation that is intrinsically Conversation-shaped
 *      (`localAccountIndex` + `counterpartyPublicKeyHex`, i.e. a Double
 *      Ratchet session). Product media has no conversation, no
 *      counterparty, and no ratchet session — there is no key to resolve
 *      here, not a missing wiring step but a missing CONCEPT.
 *   2. `encrypt()`'s `aadDomain` parameter is `AeadAadDomain =
 *      "RootKey" | "Identity" | "Storage" | "Conversation" | "TestOnly"`
 *      (`src/os/core/vault/wasm/fedos_wasm_loader.ts:1408`) — a CLOSED
 *      union mirrored 1:1 against a Rust-side numeric discriminant.
 *      There is no `"Commerce"` variant. Adding one means editing the
 *      Rust boundary (`lib.rs`) and regenerating the compiled WASM
 *      artifact — a cross-cutting, Architecture-Frozen change (per this
 *      file's own encryption-authority precedent's comments) squarely
 *      outside `src/os/commerce/`'s lane, and this worktree has no
 *      compiled `pkg/` artifact to even test against regardless.
 *   3. No pure-JS AEAD cipher (e.g. `@noble/ciphers`) is an existing
 *      dependency of this repository (`package.json`'s three production
 *      dependencies are `@noble/curves`, `@noble/hashes`, `qrcode` — no
 *      cipher). Adding one would be "a new crypto dependency," expressly
 *      forbidden.
 *   4. `crypto.subtle` (WebCrypto) IS available in this runtime and
 *      COULD perform AES-GCM without a new dependency — but no existing
 *      FedOS code path uses it for encryption (only for SHA-256 hashing,
 *      `src/os/messenger/adapters/nostr/protocol/crypto.ts`); this
 *      codebase's own established, reviewed encryption boundary is the
 *      Rust/WASM path exclusively. Reaching for WebCrypto here would be
 *      standing up a SECOND, unreviewed encryption code path for secret
 *      material — indistinguishable in risk from hand-rolling — not
 *      "reusing an existing FedOS primitive."
 *
 * CONCLUSION (reported to the coordinator, not force-worked-around):
 * wiring real encryption for protected product media needs a decision
 * this agent cannot make unilaterally — a new `AeadAadDomain` variant
 * (Rust+WASM+regenerated artifact) or an equivalent new key-domain
 * concept — which is a security-boundary decision, not a commerce-domain
 * implementation detail. What THIS file ships instead:
 *
 *   - `ProductMediaEncryptionPort` — an injectable seam shaped to match
 *     the real primitive's own contract as closely as possible
 *     (`Uint8Array -> Promise<Uint8Array | null>`, Fail Closed on `null`,
 *     mirrors `encrypt()`'s own "never throws, `null` on any failure"
 *     guarantee) so a FUTURE real adapter (once the AAD-domain decision
 *     above is made) can satisfy it without changing any caller.
 *   - `UnavailableProductMediaEncryption` — the SAFE DEFAULT, mirroring
 *     this codebase's own `NoopPaymentProvider`/`NoopMarketplaceProvider`
 *     convention: always reports encryption as unavailable, NEVER
 *     silently falls back to storing plaintext.
 *   - `encryptThenContentAddressProtectedMedia()` — the real §8
 *     pipeline: calls the injected Port, and ONLY on a genuine ciphertext
 *     result does it compute a content hash (over the ciphertext, never
 *     the plaintext) via `computeCommerceMediaContentHash()`
 *     (`./product_media_content_address.ts`). Any encryption failure
 *     (including the safe default's permanent "unavailable") yields
 *     `{ outcome: "encryption-unavailable" }` — the caller MUST NOT store
 *     anything, and MUST NOT fall back to `classification: "public"`
 *     silently.
 *
 * PUBLIC (`classification: "public"`) media needs none of this — see
 * `contentAddressPublicMedia()` below, which content-addresses plaintext
 * bytes directly, exactly as §8 permits for explicitly-classified public
 * media.
 */

import { computeCommerceMediaContentHash } from "./product_media_content_address.js";
import type { ProductMediaChecksumSubject } from "./product_media_types.js";

/**
 * Injectable encryption seam for protected product media. Shaped to
 * mirror `encrypt()`'s own Fail-Closed contract
 * (`src/os/core/vault/wasm/fedos_runtime_encrypt.ts`) as closely as a
 * commerce-domain-safe (no `os/messenger`/`os/core/vault` import) type
 * can: `Promise<Uint8Array | null>`, never throws, `null` means
 * "could not encrypt, do not proceed."
 */
export interface ProductMediaEncryptionPort {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array | null>;
}

/**
 * The SAFE DEFAULT — mirrors `NoopPaymentProvider`/`NoopMarketplaceProvider`'s
 * own "does nothing, but never lies about it" convention
 * (`../payment/noop_payment.ts`, `../marketplace/noop_marketplace.ts`).
 * Always resolves `null`: encryption is permanently unavailable until a
 * real adapter is injected. Never used to smuggle plaintext through as
 * if it were ciphertext.
 */
export class UnavailableProductMediaEncryption implements ProductMediaEncryptionPort {
  async encrypt(_plaintext: Uint8Array): Promise<Uint8Array | null> {
    return null;
  }
}

export interface ProtectedMediaContentAddressResult {
  readonly ciphertext: Uint8Array;
  readonly checksum: string;
  readonly checksumSubject: Extract<ProductMediaChecksumSubject, "ciphertext">;
}

export type EncryptThenContentAddressResult =
  | ({ readonly outcome: "ok" } & ProtectedMediaContentAddressResult)
  | { readonly outcome: "encryption-unavailable" };

/**
 * The §8 pipeline for `classification: "protected"` media: plaintext ->
 * encrypt (via the injected Port) -> ciphertext -> content-address the
 * CIPHERTEXT. Returns `{ outcome: "encryption-unavailable" }` — never a
 * plaintext hash, never a silent downgrade to public — if the Port
 * cannot produce ciphertext (including the default `Unavailable...`
 * Port, or any real future adapter's own genuine failure).
 */
export async function encryptThenContentAddressProtectedMedia(
  plaintext: Uint8Array,
  encryption: ProductMediaEncryptionPort,
): Promise<EncryptThenContentAddressResult> {
  let ciphertext: Uint8Array | null;
  try {
    ciphertext = await encryption.encrypt(plaintext);
  } catch {
    ciphertext = null;
  }
  if (ciphertext === null) {
    return { outcome: "encryption-unavailable" };
  }
  return {
    outcome: "ok",
    ciphertext,
    checksum: computeCommerceMediaContentHash(ciphertext),
    checksumSubject: "ciphertext",
  };
}

export interface PublicMediaContentAddressResult {
  readonly checksum: string;
  readonly checksumSubject: Extract<ProductMediaChecksumSubject, "plaintext">;
}

/**
 * The §8-permitted shortcut for `classification: "public"` media ONLY:
 * content-addresses the PLAINTEXT bytes directly — no encryption step,
 * because the caller has already explicitly classified this media as
 * public (never inferred here). Callers must not use this for anything
 * classified `"protected"`; `validateProductMedia()`
 * (`./product_media_types.ts`) rejects a `"protected"` record carrying a
 * `checksumSubject: "plaintext"` regardless.
 */
export function contentAddressPublicMedia(plaintext: Uint8Array): PublicMediaContentAddressResult {
  return { checksum: computeCommerceMediaContentHash(plaintext), checksumSubject: "plaintext" };
}
