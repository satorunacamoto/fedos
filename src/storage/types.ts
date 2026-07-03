/**
 * Stage 107 — Storage backend boundary (types only).
 *
 * A MINIMAL, future-facing seam for pluggable storage backends, so the
 * Python v8.6 host's Google Drive coupling can eventually be replaced by a
 * real backend (a Nostr relay, local SQLite, a local mesh, IPFS, or an
 * external service) selected behind this same interface — without the rest
 * of the app depending on any concrete backend. This file defines shapes
 * ONLY — it performs no real storage, no network call, no file IO, and
 * connects to no cryptography.
 *
 * HARD GUARDRAILS (see the design notes):
 *   - NO Google Drive API, NO Nostr relay connection, NO SQLite, NO
 *     Bluetooth/Wi-Fi mesh, NO IPFS gateway, and NO network fetch of any
 *     kind is performed by anything in this boundary.
 *   - Packets carry OPAQUE, non-secret labels ONLY — never raw bytes, a
 *     plaintext/ciphertext body, or free-form content. `idRef` is an
 *     opaque label a real backend would resolve on its own side; it is
 *     never a file path or URL.
 *   - Decisions carry NO stored bytes: nothing is persisted because
 *     nothing runs.
 *   - This boundary makes NO durability, availability, or security
 *     guarantee. Do not describe it as "safe", "complete", or
 *     "synced".
 */

/** Which future backend a packet/ref names — a label of intent only. */
export type StorageBackendKind =
  | "google_drive_placeholder"
  | "nostr_relay_placeholder"
  | "local_sqlite_placeholder"
  | "local_mesh_placeholder"
  | "ipfs_placeholder"
  | "external_placeholder";

/** How widely a stored item is meant to be reachable — a label of intent only. */
export type StorageVisibility = "public" | "unlisted" | "local_only";

/** Coarse observable state of a storage operation. No stored byte is exposed at any state. */
export type StorageState =
  | "unavailable" // no backend is present (the no-op default)
  | "accepted_placeholder" // passed placeholder policy review; nothing was stored
  | "rejected" // failed placeholder policy review
  | "error"; // an operation could not be served; recorded, never thrown

/**
 * The result of a storage write/delete attempt. There is deliberately NO
 * stored-bytes/output field — nothing is persisted, so nothing is returned
 * but a non-sensitive decision.
 */
export interface StorageDecision {
  readonly allowed: boolean;
  /** The backend state AFTER this decision. */
  readonly state: StorageState;
  /** Non-sensitive explanation. Never echoes packet metadata or refs. */
  readonly reason?: string;
}

/**
 * The result of a storage read attempt. Same shape as `StorageDecision`,
 * plus an OPTIONAL opaque `ref` — never the stored bytes themselves.
 */
export interface StorageReadDecision extends StorageDecision {
  /** Present only if a (placeholder) match was found; still no bytes. */
  readonly ref?: StorageRef;
}

/**
 * A non-sensitive description of one item to store. Carries NO bytes, body,
 * or content field of any kind — only opaque labels and metadata strings.
 * `metadata` is reviewed by `reviewStoragePacket` (see `./policy.js`) and
 * MUST NOT carry a secret/key/seed/token/payment/entitlement/dm/message
 * value or key name.
 */
export interface StoragePacket {
  /** OPAQUE label a real backend would use to address this item. */
  readonly idRef?: string;
  readonly backendKind: StorageBackendKind;
  readonly visibility: StorageVisibility;
  /** Unix milliseconds. A timestamp label only — never derived from content. */
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by the placeholder policy. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** An OPAQUE reference to a previously-described item — never a path or URL. */
export interface StorageRef {
  readonly idRef: string;
  readonly backendKind?: StorageBackendKind;
}

/**
 * The storage-backend seam. Implementations MUST NOT perform real network
 * IO, file IO, or connect to any cryptography. Every operation resolves to
 * a decision (never throws) and, in this stage, no implementation performs
 * real storage.
 */
export interface StorageBackend {
  /** Current coarse status (pure read). */
  getStatus(): StorageDecision;
  /** Ask to store a packet. Stores NOTHING in this stage. */
  put(packet: StoragePacket): Promise<StorageDecision>;
  /** Ask to read a previously-stored item. Reads NOTHING in this stage. */
  get(ref: StorageRef): Promise<StorageReadDecision>;
  /** Ask to delete a previously-stored item. Deletes NOTHING in this stage. */
  delete(ref: StorageRef): Promise<StorageDecision>;
}

/** Every backend-kind label (for mapping/documentation helpers). */
export const STORAGE_BACKEND_KINDS: readonly StorageBackendKind[] = [
  "google_drive_placeholder",
  "nostr_relay_placeholder",
  "local_sqlite_placeholder",
  "local_mesh_placeholder",
  "ipfs_placeholder",
  "external_placeholder",
];
