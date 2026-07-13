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
 */

import type {
  FedosRelayInboundMessage,
} from "./fedos_relay_inbound_message.js";
import type { FedosNostrWireEvent } from "./fedos_nostr_wire_event.js";

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArrayArray(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (tag) => Array.isArray(tag) && tag.every((t) => typeof t === "string"),
    )
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Structurally validates and narrows an inbound EVENT payload. Returns `null` if malformed. */
function parseWireEvent(value: unknown): FedosNostrWireEvent | null {
  if (!isRecord(value)) return null;

  const { id, pubkey, created_at, kind, tags, content, sig } = value;

  if (typeof id !== "string" || !HEX_64.test(id)) return null;
  if (typeof pubkey !== "string" || !HEX_64.test(pubkey)) return null;
  if (typeof created_at !== "number" || !Number.isInteger(created_at) || created_at < 0) {
    return null;
  }
  if (typeof kind !== "number" || !Number.isInteger(kind) || kind < 0) return null;
  if (!isStringArrayArray(tags)) return null;
  if (typeof content !== "string") return null;
  if (typeof sig !== "string" || !HEX_128.test(sig)) return null;

  return { id, pubkey, created_at, kind, tags, content, sig };
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
