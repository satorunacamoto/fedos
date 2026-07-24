# 09 — The Compromised-Old-Key Problem

## The problem, stated precisely

If the old account's Nostr private key (equivalently, its Master Seed —
`05` proves these are the same compromise event) is compromised, the
attacker holding it can produce **exactly the same signature** a
legitimate continuity claim would use. An old-key signature is therefore
evidence of "whoever holds the old key," never evidence of "the
legitimate account holder" — the two are indistinguishable from the
signature alone. **This is not a gap this review's design closes; it is
a mathematical fact about signatures with no freshness/possession
side-channel beyond the key itself**, and `3ebfa37` §10 already reached
the identical conclusion independently ("a signature from the OLD
identity proves nothing if the old identity is the thing that was
compromised").

## Consequence for every authorization model in `07`

Models A, B, D (old-key-only, dual-signature, Master-Seed-authorized) are
**equally defeated** by a compromised old key, because all three reduce
to "produce a signature with the old key" — B's "new key also signs"
requirement adds no resistance, since an attacker holding the old key can
freely generate and sign with any new key of their own choosing too.
**This is why Option B ("new Nostr key signed by the old Nostr key") is
explicitly rejected as a compromise-recovery mechanism in this review's
own `18`** — not because the signature verification would be broken, but
because the THREAT MODEL it's meant to defend against (a stolen/compromised
old key) is precisely the case where the mechanism provides zero
protection.

## What DOES help, and exactly how much

- **Device Binding evidence** (`08`) helps because the Device signing key
  is a cryptographically INDEPENDENT secret (Alpha 3161-3240; generated
  via `schnorr.utils.randomSecretKey()`, never derived from the Master
  Seed) — an attacker who compromises ONLY the Nostr private key/Master
  Seed does not thereby gain any Device's own signing key. This raises
  the bar from "attacker needs the old key" to "attacker needs the old
  key AND control of an already-trusted Device," a strictly harder
  compromise.
- It does **not** help against a compromise that reaches BOTH the Master
  Seed AND a trusted Device (e.g., a fully compromised host machine that
  held both). This review states this limitation explicitly rather than
  implying Device evidence is a complete defense.
- **Manual/out-of-band verification** is the only mechanism in `08`
  immune to every purely-cryptographic compromise, because it depends on
  a channel outside the compromised system entirely.

## The honest V1 answer

When the old identity is genuinely compromised (or believed to be),
**the correct, honest response is Replacement with NO continuity claim**
— `"unlinked-replacement"` (`07`) — because ANY continuity claim signed
by a potentially-compromised old key is worthless as proof, and a
Device-evidence-backed claim is only as strong as the assumption that the
SAME compromise didn't also reach a trusted Device. This matches
`3ebfa37`'s own "compromise response = full account migration only,
never a scheme where a possibly-compromised old key vouches for a new
one" verdict — this review reaffirms it with the added evidence-level
vocabulary (`07`) so that peers can distinguish "linked with old-key-only
evidence" (weak, treat cautiously) from "linked with Device evidence too"
(stronger, still not certain) from "no linkage claimed at all" (honest
about the compromise), rather than a single `rotationValid: true/false`
that would flatten these into one indistinguishable outcome.

## Full compromise matrix

For each state: what can be proven, what cannot, accepted recovery,
required manual warning, Ratchet consequence, remaining historical
exposure.

