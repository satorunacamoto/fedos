/**
 * Stage 182–185 — Encrypted payload descriptor boundary (types + pure
 * review only).
 *
 * A LABEL-ONLY, METADATA-ONLY seam naming what a future encrypted
 * ciphertext MIGHT look like on its way to `StorageBackend`
 * (`./types.ts`) or a `FederationProvider` (`../federation/types.ts`) —
 * see `docs/encrypted_payload_storage_boundary.md`. Mirrors this
 * repository's Rust-side `crypto::ciphertext_transport::CiphertextTransportDescriptor`
 * (`packages/fedos-core-rust/src/crypto/ciphertext_transport.rs`) ROLE
 * for ROLE (not by importing/re-deriving from it — there is no Rust↔TS
 * bridge at all; see that crate's `[lib]` section, `crate-type = ["rlib"]`
 * only) and this repository's own `docs/ciphertext_serialization_format_decision.md`
 * (the canonical-JSON-+-base64url MVP encoding decision this file's
 * `EncryptedPayloadEncoding` labels record, without implementing).
 *
 * HARD GUARDRAILS:
 *   - NO payload byte, ciphertext byte, plaintext, or raw key field of any
 *     kind exists on `EncryptedPayloadDescriptor` — every field is a
 *     fixed label or an opaque, backend-resolved reference string.
 *   - NO actual JSON/base64/CBOR/binary ENCODING or DECODING is
 *     implemented here — `EncryptedPayloadEncoding` only NAMES a future
 *     wire encoding, exactly as the Rust-side placeholder does.
 *   - NO `StorageBackend`/`FederationProvider`/Nostr relay/Runtime/Worker
 *     connection of any kind — this file imports nothing from
 *     `./noop_storage.ts`, `../federation/`, `../runtime/`, or
 *     `../worker.ts`, and is not imported by any of them either.
 *   - `reviewEncryptedPayloadDescriptor` is PURE: it inspects its input
 *     and returns a decision, never mutates the input, performs no I/O,
 *     and never throws.
 *   - Buyer/payment/entitlement metadata and chat/DM/private metadata are
 *     both REJECTED by `reviewEncryptedPayloadDescriptor` — restating
 *     `docs/encrypted_payload_storage_boundary.md` §5's identical rule at
 *     this boundary's own review function, not just in prose.
 *
 * Stage 189–191 extend this file with a PREVIEW/DIAGNOSTICS boundary:
 * `PayloadPreviewDescriptor`, `PayloadDiagnosticsDescriptor`, and a pure
 * `reviewPayloadPreview` — feeding `src/render/encrypted_payload_preview.ts`
 * (Stage 189) and `src/render/payload_diagnostics.ts` (Stage 190). Same
 * guardrails as above, plus: NO `bytes`/`Uint8Array`/`ArrayBuffer` field of
 * any kind, and NO `metadata` dictionary at all on either new descriptor
 * type (there is nothing for a future field to leak buyer/payment/chat/
 * entitlement content through).
 */

/** Which AEAD algorithm sealed the ciphertext this descriptor classifies — a label only. */
export type EncryptedPayloadAlgorithm = "chacha20poly1305" | "aes256gcm";

/**
 * Whether a wire encoding has been chosen for this ciphertext yet, and
 * which one — a label only, never a codec. Mirrors the Rust-side
 * `CiphertextEncodingPlaceholder`'s two variants (Stage 177–178,
 * extended Stage 182): `"undecided"` (no encoding named) and
 * `"canonical_json_base64url_placeholder"` (records
 * `docs/ciphertext_serialization_format_decision.md`'s MVP decision — no
 * encoder/decoder exists anywhere in this repository for it yet).
 */
export type EncryptedPayloadEncoding = "undecided" | "canonical_json_base64url_placeholder";

/** Which future destination this ciphertext is headed for — a label only, no connection to either. */
export type EncryptedPayloadTransportKind = "storage" | "nostr_event";

/** Coarse observable state of a `reviewEncryptedPayloadDescriptor` call. No payload byte is exposed at any state. */
export type EncryptedPayloadState = "unavailable" | "accepted_placeholder" | "rejected";

