/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Device Registry.
 *
 * The durable, per-account set of `FedosSyncDeviceBinding` records
 * (`./fedos_sync_device_binding.ts`). Mirrors
 * `InMemoryFedosConversationPersistence`'s own private-`Map`-backed,
 * no-delete-method convention (`../conversation/persistence/in_memory_fedos_conversation_persistence.ts`,
 * Alpha 751) — a binding is never deleted, only transitioned to
 * `"revoked"`.
 *
 * A SECOND index (`#deviceOwner`) enforces the one real invariant this
 * registry owns: a given `deviceRef` belongs to at most one
 * `accountRef` at a time — registering the SAME device under a
 * DIFFERENT account is reported `"conflict"`, never silently
 * re-parented.
 *
 * HARD GUARDRAILS:
 *   - No `delete` method.
 *   - Never throws.
 *   - Independent instances never share state — no module-level
 *     mutable state exists in this file.
 */

import {
  bindFedosSyncDevice,
  isFedosSyncDeviceBindingActive,
  revokeFedosSyncDeviceBinding,
  type FedosSyncDeviceBinding,
} from "./fedos_sync_device_binding.js";

export type FedosSyncDeviceRegistryOutcome = "registered" | "already-registered" | "conflict";

export class FedosSyncDeviceRegistry {
  readonly #byAccount = new Map<string, Map<string, FedosSyncDeviceBinding>>();
  readonly #deviceOwner = new Map<string, string>();

  /**
   * Registers `deviceRef` under `accountRef`. Re-registering an
   * already-`"bound"` device is idempotent (`"already-registered"`);
   * re-registering a `"revoked"`/`"unbound"` device rebinds it
   * (`"registered"`); registering a device already owned by a
   * DIFFERENT account is rejected (`"conflict"`) without mutating
   * anything.
   */
  registerDevice(deviceRef: string, accountRef: string, at: number): FedosSyncDeviceRegistryOutcome {
    const owner = this.#deviceOwner.get(deviceRef);
    if (owner !== undefined && owner !== accountRef) return "conflict";

    let devices = this.#byAccount.get(accountRef);
    if (devices === undefined) {
      devices = new Map();
      this.#byAccount.set(accountRef, devices);
    }
    const existing = devices.get(deviceRef);
    if (existing !== undefined && existing.state === "bound") return "already-registered";

    devices.set(deviceRef, bindFedosSyncDevice(deviceRef, accountRef, at));
    this.#deviceOwner.set(deviceRef, accountRef);
    return "registered";
  }

  /** `true` iff a currently-`"bound"` device was found and revoked. `false` (never throws) otherwise. */
  revokeDevice(deviceRef: string, accountRef: string, at: number): boolean {
    const devices = this.#byAccount.get(accountRef);
    if (devices === undefined) return false;
    const existing = devices.get(deviceRef);
    if (existing === undefined || existing.state !== "bound") return false;
    devices.set(deviceRef, revokeFedosSyncDeviceBinding(existing, at));
    return true;
  }

  getDevice(deviceRef: string, accountRef: string): FedosSyncDeviceBinding | null {
    return this.#byAccount.get(accountRef)?.get(deviceRef) ?? null;
  }

  listDevices(accountRef: string): readonly FedosSyncDeviceBinding[] {
    return [...(this.#byAccount.get(accountRef)?.values() ?? [])];
  }

  listActiveDevices(accountRef: string): readonly FedosSyncDeviceBinding[] {
    return this.listDevices(accountRef).filter(isFedosSyncDeviceBindingActive);
  }
}
