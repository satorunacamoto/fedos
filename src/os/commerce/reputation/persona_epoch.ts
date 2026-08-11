/**
 * Reputation / Persona Epoch design arc — `PersonaEpoch` type + validity
 * scaffolding.
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING. Nothing in this file is wired into
 * `createCommerce()` (`../create_commerce.ts`) or any composition root — it
 * carries the same "inert scaffolding" status every other file under
 * `src/os/commerce/` declares (see `../README.md`).
 *
 * WHY A "PERSONA EPOCH" AT ALL, AND WHY IT MUST NOT BE A MESSAGING KEY
 * ----------------------------------------------------------------------
 * A `PersonaEpoch` is a bounded-lifetime reputation identity: one key that a
 * counterparty can attest trades against for a while, then retire and
 * replace, without that replacement being forced to carry every earlier
 * epoch's history forward automatically (see `carry_over.ts` for the
 * OPTIONAL, explicit bridge between epochs). This is a distinct concern
 * from:
 *
 *   - The Nostr identity keypair a Messenger Account uses (`src/os/messenger/
 *     ...` / `docs/architecture/ACTOR-MAP.md` §1's "KEY MATERIAL OWNED: Nostr
 *     identity keypair"). That key names a *person's ongoing conversations*;
 *     reusing it as a reputation key would make every past/future trade
 *     attestation trivially linkable to the user's entire messaging history
 *     the instant one attestation and one conversation are ever correlated.
 *   - Double Ratchet session key material. This repo's own prior review
 *     record is explicit that Double Ratchet exists ONLY to provide
 *     per-conversation forward secrecy for private messaging, and must never
 *     be reused for reputation/persona aging (a separate, non-transport
 *     concern with a completely different lifecycle: an epoch is meant to be
 *     occasionally *reused across many trades*, exactly the opposite of a
 *     ratchet step's one-message-then-rotate design).
 *
 * `epochKeyPublicHex` below is therefore a KEY MATERIAL SLOT for a THIRD,
 * independent keypair — not a re-export or derivation of either of the
 * above. This file does not itself generate that keypair (key custody is a
 * later-wave decision, see `docs/commerce/REPUTATION-PERSONA-EPOCH-DESIGN.md`
 * §"Where does the epoch key come from"), but the precedent to follow when
 * that generator is built already exists twice in this repo, at the exact
 * same call shape:
 *
 *   - `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`
 *     (`FedosDeviceSigningKeypair.generate()`) — its own header records an
 *     explicit option comparison: "Option A: independent random Device key
 *     via reviewed CSPRNG — ADOPTED... Option B: deterministic Device key
 *     derived from the Master Seed — REJECTED... a Master-Seed-derived
 *     'device' key is not independent (compromise or export of one derives
 *     the other)."
 *   - `src/os/trust/envelope/fedos_trust_signing_keypair.ts`
 *     (`FedosTrustSigningKeypair.generate()`) — same `@noble/curves`
 *     `schnorr.utils.randomSecretKey()` call, deliberately duplicated rather
 *     than imported from the Messenger file above because `os/trust` must
 *     not depend on `os/messenger` (see that file's own header).
 *
 * A future `PersonaEpochSigningKeypair.generate()` should follow the exact
 * same shape: a fresh, independent, CSPRNG-random secp256k1 keypair, NEVER
 * derived from the Master Seed, the Nostr identity key, or any Double
 * Ratchet chain key — an opaque handle (private field, no raw-secret
 * getter), matching this repo's `AeadKeyHandle`/`SecretHandle` discipline.
 * This file only reserves the hex-string SLOT (`epochKeyPublicHex`) that
 * generator's public key would fill.
 *
 * `epochKeyPublicHex`'s wire format mirrors the existing
 * `^[0-9a-f]{64}$` convention both files above already use for a
 * secp256k1/Schnorr public key hex — see `isWellFormedPersonaEpochKeyPublicHex`
 * below, which duplicates (not imports) that same regex for the same
 * "no cross-domain import" reason `fedos_trust_signing_keypair.ts`'s header
 * gives.
 */

/** Same secp256k1/Schnorr public-key-hex shape this repo's other signing
 * keypairs already use (`fedos_device_signing_keypair.ts`,
 * `fedos_trust_signing_keypair.ts`) — duplicated here, not imported, because
 * `src/os/commerce` must not depend on `src/os/messenger` (see
 * `test/architecture_boundary_commerce.test.ts`) and this file deliberately
 * avoids depending on `src/os/trust` too (see
 * `trust_issuance_port.ts`'s header for why). */
const PERSONA_EPOCH_KEY_PUBLIC_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Bounded, opaque id shape — hex only, deliberately short-to-moderate so a
 * persona epoch id can be displayed/logged/embedded in a QR payload without
 * itself becoming an oversized-input vector (mirrors
 * `FEDOS_TRUST_MAX_FIELD_STRING_LENGTH`'s spirit from
 * `src/os/trust/fedos_trust_limits.ts`, restated locally rather than
 * imported for the same boundary reason noted above). */
const PERSONA_EPOCH_ID_PATTERN = /^[0-9a-f]{16,64}$/;

