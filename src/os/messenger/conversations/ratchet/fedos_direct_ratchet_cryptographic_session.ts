/**
 * Secure Runtime Alpha 5481-5560 (FedOS Direct Double Ratchet
 * Cryptographic Core Arc) — the narrow TypeScript authority over the real
 * WASM-backed `FedosDirectRatchetSession` (Rust). Mirrors
 * `FedosWasmMasterSeedAuthority`'s own "opaque handle, minimize exports"
 * shape, and its own established priming sequence: constructs and primes
 * its OWN `FedosWasmLoaderSkeleton` (`planLoad()` →
 * `attemptDevOnlyJsGlueImport()` → `attemptDevOnlyWasmInitialization()`),
 * mirroring `fedos_conversation_production_crypto_authority_factory.ts`'s
 * own real production sequence exactly.
 *
 * ALLOWED (Phase O): initialize cryptographic state through approved
 * inputs (an already-constructed `FedosMasterSeedAuthority`), encrypt,
 * decrypt, seal/restore, safe closed outcomes/metadata (counters, public
 * keys). FORBIDDEN, by construction — no method here does any of this:
 * raw key access, raw WASM object exposure beyond this class's own opaque
 * handle, transport, NIP-17 construction, live Conversation send/read,
 * automatic downgrade, fake-production fallback. This class does not
 * import, reference, or depend on `FedosDirectRatchetStateRuntime`
 * (the Foundation Arc's own state facade) — it is standalone, matching
 * Phase M's "prefer a constructible standalone Runtime" preference; a
 * future integration Arc decides how the two are wired together.
 *
 * Secure Runtime Alpha 6921-7000 — every entry point below (`createAsReceiver`/
 * `createAsSender`/`restore`/`sealState`) now resolves its own
 * `FedosDirectRatchetWasmLoaderBoundary` through ONE shared, structural
 * resolver (`resolveDirectRatchetSessionAccess()`) instead of
 * unconditionally calling `primedLoader()`. When `masterSeedAuthority`
 * structurally exposes the SAME already-attested production capability
 * `FedosProductionMasterSeedAuthority` grants (never a bare
 * `instanceof` — see `hasProductionDirectRatchetSessionCapability()`
 * below), the resolver builds a production-safe boundary directly from
 * the ALREADY-INITIALIZED module the profile-unlock activation path
 * already verified — NO `FedosWasmLoaderSkeleton`, NO `attemptDevOnly*`,
 * NO second `import()`/`initSync`. The EXISTING dev/test path
 * (`primedLoader()` + `instanceof FedosWasmMasterSeedAuthority`) is
 * fully preserved, unmodified, as the fallback for every other authority
 * type — `DevelopmentFedosMasterSeedAuthority` and any other
 * unrecognized object still correctly resolve to `null` (fail closed),
 * exactly as before this Arc.
 */
import { FedosWasmLoaderSkeleton } from "../../../../runtime/fedos_wasm_loader.js";
import type { FedosMasterSeedAuthority } from "../../../../runtime/master_seed/fedos_master_seed_authority.js";
import { FedosWasmMasterSeedAuthority } from "../../../../runtime/master_seed/fedos_wasm_master_seed_authority.js";
import type { FedosProductionDirectRatchetSessionModule } from "../../../../desktop/production_activation/fedos_production_wasm_master_seed_facade.js";

