/**
 * Secure Runtime Alpha 233 ("NIP-01 Wire Parser") — the THIRD new file
 * of the Alpha 231–240 Nostr Relay Message Reception Arc.
 * `parseRelayInboundMessage` is a PURE function turning an already
 * JSON-parsed, untrusted `unknown` value into a `FedosRelayInboundMessage`
 * (Alpha 232), or `null` if the value does not structurally match one
 * of the four supported shapes. It takes `unknown`, not a raw string —
 * decoding the wire string (`JSON.parse`) and handling a decode
 * failure is `WebSocketRelay`'s own concern (Alpha 235's own "malformed
 * JSON → ignored/fail-closed" instruction), keeping this function pure
 * and independent of any transport.
 *
 * Every branch below mirrors the SAME per-field validation discipline
 * `validateEventStructure` (`src/nostr/event.ts`, Stage 1) and
 * `parseRelayMessage` (`src/nostr/messages.ts`, Stage 5) already
 * established for their own, legacy shapes — REUSED as an IDIOM
 * (exact-length hex regexes, explicit `Array.isArray`/field-count/
 * field-type checks, one issue fails the whole parse) — but this file
 * shares NO type, NO import, and NO code path with either. Alpha 231
 * §4 confirmed no existing function returns exactly
 * `FedosRelayInboundMessage | FedosNostrWireEvent`; there is nothing to
 * reuse beyond the checking IDIOM itself.
 *
 * Cryptographic verification (Schnorr signature checking) is
 * DELIBERATELY NOT implemented here, matching this Arc's own Alpha 233
 * instruction precisely: "Do not implement EVENT cryptographic
 * verification in this Stage unless an existing reusable verifier is
 * already available and its use is explicitly justified." Alpha 231 §5
 * found `NobleSignatureVerifier` (`src/nostr/noble_signature.ts`, Stage
 * 8) IS a real, reusable verifier — but it operates on the legacy
 * `NostrEvent` shape, and wiring it in here would both violate this
 * Arc's own Boundary Requirement ("The legacy src/nostr relay stack
 * must not be silently mixed with the new Desktop boundary") and
 * contradict Alpha 240's own Completion Declaration, which lists
 * "cryptographic validation of received Events" as explicitly still
 * out of scope and names the NEXT Arc as the place that validation
 * belongs. Parsing success here means "structurally a NIP-01 message,"
 * NEVER "cryptographically authentic" — this Arc's own instruction
 * states plainly "Parsing success must not imply cryptographic
 * validity."
 *
 * HARD GUARDRAILS:
 *   - `parseRelayInboundMessage` is the ONLY export.
 *   - PURE: no socket, no `fetch`, no `WebSocket`, no mutable
 *     module-level state, no `Date.now()`/randomness of any kind.
 *   - NEVER throws — the entire body is wrapped so any unexpected
 *     internal error resolves to `null` rather than propagating,
 *     matching this Arc's own "no thrown exception" / "no parser
 *     exception leaks" instruction.
 *   - NEVER performs implicit coercion — every field is checked with
 *     `typeof`/`Array.isArray`/exact-length hex regexes; a numeric
 *     string is NOT accepted where a number is required, and vice
 *     versa.
 *   - Returns `null` for EVERY malformed shape: wrong top-level type,
 *     unknown/missing message tag, wrong item count, wrong field type,
 *     malformed event object — there is no "partial" or "best effort"
 *     result of any kind.
 *   - Performs NO cryptographic verification, NO event-id recomputation,
 *     and NO signature check of any kind.
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file (idiom-only reuse, confirmed by Alpha 231's own inventory).
 *     Both were the flat, pre-Messenger-migration paths this guardrail
 *     originally named; neither exists on disk any more (see the note
 *     below) — the ONE import this file now carries beyond its own
 *     siblings resolves to the current, canonical, post-migration
 *     location, which this guardrail's own original intent (no reach
 *     into the legacy relay stack, no re-mixing crypto verification in
 *     here) does not forbid.
 *
 * Nostr Consolidation Plan, Step 5 (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`)
 * — re-verified this file's own `parseWireEvent` helper against
 * `protocol/event.ts`'s `validateEventStructure`/`isNostrEvent` (the
 * canonical, protocol-layer NIP-01 structural-validation function) and
 * found them a byte-for-byte functional duplicate: identical `HEX_64`/
 * `HEX_128` regexes, identical `isRecord`/"array of string arrays" tag
 * check, identical per-field checks in the identical order. This was
 * two independent implementations of the SAME mechanism ("is this
 * unknown value structurally a NIP-01 event") that happened to target
 * two types the repo, at the time, considered different
 * (`FedosNostrWireEvent` vs `NostrEvent`). Since the Plan's own Step 1
 * already unified those two types into one (`FedosNostrWireEvent` is
 * now a type-alias re-export of `NostrEvent`,
 * `desktop/fedos_nostr_wire_event.ts`), the duplicate validation logic
 * had no remaining justification — `parseWireEvent` below now DELEGATES
 * to `isNostrEvent` (`adapters/nostr/protocol/event.ts`) instead of
 * re-implementing it, removing this file's own `HEX_128`/`isRecord`/
 * `isStringArrayArray` helpers entirely (`HEX_64` stays — it is still
 * used below by the unrelated `OK` message's `eventId` check, which has
 * no protocol-layer equivalent to delegate to). This is the ONE genuine
 * "same mechanism, independently duplicated" instance this
 * consolidation pass found across the two relay/socket implementations;
 * the connection-lifecycle/retry/backoff/subscription-multiplexing/
 * shutdown mechanisms themselves were investigated and found to have NO
 * real duplication — `protocol/ws_relay.ts` is a one-shot, self-closing
 * REQ/EOSE/CLOSE query object with no persistent connection or
 * retry/backoff of any kind, while `WebSocketRelay` (`websocket_relay.ts`)
 * is a persistent, multiplexed connection object that also implements
 * no retry/backoff/reconnect (its own header states "No Relay Pool, no
 * automatic reconnect" plainly) — there is no second implementation of
 * either mechanism to consolidate against.
 */

