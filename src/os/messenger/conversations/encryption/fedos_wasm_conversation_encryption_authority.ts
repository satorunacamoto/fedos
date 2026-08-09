/**
 * Secure Runtime Alpha 870 ("Encryption Authority Implementation") —
 * Stage 10 of Phase B of the Alpha 851–890 Private Message Envelope and
 * Encryption Authority Activation Arc.
 *
 * The FIRST concrete implementation of `FedosConversationEncryptionAuthority`
 * (`./fedos_conversation_encryption_authority.ts`, Alpha 861/863) — pure
 * wiring, zero new cryptography, per that file's own "genuinely new work
 * vs. pure reuse" accounting (`06_encryption_authority.md`):
 *
 *   1. `resolveConversationKey()` — `FedosMasterSeedAuthority`'s own
 *      Alpha 869 method (`../../runtime/master_seed/fedos_master_seed_authority.ts`),
 *      injected, never re-implemented here.
 *   2. Build the Alpha 856 associated-data header
 *      (`encodeFedosConversationEnvelopeAssociatedData()`,
 *      `../envelope/fedos_conversation_envelope_associated_data.ts`) and
 *      prepend it to `request.plaintext` — this file's own ONLY new
 *      logic beyond wiring: a plain byte concatenation
 *      (`prependAssociatedDataHeader()` below), never a re-implementation
 *      of the header encoding itself.
 *   3. Seal via the EXISTING, real `encrypt()`
 *      (`../../runtime/fedos_runtime_encrypt.ts`) then `exportCiphertext()`
 *      (`../../runtime/fedos_runtime_export_ciphertext.ts`) — reached
 *      through an injected `FedosConversationEncryptionRuntimeBoundary`
 *      (mirroring `FedosMasterSeedWasmLoaderBoundary`'s own
 *      injectable-for-testability shape,
 *      `../../runtime/master_seed/fedos_wasm_master_seed_authority.ts`),
 *      never called directly so a test can observe every branch without
 *      a real compiled WASM artifact.
 *   4. The resulting `AeadCiphertextWire` (a branded `string`) is UTF-8
 *      encoded into the `Uint8Array` `FedosConversationEncryptionResult`'s
 *      own `"encrypted"` outcome carries — the ONLY shape
 *      `FedosConversationPayloadStorage.putPayload()`
 *      (`../payload_storage/fedos_conversation_payload_storage.ts`,
 *      Alpha 804) accepts. Decoding this same text back
 *      (`TextDecoder`) is `FedosWasmConversationDecryptionAuthority`'s
 *      own first step (`./fedos_wasm_conversation_decryption_authority.ts`,
 *      Alpha 871) — the two are each other's exact inverse.
 *
 * `"unauthorized"`/`"unavailable"` are never actually produced by this
 * class's own code — they exist in `FedosConversationEncryptionResult`
 * (Alpha 863) for a future Coordinator layer (membership-readiness/
 * runtime-gate checks upstream of this Authority, per
 * `fedos_conversation_encryption_authority.ts`'s own "Non-responsibilities"
 * list) that this Arc does not build (see this Arc's own completion
 * declaration for why: it depends on the SAME named
 * `localAccountIndex`/`counterpartyPublicKeyHex` resolution blocker).
 *
 * HARD GUARDRAILS:
 *   - No raw key byte is read, stored, or returned anywhere in this
 *     file — `keyHandle` (an opaque `AeadKeyHandle`) is passed straight
 *     from `resolveConversationKey()` into `encrypt()` and never
 *     otherwise touched.
 *   - `encrypt()` NEVER throws — any unexpected exception from the
 *     injected boundary collapses to `{ outcome: "failed" }`.
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../../../runtime/fedos_wasm_loader.js";
import { encrypt as runtimeEncrypt } from "../../../../runtime/fedos_runtime_encrypt.js";
import { exportCiphertext as runtimeExportCiphertext } from "../../../../runtime/fedos_runtime_export_ciphertext.js";
import type { FedosMasterSeedAuthority } from "../../../../runtime/master_seed/fedos_master_seed_authority.js";
import { encodeFedosConversationEnvelopeAssociatedData } from "../../../../conversation/envelope/fedos_conversation_envelope_associated_data.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../../../../conversation/encryption/fedos_conversation_encryption_authority.js";

/** Alpha 856's own coarse domain label — the ONE `AeadAadDomain` value every Envelope encryption/decryption call in this Arc uses (`14_associated_data.md`'s "beyond the coarse Conversation domain label" finding is what the length-prefixed header above exists to close; the domain label itself stays exactly this one value). */
const FEDOS_CONVERSATION_ENVELOPE_AAD_DOMAIN: AeadAadDomain = "Conversation";

