/**
 * Secure Runtime Alpha 442/445 — the Nostr Signing request model and the
 * TypeScript-facing Nostr Signing Authority contract.
 * `FedosWasmNostrSigningAuthority`
 * (`fedos_wasm_nostr_signing_authority.ts`) is this repository's ONE
 * implementation.
 *
 * V1 policy (fixed by Secure Runtime Alpha 424's own scope decision,
 * reused unchanged here):
 *   - `kind` is fixed to `1` — no other kind is accepted.
 *   - `accountIndex` is a `u32` (0..=4294967295).
 *   - `createdAt` is Unix seconds, a non-negative integer.
 *   - no caller-supplied `pubkey`/`id`/`sig` field exists on this type.
 *   - no Relay destination, no Outbox identifier, no arbitrary metadata.
 *
 * Output reuses the EXISTING `FedosNostrWireEvent` shape
 * (`src/desktop/fedos_nostr_wire_event.ts`, Secure Runtime Alpha 234)
 * rather than a fourth duplicate signed-event type (Secure Runtime
 * Alpha 426's own reuse decision).
 *
 * Secure Runtime Alpha 1399/1402 (Alpha 1391–1470 Nostr Private Direct
 * and Pairwise Fanout Delivery Arc) — ADDITIVE extension: the closed
 * kind allowlist now also accepts `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND`
 * (`../../conversation/delivery/nostr/fedos_private_nostr_delivery_mode.ts`),
 * a FedOS-proprietary, disclosed non-standard kind — NOT NIP-17, NOT any
 * registered NIP. This is the minimal change required for Alpha 1447's
 * own "no private plaintext in a public kind-1 event" requirement to be
 * satisfiable at all; every other field/behavior in this file is
 * unchanged (still `kind` is a fixed CLOSED SET of exactly two values,
 * never an arbitrary caller-chosen number).
 */
import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import type { FedosNostrSigningPublicIdentity } from "./fedos_nostr_signing_public_identity.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "../../conversation/delivery/nostr/fedos_private_nostr_delivery_mode.js";

export interface FedosNostrUnsignedEventRequest {
  readonly accountIndex: number;
  readonly createdAt: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
}

/** The one reserved character no tag field may contain — this Arc's own WASM wire separator (Secure Runtime Alpha 442). */
const NOSTR_TAG_FIELD_SEPARATOR = "";
/** Alpha 424's original public-post kind, plus Alpha 1399/1402's additive private-delivery kind — see this file's own header. A CLOSED set of exactly two, never an arbitrary caller-chosen number. */
/**
 * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
 * Delivery Arc") Phase D (Alpha 1774) — NIP-59's Seal kind, added to the
 * closed allowlist below. The Seal MUST be signed by the REAL sender
 * identity (NIP-17's own impersonation guard: "Clients MUST verify if
 * pubkey of the kind:13 is the same pubkey as that of the
 * unsignedMessageRumor" only holds if the Seal is genuinely signed by
 * the real account) — never the ephemeral Gift-Wrap key (kinds
 * 1059/21059), which uses a wholly separate, narrower authority
 * (`../../conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts`)
 * that never touches the Master Seed and is therefore structurally
 * incapable of appearing in this file's own allowlist.
 */
export const FEDOS_NIP59_SEAL_KIND = 13;
const SUPPORTED_NOSTR_KINDS: ReadonlySet<number> = new Set([1, FEDOS_PRIVATE_NOSTR_DELIVERY_KIND, FEDOS_NIP59_SEAL_KIND]);
const U32_MAX = 4_294_967_295;

/**
 * Structural validation for `FedosNostrUnsignedEventRequest` — rejects
 * any extra/missing property, any non-`1` `kind`, any out-of-range or
 * non-integer `accountIndex`/`createdAt`, any empty tag, and any tag
 * field containing the reserved wire separator. Never throws.
 */
export function isWellFormedFedosNostrUnsignedEventRequest(
  candidate: unknown,
): candidate is FedosNostrUnsignedEventRequest {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 5) return false;
  if (
    !("accountIndex" in value) ||
    !("createdAt" in value) ||
    !("kind" in value) ||
    !("tags" in value) ||
    !("content" in value)
  ) {
    return false;
  }
  if (
    typeof value.accountIndex !== "number" ||
    !Number.isInteger(value.accountIndex) ||
    value.accountIndex < 0 ||
    value.accountIndex > U32_MAX
  ) {
    return false;
  }
  if (
    typeof value.createdAt !== "number" ||
    !Number.isFinite(value.createdAt) ||
    !Number.isInteger(value.createdAt) ||
    value.createdAt < 0
  ) {
    return false;
  }
  if (typeof value.kind !== "number" || !SUPPORTED_NOSTR_KINDS.has(value.kind)) return false;
  if (!Array.isArray(value.tags)) return false;
  for (const tag of value.tags) {
    if (!Array.isArray(tag) || tag.length === 0) return false;
    for (const field of tag) {
      if (typeof field !== "string" || field.includes(NOSTR_TAG_FIELD_SEPARATOR)) return false;
    }
  }
  if (typeof value.content !== "string") return false;
  return true;
}

/**
 * Deep-copies and deep-freezes an already-validated request, severing any
 * shared reference to the caller's own (possibly still-mutable) `tags`
 * arrays. Callers must validate via
 * `isWellFormedFedosNostrUnsignedEventRequest()` first.
 */
export function freezeFedosNostrUnsignedEventRequest(
  request: FedosNostrUnsignedEventRequest,
): FedosNostrUnsignedEventRequest {
  const tags = Object.freeze(request.tags.map((tag) => Object.freeze([...tag])));
  return Object.freeze({
    accountIndex: request.accountIndex,
    createdAt: request.createdAt,
    kind: request.kind,
    tags,
    content: request.content,
  });
}

export interface FedosNostrSigningAuthority {
  signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null>;
  /**
   * Secure Runtime Alpha 684 — derives the given account's public
   * identity WITHOUT signing anything. `accountIndex` is a `u32`
   * (0..=4294967295), matching `signEvent()`'s own `accountIndex` field
   * exactly — the SAME account index passed here and to `signEvent()`
   * always yields the matching `publicKeyHex`/`pubkey` pair (proven by
   * `FedosNostrAuthorBindingAuthority`, `src/board/runtime/identity/`).
   * `null` when no Master Seed is currently held or any derivation step
   * fails — fail closed, never a panic, never a secret byte.
   */
  publicIdentityForAccount(accountIndex: number): Promise<FedosNostrSigningPublicIdentity | null>;
}
