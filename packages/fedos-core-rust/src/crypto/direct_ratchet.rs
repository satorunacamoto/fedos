//! Secure Runtime Alpha 5481-5560 (FedOS Direct Double Ratchet Cryptographic
//! Core Arc) — the pure cryptographic primitives a Direct Double Ratchet
//! needs: fresh ephemeral secp256k1 keypair generation, raw ECDH agreement,
//! a root KDF, and a chain KDF.
//!
//! Crate-private only — mirrors `crypto::conversation_key`'s own module
//! shape and doc-comment discipline exactly, but is a DELIBERATELY SEPARATE
//! module, never a modification of it: `conversation_key.rs`'s own ECDH
//! function bakes the fixed NIP-44 `"nip44-v2"` HKDF-extract salt directly
//! into its return value, with no way to obtain the raw shared secret
//! before that salt is applied. Reusing it here would silently mix an
//! unrelated HKDF domain into ratchet root-key derivation — this module
//! performs the SAME validated point-arithmetic technique independently,
//! returning the raw ECDH output for THIS domain's own root KDF to consume.
//!
//! **What this module is NOT**: no message encrypt/decrypt (see
//! `lib.rs`'s `FedosDirectRatchetSession`), no header format, no sealed
//! persistence (reuses the EXISTING `FedosMasterSeedAuthority::seal_direct_ratchet_secret`/
//! `restore_direct_ratchet_secret` from the Foundation Arc, unmodified), no
//! WASM export, no Runtime/Conversation/NIP-17 connection.
#![allow(dead_code)]

use crate::secret_handle::{SecretHandle, SecretHandleKind};
use chacha20poly1305::aead::{Aead as ChaChaAeadOp, KeyInit as ChaChaKeyInit, Payload as ChaChaPayload};
use chacha20poly1305::{ChaCha20Poly1305, Key as ChaChaKey, Nonce as ChaChaNonce};
use hkdf::Hkdf;
use k256::elliptic_curve::sec1::{FromEncodedPoint, ToEncodedPoint};
use k256::{AffinePoint, EncodedPoint, ProjectivePoint, SecretKey};
use sha2::Sha256;
use zeroize::Zeroize;

/// Fixed, compile-time-only domain-separation labels — never caller-supplied,
/// mirroring `kdf_core::HkdfDomain`'s own "fixed label chosen at compile
/// time" discipline, but applied here via direct `Hkdf::expand` info labels
/// rather than through the shared fixed-domain-only helper (which never
/// accepts the caller-supplied session-binding context this domain's own
/// security property requires — see Phase D of the reconciliation report).
const ROOT_KDF_INFO_LABEL: &[u8] = b"fedos-direct-ratchet-root-v1";
const CHAIN_SEED_KDF_INFO_LABEL: &[u8] = b"fedos-direct-ratchet-chain-seed-v1";
const MESSAGE_KEY_KDF_INFO_LABEL: &[u8] = b"fedos-direct-ratchet-message-key-v1";
const NEXT_CHAIN_KDF_INFO_LABEL: &[u8] = b"fedos-direct-ratchet-next-chain-v1";

/// A fresh, random secp256k1 keypair for one DH ratchet step. `public` is
/// non-secret x-only (32-byte) encoded data; `private` is an opaque
/// `SecretHandle(DirectRatchetPrivateKeyMaterial)` — never a raw byte
/// outside this module's own construction site.
pub(crate) struct DirectRatchetKeypair {
    pub(crate) private: SecretHandle,
    pub(crate) public: [u8; 32],
}

/// Validates `bytes` is a well-formed, on-curve, x-only secp256k1 public key
/// (the SAME even-Y SEC1-lift convention `crypto::conversation_key` already
/// uses) — rejects a wrong length, a malformed encoding, or an off-curve
/// point. Never panics.
pub(crate) fn validate_direct_ratchet_public_key_internal(bytes: &[u8]) -> Option<[u8; 32]> {
    if bytes.len() != 32 {
        return None;
    }
    let mut x_only = [0u8; 32];
    x_only.copy_from_slice(bytes);
    let mut compressed = [0u8; 33];
    compressed[0] = 0x02;
    compressed[1..].copy_from_slice(&x_only);
    let is_on_curve = EncodedPoint::from_bytes(&compressed)
        .ok()
        .and_then(|encoded| Option::<AffinePoint>::from(AffinePoint::from_encoded_point(&encoded)))
        .is_some();
    compressed.zeroize();
    if is_on_curve {
        Some(x_only)
    } else {
        None
    }
}

