/**
 * Own-Device Sync Protocol Final Closure arc — the Journal Batch Outbound
 * Coordinator. This is the REAL implementation this whole arc exists to
 * deliver: `createFedosDeviceSyncJournalAttemptFn()` (bottom of this file)
 * produces a real `FedosDeviceSyncAttemptFn`
 * (`../sync_scheduler/fedos_device_sync_attempt.ts`) -- the exact
 * injection point `fedos_electron_beta_main.cts`'s own `wrapAttemptFn()`
 * call currently supplies nothing to, running a fail-closed stub forever
 * (see `docs/reviews/fedos-own-device-sync-final/04_ROOT_CAUSE_AND_IMPLEMENTATION_PLAN.md`).
 *
 * Mirrors `../relay_sync/fedos_device_relay_sync_outbound_coordinator.ts`'s
 * own defense-in-depth order exactly: (1) verify source Device remains
 * trusted, (2) verify target Device remains trusted, (3) read the exact
 * `[fromSequence, toSequence]` range from the LOCAL `FedosSyncJournal`
 * (via `FedosSyncState.journalEntries()`, filtered here -- `FedosSyncJournal`
 * itself is UNMODIFIED, unwidened; no new public range-read method was
 * added to that frozen Alpha 2421-2500 class), (4) build the Journal
 * Batch + seal it, (5) build the versioned wire payload, (6) sign through
 * the EXISTING, UNWIDENED `FedosNostrSigningAuthority.signEvent()`
 * (kind 1), (7) publish via the ALREADY GENERIC
 * `FedosDeviceRelaySyncPublisher` (confirmed reusable as-is -- it operates
 * on any signed Nostr event, no Job-1-specific coupling), (8) map the
 * per-Relay outcome into the Scheduler's own closed
 * `FedosDeviceSyncAttemptOutcomeCode` vocabulary (never a new one).
 */

import type { FedosDeviceBindingAccountRef } from "../fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosSyncState } from "../../sync/fedos_sync_state.js";
import type { FedosSyncJournalEntryV1 } from "../../sync/fedos_sync_journal.js";
import type { FedosNostrSigningAuthority } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { AeadAlgorithm } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import {
  FedosSecureRandomDeviceBindingChallengeNonceGenerator,
  type FedosDeviceBindingChallengeNonceGenerator,
} from "../binding_challenge/fedos_device_binding_challenge.js";
import type { FedosDeviceSyncJournalBatchV1 } from "./fedos_device_sync_journal_batch.js";
import type { FedosDeviceSyncJournalPackageEncryptionAuthority } from "./fedos_device_sync_journal_package_encryption.js";
import { buildFedosDeviceSyncJournalWirePayload } from "./fedos_device_sync_journal_wire_payload.js";
import { buildFedosDeviceSyncJournalUnsignedEventRequest } from "./fedos_device_sync_journal_event.js";
import type { FedosDeviceRelaySyncPublisher } from "../relay_sync/fedos_device_relay_sync_publisher.js";
import type { FedosDeviceRelaySyncObservationRepository } from "../relay_sync/fedos_device_relay_sync_observation.js";
import type { FedosDeviceSyncAttemptFn, FedosDeviceSyncAttemptRequest, FedosDeviceSyncAttemptResult } from "../sync_scheduler/fedos_device_sync_attempt.js";

const DEFAULT_TTL_SECONDS = 86_400;

export type FedosDeviceSyncJournalOutboundOutcome =
  | "published"
  | "source-not-trusted"
  | "target-not-trusted"
  | "wrong-account"
  | "no-entries"
  | "key-unavailable"
  | "invalid-input"
  | "failed";

export interface FedosDeviceSyncJournalOutboundResult {
  readonly outcome: FedosDeviceSyncJournalOutboundOutcome;
  readonly relayOutcomes: readonly { readonly relayUrl: string; readonly outcome: "accepted" | "rejected" | "failed" }[] | null;
}

