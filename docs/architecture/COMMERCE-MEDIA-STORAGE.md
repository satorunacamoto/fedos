# Commerce Media Storage — `MediaStorePort` Design

Status: **DESIGN ONLY — no source changed by this document.**
Parent: [COMMERCE-DECENTRALIZED-DATA-PLANE.md](./COMMERCE-DECENTRALIZED-DATA-PLANE.md)

## 1. Grounding: what exists today

- `Product` (`src/os/commerce/catalog/types.ts:33-52`) references media only opaquely, via `assetIds: readonly string[]`.
- `AssetMetadata` (`src/os/commerce/catalog/asset_cache_types.ts:31-66`) is the closest existing media-adjacent type: `kind` (`image|video_segment|audio|preview|thumbnail|html_fragment|other`), `visibility`, `contentType`, `sizeBytes`, `checksum?`, `source?` (already opaque, not a URL), `tags`, `createdAt?`, `ttlSeconds?`.
- `DigitalAsset` (`asset_cache_types.ts:58-68` in the same file family) has a `storageRef: string` (opaque) field but is **dead code** — zero consumers, not re-exported from `src/os/commerce/index.ts`.
- `src/os/commerce/catalog/asset_preview.ts:1-49` already establishes the right discipline: preview surfaces expose **metadata only**, never raw bytes, never a download URL.
- `src/os/core/storage/types.ts` (`StorageBackend`) is explicitly retired for any new persistence contract (its own header says so). **`MediaStorePort` must not be modeled on it.**
- The best live analog for a Port + two adapters (one real, one in-memory/test) is `FedosConversationPayloadStorage` (`src/os/messenger/conversations/payload_storage/fedos_conversation_payload_storage.ts:46`), with `AppendOnlyFedosConversationPayloadStorage` (disk-backed) and `InMemoryFedosConversationPayloadStorage` (test) as its two adapters.
- Content-addressing precedent: `computeFedosConversationArchiveContentHash()` (`src/os/messenger/conversations/archive/fedos_conversation_archive_integrity.ts:34-46`) — canonical byte serialization → `@noble/hashes` `sha256()` → `bytesToHex()` → plain string equality. This is the pattern a media integrity hash should reuse, **not** the random-id pattern used for envelope/payload ids.

## 2. `MediaStorePort`

```ts
// src/os/core/ports/media_store_port.ts (new file, design only)

type ProductMediaKind = "image" | "video" | "sample";

interface MediaStorePort {
  /** Store already-encrypted (or, for public media, plaintext) bytes. Returns a content reference, never a raw URL. */
  put(bytes: Uint8Array, meta: MediaPutMeta): Promise<MediaStoreRef>;
  /** Fetch bytes back by reference. Adapter decides local-disk-read vs IPFS-gateway-fetch. */
  get(ref: MediaStoreRef): Promise<Uint8Array | null>;
  /** Cheap existence/availability check without fetching bytes (used for "ciphertext unavailable" handling). */
  has(ref: MediaStoreRef): Promise<boolean>;
}

interface MediaPutMeta {
  readonly kind: ProductMediaKind;
  readonly contentType: string;   // e.g. "image/webp"
  readonly sizeBytes: number;
  readonly encrypted: boolean;    // true for anything routed through IpfsMediaStore
}

/** Opaque on purpose — Commerce domain code must never parse or construct this. */
type MediaStoreRef = { readonly scheme: "local" | "ipfs-cid"; readonly value: string };
```

Design rules (carried from constraint 1 in the parent doc):

- `MediaStorePort` lives under `src/os/core/ports/`, is interface-only, and imports nothing from `os/messenger` or IPFS/Nostr packages.
- Commerce domain code depends only on `MediaStorePort`, never on `LocalMediaStore`/`IpfsMediaStore` concretely.
- `MediaStoreRef` is opaque to Commerce — it is produced by `put()` and only ever passed back to `get()`/`has()`, never inspected or displayed raw (this prevents an accidental plaintext-CID leak at the domain layer; display formatting, if ever needed, is a UI-adapter concern).

## 3. Candidate adapters

### `LocalMediaStore`
- Disk-backed, same durability discipline as `AppendOnlyFedosConversationPayloadStorage`.
- Default adapter for `FedosNetworkProfile.local` and `.nostr` profiles.
- Zero network dependency — satisfies the Phase-1 "0 expected network contact" requirement for any future media Phase 1 work.

### `IpfsMediaStore`
- Only ever active under the `tor_nostr_ipfs` network profile (see parent doc §2).
- **Content-addresses ciphertext, never plaintext** (§4 below) — `put()` for this adapter must reject any call where `meta.encrypted !== true` for non-public media.
- Design-ready only. No IPFS client dependency exists in `package.json` yet; adding one is out of scope for this arc (tracked in the roadmap).

## 4. Minimal canonical `ProductMedia` model

```ts
interface ProductMedia {
  readonly id: string;
  readonly kind: ProductMediaKind;         // "image" | "video" | "sample"
  readonly ref: MediaStoreRef;              // opaque — from MediaStorePort.put()
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly integrityHash: string;           // sha256(ciphertext-or-plaintext bytes), hex — see §7 (manifest)
  readonly altText?: string;                // safe to be public even for protected media
  readonly encrypted: boolean;
}
```