/// Generates a fresh, CSPRNG-backed secp256k1 keypair via the EXISTING,
/// UNCHANGED `fedos_random_bytes_32()` entropy source (never `Math.random`,
/// never a placeholder). Bounded retry (extremely unlikely to ever need a
/// second attempt — an out-of-range/zero scalar has probability ~2^-128):
/// a genuine CSPRNG failure (entropy source unavailable) fails closed
/// immediately, never masked by retrying.
pub(crate) fn generate_direct_ratchet_keypair_internal() -> Option<DirectRatchetKeypair> {
    const MAX_ATTEMPTS: u8 = 8;
    for _ in 0..MAX_ATTEMPTS {
        let decision = crate::fedos_random_bytes_32();
        if decision.state != crate::FedosRandomBytesState::Ready {
            return None;
        }
        let mut candidate = decision.bytes?;
        match SecretKey::from_slice(&candidate) {
            Ok(secret_key) => {
                let encoded_public = secret_key.public_key().to_encoded_point(true);
                let mut public = [0u8; 32];
                public.copy_from_slice(&encoded_public.as_bytes()[1..33]);
                let private = SecretHandle::new_from_32_bytes_for_internal_use(
                    SecretHandleKind::DirectRatchetPrivateKeyMaterial,
                    candidate,
                );
                candidate.zeroize();
                return Some(DirectRatchetKeypair { private, public });
            }
            Err(_) => {
                candidate.zeroize();
                continue;
            }
        }
    }
    None
}

/// Recomputes the public half of a `DirectRatchetPrivateKeyMaterial`
/// handle — used ONLY at restore time (the sealed record holds the private
/// scalar only; the public key is always deterministically recomputed from
/// it, never taken as separate, unverified, redundant input). `None` on a
/// kind mismatch or an invalid scalar.
pub(crate) fn derive_direct_ratchet_public_from_private_internal(private: &SecretHandle) -> Option<[u8; 32]> {
    if private.kind() != SecretHandleKind::DirectRatchetPrivateKeyMaterial {
        return None;
    }
    let mut bytes = private.expose_bytes_for_internal_ratchet_ecdh()?;
    let secret_key = match SecretKey::from_slice(&bytes) {
        Ok(key) => key,
        Err(_) => {
            bytes.zeroize();
            return None;
        }
    };
    bytes.zeroize();
    let encoded = secret_key.public_key().to_encoded_point(true);
    let mut public = [0u8; 32];
    public.copy_from_slice(&encoded.as_bytes()[1..33]);
    Some(public)
}