export interface FedosDeviceSyncJournalOutboundDeps {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly syncState: FedosSyncState;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly publisher: FedosDeviceRelaySyncPublisher;
  readonly encryptionAuthority: FedosDeviceSyncJournalPackageEncryptionAuthority;
  readonly observationRepository: FedosDeviceRelaySyncObservationRepository;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
  readonly suite: AeadAlgorithm;
  readonly nonceGenerator?: FedosDeviceBindingChallengeNonceGenerator;
  readonly ttlSeconds?: number;
  readonly now?: () => number;
}

export interface FedosDeviceSyncJournalOutboundRequest {
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly transferSessionId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Reads exactly `[fromSequence, toSequence]`, ascending, from the local Journal -- `null` if the range is not gapless/fully present locally (never sends a partial/reordered batch). */
function readGaplessRange(syncState: FedosSyncState, sourceDeviceId: string, fromSequence: number, toSequence: number): readonly FedosSyncJournalEntryV1[] | null {
  const all = syncState.journalEntries().filter((e) => e.originDeviceRef === sourceDeviceId && e.sequence >= fromSequence && e.sequence <= toSequence);
  const sorted = [...all].sort((a, b) => a.sequence - b.sequence);
  const expectedCount = toSequence - fromSequence + 1;
  if (sorted.length !== expectedCount) return null;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i]!.sequence !== fromSequence + i) return null;
  }
  return sorted;
}

export class FedosDeviceSyncJournalOutboundCoordinator {
  readonly #deps: FedosDeviceSyncJournalOutboundDeps;
  readonly #nonceGenerator: FedosDeviceBindingChallengeNonceGenerator;
  readonly #now: () => number;

  constructor(deps: FedosDeviceSyncJournalOutboundDeps) {
    this.#deps = deps;
    this.#nonceGenerator = deps.nonceGenerator ?? new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
    this.#now = deps.now ?? defaultNowSeconds;
  }

  async prepareAndPublish(request: FedosDeviceSyncJournalOutboundRequest, now: number = this.#now()): Promise<FedosDeviceSyncJournalOutboundResult> {
    const sourceBinding = this.#deps.registryPersistence.getBinding(request.sourceDeviceId);
    if (sourceBinding === null || sourceBinding.trustState !== "trusted") {
      return { outcome: "source-not-trusted", relayOutcomes: null };
    }
    if (sourceBinding.accountRef.authority !== this.#deps.accountRef.authority || sourceBinding.accountRef.publicIdentifier !== this.#deps.accountRef.publicIdentifier) {
      return { outcome: "wrong-account", relayOutcomes: null };
    }
    const targetBinding = this.#deps.registryPersistence.getBinding(request.targetDeviceId);
    if (targetBinding === null || targetBinding.trustState !== "trusted") {
      return { outcome: "target-not-trusted", relayOutcomes: null };
    }
    if (targetBinding.accountRef.authority !== this.#deps.accountRef.authority || targetBinding.accountRef.publicIdentifier !== this.#deps.accountRef.publicIdentifier) {
      return { outcome: "wrong-account", relayOutcomes: null };
    }

    const entries = readGaplessRange(this.#deps.syncState, request.sourceDeviceId, request.fromSequence, request.toSequence);
    if (entries === null || entries.length === 0) {
      return { outcome: "no-entries", relayOutcomes: null };
    }

    const ttlSeconds = this.#deps.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const batch: FedosDeviceSyncJournalBatchV1 = Object.freeze({
      schemaVersion: 1,
      accountAuthority: this.#deps.accountRef.authority,
      accountPublicIdentifier: this.#deps.accountRef.publicIdentifier,
      sourceDeviceId: request.sourceDeviceId,
      targetDeviceId: request.targetDeviceId,
      fromSequence: request.fromSequence,
      toSequence: request.toSequence,
      preparedAt: now,
      expiresAt: now + ttlSeconds,
      entries,
    });