| State | Provable | Not provable | Accepted recovery | Manual warning required? | Ratchet consequence | Historical exposure |
|---|---|---|---|---|---|---|
| Nostr private key compromised (Master Seed intact otherwise unknown) | Attacker can sign as the old identity | Whether the legitimate owner still controls it too | Unlinked Replacement (`06`) recommended | Yes, always | All sessions reset-required (`12`) | Every past message decryptable if the attacker also copied sealed state — but sealed state is local-only, not itself leaked by a key compromise alone |
| Master Seed compromised | Same as above; also every Device-authorization signature the account ever produced could be replayed conceptually (though Device keys themselves stay independent, `08`) | Extent of attacker's access to local sealed storage | Unlinked Replacement | Yes, always | All sessions reset-required | Depends entirely on whether local encrypted-at-rest storage was ALSO exfiltrated — this review makes no claim either way |
| One Device compromised | That Device's own signing key and local session state may be exposed | Whether the account's own Nostr key is also compromised | Device Replacement (`f80889d`, unchanged) — revoke that Device only | Yes | Only that Device's sessions reset (`applyDeviceRevocationToSessions`, unchanged) | Local history on that Device may be exposed; other Devices' history is not |
| All Devices compromised | Every Device signing key is exposed | Whether the Master Seed itself is also compromised (independent question) | If Master Seed is separately confirmed safe: re-pair fresh Devices under the SAME account (no identity Replacement needed). If not confirmed safe: full Replacement | Yes | All Device-pair sessions reset | All local Device history is at risk |
| Old identity unavailable but not known compromised (e.g. lost hardware, seed simply lost) | Nothing about compromise either way | Cannot distinguish "lost" from "stolen" from the outside | Unlinked Replacement — treat identically to compromise, since the honest answer cannot distinguish the two (`09` above) | Yes | All sessions reset-required | Unaffected — old device-local history stays wherever it physically is, inaccessible to the new identity by design |
| New identity compromised during transition | Attacker controls the very identity meant to succeed the old one | Whether the transition claim itself was attacker-authored or legitimate-then-compromised | Treat as a fresh compromise of the (now current) identity — issue ANOTHER Replacement, chained via `previous-transition reference` (`17`) | Yes | New identity's own sessions reset-required in turn | Same exposure profile as any single-identity compromise, chained one link further |
| Device Registry rolled back (e.g. restored from stale backup) | The restored registry reflects an earlier, real state | Whether any Devices trusted-then-revoked in the interim are still actually compromised | The append-only Registry's own replay-and-reconcile discipline (unchanged) — a later revocation, once re-observed, is still authoritative | Yes, if a rollback is detected | None automatically — Ratchet state is independently keyed and not affected by a Registry-only rollback | No NEW exposure beyond whatever the rolled-back state already permitted before the rollback |
| Rotation/transition record copied/replayed | The record's own signature still verifies | That verifying does not mean re-accepting an ALREADY-superseded transition | Exact-nonce/sourceId replay short-circuit rejects it as a duplicate, never re-evaluated (reusing `d825aa0`'s own fixed bug pattern, `17`) | No (handled structurally) | None — a replayed, already-processed transition is a no-op | None |
| Peer offline during transition | Nothing changes for that peer until they come back online and observe the claim | Whether they will accept it once they do | The claim remains durably available (via the existing private-transport Outbox/retry, unchanged) for whenever the peer reconnects | No | That peer's own Ratchet sessions with the old identity remain in whatever state they were until the peer itself processes the transition | None beyond ordinary offline-peer latency |
| Malicious peer rejects a valid transition | The claim's own evidence level and signatures are exactly as strong regardless of peer behavior | Nothing — a peer's own local policy is theirs to set | No "recovery" is owed — the security model (`10`) explicitly permits a peer to distrust even a fully valid claim | No | The old identity's sessions with that SPECIFIC peer simply remain unreset from that peer's point of view until they change their mind | None — this is working as designed, not a defect |
| Split-brain identities (both old and new simultaneously active, different peers disagree) | Both identities are independently valid, self-authorizing entities | Which one the user actually intends as "current" from an outside observer's view | Manual verification / explicit user action; no automatic resolution (`10`, `17`) | Yes, always | Independent per-peer, per-Device Ratchet state, exactly as `12` describes | No new information exposure; only a consistency/UX problem, not a security compromise |
| Compromised account plus uncompromised trusted Device | Device evidence remains independently trustworthy (Alpha 3161-3240 key independence, `09` above) | That the Device itself is not ALSO compromised via some other vector | `"old-identity-and-device-evidence"` level (`07`) is the strongest V1 evidence for exactly this case | Yes — the strong evidence level still does not mean fully automatic trust (`10`) | All sessions reset-required regardless of evidence strength | Same as "Master Seed compromised" row above |
| Uncompromised account plus compromised Device | The account's own Nostr signature remains fully trustworthy | Whether the compromised Device leaked any locally-held plaintext/session state | Standard Device Replacement (`f80889d`) — no account-level transition needed at all | Yes, for that Device only | Only that Device's own sessions reset | Local history on that specific Device is at risk; the account identity itself is unaffected |

## What this review does not claim

- It does not claim Device-evidence-backed continuity is "safe" in an
  unqualified sense — only that it is a strictly stronger evidence level
  than old-key-signature alone, per `07`'s comparison table.
- It does not claim any mechanism can distinguish "the legitimate owner
  rotating proactively" from "an attacker who stole the old key rotating
  maliciously" using ONLY that old key's own signature — this is
  mathematically impossible and is not attempted.
- It does not invent a recovery-code or hardware-backed-secret mechanism
  as an escape hatch — none exists in this codebase (`15`), and inventing
  one is out of scope.
