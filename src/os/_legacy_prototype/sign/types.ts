/**
 * Stage 10 — signer boundary types.
 *
 * This is where "the user signs an event" plugs in, WITHOUT this codebase ever
 * holding a private key. Signing is delegated to an external `EventSigner`
 * (e.g. a NIP-07 browser extension). We only build unsigned events and validate
 * what comes back. No key generation, no key storage, no publishing.
 */

import type { NostrTag } from "../../messenger/adapters/nostr/protocol/types.js";

/** An event before `id`/`sig` exist (the input to a signer). */
export interface UnsignedNostrEvent {
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  /**
   * Deep-readonly, matching `NostrEvent.tags` (`../../messenger/adapters/nostr/protocol/types.ts`)
   * exactly — this interface's own `SignedNostrEvent` doc comment already
   * claimed to be "structurally a NIP-01 `NostrEvent`"; this field now
   * actually is (Nostr Consolidation Plan, Step 1 fallout — no caller here
   * mutates a tags array in place, repo-wide search confirmed).
   */
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
}

/** A fully signed event (structurally a NIP-01 `NostrEvent`). */
export interface SignedNostrEvent extends UnsignedNostrEvent {
  readonly id: string;
  readonly sig: string;
}

/**
 * Abstract signer. Implemented by adapters (NIP-07, future external signers).
 * The boundary keeps the rest of the app independent of `window.nostr`.
 */
export interface EventSigner {
  getPublicKey(): Promise<string>;
  signEvent(unsigned: UnsignedNostrEvent): Promise<SignedNostrEvent>;
}

/**
 * The minimal NIP-07 provider surface (a subset of `window.nostr`). Injected
 * rather than read from the global, so it is testable and not hard-coupled.
 */
export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedNostrEvent): Promise<SignedNostrEvent>;
}

/** A request handed to a signer, with an optional human-readable purpose. */
export interface SignRequest {
  readonly unsigned: UnsignedNostrEvent;
  /** Short description of what is being signed (for a consent prompt). */
  readonly purpose?: string;
}

export interface BuildTextNoteOptions {
  readonly pubkey: string;
  readonly content: string;
  readonly tags?: NostrTag[];
  /** Unix seconds. Defaults to `Math.floor(Date.now()/1000)`. */
  readonly now?: number;
}
