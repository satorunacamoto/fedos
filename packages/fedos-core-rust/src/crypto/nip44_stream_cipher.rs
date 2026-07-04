//! Stage 229 — the real, byte-exact NIP-44 v2 raw ChaCha20 stream cipher
//! (RFC 8439 §2.3–2.4's block function and keystream-XOR construction),
//! hand-implemented against ONLY this crate's already-adopted
//! dependencies (no `chacha20` crate is adopted — see this module's own
//! `Cargo.toml`-independence note below). Crate-private only — see
//! `src/crypto.rs`'s module-level doc comment for this module's place in
//! the `crypto` tree.
//!
//! **This is NOT an AEAD.** NIP-44 v2's own construction (§4/§6/§7 of
//! `docs/nip44_internal_plan.md`) uses raw, UNAUTHENTICATED ChaCha20 —
//! encryption and authentication are two entirely separate steps
//! (`crypto::nip44_hmac`, Stage 231, computes the SEPARATE HMAC-SHA256
//! tag). This module NEVER calls, and is NEVER called by,
//! `crypto::aead_internal`'s ChaCha20-Poly1305 AEAD (Stage 152–154) —
//! that primitive folds encryption and authentication into ONE call;
//! this one deliberately does not, matching the real spec instead of
//! this crate's own pre-existing "FedOS internal NIP-44-like bridge"
//! (`crypto::nip44_encrypt`/`nip44_decrypt`, Stage 204–206, itself
//! UNCHANGED by this module).
//!
//! [`encrypt_stream_internal`]/[`decrypt_stream_internal`] take EXACTLY
//! `chacha_key` (32 bytes) and `chacha_nonce` (12 bytes) — the two
//! per-message values `crypto::nip44_message_keys::derive_message_keys_exact_internal`
//! (Stage 219) already derives — and nothing else. The keystream counter
//! ALWAYS starts at `0` (NIP-44 v2's own fixed convention, confirmed
//! byte-for-byte against `test-vectors/nip44/nip44-v2.json`'s
//! `valid.encrypt_decrypt` category by the sibling `#[cfg(test)]`-only
//! `nip44_stream_cipher_vectors` module, Stage 230) — never a
//! caller-supplied starting counter. ChaCha20's keystream XOR is its own
//! inverse, so `decrypt_stream_internal` performs the IDENTICAL
//! operation as `encrypt_stream_internal`; both exist as separately
//! named entry points purely for call-site clarity, not because the
//! underlying math differs.
//!
//! **Why no `chacha20` crate**: adopting one is explicitly out of scope
//! for this stage (no new `Cargo.toml` dependency is authorized). RFC
//! 8439's ChaCha20 block function is pure `u32` wrapping-arithmetic,
//! rotation, and XOR — no elliptic-curve or big-integer type is needed,
//! so it is hand-implemented directly against `core`'s own integer
//! primitives, the same "hand-write the primitive rather than adopt a
//! dependency" choice `crypto::ciphertext_serialization` (Stage 186)
//! already made for base64url encoding.
//!
//! **What this module is NOT**: no HMAC-SHA256 (see `crypto::nip44_hmac`,
//! Stage 231), no padding (see `crypto::nip44_padding`, Stage 202–203,
//! UNCHANGED), no wire payload encode/decode, no base64, no public API,
//! no Runtime/Worker/Storage/Relay/Nostr connection, no new `Cargo.toml`
//! dependency.
#![allow(dead_code)]

/// RFC 8439 §2.3's fixed constant words — the ASCII string
/// `"expand 32-byte k"` split into four little-endian `u32`s. Never
/// derived, never caller-supplied.
const CHACHA20_CONSTANTS: [u32; 4] = [0x6170_7865, 0x3320_646e, 0x7962_2d32, 0x6b20_6574];

/// One ChaCha20 quarter-round (RFC 8439 §2.1), operating in place on four
/// of `state`'s sixteen words.
#[inline]
fn quarter_round(state: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize) {
    state[a] = state[a].wrapping_add(state[b]);
    state[d] ^= state[a];
    state[d] = state[d].rotate_left(16);

    state[c] = state[c].wrapping_add(state[d]);
    state[b] ^= state[c];
    state[b] = state[b].rotate_left(12);

    state[a] = state[a].wrapping_add(state[b]);
    state[d] ^= state[a];
    state[d] = state[d].rotate_left(8);

    state[c] = state[c].wrapping_add(state[d]);
    state[b] ^= state[c];
    state[b] = state[b].rotate_left(7);
}

