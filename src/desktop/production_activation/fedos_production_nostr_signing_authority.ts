/**
 * Secure Runtime Alpha 4821-4900 — the production-path Nostr Signing
 * Authority, backed by REAL WASM through the SAME opaque Master Seed
 * authority handle the production activation path already holds — NOT the
 * dev-only `FedosWasmLoaderSkeleton` boundary and NOT the development seed
 * double.
 *
 * WHY THIS EXISTS (verified against real source, not assumed):
 * `FedosWasmNostrSigningAuthority`
 * (`../../nostr/sign/fedos_wasm_nostr_signing_authority.ts`) is the only
 * existing `FedosNostrSigningAuthority` that derives an account identity /
 * signs from the Master Seed, but it reaches WASM through
 * `FedosWasmLoaderSkeleton.attemptDevOnlyNostrPublicIdentityForAccountCall()`
 * / `attemptDevOnlyNostrSignEventCall()`, both of which are gated behind
 * `devGate.developmentAllowed` (the dev-only `NODE_ENV` gate). Reusing that
 * loader on the packaged production path would be exactly the prohibited
 * "silently downgrade to the dev-only loader". So this adapter calls the
 * opaque handle's own `public_key_hex_for_account()` / `sign_nostr_event()`
 * methods DIRECTLY — the identical Rust methods the dev loader ultimately
 * calls — with the identical request validation and fail-closed discipline,
 * but no `NODE_ENV` dependency.
 *
 * It shares the SAME underlying WASM authority handle as the production
 * `FedosMasterSeedAuthority` (via its module-internal
 * `accessForNostrSigningAuthorityInternalUse()` accessor), so the derived
 * account identity always reflects the seed currently held — the freshly
 * generated seed after `createProfile`, or the restored seed after
 * `unlockProfile` — and is therefore STABLE across a real process relaunch
 * (the seed is the account). It never exposes the handle, never exposes a
 * secret byte, and never signs in TypeScript.
 */

import type { FedosMasterSeedAuthorityHandle } from "../../runtime/fedos_wasm_loader.js";
import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import {
  freezeFedosNostrUnsignedEventRequest,
  isWellFormedFedosNostrUnsignedEventRequest,
  type FedosNostrSigningAuthority,
  type FedosNostrUnsignedEventRequest,
} from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrSigningPublicIdentity } from "../../nostr/sign/fedos_nostr_signing_public_identity.js";

const U32_MAX = 4_294_967_295;
const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
/** Matches `FEDOS_NOSTR_TAG_FIELD_SEPARATOR` in `lib.rs` and `FedosWasmNostrSigningAuthority` exactly — U+0001, never a legitimate tag field character. */
const NOSTR_TAG_FIELD_SEPARATOR = "";

/**
 * The narrow structural port this adapter needs — anything able to hand
 * back the opaque, method-bearing WASM authority handle that currently
 * holds the seed. `FedosProductionMasterSeedAuthority` satisfies it via its
 * own `accessForNostrSigningAuthorityInternalUse()`; nothing else is
 * required, so the coupling to the production authority is by shape only.
 */
export interface FedosProductionNostrSigningHandleSource {
  accessForNostrSigningAuthorityInternalUse(): Promise<FedosMasterSeedAuthorityHandle | null>;
}

/**
 * Parses a signed-event JSON string the Rust
 * `serialize_signed_nostr_event_internal` produced into a deep-frozen
 * `FedosNostrWireEvent`. Our OWN signing output (trusted source), still
 * fails closed (`null`, never throws) on any unexpected shape. Mirrors
 * `FedosWasmNostrSigningAuthority`'s own private parser exactly.
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

export class FedosProductionNostrSigningAuthority implements FedosNostrSigningAuthority {
  readonly #handleSource: FedosProductionNostrSigningHandleSource;

  constructor(handleSource: FedosProductionNostrSigningHandleSource) {
    this.#handleSource = handleSource;
  }

  async signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null> {
    if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
    const frozen = freezeFedosNostrUnsignedEventRequest(request);
    const flatTags = frozen.tags.map((tag) => tag.join(NOSTR_TAG_FIELD_SEPARATOR));

    const handle = await this.#handleSource.accessForNostrSigningAuthorityInternalUse();
    if (handle === null) return null;

    let signedEventJson: string | undefined;
    try {
      signedEventJson = handle.sign_nostr_event(
        frozen.accountIndex,
        frozen.createdAt,
        frozen.kind,
        flatTags,
        frozen.content,
      );
    } catch {
      return null;
    }
    if (typeof signedEventJson !== "string") return null;
    return parseSignedNostrWireEventJson(signedEventJson);
  }

  async publicIdentityForAccount(accountIndex: number): Promise<FedosNostrSigningPublicIdentity | null> {
    if (
      typeof accountIndex !== "number" ||
      !Number.isInteger(accountIndex) ||
      accountIndex < 0 ||
      accountIndex > U32_MAX
    ) {
      return null;
    }

    const handle = await this.#handleSource.accessForNostrSigningAuthorityInternalUse();
    if (handle === null) return null;

    let publicKeyHex: string | undefined;
    try {
      publicKeyHex = handle.public_key_hex_for_account(accountIndex);
    } catch {
      return null;
    }
    if (typeof publicKeyHex !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(publicKeyHex)) {
      return null;
    }
    return Object.freeze({ accountIndex, publicKeyHex });
  }
}
