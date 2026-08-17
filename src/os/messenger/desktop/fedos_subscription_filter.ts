/**
 * Secure Runtime Alpha 223 ("Filter Representation") — the SECOND new
 * file of the Alpha 221–230 Nostr Subscription Foundation Arc.
 * `FedosSubscriptionFilter` names the MINIMUM NIP-01 REQ filter fields
 * this Arc's own Alpha 223 instruction asks for: `ids`, `authors`,
 * `kinds`, `since`, `until`, `limit` — the six scalar/array fields
 * every NIP-01 relay is guaranteed to understand. Generic single-letter
 * tag filters (`#e`, `#p`, and NIP-01's own open-ended `#<letter>`
 * mechanism) are DELIBERATELY EXCLUDED — they are an extension
 * mechanism layered on top of the six-field core, not part of the
 * "minimum" this Stage's own instruction names, and can be added later
 * as an ADDITIVE optional field without breaking any existing caller,
 * the SAME "additive, never a reshaping" discipline `FedosRelay` itself
 * has followed at every prior Stage (Alpha 215, Alpha 216, and now
 * Alpha 226).
 *
 * This is a NEW, independent type — it shares no code and no import
 * with `NostrFilter` (`src/nostr/relay.ts`, Alpha 211 §2, explicitly
 * excluded by this Arc's own instruction list).
 *
 * HARD GUARDRAILS:
 *   - `FedosSubscriptionFilter` is the ONLY export.
 *   - Every field is `readonly` and OPTIONAL — an empty `{}` is a
 *     structurally valid filter (NIP-01 permits a filter matching
 *     everything).
 *   - Exactly six fields: `ids`, `authors`, `kinds`, `since`, `until`,
 *     `limit` — NO `#e`/`#p`/generic tag field of any kind.
 *   - This file defines a TYPE ONLY — no function, no class, no runtime
 *     behavior, and no filter-matching logic of any kind (this Arc
 *     never processes incoming events — see Alpha 224's own "No event
 *     processing" instruction).
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/publish.ts`, `src/nostr/messages.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 *
 * Public Relay Reliability + Gift-Wrap Subscription Narrowing arc — adds
 * exactly the ADDITIVE `"#p"` field this file's own header already
 * anticipated ("can be added later as an ADDITIVE optional field
 * without breaking any existing caller"). Protocol-correctness note:
 * every NIP-59 Gift Wrap (`kind:1059`) this codebase produces or
 * accepts already carries a plaintext `["p", "<recipient pubkey>"]` tag
 * on the OUTER (unencrypted-metadata) event — required by
 * `openFedosNip17GiftWrap()`'s own `hasRecipientTag` validation
 * (`fedos_nip59_gift_wrap.ts`). Server-side `"#p"` filtering therefore
 * reveals NOTHING to a relay that the relay could not already read by
 * inspecting the tags of every `kind:1059` event delivered under a
 * kind-only filter — it is the standard, ecosystem-wide way NIP-17
 * clients subscribe for their own mailbox, not a privacy-eroding
 * addition. `buildReqMessage()` (`./subscription_messages.ts`) already
 * spreads whatever fields a filter object carries directly into the
 * wire REQ with no allowlist/stripping, so this is a pure type-level
 * addition — no transport-layer change required.
 */

export interface FedosSubscriptionFilter {
  readonly ids?: readonly string[];
  readonly authors?: readonly string[];
  readonly kinds?: readonly number[];
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
  /** NIP-01 generic tag filter, `#p` only (recipient pubkey) — see this file's own header for why this is protocol-safe to add. */
  readonly "#p"?: readonly string[];
}
