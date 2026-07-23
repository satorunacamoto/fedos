//! Secure Runtime Alpha 5481-5560 — the Direct Double Ratchet session state
//! machine: ties `direct_ratchet`'s pure KDF/DH/AEAD primitives and
//! `direct_ratchet_header`'s wire format together into the standard
//! Double-Ratchet algorithm (DH ratchet on direction switch, per-message
//! chain advance, bounded skipped-key derivation).
//!
//! Crate-private only. Every fallible step is computed into LOCAL
//! variables before any `self` field is mutated — a failure at any point
//! (malformed header, invalid key, skip-limit exceeded, or the final AEAD
//! authentication itself) leaves `self` byte-for-byte unchanged (Phase K:
//! atomic state transition, never a partial advance).

use super::direct_ratchet::{
    direct_ratchet_chain_kdf_internal, direct_ratchet_ecdh_internal, generate_direct_ratchet_keypair_internal,
    open_direct_ratchet_message_internal, seal_direct_ratchet_message_internal, validate_direct_ratchet_public_key_internal,
    DirectRatchetKeypair,
};
use super::direct_ratchet_header::{decode_direct_ratchet_header, encode_direct_ratchet_header, DirectRatchetHeaderFields};
use crate::secret_handle::{SecretHandle, SecretHandleKind};
use zeroize::Zeroize;

/// Review-sourced bound (`11_out_of_order_and_skipped_keys.md` §2): 1000
/// max skipped keys. Applied here as a SESSION-WIDE total (not per
/// sub-chain-generation), a conservative, stricter interpretation that
/// still satisfies "a bound of SOME kind is binding" without risking two
/// counters silently disagreeing across DH ratchet steps.
pub(crate) const MAX_SKIPPED_KEYS: usize = 1000;
/// Same bound also governs the maximum chain gap in one operation (review's
/// own deliberate choice, reused here identically).
pub(crate) const MAX_CHAIN_GAP: usize = 1000;
/// 14-day retention window in milliseconds (review §2).
pub(crate) const SKIPPED_KEY_RETENTION_MS: i64 = 14 * 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DirectRatchetDecryptRejection {
    MalformedHeader,
    UnknownSuite,
    WrongSession,
    InvalidRemotePublicKey,
    SkipLimitExceeded,
    ExcessiveChainGap,
    DuplicateOrReplay,
    AuthenticationFailed,
    InternalFailure,
}

pub(crate) struct DirectRatchetSkippedEntry {
    pub(crate) remote_ratchet_public: [u8; 32],
    pub(crate) counter: u32,
    pub(crate) message_key: SecretHandle,
    pub(crate) created_at_ms: i64,
}

/// One in-memory skipped-key store entry, keyed by (remote ratchet public
/// key at time of derivation, chain counter) — necessary because a DH
/// ratchet step changes which remote public key a given counter belongs
/// to; the SAME numeric counter under two different remote keys is two
/// different, independent chain positions.
struct StoredSkippedKey {
    message_key: SecretHandle,
    created_at_ms: i64,
}

pub(crate) struct DirectRatchetSessionState {
    pub(crate) session_id: String,
    pub(crate) local_device_ref: String,
    pub(crate) generation: u32,
    root_key: SecretHandle,
    sending_chain_key: Option<SecretHandle>,
    receiving_chain_key: Option<SecretHandle>,
    local_keypair: DirectRatchetKeypair,
    remote_ratchet_public: Option<[u8; 32]>,
    send_counter: u32,
    receive_counter: u32,
    previous_sending_chain_length: u32,
    skipped_keys: std::collections::HashMap<([u8; 32], u32), StoredSkippedKey>,
}

fn derivation_context_bytes(session_id: &str, generation: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(session_id.len() + 8);
    out.extend_from_slice(&(session_id.len() as u32).to_be_bytes());
    out.extend_from_slice(session_id.as_bytes());
    out.extend_from_slice(&generation.to_be_bytes());
    out
}

/// Derives message keys for chain positions `starting_counter..=target_counter`
/// (`starting_chain` is AT `starting_counter`). Returns skipped entries for
/// every position strictly before `target_counter`, the message key AT
/// `target_counter` (consumed immediately, never stored as skipped), and
/// the chain key ready for `target_counter + 1`. `None` on an inverted
/// range, an over-budget derivation count, or any internal KDF failure.
fn derive_chain_through_target(
    starting_chain: &SecretHandle,
    starting_counter: u32,
    target_counter: u32,
    max_derivations: usize,
) -> Option<(Vec<(u32, SecretHandle)>, SecretHandle, SecretHandle)> {
    if target_counter < starting_counter {
        return None;
    }
    let count = (target_counter - starting_counter) as usize + 1;
    if count > max_derivations {
        return None;
    }
    let mut skipped = Vec::with_capacity(count.saturating_sub(1));
    let mut counter = starting_counter;
    let (mut message_key, mut next_chain) = direct_ratchet_chain_kdf_internal(starting_chain)?;
    loop {
        if counter == target_counter {
            return Some((skipped, message_key, next_chain));
        }
        skipped.push((counter, message_key));
        counter += 1;
        let (mk, nc) = direct_ratchet_chain_kdf_internal(&next_chain)?;
        message_key = mk;
        next_chain = nc;
    }
}

