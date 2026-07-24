# 02 — Security Goals and Threat Model Alignment

Source: `e4bb0b0` (`docs/security_goals.md`, `docs/fedos_threat_model.md`),
`406c144` (`docs/runtime_secure_memory.md`), `d227ae4`
(`docs/crypto_runtime_architecture_v1.md`), `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`.

## Facts this review must not contradict

1. **Master-Seed-leak-uncontained.** `e4bb0b0`'s threat model states that
   compromise of the Master Seed compromises every secret derived from
   it — account identity, Nostr signing, Device signing (indirectly, via
   re-derivable authorization), and every Ratchet session's own sealed
   state. There is no compartmentalization between "the account" and
   "everything the account ever derived." Any rotation/replacement design
   must therefore treat Master-Seed compromise as **total**, not partial
   — Option E (Device-quorum-authorized rotation) cannot itself contain a
   Master-Seed compromise, because a compromised seed can re-derive every
   Device's own account-authorization signature too (see `04`).
2. **Key recovery is not data recovery.** `secure_runtime_alpha_144_recovery_threat_model_decision.md`
   (cited by `e4bb0b0`) already establishes that restoring a sealed
   Master Seed recovers the ABILITY to sign as the account, never
   retroactively re-derives session secrets that were never durably
   sealed. This review's own Archive/Ratchet-transition docs (`12`, `14`)
   depend on this: restoring an old identity's Master Seed does not, by
   itself, revive any Ratchet session — sessions are reset unconditionally
   on any identity change (`12`).
3. **No forward secrecy claim beyond the live Direct Ratchet.** `e4bb0b0`
   states plainly that a compromised derived key compromises past and
   future messages for anything NOT running the real Double Ratchet.
   Since `b8e9e06`, Direct Conversations ARE ratcheted — but Group/Sender-Key
   traffic (a separate, unmerged lineage, `41da82d`) is not. This review's
   scope is explicitly Direct-only for the same reason `3ebfa37` scoped
   its own Device-pair-session decision to Direct — Group's own identity
   model is a distinct, deferred problem (`13`).
4. **Fail-Closed is the repository's own binding convention**, restated
   throughout `e4bb0b0` and every Arc since. Every closed vocabulary this
   review defines (transition types, evidence levels, peer-acceptance
   states) must reject unknown values rather than silently coerce them —
   the SAME discipline `d825aa0`'s capability/lifecycle codecs already
   enforce, reused here rather than re-argued.
5. **Secret Buffer single-owning-scope rule** (`406c144`). A live secret
   (Master Seed, Device signing key, Ratchet root/chain key) has exactly
   one owning scope for its lifetime; it is never duplicated to prove
   possession to a second party. This is WHY Option E (multi-Device
   quorum authorization) cannot mean "share the signing key across
   Devices" — it can only mean "collect independent per-Device
   signatures," which V1 does not build (`07`).
6. **Identity was already flagged as underspecified.** `d227ae4` §10
   names the account/Nostr identity concept an `active_placeholder`/
   `unlock_trigger_placeholder` type-level gap and recommends exactly the
   forward-secrecy/rotation review chain that produced `b34d608` →
   `3ebfa37` → this review. This review is the terminal link in that
   chain for the account/Nostr layer specifically (Device/session
   rotation was already resolved by `3ebfa37`/`f80889d`).

## Alignment conclusion

Nothing in this review may claim a compromise-recovery guarantee stronger
than "produce a brand-new, unlinked identity and manually re-establish
trust" for the case where the OLD identity's own Master Seed is the thing
compromised — any design claiming otherwise (e.g., "the old key vouches
safely for the new one") directly contradicts the Master-Seed-leak-uncontained
fact. See `09` for the full analysis.