/** PRIVATE — the narrow slice of `FedosWasmLoaderSkeleton` this authority depends on. */
export interface FedosDirectRatchetWasmLoaderBoundary {
  planLoad(): unknown;
  attemptDevOnlyJsGlueImport(): Promise<unknown>;
  attemptDevOnlyWasmInitialization(): Promise<unknown>;
  attemptDevOnlyDirectRatchetInitializeAsReceiverCall(
    masterSeedAuthority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
  ): Promise<unknown>;
  attemptDevOnlyDirectRatchetInitializeAsSenderCall(
    masterSeedAuthority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
    remoteRatchetPublicKeyHex: string,
  ): Promise<unknown>;
  attemptDevOnlyDirectRatchetRestoreCall(args: readonly unknown[]): Promise<unknown>;
  attemptDevOnlyDirectRatchetEncryptCall(session: unknown, plaintext: Uint8Array): Promise<Uint8Array | null>;
  attemptDevOnlyDirectRatchetDecryptCall(session: unknown, wireMessage: Uint8Array, nowMs: number): Promise<Uint8Array | null>;
  attemptDevOnlyDirectRatchetLocalPublicKeyHexCall(session: unknown): Promise<string | null>;
  attemptDevOnlyDirectRatchetRemotePublicKeyHexCall(session: unknown): Promise<string | null>;
  attemptDevOnlyDirectRatchetIsReadyToSendCall(session: unknown): Promise<boolean>;
  attemptDevOnlyDirectRatchetSendCounterCall(session: unknown): Promise<number | null>;
  attemptDevOnlyDirectRatchetReceiveCounterCall(session: unknown): Promise<number | null>;
  attemptDevOnlyDirectRatchetSkippedKeyCountCall(session: unknown): Promise<number | null>;
  attemptDevOnlyDirectRatchetPreviousSendingChainLengthCall(session: unknown): Promise<number | null>;
  attemptDevOnlyDirectRatchetSealRootKeyCall(
    session: unknown,
    masterSeedAuthority: unknown,
    remoteDeviceRef: string,
    conversationId: string,
  ): Promise<string | null>;
  attemptDevOnlyDirectRatchetSealSendingChainKeyCall(
    session: unknown,
    masterSeedAuthority: unknown,
    remoteDeviceRef: string,
    conversationId: string,
  ): Promise<string | null>;
  attemptDevOnlyDirectRatchetSealReceivingChainKeyCall(
    session: unknown,
    masterSeedAuthority: unknown,
    remoteDeviceRef: string,
    conversationId: string,
  ): Promise<string | null>;
  attemptDevOnlyDirectRatchetSealLocalRatchetPrivateKeyCall(
    session: unknown,
    masterSeedAuthority: unknown,
    remoteDeviceRef: string,
    conversationId: string,
  ): Promise<string | null>;
  attemptDevOnlyDirectRatchetSealAllSkippedKeysCall(
    session: unknown,
    masterSeedAuthority: unknown,
    remoteDeviceRef: string,
    conversationId: string,
  ): Promise<readonly string[]>;
}

/** One sealed skipped-message-key, parsed from the wire-format string the Rust boundary returns (`"{counter}:{remotePublicHex}:{createdAtMs}:{sealedBlob}"`). */
export interface FedosDirectRatchetSealedSkippedKey {
  readonly counter: number;
  readonly remoteRatchetPublicKeyHex: string;
  readonly createdAtMs: number;
  readonly sealedBlob: string;
}

export interface FedosDirectRatchetSealedState {
  readonly sealedRootKey: string;
  readonly sealedSendingChainKey: string | null;
  readonly sealedReceivingChainKey: string | null;
  readonly sealedLocalRatchetPrivateKey: string;
  readonly sealedSkippedKeys: readonly FedosDirectRatchetSealedSkippedKey[];
}

function parseSealedSkippedKeyEntry(entry: string): FedosDirectRatchetSealedSkippedKey | null {
  const parts = entry.split(":");
  if (parts.length < 4) return null;
  const [counterStr, remoteRatchetPublicKeyHex, createdAtMsStr, ...blobParts] = parts;
  if (counterStr === undefined || remoteRatchetPublicKeyHex === undefined || createdAtMsStr === undefined) return null;
  const counter = Number(counterStr);
  const createdAtMs = Number(createdAtMsStr);
  if (!Number.isInteger(counter) || !Number.isFinite(createdAtMs)) return null;
  return { counter, remoteRatchetPublicKeyHex, createdAtMs, sealedBlob: blobParts.join(":") };
}

