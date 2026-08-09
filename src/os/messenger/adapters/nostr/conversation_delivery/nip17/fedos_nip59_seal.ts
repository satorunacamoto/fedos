/**
 * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
 * Delivery Arc") Phase D (Alpha 1773–1776) — the NIP-59 Seal
 * construction and validation pipeline.
 *
 * Per `docs/normative/nostr-protocol-nips/59.md` §"2. The Seal Event
 * Kind": a Seal is a `kind:13` event wrapping a Rumor with the sender's
 * REAL key. "Tags MUST always be empty in a `kind:13`. The inner event
 * MUST always be unsigned." Signed via the EXISTING, real
 * `FedosNostrSigningAuthority` (`../../../../nostr/sign/`, unchanged) —
 * NEVER the ephemeral Gift-Wrap key. Encrypted via the real NIP-44 wire
 * bridge (`FedosMasterSeedAuthority.encryptNip44Wire`/`decryptNip44Wire`,
 * this Arc's own Phase B addition) — NEVER this crate's own generic
 * Envelope AEAD.
 */
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import type { FedosNostrSigningAuthority, FedosNostrUnsignedEventRequest } from "../../protocol/sign/fedos_nostr_signing_authority.js";
import { FEDOS_NIP59_SEAL_KIND } from "../../protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosMasterSeedAuthority } from "../../../../../core/vault/wasm/fedos_master_seed_authority.js";
import {
  buildFedosNip17ChatMessageRumor,
  parseFedosNip17RumorFromPlaintext,
  serializeFedosNip17RumorForEncryption,
  type FedosNip17ChatMessageRumorInput,
  type FedosNip17Rumor,
} from "./fedos_nip17_rumor.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface FedosNip59SealBuildInput {
  readonly rumor: FedosNip17ChatMessageRumorInput;
  readonly senderAccountIndex: number;
  readonly recipientPublicKeyHex: string;
  /** Unix seconds — NIP-17 §"Encrypting": "Clients SHOULD randomize `created_at` in up to two days in the past". Caller-injected (Alpha 1784's own "injected clock/random source for deterministic tests" requirement) — this function performs NO randomization of its own. */
  readonly createdAt: number;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly nip44Wire: FedosMasterSeedAuthority;
}

/**
 * Builds ONE Rumor and seals it: NIP-44-encrypt the Rumor's JSON
 * serialization under `conversation_key(senderAccountIndex, recipientPublicKeyHex)`,
 * then sign the resulting `kind:13` event with the REAL sender identity.
 * Returns `null` on ANY failure at ANY step (malformed Rumor input,
 * NIP-44 encrypt failure, or signing failure) — fail closed, never a
 * partial Seal.
 */
export async function buildFedosNip59Seal(
  input: FedosNip59SealBuildInput,
): Promise<{ readonly seal: FedosNostrWireEvent; readonly rumor: FedosNip17Rumor } | null> {
  if (typeof input.recipientPublicKeyHex !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(input.recipientPublicKeyHex)) {
    return null;
  }
  if (
    typeof input.createdAt !== "number" ||
    !Number.isFinite(input.createdAt) ||
    !Number.isInteger(input.createdAt) ||
    input.createdAt < 0
  ) {
    return null;
  }

  const rumor = buildFedosNip17ChatMessageRumor(input.rumor);
  if (rumor === null) return null;

  if (typeof input.nip44Wire.encryptNip44Wire !== "function") return null;
  const rumorPlaintext = new TextEncoder().encode(serializeFedosNip17RumorForEncryption(rumor));
  const encryptedContent = await input.nip44Wire.encryptNip44Wire(
    input.senderAccountIndex,
    input.recipientPublicKeyHex,
    rumorPlaintext,
  );
  if (encryptedContent === null) return null;

  const request: FedosNostrUnsignedEventRequest = {
    accountIndex: input.senderAccountIndex,
    createdAt: input.createdAt,
    kind: FEDOS_NIP59_SEAL_KIND,
    tags: [],
    content: encryptedContent,
  };
  const seal = await input.signingAuthority.signEvent(request);
  if (seal === null) return null;

  return { seal, rumor };
}

export interface FedosNip59SealOpenInput {
  readonly seal: FedosNostrWireEvent;
  /** The LOCAL account index unwrapping this Seal — its own conversation key with `seal.pubkey` is what decrypts the content. */
  readonly localAccountIndex: number;
  readonly nip44Wire: FedosMasterSeedAuthority;
}

/**
 * Validates and unwraps a candidate Seal: structural shape (`kind:13`,
 * empty `tags` — NIP-59 §"Tags MUST always be empty in a `kind:13`"),
 * then decrypts `.content` via the LOCAL account's own conversation key
 * with `seal.pubkey` (the real sender), then validates the decrypted
 * Rumor and enforces NIP-17's own impersonation guard ("Clients MUST
 * verify if pubkey of the `kind:13` is the same pubkey as that of the
 * `unsignedMessageRumor`"). Returns `null` on ANY failure — malformed
 * shape, decrypt/authentication failure, malformed inner Rumor, or a
 * pubkey mismatch — never distinguishing which, never a partial
 * plaintext. Schnorr signature verification on the Seal itself is the
 * caller's own responsibility (this Arc reuses the Gift-Wrap unwrap
 * pipeline's own independent event-id/signature check, `fedos_nip59_gift_wrap.ts`,
 * rather than duplicating a second verifier here — the Seal only
 * reaches this function after the OUTER Gift Wrap has already been
 * structurally accepted).
 */
export async function openFedosNip59Seal(input: FedosNip59SealOpenInput): Promise<FedosNip17Rumor | null> {
  const seal = input.seal;
  if (typeof seal !== "object" || seal === null) return null;
  if (seal.kind !== FEDOS_NIP59_SEAL_KIND) return null;
  if (!Array.isArray(seal.tags) || seal.tags.length !== 0) return null;
  if (typeof seal.pubkey !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(seal.pubkey)) return null;
  if (typeof seal.content !== "string" || seal.content.length === 0) return null;

  if (typeof input.nip44Wire.decryptNip44Wire !== "function") return null;
  const plaintext = await input.nip44Wire.decryptNip44Wire(input.localAccountIndex, seal.pubkey, seal.content);
  if (plaintext === null) return null;

  const rumor = parseFedosNip17RumorFromPlaintext(plaintext);
  if (rumor === null) return null;

  // NIP-17's own impersonation guard.
  if (rumor.pubkey !== seal.pubkey) return null;

  return rumor;
}
