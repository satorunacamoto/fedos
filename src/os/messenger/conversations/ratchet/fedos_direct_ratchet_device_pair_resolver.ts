/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase C: Device-pair ratchet
 * session resolution.
 *
 * Resolves the ONE independent ratchet session identity for a
 * (local account, local Device, remote account, remote Device, Direct
 * Conversation, suite) tuple, from REAL Device identity facts only —
 * `FedosDeviceRegistryPersistence` (`../../device/persistence/fedos_device_registry_persistence.js`,
 * Alpha 2921–3000, UNCHANGED), never a display name, array index, Relay
 * identity, or local process id (this Arc's own absolute prohibition).
 *
 * `generation` is never guessed: when the caller does not name one
 * explicitly, `findCurrentFedosDirectRatchetSession()` below scans the
 * EXISTING `FedosDirectRatchetSessionPersistence.listSessions()` (Alpha
 * 5401–5480, UNCHANGED) for the highest-generation record matching every
 * OTHER binding component and returns it — never fabricates a session
 * that was never created, never widens/narrows the search to a different
 * tuple.
 *
 * HARD GUARDRAILS:
 *   - No secret material, no raw Device key, no raw ratchet key of any
 *     kind — every field here is a public reference or closed outcome.
 *   - A revoked local OR remote Device denies unconditionally
 *     (`"local-device-revoked"`/`"remote-device-revoked"`) — never
 *     ignored, never overridable by any other flag.
 *   - An unknown (never-registered) Device fails closed
 *     (`"local-device-unknown"`/`"remote-device-unknown"`) — never
 *     silently treated as "trusted" or "pending".
 *   - `"pending"`/`"unavailable"` Device trust states are NOT sufficient
 *     for ratchet participation (`"local-device-not-trusted"`/
 *     `"remote-device-not-trusted"`) — only `"trusted"` resolves.
 */
import {
  isFedosDeviceBindingRevoked,
  isFedosDeviceBindingTrusted,
  type FedosDeviceBindingAccountRef,
} from "../../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import {
  toFedosDirectRatchetSessionId,
  type FedosDirectRatchetSessionId,
  type FedosDirectRatchetSuite,
} from "../../../../conversation/ratchet/fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetSessionPersistence } from "../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_persistence.js";
import type { FedosDirectRatchetSessionRecordV1 } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_record.js";

/** The fixed, closed suite this Arc ever resolves — reused, never redefined (`./fedos_direct_ratchet_session_id.js`). */
export const FEDOS_DIRECT_RATCHET_DEFAULT_SUITE: FedosDirectRatchetSuite = "fedos-direct-ratchet-v1";

export interface FedosDirectRatchetDevicePairRequest {
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly remoteAccountRef: FedosDeviceBindingAccountRef;
  readonly remoteDeviceRef: string;
  readonly conversationId: FedosConversationId;
  readonly suite?: FedosDirectRatchetSuite;
  /** Omitted — the current (highest-known) generation is resolved via `findCurrentFedosDirectRatchetSession()`; a caller establishing a BRAND NEW session for a tuple with no prior generation supplies `0` explicitly. */
  readonly generation?: number;
}

export type FedosDirectRatchetDevicePairResolution =
  | { readonly outcome: "resolved"; readonly sessionId: FedosDirectRatchetSessionId; readonly generation: number }
  | { readonly outcome: "local-device-unknown" }
  | { readonly outcome: "local-device-revoked" }
  | { readonly outcome: "local-device-not-trusted" }
  | { readonly outcome: "remote-device-unknown" }
  | { readonly outcome: "remote-device-revoked" }
  | { readonly outcome: "remote-device-not-trusted" }
  | { readonly outcome: "invalid-binding" };

/**
 * Scans `persistence.listSessions()` for the highest-`generation` record
 * whose binding matches every field EXCEPT `generation` — the ONE place
 * this Arc ever infers "the current generation" for a Device pair,
 * always from ALREADY-persisted fact, never a guess. `null` if no
 * session has ever been created for this exact tuple.
 */
