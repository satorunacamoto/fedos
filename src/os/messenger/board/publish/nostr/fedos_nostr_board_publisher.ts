/**
 * Secure Runtime Alpha 455 ("FedosNostrBoardPublisher Interface") —
 * Stage 5 of the Alpha 451–460 Canonical Nostr Outbound Publisher
 * Foundation Arc. Alpha 448
 * (`docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`)
 * already named and predicted this exact file's own path and this exact
 * type's own name ("no `FedosNostrBoardPublisher` is created" — this
 * Stage is the one that creates it), reserved for `Board Reader → Nostr
 * Signing Authority → FedosRelay`, now given a real, MINIMAL shape —
 * TRANSPORT ONLY, exactly the narrow slice this Arc's own scope takes
 * (`docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md`),
 * never the fuller delivery-observation/retry/backoff flow the
 * README's own Alpha 450 "Next Arc" recommendation named.
 *
 * `FedosNostrBoardPublishEntry` pairs a `FedosBoardOutboxIntent` (Alpha
 * 414, UNCHANGED — carries routing identity: `postId`/`target` only,
 * never a body) with an already-signed `FedosNostrWireEvent` (Alpha
 * 234, UNCHANGED — produced upstream by `FedosNostrSigningAuthority`,
 * Alpha 442–445, out of THIS Arc's own scope). The Outbox persistence
 * itself (`FedosBoardOutboxPersistence`, Alpha 417, UNCHANGED) never
 * stores a signed event body (Alpha 414's own "never a protocol-native
 * payload" guardrail) — so this interface's own CALLER, not this file,
 * is responsible for obtaining the `FedosNostrWireEvent` paired with
 * each intent
 * (`docs/secure_runtime_alpha_451_existing_publisher_boundary_inventory.md`
 * documents this boundary in full).
 *
 * `publishOne`/`publishBatch` each return ONLY a boolean success/failure
 * signal — never a result object, never an accepted/message/OK field of
 * any kind, mirroring `FedosRelay.publish()`'s own "No ACK handling"
 * discipline (Alpha 216) one layer up. `false` covers EVERY failure
 * path uniformly (protocol mismatch, a disconnected Relay, a thrown
 * Relay error) — this interface names no failure-reason vocabulary,
 * since that would be Observation, explicitly out of this Arc's own
 * scope.
 *
 * HARD GUARDRAILS:
 *   - `FedosNostrBoardPublisher` and `FedosNostrBoardPublishEntry` are
 *     the ONLY exports.
 *   - `publishOne(entry): Promise<boolean>` and `publishBatch(entries):
 *     Promise<readonly boolean[]>` are the ONLY methods — no retry, no
 *     backoff, no delivery-observation query, no ACK/OK-correlation
 *     method, no pool/connection-management method of any kind.
 *   - `FedosBoardOutboxIntent`/`FedosNostrWireEvent` are imported as
 *     TYPE ONLY — this file performs no construction, signing, or
 *     transformation of any kind; that is exclusively
 *     `FedosRelayNostrBoardPublisher`'s own concern (Alpha 456/457).
 *   - This file defines TYPES ONLY — no function, no class, no runtime
 *     behavior.
 */

import type { FedosBoardOutboxIntent } from "../../outbox/fedos_board_outbox_types.js";
import type { FedosNostrWireEvent } from "../../../../../desktop/fedos_nostr_wire_event.js";

export interface FedosNostrBoardPublishEntry {
  readonly intent: FedosBoardOutboxIntent;
  readonly event: FedosNostrWireEvent;
}

export interface FedosNostrBoardPublisher {
  publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean>;
  publishBatch(entries: readonly FedosNostrBoardPublishEntry[]): Promise<readonly boolean[]>;
}
