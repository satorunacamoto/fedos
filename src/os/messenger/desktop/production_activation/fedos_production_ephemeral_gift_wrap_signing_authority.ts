/**
 * Secure Runtime Alpha 7161-7240 — the production-path ephemeral Gift
 * Wrap signing authority, backed by REAL WASM through the SAME opaque
 * Master Seed authority handle the production activation path already
 * holds — NOT the dev-only `FedosWasmLoaderSkeleton` boundary.
 *
 * WHY THIS EXISTS (verified against real source, not assumed):
 * `FedosWasmEphemeralGiftWrapSigningAuthority`
 * (`../../conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts`)
 * is the only existing implementer of `FedosEphemeralGiftWrapSigningAuthority`,
 * but it reaches WASM through
 * `FedosWasmLoaderSkeleton.attemptDevOnlyBuildAndSignGiftWrapCall()`,
 * gated behind `devGate.developmentAllowed` (the dev-only `NODE_ENV`
 * gate) — exactly the "second, independent, `NODE_ENV`-gated" pattern
 * Alpha 6841-6920 already eliminated for Direct Ratchet and this Arc's
 * own `fedos_conversation_canonical_production_crypto_authority_factory.ts`
 * eliminated for Conversation-level identity/encryption. This adapter
 * calls the SAME real `build_and_sign_nip17_gift_wrap` Rust export the
 * dev-only loader ultimately calls, through
 * `FedosProductionMasterSeedAuthority.buildEphemeralGiftWrap()` (this
 * Arc's own new, narrow accessor) — with the identical request
 * validation and fail-closed discipline, but no `NODE_ENV` dependency.
 *
 * The ephemeral secret this Rust export draws is NEVER derived from the
 * Master Seed and NEVER crosses the WASM boundary in either direction
 * (see `build_and_sign_nip17_gift_wrap`'s own doc comment) — this
 * adapter only supplies the ALREADY-PUBLIC recipient key and the
 * caller-supplied Seal ciphertext, and only ever reads back a complete,
 * already-signed event.
 */
import type { FedosNostrWireEvent } from "../fedos_nostr_wire_event.js";
import type { FedosEphemeralGiftWrapSigningAuthority } from "../../adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { FEDOS_GIFT_WRAP_KIND, FEDOS_EPHEMERAL_GIFT_WRAP_KIND } from "../../adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * The narrow structural port this adapter needs — anything able to
 * build and sign one ephemeral Gift Wrap. `FedosProductionMasterSeedAuthority`
 * satisfies it via its own `buildEphemeralGiftWrap()`; nothing else is
 * required, so the coupling to the production authority is by shape
 * only — mirrors `FedosProductionNostrSigningHandleSource`'s own exact
 * discipline (`fedos_production_nostr_signing_authority.ts`).
 */
export interface FedosProductionEphemeralGiftWrapHandleSource {
  buildEphemeralGiftWrap(
    recipientPublicKeyHex: string,
    createdAt: number,
    kind: number,
    contentPlaintext: Uint8Array,
  ): string | null;
}

/**
 * Parses a signed-event JSON string the Rust
 * `serialize_signed_nostr_event_internal` produced into a deep-frozen
 * `FedosNostrWireEvent`. Deliberately duplicated (not imported) from
 * `FedosWasmEphemeralGiftWrapSigningAuthority`'s own private helper of
 * the same shape — mirrors that file's own "this Arc's own authority is
 * intentionally independent" discipline exactly.
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

export class FedosProductionEphemeralGiftWrapSigningAuthority implements FedosEphemeralGiftWrapSigningAuthority {
  readonly #handleSource: FedosProductionEphemeralGiftWrapHandleSource;

  constructor(handleSource: FedosProductionEphemeralGiftWrapHandleSource) {
    this.#handleSource = handleSource;
  }

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

    let signedEventJson: string | null;
    try {
      signedEventJson = this.#handleSource.buildEphemeralGiftWrap(recipientPublicKeyHex, createdAt, kind, contentPlaintext);
    } catch {
      return null;
    }
    if (signedEventJson === null) return null;
    return parseSignedNostrWireEventJson(signedEventJson);
  }
}