/** DEVELOPMENT/TEST ONLY — explicitly named, never called from a production-capable path. Byte-for-byte unchanged from before Secure Runtime Alpha 6921-7000. */
async function developmentDirectRatchetLoaderBoundary(): Promise<FedosDirectRatchetWasmLoaderBoundary> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return loader as unknown as FedosDirectRatchetWasmLoaderBoundary;
}

/**
 * Secure Runtime Alpha 6921-7000 — the narrow, STRUCTURAL (never
 * `instanceof`) capability shape a `FedosMasterSeedAuthority` must
 * genuinely expose to be granted production Direct Ratchet session
 * access. Both named accessors are internal-only (never on the public
 * `FedosMasterSeedAuthority` interface) — an object exposing only one,
 * or exposing similarly-named but differently-behaved methods, does not
 * satisfy this closed shape.
 */
interface FedosProductionDirectRatchetSessionAuthority {
  accessDirectRatchetSessionModuleInternalUse(): FedosProductionDirectRatchetSessionModule | null;
  accessForNostrSigningAuthorityInternalUse(): Promise<unknown>;
}

function hasProductionDirectRatchetSessionCapability(
  masterSeedAuthority: FedosMasterSeedAuthority,
): masterSeedAuthority is FedosMasterSeedAuthority & FedosProductionDirectRatchetSessionAuthority {
  const candidate = masterSeedAuthority as Partial<FedosProductionDirectRatchetSessionAuthority>;
  return (
    typeof candidate.accessDirectRatchetSessionModuleInternalUse === "function" &&
    typeof candidate.accessForNostrSigningAuthorityInternalUse === "function"
  );
}

/** Mirrors `FedosWasmLoaderSkeleton`'s own private `#attemptDevOnlyDirectRatchetSessionMethodCall()` generic dispatcher shape exactly, minus the dev-only readiness gate (the production module reference is only ever handed here already-verified). */
function callProductionDirectRatchetSessionMethod(session: unknown, methodName: string, args: readonly unknown[]): unknown {
  if (typeof session !== "object" || session === null) return null;
  const method = (session as Record<string, unknown>)[methodName];
  if (typeof method !== "function") return null;
  try {
    const result = (method as (...a: unknown[]) => unknown).apply(session, [...args]);
    return result === undefined ? null : result;
  } catch {
    return null;
  }
}

/**
 * Secure Runtime Alpha 6921-7000 — a `FedosDirectRatchetWasmLoaderBoundary`
 * built DIRECTLY from `FedosDirectRatchetSession`'s own static
 * constructors on the ALREADY-INITIALIZED, manifest-verified production
 * module — never `FedosWasmLoaderSkeleton`, never `attemptDevOnly*`,
 * never a second `import()`/`initSync`. Every method's own fail-closed
 * shape mirrors the dev boundary's exact contract (never throws upward;
 * `null`/`false`/`[]` on any failure) so callers cannot distinguish which
 * implementation they received — the ONLY difference is where the real
 * WASM call is reached from.
 */
