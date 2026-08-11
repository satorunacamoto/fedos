/**
 * Stage 5 — pure NIP-01 relay message parser.
 *
 * Relay -> client messages are untrusted strings. `parseRelayMessage` turns one
 * into a tagged `RelayMessage` and never throws. EVENT payloads are structurally
 * validated here, so `isEventMessage` narrows to a real `NostrEvent`. This module
 * has no I/O — the WebSocket adapter feeds raw strings in.
 */

import { validateEventStructure } from "./event.js";
import type { NostrEvent } from "./types.js";

export type RelayMessage =
  | { readonly kind: "event"; readonly subscriptionId: string; readonly event: NostrEvent }
  | { readonly kind: "eose"; readonly subscriptionId: string }
  | { readonly kind: "notice"; readonly message: string }
  | { readonly kind: "unknown"; readonly label: string; readonly raw: readonly unknown[] }
  | { readonly kind: "invalid"; readonly reason: string; readonly raw: string };

/** Parses a relay->client message. Never throws; malformed input -> "invalid". */
export function parseRelayMessage(raw: string): RelayMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid", reason: "not valid JSON", raw };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { kind: "invalid", reason: "not a non-empty array", raw };
  }

  const label = parsed[0];
  if (typeof label !== "string") {
    return { kind: "invalid", reason: "message type label is not a string", raw };
  }

  switch (label) {
    case "EVENT": {
      const subscriptionId = parsed[1];
      const event = parsed[2];
      if (typeof subscriptionId !== "string") {
        return { kind: "invalid", reason: "EVENT missing subscription id", raw };
      }
      if (validateEventStructure(event).length > 0) {
        return { kind: "invalid", reason: "EVENT payload is not a valid event", raw };
      }
      return { kind: "event", subscriptionId, event: event as NostrEvent };
    }
    case "EOSE": {
      const subscriptionId = parsed[1];
      if (typeof subscriptionId !== "string") {
        return { kind: "invalid", reason: "EOSE missing subscription id", raw };
      }
      return { kind: "eose", subscriptionId };
    }
    case "NOTICE": {
      const message = parsed[1];
      if (typeof message !== "string") {
        return { kind: "invalid", reason: "NOTICE missing message", raw };
      }
      return { kind: "notice", message };
    }
    default:
      return { kind: "unknown", label, raw: parsed };
  }
}

export function isEventMessage(
  m: RelayMessage,
): m is Extract<RelayMessage, { kind: "event" }> {
  return m.kind === "event";
}

export function isEoseMessage(
  m: RelayMessage,
): m is Extract<RelayMessage, { kind: "eose" }> {
  return m.kind === "eose";
}

export function isNoticeMessage(
  m: RelayMessage,
): m is Extract<RelayMessage, { kind: "notice" }> {
  return m.kind === "notice";
}
