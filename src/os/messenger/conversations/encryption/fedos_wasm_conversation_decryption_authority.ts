/**
 * Secure Runtime Alpha 871 ("Decryption Authority Implementation") —
 * Stage 11 of Phase B of the Alpha 851–890 Private Message Envelope and
 * Encryption Authority Activation Arc.
 *
 * The exact mirror of `FedosWasmConversationEncryptionAuthority`
 * (`./fedos_wasm_conversation_encryption_authority.ts`, Alpha 870) — same
 * injected-dependency shape, same zero-new-cryptography accounting. See
 * that file's own header for the shared rationale; this header only
 * states what differs.
 *
 *   1. `resolveConversationKey()` — the SAME shared
 *      `FedosMasterSeedAuthority` method Alpha 870 already uses, per
 *      `07_decryption_authority.md`'s own "single shared implementation
 *      rather than two" recommendation — never a second, independent
 *      derivation.
 *   2. `request.ciphertext` (`Uint8Array`, the SAME shape
 *      `FedosConversationPayloadStorage.getPayload()` returns) is UTF-8
 *      DECODED back into the `AeadCiphertextWire` text
 *      `FedosWasmConversationEncryptionAuthority`'s own `exportCiphertext()`
 *      step produced — the exact inverse of Alpha 870's own UTF-8 encode.
 *      A `TextDecoder` failure (malformed UTF-8) fails closed to
 *      `"invalid-input"` before any key is even resolved.
 *   3. Import (`importCiphertext()`,
 *      `../../runtime/fedos_runtime_import_ciphertext.ts`) then decrypt
 *      (`decrypt()`, `../../runtime/fedos_runtime_decrypt.ts`) — reached
 *      through the injected `FedosConversationDecryptionRuntimeBoundary`
 *      below, mirroring Alpha 870's own testability shape exactly.
 *   4. STRIP + RE-DERIVE + BYTE-COMPARE the Alpha 856 associated-data
 *      header from the recovered plaintext
 *      (`fedosConversationEnvelopeAssociatedDataBytesAreEqual()`,
 *      `../envelope/fedos_conversation_envelope_associated_data.ts`) —
 *      this file's own ONLY new logic beyond wiring. A length or byte
 *      mismatch collapses to `"failed"`, the SAME undifferentiated
 *      outcome a genuine AEAD authentication failure produces (see
 *      `fedos_conversation_decryption_authority.ts`'s own header — no
 *      oracle).
 *
 * HARD GUARDRAILS:
 *   - No raw key byte is read, stored, or returned anywhere in this
 *     file.
 *   - `decrypt()` NEVER throws — any unexpected exception anywhere in
 *     this chain collapses to `{ outcome: "failed" }`.
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../../../runtime/fedos_wasm_loader.js";
import { decrypt as runtimeDecrypt } from "../../../../runtime/fedos_runtime_decrypt.js";
import { importCiphertext as runtimeImportCiphertext } from "../../../../runtime/fedos_runtime_import_ciphertext.js";
import type { FedosMasterSeedAuthority } from "../../../core/vault/wasm/fedos_master_seed_authority.js";
import {
  encodeFedosConversationEnvelopeAssociatedData,
  fedosConversationEnvelopeAssociatedDataBytesAreEqual,
} from "../envelope/fedos_conversation_envelope_associated_data.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "./fedos_conversation_decryption_authority.js";

/** Alpha 856's own coarse domain label — SAME value Alpha 870's own Encryption Authority uses. */
const FEDOS_CONVERSATION_ENVELOPE_AAD_DOMAIN: AeadAadDomain = "Conversation";

/**
 * A narrow, structurally-typed dependency — the decrypt-side mirror of
 * `FedosConversationEncryptionRuntimeBoundary` (Alpha 870). The real,
 * default implementation (`fedosConversationDecryptionRuntimeBoundary`,
 * below) calls the real, already-real `importCiphertext()`/`decrypt()`
 * Runtime Service functions — every real call site omits this parameter.
 */
export interface FedosConversationDecryptionRuntimeBoundary {
  importCiphertext(serialized: AeadCiphertextWire): Promise<AeadCiphertextHandle | null>;
  decrypt(
    key: AeadKeyHandle,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    ciphertext: AeadCiphertextHandle,
  ): Promise<Uint8Array | null>;
}

/** The real, default `FedosConversationDecryptionRuntimeBoundary` — thin pass-throughs, adding no logic of its own. */
export const fedosConversationDecryptionRuntimeBoundary: FedosConversationDecryptionRuntimeBoundary = {
  importCiphertext: (serialized) => runtimeImportCiphertext(serialized),
  decrypt: (key, algorithm, aadDomain, ciphertext) => runtimeDecrypt(key, algorithm, aadDomain, ciphertext),
};

/**
 * Secure Runtime Alpha 871 — the concrete, WASM-backed
 * `FedosConversationDecryptionAuthority`. Constructed with a
 * `FedosMasterSeedAuthority` (the SAME instance shape Alpha 870's own
 * Encryption Authority accepts) and, optionally for testability only, a
 * `FedosConversationDecryptionRuntimeBoundary`.
 */
export class FedosWasmConversationDecryptionAuthority implements FedosConversationDecryptionAuthority {
  readonly #masterSeedAuthority: FedosMasterSeedAuthority;
  readonly #runtimeBoundary: FedosConversationDecryptionRuntimeBoundary;

  constructor(
    masterSeedAuthority: FedosMasterSeedAuthority,
    runtimeBoundary: FedosConversationDecryptionRuntimeBoundary = fedosConversationDecryptionRuntimeBoundary,
  ) {
    this.#masterSeedAuthority = masterSeedAuthority;
    this.#runtimeBoundary = runtimeBoundary;
  }

  async decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) {
      return { outcome: "invalid-input" };
    }

    let wireText: string;
    try {
      wireText = new TextDecoder("utf-8", { fatal: true }).decode(request.ciphertext);
    } catch {
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

    try {
      const ciphertextHandle = await this.#runtimeBoundary.importCiphertext(wireText as AeadCiphertextWire);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const prefixedPlaintext = await this.#runtimeBoundary.decrypt(
        keyHandle,
        request.suite,
        FEDOS_CONVERSATION_ENVELOPE_AAD_DOMAIN,
        ciphertextHandle,
      );
      if (prefixedPlaintext === null) return { outcome: "failed" };

      const expectedHeader = encodeFedosConversationEnvelopeAssociatedData({
        id: request.envelopeId,
        conversationId: request.conversationId,
        senderMembershipId: request.senderMembershipId,
        keyEpoch: request.keyEpoch,
        createdAt: request.createdAt,
        replyToEnvelopeId: request.replyToEnvelopeId,
        encryptionSuite: request.suite,
      });
      if (prefixedPlaintext.length < expectedHeader.length) return { outcome: "failed" };

      const actualHeader = prefixedPlaintext.subarray(0, expectedHeader.length);
      if (!fedosConversationEnvelopeAssociatedDataBytesAreEqual(actualHeader, expectedHeader)) {
        return { outcome: "failed" };
      }

      return { outcome: "decrypted", plaintext: prefixedPlaintext.subarray(expectedHeader.length) };
    } catch {
      return { outcome: "failed" };
    }
  }
}
