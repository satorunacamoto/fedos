/**
 * Stage 33 — `NoopVaultBoundary`: a vault that does nothing.
 *
 * The safe default when no vault backend is present. It is permanently
 * `unavailable`: it never unlocks, advertises no capabilities, derives no key,
 * and stores no secret. Every method is total and never throws.
 *
 * This exists so callers can depend on the `VaultBoundary` seam without a real
 * vault, exactly as the app depends on mock/no-op defaults elsewhere. It is NOT
 * wired into the runtime or Worker.
 */

import type {
  VaultBoundary,
  VaultCapability,
  VaultDecision,
  VaultState,
  VaultUnlockRequest,
} from "./types.js";

export class NoopVaultBoundary implements VaultBoundary {
  constructor() {
    // Does nothing: no store opened, no key/seed created, no factor contacted.
  }

  getState(): VaultState {
    return "unavailable";
  }

  getCapabilities(): readonly VaultCapability[] {
    // No vault present -> advertises nothing.
    return [];
  }

  async unlock(_request: VaultUnlockRequest): Promise<VaultDecision> {
    // Reads nothing from the request; derives no key; stores no secret.
    return {
      allowed: false,
      state: "unavailable",
      reason: "no vault backend is configured",
    };
  }

  async lock(): Promise<VaultDecision> {
    return {
      allowed: true,
      state: "unavailable",
      reason: "no vault backend is configured",
    };
  }

  isUnlocked(): boolean {
    return false;
  }
}
