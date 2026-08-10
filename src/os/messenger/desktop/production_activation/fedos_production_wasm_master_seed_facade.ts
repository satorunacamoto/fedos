/**
 * Secure Runtime Alpha 4741-4820 — Phase F: Capability-Limited WASM Facade.
 *
 * The production Desktop path exposes ONLY the exports needed for the
 * Master Seed capability profile: constructing an opaque
 * `FedosMasterSeedAuthority` WASM handle (whose own methods cover seed
 * generation, sealing, restoration, identity derivation, and the
 * already-approved Conversation-key resolution the Runtime needs). It
 * never returns the raw WASM module / namespace to application code, and
 * never widens access to any other export. The initialized glue module
 * is held PRIVATELY inside this facade instance and reached through this
 * one narrow method only.
 *
 * The opaque handle this facade returns is the SAME shape the existing
 * `FedosWasmMasterSeedAuthority` adapter already consumes
 * (`FedosMasterSeedAuthorityHandle`) — this file adds an adapter, it does
 * not widen every caller.
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle, FedosMasterSeedAuthorityHandle } from "../../../core/vault/wasm/fedos_wasm_loader.js";

/**
 * Secure Runtime Alpha 7161-7240 — deliberately duplicated (not
 * imported) from `fedos_wasm_loader.ts`'s own PRIVATE
 * `AEAD_ALGORITHM_DISCRIMINANTS`/`AEAD_AAD_DOMAIN_DISCRIMINANTS` —
 * mirrors `fedos_production_nostr_signing_authority.ts`'s own
 * "intentionally independent" JSON-parser duplication discipline
 * exactly, rather than widening that file's own deliberate
 * encapsulation boundary. Values are `lib.rs`'s own numeric
 * discriminants (stable Rust enum ordering), identical to the
 * dev-only loader's own table.
 */
const AEAD_ALGORITHM_DISCRIMINANTS: Readonly<Record<AeadAlgorithm, number>> = {
  ChaCha20Poly1305: 0,
  Aes256Gcm: 1,
};
const AEAD_AAD_DOMAIN_DISCRIMINANTS: Readonly<Record<AeadAadDomain, number>> = {
  RootKey: 0,
  Identity: 1,
  Storage: 2,
  Conversation: 3,
  TestOnly: 4,
};

function isAeadCiphertextHandleShape(value: unknown): value is AeadCiphertextHandle {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "AeadCiphertextHandle";
}

function isAeadKeyHandleShape(value: unknown): value is AeadKeyHandle {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "AeadKeyHandle";
}

/**
 * Secure Runtime Alpha 6921-7000 — the narrow, closed slice of the real
 * Rust/WASM `FedosDirectRatchetSession` class's own STATIC factory
 * surface (a SIBLING export on the SAME generated glue module
 * `FedosMasterSeedAuthority` is exported from — confirmed by direct
 * source inspection of `fedos_wasm_loader.ts`'s own
 * `#directRatchetSessionModule()`/`attemptDevOnlyDirectRatchetInitializeAs*Call()`).
 * Every instance method (`encrypt`/`decrypt`/counters/seal*) lives on the
 * VALUE these three factories return, never on this interface itself —
 * this facade only ever hands back the three closed constructors, never
 * the module, never a generic invoke.
 */
export interface FedosProductionDirectRatchetSessionModule {
  readonly initialize_as_receiver: (
    masterSeedAuthority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
  ) => unknown;
  readonly initialize_as_sender: (
    masterSeedAuthority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
    remoteRatchetPublicKeyHex: string,
  ) => unknown;
  readonly restore: (...args: readonly unknown[]) => unknown;
}

/** The single reviewed capability the production Desktop path is granted. */
export interface FedosProductionMasterSeedFacade {
  /**
   * Construct ONE fresh, empty opaque WASM Master Seed authority handle.
   * Returns `null` (never throws) if the constructor is unavailable or
   * the produced value is not structurally a genuine authority handle.
   * Each call yields an INDEPENDENT authority (matching Rust's own
   * per-instance lifecycle) — the caller retains and drives exactly one.
   */
  constructMasterSeedAuthority(): FedosMasterSeedAuthorityHandle | null;

