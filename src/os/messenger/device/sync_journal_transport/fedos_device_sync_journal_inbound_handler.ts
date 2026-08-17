/**
 * Own-Device Sync Protocol Final Closure arc — the Journal Batch Inbound
 * Handler. Mirrors `../relay_sync/fedos_device_relay_sync_inbound_handler.ts`'s
 * exact defense-in-depth order: (1) dedup by outer Relay event id, (2)
 * validate route/event shape, (3) verify the OUTER Nostr signature
 * (`NobleSignatureVerifier`, real BIP-340 Schnorr, UNCHANGED), (4) verify
 * intended recipient Device/account, (5) check expiry, (6) dedup by
 * `transferSessionId`+`packageContentHash` (same package via a different
 * Relay), (7) re-check LIVE Device Registry trust for BOTH source and
 * target, (8) verify the outer content-hash binding BEFORE ever
 * attempting decrypt, (9) open the encrypted Journal Package, (10) apply
 * -- via the composition a real two-`FedosSyncState`-instance test proved
 * correct this arc (`test/fedos_own_device_sync_cross_process_repro.test.ts`):
 * for each entry, IN ARRAY ORDER (the batch's own validated
 * gapless-ascending guarantee -- see `fedos_device_sync_journal_batch.ts`'s
 * own header for why this matters and is not optional), append it into
 * the LOCAL `FedosSyncState` via `recordLocalChange(sourceDeviceId, ...)`
 * then `redeliverChange(localDeviceId, entry.changeId)` to stage it into
 * this process's OWN pending queue -- `applyPendingChanges()` remains the
 * caller's own responsibility (mirrors `FedosDeviceSyncImportCoordinator`'s
 * own "post-processing enrichment over an existing apply call" shape --
 * this handler does not call `applyPendingChanges()` itself so a caller
 * that wants the richer Import Coordinator's own conflict
 * reclassification, rather than the base outcome alone, can compose it).
 */

import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import { NobleSignatureVerifier } from "../../adapters/nostr/protocol/noble_signature.js";
import type { NostrEvent, NostrTag } from "../../adapters/nostr/protocol/types.js";
import type { FedosDeviceBindingAccountRef } from "../fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosSyncState } from "../../sync/fedos_sync_state.js";
import type { FedosDeviceSyncJournalPackageEncryptionAuthority } from "./fedos_device_sync_journal_package_encryption.js";
import type { AeadAlgorithm } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import {
  extractFedosDeviceSyncJournalPackageFromWirePayload,
  isFedosDeviceSyncJournalWirePayloadExpired,
  computeFedosDeviceSyncJournalPackageContentHashForWire,
} from "./fedos_device_sync_journal_wire_payload.js";
import { parseFedosDeviceSyncJournalEventDescriptor } from "./fedos_device_sync_journal_event.js";
import type { FedosDeviceRelaySyncObservationRepository } from "../relay_sync/fedos_device_relay_sync_observation.js";
import type { FedosDeviceRelaySyncInboundDedupPersistence } from "../relay_sync/persistence/fedos_device_relay_sync_inbound_dedup_persistence.js";

export type FedosDeviceSyncJournalInboundOutcome =
  | "imported"
  | "duplicate"
  | "malformed"
  | "invalid-signature"
  | "wrong-recipient"
  | "wrong-account"
  | "source-not-trusted"
  | "target-not-trusted"
  | "expired"
  | "conflict"
  | "manifest-mismatch"
  | "key-unavailable"
  | "invalid-input"
  | "failed";

export interface FedosDeviceSyncJournalInboundEntryOutcome {
  readonly changeId: string;
  readonly appendOutcome: "appended" | "duplicate" | "failed";
  readonly redeliverOutcome: "enqueued" | "duplicate" | "unknown-change";
}

export interface FedosDeviceSyncJournalInboundResult {
  readonly outcome: FedosDeviceSyncJournalInboundOutcome;
  readonly entryOutcomes: readonly FedosDeviceSyncJournalInboundEntryOutcome[];
}

export interface FedosDeviceSyncJournalInboundDeps {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly dedupPersistence: FedosDeviceRelaySyncInboundDedupPersistence;
  readonly observationRepository: FedosDeviceRelaySyncObservationRepository;
  readonly syncState: FedosSyncState;
  readonly localDeviceId: string;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
}

export interface FedosDeviceSyncJournalInboundRequest {
  readonly descriptor: FedosEventDescriptor;
  readonly encryptionAuthority: FedosDeviceSyncJournalPackageEncryptionAuthority;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
  readonly now: number;
}

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

export class FedosDeviceSyncJournalInboundHandler {
  readonly #deps: FedosDeviceSyncJournalInboundDeps;

  constructor(deps: FedosDeviceSyncJournalInboundDeps) {
    this.#deps = deps;
  }