/// Advances `starting_chain` from `starting_counter` up to (but not
/// including) `up_to_exclusive`, returning every derived key as a skipped
/// entry (none consumed) — used to drain the remainder of an OLD receiving
/// chain before a DH ratchet step abandons it.
fn skip_remaining_chain(
    starting_chain: &SecretHandle,
    starting_counter: u32,
    up_to_exclusive: u32,
    max_derivations: usize,
) -> Option<Vec<(u32, SecretHandle)>> {
    if up_to_exclusive < starting_counter {
        return None;
    }
    let count = (up_to_exclusive - starting_counter) as usize;
    if count > max_derivations {
        return None;
    }
    if count == 0 {
        return Some(Vec::new());
    }
    let mut skipped = Vec::with_capacity(count);
    let mut counter = starting_counter;
    let (message_key, mut next_chain) = direct_ratchet_chain_kdf_internal(starting_chain)?;
    skipped.push((counter, message_key));
    counter += 1;
    while counter < up_to_exclusive {
        let (mk, nc) = direct_ratchet_chain_kdf_internal(&next_chain)?;
        skipped.push((counter, mk));
        next_chain = nc;
        counter += 1;
    }
    Some(skipped)
}

impl DirectRatchetSessionState {
    /// Bob's role (review `08_dh_session_ratchet.md` §4): generates a
    /// fresh local keypair immediately; derives NO chain yet (waits for the
    /// peer's first message, whose header carries their new ratchet public
    /// key and triggers the first DH ratchet step inside `decrypt()`).
    /// `bootstrap_root_secret` seeds the root key — the review's own
    /// recommendation to reuse the EXISTING `resolveConversationKey()`
    /// output for exactly this purpose (never a fresh/random root seed).
    pub(crate) fn initialize_as_receiver(
        session_id: String,
        local_device_ref: String,
        generation: u32,
        bootstrap_root_secret: [u8; 32],
    ) -> Option<Self> {
        let local_keypair = generate_direct_ratchet_keypair_internal()?;
        let root_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::DirectRatchetRootKeyMaterial,
            bootstrap_root_secret,
        );
        Some(Self {
            session_id,
            local_device_ref,
            generation,
            root_key,
            sending_chain_key: None,
            receiving_chain_key: None,
            local_keypair,
            remote_ratchet_public: None,
            send_counter: 0,
            receive_counter: 0,
            previous_sending_chain_length: 0,
            skipped_keys: std::collections::HashMap::new(),
        })
    }

    /// Alice's role: already knows the peer's initial ratchet public key
    /// (shared out-of-band — this Arc names no signaling mechanism of its
    /// own; a future integration Arc's own job), so the FIRST DH ratchet
    /// step completes immediately and this session can encrypt right away.
    pub(crate) fn initialize_as_sender(
        session_id: String,
        local_device_ref: String,
        generation: u32,
        bootstrap_root_secret: [u8; 32],
        remote_ratchet_public: [u8; 32],
    ) -> Option<Self> {
        let validated_remote = validate_direct_ratchet_public_key_internal(&remote_ratchet_public)?;
        let local_keypair = generate_direct_ratchet_keypair_internal()?;
        let root_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::DirectRatchetRootKeyMaterial,
            bootstrap_root_secret,
        );
        let dh = direct_ratchet_ecdh_internal(&local_keypair.private, &validated_remote)?;
        let context = derivation_context_bytes(&session_id, generation);
        let (next_root, sending_chain) =
            super::direct_ratchet::direct_ratchet_root_kdf_internal(&root_key, &dh, &context)?;
        Some(Self {
            session_id,
            local_device_ref,
            generation,
            root_key: next_root,
            sending_chain_key: Some(sending_chain),
            receiving_chain_key: None,
            local_keypair,
            remote_ratchet_public: Some(validated_remote),
            send_counter: 0,
            receive_counter: 0,
            previous_sending_chain_length: 0,
            skipped_keys: std::collections::HashMap::new(),
        })
    }

    pub(crate) fn local_ratchet_public_key(&self) -> [u8; 32] {
        self.local_keypair.public
    }

    pub(crate) fn is_ready_to_send(&self) -> bool {
        self.sending_chain_key.is_some()
    }

    /// Encrypts `plaintext`. Requires an already-established sending chain
    /// (from `initialize_as_sender`, or from a prior `decrypt()`'s own
    /// direction-switch DH step) — `None` if not yet ready to send, or if
    /// `send_counter` is already at its maximum (overflow rejection, never
    /// a wrapping reuse). Advances `send_counter` and the sending chain
    /// ATOMICALLY with a successful seal — a sealing failure (unreachable
    /// in practice, matched exhaustively) leaves state unchanged.
    pub(crate) fn encrypt(&mut self, plaintext: &[u8]) -> Option<(Vec<u8>, Vec<u8>)> {
        if self.send_counter == u32::MAX {
            return None;
        }
        let sending_chain = self.sending_chain_key.as_ref()?;
        let (message_key, next_chain) = direct_ratchet_chain_kdf_internal(sending_chain)?;
        let header_fields = DirectRatchetHeaderFields {
            session_id: self.session_id.clone(),
            sender_device_ref: self.local_device_ref.clone(),
            ratchet_public_key: self.local_keypair.public,
            message_number: self.send_counter,
            previous_chain_length: self.previous_sending_chain_length,
            generation: self.generation,
        };
        let header_bytes = encode_direct_ratchet_header(&header_fields)?;
        let ciphertext = seal_direct_ratchet_message_internal(&message_key, &header_bytes, plaintext)?;

        // Commit atomically -- only now that sealing has genuinely succeeded.
        self.sending_chain_key = Some(next_chain);
        self.send_counter += 1;
        Some((header_bytes, ciphertext))
    }

    /// Decrypts a message. Every fallible step (header parse, suite/session/
    /// generation match, public-key validation, skip-budget check, DH
    /// ratchet computation, chain derivation, and the final AEAD
    /// authentication) is computed into local variables FIRST — `self` is
    /// mutated in exactly one place, at the very end, ONLY after
    /// authentication has genuinely succeeded. Any rejection leaves `self`
    /// byte-for-byte unchanged, including a tampered ciphertext/header
    /// (never a partial "we already advanced the chain" state).
    pub(crate) fn decrypt(
        &mut self,
        header_bytes: &[u8],
        ciphertext: &[u8],
        now_ms: i64,
    ) -> Result<Vec<u8>, DirectRatchetDecryptRejection> {
        let header = decode_direct_ratchet_header(header_bytes).ok_or(DirectRatchetDecryptRejection::MalformedHeader)?;
        if header.session_id != self.session_id || header.generation != self.generation {
            return Err(DirectRatchetDecryptRejection::WrongSession);
        }
        let incoming_remote_public = validate_direct_ratchet_public_key_internal(&header.ratchet_public_key)
            .ok_or(DirectRatchetDecryptRejection::InvalidRemotePublicKey)?;

        let needs_dh_step = self.remote_ratchet_public != Some(incoming_remote_public);
        let existing_skipped_count = self.skipped_keys.len();
        let mut budget_used = 0usize;

        // Phase 1: if the remote ratchet key changed, drain the remainder
        // of the OLD receiving chain (if any) up to header.previous_chain_length,
        // then compute the new root/receiving/sending state via a fresh DH
        // ratchet step. All PURELY computed here -- nothing committed yet.
        let mut old_chain_drained: Vec<(u32, SecretHandle)> = Vec::new();
        let mut old_remote_public_for_drain: Option<[u8; 32]> = None;
        let mut new_root: Option<SecretHandle> = None;
        let mut new_receiving_chain: Option<SecretHandle> = None;
        let mut new_sending_chain: Option<SecretHandle> = None;
        let mut new_local_keypair: Option<DirectRatchetKeypair> = None;
        let mut new_previous_sending_chain_length: Option<u32> = None;

        if needs_dh_step {
            if let Some(old_chain) = self.receiving_chain_key.as_ref() {
                if header.previous_chain_length < self.receive_counter {
                    return Err(DirectRatchetDecryptRejection::MalformedHeader);
                }
                let gap = (header.previous_chain_length - self.receive_counter) as usize;
                if existing_skipped_count + budget_used + gap > MAX_SKIPPED_KEYS || gap > MAX_CHAIN_GAP {
                    return Err(DirectRatchetDecryptRejection::SkipLimitExceeded);
                }
                let drained = skip_remaining_chain(old_chain, self.receive_counter, header.previous_chain_length, gap + 1)
                    .ok_or(DirectRatchetDecryptRejection::InternalFailure)?;
                budget_used += drained.len();
                old_remote_public_for_drain = self.remote_ratchet_public;
                old_chain_drained = drained;
            }

            let context = derivation_context_bytes(&self.session_id, self.generation);
            let dh1 = direct_ratchet_ecdh_internal(&self.local_keypair.private, &incoming_remote_public)
                .ok_or(DirectRatchetDecryptRejection::InternalFailure)?;
            let (root_after_receive, receiving_chain) =
                super::direct_ratchet::direct_ratchet_root_kdf_internal(&self.root_key, &dh1, &context)
                    .ok_or(DirectRatchetDecryptRejection::InternalFailure)?;
            let fresh_keypair =
                generate_direct_ratchet_keypair_internal().ok_or(DirectRatchetDecryptRejection::InternalFailure)?;
            let dh2 = direct_ratchet_ecdh_internal(&fresh_keypair.private, &incoming_remote_public)
                .ok_or(DirectRatchetDecryptRejection::InternalFailure)?;
            let (root_after_send, sending_chain) =
                super::direct_ratchet::direct_ratchet_root_kdf_internal(&root_after_receive, &dh2, &context)
                    .ok_or(DirectRatchetDecryptRejection::InternalFailure)?;

            new_previous_sending_chain_length = Some(self.send_counter);
            new_root = Some(root_after_send);
            new_receiving_chain = Some(receiving_chain);
            new_sending_chain = Some(sending_chain);
            new_local_keypair = Some(fresh_keypair);
        }

        // Phase 2: locate/derive the target message key at header.message_number.
        let effective_receive_counter = if needs_dh_step { 0 } else { self.receive_counter };
        let effective_remote_public = incoming_remote_public;

        let (target_message_key_owned, target_message_key_borrowed, mut newly_skipped, next_chain_after_target);
        if header.message_number < effective_receive_counter {
            // Strictly behind the current frontier: must already be a stored skipped key.
            let key = (effective_remote_public, header.message_number);
            let stored = self.skipped_keys.get(&key).ok_or(DirectRatchetDecryptRejection::DuplicateOrReplay)?;
            if now_ms - stored.created_at_ms > SKIPPED_KEY_RETENTION_MS {
                return Err(DirectRatchetDecryptRejection::DuplicateOrReplay);
            }
            target_message_key_borrowed = Some(key);
            target_message_key_owned = None;
            newly_skipped = Vec::new();
            next_chain_after_target = None;
        } else {
            let starting_chain = if needs_dh_step {
                new_receiving_chain.as_ref().expect("computed above")
            } else {
                self.receiving_chain_key.as_ref().ok_or(DirectRatchetDecryptRejection::InternalFailure)?
            };
            let remaining_gap = (header.message_number - effective_receive_counter) as usize + 1;
            if existing_skipped_count + budget_used + remaining_gap.saturating_sub(1) > MAX_SKIPPED_KEYS
                || remaining_gap > MAX_CHAIN_GAP
            {
                return Err(DirectRatchetDecryptRejection::ExcessiveChainGap);
            }
            let (skipped, message_key, next_chain) = derive_chain_through_target(
                starting_chain,
                effective_receive_counter,
                header.message_number,
                remaining_gap,
            )
            .ok_or(DirectRatchetDecryptRejection::InternalFailure)?;
            newly_skipped = skipped;
            target_message_key_owned = Some(message_key);
            target_message_key_borrowed = None;
            next_chain_after_target = Some(next_chain);
        }

        // Phase 3: attempt authentication -- the ONLY point that can still fail from here.
        let key_ref: &SecretHandle = if let Some(owned) = &target_message_key_owned {
            owned
        } else {
            let (public, counter) = target_message_key_borrowed.expect("one branch always sets this");
            &self
                .skipped_keys
                .get(&(public, counter))
                .expect("looked up above")
                .message_key
        };
        let plaintext = open_direct_ratchet_message_internal(key_ref, header_bytes, ciphertext)
            .ok_or(DirectRatchetDecryptRejection::AuthenticationFailed)?;

        // Phase 4: commit EVERYTHING atomically -- authentication genuinely succeeded.
        if let Some(root) = new_root {
            self.root_key = root;
        }
        if let Some(chain) = new_sending_chain {
            self.sending_chain_key = Some(chain);
        }
        if let Some(len) = new_previous_sending_chain_length {
            self.previous_sending_chain_length = len;
            self.send_counter = 0;
        }
        if let Some(keypair) = new_local_keypair {
            self.local_keypair = keypair;
        }
        if needs_dh_step {
            self.remote_ratchet_public = Some(incoming_remote_public);
        }

        if let Some(old_public) = old_remote_public_for_drain {
            for (counter, message_key) in old_chain_drained {
                self.skipped_keys
                    .insert((old_public, counter), StoredSkippedKey { message_key, created_at_ms: now_ms });
            }
        }

        if target_message_key_owned.is_some() {
            for (counter, message_key) in newly_skipped.drain(..) {
                self.skipped_keys
                    .insert((effective_remote_public, counter), StoredSkippedKey { message_key, created_at_ms: now_ms });
            }
            self.receiving_chain_key = next_chain_after_target;
            self.receive_counter = header.message_number + 1;
        } else {
            // Consumed a stored skipped key -- one-time use, remove it now.
            let key = target_message_key_borrowed.expect("checked above");
            self.skipped_keys.remove(&key);
        }

        self.evict_expired_skipped_keys(now_ms);
        Ok(plaintext)
    }

    fn evict_expired_skipped_keys(&mut self, now_ms: i64) {
        self.skipped_keys.retain(|_, stored| now_ms - stored.created_at_ms <= SKIPPED_KEY_RETENTION_MS);
    }

    pub(crate) fn skipped_key_count(&self) -> usize {
        self.skipped_keys.len()
    }

    // -- Phase L: sealed-persistence integration --------------------------
    //
    // Deliberately per-secret-kind, matching the Foundation Arc's OWN
    // existing `FedosSealedDirectRatchetSecretRecordV1` granularity exactly
    // (`root-key` / `sending-chain-key` / `receiving-chain-key` /
    // `local-ratchet-private-key` / `skipped-message-key`) -- no new bundle
    // format is invented. Each accessor exposes ONLY the bytes needed for
    // the caller (the `FedosDirectRatchetSession` wasm wrapper in `lib.rs`)
    // to call the EXISTING, unmodified
    // `FedosMasterSeedAuthority::seal_direct_ratchet_secret` internally --
    // raw bytes never leave that one Rust-to-Rust boundary crossing.

    pub(crate) fn root_key_bytes_for_sealing(&self) -> Option<[u8; 32]> {
        self.root_key.expose_bytes_for_internal_ratchet_state_sealing()
    }

    pub(crate) fn sending_chain_key_bytes_for_sealing(&self) -> Option<[u8; 32]> {
        self.sending_chain_key.as_ref()?.expose_bytes_for_internal_ratchet_state_sealing()
    }

    pub(crate) fn receiving_chain_key_bytes_for_sealing(&self) -> Option<[u8; 32]> {
        self.receiving_chain_key.as_ref()?.expose_bytes_for_internal_ratchet_state_sealing()
    }

    pub(crate) fn local_ratchet_private_key_bytes_for_sealing(&self) -> Option<[u8; 32]> {
        self.local_keypair.private.expose_bytes_for_internal_ratchet_state_sealing()
    }

    /// `(remote_ratchet_public, counter, created_at_ms, key_bytes)` for
    /// every currently-held skipped key -- the caller seals each one
    /// independently as its own `"skipped-message-key"` sealed record.
    pub(crate) fn skipped_keys_for_sealing(&self) -> Vec<([u8; 32], u32, i64, [u8; 32])> {
        self.skipped_keys
            .iter()
            .filter_map(|((public, counter), stored)| {
                stored
                    .message_key
                    .expose_bytes_for_internal_ratchet_state_sealing()
                    .map(|bytes| (*public, *counter, stored.created_at_ms, bytes))
            })
            .collect()
    }

    pub(crate) fn remote_ratchet_public_key(&self) -> Option<[u8; 32]> {
        self.remote_ratchet_public
    }

    pub(crate) fn send_counter(&self) -> u32 {
        self.send_counter
    }

    pub(crate) fn receive_counter(&self) -> u32 {
        self.receive_counter
    }

    pub(crate) fn previous_sending_chain_length(&self) -> u32 {
        self.previous_sending_chain_length
    }

    /// Restores a complete session from its previously-sealed constituent
    /// parts (already unsealed to raw bytes by the caller, via the
    /// EXISTING, unmodified `FedosMasterSeedAuthority::restore_direct_ratchet_secret`
    /// -- this function performs NO unsealing itself, only reconstruction).
    /// The local ratchet PUBLIC key is always recomputed deterministically
    /// from the restored private key (never taken as separate, unverified
    /// input) -- `None` if the private-key bytes are not a valid secp256k1
    /// scalar (corruption). Every plaintext field is the caller's own
    /// already-validated public session metadata (Foundation Arc's own
    /// `FedosDirectRatchetSessionRecordV1`).
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn restore(
        session_id: String,
        local_device_ref: String,
        generation: u32,
        send_counter: u32,
        receive_counter: u32,
        previous_sending_chain_length: u32,
        remote_ratchet_public: Option<[u8; 32]>,
        mut root_key_bytes: [u8; 32],
        mut sending_chain_key_bytes: Option<[u8; 32]>,
        mut receiving_chain_key_bytes: Option<[u8; 32]>,
        mut local_ratchet_private_key_bytes: [u8; 32],
        skipped_keys: Vec<([u8; 32], u32, i64, [u8; 32])>,
    ) -> Option<Self> {
        let local_private = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::DirectRatchetPrivateKeyMaterial,
            local_ratchet_private_key_bytes,
        );
        local_ratchet_private_key_bytes.zeroize();
        let local_public = super::direct_ratchet::derive_direct_ratchet_public_from_private_internal(&local_private)?;
        let root_key =
            SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::DirectRatchetRootKeyMaterial, root_key_bytes);
        root_key_bytes.zeroize();
        let sending_chain_key = sending_chain_key_bytes.take().map(|mut bytes| {
            let handle = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::DirectRatchetChainKeyMaterial, bytes);
            bytes.zeroize();
            handle
        });
        let receiving_chain_key = receiving_chain_key_bytes.take().map(|mut bytes| {
            let handle = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::DirectRatchetChainKeyMaterial, bytes);
            bytes.zeroize();
            handle
        });
        let mut skipped_map = std::collections::HashMap::new();
        for (public, counter, created_at_ms, mut bytes) in skipped_keys {
            let message_key = SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::AeadKeyMaterial, bytes);
            bytes.zeroize();
            skipped_map.insert((public, counter), StoredSkippedKey { message_key, created_at_ms });
        }

        Some(Self {
            session_id,
            local_device_ref,
            generation,
            root_key,
            sending_chain_key,
            receiving_chain_key,
            local_keypair: DirectRatchetKeypair { private: local_private, public: local_public },
            remote_ratchet_public,
            send_counter,
            receive_counter,
            previous_sending_chain_length,
            skipped_keys: skipped_map,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BOOTSTRAP_SECRET: [u8; 32] = [0x77; 32];

    fn make_pair() -> (DirectRatchetSessionState, DirectRatchetSessionState) {
        let bob = DirectRatchetSessionState::initialize_as_receiver(
            "session-1".to_string(),
            "bob-device".to_string(),
            0,
            BOOTSTRAP_SECRET,
        )
        .expect("bob must init");
        let alice = DirectRatchetSessionState::initialize_as_sender(
            "session-1".to_string(),
            "alice-device".to_string(),
            0,
            BOOTSTRAP_SECRET,
            bob.local_ratchet_public_key(),
        )
        .expect("alice must init");
        (alice, bob)
    }

    #[test]
    fn alice_can_encrypt_immediately_after_sender_init() {
        let (mut alice, _bob) = make_pair();
        assert!(alice.is_ready_to_send());
        let result = alice.encrypt(b"hello");
        assert!(result.is_some());
    }

    #[test]
    fn bob_cannot_encrypt_before_receiving_anything() {
        let (_alice, mut bob) = make_pair();
        assert!(!bob.is_ready_to_send());
        assert!(bob.encrypt(b"hello").is_none());
    }

    #[test]
    fn bob_decrypts_alices_first_message_exactly() {
        let (mut alice, mut bob) = make_pair();
        let (header, ciphertext) = alice.encrypt(b"hello bob").expect("must encrypt");
        let plaintext = bob.decrypt(&header, &ciphertext, 1000).expect("must decrypt");
        assert_eq!(plaintext, b"hello bob");
    }

    #[test]
    fn bob_can_reply_after_receiving_alices_first_message() {
        let (mut alice, mut bob) = make_pair();
        let (header1, ct1) = alice.encrypt(b"hi").expect("must encrypt");
        bob.decrypt(&header1, &ct1, 1000).expect("must decrypt");
        assert!(bob.is_ready_to_send());
        let (header2, ct2) = bob.encrypt(b"hi back").expect("must encrypt");
        let plaintext = alice.decrypt(&header2, &ct2, 1000).expect("must decrypt");
        assert_eq!(plaintext, b"hi back");
    }

    #[test]
    fn multiple_sequential_messages_in_order() {
        let (mut alice, mut bob) = make_pair();
        for i in 0..5u32 {
            let msg = format!("message {i}");
            let (header, ct) = alice.encrypt(msg.as_bytes()).expect("must encrypt");
            let plaintext = bob.decrypt(&header, &ct, 1000).expect("must decrypt");
            assert_eq!(plaintext, msg.as_bytes());
        }
    }

    #[test]
    fn out_of_order_delivery_via_skipped_keys() {
        let (mut alice, mut bob) = make_pair();
        let (h0, c0) = alice.encrypt(b"msg0").expect("enc");
        let (h1, c1) = alice.encrypt(b"msg1").expect("enc");
        let (h2, c2) = alice.encrypt(b"msg2").expect("enc");

        // Bob receives message 2 first.
        let p2 = bob.decrypt(&h2, &c2, 1000).expect("must decrypt msg2");
        assert_eq!(p2, b"msg2");
        assert_eq!(bob.skipped_key_count(), 2); // msg0, msg1 skipped

        // Bob later receives message 0.
        let p0 = bob.decrypt(&h0, &c0, 1000).expect("must decrypt msg0");
        assert_eq!(p0, b"msg0");
        assert_eq!(bob.skipped_key_count(), 1);

        // Then message 1.
        let p1 = bob.decrypt(&h1, &c1, 1000).expect("must decrypt msg1");
        assert_eq!(p1, b"msg1");
        assert_eq!(bob.skipped_key_count(), 0);
    }

    #[test]
    fn duplicate_message_is_rejected() {
        let (mut alice, mut bob) = make_pair();
        let (h0, c0) = alice.encrypt(b"msg0").expect("enc");
        bob.decrypt(&h0, &c0, 1000).expect("must decrypt once");
        let result = bob.decrypt(&h0, &c0, 1000);
        assert_eq!(result, Err(DirectRatchetDecryptRejection::DuplicateOrReplay));
    }

    #[test]
    fn duplicate_out_of_order_message_is_rejected_after_first_consumption() {
        let (mut alice, mut bob) = make_pair();
        let (h0, c0) = alice.encrypt(b"msg0").expect("enc");
        let (h1, c1) = alice.encrypt(b"msg1").expect("enc");
        bob.decrypt(&h1, &c1, 1000).expect("must decrypt msg1 first");
        bob.decrypt(&h0, &c0, 1000).expect("must decrypt msg0 via skipped key");
        let replay = bob.decrypt(&h0, &c0, 1000);
        assert_eq!(replay, Err(DirectRatchetDecryptRejection::DuplicateOrReplay));
    }

    #[test]
    fn tampered_ciphertext_is_rejected_and_state_is_unchanged() {
        let (mut alice, mut bob) = make_pair();
        let (header, mut ciphertext) = alice.encrypt(b"secret").expect("enc");
        let last = ciphertext.len() - 1;
        ciphertext[last] ^= 0x01;
        let before_counter = bob.receive_counter;
        let result = bob.decrypt(&header, &ciphertext, 1000);
        assert_eq!(result, Err(DirectRatchetDecryptRejection::AuthenticationFailed));
        assert_eq!(bob.receive_counter, before_counter);
        assert_eq!(bob.skipped_key_count(), 0);
    }

    #[test]
    fn tampered_header_is_rejected() {
        let (mut alice, mut bob) = make_pair();
        let (mut header, ciphertext) = alice.encrypt(b"secret").expect("enc");
        let last = header.len() - 1;
        header[last] ^= 0x01;
        // A bit-flip in the trailing generation field is still a well-formed
        // decode (same length), so this exercises AEAD tamper rejection via
        // the header-as-AAD binding, not header parsing itself.
        let result = bob.decrypt(&header, &ciphertext, 1000);
        assert!(result.is_err());
    }

    #[test]
    fn wrong_session_is_rejected() {
        let (mut alice, _bob) = make_pair();
        let mut other_bob = DirectRatchetSessionState::initialize_as_receiver(
            "session-DIFFERENT".to_string(),
            "bob-device".to_string(),
            0,
            BOOTSTRAP_SECRET,
        )
        .expect("must init");
        let (header, ciphertext) = alice.encrypt(b"secret").expect("enc");
        let result = other_bob.decrypt(&header, &ciphertext, 1000);
        assert_eq!(result, Err(DirectRatchetDecryptRejection::WrongSession));
    }

    #[test]
    fn real_dh_ratchet_transition_across_a_direction_switch() {
        let (mut alice, mut bob) = make_pair();
        let (h0, c0) = alice.encrypt(b"first").expect("enc");
        bob.decrypt(&h0, &c0, 1000).expect("decrypt");
        let alice_public_before = alice.local_ratchet_public_key();

        // Bob replies -- this triggers a NEW DH ratchet step inside alice's decrypt.
        let (h1, c1) = bob.encrypt(b"reply").expect("enc");
        alice.decrypt(&h1, &c1, 1000).expect("decrypt");

        // Alice must now be ready to send again (new sending chain from the DH step).
        assert!(alice.is_ready_to_send());
        let (h2, c2) = alice.encrypt(b"after ratchet").expect("enc");
        let alice_public_after = alice.local_ratchet_public_key();
        assert_ne!(alice_public_before, alice_public_after, "local ratchet key must rotate on direction switch");
        let plaintext = bob.decrypt(&h2, &c2, 1000).expect("bob must decrypt post-ratchet message");
        assert_eq!(plaintext, b"after ratchet");
    }

    #[test]
    fn old_local_private_key_is_discarded_after_dh_ratchet_step() {
        let (mut alice, mut bob) = make_pair();
        let bob_public_before = bob.local_ratchet_public_key();
        let (h0, c0) = alice.encrypt(b"first").expect("enc");
        bob.decrypt(&h0, &c0, 1000).expect("decrypt");
        // Bob's decrypt() of Alice's FIRST message triggers Bob's own DH
        // ratchet step atomically (standard Double Ratchet behavior: a
        // received message under a NEW remote ratchet key rotates the
        // receiver's own local keypair too, in the SAME step, so the
        // receiver is immediately ready to reply) -- Bob's public key
        // MUST change here, proving the old private key was discarded
        // (post-compromise security) rather than reused.
        assert_ne!(bob.local_ratchet_public_key(), bob_public_before);
    }

    #[test]
    fn excessive_gap_is_rejected() {
        let (mut alice, mut bob) = make_pair();
        // Encrypt far more messages than the max chain gap allows, then
        // attempt to decrypt only the last one.
        let mut last = None;
        for i in 0..=(MAX_CHAIN_GAP as u32 + 5) {
            last = Some(alice.encrypt(format!("m{i}").as_bytes()).expect("enc"));
        }
        let (header, ciphertext) = last.expect("must have encrypted at least one");
        let result = bob.decrypt(&header, &ciphertext, 1000);
        assert_eq!(result, Err(DirectRatchetDecryptRejection::ExcessiveChainGap));
    }

    #[test]
    fn skipped_key_expiry_rejects_a_late_arrival() {
        let (mut alice, mut bob) = make_pair();
        let (h0, c0) = alice.encrypt(b"msg0").expect("enc");
        let (h1, c1) = alice.encrypt(b"msg1").expect("enc");
        bob.decrypt(&h1, &c1, 1000).expect("decrypt msg1 first, skipping msg0");
        assert_eq!(bob.skipped_key_count(), 1);

        let far_future = 1000 + SKIPPED_KEY_RETENTION_MS + 1;
        let result = bob.decrypt(&h0, &c0, far_future);
        assert_eq!(result, Err(DirectRatchetDecryptRejection::DuplicateOrReplay));
    }

    #[test]
    fn malformed_header_is_rejected() {
        let (mut _alice, mut bob) = make_pair();
        let result = bob.decrypt(b"not a real header", b"ciphertext", 1000);
        assert_eq!(result, Err(DirectRatchetDecryptRejection::MalformedHeader));
    }

    #[test]
    fn restore_reconstructs_a_session_that_can_continue_the_conversation() {
        let (mut alice, mut bob) = make_pair();
        let (h0, c0) = alice.encrypt(b"before restart").expect("enc");
        bob.decrypt(&h0, &c0, 1000).expect("decrypt");

        // Extract every raw field exactly as the sealing integration would.
        let root_bytes = bob.root_key_bytes_for_sealing().expect("root");
        let sending_bytes = bob.sending_chain_key_bytes_for_sealing();
        let receiving_bytes = bob.receiving_chain_key_bytes_for_sealing();
        let private_bytes = bob.local_ratchet_private_key_bytes_for_sealing().expect("private");
        let skipped = bob.skipped_keys_for_sealing();

        let mut restored_bob = DirectRatchetSessionState::restore(
            bob.session_id.clone(),
            bob.local_device_ref.clone(),
            bob.generation,
            bob.send_counter(),
            bob.receive_counter(),
            bob.previous_sending_chain_length(),
            bob.remote_ratchet_public_key(),
            root_bytes,
            sending_bytes,
            receiving_bytes,
            private_bytes,
            skipped,
        )
        .expect("must restore");

        assert_eq!(restored_bob.local_ratchet_public_key(), bob.local_ratchet_public_key());

        // The conversation continues seamlessly from the restored session.
        let (h1, c1) = restored_bob.encrypt(b"after restart").expect("must encrypt from restored session");
        let plaintext = alice.decrypt(&h1, &c1, 2000).expect("alice must decrypt post-restart message");
        assert_eq!(plaintext, b"after restart");
    }

    #[test]
    fn restore_preserves_skipped_keys_so_a_late_out_of_order_message_still_decrypts() {
        let (mut alice, mut bob) = make_pair();
        let (h0, c0) = alice.encrypt(b"msg0").expect("enc");
        let (h1, c1) = alice.encrypt(b"msg1").expect("enc");
        bob.decrypt(&h1, &c1, 1000).expect("decrypt msg1 first");
        assert_eq!(bob.skipped_key_count(), 1);

        let root_bytes = bob.root_key_bytes_for_sealing().expect("root");
        let sending_bytes = bob.sending_chain_key_bytes_for_sealing();
        let receiving_bytes = bob.receiving_chain_key_bytes_for_sealing();
        let private_bytes = bob.local_ratchet_private_key_bytes_for_sealing().expect("private");
        let skipped = bob.skipped_keys_for_sealing();

        let mut restored_bob = DirectRatchetSessionState::restore(
            bob.session_id.clone(),
            bob.local_device_ref.clone(),
            bob.generation,
            bob.send_counter(),
            bob.receive_counter(),
            bob.previous_sending_chain_length(),
            bob.remote_ratchet_public_key(),
            root_bytes,
            sending_bytes,
            receiving_bytes,
            private_bytes,
            skipped,
        )
        .expect("must restore");

        assert_eq!(restored_bob.skipped_key_count(), 1);
        let plaintext = restored_bob.decrypt(&h0, &c0, 1500).expect("must decrypt msg0 via restored skipped key");
        assert_eq!(plaintext, b"msg0");
    }

    #[test]
    fn invalid_remote_public_key_in_header_is_rejected() {
        let (mut alice, mut bob) = make_pair();
        let (mut header, ciphertext) = alice.encrypt(b"secret").expect("enc");
        // Overwrite the 32-byte ratchet public key region with an invalid,
        // clearly-off-curve pattern (header layout: 1 + 4 + suite_len + 4 + session_id + 4 + device_ref, then 32 bytes of public key).
        let pubkey_start = header.len() - 32 - 12;
        for b in header[pubkey_start..pubkey_start + 32].iter_mut() {
            *b = 0xFF;
        }
        let result = bob.decrypt(&header, &ciphertext, 1000);
        assert_eq!(result, Err(DirectRatchetDecryptRejection::InvalidRemotePublicKey));
    }
}