/// Raw secp256k1 ECDH agreement between `local_private`
/// (`DirectRatchetPrivateKeyMaterial`-kinded) and `remote_public_x_only`
/// (already-public wire data, validated on-curve before any scalar
/// multiplication runs). Returns the raw 32-byte shared X-coordinate —
/// this domain's OWN root KDF (below) is the only intended consumer; it is
/// never itself the ratchet's actual root/chain/message key. `None` on any
/// kind mismatch, placeholder/cleared input, or invalid public key —
/// never a panic, never a partial/undefined output.
pub(crate) fn direct_ratchet_ecdh_internal(
    local_private: &SecretHandle,
    remote_public_x_only: &[u8; 32],
) -> Option<[u8; 32]> {
    if local_private.kind() != SecretHandleKind::DirectRatchetPrivateKeyMaterial {
        return None;
    }
    let validated_public = validate_direct_ratchet_public_key_internal(remote_public_x_only)?;

    let mut sec1_bytes = local_private.expose_bytes_for_internal_ratchet_ecdh()?;
    let secret_scalar = match SecretKey::from_slice(&sec1_bytes) {
        Ok(key) => key.to_nonzero_scalar(),
        Err(_) => {
            sec1_bytes.zeroize();
            return None;
        }
    };
    sec1_bytes.zeroize();

    let mut compressed_public = [0u8; 33];
    compressed_public[0] = 0x02;
    compressed_public[1..].copy_from_slice(&validated_public);
    let public_affine: Option<AffinePoint> = EncodedPoint::from_bytes(&compressed_public)
        .ok()
        .and_then(|encoded| Option::from(AffinePoint::from_encoded_point(&encoded)));
    compressed_public.zeroize();
    let public_affine = public_affine?;

    let mut shared_x = [0u8; 32];
    {
        let shared_point = (ProjectivePoint::from(public_affine) * *secret_scalar).to_affine();
        let encoded_shared = shared_point.to_encoded_point(true);
        shared_x.copy_from_slice(&encoded_shared.as_bytes()[1..33]);
    }
    Some(shared_x)
}

/// The root KDF (review `08_dh_session_ratchet.md` §3): mixes the CURRENT
/// root secret with an authenticated DH result and a full session-binding
/// context to produce a NEW root secret and a fresh chain-seed secret.
/// Domain-separated via two independent `Hkdf::expand` calls with distinct,
/// fixed info labels (never the same output reused for both purposes) —
/// `context` (session id / Device-pair / Conversation / generation binding
/// bytes, caller-supplied) is folded into BOTH labels, so a different
/// context deterministically produces different output, and the SAME
/// context+inputs always produce the SAME output (test-vector
/// determinism). `current_root` MUST be `DirectRatchetRootKeyMaterial`-kinded.
/// Returns `None` (never a partial/one-sided output) on any kind mismatch
/// or internal HKDF failure — old root/chain secrets are never consumed
/// (mutated in place) by this pure function; the caller decides whether to
/// replace them with the returned pair.
pub(crate) fn direct_ratchet_root_kdf_internal(
    current_root: &SecretHandle,
    dh_output: &[u8; 32],
    context: &[u8],
) -> Option<(SecretHandle, SecretHandle)> {
    if current_root.kind() != SecretHandleKind::DirectRatchetRootKeyMaterial {
        return None;
    }
    let mut root_bytes = current_root.expose_bytes_for_internal_ratchet_root_kdf()?;
    let (_prk, hk) = Hkdf::<Sha256>::extract(Some(&root_bytes), dh_output);
    root_bytes.zeroize();

    let mut root_info = Vec::with_capacity(context.len() + ROOT_KDF_INFO_LABEL.len());
    root_info.extend_from_slice(context);
    root_info.extend_from_slice(ROOT_KDF_INFO_LABEL);
    let mut chain_info = Vec::with_capacity(context.len() + CHAIN_SEED_KDF_INFO_LABEL.len());
    chain_info.extend_from_slice(context);
    chain_info.extend_from_slice(CHAIN_SEED_KDF_INFO_LABEL);

    let mut next_root_bytes = [0u8; 32];
    if hk.expand(&root_info, &mut next_root_bytes).is_err() {
        next_root_bytes.zeroize();
        return None;
    }
    let mut next_chain_bytes = [0u8; 32];
    if hk.expand(&chain_info, &mut next_chain_bytes).is_err() {
        next_root_bytes.zeroize();
        next_chain_bytes.zeroize();
        return None;
    }

    let next_root =
        SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::DirectRatchetRootKeyMaterial, next_root_bytes);
    next_root_bytes.zeroize();
    let next_chain = SecretHandle::new_from_32_bytes_for_internal_use(
        SecretHandleKind::DirectRatchetChainKeyMaterial,
        next_chain_bytes,
    );
    next_chain_bytes.zeroize();
    Some((next_root, next_chain))
}

