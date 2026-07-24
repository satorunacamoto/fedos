/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase F/I: Persisted Device Binding Challenge Consumption.
 *
 * A durable, reconstructible replay guard for consumed
 * `FedosDeviceBindingChallengeV1.nonce` values (`../binding_challenge/fedos_device_binding_challenge.ts`).
 * Keyed by `nonce` ALONE — the challenge's own domain/action/deviceId/
 * devicePublicKeyHex are already bound into the signed content that produced
 * this nonce, so a nonce collision across two different challenges cannot
 * happen without a genuine hash/RNG break, which this file does not attempt
 * to defend against.
 *
 * One immutable fact per nonce, exactly like `fedos_persisted_device_binding_event_v1.ts`'s
 * own "registered" event: `putConsumption()` for the SAME nonce with
 * byte-identical fields is `"already-present"` (idempotent replay); with
 * DIFFERENT fields is `"conflict"` (a genuinely different attempt reusing the
 * same nonce — refused, never silently overwritten).
 *
 * No private key, Master Seed, or passphrase field exists anywhere in this
 * file. `outcomeSummary` is a short, non-sensitive vocabulary token
 * (`../binding_challenge/fedos_device_binding_registration_authority.ts`'s
 * own coarse outcome), never free text, never key material.
 */

export interface FedosPersistedDeviceBindingChallengeConsumptionV1 {
  readonly schemaVersion: 1;
  readonly nonce: string;
  readonly domain: string;
  readonly action: "register-device" | "revoke-device";
  readonly deviceId: string;
  readonly devicePublicKeyHex: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly consumedAt: number;
  /** The coarse registration/revocation outcome this consumption produced — replayed back verbatim on an idempotent duplicate. */
  readonly outcomeSummary: string;
}

/** Keyed by `nonce` alone — see this file's own header. */
export function fedosDeviceBindingChallengeConsumptionKey(record: FedosPersistedDeviceBindingChallengeConsumptionV1): string {
  return record.nonce;
}

/** Structural equality over every field — used to decide `"already-present"` vs `"conflict"` for a duplicate nonce. */
export function fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual(
  a: FedosPersistedDeviceBindingChallengeConsumptionV1,
  b: FedosPersistedDeviceBindingChallengeConsumptionV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.nonce === b.nonce &&
    a.domain === b.domain &&
    a.action === b.action &&
    a.deviceId === b.deviceId &&
    a.devicePublicKeyHex === b.devicePublicKeyHex &&
    a.accountAuthority === b.accountAuthority &&
    a.accountPublicIdentifier === b.accountPublicIdentifier &&
    a.consumedAt === b.consumedAt &&
    a.outcomeSummary === b.outcomeSummary
  );
}
