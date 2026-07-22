/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the Session Reset Authority: the ONE pure decision
 * function for "is this claimed session reset/establishment legitimate."
 * Mirrors this codebase's own established Authority pattern
 * (`../../device/binding_challenge/fedos_device_binding_registration_authority.ts`,
 * `./fedos_direct_ratchet_device_pair_resolver.ts`) — a pure function/
 * class with no I/O of its own beyond the injected replay-record lookup,
 * never mutates the Device Registry or session persistence.
 *
 * THREE checks, unconditionally, every call — never short-circuited by
 * caller-supplied trust:
 *   1. Device Trust integration — the claimed sender's Device MUST be
 *      `"trusted"`, never `"revoked"`/`"unknown"`/`"pending"`/`"unavailable"`.
 *      Reused, direct import of `../../device/fedos_device_binding.ts`'s
 *      own predicates — never a re-implementation.
 *   2. Generation integrity — a reset (`previousGeneration !== null`) must
 *      name EXACTLY `generation - 1`, AND must match what the local side
 *      already knows as the current generation for this tuple (protects
 *      against a stale or reordered claim superseding the WRONG
 *      generation). A fresh establishment (`previousGeneration === null`)
 *      must be `generation === 0` with no local record yet.
 *   3. Device-signature verification — BEST-EFFORT (see
 *      `./fedos_direct_ratchet_session_reset_authentication.ts`'s own
 *      header for why this can never be a hard requirement in this
 *      codebase today): checked ONLY when the sending Device's
 *      `devicePublicKeyRef` is on file; a mismatch against a KNOWN key is
 *      always `"rejected-signature"`, never silently ignored.
 *
 * Replay handling (nonce lookup) is a SEPARATE, final step — an identical
 * repeat of an already-recorded nonce/content pair is reported as
 * idempotent (never re-derives a different outcome for the same fact); a
 * DIFFERENT content reusing an already-consumed nonce is always
 * `"rejected-replayed"`, never silently overwritten.
 */
import {
  isFedosDeviceBindingRevoked,
  isFedosDeviceBindingTrusted,
  type FedosDeviceBindingV1,
} from "../../device/fedos_device_binding.js";
import {
  verifyFedosDirectRatchetSessionResetDeviceSignature,
  type FedosDirectRatchetSessionResetSignableContent,
} from "./fedos_direct_ratchet_session_reset_authentication.js";
import type { FedosDirectRatchetSessionResetOutcome } from "./fedos_direct_ratchet_session_reset_record.js";
import type { FedosDirectRatchetSessionResetRecordPersistence } from "./persistence/fedos_direct_ratchet_session_reset_record_persistence.js";

export type FedosDirectRatchetSessionResetEvaluation =
  | { readonly outcome: FedosDirectRatchetSessionResetOutcome }
  | { readonly outcome: "accepted-idempotent-repeat"; readonly recordedOutcome: FedosDirectRatchetSessionResetOutcome }
  | { readonly outcome: "rejected-replayed" };

export interface FedosDirectRatchetSessionResetEvaluationRequest {
  readonly content: FedosDirectRatchetSessionResetSignableContent;
  readonly deviceSignatureHex: string | null;
  /** The sending Device's ALREADY-resolved binding (`FedosDeviceRegistryPersistence.getBinding()`), or `null` if unknown to this local Registry. */
  readonly senderDeviceBinding: FedosDeviceBindingV1 | null;
  /** The HIGHEST generation this local side already has on file for this exact tuple, BEFORE this attempt — `null` if none. Ground truth for the generation-integrity check; never re-derived by this Authority itself (that is `findCurrentFedosDirectRatchetSession()`'s own job, called by the Coordinator). */
  readonly locallyKnownPreviousGeneration: number | null;
}

export class FedosDirectRatchetSessionResetAuthority {
  readonly #resetRecordPersistence: FedosDirectRatchetSessionResetRecordPersistence;

  constructor(resetRecordPersistence: FedosDirectRatchetSessionResetRecordPersistence) {
    this.#resetRecordPersistence = resetRecordPersistence;
  }

  evaluate(request: FedosDirectRatchetSessionResetEvaluationRequest): FedosDirectRatchetSessionResetEvaluation {
    const { content } = request;

    if (
      request.senderDeviceBinding === null ||
      isFedosDeviceBindingRevoked(request.senderDeviceBinding) ||
      !isFedosDeviceBindingTrusted(request.senderDeviceBinding)
    ) {
      return { outcome: "rejected-device-untrusted" };
    }

    if (content.previousGeneration === null) {
      if (content.generation !== 0 || request.locallyKnownPreviousGeneration !== null) {
        return { outcome: "rejected-generation-mismatch" };
      }
    } else {
      if (
        content.generation !== content.previousGeneration + 1 ||
        request.locallyKnownPreviousGeneration !== content.previousGeneration
      ) {
        return { outcome: "rejected-generation-mismatch" };
      }
    }

    if (request.deviceSignatureHex !== null && request.senderDeviceBinding.devicePublicKeyRef !== null) {
      const valid = verifyFedosDirectRatchetSessionResetDeviceSignature(
        request.senderDeviceBinding.devicePublicKeyRef,
        content,
        request.deviceSignatureHex,
      );
      if (!valid) return { outcome: "rejected-signature" };
    }

    const freshOutcome: FedosDirectRatchetSessionResetOutcome =
      content.previousGeneration === null ? "accepted-initial" : "accepted-reset";

    const existing = this.#resetRecordPersistence.getResetRecord(content.resetNonce);
    if (existing !== null) {
      const matches =
        existing.previousGeneration === content.previousGeneration &&
        existing.newGeneration === content.generation &&
        existing.reason === content.resetReason &&
        existing.remoteDeviceRef === content.senderDeviceRef &&
        existing.conversationId === content.conversationId;
      if (!matches) return { outcome: "rejected-replayed" };
      return { outcome: "accepted-idempotent-repeat", recordedOutcome: existing.outcome };
    }

    return { outcome: freshOutcome };
  }
}
