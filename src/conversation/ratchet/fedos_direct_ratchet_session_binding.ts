/**
 * Secure Runtime Alpha 5401-5480 — Phase C: the closed, public
 * (non-secret) binding facts a Direct Ratchet session record carries.
 * Mirrors `FedosDeviceBindingAccountRef`'s own
 * `{authority, publicIdentifier, identityId}` shape
 * (`../../device/fedos_device_binding.ts`, Alpha 2921-3000) for the
 * account references — reused, not redefined.
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosDirectRatchetSessionId, FedosDirectRatchetSuite } from "./fedos_direct_ratchet_session_id.js";

export interface FedosDirectRatchetSessionBinding {
  readonly sessionId: FedosDirectRatchetSessionId;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly remoteAccountRef: FedosDeviceBindingAccountRef;
  readonly remoteDeviceRef: string;
  readonly conversationId: FedosConversationId;
  readonly suite: FedosDirectRatchetSuite;
  readonly generation: number;
}

/**
 * The composite (account, Device) context string this Arc's own
 * sealing-authority calls bind to — NEVER just the bare `deviceRef`.
 * Rust's `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`
 * treat their `local_device_ref`/`remote_device_ref` parameters as
 * opaque HKDF context bytes only (never interpreted, never split
 * apart), so folding the account reference in here — rather than
 * widening the Rust function signature with two more parameters — is
 * sufficient to make "wrong account, same Device string" a genuine
 * cryptographic-binding failure, not merely a Runtime-level substitution
 * check. `"::"`-joined is safe here (unlike session-id construction,
 * which needs true delimiter-collision-safety for equality comparison)
 * because this string is consumed only as one-way KDF context material,
 * never split back apart.
 */
export function fedosDirectRatchetSealingDeviceContext(accountRef: FedosDeviceBindingAccountRef, deviceRef: string): string {
  return `${accountRef.authority}::${accountRef.publicIdentifier}::${deviceRef}`;
}

/** `true` iff `a`/`b` name the identical Device pair for the identical Conversation and generation — the substitution check every recovery path (Phase I) must perform before trusting a recovered secret. */
export function fedosDirectRatchetSessionBindingsEqual(
  a: FedosDirectRatchetSessionBinding,
  b: FedosDirectRatchetSessionBinding,
): boolean {
  return (
    a.sessionId === b.sessionId &&
    a.localDeviceRef === b.localDeviceRef &&
    a.remoteDeviceRef === b.remoteDeviceRef &&
    a.conversationId === b.conversationId &&
    a.suite === b.suite &&
    a.generation === b.generation &&
    a.localAccountRef.authority === b.localAccountRef.authority &&
    a.localAccountRef.publicIdentifier === b.localAccountRef.publicIdentifier &&
    a.remoteAccountRef.authority === b.remoteAccountRef.authority &&
    a.remoteAccountRef.publicIdentifier === b.remoteAccountRef.publicIdentifier
  );
}
