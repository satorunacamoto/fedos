/**
 * Secure Runtime Alpha 438 — the ONE real implementation of
 * `FedosMasterSeedAuthority`. Owns a private, lazily-constructed WASM
 * authority handle; never exposes it. Every method routes through the
 * matching gated `attemptDevOnlyMasterSeed*Call()` Rust Boundary reach
 * (`fedos_wasm_loader.ts`, Secure Runtime Alpha 436/437) — this file
 * never implements cryptography itself, never logs `passphrase` or
 * envelope contents, and never automatically generates or restores a
 * seed on construction (no hidden generation of any kind).
 *
 * `#loaderBoundary`'s type is a narrow structural slice of
 * `FedosWasmLoaderSkeleton` — only the six methods this file actually
 * calls — so a test can supply a lightweight mock without depending on
 * the full loader class, matching this codebase's own "export for
 * testability" discipline.
 *
 * Architecture Dependency Closure Arc — moved here from
 * `src/runtime/master_seed/fedos_wasm_master_seed_authority.ts` (a shim
 * remains at that old path). The ONE substantive change: this class now
 * implements `SealingAuthorityPort` (`../../ports/sealing_authority_port.ts`)
 * instead of the concrete Messenger type `FedosDirectRatchetSealingAuthority`
 * (`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.ts`)
 * — the two are the SAME structural shape (that file now re-exports
 * `SealingAuthorityPort` under its original name), so this is a pure
 * dependency-DIRECTION fix: this file no longer imports anything from
 * `src/os/messenger/**`, closing one of the three cross-capability SCC
 * edges `CIRCULAR-DEPENDENCY-BREAK-PLAN.md` flagged. No method, no
 * behavior, no call surface changed. See
 * `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`.
 */
import {
  FedosWasmLoaderSkeleton,
  type FedosWasmLoaderMasterSeedAuthorityConstructExecution,
  type FedosWasmLoaderMasterSeedClearExecution,
  type FedosWasmLoaderMasterSeedGenerateExecution,
  type FedosWasmLoaderMasterSeedRestoreSealedExecution,
  type FedosWasmLoaderMasterSeedSealExecution,
  type FedosWasmLoaderConversationKeyResolutionExecution,
  type FedosWasmLoaderCommerceMediaKeyResolutionExecution,
  type FedosWasmLoaderDirectRatchetSecretSealExecution,
  type FedosWasmLoaderDirectRatchetSecretRestoreExecution,
  type FedosWasmLoaderNip44WireEncryptExecution,
  type FedosWasmLoaderNip44WireDecryptExecution,
  type FedosMasterSeedAuthorityHandle,
  type AeadKeyHandle,
} from "./fedos_wasm_loader.js";
import type { FedosMasterSeedAuthority } from "./fedos_master_seed_authority.js";
import type { SealingAuthorityPort } from "../../ports/sealing_authority_port.js";
import {
  toSealedMasterSeedEnvelopeV1,
  type FedosSealedMasterSeedEnvelopeV1,
} from "./fedos_sealed_master_seed_envelope.js";

