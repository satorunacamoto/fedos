/**
 * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
 * Delivery Arc") Phase E/F (Alpha 1777–1780, 1782/1785/1786) — the ONE
 * real ephemeral Gift-Wrap construction authority. Calls
 * `FedosWasmLoaderSkeleton.attemptDevOnlyBuildAndSignGiftWrapCall()`
 * (`../../../../runtime/fedos_wasm_loader.js`) — a FREE, module-level
 * WASM export (`build_and_sign_nip17_gift_wrap`, NOT a method on any
 * `FedosMasterSeedAuthority` handle) that draws a brand-new CSPRNG
 * secp256k1 key INSIDE Rust for every single call, ECDHs it against the
 * recipient's public key, NIP-44-encrypts the caller-supplied content
 * under the resulting conversation key, signs the resulting event with
 * the SAME ephemeral key, then clears both — never derived from the
 * Master Seed, never persisted, never returned to TypeScript in any
 * form.
 *
 * NIP-59's own Gift Wrap encrypts to the recipient via
 * `conversation_key(wrapperPrivateKey, receiverPublicKey)` — an ECDH
 * between the ephemeral secret and the recipient's public key, which is
 * why this is NOT simply "sign an already-built event" (unlike a plain
 * signing authority): the encrypt step itself depends on the SAME
 * ephemeral secret the signature does, and that secret must never cross
 * the WASM boundary — so the encrypt and the sign happen together,
 * atomically, inside the one Rust call this class wraps.
 *
 * "Single-use lifecycle" (Alpha 1779: after signing, further signing
 * denied, private material not retained, no cross-recipient/retry reuse)
 * is enforced trivially and structurally by this class: it never holds
 * a key-shaped value of any kind between calls, so there is nothing here
 * that COULD be reused. Calling [`buildGiftWrap`] twice — even with
 * identical arguments — always produces two cryptographically
 * independent outer identities (different pubkey, different ciphertext,
 * different signature, different event id). This is this Arc's own
 * Alpha 1780 retry-strategy decision made concrete: Option C ("reuse an
 * ephemeral private key") is not merely discouraged, it is structurally
 * unreachable through this boundary. A caller that needs the SAME outer
 * Gift Wrap bytes across a retry (Alpha 1780 Option A) must persist the
 * signed event this method already returned; a caller content with a
 * fresh outer identity per retry (Option B) simply calls this method
 * again — see the completion declaration for this Arc's own chosen
 * strategy.
 *
 * Never used for Seal signing (`FedosNostrSigningAuthority`/
 * `FedosWasmNostrSigningAuthority`, `../../../../nostr/sign/`, uses the
 * REAL sender identity instead, unchanged) — this class exists
 * exclusively for the Gift Wrap's own outer, unlinkable identity.
 */
import type { FedosWasmLoaderGiftWrapBuildExecution } from "../../../../../../runtime/fedos_wasm_loader.js";
import { FedosWasmLoaderSkeleton } from "../../../../../../runtime/fedos_wasm_loader.js";
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";

/** NIP-59's own two Gift-Wrap kinds — the ONLY `kind` values this authority ever builds. Matches the Rust boundary's own closed `kind` check exactly (`build_and_sign_nip17_gift_wrap`, `lib.rs`) — this is defense in depth, not the sole guard. */
export const FEDOS_GIFT_WRAP_KIND = 1059;
export const FEDOS_EPHEMERAL_GIFT_WRAP_KIND = 21059;

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** PRIVATE — the narrow slice of `FedosWasmLoaderSkeleton` this authority depends on. */
export interface FedosEphemeralGiftWrapSigningWasmLoaderBoundary {
  attemptDevOnlyBuildAndSignGiftWrapCall(
    recipientPublicKeyHex: string,
    createdAt: number,
    kind: number,
    contentPlaintext: Uint8Array,
  ): Promise<FedosWasmLoaderGiftWrapBuildExecution>;
}

/**
 * Parses a signed-event JSON string this Arc's own Rust
 * `serialize_signed_nostr_event_internal` produced into a deep-frozen
 * `FedosNostrWireEvent`. Deliberately duplicated (not imported) from
 * `FedosWasmNostrSigningAuthority`'s own private helper of the same
 * shape (`../../../../nostr/sign/fedos_wasm_nostr_signing_authority.ts`)
 * — this is our OWN construction output (a trusted source, not
 * untrusted network input), and this file's own authority is
 * intentionally independent of that one. Still fails closed (`null`,
 * never throws) on any unexpected shape.
 */
