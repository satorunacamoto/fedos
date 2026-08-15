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
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { generateFedosDeviceSigningKeypair } from "../../device/crypto/fedos_device_signing_keypair.js";
import { generateFedosPeerDeviceAnnouncementDeviceId, isWellFormedFedosPeerDeviceAnnouncementDeviceId } from "./fedos_peer_device_announcement_nonce.js";

export interface FedosLocalPeerDeviceAnnouncementIdentityV1 {
  readonly schemaVersion: 1;
  readonly deviceId: string;
  readonly devicePublicKeyHex: string;
}

const DEVICE_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

function isWellFormed(candidate: unknown): candidate is FedosLocalPeerDeviceAnnouncementIdentityV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== 3 || !keys.includes("schemaVersion") || !keys.includes("deviceId") || !keys.includes("devicePublicKeyHex")) return false;
  if (r.schemaVersion !== 1) return false;
  if (!isWellFormedFedosPeerDeviceAnnouncementDeviceId(r.deviceId)) return false;
  return typeof r.devicePublicKeyHex === "string" && DEVICE_PUBLIC_KEY_HEX_PATTERN.test(r.devicePublicKeyHex);
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
 */
export function readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(filePath: string): FedosLocalPeerDeviceAnnouncementIdentityV1 {
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
    schemaVersion: 1,
    deviceId: generateFedosPeerDeviceAnnouncementDeviceId(),
    devicePublicKeyHex: keypair.publicKeyHex,
  };
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(identity), "utf8");
  return identity;
}
