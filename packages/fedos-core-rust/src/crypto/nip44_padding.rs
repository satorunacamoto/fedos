//! Stage 202 — NIP-44 v2 plaintext padding (`docs/nip44_internal_plan.md`
//! §5): [`calc_padded_len`] (the spec's logarithmic-bucket length
//! schedule), [`pad_message`] (a 2-byte big-endian length prefix plus
//! zero-fill out to `calc_padded_len`), and [`unpad_message`] (the
//! inverse). Crate-private only — see `src/crypto.rs`'s module-level doc
//! comment for this module's place in the `crypto` tree.
//!
//! `calc_padded_len` is a pure, integer-only function — no floating
//! point (avoiding any rounding edge case at an exact power of two), no
//! allocation, and no rejection of any kind: every `usize` input maps to
//! a defined output, matching `test-vectors/nip44/nip44-v2.json`'s own
//! `valid.calc_padded_len` category, which includes an input as large as
//! 65536 — see the sibling `#[cfg(test)]`-only `nip44_padding_vectors`
//! module (Stage 203) for all 24 cases. The spec's real plaintext-length
//! bounds (1..=65535) are enforced by [`pad_message`] alone, at the one
//! point a REAL plaintext is being padded.
//!
//! **What this module is NOT**: no NIP-44 encrypt/decrypt function (see
//! `crypto::nip44_encrypt`/`crypto::nip44_decrypt`, Stage 204–205), no
//! ChaCha20/HMAC call of any kind, no public API, no Runtime/Worker/
//! Storage/Relay connection.
#![allow(dead_code)]

/// Coarse observable outcome of a [`pad_message`]/[`unpad_message`] call.
/// Crate-private only. No secret byte is exposed through this label
/// itself — plaintext is not treated as a long-lived secret by this
/// crate's own AEAD discipline either (`crypto::aead_internal`'s own
/// `AeadOpenDecision::plaintext` is likewise a plain `Vec<u8>`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PadStatus {
    /// The operation succeeded; `PadDecision::output` is `Some`.
    Ready,
    /// [`pad_message`]'s candidate plaintext was empty or longer than
    /// 65535 bytes — NIP-44 v2's own valid plaintext-length bounds
    /// (`docs/nip44_internal_plan.md` §5).
    InvalidLength,
    /// [`unpad_message`]'s candidate buffer was structurally malformed
    /// (too short to carry a length prefix, a zero declared length, or a
    /// total length that does not match `2 + calc_padded_len` of its own
    /// declared length) — never a partial or best-effort unpad.
    InvalidPadding,
}

/// The result of a [`pad_message`]/[`unpad_message`] call. Crate-private
/// only.
pub(crate) struct PadDecision {
    pub(crate) status: PadStatus,
    pub(crate) output: Option<Vec<u8>>,
}

/// NIP-44 v2's logarithmic-bucket padded-length schedule
/// (`docs/nip44_internal_plan.md` §5), verified byte-for-byte against
/// `test-vectors/nip44/nip44-v2.json`'s `valid.calc_padded_len` category
/// (24 cases, see `nip44_padding_vectors`). Pure integer bit-arithmetic
/// only; never panics for any `usize` input this crate ever calls it
/// with.
pub(crate) const fn calc_padded_len(len: usize) -> usize {
    if len <= 32 {
        return 32;
    }
    // `x` is always >= 32 here, so `x.leading_zeros()` is always well
    // inside `usize::BITS` and the shift below never overflows.
    let x = len - 1;
    let next_power: usize = 1usize << (usize::BITS - x.leading_zeros());
    let chunk: usize = if next_power <= 256 { 32 } else { next_power / 8 };
    chunk * (x / chunk + 1)
}

/// Pad `plaintext` per NIP-44 v2's wire scheme: a 2-byte big-endian length
/// prefix (the true, unpadded length) followed by `plaintext` itself,
/// zero-filled out to `calc_padded_len(plaintext.len())` total bytes.
/// Rejects an empty or over-65535-byte `plaintext` with
/// [`PadStatus::InvalidLength`] before allocating anything.
pub(crate) fn pad_message(plaintext: &[u8]) -> PadDecision {
    let len = plaintext.len();
    if len == 0 || len > 65535 {
        return PadDecision {
            status: PadStatus::InvalidLength,
            output: None,
        };
    }
    let padded_len = calc_padded_len(len);
    let mut buffer = Vec::with_capacity(2 + padded_len);
    buffer.extend_from_slice(&(len as u16).to_be_bytes());
    buffer.extend_from_slice(plaintext);
    buffer.resize(2 + padded_len, 0);
    PadDecision {
        status: PadStatus::Ready,
        output: Some(buffer),
    }
}

