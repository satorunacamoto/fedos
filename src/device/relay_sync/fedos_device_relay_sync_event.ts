/**
 * Secure Runtime Alpha 3641–3720 ("Relay-Assisted Device Synchronization")
 * — Wire Payload ⇄ Nostr Event mapping (Phase B/C).
 *
 * Route Decision (Phase B), frozen as `FEDOS_DEVICE_RELAY_SYNC_ROUTE_VERSION`
 * (`./fedos_device_relay_sync_wire_payload.ts`): a NEW, dedicated
 * proprietary `kind:1` route, built by directly reusing this codebase's
 * ALREADY-REAL primitives — `FedosNostrSigningAuthority.signEvent()`
 * (Alpha 424, hard-fixed to `kind: 1` at BOTH the TypeScript and Rust/WASM
 * boundary, UNCHANGED, UNWIDENED) and `FedosRelay`/`FedosConversationRelaySet`
 * (Alpha 212–238/1471–1540, UNCHANGED) — mirroring
 * `../../conversation/transport/fedos_conversation_transport_event.ts`'s
 * own "kind:1 + marker tag + base64 opaque content" idiom exactly, under a
 * NEW, distinct marker tag so it can never collide with, or be mistaken
 * for, that route's own `["fedos-private","1"]` traffic, a public Board
 * post, or (this checkout has no NIP-17 code at all — see this Arc's own
 * Phase A report) any NIP-17 Gift Wrap.
 *
 * Three routes were compared and rejected in favor of this one:
 *   A. NIP-17 Gift Wrap — REJECTED: genuinely absent from this checkout's
 *      history (confirmed: not an ancestor of this Arc's own base commit).
 *      Not "already real" in this line of history; merging an unmerged
 *      sibling branch to acquire it is out of scope for this Arc.
 *   B. The EXISTING `FedosPrivateTransport` class wholesale — REJECTED:
 *      its routing (`resolveFedosConversationTransportRoute()`) is hard-
 *      bound to Direct-mode Conversation membership (exactly two
 *      `"active"` memberships) — a structural mismatch for Device Sync,
 *      which pairs two DEVICES of one account, never a Conversation.
 *      Redesigning that routing to accommodate Device Sync would violate
 *      "do not redesign accepted architecture."
 *   D. A generic, unstructured Relay event — REJECTED: no versioning, no
 *      safety guarantee of any kind.
 *
 * `["p", accountPublicIdentifier]` addresses the ACCOUNT's own public
 * identity, not a per-device key — Device Sync is inherently
 * self-addressed (both Devices already share the SAME account identity);
 * `sourceDeviceId`/`targetDeviceId` (application-layer routing) live
 * inside the wire payload itself, not as a second Nostr tag, since a
 * `deviceId` is an opaque, Runtime-local string with no Nostr-key meaning
 * of its own.
 *
 * HARD GUARDRAILS:
 *   - `kind` is ALWAYS `1` — never a new kind, matching this codebase's
 *     own frozen `FedosNostrSigningAuthority` scope exactly.
 *   - `content` is the payload's own canonical JSON — never re-encrypted
 *     or re-encoded here; the ONE opaque field inside it
 *     (`encryptedPackageBase64`) is the only thing the Relay cannot read.
 *   - No secret material of any kind is ever placed in a tag (this Arc's
 *     own absolute prohibition) — every tag value here is a public
 *     account identity or a structural marker.
 */

import type { FedosNostrUnsignedEventRequest } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import {
  isWellFormedFedosDeviceRelaySyncWirePayloadV1,
  type FedosDeviceRelaySyncWirePayloadV1,
} from "./fedos_device_relay_sync_wire_payload.js";

/** Recognizable, non-authenticating marker tag — the actual route-identity boundary is `routeVersion` inside the signed content, not this tag. Distinct from `FEDOS_DEVICE_BINDING_TAG`/`["fedos-private","1"]`. */
export const FEDOS_DEVICE_RELAY_SYNC_TAG: readonly [string, string] = ["fedos-device-sync", "1"];
const FIXED_NOSTR_KIND = 1;

/** Resource limit (Phase K's own "oversized payload" test) — an ordinary Device Sync inventory snapshot is a few kilobytes; 256 KiB is generous headroom while still refusing a Relay-supplied event designed to exhaust memory/CPU during JSON parsing. Checked on the RAW `content` string, before `JSON.parse()` is ever attempted. */
export const FEDOS_DEVICE_RELAY_SYNC_MAX_CONTENT_BYTES = 256 * 1024;

function tagsMatch(tags: readonly (readonly string[])[]): boolean {
  return tags.some((tag) => tag.length === FEDOS_DEVICE_RELAY_SYNC_TAG.length && tag.every((field, i) => field === FEDOS_DEVICE_RELAY_SYNC_TAG[i]));
}

export interface FedosDeviceRelaySyncUnsignedEventRequestInput {
  readonly payload: FedosDeviceRelaySyncWirePayloadV1;
  readonly localAccountIndex: number;
}

/** Builds the unsigned event request a caller passes to `FedosNostrSigningAuthority.signEvent()` (unchanged, unwidened) — kind 1, the Device Sync marker tag, a `["p", accountPublicIdentifier]` self-addressing tag, and a `["d-session", transferSessionId]` correlation tag (never authenticating — the real security boundary is the signature over the full canonical content, exactly like the existing private route's own `["fedos-private","1"]` convention). */
export function buildFedosDeviceRelaySyncUnsignedEventRequest(input: FedosDeviceRelaySyncUnsignedEventRequestInput): FedosNostrUnsignedEventRequest {
  const { payload } = input;
  return {
    accountIndex: input.localAccountIndex,
    createdAt: payload.createdAt,
    kind: FIXED_NOSTR_KIND,
    tags: [FEDOS_DEVICE_RELAY_SYNC_TAG, ["p", payload.accountPublicIdentifier], ["d-session", payload.transferSessionId]],
    content: JSON.stringify(payload),
  };
}

/**
 * Parses an inbound `FedosEventDescriptor` (Alpha 202, UNCHANGED) back into
 * a `FedosDeviceRelaySyncWirePayloadV1`. Fails closed to `null` for
 * anything not `kind:1`, missing the marker tag, or non-well-formed
 * content — never throws. Does NOT verify the outer signature (the
 * caller's own Relay/subscription layer is trusted to have already
 * delivered a real, relay-accepted event; cryptographic re-verification of
 * the INNER Transfer Package — the actual security boundary — happens in
 * `../fedos_device_relay_sync_inbound_handler.ts` via the unmodified
 * `FedosDeviceTransferCoordinator`).
 */
export function parseFedosDeviceRelaySyncEventDescriptor(descriptor: FedosEventDescriptor): FedosDeviceRelaySyncWirePayloadV1 | null {
  if (descriptor.kind !== FIXED_NOSTR_KIND) return null;
  if (!tagsMatch(descriptor.tags)) return null;
  if (descriptor.content.length > FEDOS_DEVICE_RELAY_SYNC_MAX_CONTENT_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(descriptor.content);
  } catch {
    return null;
  }
  if (!isWellFormedFedosDeviceRelaySyncWirePayloadV1(parsed)) return null;
  return parsed;
}
