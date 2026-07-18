/**
 * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
 * Delivery Arc") Phase C (Alpha 1769–1772) — the NIP-17 Rumor model.
 *
 * Per `docs/normative/nostr-protocol-nips/17.md` ("Message Rumor
 * Definitions"): a Rumor is a regular Nostr event that is NEVER signed
 * (NIP-59 §"Overview" — "if it is leaked, it cannot be verified"). This
 * Arc's own smallest-standard-scope decision (Alpha 1763): only
 * `kind:14` (Chat Message) is built/validated here — `kind:15` (File
 * Message) is a DISTINCT kind with its own additional required tags
 * (`file-type`/`encryption-algorithm`/`decryption-key`/`decryption-nonce`/`x`)
 * this Arc does not implement (no file-transfer feature exists anywhere
 * in this codebase yet to attach it to) and `kind:7` reactions are
 * likewise out of scope.
 *
 * `id` is NOT NIP-01's own canonical `sha256(serialize(...))` hash. A
 * true canonical hash would require constructing a
 * `nostr_identifier_encoding::FedosNostrPublicKeyHex` from an arbitrary
 * caller-supplied hex string inside `packages/fedos-core-rust` — that
 * type's only constructor (`FedosNostrPublicKeyHex::new`) is private to
 * its own module, reachable today ONLY via
 * `encode_nostr_public_key_hex_internal` (which itself requires a real,
 * derived `FedosNostrPublicKeyHandle`, not a plain hex string) — no
 * "validate and wrap an arbitrary hex string" constructor exists yet.
 * Building one is a narrow, well-defined, low-risk follow-up (see the
 * completion declaration's own recommended next Arc); it is out of
 * scope here. This is an HONEST, DOCUMENTED simplification, not a
 * silent one: since a Rumor is by definition unsigned and therefore
 * "can't be authenticated" (NIP-59 §"Overview") regardless of whether
 * its own `id` field is a true canonical hash or a local provenance
 * token, no verification step anywhere in this Arc's own scope depends
 * on `id` being the true NIP-01 hash — `id` here is the caller's own
 * already-unique local envelope identifier, reused as-is, never
 * fabricated to LOOK like a hash it is not.
 */

/** Kind 14 per `docs/normative/nostr-protocol-nips/17.md` §"Message Rumor Definitions" — the ONLY Rumor kind this Arc builds/validates (Alpha 1763's own smallest-scope decision). Kind 15 (File Message) is a DISTINCT kind, out of scope. */
export const FEDOS_NIP17_CHAT_MESSAGE_KIND = 14;

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface FedosNip17Rumor {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
}

export interface FedosNip17ChatMessageRumorInput {
  /** The caller's own already-unique local identifier for this message — see this file's own header for why this is NOT a NIP-01 canonical hash. */
  readonly localEnvelopeId: string;
  readonly senderPublicKeyHex: string;
  readonly createdAt: number;
  /** One `p` tag per recipient, per `docs/normative/nostr-protocol-nips/17.md`'s own kind-14 example — Direct (one recipient) or Group pairwise fanout (multiple), same Rumor content either way (Alpha 1772's own "one local canonical Group Message regardless of wire fanout" — though Group fanout construction itself is deferred, see this Arc's completion declaration). */
  readonly recipientPublicKeysHex: readonly string[];
  readonly content: string;
  /** The direct parent message's own `id`, if this is a reply — an `e` tag per the normative example. */
  readonly replyToRumorId?: string;
}

/**
 * Builds a real, well-formed `kind:14` Rumor from a local Direct/Group
 * message. Returns `null` on ANY malformed input — fail closed, never a
 * partial Rumor. `.content` is plain text (NIP-17's own requirement) —
 * this function performs NO encryption of any kind; that is
 * `fedos_nip59_seal.ts`'s own concern, one layer up.
 */
