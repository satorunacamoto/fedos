/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Device Binding.
 *
 * A DEVICE BINDING names which device (`deviceRef`, an opaque label —
 * mirrors `../identity/device_registration.ts`'s own `deviceRef`
 * convention, reused as the same SHAPE of label, not the same type)
 * is currently allowed to participate in an account's (`accountRef`)
 * sync fabric. Every earlier device-shaped boundary
 * (`../identity/device_registration.ts`, `../identity/device_trust.ts`)
 * explicitly deferred "sync" out of scope; this Arc is that deferred
 * work, and this file is deliberately kept just as narrow as those
 * were: a pure three-state state machine and nothing else — no key
 * exchange, no pairing handshake, no transport, no Sender-Key
 * material.
 *
 * HARD GUARDRAILS:
 *   - No key material, no password/recovery-phrase/mnemonic/seed field
 *     of any kind — `deviceRef`/`accountRef` are OPAQUE labels only.
 *   - Every function here is a pure, synchronous state transition — no
 *     I/O, no network, no storage.
 *   - A binding never implies real device attestation — mirrors
 *     `DeviceTrustDescriptor`'s own "no security guarantee" discipline.
 */

export type FedosSyncDeviceBindingState = "bound" | "unbound" | "revoked";

export interface FedosSyncDeviceBinding {
  readonly deviceRef: string;
  readonly accountRef: string;
  readonly state: FedosSyncDeviceBindingState;
  readonly boundAt: number;
  readonly updatedAt: number;
}

export function bindFedosSyncDevice(deviceRef: string, accountRef: string, at: number): FedosSyncDeviceBinding {
  return { deviceRef, accountRef, state: "bound", boundAt: at, updatedAt: at };
}

export function unbindFedosSyncDevice(binding: FedosSyncDeviceBinding, at: number): FedosSyncDeviceBinding {
  return { ...binding, state: "unbound", updatedAt: at };
}

export function revokeFedosSyncDeviceBinding(binding: FedosSyncDeviceBinding, at: number): FedosSyncDeviceBinding {
  return { ...binding, state: "revoked", updatedAt: at };
}

/** `true` iff `binding` is currently allowed to participate in sync fan-out/delivery. */
export function isFedosSyncDeviceBindingActive(binding: FedosSyncDeviceBinding): boolean {
  return binding.state === "bound";
}