export function findCurrentFedosDirectRatchetSession(
  persistence: FedosDirectRatchetSessionPersistence,
  tuple: {
    readonly localAccountRef: FedosDeviceBindingAccountRef;
    readonly localDeviceRef: string;
    readonly remoteAccountRef: FedosDeviceBindingAccountRef;
    readonly remoteDeviceRef: string;
    readonly conversationId: FedosConversationId;
    readonly suite: FedosDirectRatchetSuite;
  },
): FedosDirectRatchetSessionRecordV1 | null {
  let best: FedosDirectRatchetSessionRecordV1 | null = null;
  for (const record of persistence.listSessions()) {
    const b = record.binding;
    if (
      b.localAccountRef.authority !== tuple.localAccountRef.authority ||
      b.localAccountRef.publicIdentifier !== tuple.localAccountRef.publicIdentifier ||
      b.localDeviceRef !== tuple.localDeviceRef ||
      b.remoteAccountRef.authority !== tuple.remoteAccountRef.authority ||
      b.remoteAccountRef.publicIdentifier !== tuple.remoteAccountRef.publicIdentifier ||
      b.remoteDeviceRef !== tuple.remoteDeviceRef ||
      (b.conversationId as unknown as string) !== (tuple.conversationId as unknown as string) ||
      b.suite !== tuple.suite
    ) {
      continue;
    }
    if (best === null || b.generation > best.binding.generation) best = record;
  }
  return best;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** `toFedosDirectRatchetSessionId()`'s own components are flat strings, never a structured account ref (see that file's own `FedosDirectRatchetSessionIdComponents`) — this is the ONE deterministic string encoding this Arc uses for that field. `"::"` is safe here (only `"##"` is the id's own reserved delimiter). */
/**
 * `toFedosDirectRatchetSessionId()`'s own components are flat strings,
 * never a structured account ref (see that file's own
 * `FedosDirectRatchetSessionIdComponents`) — this is the ONE deterministic
 * string encoding this Arc uses for that field. `"::"` is safe here (only
 * `"##"` is the id's own reserved delimiter).
 *
 * TRUNCATED TO 16 HEX CHARS OF `publicIdentifier` (deliberately, not the
 * full 64-hex-char Nostr public key): the Rust boundary's own per-message
 * header encoder (`packages/fedos-core-rust/src/crypto/direct_ratchet_header.rs`,
 * `MAX_BOUNDED_STRING_LEN = 256`) bounds the ENTIRE `session_id` string
 * that travels inside every ratchet message header — a full 8-segment id
 * built from two untruncated 64-hex-char public keys plus device refs
 * plus a real Conversation id plus the suite label routinely exceeds that
 * 256-byte cap, causing every `encrypt()` call to fail closed with `None`
 * (reproduced directly against the real Rust boundary during this Arc's
 * own development). 16 hex characters (64 bits) of a value that is
 * already validated, revocation-checked Device-registry knowledge (never
 * the sole authentication factor — see `resolveFedosDirectRatchetDevicePair()`'s
 * own Device-trust gate) keeps the id well under the Rust bound with
 * large margin while remaining collision-negligible for this domain-
 * separation purpose.
 */
function accountRefToSessionIdComponent(accountRef: FedosDeviceBindingAccountRef): string {
  const shortAuthority = accountRef.authority.slice(0, 6);
  const shortIdentifier = accountRef.publicIdentifier.slice(0, 16);
  return `${shortAuthority}:${shortIdentifier}`;
}

/**
 * Resolves the Device-pair session identity, denying on any revoked or
 * unknown Device BEFORE ever constructing a session id. Never mutates
 * the Device registry or the session persistence — a pure read + closed
 * outcome, exactly like every other Authority read in this codebase.
 */
export function resolveFedosDirectRatchetDevicePair(
  deviceRegistry: FedosDeviceRegistryPersistence,
  sessionPersistence: FedosDirectRatchetSessionPersistence,
  request: FedosDirectRatchetDevicePairRequest,
): FedosDirectRatchetDevicePairResolution {
  if (
    !isNonEmptyString(request.localDeviceRef) ||
    !isNonEmptyString(request.remoteDeviceRef) ||
    !isNonEmptyString(request.conversationId as unknown as string)
  ) {
    return { outcome: "invalid-binding" };
  }

  const localBinding = deviceRegistry.getBinding(request.localDeviceRef);
  if (localBinding === null) return { outcome: "local-device-unknown" };
  if (isFedosDeviceBindingRevoked(localBinding)) return { outcome: "local-device-revoked" };
  if (!isFedosDeviceBindingTrusted(localBinding)) return { outcome: "local-device-not-trusted" };

  const remoteBinding = deviceRegistry.getBinding(request.remoteDeviceRef);
  if (remoteBinding === null) return { outcome: "remote-device-unknown" };
  if (isFedosDeviceBindingRevoked(remoteBinding)) return { outcome: "remote-device-revoked" };
  if (!isFedosDeviceBindingTrusted(remoteBinding)) return { outcome: "remote-device-not-trusted" };

  const suite = request.suite ?? FEDOS_DIRECT_RATCHET_DEFAULT_SUITE;
  let generation = request.generation;
  if (generation === undefined) {
    const current = findCurrentFedosDirectRatchetSession(sessionPersistence, {
      localAccountRef: request.localAccountRef,
      localDeviceRef: request.localDeviceRef,
      remoteAccountRef: request.remoteAccountRef,
      remoteDeviceRef: request.remoteDeviceRef,
      conversationId: request.conversationId,
      suite,
    });
    generation = current?.binding.generation ?? 0;
  }

  // CANONICAL ORDERING: `FedosDirectRatchetSessionId` is a SHARED
  // cryptographic identifier both Device-pair participants must compute
  // to the IDENTICAL string (it feeds the Rust HKDF context binding —
  // see `docs/secure_runtime_alpha_5481_5560_cryptographic_construction.md`
  // §"Domain separation") — unlike `FedosDirectRatchetSessionBinding`
  // (this participant's OWN local bookkeeping record, which correctly
  // keeps TRUE local/remote semantics per side), the two (account,Device)
  // slots inside the session id string itself are sorted into a FIXED,
  // side-independent order here so Alice's own computed id and Bob's own
  // computed id, for the SAME logical Device pair, are byte-identical —
  // exactly the "same literal sessionId used for both createAsReceiver
  // and createAsSender" pattern
  // `test/secure_runtime_alpha_5481_5560_real_vertical_slice.test.ts`
  // itself already establishes.
  const localSortKey = `${accountRefToSessionIdComponent(request.localAccountRef)}##${request.localDeviceRef}`;
  const remoteSortKey = `${accountRefToSessionIdComponent(request.remoteAccountRef)}##${request.remoteDeviceRef}`;
  const [firstAccountRef, firstDeviceRef, secondAccountRef, secondDeviceRef] =
    localSortKey <= remoteSortKey
      ? [request.localAccountRef, request.localDeviceRef, request.remoteAccountRef, request.remoteDeviceRef]
      : [request.remoteAccountRef, request.remoteDeviceRef, request.localAccountRef, request.localDeviceRef];

  const sessionId = toFedosDirectRatchetSessionId({
    localAccountRef: accountRefToSessionIdComponent(firstAccountRef),
    localDeviceRef: firstDeviceRef,
    remoteAccountRef: accountRefToSessionIdComponent(secondAccountRef),
    remoteDeviceRef: secondDeviceRef,
    conversationId: request.conversationId,
    suite,
    generation,
  });
  if (sessionId === null) return { outcome: "invalid-binding" };

  return { outcome: "resolved", sessionId, generation };
}
