/**
 * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
 * Delivery Arc") Phase F (Alpha 1781–1787) — the NIP-59 Gift Wrap
 * construction and unwrap pipeline.
 *
 * Per `docs/normative/nostr-protocol-nips/59.md` §"3. Gift Wrap Event
 * Kind": a `kind:1059` event wrapping the Seal, `tags: [["p",
 * "<recipient pubkey>"]]`, signed by a fresh, single-use random key.
 * `kind:21059` (§"4. Ephemeral Gift Wrap Event Kind") is the SAME shape
 * under real-time/ephemeral relay semantics — this Arc builds only
 * `kind:1059` by default (Alpha 1763's own smallest-standard-scope
 * decision: mailbox delivery, the SAME durable-delivery model
 * `FedosPrivateTransport`'s own existing Mailbox/Outbox already assumes
 * — `kind:21059`'s "relays MUST NOT store it" semantics has no existing
 * analog in this Transport's own Ephemeral-vs-Mailbox split to map onto
 * safely without further review, so mapping it into that split is
 * deferred, not half-built; the type itself supports either kind so a
 * future Arc can wire it without redesigning this one).
 *
 * Timestamp handling (Alpha 1784): NIP-59 §"Other Considerations" says
 * "All other timestamps SHOULD be tweaked... so all timestamps SHOULD
 * be in the past" and "SHOULD use independent random timestamps for
 * each layer." This module accepts ALREADY-COMPUTED `sealCreatedAt`/
 * `giftWrapCreatedAt` values (one per layer, per the caller's own
 * injected clock/random source) rather than generating randomness
 * itself, so tests can be fully deterministic and this module never
 * silently reaches for `Math.random()`/`Date.now()` on its own.
 *
 * Alpha 1786's own construction pipeline: Rumor -> NIP-44 encrypt -> Seal
 * (signed by the real sender, `fedos_nip59_seal.ts`) -> NIP-44 encrypt ->
 * Gift Wrap (signed by a fresh ephemeral key,
 * `fedos_wasm_ephemeral_gift_wrap_signing_authority.ts`) — this module
 * is the outer layer that composes those two.
 */
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import type { FedosNostrSigningAuthority } from "../../protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosMasterSeedAuthority } from "../../../../../core/vault/wasm/fedos_master_seed_authority.js";
import {
  FEDOS_GIFT_WRAP_KIND,
  FEDOS_EPHEMERAL_GIFT_WRAP_KIND,
  type FedosEphemeralGiftWrapSigningAuthority,
} from "./fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { buildFedosNip59Seal, openFedosNip59Seal } from "./fedos_nip59_seal.js";
import type { FedosNip17ChatMessageRumorInput, FedosNip17Rumor } from "./fedos_nip17_rumor.js";

export { FEDOS_GIFT_WRAP_KIND, FEDOS_EPHEMERAL_GIFT_WRAP_KIND };

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Parses a Gift Wrap's decrypted plaintext back into a structurally-validated signed Seal event. `null` on ANY parse/shape failure. */
function parseSealFromPlaintext(plaintext: Uint8Array): FedosNostrWireEvent | null {
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
    tags.push([...tag]);
  }
  return Object.freeze({
    id: candidate.id,
    pubkey: candidate.pubkey,
    created_at: candidate.created_at,
    kind: candidate.kind,
    tags: Object.freeze(tags.map((t) => Object.freeze(t))),
    content: candidate.content,
    sig: candidate.sig,
  });
}

export interface FedosNip17GiftWrapBuildInput {
  readonly rumor: FedosNip17ChatMessageRumorInput;
  readonly senderAccountIndex: number;
  readonly recipientPublicKeyHex: string;
  /** The Seal's own, independently-randomized `created_at` (Alpha 1784). */
  readonly sealCreatedAt: number;
  /** The Gift Wrap's own, independently-randomized `created_at` (Alpha 1784) — deliberately a SEPARATE value from `sealCreatedAt`. */
  readonly giftWrapCreatedAt: number;
  /** Defaults to `FEDOS_GIFT_WRAP_KIND` (1059, mailbox delivery) — this Arc's own smallest-scope decision. `FEDOS_EPHEMERAL_GIFT_WRAP_KIND` (21059) is accepted but not yet wired to any Transport behavior; see this file's own header. */
  readonly giftWrapKind?: number;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly nip44Wire: FedosMasterSeedAuthority;
  readonly ephemeralSigningAuthority: FedosEphemeralGiftWrapSigningAuthority;
}

