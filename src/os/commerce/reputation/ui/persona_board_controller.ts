/**
 * Reputation / Persona Epoch — leaf, framework-agnostic controller (Wave B,
 * Agent R closure pass).
 *
 * Mirrors `../../order/ui/order_ui_controller.ts`'s established pattern in
 * this codebase: a small class wrapping the real domain functions behind a
 * single-viewer-scoped method surface, with zero Electron/DOM/IPC
 * dependency — safe for the coordinator to mount against real IPC glue
 * later (see `../persona_board_query.ts`'s own TODO block for exactly what
 * that wiring needs). This file does NOT touch any Electron
 * main/preload/renderer-root file itself.
 *
 * DELIBERATE OMISSION, mirroring `OrderControllerDeps`'s own documented
 * omission: this controller exposes NO method that could construct a
 * `TradeCompletionAttestationPayload` from anything other than a real,
 * already-completed `Order` looked up from a real `OrderRepository` — see
 * `issueTradeCompletionAttestation`'s own header for the full argument.
 * There is no "just mark this trade complete for reputation purposes"
 * shortcut anywhere in this class.
 */

import {
  issueTradeCompletionAttestation,
  buildReputationAttestationSummary,
  type IssueTradeCompletionAttestationRequest,
  type IssueTradeCompletionAttestationResult,
  type BuildReputationAttestationSummaryResult,
} from "../reputation_issuance.js";
import { queryPersonaBoardView, type PersonaBoardQueryResult } from "../persona_board_query.js";
import type { LocalTradeCompletionAttestationStore } from "../trade_completion_attestation_store.js";
import type { LocalPersonaEpochRegistry } from "../persona_epoch_registry.js";
import type { OrderRepository } from "../../order/order_repository_port.js";
import type { PersonaBoardDisclosureLayer } from "../disclosure_layers.js";
import type { PersonaEpochSigningKeypair } from "../persona_epoch_signing_keypair.js";

export interface PersonaBoardControllerDeps {
  readonly orderRepository: OrderRepository;
  readonly store: LocalTradeCompletionAttestationStore;
  readonly registry: LocalPersonaEpochRegistry;
  /** Injectable clock for deterministic tests; defaults to `Date.now`. */
  readonly now?: () => number;
}

/**
 * A single viewer's window onto Reputation/Persona Board capability.
 * Not scoped to one persona (unlike `CustomerOrderController`/
 * `MerchantOrderController`, which ARE pubkey-scoped) because issuing an
 * attestation always requires the caller to supply the full request
 * (attestor role, epoch, keypair) explicitly — there is no single "current
 * persona" concept this domain layer can assume on the caller's behalf.
 */
export class PersonaBoardController {
  readonly #orderRepository: OrderRepository;
  readonly #store: LocalTradeCompletionAttestationStore;
  readonly #registry: LocalPersonaEpochRegistry;
  readonly #now: () => number;

  constructor(deps: PersonaBoardControllerDeps) {
    this.#orderRepository = deps.orderRepository;
    this.#store = deps.store;
    this.#registry = deps.registry;
    this.#now = deps.now ?? (() => Date.now());
  }

  /** Attempts to mint a `TradeCompletionAttestation` — see
   * `issueTradeCompletionAttestation`'s own header for the full gating
   * discipline. Never succeeds against an order the caller didn't actually
   * complete through the real Order state machine. */
  issueTradeCompletionAttestation(
    request: IssueTradeCompletionAttestationRequest,
  ): IssueTradeCompletionAttestationResult {
    return issueTradeCompletionAttestation(
      { orderRepository: this.#orderRepository, store: this.#store },
      request,
      this.#now(),
    );
  }

  /** Rolls a verified attestation set up into a signed, self-attested
   * `ReputationAttestation` summary for `subjectEpoch`. */
  buildReputationSummary(
    subjectEpoch: Parameters<typeof buildReputationAttestationSummary>[0]["subjectEpoch"],
    aggregatorKeypair: PersonaEpochSigningKeypair,
  ): BuildReputationAttestationSummaryResult {
    return buildReputationAttestationSummary({
      subjectEpoch,
      aggregatorKeypair,
      store: this.#store,
      asOf: this.#now(),
    });
  }

  /** The read-only Persona Board view for one epoch at one disclosure
   * layer — see `disclosure_layers.ts` for PUBLIC / PSEUDONYMOUS_PROOF /
   * AUTHORIZED semantics. Returns `undefined` for an unknown epoch id. */
  getPersonaBoardView(
    subjectEpochId: string,
    layer: PersonaBoardDisclosureLayer,
  ): PersonaBoardQueryResult | undefined {
    return queryPersonaBoardView(subjectEpochId, layer, this.#registry, this.#store, this.#now());
  }
}