/// The chain KDF (review `07_message_key_ratchet.md` §1): one-way advance
/// of a chain key into a one-time message key (`AeadKeyMaterial`-kinded —
/// immediately usable with the EXISTING `crypto::aead_internal::seal_internal`/
/// `open_internal`) and the next chain key — two INDEPENDENT outputs of one
/// derivation step, never the same value reused for both. `chain_key` MUST
/// be `DirectRatchetChainKeyMaterial`-kinded and is treated as an
/// already-high-entropy PRK (never re-extracted with a salt) — mirrors the
/// Foundation Arc's own `fedos_derive_direct_ratchet_session_sealing_key_internal`
/// two-stage precedent (fixed-domain extract once, then per-call expand),
/// applied here as a pure one-way advance with no further extract step at
/// all. `None` on kind mismatch or internal failure — never a partial
/// output; the caller discards `chain_key` and replaces it with the
/// returned next chain key ONLY on success.
pub(crate) fn direct_ratchet_chain_kdf_internal(chain_key: &SecretHandle) -> Option<(SecretHandle, SecretHandle)> {
    if chain_key.kind() != SecretHandleKind::DirectRatchetChainKeyMaterial {
        return None;
    }
    let mut current_bytes = chain_key.expose_bytes_for_internal_ratchet_chain_kdf()?;
    let hk = match Hkdf::<Sha256>::from_prk(&current_bytes) {
        Ok(hk) => hk,
        Err(_) => {
            current_bytes.zeroize();
            return None;
        }
    };
    current_bytes.zeroize();

    let mut message_key_bytes = [0u8; 32];
    if hk.expand(MESSAGE_KEY_KDF_INFO_LABEL, &mut message_key_bytes).is_err() {
        message_key_bytes.zeroize();
        return None;
    }
    let mut next_chain_bytes = [0u8; 32];
    if hk.expand(NEXT_CHAIN_KDF_INFO_LABEL, &mut next_chain_bytes).is_err() {
        message_key_bytes.zeroize();
        next_chain_bytes.zeroize();
        return None;
    }

    let message_key = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::AeadKeyMaterial, message_key_bytes);
    message_key_bytes.zeroize();
    let next_chain_key = SecretHandle::new_from_32_bytes_for_internal_use(
        SecretHandleKind::DirectRatchetChainKeyMaterial,
        next_chain_bytes,
    );
    next_chain_bytes.zeroize();
    Some((message_key, next_chain_key))
}

/// The fixed AEAD nonce every Direct Ratchet message encryption uses — safe
/// BECAUSE each `message_key` (`direct_ratchet_chain_kdf_internal`'s own
/// output) seals EXACTLY ONE message ever, then is discarded: AEAD safety
/// requires (key, nonce) uniqueness, and here the KEY alone is already
/// unique per message, so nonce variation is unnecessary — the same
/// property real Double Ratchet designs rely on. Deliberately DIFFERENT
/// from the Conversation-level static-key encryption's own fresh-random-
/// nonce-per-message requirement (that key IS reused across many
/// messages, so nonce variation is essential there).
const DIRECT_RATCHET_MESSAGE_NONCE: [u8; 12] = [0u8; 12];

/// Seals `plaintext` under `message_key` (`AeadKeyMaterial`-kinded, a
/// `direct_ratchet_chain_kdf_internal` output) with `header_bytes` as
/// Additional Authenticated Data — binding the ciphertext to the EXACT
/// header it travels with (Phase G: "authenticated as AAD"), so a tampered
/// header or a header/ciphertext swap both fail authentication. This is a
/// narrow, INDEPENDENT function — deliberately NOT a modification of
/// `crypto::aead_internal::seal_internal` (which only accepts a fixed,
/// per-domain AAD label, never arbitrary caller bytes); reusing the SAME
/// underlying `chacha20poly1305` crate and construction pattern that
/// module's own internal `seal_chacha20poly1305` helper already uses,
/// without touching that frozen, shared file at all. Returns `None` on a
/// wrong-kind/placeholder/cleared key — never a panic.
pub(crate) fn seal_direct_ratchet_message_internal(
    message_key: &SecretHandle,
    header_bytes: &[u8],
    plaintext: &[u8],
) -> Option<Vec<u8>> {
    if message_key.kind() != SecretHandleKind::AeadKeyMaterial {
        return None;
    }
    let mut key_bytes = message_key.expose_bytes_for_internal_aead()?;
    let key = ChaChaKey::from(key_bytes);
    key_bytes.zeroize();
    let nonce = ChaChaNonce::from(DIRECT_RATCHET_MESSAGE_NONCE);
    let cipher = ChaCha20Poly1305::new(&key);
    cipher
        .encrypt(&nonce, ChaChaPayload { msg: plaintext, aad: header_bytes })
        .ok()
}

