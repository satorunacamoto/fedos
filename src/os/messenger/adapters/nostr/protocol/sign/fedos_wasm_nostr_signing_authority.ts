/**
 * Secure Runtime Alpha 445 — the ONE real implementation of
 * `FedosNostrSigningAuthority`. Depends on a `FedosWasmMasterSeedAuthority`
 * (`../../runtime/master_seed/fedos_wasm_master_seed_authority.js`) but
 * never exposes it — only its own internal-use-only accessor is read, and
 * only to reach the opaque WASM handle `sign_nostr_event` runs on.
 *
 * Responsibilities, exactly:
 *   - validate the request (`isWellFormedFedosNostrUnsignedEventRequest`)
 *   - call WASM (`attemptDevOnlyNostrSignEventCall`, `fedos_wasm_loader.ts`)
 *   - normalize and deep-freeze the result
 *
 * Never signs in TypeScript, never selects a Relay, never reads the
 * Outbox, never retries.
 *
 * Nostr Consolidation Plan Step 3/4 — this file used to import
 * `FedosNostrWireEvent` from `../../../../../../desktop/fedos_nostr_wire_event.ts`,
 * a logical backward dependency (this "protocol primitives" layer
 * reaching UP into a desktop-composition-adjacent location for its own
 * output type). It now imports `NostrEvent` from its own `../types.ts` —
 * the SAME type, since Step 1 unified `NostrEvent`/`FedosNostrWireEvent`
 * into one (see `protocol/types.ts`'s own header comment).
 */
import type {
  FedosWasmLoaderNostrPublicIdentityExecution,
  FedosWasmLoaderNostrSignEventExecution,
} from "../../../../../core/vault/wasm/fedos_wasm_loader.js";
import { FedosWasmLoaderSkeleton } from "../../../../../core/vault/wasm/fedos_wasm_loader.js";
import { FedosWasmMasterSeedAuthority } from "../../../../../core/vault/wasm/fedos_wasm_master_seed_authority.js";
import type { NostrEvent } from "../types.js";
import {
  freezeFedosNostrUnsignedEventRequest,
  isWellFormedFedosNostrUnsignedEventRequest,
  type FedosNostrSigningAuthority,
  type FedosNostrUnsignedEventRequest,
} from "./fedos_nostr_signing_authority.js";
import type { FedosNostrSigningPublicIdentity } from "./fedos_nostr_signing_public_identity.js";

const U32_MAX = 4_294_967_295;
const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Matches `FEDOS_NOSTR_TAG_FIELD_SEPARATOR` in `lib.rs` exactly — U+0001, never a legitimate Nostr tag field character. */
const NOSTR_TAG_FIELD_SEPARATOR = "";

/** PRIVATE — the narrow slice of `FedosWasmLoaderSkeleton` this adapter depends on. */
export interface FedosNostrSigningWasmLoaderBoundary {
  attemptDevOnlyNostrSignEventCall(
    authority: unknown,
    accountIndex: number,
    createdAt: number,
    kind: number,
    tags: string[],
    content: string,
  ): Promise<FedosWasmLoaderNostrSignEventExecution>;
  attemptDevOnlyNostrPublicIdentityForAccountCall(
    authority: unknown,
    accountIndex: number,
  ): Promise<FedosWasmLoaderNostrPublicIdentityExecution>;
}

/**
 * Parses a signed-event JSON string this Arc's own Rust
 * `serialize_signed_nostr_event_internal` produced into a deep-frozen
 * `NostrEvent`. This is our OWN signing output (a trusted
 * source, not untrusted network input) — still fails closed (`null`,
 * never throws) on any unexpected shape.
 */
function parseSignedNostrWireEventJson(json: string): NostrEvent | null {
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

export class FedosWasmNostrSigningAuthority implements FedosNostrSigningAuthority {
  readonly #masterSeedAuthority: FedosWasmMasterSeedAuthority;
  readonly #loaderBoundary: FedosNostrSigningWasmLoaderBoundary;

  constructor(
    masterSeedAuthority?: FedosWasmMasterSeedAuthority,
    loaderBoundary?: FedosNostrSigningWasmLoaderBoundary,
  ) {
    this.#masterSeedAuthority = masterSeedAuthority ?? new FedosWasmMasterSeedAuthority();
    this.#loaderBoundary = loaderBoundary ?? new FedosWasmLoaderSkeleton();
  }

  async signEvent(request: FedosNostrUnsignedEventRequest): Promise<NostrEvent | null> {
    if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
    const frozen = freezeFedosNostrUnsignedEventRequest(request);

    const flatTags = frozen.tags.map((tag) => tag.join(NOSTR_TAG_FIELD_SEPARATOR));

    const authority = await this.#masterSeedAuthority.accessForNostrSigningAuthorityInternalUse();
    if (!authority) return null;

    const result = await this.#loaderBoundary.attemptDevOnlyNostrSignEventCall(
      authority,
      frozen.accountIndex,
      frozen.createdAt,
      frozen.kind,
      flatTags,
      frozen.content,
    );
    if (!result.succeeded || result.signedEventJson === null) return null;

    return parseSignedNostrWireEventJson(result.signedEventJson);
  }

  /**
   * Secure Runtime Alpha 684 — derives `accountIndex`'s public identity
   * without signing. `accountIndex` is validated as a `u32` exactly like
   * `signEvent()`'s own field (Alpha 442); an out-of-range or
   * non-integer value fails closed to `null` before the WASM boundary is
   * ever reached. Never returns a secret byte.
   */
  async publicIdentityForAccount(accountIndex: number): Promise<FedosNostrSigningPublicIdentity | null> {
    if (typeof accountIndex !== "number" || !Number.isInteger(accountIndex) || accountIndex < 0 || accountIndex > U32_MAX) {
      return null;
    }

    const authority = await this.#masterSeedAuthority.accessForNostrSigningAuthorityInternalUse();
    if (!authority) return null;

    const result = await this.#loaderBoundary.attemptDevOnlyNostrPublicIdentityForAccountCall(authority, accountIndex);
    if (!result.succeeded || result.publicKeyHex === null || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(result.publicKeyHex)) {
      return null;
    }

    return Object.freeze({ accountIndex, publicKeyHex: result.publicKeyHex });
  }
}

/** Builds a `FedosNostrSigningAuthority` backed by the real WASM loader and a fresh `FedosWasmMasterSeedAuthority`. Pure; never throws. */
export function createFedosWasmNostrSigningAuthority(): FedosNostrSigningAuthority {
  return new FedosWasmNostrSigningAuthority();
}
