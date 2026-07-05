//! Stage 242 — an INTERNAL-ONLY, LABEL-ONLY skeleton for a FUTURE public
//! NIP-44 wire opaque API. Crate-private only — see `src/crypto.rs`'s
//! module-level doc comment for this module's place in the `crypto`
//! tree, and `docs/public_nip44_wire_api.md` (Stage 241) for the full
//! planning document this skeleton's vocabulary follows.
//!
//! **This module adds NO public API.** Every item here is `pub(crate)`.
//! Nothing in this file is reachable from outside this crate. This
//! mirrors `crypto::nip44_wire`'s own Stage 209–213 precedent exactly:
//! fix the LABEL VOCABULARY a future implementation would use, before
//! writing any real behavior behind it.
//!
//! - [`Nip44OpaqueConversation`] names what a future opaque conversation
//!   HANDLE would wrap — WITHOUT wrapping anything real yet. It carries
//!   no `ConversationKey`, no `SecretHandle`, no key byte of any kind.
//! - [`Nip44OpaquePayload`] names what a future opaque wire-payload
//!   HANDLE would wrap — WITHOUT wrapping anything real yet. It carries
//!   no `Nip44WirePayload`, no ciphertext byte, no MAC byte, no nonce
//!   byte, and no payload string.
//! - [`Nip44OpaqueStatus`] names the coarse outcome such a future API
//!   would report — today ALWAYS `Unimplemented`, mirroring
//!   `Nip44WireStatus`'s own "one variant today" shape.
//! - [`Nip44OpaqueDecision`] is a LABEL-ONLY decision pairing a status
//!   with nothing else — no payload, no handle, no byte of any kind.
//!
//! **What this module is NOT**: no real conversation derivation, no real
//! encrypt/decrypt call, no wrapping of `crypto::conversation_key::ConversationKey`/
//! `crypto::message_key::MessageKey`/`crate::secret_handle::SecretHandle`/
//! `crypto::nip44_wire_payload::Nip44WirePayload` (all UNCHANGED and
//! untouched by this module), no public API, no Runtime/Worker/Storage/
//! Relay/Nostr connection, no new `Cargo.toml` dependency, no WASM/FFI.
#![allow(dead_code)]

/// A LABEL-ONLY placeholder naming what a future public opaque
/// conversation HANDLE would wrap. Holds nothing — no `ConversationKey`,
/// no `SecretHandle`, no key byte. Crate-private only; never part of
/// this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44OpaqueConversation;

/// A LABEL-ONLY placeholder naming what a future public opaque
/// wire-payload HANDLE would wrap. Holds nothing — no
/// `Nip44WirePayload`, no ciphertext/MAC/nonce byte, no payload string.
/// Crate-private only; never part of this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44OpaquePayload;

/// Coarse observable status of a [`Nip44OpaqueDecision`] — mirrors
/// `Nip44WireStatus`'s "one variant today" shape
/// (`crypto::nip44_wire`). This skeleton produces ONLY `Unimplemented` —
/// there is no real public opaque API anywhere in this crate yet. A
/// future stage that actually implements one (see
/// `docs/public_nip44_wire_api.md`) would add a `Ready`-style variant as
/// its own reviewed change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44OpaqueStatus {
    Unimplemented,
}

/// A LABEL-ONLY decision naming the coarse outcome a future public
/// opaque NIP-44 wire API would report — WITHOUT holding, carrying, or
/// referencing any actual conversation handle, wire payload handle,
/// ciphertext byte, key byte, or plaintext byte of any kind, and without
/// running any encrypt/decrypt/derive operation of any kind. Crate-private
/// only; not part of this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44OpaqueDecision {
    pub(crate) status: Nip44OpaqueStatus,
}

impl Nip44OpaqueDecision {
    /// Construct a placeholder decision. `status` is always
    /// `Unimplemented` — no real public opaque API exists yet. Takes no
    /// handle, byte, or key parameter of any kind — there is nothing
    /// here for this constructor to accept.
    pub(crate) fn new_placeholder() -> Self {
        Self {
            status: Nip44OpaqueStatus::Unimplemented,
        }
    }

    pub(crate) fn status(&self) -> Nip44OpaqueStatus {
        self.status
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_placeholder_always_reports_unimplemented() {
        let decision = Nip44OpaqueDecision::new_placeholder();
        assert_eq!(decision.status(), Nip44OpaqueStatus::Unimplemented);
    }

    #[test]
    fn nip44_opaque_status_has_no_variant_other_than_unimplemented() {
        let status = Nip44OpaqueStatus::Unimplemented;
        match status {
            Nip44OpaqueStatus::Unimplemented => {}
        }
    }

    #[test]
    fn nip44_opaque_conversation_and_payload_are_zero_sized_labels() {
        // A structural guard: these placeholders hold nothing today —
        // if a future stage adds a real field, this test's size
        // assertion (not the type's usability) is the first thing that
        // should force a deliberate review of that change.
        assert_eq!(std::mem::size_of::<Nip44OpaqueConversation>(), 0);
        assert_eq!(std::mem::size_of::<Nip44OpaquePayload>(), 0);
    }

    #[test]
    fn nip44_opaque_conversation_is_constructible_and_comparable() {
        let a = Nip44OpaqueConversation;
        let b = Nip44OpaqueConversation;
        assert_eq!(a, b);
    }

    #[test]
    fn nip44_opaque_payload_is_constructible_and_comparable() {
        let a = Nip44OpaquePayload;
        let b = Nip44OpaquePayload;
        assert_eq!(a, b);
    }
}
