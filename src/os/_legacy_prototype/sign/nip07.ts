/**
 * Stage 10 — NIP-07 signer adapter.
 *
 * Thin boundary over a NIP-07 provider (`window.nostr`-shaped). The provider is
 * INJECTED, not read from the global, so it is testable and not hard-coupled.
 * This adapter only delegates signing and validates the result; it never holds,
 * generates, or stores a private key, and it never publishes.
 */

import { isValidHex } from "../../messenger/adapters/nostr/protocol/noble_signature.js";
import { assertSignerPubkeyMatches, isSignedEventLike } from "./validate.js";
import type {
  EventSigner,
  Nip07Provider,
  SignedNostrEvent,
  UnsignedNostrEvent,
} from "./types.js";

/** True if `target` (e.g. globalThis/window) exposes a NIP-07 provider. */
export function isNip07Available(
  target: unknown,
): target is { nostr: Nip07Provider } {
  if (target === null || typeof target !== "object") return false;
  const nostr = (target as { nostr?: unknown }).nostr;
  if (nostr === null || typeof nostr !== "object") return false;
  const n = nostr as Record<string, unknown>;
  return typeof n["getPublicKey"] === "function" && typeof n["signEvent"] === "function";
}

export class Nip07EventSigner implements EventSigner {
  readonly #provider: Nip07Provider;

  constructor(provider: Nip07Provider) {
    this.#provider = provider;
  }

  async getPublicKey(): Promise<string> {
    const pubkey = await this.#provider.getPublicKey();
    if (!isValidHex(pubkey, 32)) {
      throw new Error("NIP-07 getPublicKey returned an invalid pubkey");
    }
    return pubkey;
  }

  /**
   * Delegates signing to the provider, then checks the result is structurally a
   * signed event AND that its pubkey matches the signer's. Any provider error
   * propagates unchanged. No key material is touched here.
   */
  async signEvent(unsigned: UnsignedNostrEvent): Promise<SignedNostrEvent> {
    const signed = await this.#provider.signEvent(unsigned);
    if (!isSignedEventLike(signed)) {
      throw new Error("NIP-07 signEvent returned a malformed event");
    }
    const signerPubkey = await this.#provider.getPublicKey();
    if (!assertSignerPubkeyMatches(signed, signerPubkey)) {
      throw new Error("signed event pubkey does not match the signer's pubkey");
    }
    return signed;
  }
}