function parseSignedNostrWireEventJson(json: string): FedosNostrWireEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.pubkey !== "string" ||
    typeof candidate.created_at !== "number" ||
    typeof candidate.kind !== "number" ||
    !Array.isArray(candidate.tags) ||
    typeof candidate.content !== "string" ||
    typeof candidate.sig !== "string"
  ) {
    return null;
  }
  const tags: string[][] = [];
  for (const tag of candidate.tags) {
    if (!Array.isArray(tag) || !tag.every((field) => typeof field === "string")) return null;
    tags.push(Object.freeze([...tag]) as string[]);
  }
  return Object.freeze({
    id: candidate.id,
    pubkey: candidate.pubkey,
    created_at: candidate.created_at,
    kind: candidate.kind,
    tags: Object.freeze(tags),
    content: candidate.content,
    sig: candidate.sig,
  });
}

/**
 * Secure Runtime Alpha 7161-7240 — the narrow, structurally-typed
 * capability `fedos_nip59_gift_wrap.ts`/`NostrNip17V1WireAdapter`
 * actually need (`buildGiftWrap()` only), mirroring
 * `FedosMasterSeedAuthority`'s own generic-interface discipline for
 * `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority`
 * exactly. `FedosWasmEphemeralGiftWrapSigningAuthority` (below)
 * implements it unchanged; `FedosProductionEphemeralGiftWrapSigningAuthority`
 * (`../../../../desktop/production_activation/fedos_production_ephemeral_gift_wrap_signing_authority.ts`)
 * is the second, production-safe implementer this Arc adds.
 */
export interface FedosEphemeralGiftWrapSigningAuthority {
  buildGiftWrap(
    recipientPublicKeyHex: string,
    createdAt: number,
    kind: number,
    contentPlaintext: Uint8Array,
  ): Promise<FedosNostrWireEvent | null>;
}

export class FedosWasmEphemeralGiftWrapSigningAuthority implements FedosEphemeralGiftWrapSigningAuthority {
  readonly #loaderBoundary: FedosEphemeralGiftWrapSigningWasmLoaderBoundary;

  constructor(loaderBoundary?: FedosEphemeralGiftWrapSigningWasmLoaderBoundary) {
    this.#loaderBoundary = loaderBoundary ?? new FedosWasmLoaderSkeleton();
  }

  /**
   * Builds ONE Gift-Wrap event: a fresh, single-use ephemeral key is
   * drawn, ECDH'd against `recipientPublicKeyHex`, used to NIP-44
   * wire-encrypt `contentPlaintext` (the caller-supplied Seal
   * serialization — this method performs NO Seal construction of its
   * own), then used to sign the resulting `["p", recipient]`-tagged
   * event. `kind` must be exactly [`FEDOS_GIFT_WRAP_KIND`] or
   * [`FEDOS_EPHEMERAL_GIFT_WRAP_KIND`] — anything else fails closed
   * before the WASM boundary is ever reached (this authority is not a
   * generic anonymous-signing oracle). `null` on ANY failure (malformed
   * input, CSPRNG unavailable, an invalid/off-curve recipient key, or
   * any internal construction failure) — fail closed, never a panic,
   * never a partial event.
   */
  async buildGiftWrap(
    recipientPublicKeyHex: string,
    createdAt: number,
    kind: number,
    contentPlaintext: Uint8Array,
  ): Promise<FedosNostrWireEvent | null> {
    if (kind !== FEDOS_GIFT_WRAP_KIND && kind !== FEDOS_EPHEMERAL_GIFT_WRAP_KIND) return null;
    if (typeof createdAt !== "number" || !Number.isFinite(createdAt) || !Number.isInteger(createdAt) || createdAt < 0) {
      return null;
    }
    if (typeof recipientPublicKeyHex !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(recipientPublicKeyHex)) {
      return null;
    }
    if (!(contentPlaintext instanceof Uint8Array) || contentPlaintext.length === 0) return null;

    const result = await this.#loaderBoundary.attemptDevOnlyBuildAndSignGiftWrapCall(
      recipientPublicKeyHex,
      createdAt,
      kind,
      contentPlaintext,
    );
    if (!result.succeeded || result.signedEventJson === null) return null;
    return parseSignedNostrWireEventJson(result.signedEventJson);
  }
}

/** Builds a `FedosWasmEphemeralGiftWrapSigningAuthority` backed by the real WASM loader. Pure; never throws. */
export function createFedosWasmEphemeralGiftWrapSigningAuthority(): FedosWasmEphemeralGiftWrapSigningAuthority {
  return new FedosWasmEphemeralGiftWrapSigningAuthority();
}
