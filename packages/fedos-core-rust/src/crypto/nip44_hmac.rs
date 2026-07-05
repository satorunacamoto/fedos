//! Stage 231 — the real NIP-44 v2 HMAC-SHA256 authentication step
//! (`docs/nip44_internal_plan.md` §7: "HMAC-SHA256 authenticates `nonce
//! ‖ ciphertext`, keyed by the per-message `hmac_key`"), hand-implemented
//! (RFC 2104's generic HMAC construction) against ONLY this crate's
//! already-adopted `sha2` dependency (Stage 152) — no `hmac` crate is
//! adopted. Crate-private only — see `src/crypto.rs`'s module-level doc
//! comment for this module's place in the `crypto` tree.
//!
//! **Why no `hmac` crate**: adopting one is explicitly out of scope for
//! this stage (no new `Cargo.toml` dependency is authorized). RFC 2104's
//! construction is a fixed, mechanical composition of TWO `SHA-256`
//! calls over an XOR-padded key — no new primitive is needed beyond the
//! `sha2::Sha256` hasher this crate already depends on, so it is
//! hand-implemented directly, the same "hand-write the construction
//! rather than adopt a dependency" choice `crypto::nip44_stream_cipher`
//! (Stage 229) already made for ChaCha20.
//!
//! [`compute_hmac_internal`]/[`verify_hmac_internal`] take EXACTLY
//! `hmac_key` (32 bytes — one of `crypto::nip44_message_keys::derive_message_keys_exact_internal`'s
//! three derived values, Stage 219) and authenticate EXACTLY `nonce ‖
//! ciphertext` — never the plaintext, never a caller-chosen message
//! shape, never a caller-chosen key length. [`verify_hmac_internal`]
//! returns ONLY [`Nip44HmacVerifyStatus::Verified`] or
//! [`Nip44HmacVerifyStatus::AuthenticationFailed`] — no distinct label
//! for "wrong key" vs. "tampered ciphertext" vs. anything else, mirroring
//! `crypto::nip44_decrypt::Nip44DecryptStatus::AuthenticationFailed`'s
//! own "one label, never distinguishing why" discipline
//! (`docs/nip44_internal_plan.md` §7's own explicit requirement).
//! Comparison uses `subtle::ConstantTimeEq` — this crate's OWN
//! `subtle` dependency, adopted Stage 76 specifically "for a future
//! secret-derived byte comparison (e.g. an authentication tag)" (see
//! `Cargo.toml`'s own comment) and, as of this stage, finally connected
//! to that exact purpose — never a hand-rolled, timing-variable `==`.
//!
//! **What this module is NOT**: no ChaCha20 stream cipher (see
//! `crypto::nip44_stream_cipher`, Stage 229), no padding, no wire
//! payload encode/decode, no base64, no public API, no Runtime/Worker/
//! Storage/Relay/Nostr connection, no new `Cargo.toml` dependency.
#![allow(dead_code)]

use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

/// SHA-256's own block size (RFC 2104's `B` parameter) — 64 bytes. A
/// fixed constant, never derived or caller-supplied.
const HMAC_SHA256_BLOCK_SIZE: usize = 64;
const HMAC_IPAD_BYTE: u8 = 0x36;
const HMAC_OPAD_BYTE: u8 = 0x5c;

/// Generic RFC 2104 HMAC-SHA256, private to this module. `key` may be any
/// length (hashed down to 32 bytes first if longer than the 64-byte
/// block size, per RFC 2104's own key-preparation rule) — but this
/// module's own `pub(crate)` entry points below only ever call it with
/// the fixed 32-byte `hmac_key`.
fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    let mut key_block = [0u8; HMAC_SHA256_BLOCK_SIZE];
    if key.len() > HMAC_SHA256_BLOCK_SIZE {
        let hashed = Sha256::digest(key);
        key_block[..32].copy_from_slice(&hashed);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }

    let mut ipad = [0u8; HMAC_SHA256_BLOCK_SIZE];
    let mut opad = [0u8; HMAC_SHA256_BLOCK_SIZE];
    for i in 0..HMAC_SHA256_BLOCK_SIZE {
        ipad[i] = key_block[i] ^ HMAC_IPAD_BYTE;
        opad[i] = key_block[i] ^ HMAC_OPAD_BYTE;
    }

    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(message);
    let inner_digest = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_digest);
    let outer_digest = outer.finalize();

    let mut result = [0u8; 32];
    result.copy_from_slice(&outer_digest);
    result
}

/// Coarse observable outcome of a [`verify_hmac_internal`] call —
/// exactly two variants, never a more detailed reason. Crate-private
/// only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44HmacVerifyStatus {
    /// The candidate `mac` matched the recomputed tag exactly.
    Verified,
    /// The candidate `mac` did not match — the SINGLE fixed label
    /// covering every possible cause (wrong `hmac_key`, wrong `nonce`,
    /// tampered `ciphertext`, or a `mac` that is simply wrong) — never a
    /// distinct reason per cause, per
    /// `docs/nip44_internal_plan.md` §7's own requirement.
    AuthenticationFailed,
}

