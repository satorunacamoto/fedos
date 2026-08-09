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
 */

export interface FedosSubscriptionFilter {
  readonly ids?: readonly string[];
  readonly authors?: readonly string[];
  readonly kinds?: readonly number[];
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
}