This is deliberately closer to `AssetMetadata` than to a from-scratch design — same `kind` vocabulary subset (image/video, plus a new `sample` for downloadable samples), same "metadata-only, opaque reference" discipline. It does **not** reuse the dead `DigitalAsset.storageRef: string` shape verbatim, because `MediaStoreRef` needs to be a structured, adapter-scheme-tagged value rather than a bare string, so a `LocalMediaStore` ref can never be silently misinterpreted as an IPFS CID or vice versa.

## 5. Encrypt-before-IPFS

```
plaintext bytes
   │  (only for media marked "protected" / non-public visibility)
   ▼
local symmetric encryption (device-held key; algorithm choice deferred — reuse
   an existing repo AEAD primitive, do not invent one in this design pass)
   │
   ▼
ciphertext bytes
   │
   ▼
integrityHash = sha256(ciphertext)     ← content-addressed on CIPHERTEXT, never plaintext
   │
   ▼
IpfsMediaStore.put(ciphertext, meta)  →  MediaStoreRef{ scheme:"ipfs-cid", value: cid }
```

Rules:

1. **IPFS is never trusted for confidentiality.** Any media whose `visibility` is not `"public"` (reusing `Product.visibility`'s existing `"public"|"unlisted"|"private"` vocabulary as the trigger) MUST be encrypted locally before it ever reaches `IpfsMediaStore.put()`.
2. **The CID is a hash of ciphertext, not plaintext.** This means: (a) two devices with the same plaintext but different local encryption keys/nonces produce *different* CIDs — no plaintext-content correlation across independent encryptions is possible via CID alone; (b) the same device re-uploading identical ciphertext produces the same CID (dedup), which is itself a minor metadata signal (see threat model, "CID correlation").
3. **Never expose the plaintext hash unnecessarily.** `integrityHash` in the public `ProductMedia`/manifest is always the ciphertext hash for protected media. A plaintext hash, if ever needed for local integrity checks after decryption, stays device-local and is never published.
4. **Public media** (`visibility: "public"`, e.g. a storefront banner) may skip encryption entirely and be content-addressed directly — this is a deliberate, explicit exception, not a default.

### CID/privacy implications (explicit)

- A CID is, by construction, a public, globally-queryable pointer. Publishing a CID (even of ciphertext) discloses: that *some* content of a given size exists, roughly when it was fetched (via DHT/gateway request timing), and — if the same CID is reused across multiple products/personas — that those products/personas share identical underlying bytes (a linkability signal, not a content leak).
- IPFS itself provides zero access control. Anyone who obtains the CID can fetch the ciphertext. Confidentiality depends entirely on the local encryption step (rule 1), never on IPFS/network-layer secrecy.
- See `SERVERLESS-COMMERCE-THREAT-MODEL.md` for DHT/gateway/timing leakage in full.

## 6. Media Manifest

A signed manifest is the *only* thing ever referenced from a public Nostr event — never a raw `MediaStoreRef`/CID directly in a plaintext, publicly-queryable field (this indirection lets access-policy changes happen without re-publishing the underlying blob reference pattern).

```ts
interface SignedProductMediaManifest {
  readonly manifestVersion: 1;
  readonly mediaId: string;
  readonly ref: MediaStoreRef;              // CID / local ref — see §6.1 for what's public
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly integrityHash: string;           // hex sha256, ciphertext for protected media
  readonly accessPolicy: "public" | "capability-grant-required";
  readonly encryptionVersion: number;       // opaque version tag for the local encryption scheme used
  readonly signature: string;               // signer = merchant's existing Nostr signing identity
}
```

### 6.1 Public vs. encrypted-payload fields

| Field | Safe to leave public? | Rationale |
|---|---|---|
| `manifestVersion`, `mediaId`, `contentType`, `sizeBytes`, `integrityHash`, `encryptionVersion`, `signature` | **Yes** | Needed by any client to fetch/verify the blob; none of these reveal plaintext content. |
| `ref` (CID) for **public** media | **Yes** | Media is intentionally public. |
| `ref` (CID) for **protected** media | **Public, but only as ciphertext-CID** | The CID must still be published so a buyer who holds a decryption capability can fetch it — but decrypting requires a separate, out-of-band-granted key (see `accessPolicy`), so publishing the CID alone discloses only "ciphertext of this size exists," never content. |
| `accessPolicy` | **Yes** | Coarse flag only, not the actual grant. |
| The decryption key itself | **No — never in the manifest.** | Delivered exclusively via a `CapabilityGrant`-style out-of-band mechanism (reusing `src/os/trust/capabilities/`), never embedded in or alongside the manifest. |
| Buyer identity, purchase context | **No** | Manifests describe *media*, never *who bought it* — that binding lives in a separate, non-public `PurchaseGrant`-adjacent record (existing type, `src/os/commerce/catalog/types.ts:71-86`), never co-published with the manifest. |

## 7. Relationship to `AssetMetadata`/`DigitalAsset`

This design **supersedes** the dead `DigitalAsset.storageRef` shape for any future real implementation, and **extends** (does not replace) `AssetMetadata` — a future implementation phase should decide whether `ProductMedia` becomes a new type or `AssetMetadata` gains the missing fields (`ref: MediaStoreRef`, `integrityHash`, `encrypted`). That decision is deferred; this document only establishes that the *shape* must carry those fields regardless of which existing type absorbs them.
