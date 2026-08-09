/**
 * Stage 59 — `FedosCoreCryptoProvider`: host adapter over the FedOS core seam.
 *
 * Bridges the FUTURE FedOS crypto core (`@nostr-window/fedos-core-rust`) to the
 * host's `CryptoProvider` interface (`src/crypto/types.ts`). This is the single
 * point where the host would consume a real Rust/WASM core — behind the SAME
 * interface the rest of the app already depends on, so no caller learns whether
 * a core is present.
 *
 * This stage wires NO real cryptography. The only core available today is the
 * package's permanently-inert `PlaceholderFedosCoreCrypto`, and even that is not
 * constructed here by default: a `FedosCoreCryptoProvider` built WITHOUT an
 * injected core behaves exactly like `NoopCryptoProvider` (delegates to one).
 *
 * GUARDRAILS:
 *   - Never throws: a core that throws/rejects is caught and reported as a
 *     non-sensitive `error` status/decision.
 *   - Never mutates the input request (it is passed straight through, unread).
 *   - Never stores or copies secret/key/plaintext/ciphertext bytes — requests
 *     carry only opaque handles, and the adapter retains none of them.
 *   - NOT wired into the runtime or the Worker. `create_runtime.ts`/`worker.ts`
 *     construct nothing from this file.
 */

import { NoopCryptoProvider } from "./noop_crypto.js";
import type {
  CryptoCapability,
  CryptoDecision,
  CryptoProvider,
  CryptoStatus,
  DecryptRequest,
  DeriveKeyRequest,
  EncryptRequest,
  RandomBytesRequest,
} from "./types.js";
import type { FedosCoreCrypto } from "../../../../packages/fedos-core-rust/src/index.js";

export class FedosCoreCryptoProvider implements CryptoProvider {
  /** The injected FedOS core, or `undefined` when none is configured. */
  readonly #core: FedosCoreCrypto | undefined;
  /** Safe fallback used whenever no core is injected. */
  readonly #fallback: NoopCryptoProvider;

  /**
   * @param core An optional FedOS crypto core. When omitted, this provider is a
   *   drop-in `NoopCryptoProvider` — permanently `unavailable`, denying all.
   */
  constructor(core?: FedosCoreCrypto) {
    this.#core = core;
    this.#fallback = new NoopCryptoProvider();
  }

  getStatus(): CryptoStatus {
    const core = this.#core;
    if (!core) return this.#fallback.getStatus();
    try {
      return core.getStatus();
    } catch {
      return { state: "error", reason: "FedOS core status could not be read" };
    }
  }

  getCapabilities(): readonly CryptoCapability[] {
    const core = this.#core;
    if (!core) return this.#fallback.getCapabilities();
    try {
      return core.getCapabilities();
    } catch {
      // A misbehaving core advertises nothing rather than crashing a caller.
      return [];
    }
  }

  async randomBytes(request: RandomBytesRequest): Promise<CryptoDecision> {
    const core = this.#core;
    if (!core) return this.#fallback.randomBytes(request);
    return this.#delegate("random-bytes generation", () =>
      core.randomBytes(request),
    );
  }

  async deriveKey(request: DeriveKeyRequest): Promise<CryptoDecision> {
    const core = this.#core;
    if (!core) return this.#fallback.deriveKey(request);
    return this.#delegate("key derivation", () => core.deriveKey(request));
  }

  async encrypt(request: EncryptRequest): Promise<CryptoDecision> {
    const core = this.#core;
    if (!core) return this.#fallback.encrypt(request);
    return this.#delegate("encryption", () => core.encrypt(request));
  }

  async decrypt(request: DecryptRequest): Promise<CryptoDecision> {
    const core = this.#core;
    if (!core) return this.#fallback.decrypt(request);
    return this.#delegate("decryption", () => core.decrypt(request));
  }

  /**
   * Run a core operation, catching any throw/rejection and reporting it as a
   * non-sensitive `error` decision. The `operation` label is a fixed string —
   * never the request handles or any provider error text (which could carry
   * secret-shaped material from a future core).
   */
  async #delegate(
    operation: string,
    run: () => Promise<CryptoDecision>,
  ): Promise<CryptoDecision> {
    try {
      return await run();
    } catch {
      return {
        allowed: false,
        state: "error",
        reason: `FedOS core could not serve ${operation}`,
      };
    }
  }
}