/// The ChaCha20 block function (RFC 8439 §2.3): ten double-rounds (four
/// "column" quarter-rounds, then four "diagonal" quarter-rounds) over the
/// fixed constants ‖ `key` ‖ `counter` ‖ `nonce` state, then the
/// original state added back word-wise (mod 2^32) — producing 64 bytes
/// of keystream. Pure integer arithmetic; never panics for any input
/// (every operation here is a wrapping/bitwise op with no failure mode).
fn chacha20_block(key: &[u8; 32], counter: u32, nonce: &[u8; 12]) -> [u8; 64] {
    let mut state = [0u32; 16];
    state[0..4].copy_from_slice(&CHACHA20_CONSTANTS);
    for i in 0..8 {
        state[4 + i] = u32::from_le_bytes([
            key[4 * i],
            key[4 * i + 1],
            key[4 * i + 2],
            key[4 * i + 3],
        ]);
    }
    state[12] = counter;
    for i in 0..3 {
        state[13 + i] = u32::from_le_bytes([
            nonce[4 * i],
            nonce[4 * i + 1],
            nonce[4 * i + 2],
            nonce[4 * i + 3],
        ]);
    }

    let initial_state = state;
    for _ in 0..10 {
        // Column rounds.
        quarter_round(&mut state, 0, 4, 8, 12);
        quarter_round(&mut state, 1, 5, 9, 13);
        quarter_round(&mut state, 2, 6, 10, 14);
        quarter_round(&mut state, 3, 7, 11, 15);
        // Diagonal rounds.
        quarter_round(&mut state, 0, 5, 10, 15);
        quarter_round(&mut state, 1, 6, 11, 12);
        quarter_round(&mut state, 2, 7, 8, 13);
        quarter_round(&mut state, 3, 4, 9, 14);
    }

    let mut output = [0u8; 64];
    for i in 0..16 {
        let word = state[i].wrapping_add(initial_state[i]);
        output[4 * i..4 * i + 4].copy_from_slice(&word.to_le_bytes());
    }
    output
}

/// XOR `data` against the ChaCha20 keystream generated from `key`/
/// `nonce`, starting the block counter at `counter_start` and
/// incrementing by one per 64-byte block — RFC 8439 §2.4's keystream
/// construction. Handles a final partial block correctly (XORs only the
/// remaining bytes, never reads or writes past `data`'s own length).
/// Never panics: no index is computed without a preceding bounds check
/// (`chunks(64)` never yields an out-of-range slice), and no arithmetic
/// here can overflow in a way `wrapping_add` does not already define.
fn chacha20_xor_internal(
    key: &[u8; 32],
    counter_start: u32,
    nonce: &[u8; 12],
    data: &[u8],
) -> Vec<u8> {
    let mut output = Vec::with_capacity(data.len());
    let mut counter = counter_start;
    for chunk in data.chunks(64) {
        let keystream = chacha20_block(key, counter, nonce);
        for (byte, ks) in chunk.iter().zip(keystream.iter()) {
            output.push(byte ^ ks);
        }
        counter = counter.wrapping_add(1);
    }
    output
}

/// Encrypt `plaintext` (expected to already be padded — see
/// `crypto::nip44_padding::pad_message`, Stage 202–203, called by the
/// caller BEFORE this function, not by this function itself) under
/// `chacha_key`/`chacha_nonce`, with the keystream counter fixed at `0`
/// — NIP-44 v2's own convention, never caller-selectable. Returns the
/// raw ChaCha20 ciphertext bytes; performs NO HMAC computation, NO
/// padding, and NO wire encoding of any kind.
pub(crate) fn encrypt_stream_internal(
    chacha_key: &[u8; 32],
    chacha_nonce: &[u8; 12],
    plaintext: &[u8],
) -> Vec<u8> {
    chacha20_xor_internal(chacha_key, 0, chacha_nonce, plaintext)
}