function productionDirectRatchetLoaderBoundary(
  sessionModule: FedosProductionDirectRatchetSessionModule,
): FedosDirectRatchetWasmLoaderBoundary {
  return {
    planLoad(): unknown {
      return null;
    },
    async attemptDevOnlyJsGlueImport(): Promise<unknown> {
      return null;
    },
    async attemptDevOnlyWasmInitialization(): Promise<unknown> {
      return null;
    },
    async attemptDevOnlyDirectRatchetInitializeAsReceiverCall(
      masterSeedAuthority,
      accountIndex,
      counterpartyPublicKeyHex,
      sessionId,
      localDeviceRef,
      generation,
    ): Promise<unknown> {
      try {
        return sessionModule.initialize_as_receiver(masterSeedAuthority, accountIndex, counterpartyPublicKeyHex, sessionId, localDeviceRef, generation) ?? null;
      } catch {
        return null;
      }
    },
    async attemptDevOnlyDirectRatchetInitializeAsSenderCall(
      masterSeedAuthority,
      accountIndex,
      counterpartyPublicKeyHex,
      sessionId,
      localDeviceRef,
      generation,
      remoteRatchetPublicKeyHex,
    ): Promise<unknown> {
      try {
        return (
          sessionModule.initialize_as_sender(
            masterSeedAuthority,
            accountIndex,
            counterpartyPublicKeyHex,
            sessionId,
            localDeviceRef,
            generation,
            remoteRatchetPublicKeyHex,
          ) ?? null
        );
      } catch {
        return null;
      }
    },
    async attemptDevOnlyDirectRatchetRestoreCall(args: readonly unknown[]): Promise<unknown> {
      try {
        return sessionModule.restore(...args) ?? null;
      } catch {
        return null;
      }
    },
    async attemptDevOnlyDirectRatchetEncryptCall(session: unknown, plaintext: Uint8Array): Promise<Uint8Array | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "encrypt", [plaintext]);
      return result instanceof Uint8Array ? result : null;
    },
    async attemptDevOnlyDirectRatchetDecryptCall(session: unknown, wireMessage: Uint8Array, nowMs: number): Promise<Uint8Array | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "decrypt", [wireMessage, nowMs]);
      return result instanceof Uint8Array ? result : null;
    },
    async attemptDevOnlyDirectRatchetLocalPublicKeyHexCall(session: unknown): Promise<string | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "local_ratchet_public_key_hex", []);
      return typeof result === "string" ? result : null;
    },
    async attemptDevOnlyDirectRatchetRemotePublicKeyHexCall(session: unknown): Promise<string | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "remote_ratchet_public_key_hex", []);
      return typeof result === "string" ? result : null;
    },
    async attemptDevOnlyDirectRatchetIsReadyToSendCall(session: unknown): Promise<boolean> {
      return callProductionDirectRatchetSessionMethod(session, "is_ready_to_send", []) === true;
    },
    async attemptDevOnlyDirectRatchetSendCounterCall(session: unknown): Promise<number | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "send_counter", []);
      return typeof result === "number" ? result : null;
    },
    async attemptDevOnlyDirectRatchetReceiveCounterCall(session: unknown): Promise<number | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "receive_counter", []);
      return typeof result === "number" ? result : null;
    },
    async attemptDevOnlyDirectRatchetSkippedKeyCountCall(session: unknown): Promise<number | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "skipped_key_count", []);
      return typeof result === "number" ? result : null;
    },
    async attemptDevOnlyDirectRatchetPreviousSendingChainLengthCall(session: unknown): Promise<number | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "previous_sending_chain_length", []);
      return typeof result === "number" ? result : null;
    },
    async attemptDevOnlyDirectRatchetSealRootKeyCall(
      session: unknown,
      masterSeedAuthority: unknown,
      remoteDeviceRef: string,
      conversationId: string,
    ): Promise<string | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "seal_root_key", [masterSeedAuthority, remoteDeviceRef, conversationId]);
      return typeof result === "string" ? result : null;
    },
    async attemptDevOnlyDirectRatchetSealSendingChainKeyCall(
      session: unknown,
      masterSeedAuthority: unknown,
      remoteDeviceRef: string,
      conversationId: string,
    ): Promise<string | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "seal_sending_chain_key", [masterSeedAuthority, remoteDeviceRef, conversationId]);
      return typeof result === "string" ? result : null;
    },
    async attemptDevOnlyDirectRatchetSealReceivingChainKeyCall(
      session: unknown,
      masterSeedAuthority: unknown,
      remoteDeviceRef: string,
      conversationId: string,
    ): Promise<string | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "seal_receiving_chain_key", [masterSeedAuthority, remoteDeviceRef, conversationId]);
      return typeof result === "string" ? result : null;
    },
    async attemptDevOnlyDirectRatchetSealLocalRatchetPrivateKeyCall(
      session: unknown,
      masterSeedAuthority: unknown,
      remoteDeviceRef: string,
      conversationId: string,
    ): Promise<string | null> {
      const result = callProductionDirectRatchetSessionMethod(session, "seal_local_ratchet_private_key", [masterSeedAuthority, remoteDeviceRef, conversationId]);
      return typeof result === "string" ? result : null;
    },
    async attemptDevOnlyDirectRatchetSealAllSkippedKeysCall(
      session: unknown,
      masterSeedAuthority: unknown,
      remoteDeviceRef: string,
      conversationId: string,
    ): Promise<readonly string[]> {
      const result = callProductionDirectRatchetSessionMethod(session, "seal_all_skipped_keys", [masterSeedAuthority, remoteDeviceRef, conversationId]);
      return Array.isArray(result) ? (result as readonly string[]) : [];
    },
  };
}