import type {
  FedosRelayInboundMessage,
} from "./fedos_relay_inbound_message.js";
import type { FedosNostrWireEvent } from "./fedos_nostr_wire_event.js";
import { isNostrEvent } from "../adapters/nostr/protocol/event.js";

const HEX_64 = /^[0-9a-f]{64}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Structurally validates and narrows an inbound EVENT payload. Returns
 * `null` if malformed. Delegates to the canonical protocol-layer
 * `isNostrEvent` (see this file's own header) rather than
 * re-implementing NIP-01 structural validation a second time —
 * `FedosNostrWireEvent` and `NostrEvent` are now the same type, so no
 * conversion or narrowing gap exists at this boundary.
 */
function parseWireEvent(value: unknown): FedosNostrWireEvent | null {
  return isNostrEvent(value) ? value : null;
}

/**
 * Parses one Relay-to-client NIP-01 message. `input` must already be the
 * result of `JSON.parse` on the raw wire string (this function does not
 * decode JSON itself). Never throws; any malformed shape yields `null`.
 */
export function parseRelayInboundMessage(
  input: unknown,
): FedosRelayInboundMessage | null {
  try {
    if (!Array.isArray(input) || input.length === 0) return null;

    const label = input[0];
    if (typeof label !== "string") return null;

    switch (label) {
      case "EVENT": {
        if (input.length !== 3) return null;
        const subscriptionId = input[1];
        if (!isNonEmptyString(subscriptionId)) return null;
        const event = parseWireEvent(input[2]);
        if (event === null) return null;
        return { kind: "event", subscriptionId, event };
      }
      case "EOSE": {
        if (input.length !== 2) return null;
        const subscriptionId = input[1];
        if (!isNonEmptyString(subscriptionId)) return null;
        return { kind: "eose", subscriptionId };
      }
      case "OK": {
        if (input.length !== 4) return null;
        const eventId = input[1];
        const accepted = input[2];
        const message = input[3];
        if (typeof eventId !== "string" || !HEX_64.test(eventId)) return null;
        if (typeof accepted !== "boolean") return null;
        if (typeof message !== "string") return null;
        return { kind: "ok", eventId, accepted, message };
      }
      case "NOTICE": {
        if (input.length !== 2) return null;
        const message = input[1];
        if (typeof message !== "string") return null;
        return { kind: "notice", message };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
