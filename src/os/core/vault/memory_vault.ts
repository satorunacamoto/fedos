/**
 * Stage 33 — `InMemoryVaultBoundary`: a dev/test placeholder vault.
 *
 * It models the LOCKED ↔ (placeholder) UNLOCKED lifecycle WITHOUT any
 * cryptography. It holds ONLY a coarse `VaultStatus` (state + a non-sensitive
 * reason). It never:
 *   - generates or derives a key,
 *   - stores a seed, passphrase, token, or any secret bytes,
 *   - turns an Apple ID / Passkey / JWT / user id into key material.
 *
 * `unlock` recognizes an authentication `kind` and, if valid, flips to a
 * PLACEHOLDER `unlocked` state — that state exposes no key and grants no crypto.
 * `lock` returns to `locked`. Nothing throws: an unrecognized request resolves to
 * an `error` decision/state. Constructing the vault does nothing, and it is NOT
 * wired into the runtime or Worker. This is a boundary, not a security feature —
 * it makes no safety, privacy, or "hidden storage" claim.
 */

import {
  VAULT_UNLOCK_KINDS,
  type VaultBoundary,
  type VaultCapability,
  type VaultDecision,
  type VaultState,
  type VaultStatus,
  type VaultUnlockRequest,
} from "./types.js";

/** The PLACEHOLDER capabilities this vault advertises. All are inert labels. */
const PLACEHOLDER_CAPABILITIES: readonly VaultCapability[] = [
  "identity_unlock_placeholder",
  "external_signer_placeholder",
];

export class InMemoryVaultBoundary implements VaultBoundary {
  // The ONLY state held: a coarse status. No secret/key/seed field exists.
  #status: VaultStatus = { state: "locked", reason: "vault locked" };

  constructor() {
    // Does nothing: no key/seed created, no store opened, no factor contacted.
  }

  getState(): VaultState {
    return this.#status.state;
  }

  getCapabilities(): readonly VaultCapability[] {
    return PLACEHOLDER_CAPABILITIES;
  }

  async unlock(request: VaultUnlockRequest): Promise<VaultDecision> {
    // Defensive: a malformed/unknown request becomes an error decision, not a
    // throw. We read only the `kind` (a fixed enum) — never the reference, and we
    // derive/store nothing from either.
    const kind = request?.kind;
    if (!kind || !VAULT_UNLOCK_KINDS.has(kind)) {
      this.#status = { state: "error", reason: "unrecognized unlock request" };
      return { allowed: false, state: "error", reason: "unrecognized unlock request" };
    }

    // PLACEHOLDER unlock: flip state only. No KDF, no seed, no key — the auth
    // factor (incl. Apple ID / Passkey) authorizes the transition and nothing more.
    this.#status = {
      state: "unlocked",
      reason: `placeholder unlocked via ${kind} (no key derived)`,
    };
    return { allowed: true, state: "unlocked", reason: this.#status.reason };
  }

  async lock(): Promise<VaultDecision> {
    this.#status = { state: "locked", reason: "vault locked" };
    return { allowed: true, state: "locked", reason: this.#status.reason };
  }

  isUnlocked(): boolean {
    return this.#status.state === "unlocked";
  }
}