export function buildFedosNip17ChatMessageRumor(input: FedosNip17ChatMessageRumorInput): FedosNip17Rumor | null {
  if (typeof input.localEnvelopeId !== "string" || input.localEnvelopeId.length === 0) return null;
  if (typeof input.senderPublicKeyHex !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(input.senderPublicKeyHex)) {
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
  if (!Array.isArray(input.recipientPublicKeysHex) || input.recipientPublicKeysHex.length === 0) return null;
  for (const recipient of input.recipientPublicKeysHex) {
    if (typeof recipient !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(recipient)) return null;
  }
  if (typeof input.content !== "string") return null;
  if (input.replyToRumorId !== undefined && (typeof input.replyToRumorId !== "string" || input.replyToRumorId.length === 0)) {
    return null;
  }

  const tags: string[][] = input.recipientPublicKeysHex.map((recipient) => ["p", recipient]);
  if (input.replyToRumorId !== undefined) {
    tags.push(["e", input.replyToRumorId]);
  }

  return Object.freeze({
    id: input.localEnvelopeId,
    pubkey: input.senderPublicKeyHex,
    created_at: input.createdAt,
    kind: FEDOS_NIP17_CHAT_MESSAGE_KIND,
    tags: Object.freeze(tags.map((tag) => Object.freeze([...tag]))),
    content: input.content,
  });
}

/**
 * Structural validation for a candidate decrypted Rumor — rejects any
 * extra/missing property, any non-`kind:14` kind (Alpha 1763's own
 * smallest-scope decision — kind 15/7 rumors are rejected, not
 * silently accepted), any malformed `pubkey`/`created_at`/`tags`, or a
 * non-string `content`. Never throws. This is the ONLY gate a decrypted
 * Rumor must pass before local import — see Alpha 1799/1800.
 */
export function isWellFormedFedosNip17Rumor(candidate: unknown): candidate is FedosNip17Rumor {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 6) return false;
  if (
    !("id" in value) ||
    !("pubkey" in value) ||
    !("created_at" in value) ||
    !("kind" in value) ||
    !("tags" in value) ||
    !("content" in value)
  ) {
    return false;
  }
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (typeof value.pubkey !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(value.pubkey)) return false;
  if (
    typeof value.created_at !== "number" ||
    !Number.isFinite(value.created_at) ||
    !Number.isInteger(value.created_at) ||
    value.created_at < 0
  ) {
    return false;
  }
  if (value.kind !== FEDOS_NIP17_CHAT_MESSAGE_KIND) return false;
  if (!Array.isArray(value.tags)) return false;
  for (const tag of value.tags) {
    if (!Array.isArray(tag) || tag.length === 0) return false;
    for (const field of tag) {
      if (typeof field !== "string") return false;
    }
  }
  if (typeof value.content !== "string") return false;
  return true;
}

/**
 * Serializes a Rumor to the JSON string that becomes the Seal's own
 * `.content` PLAINTEXT, prior to NIP-44 encryption (`fedos_nip59_seal.ts`).
 * Plain `JSON.stringify` is deliberate and sufficient here — unlike a
 * Nostr event's own canonical `id`/`sig` pre-image (which MUST match
 * NIP-01's exact byte-for-byte serialization for every relay/client to
 * agree on), this JSON is PRIVATE content only this Arc's own
 * `openFedosNip59Seal` (the sole reviewed reader, holding the matching
 * decryption key) ever parses back — no third party ever needs to
 * reproduce these exact bytes.
 */
export function serializeFedosNip17RumorForEncryption(rumor: FedosNip17Rumor): string {
  return JSON.stringify(rumor);
}

/** Parses a Seal's decrypted plaintext bytes back into a structurally-validated Rumor. `null` on ANY parse/shape failure — fail closed, never a partial Rumor. */
export function parseFedosNip17RumorFromPlaintext(plaintext: Uint8Array): FedosNip17Rumor | null {
  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isWellFormedFedosNip17Rumor(parsed) ? parsed : null;
}