  async handleIncomingEvent(request: FedosDeviceSyncJournalInboundRequest): Promise<FedosDeviceSyncJournalInboundResult> {
    const { descriptor, now } = request;

    if (this.#deps.dedupPersistence.getByRelayEventId(descriptor.id) !== null) {
      return { outcome: "duplicate", entryOutcomes: [] };
    }

    const payload = parseFedosDeviceSyncJournalEventDescriptor(descriptor);
    if (payload === null) {
      this.#deps.observationRepository.record(`relay-event::${descriptor.id}`, "denied", now, "malformed");
      return { outcome: "malformed", entryOutcomes: [] };
    }

    const subjectId = payload.transferSessionId;

    if (descriptor.author !== payload.accountPublicIdentifier) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "invalid-signature");
      return { outcome: "invalid-signature", entryOutcomes: [] };
    }
    if (!(await NobleSignatureVerifier.verify(descriptorToNostrEvent(descriptor)))) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "invalid-signature");
      return { outcome: "invalid-signature", entryOutcomes: [] };
    }

    this.#deps.observationRepository.record(subjectId, "received", now);

    if (payload.targetDeviceId !== this.#deps.localDeviceId) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "wrong-recipient");
      return { outcome: "wrong-recipient", entryOutcomes: [] };
    }
    if (payload.accountAuthority !== this.#deps.localAccountRef.authority || payload.accountPublicIdentifier !== this.#deps.localAccountRef.publicIdentifier) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "wrong-account");
      return { outcome: "wrong-account", entryOutcomes: [] };
    }

    if (isFedosDeviceSyncJournalWirePayloadExpired(payload, now)) {
      this.#deps.observationRepository.record(subjectId, "expired", now);
      return { outcome: "expired", entryOutcomes: [] };
    }

    const existingBySessionAndHash = this.#deps.dedupPersistence.getBySessionAndHash(payload.transferSessionId, payload.packageContentHash);
    if (existingBySessionAndHash !== null) {
      return { outcome: "duplicate", entryOutcomes: [] };
    }

    const sourceBinding = this.#deps.registryPersistence.getBinding(payload.sourceDeviceId);
    if (sourceBinding === null || sourceBinding.trustState !== "trusted") {
      this.#deps.observationRepository.record(subjectId, "denied", now, "source-not-trusted");
      return { outcome: "source-not-trusted", entryOutcomes: [] };
    }
    const targetBinding = this.#deps.registryPersistence.getBinding(payload.targetDeviceId);
    if (targetBinding === null || targetBinding.trustState !== "trusted") {
      this.#deps.observationRepository.record(subjectId, "denied", now, "target-not-trusted");
      return { outcome: "target-not-trusted", entryOutcomes: [] };
    }

    const pkg = extractFedosDeviceSyncJournalPackageFromWirePayload(payload);
    if (pkg === null) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "malformed-package");
      return { outcome: "malformed", entryOutcomes: [] };
    }
    if (computeFedosDeviceSyncJournalPackageContentHashForWire(pkg) !== payload.packageContentHash) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "conflict");
      return { outcome: "conflict", entryOutcomes: [] };
    }

    const opened = await request.encryptionAuthority.read({
      package: pkg,
      suite: request.suite,
      localAccountIndex: request.localAccountIndex,
      selfAccountPublicKeyHex: request.selfAccountPublicKeyHex,
      now,
    });
    if (opened.outcome !== "opened") {
      const mapped = mapReadOutcome(opened.outcome);
      this.#deps.observationRepository.record(subjectId, "denied", now, mapped);
      return { outcome: mapped, entryOutcomes: [] };
    }
    // Belt-and-suspenders: the batch's own claimed source/target must match the outer wire payload's -- a
    // package whose INNER claims disagree with the OUTER routing facts it travelled under is never trusted.
    if (opened.batch.sourceDeviceId !== payload.sourceDeviceId || opened.batch.targetDeviceId !== payload.targetDeviceId) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "conflict");
      return { outcome: "conflict", entryOutcomes: [] };
    }

    this.#deps.dedupPersistence.putImport({
      schemaVersion: 1,
      relayEventId: descriptor.id,
      transferSessionId: payload.transferSessionId,
      packageContentHash: payload.packageContentHash,
      importedAt: now,
    });

    // Apply in ARRAY ORDER -- the batch validator already proved this is gapless-ascending by the sender's own
    // original sequence (see fedos_device_sync_journal_batch.ts's own header for why out-of-order application is
    // a real, proven correctness risk this order preserves against).
    const entryOutcomes: FedosDeviceSyncJournalInboundEntryOutcome[] = [];
    for (const entry of opened.batch.entries) {
      const appendResult = this.#deps.syncState.recordLocalChange(
        payload.sourceDeviceId,
        { changeId: entry.changeId, conversationId: entry.conversationId, kind: entry.kind, contentHash: entry.contentHash },
        entry.recordedAt,
      );
      const redeliverOutcome = this.#deps.syncState.redeliverChange(this.#deps.localDeviceId, entry.changeId);
      entryOutcomes.push({ changeId: entry.changeId, appendOutcome: appendResult.outcome, redeliverOutcome });
    }

    this.#deps.observationRepository.record(subjectId, "imported", now);
    return { outcome: "imported", entryOutcomes };
  }
}

function mapReadOutcome(outcome: string): FedosDeviceSyncJournalInboundOutcome {
  switch (outcome) {
    case "manifest-mismatch":
    case "expired":
    case "malformed":
    case "key-unavailable":
    case "invalid-input":
      return outcome;
    default:
      return "failed";
  }
}