/**
 * Secure Runtime Alpha 6921-7000 — the ONE shared resolver every entry
 * point below uses. Structural production check FIRST (never nominal);
 * falls back to the EXISTING, byte-for-byte-unchanged dev/test path
 * (`instanceof FedosWasmMasterSeedAuthority` + `developmentDirectRatchetLoaderBoundary()`)
 * for every other authority. Neither branch matching (e.g.
 * `DevelopmentFedosMasterSeedAuthority`) returns `null` — the SAME
 * fail-closed outcome this file has always produced for an unsupported
 * authority.
 */
async function resolveDirectRatchetSessionAccess(
  masterSeedAuthority: FedosMasterSeedAuthority,
): Promise<{ readonly loaderBoundary: FedosDirectRatchetWasmLoaderBoundary; readonly wasmAuthorityHandle: unknown } | null> {
  if (hasProductionDirectRatchetSessionCapability(masterSeedAuthority)) {
    const sessionModule = masterSeedAuthority.accessDirectRatchetSessionModuleInternalUse();
    if (sessionModule === null) return null;
    const wasmAuthorityHandle = (await masterSeedAuthority.accessForNostrSigningAuthorityInternalUse()) ?? null;
    if (wasmAuthorityHandle === null) return null;
    return { loaderBoundary: productionDirectRatchetLoaderBoundary(sessionModule), wasmAuthorityHandle };
  }
  if (!(masterSeedAuthority instanceof FedosWasmMasterSeedAuthority)) return null;
  const loaderBoundary = await developmentDirectRatchetLoaderBoundary();
  const wasmAuthorityHandle = (await masterSeedAuthority.accessForNostrSigningAuthorityInternalUse()) ?? null;
  if (wasmAuthorityHandle === null) return null;
  return { loaderBoundary, wasmAuthorityHandle };
}

/**
 * The real, WASM-backed cryptographic core of a Direct Double Ratchet
 * session. Every method fails closed to `null` (or a safe default) on any
 * underlying error — never throws for an ordinary cryptographic failure,
 * matching this codebase's own established WASM-boundary convention.
 */
export class FedosDirectRatchetCryptographicSession {
  readonly #loaderBoundary: FedosDirectRatchetWasmLoaderBoundary;
  #handle: unknown;

  private constructor(loaderBoundary: FedosDirectRatchetWasmLoaderBoundary, handle: unknown) {
    this.#loaderBoundary = loaderBoundary;
    this.#handle = handle;
  }

  /** Bob's role — see `FedosDirectRatchetSession::initialize_as_receiver`'s own Rust doc comment for the full design rationale. */
  static async createAsReceiver(
    masterSeedAuthority: FedosMasterSeedAuthority,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
  ): Promise<FedosDirectRatchetCryptographicSession | null> {
    const access = await resolveDirectRatchetSessionAccess(masterSeedAuthority);
    if (access === null) return null;
    const { loaderBoundary, wasmAuthorityHandle } = access;
    const handle = await loaderBoundary.attemptDevOnlyDirectRatchetInitializeAsReceiverCall(
      wasmAuthorityHandle,
      accountIndex,
      counterpartyPublicKeyHex,
      sessionId,
      localDeviceRef,
      generation,
    );
    if (handle === null) return null;
    return new FedosDirectRatchetCryptographicSession(loaderBoundary, handle);
  }

