/**
 * NIP-01 core event types.
 * See: https://github.com/nostr-protocol/nips/blob/master/01.md
 *
 * Stage 1 scope: read-only ingest. We model the wire shape only — no signing,
 * no key material. Signature *verification* is defined as an injectable adapter
 * so the heavy crypto dependency can be added later without touching callers.
 *
 * Nostr Consolidation Plan, Step 1 (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`)
 * — `NostrEvent` is now the ONE canonical event type for this codebase,
 * reconciled against `FedosNostrWireEvent` (formerly a second, independent
 * type at `src/os/messenger/desktop/fedos_nostr_wire_event.ts`, Secure
 * Runtime Alpha 234). Side-by-side comparison found the two shapes were
 * ALREADY identical on every field name (`id`, `pubkey`, `created_at`,
 * `kind`, `tags`, `content`, `sig` — both used NIP-01's own verbatim wire
 * names; the Alpha 234 header comment's premise that `NostrEvent` renamed
 * fields does not hold and never did). The one real difference was `tags`
 * mutability: `FedosNostrWireEvent` typed it deep-readonly
 * (`readonly (readonly string[])[]`), `NostrEvent` merely `NostrTag[]`
 * (shallowly mutable). `NostrEvent.tags` below adopts the deep-readonly
 * shape — repo-wide search found no caller anywhere that mutates a
 * `NostrEvent`/`FedosNostrWireEvent` tags array in place (`push`/`splice`/
 * index-assignment), so this is a strict tightening, not a behavior change.
 * `NostrTag` itself (used elsewhere as a general mutable tag-building
 * type, e.g. `_legacy_prototype/sign/build.ts`) is left mutable; only the
 * `tags` field's own element type is widened to `readonly string[]`.
 * `desktop/fedos_nostr_wire_event.ts` now re-exports `NostrEvent` under
 * the `FedosNostrWireEvent` name for its ~30 existing consumers — same
 * type, two names, no call-site churn required.
 */

/** A Nostr tag is a list of strings, e.g. ["e", "<event-id>", "<relay>", "reply"]. */
export type NostrTag = string[];

/** A signed event as it arrives from a relay (NIP-01). */
export interface NostrEvent {
  /** 32-byte lowercase hex sha256 of the serialized event. */
  readonly id: string;
  /** 32-byte lowercase hex secp256k1 x-only public key of the author. */
  readonly pubkey: string;
  /** Unix timestamp in seconds. */
  readonly created_at: number;
  /** Event kind (0 = metadata, 1 = text note, ...). */
  readonly kind: number;
  /** Deep-readonly — see this file's own header comment (Nostr Consolidation Plan, Step 1). */
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  /** 64-byte lowercase hex schnorr signature. */
  readonly sig: string;
}

/** The fields that participate in id computation (NIP-01 serialization). */
export type EventCore = Pick<
  NostrEvent,
  "pubkey" | "created_at" | "kind" | "tags" | "content"
>;