/**
 * The result of reviewing an `EncryptedPayloadDescriptor`. There is
 * deliberately NO payload/ciphertext field — nothing is transmitted or
 * stored by this review, so nothing is returned but a non-sensitive
 * decision (mirrors `StorageDecision` in `./types.ts`).
 */
export interface EncryptedPayloadDecision {
  readonly allowed: boolean;
  readonly state: EncryptedPayloadState;
  /** Non-sensitive explanation. Never echoes descriptor metadata. */
  readonly reason?: string;
}

/**
 * A non-sensitive DESCRIPTION of an (eventual, not-yet-real) encrypted
 * payload. Carries NO ciphertext, plaintext, nonce, tag, or raw key field
 * of any kind — only fixed labels, an optional opaque reference, and
 * reviewed metadata. `version` is fixed at `"v1"` — the only version this
 * boundary names today, mirroring the Rust-side
 * `CiphertextTransportVersion::V1`'s "exactly one variant" shape.
 */
export interface EncryptedPayloadDescriptor {
  readonly version: "v1";
  readonly algorithm: EncryptedPayloadAlgorithm;
  readonly encoding: EncryptedPayloadEncoding;
  readonly transportKind: EncryptedPayloadTransportKind;
  /** OPAQUE label a real backend/adapter would resolve on its own side. Never a path or URL. */
  readonly idRef?: string;
  /** Non-sensitive key/value labels only — reviewed by `reviewEncryptedPayloadDescriptor`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Substrings that mark a descriptor's `metadata` key/value as sensitive
 * (case-insensitive, matched as a substring after stripping
 * non-alphanumerics from keys). Extends `../storage/policy.ts`'s existing
 * `SENSITIVE_MARKERS` list with THIS boundary's own additional exclusions
 * (`buyer`, `chat`, `private`) named explicitly for encrypted-payload
 * metadata by `docs/encrypted_payload_storage_boundary.md` §5 — this
 * list is defined independently here (not imported) so this file stays a
 * fully self-contained boundary definition, matching this repository's
 * existing convention of each boundary owning its own policy constants
 * (`../storage/policy.ts`, `../federation/` adapters each do the same).
 */
const SENSITIVE_METADATA_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "buyer",
  "chat",
  "private",
  "dm",
  "body",
  "content",
  "message",
];

function isSensitiveMetadataKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_METADATA_MARKERS.some((marker) => k.includes(marker));
}

function isSensitiveMetadataValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_METADATA_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveMetadataKey(key) || isSensitiveMetadataValue(value)) return true;
  }
  return false;
}

/**
 * True if a label looks like a URL or filesystem path rather than an
 * opaque backend-resolved reference — mirrors
 * `../storage/policy.ts`'s `looksLikeUrlOrPath`, redefined locally for
 * the same self-containment reason as `SENSITIVE_METADATA_MARKERS` above.
 */
function looksLikeUrlOrPath(ref: string): boolean {
  if (typeof ref !== "string" || ref.length === 0) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) return true;
  if (ref.startsWith("/") || ref.startsWith("\\")) return true;
  if (/^[a-z]:[\\/]/i.test(ref)) return true;
  if (ref.includes("drive.google.com") || ref.includes("docs.google.com")) return true;
  return false;
}

function deny(reason: string): EncryptedPayloadDecision {
  return { allowed: false, state: "rejected", reason };
}

/**
 * Decide whether an `EncryptedPayloadDescriptor` is safe to eventually
 * hand to a future `StorageBackend`/`FederationProvider` step — PURE:
 * never mutates `descriptor`, performs no I/O, connects to no backend or
 * adapter, and never throws. Denies when `idRef` looks like a URL/file
 * path, or when any metadata key/value looks sensitive (secret/key/seed/
 * token/payment/entitlement/buyer/chat/private/dm/body/content/message).
 * A clean descriptor is `accepted_placeholder` — a PLACEHOLDER acceptance
 * only; nothing is stored, sent, or persisted by this review, and this
 * function is not called by anything in `./noop_storage.ts` or any
 * federation adapter today.
 */
