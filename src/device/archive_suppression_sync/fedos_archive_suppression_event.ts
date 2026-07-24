/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Wire Payload ⇄ Nostr Event mapping. Mirrors
 * `../relay_sync/fedos_device_relay_sync_event.ts`'s own exact route
 * decision and rationale (Alpha 3641-3720 Phase B/C) — a NEW, dedicated
 * proprietary `kind:1` route reusing this codebase's already-real
 * primitives (`FedosNostrSigningAuthority.signEvent()`, `FedosRelay`),
 * under a NEW, distinct marker tag so it can never collide with Device
 * Transfer's own `["fedos-device-sync","1"]` traffic, the Private
 * Transport's own `["fedos-private","1"]` traffic, a public Board post,
 * or any NIP-17 Gift Wrap.
 *
 * Self-addressed (`["p", accountPublicIdentifier]`) for the identical
 * reason Device Relay Sync is: suppression facts propagate between two
 * DEVICES of the SAME account, never a Conversation — see the Phase A
 * reconciliation report's own §11 finding that the Conversation-scoped
 * NIP-17 private-transport control-payload channel is structurally the
 * wrong shape for this.
 *
 * HARD GUARDRAILS:
 *   - `kind` is ALWAYS `1` — never a new kind, matching this codebase's
 *     own frozen `FedosNostrSigningAuthority` scope.
 *   - No secret material of any kind in a tag — every tag value here is
 *     a public account identity, a Device id (opaque, non-secret), or a
 *     structural marker.
 */

import type { FedosNostrUnsignedEventRequest } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import {
  isWellFormedFedosArchiveSuppressionWirePayloadV1,
  type FedosArchiveSuppressionWirePayloadV1,
} from "./fedos_archive_suppression_wire_payload.js";

/** Distinct from `FEDOS_DEVICE_RELAY_SYNC_TAG` (`["fedos-device-sync","1"]`) and `["fedos-private","1"]` — a recognizable, non-authenticating marker; the real route-identity boundary is `schemaVersion` inside the signed content plus this fixed tag together. */
export const FEDOS_ARCHIVE_SUPPRESSION_SYNC_TAG: readonly [string, string] = ["fedos-archive-suppression-sync", "1"];
const FIXED_NOSTR_KIND = 1;

/** An ordinary suppression fact is well under 1 KiB; 64 KiB is generous headroom while still refusing a Relay-supplied event designed to exhaust memory/CPU during JSON parsing. Checked on the RAW `content` string, before `JSON.parse()` is ever attempted (mirrors Device Relay Sync's own resource-limit discipline). */
export const FEDOS_ARCHIVE_SUPPRESSION_SYNC_MAX_CONTENT_BYTES = 64 * 1024;

function tagsMatch(tags: readonly (readonly string[])[]): boolean {
  return tags.some(
    (tag) => tag.length === FEDOS_ARCHIVE_SUPPRESSION_SYNC_TAG.length && tag.every((field, i) => field === FEDOS_ARCHIVE_SUPPRESSION_SYNC_TAG[i]),
  );
}

export interface FedosArchiveSuppressionUnsignedEventRequestInput {
  readonly payload: FedosArchiveSuppressionWirePayloadV1;
  readonly localAccountIndex: number;
}

export function buildFedosArchiveSuppressionUnsignedEventRequest(
  input: FedosArchiveSuppressionUnsignedEventRequestInput,
): FedosNostrUnsignedEventRequest {
  const { payload } = input;
  return {
    accountIndex: input.localAccountIndex,
    createdAt: payload.createdAt,
    kind: FIXED_NOSTR_KIND,
    tags: [
      FEDOS_ARCHIVE_SUPPRESSION_SYNC_TAG,
      ["p", payload.fact.accountRef.publicIdentifier],
      ["d-target", payload.targetDeviceId],
    ],
    content: JSON.stringify(payload),
  };
}

/**
 * Parses an inbound `FedosEventDescriptor` back into a
 * `FedosArchiveSuppressionWirePayloadV1`. Fails closed to `null` for
 * anything not `kind:1`, missing the marker tag, over the size limit, or
 * non-well-formed content — never throws. Does NOT verify the outer
 * signature (the inbound handler's own separate, first-line concern).
 */
export function parseFedosArchiveSuppressionEventDescriptor(descriptor: FedosEventDescriptor): FedosArchiveSuppressionWirePayloadV1 | null {
  if (descriptor.kind !== FIXED_NOSTR_KIND) return null;
  if (!tagsMatch(descriptor.tags)) return null;
  if (descriptor.content.length > FEDOS_ARCHIVE_SUPPRESSION_SYNC_MAX_CONTENT_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(descriptor.content);
  } catch {
    return null;
  }
  if (!isWellFormedFedosArchiveSuppressionWirePayloadV1(parsed)) return null;
  return parsed;
}