  /**
   * Secure Runtime Alpha 6921-7000 — the SAME already-initialized,
   * manifest-verified glue module this facade already holds privately,
   * narrowed to `FedosDirectRatchetSession`'s own three static
   * constructors only. Returns `null` (never throws) if the export is
   * absent or not structurally the reviewed shape. Never a second
   * `import()`, never a second `initSync`/`WebAssembly.instantiate` —
   * this is a read of an export already present on the module this
   * facade's own closure captured at construction.
   */
  constructDirectRatchetSessionModule(): FedosProductionDirectRatchetSessionModule | null;

  /**
   * Secure Runtime Alpha 7161-7240 — the SAME already-initialized,
   * manifest-verified glue module this facade already holds privately,
   * narrowed to the ONE free `build_and_sign_nip17_gift_wrap` export
   * (`lib.rs`, NOT a method on any handle — see that export's own doc
   * comment for why the ephemeral secret, the NIP-44 encrypt, and the
   * signature all happen inside this ONE call). Returns `null` (never
   * throws) if the export is absent, not a function, or the underlying
   * call itself fails/returns no signed event — fail closed, mirroring
   * every other method on this facade. Never a second `import()`, never
   * a second WASM initialization.
   */
  buildAndSignGiftWrap(
    recipientPublicKeyHex: string,
    createdAt: number,
    kind: number,
    contentPlaintext: Uint8Array,
  ): string | null;

  /**
   * Secure Runtime Alpha 7161-7240 — the SAME already-initialized glue
   * module's free `encrypt_aead` export (`lib.rs`) — the generic
   * Envelope-AEAD encrypt path `FedosWasmConversationEncryptionAuthority`
   * uses for message-content storage, distinct from the NIP-44 wire
   * bridge above. Operates on the SAME opaque `AeadKeyHandle`
   * `constructMasterSeedAuthority()`'s own handle's `resolve_conversation_key`
   * method already returns — never a second module instantiation, so
   * handles from one are always valid on the other. `null` on ANY
   * failure (malformed key/algorithm/domain shape, or the underlying
   * call itself failing) — fail closed.
   */
  encryptAead(
    key: AeadKeyHandle,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    plaintext: Uint8Array,
  ): AeadCiphertextHandle | null;

  /** The decrypt-direction sibling of [`encryptAead`] — reaches the SAME module's free `decrypt_aead` export. */
  decryptAead(
    key: AeadKeyHandle,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    ciphertext: AeadCiphertextHandle,
  ): Uint8Array | null;

  /** Reaches the SAME module's free `serialize_aead_ciphertext` export — the ONLY way `AeadCiphertextHandle` becomes a storable/transmittable wire string. */
  serializeAeadCiphertext(ciphertext: AeadCiphertextHandle): AeadCiphertextWire | null;

  /** The inverse of [`serializeAeadCiphertext`] — reaches the SAME module's free `deserialize_aead_ciphertext` export. */
  deserializeAeadCiphertext(wire: AeadCiphertextWire): AeadCiphertextHandle | null;
}

/**
 * Structural fail-closed validation of a value returned by
 * `new module.FedosMasterSeedAuthority()`. Never `instanceof` (this file
 * holds no reference to the glue's own class); only a shape check that
 * the reviewed methods are callable. A plain object, `null`, or any
 * other shape resolves `false`.
 */
function isMasterSeedAuthorityHandleShape(value: unknown): value is FedosMasterSeedAuthorityHandle {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.generate === "function" &&
    typeof v.seal === "function" &&
    typeof v.restore_sealed === "function" &&
    typeof v.clear === "function" &&
    typeof v.is_available === "function" &&
    typeof v.is_cleared === "function" &&
    typeof v.public_key_hex_for_account === "function"
  );
}

/**
 * Secure Runtime Alpha 6921-7000 — structural fail-closed validation of
 * `moduleRef.FedosDirectRatchetSession`. Never `instanceof`; only a shape
 * check that the three reviewed static constructors are callable
 * functions. Mirrors `isMasterSeedAuthorityHandleShape()`'s own exact
 * discipline immediately above.
 */
function isDirectRatchetSessionModuleShape(value: unknown): value is FedosProductionDirectRatchetSessionModule {
  if (typeof value !== "object" && typeof value !== "function") return false;
  if (value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.initialize_as_receiver === "function" &&
    typeof v.initialize_as_sender === "function" &&
    typeof v.restore === "function"
  );
}

/**
 * Build a capability-limited facade over an ALREADY-INITIALIZED glue
 * module. The module is captured in a closure and never exposed. Only
 * the `FedosMasterSeedAuthority` constructor and (as of Secure Runtime
 * Alpha 6921-7000) the `FedosDirectRatchetSession` static constructors
 * are ever read from it — both real exports on the SAME already-verified
 * module, never a second import or a second WASM initialization.
 */
