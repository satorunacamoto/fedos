/**
 * Secure Runtime Alpha 243 ("Canonical Event ID Verification") — the
 * SECOND new file of the Alpha 241–250 Nostr Inbound Event Validation
 * Arc. `verifyNostrEventId` is a PURE, fail-closed function
 * reconstructing NIP-01's own canonical pre-image for a
 * `FedosNostrWireEvent` (Alpha 234), SHA-256-hashing it, and comparing
 * the result against the event's own claimed `id`. This is the
 * SMALLEST honest API this Arc's own Alpha 243 instruction asks to
 * choose between — a plain `boolean`, not a decision object — because
 * nothing downstream (`validateInboundNostrEvent`, Alpha 245) needs
 * more than a pass/fail gate, and Alpha 247's own "no oracle-like
 * detailed failure reason at the public listener boundary" requirement
 * means a richer result type would only invite a future caller to leak
 * one.
 *
 * THIS IS A NEW, INDEPENDENT IMPLEMENTATION — it deliberately does NOT
 * call `verifyEventId`/`serializeForId` (`src/nostr/event.ts`, Stage
 * 1). Alpha 241 §2/§3 found and explains why: `serializeForId` builds
 * its pre-image via `JSON.stringify`, whose own escaping is WIDER than
 * NIP-01's own six-character rule (it additionally escapes every other
 * C0 control character as `\uXXXX`) — a divergence Alpha 191 §3
 * (Nostr Event Foundation Arc) already documented as "acceptable for
 * VERIFICATION-only" in that Arc's OWN, narrower context (verifying
 * this repository's own freshly-signed outbound events, which this
 * repository's own signer would never construct with such a rare
 * control character in the first place). That reasoning does NOT
 * extend to THIS Arc: an inbound event may originate from ANY Nostr
 * client on the network, and a real Nostr event whose `content` (or
 * whose non-ASCII UTF-8, or an unusual tag string) happens to contain
 * a C0 control character outside NIP-01's own six-character escape
 * list would compute a DIFFERENT id under `JSON.stringify` than under
 * NIP-01's own actual rule — causing `verifyNostrEventId` (if it
 * reused `serializeForId`) to spuriously REJECT a perfectly valid
 * event. This Stage's own `escapeNip01CanonicalString` therefore
 * implements NIP-01's own SIX-character rule exactly (`\n` `"` `\\`
 * `\r` `\t` `\b` `\f`, and ONLY these — every other code point,
 * INCLUDING every non-ASCII UTF-8 character, passes through verbatim),
 * matching `escape_json_string_internal`
 * (`packages/fedos-core-rust/src/lib.rs`, Alpha 193) algorithm-for-
 * algorithm, even though this file shares no code, no type, and no
 * import with either the Rust module or `src/nostr/event.ts`. Alpha
 * 248's own known-answer tests confirm both implementations agree, by
 * real execution, not by inspection alone.
 *
 * No Rust/wasm boundary is used or added (Alpha 241 §5 found none
 * reachable): `serialize_nostr_event_canonical_internal` is
 * `pub(crate) fn`, nested inside `master_root`, never
 * `#[wasm_bindgen]`-exported — there is no already-safe, non-public
 * path from TypeScript to it. Duplicating NIP-01's own small, closed,
 * already-specified escaping algorithm in TypeScript is safe and
 * reviewable on its own; adding a wasm export solely to avoid that
 * duplication is exactly what this Arc's own Alpha 243 instruction
 * forbids absent proof the duplication itself is unsafe — no such
 * proof exists (Alpha 248 proves the opposite: real agreement).
 *
 * HARD GUARDRAILS:
 *   - `verifyNostrEventId` is the ONLY export.
 *   - PURE: no socket, no `fetch`, no `WebSocket`, no mutable
 *     module-level state, no `Date.now()`/randomness of any kind.
 *   - NEVER throws — wrapped in a single outer `try`/`catch` returning
 *     `false` for any unexpected internal error, on top of every
 *     branch already being incapable of throwing under normal
 *     conditions (defense in depth, the SAME discipline
 *     `parseRelayInboundMessage`, Alpha 233, already established).
 *   - `event.id` is validated as EXACTLY 64 lowercase-hex characters
 *     before any hashing occurs — no coercion, no case-insensitive
 *     compare, no partial-length acceptance.
 *   - Performs NO network access, NO mutation of `event` or any of its
 *     nested `tags` arrays.
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosNostrWireEvent } from "./fedos_nostr_wire_event.js";

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Escapes exactly NIP-01's own six canonical-serialization characters
 * (line break, double quote, backslash, carriage return, tab,
 * backspace, form feed) — every other code point, including every
 * non-ASCII UTF-8 character, passes through verbatim. This is
 * DELIBERATELY narrower than `JSON.stringify`'s own escaping.
 */
function escapeNip01CanonicalString(value: string): string {
  let out = "";
  for (const ch of value) {
    switch (ch) {
      case "\n":
        out += "\\n";
        break;
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      default:
        out += ch;
    }
  }
  return out;
}

function serializeTagsCanonical(tags: readonly (readonly string[])[]): string {
  const parts = tags.map(
    (tag) => `[${tag.map((t) => `"${escapeNip01CanonicalString(t)}"`).join(",")}]`,
  );
  return `[${parts.join(",")}]`;
}

/**
 * Builds NIP-01's own canonical pre-image: the fixed five-element
 * array `[0, pubkey, created_at, kind, tags, content]`, with ONLY the
 * six NIP-01 characters escaped in every string field.
 */
function serializeNostrEventCanonical(event: FedosNostrWireEvent): string {
  const tagsJson = serializeTagsCanonical(event.tags);
  return `[0,"${escapeNip01CanonicalString(event.pubkey)}",${event.created_at},${event.kind},${tagsJson},"${escapeNip01CanonicalString(event.content)}"]`;
}

/**
 * Verifies that `event.id` is the lowercase-hex SHA-256 of `event`'s
 * own NIP-01 canonical serialization. Proves the id is self-consistent
 * with the event body; it does NOT prove authorship — that is
 * `verifyNostrEventSignature`'s own job (Alpha 244). Never throws;
 * malformed input fails closed (`false`).
 */
export function verifyNostrEventId(event: FedosNostrWireEvent): boolean {
  try {
    if (typeof event.id !== "string" || !HEX_64.test(event.id)) return false;
    const preimage = serializeNostrEventCanonical(event);
    const digest = sha256(new TextEncoder().encode(preimage));
    return bytesToHex(digest) === event.id;
  } catch {
    return false;
  }
}