export function reviewEncryptedPayloadDescriptor(
  descriptor: EncryptedPayloadDescriptor,
): EncryptedPayloadDecision {
  if (descriptor.idRef !== undefined && looksLikeUrlOrPath(descriptor.idRef)) {
    return deny("idRef must be an opaque label, not a URL or file path");
  }
  if (hasSensitiveMetadata(descriptor.metadata)) {
    return deny("descriptor metadata contains a sensitive, buyer/payment/entitlement, or chat/DM/private key or value");
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "descriptor carries only non-sensitive, opaque encrypted-payload metadata",
  };
}

/**
 * Stage 189–191 — the encrypted payload PREVIEW/DIAGNOSTICS boundary.
 *
 * Which fixed AAD domain a previewed ciphertext names — a label only,
 * mirroring the Rust-side `crypto::ciphertext_envelope::AeadEnvelopeAadDomain`/
 * `crypto::ciphertext_serialization`'s wire labels in ROLE (not by import —
 * there is still no Rust↔TypeScript bridge; see this file's own module
 * doc comment above). Never the actual AAD bytes.
 */
export type PayloadAadDomain =
  | "root_key"
  | "identity"
  | "storage"
  | "conversation"
  | "test_only";

/**
 * Coarse, DISPLAY-ONLY validity label for a payload preview — never a
 * live decode result, never derived from an actual `decode_envelope_internal`
 * call (there is no bridge to one). `"unavailable"` is the default/no-data
 * case; `"valid_placeholder"`/`"invalid_placeholder"` are fixed labels a
 * caller supplies to describe what a (not-yet-real) decode WOULD report —
 * this module never computes either value itself.
 */
export type PayloadPreviewStatus = "unavailable" | "valid_placeholder" | "invalid_placeholder";

/**
 * A non-sensitive, DISPLAY-ONLY description of an encrypted payload for
 * preview/diagnostics purposes — carries NO ciphertext, nonce, tag,
 * plaintext, or raw key byte, and (deliberately, structurally) NO
 * `metadata` dictionary at all, unlike `EncryptedPayloadDescriptor` above
 * — a preview has nothing to leak through a metadata bag because it
 * carries no such field to populate. `payloadId`, like `idRef` above, is
 * an OPAQUE label only, never a path or URL.
 */
export interface PayloadPreviewDescriptor {
  readonly version: "v1";
  readonly algorithm: EncryptedPayloadAlgorithm;
  readonly aadDomain: PayloadAadDomain;
  readonly encoding: EncryptedPayloadEncoding;
  readonly transportKind: EncryptedPayloadTransportKind;
  readonly status: PayloadPreviewStatus;
  readonly payloadId?: string;
}

/**
 * A minimal, DISPLAY-ONLY diagnostics projection of a
 * [`PayloadPreviewDescriptor`] — `src/render/payload_diagnostics.ts`'s pure
 * `buildPayloadDiagnostics` derives one FROM a preview descriptor. Carries
 * only label fields, no `payloadId` (a diagnostics summary names
 * capabilities/labels, not a specific item's reference) and no metadata.
 */
export interface PayloadDiagnosticsDescriptor {
  readonly version: "v1";
  readonly algorithm: EncryptedPayloadAlgorithm;
  readonly encoding: EncryptedPayloadEncoding;
  readonly transportKind: EncryptedPayloadTransportKind;
  readonly validationStatus: PayloadPreviewStatus;
}

/**
 * Decide whether a [`PayloadPreviewDescriptor`] is safe to preview — PURE:
 * never mutates `descriptor`, performs no I/O, connects to no backend or
 * adapter, and never throws. Denies only when `payloadId` looks like a
 * URL/file path — every other field is already a closed label union
 * TypeScript enforces at compile time, and this descriptor carries no
 * metadata dictionary to scan (see the type's own doc comment above for
 * why). A clean descriptor is `accepted_placeholder`; nothing is stored,
 * sent, decrypted, or persisted by this review.
 */
export function reviewPayloadPreview(descriptor: PayloadPreviewDescriptor): EncryptedPayloadDecision {
  if (descriptor.payloadId !== undefined && looksLikeUrlOrPath(descriptor.payloadId)) {
    return deny("payloadId must be an opaque label, not a URL or file path");
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "preview descriptor carries only non-sensitive, opaque preview labels",
  };
}