/** PRIVATE — the narrow slice of `FedosWasmLoaderSkeleton` this adapter depends on. */
export interface FedosMasterSeedWasmLoaderBoundary {
  attemptDevOnlyMasterSeedAuthorityConstructCall(): Promise<FedosWasmLoaderMasterSeedAuthorityConstructExecution>;
  attemptDevOnlyMasterSeedGenerateCall(authority: unknown): Promise<FedosWasmLoaderMasterSeedGenerateExecution>;
  attemptDevOnlyMasterSeedSealCall(
    authority: unknown,
    passphrase: Uint8Array,
  ): Promise<FedosWasmLoaderMasterSeedSealExecution>;
  attemptDevOnlyMasterSeedRestoreSealedCall(
    authority: unknown,
    envelopeJson: string,
    passphrase: Uint8Array,
  ): Promise<FedosWasmLoaderMasterSeedRestoreSealedExecution>;
  attemptDevOnlyMasterSeedClearCall(authority: unknown): Promise<FedosWasmLoaderMasterSeedClearExecution>;
  attemptDevOnlyMasterSeedResolveConversationKeyCall(
    authority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
  ): Promise<FedosWasmLoaderConversationKeyResolutionExecution>;
  /** OPTIONAL — same reasoning as `attemptDevOnlyEncryptNip44WireCall`'s own optionality below: several pre-existing hand-written mock boundary objects in already-passing tests implement only the original method set; requiring this one there would break those tests for no reason. */
  attemptDevOnlyMasterSeedResolveCommerceMediaKeyCall?(
    authority: unknown,
  ): Promise<FedosWasmLoaderCommerceMediaKeyResolutionExecution>;
  attemptDevOnlyMasterSeedSealDirectRatchetSecretCall(
    authority: unknown,
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<FedosWasmLoaderDirectRatchetSecretSealExecution>;
  attemptDevOnlyMasterSeedRestoreDirectRatchetSecretCall(
    authority: unknown,
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<FedosWasmLoaderDirectRatchetSecretRestoreExecution>;
  /**
   * OPTIONAL — mirrors this same pair's own optionality on
   * `FedosMasterSeedAuthority` (`./fedos_master_seed_authority.ts`) and on
   * the raw Rust Boundary reach interface (`../fedos_wasm_loader.ts`,
   * Secure Runtime Alpha 1761–1840 Phase B's own doc comment): several
   * pre-existing hand-written test mocks of this exact boundary implement
   * only the ORIGINAL nine methods, and requiring these two here would
   * break those pre-existing, unrelated tests for no reason.
   */
  attemptDevOnlyEncryptNip44WireCall?(
    authority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    plaintext: Uint8Array,
  ): Promise<FedosWasmLoaderNip44WireEncryptExecution>;
  attemptDevOnlyDecryptNip44WireCall?(
    authority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    payload: string,
  ): Promise<FedosWasmLoaderNip44WireDecryptExecution>;
}

export class FedosWasmMasterSeedAuthority implements FedosMasterSeedAuthority, SealingAuthorityPort {
  readonly #loaderBoundary: FedosMasterSeedWasmLoaderBoundary;
  #authority: FedosMasterSeedAuthorityHandle | null = null;

  constructor(loaderBoundary?: FedosMasterSeedWasmLoaderBoundary) {
    this.#loaderBoundary = loaderBoundary ?? new FedosWasmLoaderSkeleton();
  }

  /**
   * PRIVATE — lazily constructs the WASM authority handle at most once
   * per instance and retains it. Returns `null` (never throws) if
   * construction fails or the dev-only gate is closed. Retaining the
   * SAME handle across calls (rather than re-constructing on every
   * method) is required for `generate()`/`seal()`/`restoreSealed()`/
   * `clear()` to observe each other's state, since each real
   * `FedosMasterSeedAuthority` WASM instance owns its OWN lifecycle.
   */
  async #ensureConstructed(): Promise<FedosMasterSeedAuthorityHandle | null> {
    if (this.#authority) return this.#authority;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedAuthorityConstructCall();
    this.#authority = result.authority;
    return this.#authority;
  }

  async isAvailable(): Promise<boolean> {
    const authority = await this.#ensureConstructed();
    if (!authority) return false;
    try {
      return authority.is_available();
    } catch {
      return false;
    }
  }

  async isCleared(): Promise<boolean> {
    const authority = await this.#ensureConstructed();
    if (!authority) return false;
    try {
      return authority.is_cleared();
    } catch {
      return false;
    }
  }

  async generate(): Promise<boolean> {
    const authority = await this.#ensureConstructed();
    if (!authority) return false;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedGenerateCall(authority);
    return result.succeeded;
  }

  async seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 | null> {
    const authority = await this.#ensureConstructed();
    if (!authority) return null;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedSealCall(authority, passphrase);
    if (!result.succeeded || result.envelope === null) return null;
    return toSealedMasterSeedEnvelopeV1(result.envelope);
  }

  async restoreSealed(envelope: FedosSealedMasterSeedEnvelopeV1, passphrase: Uint8Array): Promise<boolean> {
    const authority = await this.#ensureConstructed();
    if (!authority) return false;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedRestoreSealedCall(
      authority,
      envelope.json,
      passphrase,
    );
    return result.succeeded;
  }

  async clear(): Promise<void> {
    const authority = await this.#ensureConstructed();
    if (!authority) return;
    await this.#loaderBoundary.attemptDevOnlyMasterSeedClearCall(authority);
  }

  async resolveConversationKey(accountIndex: number, counterpartyPublicKeyHex: string): Promise<AeadKeyHandle | null> {
    const authority = await this.#ensureConstructed();
    if (!authority) return null;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedResolveConversationKeyCall(
      authority,
      accountIndex,
      counterpartyPublicKeyHex,
    );
    return result.succeeded ? result.keyHandle : null;
  }

  async resolveCommerceMediaKey(): Promise<AeadKeyHandle | null> {
    if (!this.#loaderBoundary.attemptDevOnlyMasterSeedResolveCommerceMediaKeyCall) return null;
    const authority = await this.#ensureConstructed();
    if (!authority) return null;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedResolveCommerceMediaKeyCall(authority);
    return result.succeeded ? result.keyHandle : null;
  }

  async sealDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<string | null> {
    const authority = await this.#ensureConstructed();
    if (!authority) return null;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedSealDirectRatchetSecretCall(
      authority,
      localDeviceRef,
      remoteDeviceRef,
      conversationId,
      generation,
      secretBytes,
    );
    return result.succeeded ? result.sealedBlob : null;
  }

  async restoreDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null> {
    const authority = await this.#ensureConstructed();
    if (!authority) return null;
    const result = await this.#loaderBoundary.attemptDevOnlyMasterSeedRestoreDirectRatchetSecretCall(
      authority,
      localDeviceRef,
      remoteDeviceRef,
      conversationId,
      generation,
      sealedBlob,
    );
    return result.succeeded ? result.secretBytes : null;
  }

  async encryptNip44Wire(
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    plaintext: Uint8Array,
  ): Promise<string | null> {
    const authority = await this.#ensureConstructed();
    if (!authority) return null;
    if (!this.#loaderBoundary.attemptDevOnlyEncryptNip44WireCall) return null;
    const result = await this.#loaderBoundary.attemptDevOnlyEncryptNip44WireCall(
      authority,
      accountIndex,
      counterpartyPublicKeyHex,
      plaintext,
    );
    return result.succeeded ? result.payload : null;
  }

  async decryptNip44Wire(
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    payload: string,
  ): Promise<Uint8Array | null> {
    const authority = await this.#ensureConstructed();
    if (!authority) return null;
    if (!this.#loaderBoundary.attemptDevOnlyDecryptNip44WireCall) return null;
    const result = await this.#loaderBoundary.attemptDevOnlyDecryptNip44WireCall(
      authority,
      accountIndex,
      counterpartyPublicKeyHex,
      payload,
    );
    return result.succeeded ? result.plaintext : null;
  }

  /**
   * INTERNAL — for the sole reviewed use of `FedosWasmNostrSigningAuthority`
   * (`src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`), which must
   * sign against the SAME underlying WASM authority instance this object's
   * own `generate()`/`seal()`/`restoreSealed()`/`clear()` already manage —
   * Rust's `sign_nostr_event` is a method ON `FedosMasterSeedAuthority`
   * itself (Secure Runtime Alpha 444), not a separate struct. Deliberately
   * NOT part of the public `FedosMasterSeedAuthority` interface — the
   * returned value is an opaque, method-bearing handle carrying NO byte of
   * secret material (matching every other value this file ever returns).
   */
  async accessForNostrSigningAuthorityInternalUse(): Promise<FedosMasterSeedAuthorityHandle | null> {
    return this.#ensureConstructed();
  }
}

/** Builds a `FedosMasterSeedAuthority` backed by the real WASM loader. Pure; never throws. */
export function createFedosWasmMasterSeedAuthority(): FedosMasterSeedAuthority {
  return new FedosWasmMasterSeedAuthority();
}
