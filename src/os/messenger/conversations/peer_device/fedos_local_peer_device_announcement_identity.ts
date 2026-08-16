/**
 * FedOS Peer Device Discovery Arc — durable local device identity for THIS
 * protocol specifically. Deliberately a SEPARATE, minimal, standalone file
 * rather than a new field on the already-large, interrupt-detection-driven
 * `fedos_local_profile_descriptor.ts`/`fedos_profile_initialization_coordinator.ts`
 * state machine — lower blast radius, mirrors the same "one more
 * independent local file, read-if-exists-else-generate-and-write-once"
 * pattern already used for `sealedMasterSeedFile` and this Arc's own
 * sibling additions.
 *
 * Persists ONLY non-secret values: `deviceId` (this protocol's own random,
 * opaque identifier) and `devicePublicKeyHex` (a Schnorr public key — safe
 * to persist in plaintext). The corresponding PRIVATE key is generated
 * fresh, held in-memory for this one call only, and immediately discarded
 * — mirrors the confirmed production reality (`06_PROTOCOL_CONTRACT_FREEZE.md`
 * §3's implementation-time correction) that NO durable Device private-key
 * storage exists anywhere in this codebase, and that production
 * `peer_capability` wiring never supplies a device signing keypair either
 * (grepped and confirmed empty this session). `devicePublicKeyHex` alone,
 * durably stable across restarts, is what gives this local device a
 * consistent identity to every peer it announces itself to — see
 * `fedos_peer_device_announcement_nonce.ts`'s own header on why stability
 * matters.
 *
 * `nextEpoch` (added by the Peer-Device UX entry point closure,
 * `docs/reviews/fedos-peer-device-discovery-current/10_P0_CLOSURE_COORDINATOR_FREEZE.md`
 * §4) is this local device's own strictly-monotonic, never-wall-clock
 * announcement epoch counter — `0` on first creation, advanced to
 * `sentEpoch + 1` via `recordFedosLocalPeerDeviceAnnouncementEpochSent()`
 * each time an announcement is actually sent. This bumps `schemaVersion`
 * to `2`: an old `schemaVersion: 1` file fails closed exactly like any
 * other schema-invalid file (see this module's own header above) rather
 * than being silently migrated, mirroring this file's own
 * never-silently-regenerate discipline.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { generateFedosDeviceSigningKeypair, type FedosDeviceSigningKeypair } from "../../device/crypto/fedos_device_signing_keypair.js";
import { generateFedosPeerDeviceAnnouncementDeviceId, isWellFormedFedosPeerDeviceAnnouncementDeviceId } from "./fedos_peer_device_announcement_nonce.js";

export interface FedosLocalPeerDeviceAnnouncementIdentityV1 {
  readonly schemaVersion: 2;
  readonly deviceId: string;
  readonly devicePublicKeyHex: string;
  /** Strictly-monotonic, local-only, never-wall-clock announcement epoch counter — the next epoch this local device will use the next time it actually sends an announcement. */
  readonly nextEpoch: number;
}

const DEVICE_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

function isWellFormedNextEpoch(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isWellFormed(candidate: unknown): candidate is FedosLocalPeerDeviceAnnouncementIdentityV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== 4 || !keys.includes("schemaVersion") || !keys.includes("deviceId") || !keys.includes("devicePublicKeyHex") || !keys.includes("nextEpoch")) return false;
  if (r.schemaVersion !== 2) return false;
  if (!isWellFormedFedosPeerDeviceAnnouncementDeviceId(r.deviceId)) return false;
  if (typeof r.devicePublicKeyHex !== "string" || !DEVICE_PUBLIC_KEY_HEX_PATTERN.test(r.devicePublicKeyHex)) return false;
  return isWellFormedNextEpoch(r.nextEpoch);
}

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