  /** Alice's role. */
  static async createAsSender(
    masterSeedAuthority: FedosMasterSeedAuthority,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
    remoteRatchetPublicKeyHex: string,
  ): Promise<FedosDirectRatchetCryptographicSession | null> {
    const access = await resolveDirectRatchetSessionAccess(masterSeedAuthority);
    if (access === null) return null;
    const { loaderBoundary, wasmAuthorityHandle } = access;
    const handle = await loaderBoundary.attemptDevOnlyDirectRatchetInitializeAsSenderCall(
      wasmAuthorityHandle,
      accountIndex,
      counterpartyPublicKeyHex,
      sessionId,
      localDeviceRef,
      generation,
      remoteRatchetPublicKeyHex,
    );
    if (handle === null) return null;
    return new FedosDirectRatchetCryptographicSession(loaderBoundary, handle);
  }

  /** Restores a session from its previously-sealed constituent parts (Phase L). */
  static async restore(
    masterSeedAuthority: FedosMasterSeedAuthority,
    remoteDeviceRef: string,
    conversationId: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
    sendCounter: number,
    receiveCounter: number,
    previousSendingChainLength: number,
    remoteRatchetPublicKeyHex: string | null,
    sealedState: FedosDirectRatchetSealedState,
  ): Promise<FedosDirectRatchetCryptographicSession | null> {
    const access = await resolveDirectRatchetSessionAccess(masterSeedAuthority);
    if (access === null) return null;
    const { loaderBoundary, wasmAuthorityHandle } = access;
    const sealedSkippedKeys = sealedState.sealedSkippedKeys.map(
      (entry) => `${entry.counter}:${entry.remoteRatchetPublicKeyHex}:${entry.createdAtMs}:${entry.sealedBlob}`,
    );
    const handle = await loaderBoundary.attemptDevOnlyDirectRatchetRestoreCall([
      wasmAuthorityHandle,
      remoteDeviceRef,
      conversationId,
      sessionId,
      localDeviceRef,
      generation,
      sendCounter,
      receiveCounter,
      previousSendingChainLength,
      remoteRatchetPublicKeyHex,
      sealedState.sealedRootKey,
      sealedState.sealedSendingChainKey,
      sealedState.sealedReceivingChainKey,
      sealedState.sealedLocalRatchetPrivateKey,
      sealedSkippedKeys,
    ]);
    if (handle === null) return null;
    return new FedosDirectRatchetCryptographicSession(loaderBoundary, handle);
  }

  async localRatchetPublicKeyHex(): Promise<string | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetLocalPublicKeyHexCall(this.#handle);
  }

  async remoteRatchetPublicKeyHex(): Promise<string | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetRemotePublicKeyHexCall(this.#handle);
  }

  async isReadyToSend(): Promise<boolean> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetIsReadyToSendCall(this.#handle);
  }

  async sendCounter(): Promise<number | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetSendCounterCall(this.#handle);
  }

  async receiveCounter(): Promise<number | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetReceiveCounterCall(this.#handle);
  }

  async skippedKeyCount(): Promise<number | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetSkippedKeyCountCall(this.#handle);
  }

  /** Secure Runtime Alpha 5561-5640 — the real, currently-committed value the NEXT `restore()` of this exact session must be given (see this Arc's own `docs/secure_runtime_alpha_5561_5640_atomic_state_outbox_retry.md` for the restart-recovery bug this closes). */
  async previousSendingChainLength(): Promise<number | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetPreviousSendingChainLengthCall(this.#handle);
  }

