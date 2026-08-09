/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the derived Device Lifecycle view. NOT a new persisted
 * field on `FedosDeviceBindingV1` — a PURE, read-only projection over the
 * EXISTING, unchanged `FedosDeviceTrustState` (`./fedos_device_binding.ts`,
 * Alpha 2921–3000) plus this Arc's own additive Device Replacement link
 * (`./fedos_device_replacement_record.ts`), so a caller can distinguish
 * "revoked because replaced by a named successor Device" from "revoked
 * with no successor" without either state colliding with the other or
 * requiring a new Registry event type.
 */
import { type FedosDeviceBindingV1 } from "../../../device/fedos_device_binding.js";

export type FedosDeviceLifecycleState = "pending" | "active" | "replaced" | "revoked" | "unavailable";

/**
 * `replacedByDeviceId` — the result of
 * `FedosDeviceReplacementPersistence.getReplacementForOldDevice(binding.deviceId)?.newDeviceId`,
 * or `null` if no replacement record names this Device as the superseded
 * one. Only distinguishes `"replaced"` from `"revoked"` when
 * `binding.trustState === "revoked"` — a `"pending"`/`"trusted"`/
 * `"unavailable"` binding is never reported as `"replaced"`, even if a
 * (structurally impossible, since replacement always revokes the old
 * binding) replacement record somehow named it.
 */
export function deriveFedosDeviceLifecycleState(
  binding: FedosDeviceBindingV1,
  replacedByDeviceId: string | null,
): FedosDeviceLifecycleState {
  switch (binding.trustState) {
    case "pending":
      return "pending";
    case "trusted":
      return "active";
    case "unavailable":
      return "unavailable";
    case "revoked":
      return replacedByDeviceId !== null ? "replaced" : "revoked";
  }
}
