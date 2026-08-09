/**
 * FedOS Identity Transition Foundation Arc — Phase N: the safe status
 * DTO. Mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_safe_status.ts`'s
 * own header discipline exactly: "a closed, pre-computed status string
 * only, never counters/keys/signatures/revisions/raw evidence" — except
 * this domain's own Phase B mandate additionally forbids collapsing to a
 * single boolean, so this DTO exposes the closed `evidenceOutcome` AND
 * `acceptanceState` strings side by side rather than one summary flag.
 *
 * No private keys, no raw signature bytes, no filesystem paths, no
 * Ratchet secrets ever appear here.
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosIdentityTransitionAcceptanceState } from "./fedos_identity_transition_acceptance_state.js";
import type { FedosIdentityTransitionEvidenceOutcome } from "./fedos_identity_transition_evidence_evaluation.js";

export interface FedosIdentityTransitionSafeStatusV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly revision: number;
  readonly previousTransitionId: string | null;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  readonly evidenceOutcome: FedosIdentityTransitionEvidenceOutcome;
  readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
  readonly superseded: boolean;
}