/// The inverse of [`pad_message`]: reads the 2-byte big-endian length
/// prefix, validates it is non-zero and that `padded`'s total length
/// matches `2 + calc_padded_len(declared_length)` EXACTLY, then returns
/// the first `declared_length` bytes following the prefix. Any structural
/// mismatch is [`PadStatus::InvalidPadding`] — never a panic (no slice
/// index is computed without a preceding length check).
pub(crate) fn unpad_message(padded: &[u8]) -> PadDecision {
    if padded.len() < 2 {
        return PadDecision {
            status: PadStatus::InvalidPadding,
            output: None,
        };
    }
    let declared_length = u16::from_be_bytes([padded[0], padded[1]]) as usize;
    if declared_length == 0 {
        return PadDecision {
            status: PadStatus::InvalidPadding,
            output: None,
        };
    }
    let expected_total = 2 + calc_padded_len(declared_length);
    if padded.len() != expected_total {
        return PadDecision {
            status: PadStatus::InvalidPadding,
            output: None,
        };
    }
    // `calc_padded_len` always rounds up to at least `declared_length`
    // (proven for every `valid.calc_padded_len` vector case), so this
    // slice is always in bounds given the exact-length check above.
    PadDecision {
        status: PadStatus::Ready,
        output: Some(padded[2..2 + declared_length].to_vec()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calc_padded_len_spot_checks_match_the_documented_schedule() {
        for (input, expected) in [
            (1usize, 32usize),
            (16, 32),
            (32, 32),
            (33, 64),
            (64, 64),
            (65, 96),
            (1020, 1024),
            (65536, 65536),
        ] {
            assert_eq!(calc_padded_len(input), expected, "calc_padded_len({input})");
        }
    }

    #[test]
    fn calc_padded_len_never_panics_across_a_wide_sweep() {
        for len in 0..70_000usize {
            let padded = calc_padded_len(len);
            assert!(padded >= 32);
        }
    }

    #[test]
    fn calc_padded_len_always_rounds_up_to_at_least_the_input_length() {
        for len in 1..=65535usize {
            assert!(calc_padded_len(len) >= len, "len={len}");
        }
    }

    const TEST_PLAINTEXT: &[u8] = b"fedos NIP-44 padding test plaintext";

    #[test]
    fn pad_then_unpad_round_trips() {
        let padded = pad_message(TEST_PLAINTEXT);
        assert_eq!(padded.status, PadStatus::Ready);
        let buffer = padded.output.expect("Ready must carry output");
        assert_eq!(buffer.len(), 2 + calc_padded_len(TEST_PLAINTEXT.len()));

        let unpadded = unpad_message(&buffer);
        assert_eq!(unpadded.status, PadStatus::Ready);
        assert_eq!(unpadded.output.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn pad_message_rejects_empty_plaintext() {
        let decision = pad_message(&[]);
        assert_eq!(decision.status, PadStatus::InvalidLength);
        assert!(decision.output.is_none());
    }

    #[test]
    fn pad_message_rejects_over_max_length_plaintext() {
        let too_long = vec![0x41u8; 65536];
        let decision = pad_message(&too_long);
        assert_eq!(decision.status, PadStatus::InvalidLength);
        assert!(decision.output.is_none());
    }

    #[test]
    fn pad_message_accepts_the_maximum_valid_length() {
        let max_length = vec![0x42u8; 65535];
        let decision = pad_message(&max_length);
        assert_eq!(decision.status, PadStatus::Ready);
    }

    #[test]
    fn unpad_message_rejects_a_buffer_too_short_for_a_length_prefix() {
        let decision = unpad_message(&[0x00]);
        assert_eq!(decision.status, PadStatus::InvalidPadding);
        assert!(decision.output.is_none());
    }

    #[test]
    fn unpad_message_rejects_a_zero_declared_length() {
        let decision = unpad_message(&[0x00, 0x00, 0x00, 0x00]);
        assert_eq!(decision.status, PadStatus::InvalidPadding);
    }

    #[test]
    fn unpad_message_rejects_a_mismatched_total_length() {
        // Declares length 1 (padded total should be 2 + 32 = 34) but the
        // buffer here is only 10 bytes long.
        let mut malformed = vec![0x00, 0x01];
        malformed.extend_from_slice(&[0u8; 8]);
        let decision = unpad_message(&malformed);
        assert_eq!(decision.status, PadStatus::InvalidPadding);
        assert!(decision.output.is_none());
    }

    #[test]
    fn unpad_message_rejects_an_empty_buffer() {
        let decision = unpad_message(&[]);
        assert_eq!(decision.status, PadStatus::InvalidPadding);
    }
}
