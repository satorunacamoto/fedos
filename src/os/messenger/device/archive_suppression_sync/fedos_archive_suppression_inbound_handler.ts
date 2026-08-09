/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase G: the Inbound Handler.
 *
 * Sequence, mirroring `../relay_sync/fedos_device_relay_sync_inbound_handler.ts`'s
 * own proven order exactly: (1) dedup by the outer Relay event id, BEFORE
 * any parsing, (2) parse/validate wire shape, (3) verify the OUTER Nostr
 * signature — reusing the EXISTING, UNMODIFIED `NobleSignatureVerifier`
 * (real BIP-340 Schnorr) — a tampered `content` fails closed here, BEFORE
 * any of its claims (including the embedded fact) are acted on, (4)
 * verify intended recipient (`targetDeviceId === localDeviceId`) and
 * account match, (5) check expiry, (6) verify the embedded fact's own
 * structural validity (`validateFedosArchiveSuppressionFact`, already
 * invoked by `isWellFormedFedosArchiveSuppressionWirePayloadV1` at parse
 * time), (7) check LIVE Device Registry trust for the CLAIMED
 * `sourceDeviceId` (revoked/unknown fails closed), (8) verify OPTIONAL
 * Device-level evidence (best-effort, Phase D — never required), (9)
 * hand off to `FedosArchiveSuppressionObservationAuthority.recordImportedSuppression()`
 * for the FINAL replay/revision-ordered write (Phase E's own conflict/
 * rollback rule).
 *
 * Never imports merely because the outer Nostr event was well-formed or
 * relay-accepted — every check above must independently pass first
 * (mirrors Device Relay Sync's own identical discipline). Never executes
 * any deletion of local data — Phase G's own explicit "do not let a
 * peer-controlled fact delete unrelated local data" requirement: this
 * handler's only effect is a new, additive row in the Suppression
 * Observation log; it never calls `payloadStorage`/`envelopePersistence`/
 * `searchIndex` directly.
 */

import type { FedosEventDescriptor } from "../../../../desktop/fedos_event_descriptor.js";
import { NobleSignatureVerifier } from "../../../../nostr/noble_signature.js";
import type { NostrEvent, NostrTag } from "../../../../nostr/types.js";
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";
import {
  isFedosArchiveSuppressionWirePayloadExpired,
  type FedosArchiveSuppressionWirePayloadV1,
} from "../../../../device/archive_suppression_sync/fedos_archive_suppression_wire_payload.js";
import { parseFedosArchiveSuppressionEventDescriptor } from "../../../../device/archive_suppression_sync/fedos_archive_suppression_event.js";
import type { FedosArchiveSuppressionInboundDedupPersistence } from "../../../../device/archive_suppression_sync/persistence/fedos_archive_suppression_inbound_dedup_persistence.js";
import { verifyFedosArchiveSuppressionFactDeviceEvidence } from "../../../../conversation/retention/fedos_archive_suppression_fact_signing.js";
import type {
  FedosArchiveSuppressionObservationAuthority,
  FedosArchiveSuppressionRecordOutcome,
} from "../../../../conversation/retention/fedos_archive_suppression_observation_authority.js";

export type FedosArchiveSuppressionInboundOutcome =
  | "recorded"
  | "already-present"
  | "rollback-rejected"
  | "conflict"
  | "duplicate"
  | "malformed"
  | "invalid-signature"
  | "wrong-recipient"
  | "wrong-account"
  | "source-not-trusted"
  | "expired"
  | "failed";

export interface FedosArchiveSuppressionInboundResult {
  readonly outcome: FedosArchiveSuppressionInboundOutcome;
}

export interface FedosArchiveSuppressionInboundDeps {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly dedupPersistence: FedosArchiveSuppressionInboundDedupPersistence;
  readonly observationAuthority: FedosArchiveSuppressionObservationAuthority;
  readonly localDeviceId: string;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
}

export interface FedosArchiveSuppressionInboundRequest {
  readonly descriptor: FedosEventDescriptor;
  readonly now: number;
}

function mapRecordOutcome(outcome: FedosArchiveSuppressionRecordOutcome): FedosArchiveSuppressionInboundOutcome {
  if (outcome === "recorded") return "recorded";
  if (outcome === "already-present") return "already-present";
  if (outcome === "rollback-rejected") return "rollback-rejected";
  if (outcome === "conflict") return "conflict";
  return "failed";
}

export class FedosArchiveSuppressionInboundHandler {
  readonly #deps: FedosArchiveSuppressionInboundDeps;

  constructor(deps: FedosArchiveSuppressionInboundDeps) {
    this.#deps = deps;
  }

  async handleIncomingEvent(request: FedosArchiveSuppressionInboundRequest): Promise<FedosArchiveSuppressionInboundResult> {
    const { descriptor, now } = request;

    if (this.#deps.dedupPersistence.getByRelayEventId(descriptor.id) !== null) {
      return { outcome: "duplicate" };
    }

    const payload: FedosArchiveSuppressionWirePayloadV1 | null = parseFedosArchiveSuppressionEventDescriptor(descriptor);
    if (payload === null) {
      return { outcome: "malformed" };
    }

    // The claimed account identity must be the SAME identity that actually produced this outer Nostr signature --
    // and that signature must itself be real. A tampered content (any field, including the embedded fact) fails
    // closed here, before any of its claims are acted on.
    if (descriptor.author !== payload.fact.accountRef.publicIdentifier) {
      return { outcome: "invalid-signature" };
    }
    if (!(await NobleSignatureVerifier.verify(descriptorToNostrEvent(descriptor)))) {
      return { outcome: "invalid-signature" };
    }

    if (payload.targetDeviceId !== this.#deps.localDeviceId) {
      return { outcome: "wrong-recipient" };
    }
    if (
      payload.fact.accountRef.authority !== this.#deps.localAccountRef.authority ||
      payload.fact.accountRef.publicIdentifier !== this.#deps.localAccountRef.publicIdentifier
    ) {
      return { outcome: "wrong-account" };
    }

    if (isFedosArchiveSuppressionWirePayloadExpired(payload, now)) {
      return { outcome: "expired" };
    }

    const sourceBinding = this.#deps.registryPersistence.getBinding(payload.sourceDeviceId);
    if (sourceBinding === null || sourceBinding.trustState !== "trusted") {
      return { outcome: "source-not-trusted" };
    }
    if (sourceBinding.deviceId !== payload.fact.sourceDeviceId) {
      // The wire payload's own routing `sourceDeviceId` and the embedded fact's own `sourceDeviceId` must agree --
      // a mismatch means the outer envelope is claiming a different origin than the signed fact itself asserts.
      return { outcome: "invalid-signature" };
    }

    // Phase D: OPTIONAL, best-effort Device-level evidence. Never a hard requirement -- an "account-only" or
    // "device-evidence-invalid" evidence level still reaches the Authority, which records it honestly as such
    // (evaluateSuppression() itself already refuses to let a "device-evidence-invalid" record suppress anything).
    const evidenceLevel = verifyFedosArchiveSuppressionFactDeviceEvidence(
      payload.fact,
      payload.deviceEvidence,
      sourceBinding.devicePublicKeyRef,
    );

    const recordOutcome = this.#deps.observationAuthority.recordImportedSuppression(payload.fact, evidenceLevel);

    this.#deps.dedupPersistence.putImport({
      schemaVersion: 1,
      relayEventId: descriptor.id,
      factId: payload.fact.factId,
      importedAt: now,
    });

    return { outcome: mapRecordOutcome(recordOutcome) };
  }
}

/** PRIVATE — the reverse of `nostrWireEventToFedosEventDescriptor()`, needed ONLY so `NobleSignatureVerifier.verify()` (which expects NIP-01 field names) can check a `FedosEventDescriptor`'s own signature. Pure, synchronous; no I/O. Mirrors Device Relay Sync's own identical helper. */
function descriptorToNostrEvent(descriptor: FedosEventDescriptor): NostrEvent {
  return {
    id: descriptor.id,
    pubkey: descriptor.author,
    created_at: descriptor.createdAt,
    kind: descriptor.kind,
    tags: descriptor.tags.map((tag): NostrTag => [...tag]),
    content: descriptor.content,
    sig: descriptor.signature,
  };
}