export function createFedosProductionMasterSeedFacade(
  initializedGlueModule: object,
): FedosProductionMasterSeedFacade {
  const moduleRef = initializedGlueModule as {
    FedosMasterSeedAuthority?: unknown;
    FedosDirectRatchetSession?: unknown;
    build_and_sign_nip17_gift_wrap?: unknown;
    encrypt_aead?: unknown;
    decrypt_aead?: unknown;
    serialize_aead_ciphertext?: unknown;
    deserialize_aead_ciphertext?: unknown;
  };
  return Object.freeze({
    constructMasterSeedAuthority(): FedosMasterSeedAuthorityHandle | null {
      const Ctor = moduleRef.FedosMasterSeedAuthority;
      if (typeof Ctor !== "function") return null;
      try {
        const value: unknown = new (Ctor as new () => unknown)();
        return isMasterSeedAuthorityHandleShape(value) ? value : null;
      } catch {
        return null;
      }
    },
    constructDirectRatchetSessionModule(): FedosProductionDirectRatchetSessionModule | null {
      const Ctor = moduleRef.FedosDirectRatchetSession;
      return isDirectRatchetSessionModuleShape(Ctor) ? Ctor : null;
    },
    buildAndSignGiftWrap(
      recipientPublicKeyHex: string,
      createdAt: number,
      kind: number,
      contentPlaintext: Uint8Array,
    ): string | null {
      const fn = moduleRef.build_and_sign_nip17_gift_wrap;
      if (typeof fn !== "function") return null;
      try {
        const value: unknown = (fn as (...args: readonly unknown[]) => unknown)(
          recipientPublicKeyHex,
          createdAt,
          kind,
          contentPlaintext,
        );
        return typeof value === "string" ? value : null;
      } catch {
        return null;
      }
    },
    encryptAead(
      key: AeadKeyHandle,
      algorithm: AeadAlgorithm,
      aadDomain: AeadAadDomain,
      plaintext: Uint8Array,
    ): AeadCiphertextHandle | null {
      const fn = moduleRef.encrypt_aead;
      if (typeof fn !== "function" || !isAeadKeyHandleShape(key)) return null;
      try {
        const value: unknown = (fn as (...args: readonly unknown[]) => unknown)(
          key,
          AEAD_ALGORITHM_DISCRIMINANTS[algorithm],
          AEAD_AAD_DOMAIN_DISCRIMINANTS[aadDomain],
          plaintext,
        );
        return isAeadCiphertextHandleShape(value) ? value : null;
      } catch {
        return null;
      }
    },
    decryptAead(
      key: AeadKeyHandle,
      algorithm: AeadAlgorithm,
      aadDomain: AeadAadDomain,
      ciphertext: AeadCiphertextHandle,
    ): Uint8Array | null {
      const fn = moduleRef.decrypt_aead;
      if (typeof fn !== "function" || !isAeadKeyHandleShape(key) || !isAeadCiphertextHandleShape(ciphertext)) return null;
      try {
        const value: unknown = (fn as (...args: readonly unknown[]) => unknown)(
          key,
          AEAD_ALGORITHM_DISCRIMINANTS[algorithm],
          AEAD_AAD_DOMAIN_DISCRIMINANTS[aadDomain],
          ciphertext,
        );
        return value instanceof Uint8Array ? value : null;
      } catch {
        return null;
      }
    },
    serializeAeadCiphertext(ciphertext: AeadCiphertextHandle): AeadCiphertextWire | null {
      const fn = moduleRef.serialize_aead_ciphertext;
      if (typeof fn !== "function" || !isAeadCiphertextHandleShape(ciphertext)) return null;
      try {
        const value: unknown = (fn as (c: unknown) => unknown)(ciphertext);
        return typeof value === "string" && value.length > 0 ? (value as AeadCiphertextWire) : null;
      } catch {
        return null;
      }
    },
    deserializeAeadCiphertext(wire: AeadCiphertextWire): AeadCiphertextHandle | null {
      const fn = moduleRef.deserialize_aead_ciphertext;
      if (typeof fn !== "function") return null;
      try {
        const value: unknown = (fn as (w: unknown) => unknown)(wire);
        return isAeadCiphertextHandleShape(value) ? value : null;
      } catch {
        return null;
      }
    },
  });
}
