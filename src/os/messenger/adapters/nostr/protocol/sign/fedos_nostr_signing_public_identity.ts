/**
 * Secure Runtime Alpha 683 ("Signing Public Identity Output") — Stage 3
 * of Phase A of the Alpha 681–720 Nostr Identity Binding & Outbound
 * Delivery Activation Arc.
 *
 * The smallest output `FedosNostrSigningAuthority.publicIdentityForAccount()`
 * (`./fedos_nostr_signing_authority.ts`, Alpha 684) can return: which
 * account this identity belongs to, and its canonical public key —
 * nothing else. Deliberately EXCLUDES an `npub` field (Alpha 687's own
 * "hex only" normalization decision — no Bech32 decoder exists anywhere
 * in this repository today, and adding one is not required for a real,
 * reviewed binding check to work), a secret handle, a signing handle, a
 * root handle, an `nsec`, or any other metadata.
 *
 * `publicKeyHex` is always exactly 64 lowercase `[0-9a-f]` characters —
 * the SAME canonical form `FedosWasmNostrSigningAuthority.signEvent()`'s
 * own output (`FedosNostrWireEvent.pubkey`) already carries.
 */

export interface FedosNostrSigningPublicIdentity {
  readonly accountIndex: number;
  readonly publicKeyHex: string;
}

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Structural validation only — never proves key CONTROL by itself (see `FedosNostrAuthorBindingAuthority`). */
export function isWellFormedFedosNostrSigningPublicIdentity(
  candidate: unknown,
): candidate is FedosNostrSigningPublicIdentity {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 2) return false;
  if (
    typeof value.accountIndex !== "number" ||
    !Number.isInteger(value.accountIndex) ||
    value.accountIndex < 0 ||
    value.accountIndex > 4_294_967_295
  ) {
    return false;
  }
  if (typeof value.publicKeyHex !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(value.publicKeyHex)) {
    return false;
  }
  return true;
}