/// Decrypt `ciphertext` under `chacha_key`/`chacha_nonce`, with the
/// keystream counter fixed at `0` — the identical operation to
/// [`encrypt_stream_internal`] (ChaCha20's keystream XOR is its own
/// inverse), exposed as its own named entry point for call-site clarity.
/// Returns the padded plaintext bytes; the caller is responsible for
/// unpadding (`crypto::nip44_padding::unpad_message`) and for verifying
/// authenticity BEFORE calling this function (`crypto::nip44_hmac`,
/// Stage 231) — this function performs no authentication of any kind and
/// will happily "decrypt" a tampered or wrong-keyed ciphertext into
/// garbage bytes.
pub(crate) fn decrypt_stream_internal(
    chacha_key: &[u8; 32],
    chacha_nonce: &[u8; 12],
    ciphertext: &[u8],
) -> Vec<u8> {
    chacha20_xor_internal(chacha_key, 0, chacha_nonce, ciphertext)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_KEY: [u8; 32] = [0x11; 32];
    const TEST_NONCE: [u8; 12] = [0x22; 12];

    #[test]
    fn encrypt_then_decrypt_round_trips_for_a_multi_block_plaintext() {
        let plaintext = vec![0x41u8; 200]; // spans more than 3 blocks (64 bytes each)
        let ciphertext = encrypt_stream_internal(&TEST_KEY, &TEST_NONCE, &plaintext);
        assert_eq!(ciphertext.len(), plaintext.len());
        assert_ne!(ciphertext, plaintext);
        let decrypted = decrypt_stream_internal(&TEST_KEY, &TEST_NONCE, &ciphertext);
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_then_decrypt_round_trips_for_an_exact_block_boundary_plaintext() {
        let plaintext = vec![0x99u8; 64];
        let ciphertext = encrypt_stream_internal(&TEST_KEY, &TEST_NONCE, &plaintext);
        let decrypted = decrypt_stream_internal(&TEST_KEY, &TEST_NONCE, &ciphertext);
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_then_decrypt_round_trips_for_an_empty_plaintext() {
        let ciphertext = encrypt_stream_internal(&TEST_KEY, &TEST_NONCE, &[]);
        assert!(ciphertext.is_empty());
        let decrypted = decrypt_stream_internal(&TEST_KEY, &TEST_NONCE, &ciphertext);
        assert!(decrypted.is_empty());
    }

    #[test]
    fn is_deterministic_for_the_same_key_nonce_and_plaintext() {
        let plaintext = b"fedos NIP-44 wire stream cipher test plaintext";
        let first = encrypt_stream_internal(&TEST_KEY, &TEST_NONCE, plaintext);
        let second = encrypt_stream_internal(&TEST_KEY, &TEST_NONCE, plaintext);
        assert_eq!(first, second);
    }

    #[test]
    fn a_different_key_produces_different_ciphertext() {
        let plaintext = b"fedos NIP-44 wire stream cipher test plaintext";
        let first = encrypt_stream_internal(&TEST_KEY, &TEST_NONCE, plaintext);
        let other_key = [0x33u8; 32];
        let second = encrypt_stream_internal(&other_key, &TEST_NONCE, plaintext);
        assert_ne!(first, second);
    }

    #[test]
    fn a_different_nonce_produces_different_ciphertext() {
        let plaintext = b"fedos NIP-44 wire stream cipher test plaintext";
        let first = encrypt_stream_internal(&TEST_KEY, &TEST_NONCE, plaintext);
        let other_nonce = [0x44u8; 12];
        let second = encrypt_stream_internal(&TEST_KEY, &other_nonce, plaintext);
        assert_ne!(first, second);
    }

    #[test]
    fn chacha20_block_produces_exactly_sixty_four_bytes_and_is_deterministic() {
        let first = chacha20_block(&TEST_KEY, 0, &TEST_NONCE);
        let second = chacha20_block(&TEST_KEY, 0, &TEST_NONCE);
        assert_eq!(first.len(), 64);
        assert_eq!(first, second);
    }

    #[test]
    fn chacha20_block_differs_across_counter_values() {
        let block0 = chacha20_block(&TEST_KEY, 0, &TEST_NONCE);
        let block1 = chacha20_block(&TEST_KEY, 1, &TEST_NONCE);
        assert_ne!(block0, block1);
    }
}