/**
 * A narrow, structurally-typed dependency — mirrors `FedosMasterSeedWasmLoaderBoundary`'s
 * own injectable-for-testability shape. The real, default implementation
 * (`fedosConversationEncryptionRuntimeBoundary`, below) calls the real,
 * already-real `encrypt()`/`exportCiphertext()` Runtime Service
 * functions — every real call site omits this parameter.
 */
export interface FedosConversationEncryptionRuntimeBoundary {
  encrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): Promise<AeadCiphertextHandle | null>;
  exportCiphertext(ciphertext: AeadCiphertextHandle): Promise<AeadCiphertextWire | null>;
}

/** The real, default `FedosConversationEncryptionRuntimeBoundary` — thin pass-throughs to the already-real Runtime Service functions, adding no logic of its own. */
export const fedosConversationEncryptionRuntimeBoundary: FedosConversationEncryptionRuntimeBoundary = {
  encrypt: (key, algorithm, aadDomain, plaintext) => runtimeEncrypt(key, algorithm, aadDomain, plaintext),
  exportCiphertext: (ciphertext) => runtimeExportCiphertext(ciphertext),
};

/** PRIVATE — concatenates the associated-data header in front of the real plaintext. Plain byte concatenation only; the header's own encoding is entirely `encodeFedosConversationEnvelopeAssociatedData()`'s own responsibility. */
function prependAssociatedDataHeader(header: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const out = new Uint8Array(header.length + plaintext.length);
  out.set(header, 0);
  out.set(plaintext, header.length);
  return out;
}

/**
 * Secure Runtime Alpha 870 — the concrete, WASM-backed
 * `FedosConversationEncryptionAuthority`. Constructed with a
 * `FedosMasterSeedAuthority` (the SAME instance a caller's own Master
 * Seed lifecycle already manages — never constructed internally, mirrors
 * `FedosWasmNostrSigningAuthority`'s own injected-dependency shape) and,
 * optionally for testability only, a `FedosConversationEncryptionRuntimeBoundary`.
 */
export class FedosWasmConversationEncryptionAuthority implements FedosConversationEncryptionAuthority {
  readonly #masterSeedAuthority: FedosMasterSeedAuthority;
  readonly #runtimeBoundary: FedosConversationEncryptionRuntimeBoundary;

  constructor(
    masterSeedAuthority: FedosMasterSeedAuthority,
    runtimeBoundary: FedosConversationEncryptionRuntimeBoundary = fedosConversationEncryptionRuntimeBoundary,
  ) {
    this.#masterSeedAuthority = masterSeedAuthority;
    this.#runtimeBoundary = runtimeBoundary;
  }

  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) {
      return { outcome: "invalid-input" };
    }

    let keyHandle: AeadKeyHandle | null;
    try {
      keyHandle = await this.#masterSeedAuthority.resolveConversationKey(
        request.localAccountIndex,
        request.counterpartyPublicKeyHex,
      );
    } catch {
      return { outcome: "key-unavailable" };
    }
    if (keyHandle === null) return { outcome: "key-unavailable" };

    const header = encodeFedosConversationEnvelopeAssociatedData({
      id: request.envelopeId,
      conversationId: request.conversationId,
      senderMembershipId: request.senderMembershipId,
      keyEpoch: request.keyEpoch,
      createdAt: request.createdAt,
      replyToEnvelopeId: request.replyToEnvelopeId,
      encryptionSuite: request.suite,
    });
    const prefixedPlaintext = prependAssociatedDataHeader(header, request.plaintext);

    try {
      const ciphertextHandle = await this.#runtimeBoundary.encrypt(
        keyHandle,
        request.suite,
        FEDOS_CONVERSATION_ENVELOPE_AAD_DOMAIN,
        prefixedPlaintext,
      );
      if (ciphertextHandle === null) return { outcome: "failed" };

      const wire = await this.#runtimeBoundary.exportCiphertext(ciphertextHandle);
      if (wire === null) return { outcome: "failed" };

      return { outcome: "encrypted", ciphertext: new TextEncoder().encode(wire) };
    } catch {
      return { outcome: "failed" };
    }
  }
}
