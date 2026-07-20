/**
 * Secure Runtime Alpha 3941–4020 — Phase J/K: closed action descriptors.
 *
 * A `FedosDeviceManagementActionDescriptor` names ONE action a screen's
 * render output offers — an id (a closed, renderer-defined string, never
 * an arbitrary route), a human-readable label, whether it is currently
 * enabled, and a safe disabled reason. It carries NO function/callback
 * value of any kind (Phase J's own "no arbitrary callback/function values
 * in render output" requirement) — a future UI maps `id` back to the
 * matching `FedosDeviceManagementController` method itself, one layer
 * further out than this file.
 */

export interface FedosDeviceManagementActionDescriptor {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
}

export function fedosDeviceManagementAction(id: string, label: string, enabled = true, disabledReason: string | null = null): FedosDeviceManagementActionDescriptor {
  return Object.freeze({ id, label, enabled, disabledReason });
}