/**
 * The full Alpha 1786 construction pipeline: Rumor -> NIP-44 encrypt ->
 * Seal (signed by the real sender) -> NIP-44 encrypt -> Gift Wrap
 * (signed by a fresh ephemeral key). Returns the complete signed
 * `kind:1059`/`kind:21059` event on success, `null` on ANY failure at
 * ANY step — fail closed, never a partial event.
 */
export async function buildFedosNip17GiftWrap(
  input: FedosNip17GiftWrapBuildInput,
): Promise<{ readonly giftWrap: FedosNostrWireEvent; readonly rumor: FedosNip17Rumor } | null> {
  const kind = input.giftWrapKind ?? FEDOS_GIFT_WRAP_KIND;
  if (kind !== FEDOS_GIFT_WRAP_KIND && kind !== FEDOS_EPHEMERAL_GIFT_WRAP_KIND) return null;
  if (
    typeof input.giftWrapCreatedAt !== "number" ||
    !Number.isFinite(input.giftWrapCreatedAt) ||
    !Number.isInteger(input.giftWrapCreatedAt) ||
    input.giftWrapCreatedAt < 0
  ) {
    return null;
  }

  const sealResult = await buildFedosNip59Seal({
    rumor: input.rumor,
    senderAccountIndex: input.senderAccountIndex,
    recipientPublicKeyHex: input.recipientPublicKeyHex,
    createdAt: input.sealCreatedAt,
    signingAuthority: input.signingAuthority,
    nip44Wire: input.nip44Wire,
  });
  if (sealResult === null) return null;
  const { seal, rumor } = sealResult;

  const sealPlaintext = new TextEncoder().encode(JSON.stringify(seal));
  const giftWrap = await input.ephemeralSigningAuthority.buildGiftWrap(
    input.recipientPublicKeyHex,
    input.giftWrapCreatedAt,
    kind,
    sealPlaintext,
  );
  if (giftWrap === null) return null;

  return { giftWrap, rumor };
}

export interface FedosNip17GiftWrapOpenInput {
  readonly giftWrap: FedosNostrWireEvent;
  /** The LOCAL account index unwrapping this Gift Wrap. */
  readonly localAccountIndex: number;
  readonly nip44Wire: FedosMasterSeedAuthority;
}

/**
 * The full Alpha 1787 unwrap pipeline: Gift Wrap validation -> outer
 * decrypt (via the LOCAL account's own conversation key with
 * `giftWrap.pubkey`, the ephemeral wrapper's already-public key,
 * extracted from the wire event itself) -> Seal validation/decrypt
 * (`openFedosNip59Seal`, which also enforces NIP-17's own
 * sender/rumor-pubkey impersonation guard) -> Rumor validation. Returns
 * the fully-validated Rumor on success, `null` on ANY failure at ANY
 * step — fail closed, coarse failures only, never a partial plaintext.
 */
export async function openFedosNip17GiftWrap(input: FedosNip17GiftWrapOpenInput): Promise<FedosNip17Rumor | null> {
  const giftWrap = input.giftWrap;
  if (typeof giftWrap !== "object" || giftWrap === null) return null;
  if (giftWrap.kind !== FEDOS_GIFT_WRAP_KIND && giftWrap.kind !== FEDOS_EPHEMERAL_GIFT_WRAP_KIND) return null;
  if (typeof giftWrap.pubkey !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(giftWrap.pubkey)) return null;
  if (typeof giftWrap.content !== "string" || giftWrap.content.length === 0) return null;
  if (!Array.isArray(giftWrap.tags)) return null;
  const hasRecipientTag = giftWrap.tags.some(
    (tag) => Array.isArray(tag) && tag[0] === "p" && typeof tag[1] === "string" && NOSTR_PUBLIC_KEY_HEX_PATTERN.test(tag[1]),
  );
  if (!hasRecipientTag) return null;

  if (typeof input.nip44Wire.decryptNip44Wire !== "function") return null;
  const plaintext = await input.nip44Wire.decryptNip44Wire(input.localAccountIndex, giftWrap.pubkey, giftWrap.content);
  if (plaintext === null) return null;

  const seal = parseSealFromPlaintext(plaintext);
  if (seal === null) return null;

  return openFedosNip59Seal({ seal, localAccountIndex: input.localAccountIndex, nip44Wire: input.nip44Wire });
}