/// Compute the NIP-44 v2 authentication tag: `HMAC-SHA256(hmac_key,
/// nonce ‖ ciphertext)` — `docs/nip44_internal_plan.md` §7's exact
/// construction. Authenticates `nonce ‖ ciphertext`, NEVER the plaintext
/// directly. Infallible for any input (SHA-256 has no failure mode at
/// any message length reachable here), so this returns a plain `[u8;
/// 32]`, not a `Status`/`Decision` pair.
pub(crate) fn compute_hmac_internal(
    hmac_key: &[u8; 32],
    nonce: &[u8; 32],
    ciphertext: &[u8],
) -> [u8; 32] {
    let mut message = Vec::with_capacity(32 + ciphertext.len());
    message.extend_from_slice(nonce);
    message.extend_from_slice(ciphertext);
    hmac_sha256(hmac_key, &message)
}

/// Verify a candidate `mac` against the tag [`compute_hmac_internal`]
/// would produce for the same `hmac_key`/`nonce`/`ciphertext`, using a
/// CONSTANT-TIME comparison (`subtle::ConstantTimeEq`) — never a
/// hand-rolled `==`, which would leak timing information about how many
/// leading bytes matched. Returns ONLY
/// [`Nip44HmacVerifyStatus::Verified`] or
/// [`Nip44HmacVerifyStatus::AuthenticationFailed`] — see this module's
/// own doc comment above for why no more detailed reason is ever
/// returned.
pub(crate) fn verify_hmac_internal(
    hmac_key: &[u8; 32],
    nonce: &[u8; 32],
    ciphertext: &[u8],
    mac: &[u8; 32],
) -> Nip44HmacVerifyStatus {
    let computed = compute_hmac_internal(hmac_key, nonce, ciphertext);
    if bool::from(computed.ct_eq(mac)) {
        Nip44HmacVerifyStatus::Verified
    } else {
        Nip44HmacVerifyStatus::AuthenticationFailed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_HMAC_KEY: [u8; 32] = [0x55; 32];
    const TEST_NONCE: [u8; 32] = [0x66; 32];

    #[test]
    fn compute_hmac_internal_is_deterministic() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext";
        let first = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        let second = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        assert_eq!(first, second);
    }

    #[test]
    fn compute_hmac_internal_differs_for_a_different_key() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext";
        let first = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        let other_key = [0x77u8; 32];
        let second = compute_hmac_internal(&other_key, &TEST_NONCE, ciphertext);
        assert_ne!(first, second);
    }

    #[test]
    fn compute_hmac_internal_differs_for_a_different_nonce() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext";
        let first = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        let other_nonce = [0x88u8; 32];
        let second = compute_hmac_internal(&TEST_HMAC_KEY, &other_nonce, ciphertext);
        assert_ne!(first, second);
    }

    #[test]
    fn compute_hmac_internal_differs_for_a_different_ciphertext() {
        let first = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, b"ciphertext one");
        let second = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, b"ciphertext two!");
        assert_ne!(first, second);
    }

    #[test]
    fn verify_hmac_internal_accepts_the_matching_mac() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext";
        let mac = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        let status = verify_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext, &mac);
        assert_eq!(status, Nip44HmacVerifyStatus::Verified);
    }

    #[test]
    fn verify_hmac_internal_rejects_a_wrong_key() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext";
        let mac = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        let wrong_key = [0x99u8; 32];
        let status = verify_hmac_internal(&wrong_key, &TEST_NONCE, ciphertext, &mac);
        assert_eq!(status, Nip44HmacVerifyStatus::AuthenticationFailed);
    }

    #[test]
    fn verify_hmac_internal_rejects_a_wrong_nonce() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext";
        let mac = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        let wrong_nonce = [0xaau8; 32];
        let status = verify_hmac_internal(&TEST_HMAC_KEY, &wrong_nonce, ciphertext, &mac);
        assert_eq!(status, Nip44HmacVerifyStatus::AuthenticationFailed);
    }

    #[test]
    fn verify_hmac_internal_rejects_a_tampered_ciphertext() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext".to_vec();
        let mac = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, &ciphertext);
        let mut tampered = ciphertext.clone();
        tampered[0] ^= 0xFF;
        let status = verify_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, &tampered, &mac);
        assert_eq!(status, Nip44HmacVerifyStatus::AuthenticationFailed);
    }

    #[test]
    fn verify_hmac_internal_rejects_a_tampered_mac() {
        let ciphertext = b"fedos NIP-44 wire hmac test ciphertext";
        let mut mac = compute_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext);
        mac[0] ^= 0xFF;
        let status = verify_hmac_internal(&TEST_HMAC_KEY, &TEST_NONCE, ciphertext, &mac);
        assert_eq!(status, Nip44HmacVerifyStatus::AuthenticationFailed);
    }

    #[test]
    fn nip44_hmac_verify_status_has_no_variant_other_than_the_two_specified() {
        for status in [
            Nip44HmacVerifyStatus::Verified,
            Nip44HmacVerifyStatus::AuthenticationFailed,
        ] {
            match status {
                Nip44HmacVerifyStatus::Verified => {}
                Nip44HmacVerifyStatus::AuthenticationFailed => {}
            }
        }
    }
}