/// The decrypting counterpart to [`seal_direct_ratchet_message_internal`].
/// `header_bytes` MUST be byte-for-byte identical to what was supplied at
/// seal time, or authentication fails — this is what makes a tampered
/// header (or a header/ciphertext swap) indistinguishable from a tampered
/// ciphertext, both `None`, never a distinguishing oracle (Phase I: "keep
/// coarse external errors... separate"). Returns `None` on a wrong-kind
/// key OR an authentication failure — never a panic.
pub(crate) fn open_direct_ratchet_message_internal(
    message_key: &SecretHandle,
    header_bytes: &[u8],
    ciphertext: &[u8],
) -> Option<Vec<u8>> {
    if message_key.kind() != SecretHandleKind::AeadKeyMaterial {
        return None;
    }
    let mut key_bytes = message_key.expose_bytes_for_internal_aead()?;
    let key = ChaChaKey::from(key_bytes);
    key_bytes.zeroize();
    let nonce = ChaChaNonce::from(DIRECT_RATCHET_MESSAGE_NONCE);
    let cipher = ChaCha20Poly1305::new(&key);
    cipher
        .decrypt(&nonce, ChaChaPayload { msg: ciphertext, aad: header_bytes })
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root_key_handle(bytes: [u8; 32]) -> SecretHandle {
        SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::DirectRatchetRootKeyMaterial, bytes)
    }

    fn chain_key_handle(bytes: [u8; 32]) -> SecretHandle {
        SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::DirectRatchetChainKeyMaterial, bytes)
    }

    #[test]
    fn generate_direct_ratchet_keypair_produces_a_valid_on_curve_public_key() {
        let keypair = generate_direct_ratchet_keypair_internal().expect("must generate");
        assert!(validate_direct_ratchet_public_key_internal(&keypair.public).is_some());
    }

    #[test]
    fn two_generated_keypairs_are_never_identical() {
        let a = generate_direct_ratchet_keypair_internal().expect("must generate");
        let b = generate_direct_ratchet_keypair_internal().expect("must generate");
        assert_ne!(a.public, b.public);
    }

    #[test]
    fn ecdh_is_reciprocal_between_two_independent_parties() {
        let alice = generate_direct_ratchet_keypair_internal().expect("must generate");
        let bob = generate_direct_ratchet_keypair_internal().expect("must generate");
        let alice_view = direct_ratchet_ecdh_internal(&alice.private, &bob.public).expect("alice must agree");
        let bob_view = direct_ratchet_ecdh_internal(&bob.private, &alice.public).expect("bob must agree");
        assert_eq!(alice_view, bob_view);
    }

    #[test]
    fn ecdh_rejects_wrong_kind_local_private() {
        let wrong_kind = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::TestOnlySecretMaterial, [0x11; 32]);
        let bob = generate_direct_ratchet_keypair_internal().expect("must generate");
        assert!(direct_ratchet_ecdh_internal(&wrong_kind, &bob.public).is_none());
    }

    #[test]
    fn ecdh_rejects_an_invalid_remote_public_key() {
        let alice = generate_direct_ratchet_keypair_internal().expect("must generate");
        let invalid_public = [0xFFu8; 32];
        assert!(direct_ratchet_ecdh_internal(&alice.private, &invalid_public).is_none());
    }

    #[test]
    fn validate_public_key_rejects_wrong_length() {
        assert!(validate_direct_ratchet_public_key_internal(&[0u8; 31]).is_none());
        assert!(validate_direct_ratchet_public_key_internal(&[0u8; 33]).is_none());
    }

    #[test]
    fn root_kdf_is_deterministic_for_identical_inputs() {
        let root = root_key_handle([0x01; 32]);
        let dh = [0x02u8; 32];
        let context = b"session-a";
        let (root1, chain1) = direct_ratchet_root_kdf_internal(&root, &dh, context).expect("must derive");
        let (root2, chain2) = direct_ratchet_root_kdf_internal(&root, &dh, context).expect("must derive");
        assert_eq!(
            root1.expose_bytes_for_internal_ratchet_root_kdf(),
            root2.expose_bytes_for_internal_ratchet_root_kdf()
        );
        assert_eq!(
            chain1.expose_bytes_for_internal_ratchet_chain_kdf(),
            chain2.expose_bytes_for_internal_ratchet_chain_kdf()
        );
    }

    #[test]
    fn root_kdf_different_context_produces_different_output() {
        let root = root_key_handle([0x01; 32]);
        let dh = [0x02u8; 32];
        let (root_a, _) = direct_ratchet_root_kdf_internal(&root, &dh, b"session-a").expect("must derive");
        let (root_b, _) = direct_ratchet_root_kdf_internal(&root, &dh, b"session-b").expect("must derive");
        assert_ne!(
            root_a.expose_bytes_for_internal_ratchet_root_kdf(),
            root_b.expose_bytes_for_internal_ratchet_root_kdf()
        );
    }

    #[test]
    fn root_kdf_different_dh_output_produces_different_root() {
        let root = root_key_handle([0x01; 32]);
        let (root_a, _) = direct_ratchet_root_kdf_internal(&root, &[0x02; 32], b"ctx").expect("must derive");
        let (root_b, _) = direct_ratchet_root_kdf_internal(&root, &[0x03; 32], b"ctx").expect("must derive");
        assert_ne!(
            root_a.expose_bytes_for_internal_ratchet_root_kdf(),
            root_b.expose_bytes_for_internal_ratchet_root_kdf()
        );
    }

    #[test]
    fn root_kdf_output_root_and_chain_are_never_equal() {
        let root = root_key_handle([0x05; 32]);
        let (next_root, next_chain) = direct_ratchet_root_kdf_internal(&root, &[0x06; 32], b"ctx").expect("must derive");
        assert_ne!(
            next_root.expose_bytes_for_internal_ratchet_root_kdf(),
            next_chain.expose_bytes_for_internal_ratchet_chain_kdf()
        );
    }

    #[test]
    fn root_kdf_rejects_wrong_kind_current_root() {
        let wrong_kind = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::TestOnlySecretMaterial, [0x01; 32]);
        assert!(direct_ratchet_root_kdf_internal(&wrong_kind, &[0x02; 32], b"ctx").is_none());
    }

    #[test]
    fn chain_kdf_message_key_and_next_chain_key_differ() {
        let chain = chain_key_handle([0x09; 32]);
        let (message_key, next_chain) = direct_ratchet_chain_kdf_internal(&chain).expect("must derive");
        assert_ne!(
            message_key.expose_bytes_for_internal_aead(),
            next_chain.expose_bytes_for_internal_ratchet_chain_kdf()
        );
    }

    #[test]
    fn chain_kdf_is_deterministic_for_the_same_input() {
        let chain_a = chain_key_handle([0x0a; 32]);
        let chain_b = chain_key_handle([0x0a; 32]);
        let (message_a, next_a) = direct_ratchet_chain_kdf_internal(&chain_a).expect("must derive");
        let (message_b, next_b) = direct_ratchet_chain_kdf_internal(&chain_b).expect("must derive");
        assert_eq!(message_a.expose_bytes_for_internal_aead(), message_b.expose_bytes_for_internal_aead());
        assert_eq!(
            next_a.expose_bytes_for_internal_ratchet_chain_kdf(),
            next_b.expose_bytes_for_internal_ratchet_chain_kdf()
        );
    }

    #[test]
    fn chain_kdf_advances_the_chain_across_multiple_steps_without_repeating_a_message_key() {
        let mut chain = chain_key_handle([0x0b; 32]);
        let mut seen = std::collections::HashSet::new();
        for _ in 0..16 {
            let (message_key, next_chain) = direct_ratchet_chain_kdf_internal(&chain).expect("must derive");
            let bytes = message_key.expose_bytes_for_internal_aead().expect("must expose");
            assert!(seen.insert(bytes), "message key repeated across chain advance");
            chain = next_chain;
        }
    }

    #[test]
    fn chain_kdf_rejects_wrong_kind_chain_key() {
        let wrong_kind = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::TestOnlySecretMaterial, [0x01; 32]);
        assert!(direct_ratchet_chain_kdf_internal(&wrong_kind).is_none());
    }

    fn message_key_handle(bytes: [u8; 32]) -> SecretHandle {
        SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::AeadKeyMaterial, bytes)
    }

    #[test]
    fn message_seal_then_open_round_trips_the_exact_plaintext() {
        let key = message_key_handle([0x20; 32]);
        let header = b"header-bytes-v1";
        let plaintext = b"hello direct ratchet";
        let ciphertext = seal_direct_ratchet_message_internal(&key, header, plaintext).expect("must seal");
        let recovered = open_direct_ratchet_message_internal(&key, header, &ciphertext).expect("must open");
        assert_eq!(recovered, plaintext);
    }

    #[test]
    fn message_open_fails_closed_on_a_tampered_header() {
        let key = message_key_handle([0x21; 32]);
        let ciphertext = seal_direct_ratchet_message_internal(&key, b"real-header", b"secret").expect("must seal");
        assert!(open_direct_ratchet_message_internal(&key, b"tampered-header", &ciphertext).is_none());
    }

    #[test]
    fn message_open_fails_closed_on_a_tampered_ciphertext() {
        let key = message_key_handle([0x22; 32]);
        let mut ciphertext = seal_direct_ratchet_message_internal(&key, b"header", b"secret").expect("must seal");
        let last = ciphertext.len() - 1;
        ciphertext[last] ^= 0x01;
        assert!(open_direct_ratchet_message_internal(&key, b"header", &ciphertext).is_none());
    }

    #[test]
    fn message_open_fails_closed_under_the_wrong_key() {
        let key_a = message_key_handle([0x23; 32]);
        let key_b = message_key_handle([0x24; 32]);
        let ciphertext = seal_direct_ratchet_message_internal(&key_a, b"header", b"secret").expect("must seal");
        assert!(open_direct_ratchet_message_internal(&key_b, b"header", &ciphertext).is_none());
    }

    #[test]
    fn message_seal_rejects_wrong_kind_key() {
        let wrong_kind = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::TestOnlySecretMaterial, [0x01; 32]);
        assert!(seal_direct_ratchet_message_internal(&wrong_kind, b"header", b"secret").is_none());
    }

    #[test]
    fn same_plaintext_under_different_message_keys_yields_different_ciphertext() {
        let key_a = message_key_handle([0x30; 32]);
        let key_b = message_key_handle([0x31; 32]);
        let a = seal_direct_ratchet_message_internal(&key_a, b"header", b"same plaintext").expect("must seal");
        let b = seal_direct_ratchet_message_internal(&key_b, b"header", b"same plaintext").expect("must seal");
        assert_ne!(a, b);
    }

    #[test]
    fn does_not_mutate_input_handles() {
        let root = root_key_handle([0x10; 32]);
        let _ = direct_ratchet_root_kdf_internal(&root, &[0x11; 32], b"ctx");
        assert_eq!(root.kind(), SecretHandleKind::DirectRatchetRootKeyMaterial);
        assert!(!root.is_cleared());

        let chain = chain_key_handle([0x12; 32]);
        let _ = direct_ratchet_chain_kdf_internal(&chain);
        assert_eq!(chain.kind(), SecretHandleKind::DirectRatchetChainKeyMaterial);
        assert!(!chain.is_cleared());
    }
}
