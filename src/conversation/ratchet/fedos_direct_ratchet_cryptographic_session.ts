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
 */
import { FedosWasmLoaderSkeleton } from "../../runtime/fedos_wasm_loader.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import { FedosWasmMasterSeedAuthority } from "../../runtime/master_seed/fedos_wasm_master_seed_authority.js";

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

async function primedLoader(): Promise<FedosDirectRatchetWasmLoaderBoundary> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return loader as unknown as FedosDirectRatchetWasmLoaderBoundary;
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
    const loaderBoundary = await primedLoader();
    const wasmAuthorityHandle = await accessWasmMasterSeedAuthorityHandle(masterSeedAuthority);
    if (wasmAuthorityHandle === null) return null;
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
    const loaderBoundary = await primedLoader();
    const wasmAuthorityHandle = await accessWasmMasterSeedAuthorityHandle(masterSeedAuthority);
    if (wasmAuthorityHandle === null) return null;
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
    const loaderBoundary = await primedLoader();
    const wasmAuthorityHandle = await accessWasmMasterSeedAuthorityHandle(masterSeedAuthority);
    if (wasmAuthorityHandle === null) return null;
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
    const wasmAuthorityHandle = await accessWasmMasterSeedAuthorityHandle(masterSeedAuthority);
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
 * PRIVATE — reaches the real WASM authority handle
 * `FedosWasmMasterSeedAuthority` holds internally, the SAME reviewed seam
 * `accessForNostrSigningAuthorityInternalUse()` already provides for
 * exactly this purpose (Alpha 444) — this Arc's own sealing/bootstrap
 * calls are a SECOND reviewed consumer of that same internal accessor,
 * never a new one. `null` if `masterSeedAuthority` is not a
 * `FedosWasmMasterSeedAuthority` (this Arc's own sealing/bootstrap
 * integration requires the real WASM authority; `DevelopmentFedosMasterSeedAuthority`/
 * `FedosProductionMasterSeedAuthority` are out of scope for this Arc,
 * matching the Foundation Arc's own identical boundary).
 */
async function accessWasmMasterSeedAuthorityHandle(masterSeedAuthority: FedosMasterSeedAuthority): Promise<unknown> {
  if (!(masterSeedAuthority instanceof FedosWasmMasterSeedAuthority)) return null;
  const handle = await masterSeedAuthority.accessForNostrSigningAuthorityInternalUse();
  return handle ?? null;
}