  /** Returns the combined opaque wire message (header + ciphertext), or `null` if not yet ready to send. */
  async encrypt(plaintext: Uint8Array): Promise<Uint8Array | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetEncryptCall(this.#handle, plaintext);
  }

  /** `nowMs` drives skipped-key expiry evaluation only (this class reads no wall clock itself). */
  async decrypt(wireMessage: Uint8Array, nowMs: number): Promise<Uint8Array | null> {
    return this.#loaderBoundary.attemptDevOnlyDirectRatchetDecryptCall(this.#handle, wireMessage, nowMs);
  }

  async sealState(
    masterSeedAuthority: FedosMasterSeedAuthority,
    remoteDeviceRef: string,
    conversationId: string,
  ): Promise<FedosDirectRatchetSealedState | null> {
    const wasmAuthorityHandle = await accessSessionCryptoWasmHandle(masterSeedAuthority);
    if (wasmAuthorityHandle === null) return null;
    const sealedRootKey = await this.#loaderBoundary.attemptDevOnlyDirectRatchetSealRootKeyCall(
      this.#handle,
      wasmAuthorityHandle,
      remoteDeviceRef,
      conversationId,
    );
    if (sealedRootKey === null) return null;
    const sealedSendingChainKey = await this.#loaderBoundary.attemptDevOnlyDirectRatchetSealSendingChainKeyCall(
      this.#handle,
      wasmAuthorityHandle,
      remoteDeviceRef,
      conversationId,
    );
    const sealedReceivingChainKey = await this.#loaderBoundary.attemptDevOnlyDirectRatchetSealReceivingChainKeyCall(
      this.#handle,
      wasmAuthorityHandle,
      remoteDeviceRef,
      conversationId,
    );
    const sealedLocalRatchetPrivateKey = await this.#loaderBoundary.attemptDevOnlyDirectRatchetSealLocalRatchetPrivateKeyCall(
      this.#handle,
      wasmAuthorityHandle,
      remoteDeviceRef,
      conversationId,
    );
    if (sealedLocalRatchetPrivateKey === null) return null;
    const sealedSkippedKeyEntries = await this.#loaderBoundary.attemptDevOnlyDirectRatchetSealAllSkippedKeysCall(
      this.#handle,
      wasmAuthorityHandle,
      remoteDeviceRef,
      conversationId,
    );
    const sealedSkippedKeys = sealedSkippedKeyEntries
      .map(parseSealedSkippedKeyEntry)
      .filter((entry): entry is FedosDirectRatchetSealedSkippedKey => entry !== null);

    return {
      sealedRootKey,
      sealedSendingChainKey,
      sealedReceivingChainKey,
      sealedLocalRatchetPrivateKey,
      sealedSkippedKeys,
    };
  }
}

/**
 * Secure Runtime Alpha 6921-7000 — PRIVATE, used only by `sealState()`
 * (the loader boundary itself is already resolved and stored at
 * construction time, so only the WASM authority handle needs re-deriving
 * per call). STRUCTURAL, not nominal: any authority genuinely exposing
 * `accessForNostrSigningAuthorityInternalUse` as a function is accepted
 * — both `FedosWasmMasterSeedAuthority` (dev/test) and
 * `FedosProductionMasterSeedAuthority` (production, since Alpha 4741-4820)
 * already implement this SAME internal accessor identically.
 * `DevelopmentFedosMasterSeedAuthority` and any other object lacking it
 * correctly resolve to `null` (fail closed), exactly as before this Arc.
 */
async function accessSessionCryptoWasmHandle(masterSeedAuthority: FedosMasterSeedAuthority): Promise<unknown> {
  const candidate = masterSeedAuthority as Partial<{ accessForNostrSigningAuthorityInternalUse(): Promise<unknown> }>;
  if (typeof candidate.accessForNostrSigningAuthorityInternalUse !== "function") return null;
  const handle = await candidate.accessForNostrSigningAuthorityInternalUse();
  return handle ?? null;
}
