/**
 * Secure Runtime Alpha 4741-4820 — Phase G/H/J: the production
 * `FedosMasterSeedAuthority`, backed by REAL WASM through the
 * capability-limited facade (Phase F) — NOT the dev-only loader gate
 * and NOT the development seed double.
 *
 * Implements the SAME `FedosMasterSeedAuthority` interface the profile
 * coordinator already consumes, so it drops in with ZERO coordinator
 * change (adapter, not replacement). It owns a single opaque WASM
 * authority handle, constructed lazily at most once per instance and
 * retained so generate/seal/restore/clear observe each other's state
 * (each Rust authority owns its own lifecycle). It NEVER exposes the
 * handle or the module, NEVER logs the passphrase or the sealed
 * envelope, and NEVER auto-generates a seed on construction. Every
 * method fails closed (never throws upward).
 *
 * Phase J (lock/teardown): `clear()` zeroizes the WASM-held seed and,
 * additionally, drops this adapter's reference to the handle, so no
 * post-lock crypto command can reach a live authority through this
 * object — a subsequent method call fails closed (handle re-constructed
 * empty; a wrong-order caller can never resurrect the prior seed).
 */

import type { AeadKeyHandle, FedosMasterSeedAuthorityHandle } from "../../runtime/fedos_wasm_loader.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import {
  toSealedMasterSeedEnvelopeV1,
  type FedosSealedMasterSeedEnvelopeV1,
} from "../../runtime/master_seed/fedos_sealed_master_seed_envelope.js";
import type { FedosProductionMasterSeedFacade } from "./fedos_production_wasm_master_seed_facade.js";

export class FedosProductionMasterSeedAuthority implements FedosMasterSeedAuthority {
  readonly #facade: FedosProductionMasterSeedFacade;
  #handle: FedosMasterSeedAuthorityHandle | null = null;
  #cleared = false;

  constructor(facade: FedosProductionMasterSeedFacade) {
    this.#facade = facade;
  }

  #ensure(): FedosMasterSeedAuthorityHandle | null {
    if (this.#cleared) return null;
    if (this.#handle) return this.#handle;
    this.#handle = this.#facade.constructMasterSeedAuthority();
    return this.#handle;
  }

  async isAvailable(): Promise<boolean> {
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.is_available();
    } catch {
      return false;
    }
  }

  async isCleared(): Promise<boolean> {
    if (this.#cleared) return true;
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.is_cleared();
    } catch {
      return false;
    }
  }

  async generate(): Promise<boolean> {
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.generate();
    } catch {
      return false;
    }
  }

  async seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 | null> {
    const h = this.#ensure();
    if (!h) return null;
    try {
      const value = h.seal(passphrase);
      return typeof value === "string" ? toSealedMasterSeedEnvelopeV1(value) : null;
    } catch {
      return null;
    }
  }

  async restoreSealed(envelope: FedosSealedMasterSeedEnvelopeV1, passphrase: Uint8Array): Promise<boolean> {
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.restore_sealed(envelope.json, passphrase);
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    const h = this.#handle;
    this.#cleared = true;
    this.#handle = null;
    if (!h) return;
    try {
      h.clear();
    } catch {
      /* never throws to the caller */
    }
  }

  async resolveConversationKey(
    accountIndex: number,
    counterpartyPublicKeyHex: string,
  ): Promise<AeadKeyHandle | null> {
    const h = this.#ensure();
    if (!h) return null;
    try {
      const value = h.resolve_conversation_key(accountIndex, counterpartyPublicKeyHex);
      return (value ?? null) as AeadKeyHandle | null;
    } catch {
      return null;
    }
  }

  /**
   * INTERNAL — mirrors `FedosWasmMasterSeedAuthority`'s own reviewed
   * accessor for `FedosWasmNostrSigningAuthority`, which must sign
   * against the SAME underlying WASM authority instance this object
   * manages. Not part of the public interface; returns an opaque,
   * method-bearing handle carrying no secret byte.
   */
  async accessForNostrSigningAuthorityInternalUse(): Promise<FedosMasterSeedAuthorityHandle | null> {
    return this.#ensure();
  }
}