/**
 * Idempotent: the FIRST call for a given `filePath` generates and durably
 * writes a fresh identity; every subsequent call (including across
 * restarts) reads the SAME, already-persisted values back. Throws only on
 * a genuinely corrupt/schema-invalid file (fail-closed on corruption,
 * mirroring this codebase's own append-only persistence convention) —
 * never silently regenerates over a corrupt file, which would silently
 * change this device's own identity out from under every peer that has
 * already trusted it.
 *
 * Direct Ratchet Identity-Space Unification arc — `onFreshlyGenerated`,
 * when supplied, is invoked synchronously ONLY on the "generate fresh"
 * branch below (never on a subsequent read of an already-persisted
 * identity), with the just-generated keypair and the newly-constructed
 * identity, deliberately BEFORE the identity file is durably written. This
 * is the ONE moment this device's own private key for this identity exists
 * anywhere (it is never durably stored — see this file's own header) — the
 * callback exists so a caller can perform a real dual-signature
 * self-registration (proof-of-possession) while the key is still
 * available, without this function itself needing to know anything about
 * the Device Registry. Ordering the callback before the write is
 * deliberate crash-safety: if the callback throws (registration failed) or
 * the process dies mid-callback, the identity file is never written, so
 * the NEXT call regenerates a fresh identity and retries registration from
 * scratch — an install can therefore never end up durably identified but
 * unregistered. If the write itself then fails after a successful
 * callback, the only cost is one harmless, never-referenced-again orphan
 * Registry row for a deviceId that will never be used (the next call
 * generates a different one) — never a permanently-unregistered identity.
 * Every existing caller that omits this parameter is unaffected.
 */
export function readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(
  filePath: string,
  onFreshlyGenerated?: (keypair: FedosDeviceSigningKeypair, identity: FedosLocalPeerDeviceAnnouncementIdentityV1) => void,
): FedosLocalPeerDeviceAnnouncementIdentityV1 {
  let existingRaw: string | null;
  try {
    existingRaw = readFileSync(filePath, "utf8");
  } catch (err) {
    if (!isEnoent(err)) throw err;
    existingRaw = null;
  }
  if (existingRaw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existingRaw);
    } catch {
      throw new Error(`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity: corrupt (invalid JSON) identity file at ${filePath}.`);
    }
    if (!isWellFormed(parsed)) {
      throw new Error(`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity: schema-invalid identity file at ${filePath}.`);
    }
    return parsed;
  }

  const keypair = generateFedosDeviceSigningKeypair();
  const identity: FedosLocalPeerDeviceAnnouncementIdentityV1 = {
    schemaVersion: 2,
    deviceId: generateFedosPeerDeviceAnnouncementDeviceId(),
    devicePublicKeyHex: keypair.publicKeyHex,
    nextEpoch: 0,
  };
  onFreshlyGenerated?.(keypair, identity);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(identity), "utf8");
  return identity;
}

/**
 * Called once an announcement carrying `sentEpoch` has actually been sent
 * (never merely attempted/queued-and-abandoned) — persists `sentEpoch + 1`
 * back as the new `nextEpoch`, durably across restarts. Reads-then-writes
 * the SAME file `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`
 * manages, preserving `deviceId`/`devicePublicKeyHex` unchanged — never a
 * second, divergent identity write path. Takes `Math.max()` against
 * whatever `nextEpoch` is already on disk rather than blindly overwriting,
 * so this is safe to call even if `sentEpoch` is stale relative to a
 * concurrent/later advance — it can only ever move `nextEpoch` forward,
 * never backward (this file's own monotonic-only contract).
 *
 * Throws (fail-closed, same discipline as
 * `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`) if the file is
 * missing or schema-invalid at this point — a real send can only have
 * happened after a successful `readOrCreate...()` call already established
 * a well-formed file, so a missing/corrupt file here indicates a genuine
 * inconsistency, never a case to silently paper over.
 */
export function recordFedosLocalPeerDeviceAnnouncementEpochSent(filePath: string, sentEpoch: number): FedosLocalPeerDeviceAnnouncementIdentityV1 {
  let existingRaw: string;
  try {
    existingRaw = readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`recordFedosLocalPeerDeviceAnnouncementEpochSent: no existing identity file at ${filePath} (expected readOrCreateFedosLocalPeerDeviceAnnouncementIdentity() to have already run). ${isEnoent(err) ? "" : String(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(existingRaw);
  } catch {
    throw new Error(`recordFedosLocalPeerDeviceAnnouncementEpochSent: corrupt (invalid JSON) identity file at ${filePath}.`);
  }
  if (!isWellFormed(parsed)) {
    throw new Error(`recordFedosLocalPeerDeviceAnnouncementEpochSent: schema-invalid identity file at ${filePath}.`);
  }
  const updated: FedosLocalPeerDeviceAnnouncementIdentityV1 = { ...parsed, nextEpoch: Math.max(parsed.nextEpoch, sentEpoch + 1) };
  writeFileSync(filePath, JSON.stringify(updated), "utf8");
  return updated;
}
