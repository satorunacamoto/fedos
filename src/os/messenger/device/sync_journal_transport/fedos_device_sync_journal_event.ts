/**
 * Own-Device Sync Protocol Final Closure arc — Wire Payload <-> Nostr
 * Event mapping. Mirrors
 * `../relay_sync/fedos_device_relay_sync_event.ts` exactly: kind:1,
 * self-addressed via `["p", accountPublicIdentifier]`, a NEW, DISTINCT
 * marker tag (`FEDOS_DEVICE_SYNC_JOURNAL_TAG`) so this route can never
 * collide with or be mistaken for the Job 1 Registry-sync route's own
 * `["fedos-device-sync","1"]` tag, a public Board post, or any other
 * existing route. Same route-decision rationale as Job 1 (NIP-17
 * genuinely absent from this line of history) -- not re-litigated here.
 */

import type { FedosNostrUnsignedEventRequest } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import {
  isWellFormedFedosDeviceSyncJournalWirePayloadV1,
  type FedosDeviceSyncJournalWirePayloadV1,
} from "./fedos_device_sync_journal_wire_payload.js";

export const FEDOS_DEVICE_SYNC_JOURNAL_TAG: readonly [string, string] = ["fedos-device-sync-journal", "1"];
const FIXED_NOSTR_KIND = 1;
export const FEDOS_DEVICE_SYNC_JOURNAL_MAX_CONTENT_BYTES = 256 * 1024;

function tagsMatch(tags: readonly (readonly string[])[]): boolean {
  return tags.some((tag) => tag.length === FEDOS_DEVICE_SYNC_JOURNAL_TAG.length && tag.every((field, i) => field === FEDOS_DEVICE_SYNC_JOURNAL_TAG[i]));
}

export interface FedosDeviceSyncJournalUnsignedEventRequestInput {
  readonly payload: FedosDeviceSyncJournalWirePayloadV1;
  readonly localAccountIndex: number;
}

export function buildFedosDeviceSyncJournalUnsignedEventRequest(input: FedosDeviceSyncJournalUnsignedEventRequestInput): FedosNostrUnsignedEventRequest {
  const { payload } = input;
  return {
    accountIndex: input.localAccountIndex,
    createdAt: payload.createdAt,
    kind: FIXED_NOSTR_KIND,
    tags: [FEDOS_DEVICE_SYNC_JOURNAL_TAG, ["p", payload.accountPublicIdentifier], ["d-session", payload.transferSessionId]],
    content: JSON.stringify(payload),
  };
}

/** Does NOT verify the outer signature -- mirrors the Job 1 route's own explicit division of labor (real cryptographic verification happens in the inbound handler). */
export function parseFedosDeviceSyncJournalEventDescriptor(descriptor: FedosEventDescriptor): FedosDeviceSyncJournalWirePayloadV1 | null {
  if (descriptor.kind !== FIXED_NOSTR_KIND) return null;
  if (!tagsMatch(descriptor.tags)) return null;
  if (descriptor.content.length > FEDOS_DEVICE_SYNC_JOURNAL_MAX_CONTENT_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(descriptor.content);
  } catch {
    return null;
  }
  if (!isWellFormedFedosDeviceSyncJournalWirePayloadV1(parsed)) return null;
  return parsed;
}
