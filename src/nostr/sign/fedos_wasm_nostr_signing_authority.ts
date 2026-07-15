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
 */
import type { FedosWasmLoaderNostrSignEventExecution } from "../../runtime/fedos_wasm_loader.js";
import { FedosWasmLoaderSkeleton } from "../../runtime/fedos_wasm_loader.js";
import { FedosWasmMasterSeedAuthority } from "../../runtime/master_seed/fedos_wasm_master_seed_authority.js";
import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import {
  freezeFedosNostrUnsignedEventRequest,
  isWellFormedFedosNostrUnsignedEventRequest,
  type FedosNostrSigningAuthority,
  type FedosNostrUnsignedEventRequest,
} from "./fedos_nostr_signing_authority.js";

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
}

/**
 * Parses a signed-event JSON string this Arc's own Rust
 * `serialize_signed_nostr_event_internal` produced into a deep-frozen
 * `FedosNostrWireEvent`. This is our OWN signing output (a trusted
 * source, not untrusted network input) — still fails closed (`null`,
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

  async signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null> {
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
}

/** Builds a `FedosNostrSigningAuthority` backed by the real WASM loader and a fresh `FedosWasmMasterSeedAuthority`. Pure; never throws. */
export function createFedosWasmNostrSigningAuthority(): FedosNostrSigningAuthority {
  return new FedosWasmNostrSigningAuthority();
}