/** Local, non-negative-integer Unix-seconds guard — duplicated in spirit
 * from every other domain-boundary "well-formed" checker in this repo
 * (e.g. `src/os/trust/entitlement/fedos_trust_subscription_entitlement_types.ts`'s
 * `isWellFormedFedosSubscriptionEntitlement`); kept local on purpose. */
function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * A bounded-lifetime reputation identity. NOT a messaging identity, NOT
 * Double Ratchet material — see this file's header for why those two are
 * explicitly excluded.
 */
export interface PersonaEpoch {
  /** Opaque, hex-encoded epoch identifier. Not a public key itself (that is
   * `epochKeyPublicHex` below) — a separate id so an epoch can be referenced
   * (e.g. from a `TradeCompletionAttestation`, see `attestation_types.ts`)
   * without repeating the full key hex everywhere. */
  readonly epochId: string;
  /** Public half of this epoch's OWN independent signing keypair — see this
   * file's header for why this must never be the Nostr identity key or any
   * Double Ratchet key. Hex-encoded secp256k1/Schnorr public key, matching
   * this repo's existing convention. */
  readonly epochKeyPublicHex: string;
  /** Unix seconds. Start of this epoch's validity window. */
  readonly validFrom: number;
  /** Unix seconds. End of this epoch's validity window — strictly greater
   * than `validFrom`. An epoch does not auto-renew; a new epoch (a new
   * `PersonaEpoch` with a new `epochId`/`epochKeyPublicHex`) is a distinct
   * object, optionally linked to this one only via `carry_over.ts`'s
   * carry-over statement, never by silently extending this window. */
  readonly validUntil: number;
  /** OPTIONAL reference to the immediately preceding epoch this one
   * succeeds, if any. This field alone carries NO cryptographic weight — it
   * is a caller-supplied hint only. A real continuity claim requires the
   * signed `EpochCarryOverStatement` defined in `carry_over.ts`; this field
   * exists so a UI can render "epoch 3 of persona X" without needing to
   * fetch/verify that carry-over statement just to draw a label. */
  readonly predecessorEpochId?: string;
}

/** Default clock-skew tolerance applied by `isPersonaEpochCurrentlyValid`
 * when no explicit tolerance is supplied — matches
 * `FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS` in
 * `src/os/trust/fedos_trust_limits.ts` (120 seconds), restated locally for
 * the same "no cross-domain import" reason given above. Kept in sync
 * manually; if Trust's constant ever changes, a design review should decide
 * whether this one should too rather than the two silently drifting apart
 * unnoticed. */
export const PERSONA_EPOCH_DEFAULT_CLOCK_SKEW_TOLERANCE_SECONDS = 120;

export function isWellFormedPersonaEpochId(value: unknown): value is string {
  return typeof value === "string" && PERSONA_EPOCH_ID_PATTERN.test(value);
}

export function isWellFormedPersonaEpochKeyPublicHex(value: unknown): value is string {
  return typeof value === "string" && PERSONA_EPOCH_KEY_PUBLIC_HEX_PATTERN.test(value);
}

/**
 * Structural well-formedness only (shape, not signature — a `PersonaEpoch`
 * on its own carries no signature; it is the SUBJECT a
 * `TradeCompletionAttestation` or `EpochCarryOverStatement` signs over, see
 * `attestation_types.ts` / `carry_over.ts`). Fails closed to `false` on any
 * malformed input; never throws.
 */
export function isWellFormedPersonaEpoch(value: unknown): value is PersonaEpoch {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!isWellFormedPersonaEpochId(candidate.epochId)) return false;
  if (!isWellFormedPersonaEpochKeyPublicHex(candidate.epochKeyPublicHex)) return false;
  if (!isUnixSecondsInteger(candidate.validFrom)) return false;
  if (!isUnixSecondsInteger(candidate.validUntil)) return false;
  if ((candidate.validUntil as number) <= (candidate.validFrom as number)) return false;
  if (candidate.predecessorEpochId !== undefined && !isWellFormedPersonaEpochId(candidate.predecessorEpochId)) {
    return false;
  }
  return true;
}

/**
 * True iff `epoch` is both well-formed AND currently within its validity
 * window at `atTimeUnixSeconds`, allowing `clockSkewToleranceSeconds` of
 * slack on both edges (mirrors the tolerance-application pattern
 * `src/os/trust/entitlement/fedos_trust_subscription_entitlement_verify.ts`
 * uses for `validFrom`/`validUntil`, restated locally). Fails closed to
 * `false` on any malformed input; never throws.
 */
export function isPersonaEpochCurrentlyValid(
  epoch: unknown,
  atTimeUnixSeconds: number,
  clockSkewToleranceSeconds: number = PERSONA_EPOCH_DEFAULT_CLOCK_SKEW_TOLERANCE_SECONDS,
): boolean {
  if (!isWellFormedPersonaEpoch(epoch)) return false;
  if (!isUnixSecondsInteger(atTimeUnixSeconds)) return false;
  if (!Number.isInteger(clockSkewToleranceSeconds) || clockSkewToleranceSeconds < 0) return false;

  if (atTimeUnixSeconds + clockSkewToleranceSeconds < epoch.validFrom) return false;
  if (atTimeUnixSeconds - clockSkewToleranceSeconds > epoch.validUntil) return false;
  return true;
}
