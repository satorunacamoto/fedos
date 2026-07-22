/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Acknowledgement Canonical Bytes and Signing Boundary.
 *
 * Phase K — mirrors `fedos_deletion_request_canonical_bytes.ts`/
 * `fedos_deletion_request_signing.ts` exactly, over
 * `FedosDeletionAcknowledgementRecordV1` instead of
 * `FedosDeletionRequestRecordV1`: fixed field order, `JSON.stringify`
 * per leaf value only, real signature via the SAME
 * `FedosNostrSigningAuthority`/`FedosNobleTestNostrSigningAuthority`,
 * real verification via the SAME `validateInboundNostrEvent` — no
 * second signing/verification implementation. This Arc never transmits
 * an acknowledgement (Absolute Prohibitions) — this boundary exists so a
 * FUTURE transport Arc's own wire format is already fully specified and
 * testable today.
 */

import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import { validateInboundNostrEvent } from "../../desktop/combined_inbound_event_validator.js";
import type { FedosNostrSigningAuthority, FedosNostrUnsignedEventRequest } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import { isWellFormedFedosDeletionAcknowledgementRecordV1, type FedosDeletionAcknowledgementRecordV1 } from "./fedos_deletion_acknowledgement_record.js";

const ACKNOWLEDGEMENT_NOSTR_KIND = 1;

function nullableStringLiteral(value: string | null): string {
  return value === null ? "null" : JSON.stringify(value);
}

function scopeArrayLiteral(scopes: readonly string[]): string {
  return `[${scopes.map((s) => JSON.stringify(s)).join(",")}]`;
}

function integerLiteral(value: number): string {
  if (!Number.isInteger(value)) {
    throw new Error("fedos_deletion_acknowledgement_signing: non-integer field reached canonicalization — validate the record first.");
  }
  return String(value);
}

/** Fixed field order — never `JSON.stringify(record)` on the whole object. */
export function canonicalizeFedosDeletionAcknowledgementRecordV1(record: FedosDeletionAcknowledgementRecordV1): string {
  const parts: readonly string[] = [
    `"schemaVersion":${integerLiteral(record.schemaVersion)}`,
    `"requestId":${JSON.stringify(record.requestId)}`,
    `"recipientAccountRef":${JSON.stringify(record.recipientAccountRef)}`,
    `"recipientDeviceRef":${nullableStringLiteral(record.recipientDeviceRef)}`,
    `"outcome":${JSON.stringify(record.outcome)}`,
    `"appliedScopes":${scopeArrayLiteral(record.appliedScopes)}`,
    `"retainedScopes":${scopeArrayLiteral(record.retainedScopes)}`,
    `"evidenceClass":${JSON.stringify(record.evidenceClass)}`,
    `"acknowledgedAt":${integerLiteral(record.acknowledgedAt)}`,
    `"protocolVersion":${integerLiteral(record.protocolVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}

export interface FedosSignedDeletionAcknowledgementV1 {
  readonly record: FedosDeletionAcknowledgementRecordV1;
  readonly wireEvent: FedosNostrWireEvent;
}

export interface FedosDeletionAcknowledgementSigningDependencies {
  readonly signingAuthority: Pick<FedosNostrSigningAuthority, "signEvent">;
  readonly recipientAccountIndex: number;
}

export async function signFedosDeletionAcknowledgementRecordV1(
  record: FedosDeletionAcknowledgementRecordV1,
  deps: FedosDeletionAcknowledgementSigningDependencies,
): Promise<FedosSignedDeletionAcknowledgementV1 | null> {
  if (!isWellFormedFedosDeletionAcknowledgementRecordV1(record)) return null;
  if (!Number.isInteger(deps.recipientAccountIndex) || deps.recipientAccountIndex < 0) return null;

  const content = canonicalizeFedosDeletionAcknowledgementRecordV1(record);
  const unsigned: FedosNostrUnsignedEventRequest = {
    accountIndex: deps.recipientAccountIndex,
    createdAt: record.acknowledgedAt,
    kind: ACKNOWLEDGEMENT_NOSTR_KIND,
    tags: [],
    content,
  };

  const wireEvent = await deps.signingAuthority.signEvent(unsigned);
  if (wireEvent === null) return null;
  return { record, wireEvent };
}

export function verifyFedosSignedDeletionAcknowledgementV1(signed: FedosSignedDeletionAcknowledgementV1): boolean {
  try {
    if (!isWellFormedFedosDeletionAcknowledgementRecordV1(signed.record)) return false;
    const validated = validateInboundNostrEvent(signed.wireEvent);
    if (validated === null) return false;
    if (validated.kind !== ACKNOWLEDGEMENT_NOSTR_KIND) return false;
    return validated.content === canonicalizeFedosDeletionAcknowledgementRecordV1(signed.record);
  } catch {
    return false;
  }
}
