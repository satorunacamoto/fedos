/**
 * Secure Runtime Alpha 1137 ("Read Result Vocabulary") — Phase D of the
 * Alpha 1111–1180 Private Conversation Activation and Direct Messaging
 * Runtime Arc.
 *
 * Coarse, closed, stable outcomes only. Per Alpha 1137's own explicit
 * instruction, this vocabulary does NOT distinguish wrong-key from tamper
 * — the underlying `FedosConversationDecryptionAuthority.decrypt()` (Alpha
 * 862/865, reused unmodified) already collapses a genuine AEAD
 * authentication failure and a re-derived-associated-data-header mismatch
 * into the SAME undifferentiated `"failed"` outcome (that file's own
 * header: "never a distinguishable reason... no oracle"); this facade
 * preserves that non-oracle property rather than widening it.
 * `"key-unavailable"` stays a SEPARATE, earlier outcome — it is resolved
 * strictly BEFORE any ciphertext is touched (local key-material
 * readiness, not a property of the ciphertext itself), so exposing it
 * distinctly creates no tamper/wrong-key oracle.
 */

export type FedosConversationDirectMessageReadResult =
  | { readonly outcome: "decrypted"; readonly plaintext: Uint8Array }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "conversation-not-active" }
  | { readonly outcome: "invalid-envelope" }
  | { readonly outcome: "payload-unavailable" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "tombstoned" }
  | { readonly outcome: "failed" };