    const built = await this.#deps.encryptionAuthority.build({
      batch,
      suite: this.#deps.suite,
      localAccountIndex: this.#deps.localAccountIndex,
      selfAccountPublicKeyHex: this.#deps.selfAccountPublicKeyHex,
    });
    if (built.outcome === "key-unavailable") return { outcome: "key-unavailable", relayOutcomes: null };
    if (built.outcome === "invalid-input") return { outcome: "invalid-input", relayOutcomes: null };
    if (built.outcome !== "built") return { outcome: "failed", relayOutcomes: null };

    const deliveryId = this.#nonceGenerator.generateNonce();
    const payload = buildFedosDeviceSyncJournalWirePayload({
      package: built.package,
      transferSessionId: request.transferSessionId,
      sourceDeviceId: request.sourceDeviceId,
      targetDeviceId: request.targetDeviceId,
      accountAuthority: this.#deps.accountRef.authority,
      accountPublicIdentifier: this.#deps.accountRef.publicIdentifier,
      fromSequence: request.fromSequence,
      toSequence: request.toSequence,
      createdAt: now,
      expiresAt: now + ttlSeconds,
      deliveryId,
    });

    const subjectId = request.transferSessionId;
    this.#deps.observationRepository.record(subjectId, "queued", now);

    const unsignedRequest = buildFedosDeviceSyncJournalUnsignedEventRequest({ payload, localAccountIndex: this.#deps.localAccountIndex });
    this.#deps.observationRepository.record(subjectId, "publishing", now);
    const event = await this.#deps.signingAuthority.signEvent(unsignedRequest);
    if (event === null) {
      this.#deps.observationRepository.record(subjectId, "relay-failed", now, "signing-failed");
      return { outcome: "failed", relayOutcomes: null };
    }

    const relayOutcomes = await this.#deps.publisher.publish(event);
    for (const relayOutcome of relayOutcomes) {
      const relaySubject = `${subjectId}::${relayOutcome.relayUrl}`;
      const state = relayOutcome.outcome === "accepted" ? "relay-accepted" : relayOutcome.outcome === "rejected" ? "relay-rejected" : "relay-failed";
      this.#deps.observationRepository.record(relaySubject, state, now);
    }

    return { outcome: "published", relayOutcomes };
  }
}

/**
 * Maps this coordinator's own outcome vocabulary into the Scheduler's
 * closed `FedosDeviceSyncAttemptOutcomeCode` (never a new one) and gives
 * `fedos_electron_beta_main.cts` a real, non-stub argument for
 * `wrapAttemptFn()`.
 */
export function createFedosDeviceSyncJournalAttemptFn(coordinator: FedosDeviceSyncJournalOutboundCoordinator): FedosDeviceSyncAttemptFn {
  return async (request: FedosDeviceSyncAttemptRequest): Promise<FedosDeviceSyncAttemptResult> => {
    const result = await coordinator.prepareAndPublish({
      sourceDeviceId: request.sourceDeviceId,
      targetDeviceId: request.targetDeviceId,
      transferSessionId: request.transferSessionId,
      fromSequence: request.fromSequence,
      toSequence: request.toSequence,
    });

    switch (result.outcome) {
      case "source-not-trusted":
        return { outcome: "revoked-source", reason: "source device is not currently trusted" };
      case "target-not-trusted":
        return { outcome: "revoked-target", reason: "target device is not currently trusted" };
      case "wrong-account":
        return { outcome: "identity-conflict", reason: "device binding does not match the expected account" };
      case "no-entries":
        // Nothing to send for this range right now (e.g. archived/skipped locally) -- not an error, but not
        // "delivered" either; classify as a permanent no-op for THIS exact range so the Scheduler does not
        // retry an empty range forever.
        return { outcome: "route-rejected-permanent", reason: "no journal entries found for the requested range" };
      case "key-unavailable":
        return { outcome: "crypto-temporarily-unavailable", reason: "master seed / conversation key unavailable" };
      case "invalid-input":
        return { outcome: "tampered-package", reason: "invalid input building the journal package" };
      case "failed":
        return { outcome: "failed" };
      case "published": {
        const accepted = result.relayOutcomes?.some((o) => o.outcome === "accepted") ?? false;
        if (accepted) return { outcome: "delivered" };
        const allRejected = (result.relayOutcomes?.length ?? 0) > 0 && result.relayOutcomes!.every((o) => o.outcome === "rejected");
        if (allRejected) return { outcome: "relay-disconnected", reason: "every configured relay rejected the publish" };
        return { outcome: "relay-timeout", reason: "no relay accepted the publish before timeout" };
      }
      default:
        return { outcome: "failed" };
    }
  };
}
