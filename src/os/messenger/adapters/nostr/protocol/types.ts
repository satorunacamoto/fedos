/**
 * NIP-01 core event types.
 * See: https://github.com/nostr-protocol/nips/blob/master/01.md
 *
 * Stage 1 scope: read-only ingest. We model the wire shape only — no signing,
 * no key material. Signature *verification* is defined as an injectable adapter
 * so the heavy crypto dependency can be added later without touching callers.
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
  readonly tags: NostrTag[];
  readonly content: string;
  /** 64-byte lowercase hex schnorr signature. */
  readonly sig: string;
}

/** The fields that participate in id computation (NIP-01 serialization). */
export type EventCore = Pick<
  NostrEvent,
  "pubkey" | "created_at" | "kind" | "tags" | "content"
>;
