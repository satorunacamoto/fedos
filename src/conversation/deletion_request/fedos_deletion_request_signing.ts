/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Signing Boundary.
 *
 * Phase F — the reviewed model (`860a58e`, Doc 08): account-signed,
 * through the EXISTING `FedosNostrSigningAuthority`
 * (`../../nostr/sign/fedos_nostr_signing_authority.ts`, Alpha 442/445) —
 * no new signing path. This Arc's own canonical bytes
 * (`fedos_deletion_request_canonical_bytes.ts`) become the `content` of
 * a real, `kind: 1` Nostr event; that event's own real `id`/`sig`/
 * `pubkey` ARE this request's signature metadata — no second, redundant
 * signature is added (no real per-Device key exists to add one to,
 * confirmed in this Arc's own reconciliation report §3).
 *
 * VERIFICATION reuses, verbatim, the EXISTING pure-TypeScript,
 * WASM-free primitives (`../../desktop/nostr_event_id_verifier.ts` /
 * `nostr_signature_verifier.ts` / `combined_inbound_event_validator.ts`,
 * Alpha 243/244/245) — this file adds ONE additional check those three
 * do not: that the verified event's own `content` is BYTE-IDENTICAL to
 * the CLAIMED record's own canonical bytes, binding the signature to
 * THIS specific record rather than merely proving the event itself is
 * internally self-consistent (a valid signature over unrelated content
 * would otherwise pass `validateInboundNostrEvent` alone).
 *
 * `FedosNobleTestNostrSigningAuthority` exists ONLY so this Arc's own
 * tests can produce a REAL, independently-verifiable signature without
 * the WASM artifact this worktree does not have — mirroring
 * `MockFedosBoardOutboxPublisher`'s own identical role
 * (`../../board/outbox/fedos_board_outbox_publisher.ts`, Alpha 473) for
 * a different interface. It signs with `@noble/curves/secp256k1.js`'s
 * `schnorr.sign` — the SAME primitive `verifyNostrEventSignature`
 * already calls (`.verify`), an already-declared dependency; this file
 * duplicates the SAME six-character NIP-01 canonical-preimage/id
 * algorithm `verifyNostrEventId`'s own module-private
 * `serializeNostrEventCanonical` uses, matching this codebase's own
 * established precedent (Alpha 243's own header) of deliberately
 * duplicating this tiny, closed, stable algorithm rather than sharing
 * code across independent verification/signing boundaries.
 *
 * HARD GUARDRAILS:
 *   - `FedosNobleTestNostrSigningAuthority` is never imported by any
 *     production entry point — no Runtime/Desktop wiring file anywhere
 *     references it.
 *   - No private key of any kind is ever logged, returned from a public
 *     method, or persisted by this file.
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import { validateInboundNostrEvent } from "../../desktop/combined_inbound_event_validator.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrSigningPublicIdentity } from "../../nostr/sign/fedos_nostr_signing_public_identity.js";
import {
  canonicalizeFedosDeletionRequestRecordV1,
  canonicalBytesForFedosDeletionRequestRecordV1,
} from "./fedos_deletion_request_canonical_bytes.js";
import { isWellFormedFedosDeletionRequestRecordV1, type FedosDeletionRequestRecordV1 } from "./fedos_deletion_request_record.js";

const DELETION_REQUEST_NOSTR_KIND = 1;

export interface FedosSignedDeletionRequestV1 {
  readonly record: FedosDeletionRequestRecordV1;
  readonly wireEvent: FedosNostrWireEvent;
}

export interface FedosDeletionRequestSigningDependencies {
  readonly signingAuthority: Pick<FedosNostrSigningAuthority, "signEvent">;
  readonly requesterAccountIndex: number;
}

/**
 * Signs `record` through the real, injected `FedosNostrSigningAuthority`.
 * `null` if `record` is malformed, if `requesterAccountIndex` is not a
 * valid `u32`, or if the underlying authority itself fails/is
 * unavailable (e.g. no Master Seed held) — never throws.
 */
export async function signFedosDeletionRequestRecordV1(
  record: FedosDeletionRequestRecordV1,
  deps: FedosDeletionRequestSigningDependencies,
): Promise<FedosSignedDeletionRequestV1 | null> {
  if (!isWellFormedFedosDeletionRequestRecordV1(record)) return null;
  if (!Number.isInteger(deps.requesterAccountIndex) || deps.requesterAccountIndex < 0) return null;

  const content = canonicalizeFedosDeletionRequestRecordV1(record);
  const unsigned: FedosNostrUnsignedEventRequest = {
    accountIndex: deps.requesterAccountIndex,
    createdAt: record.issuedAt,
    kind: DELETION_REQUEST_NOSTR_KIND,
    tags: [],
    content,
  };

  const wireEvent = await deps.signingAuthority.signEvent(unsigned);
  if (wireEvent === null) return null;
  return { record, wireEvent };
}

/**
 * Verifies `signed` end to end: real NIP-01 id self-consistency, real
 * BIP-340 signature validity (both via `validateInboundNostrEvent`,
 * unmodified), AND that the verified event's own `content` is
 * byte-identical to `signed.record`'s own canonical bytes — binding the
 * signature to THIS record, not merely to some content. Never throws.
 */
export function verifyFedosSignedDeletionRequestV1(signed: FedosSignedDeletionRequestV1): boolean {
  try {
    if (!isWellFormedFedosDeletionRequestRecordV1(signed.record)) return false;
    const validated = validateInboundNostrEvent(signed.wireEvent);
    if (validated === null) return false;
    if (validated.kind !== DELETION_REQUEST_NOSTR_KIND) return false;
    const expectedContent = canonicalizeFedosDeletionRequestRecordV1(signed.record);
    return validated.content === expectedContent;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Test-only signing authority — see this file's own header.
// ---------------------------------------------------------------------

const NIP01_RESERVED_ESCAPES: Readonly<Record<string, string>> = {
  "\n": "\\n",
  '"': '\\"',
  "\\": "\\\\",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
};

/** Duplicates `verifyNostrEventId`'s own module-private six-character escape rule — see this file's own header for why. */
function escapeNip01CanonicalString(value: string): string {
  let out = "";
  for (const ch of value) out += NIP01_RESERVED_ESCAPES[ch] ?? ch;
  return out;
}

function serializeTagsCanonical(tags: readonly (readonly string[])[]): string {
  const parts = tags.map((tag) => `[${tag.map((t) => `"${escapeNip01CanonicalString(t)}"`).join(",")}]`);
  return `[${parts.join(",")}]`;
}

function nip01CanonicalPreimage(pubkey: string, createdAt: number, kind: number, tags: readonly (readonly string[])[], content: string): string {
  return `[0,"${escapeNip01CanonicalString(pubkey)}",${createdAt},${kind},${serializeTagsCanonical(tags)},"${escapeNip01CanonicalString(content)}"]`;
}

export interface FedosNobleTestNostrSigningAuthorityAccount {
  readonly accountIndex: number;
  readonly secretKey: Uint8Array;
}

/**
 * A REAL Schnorr signer (never a stub/pass-through) built directly on
 * `@noble/curves`, isolated from the real Master-Seed/WASM production
 * path. Test-only — see this file's own header. `signEvent` never
 * throws; returns `null` for an unregistered `accountIndex` or a
 * malformed request.
 */
export class FedosNobleTestNostrSigningAuthority implements FedosNostrSigningAuthority {
  readonly #byAccountIndex = new Map<number, Uint8Array>();

  constructor(accounts: readonly FedosNobleTestNostrSigningAuthorityAccount[]) {
    for (const account of accounts) this.#byAccountIndex.set(account.accountIndex, account.secretKey);
  }

  async signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null> {
    try {
      const secretKey = this.#byAccountIndex.get(request.accountIndex);
      if (secretKey === undefined) return null;
      const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      const preimage = nip01CanonicalPreimage(pubkey, request.createdAt, request.kind, request.tags, request.content);
      const idBytes = sha256(new TextEncoder().encode(preimage));
      const sigBytes = schnorr.sign(idBytes, secretKey);
      return Object.freeze({
        id: bytesToHex(idBytes),
        pubkey,
        created_at: request.createdAt,
        kind: request.kind,
        tags: Object.freeze(request.tags.map((tag) => Object.freeze([...tag]))),
        content: request.content,
        sig: bytesToHex(sigBytes),
      });
    } catch {
      return null;
    }
  }

  async publicIdentityForAccount(accountIndex: number): Promise<FedosNostrSigningPublicIdentity | null> {
    const secretKey = this.#byAccountIndex.get(accountIndex);
    if (secretKey === undefined) return null;
    return { accountIndex, publicKeyHex: bytesToHex(schnorr.getPublicKey(secretKey)) };
  }
}

/** Deterministic, test-only helper — never a real account secret generator. */
export function fedosTestSecretKeyFromSeed(seed: string): Uint8Array {
  return sha256(new TextEncoder().encode(`fedos-deletion-request-test-signing-authority::${seed}`));
}

export function hexToNostrPubkey(hex: string): Uint8Array {
  return hexToBytes(hex);
}
