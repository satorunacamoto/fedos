# Secure Runtime Alpha 5801–5880 — Reconciliation Report

**FedOS Identity Transition Types, Validation, and Durable Evidence
Foundation Arc.** Base commit `45e0fce` (`review/fedos-account-nostr-identity-rotation-v1`).
Worktree `C:\wt\identity-transition-foundation`, branch
`arc/identity-transition-types-validation-durable-evidence`.

Written before any production source edit, per this Arc's own Phase A
requirement.

## Alpha range reservation

Inspected all branch tips and README status blurbs. The highest
previously-claimed contiguous range is **5721–5800** (`d825aa0`, FedOS
Ratchet Peer Notification and Capability Advertisement Arc). No branch,
worktree, or commit anywhere in `git log --all` claims 5801–5960. Per the
coordination brief:

- **Arc A (this Arc) reserves 5801–5880.**
- Arc B (FedOS Signed Recipient Deletion Request Private Transport and
  Local Policy Integration) reserves 5881–5960, in its own separate
  worktree (`C:\wt\signed-deletion-request-foundation` holds the
  *earlier*, already-landed Alpha 5641–5720 Deletion Request State
  Foundation Arc on branch `arc/signed-recipient-deletion-request-state-foundation`
  — a distinct, prior Arc, not Arc B's own new worktree). No collision
  found; no historical 5401–5480-style range reuse needed this time.

## Inventory

| Area | File(s) | Reachable? | Reusable? | Frozen? | Required change | Must stay untouched |
|---|---|---|---|---|---|---|
| Account identity canonical form | `src/desktop/onboarding/fedos_profile_initialization_coordinator.ts`, `fedos_local_profile_descriptor.ts` | Yes | Type shape only (`{authority:"nostr", publicIdentifier, identityId:null}`) | Yes — no onboarding/profile edit in this Arc | none | Yes |
| Nostr identity / signing | `src/nostr/sign/fedos_nostr_signing_authority.ts`, `fedos_wasm_nostr_signing_authority.ts` | Yes (WASM) | No — this Arc never signs a real Nostr *event*; its own proofs use a narrower, domain-separated digest signed directly with `@noble/curves` schnorr (mirrors `fedos_device_signing_keypair.ts`'s own posture, not `FedosNostrSigningAuthority`) | Yes | none | Yes |
| Master Seed authority | `src/runtime/master_seed/fedos_master_seed_authority.ts` (+ WASM impl) | Yes | No — no `FedosMasterSeedAuthorityState` enum exists to reuse; this Arc's `"master-seed-authority"` evidence kind is reserved vocabulary only, never produced | Yes | none | Yes |
| Device Binding / Registry | `src/device/fedos_device_binding.ts`, `persistence/fedos_device_registry_persistence.ts` | Yes | Yes — `FedosDeviceBindingAccountRef`, `FedosDeviceBindingV1`, `isFedosDeviceBindingTrusted/Revoked` reused directly (read-only) | Yes | none (no write to the registry) | Yes |
| Device signing / challenge boundary | `src/device/crypto/fedos_device_signing_keypair.ts`, `src/device/binding_challenge/*` | Yes | Yes — `verifyFedosDeviceSigningSignature()` reused verbatim as the Device corroboration verification primitive; the challenge/proof-of-possession *pattern* (canonical array + domain tag + digest) reused, not the types themselves | Yes | none | Yes |
| Peer capability observation (`d825aa0`) | `src/conversation/ratchet/peer_capability/*` | Yes | Pattern only — append-only NDJSON persistence shape, safe-status-DTO discipline, 3-state evidence-level precedent | Yes | none | Yes |
| Session Reset foundation (`f80889d`) | `src/conversation/ratchet/fedos_direct_ratchet_session_reset_record.ts` + authority | Yes | Pattern only this Arc; the generation-increment plumbing is the reuse target for the **next** Arc (Peer Notification and Ratchet Reset Integration), not this one | Yes | none (no reset applied) | Yes |
| Canonical serialization convention | `src/nostr/event.ts::serializeForId()` | Yes | Convention only — no shared `canonicalize()` helper exists anywhere in this codebase; every domain hand-rolls its own fixed-order array | Yes | none | Yes |
| Conversation Membership / participant ref | `src/conversation/membership/*` | Yes | No | Yes | none | Yes |
| Archive | `src/conversation/archive/*` (12 files) | Yes | No | Yes | none | Yes |
| Search | `src/conversation/search/*` | Yes | No | Yes | none | Yes |
| Structural exclusion guard pattern | `test/secure_runtime_alpha_5401_5480_structural_exclusion_guards.test.ts`, `..._5721_5800_structural_guards.test.ts` | Yes | Pattern reused (own new guard file), not the allowlist itself — **this Arc needs zero `/transport/` imports**, so the existing allowlists are left untouched | Yes | none | Yes |

## Key findings

1. **This repo's current architecture has exactly one supported
   account/Nostr mapping**: account identity IS the Nostr public key
   (`authority: "nostr"`). `FedosIdentityTransitionRecordV1` therefore
   requires `authority === "nostr"` for both the old and new account
   identity — anything else is treated as an unsupported mapping and
   fails structural validation closed, rather than being silently
   accepted with no downstream meaning.
2. **No shared canonical-serialization helper exists.** Every "canonical
   signed content" type in this codebase hand-rolls its own fixed-order
   `JSON.stringify([...])` array with an explicit domain-separator string
   (`src/nostr/event.ts`'s own `serializeForId()` is the origin
   convention). This Arc's `fedos_identity_transition_canonical.ts`
   follows the same convention, with FOUR distinct domain tags (body,
   new-key proof, continuity proof, Device corroboration proof) so a
   signature computed for one artifact can never be replayed as another.
3. **The review's own proposed evidence-level literal names
   (`"unlinked-replacement" | "old-identity-signed" | "old-identity-and-device-evidence"`,
   doc 07) were NOT reused verbatim** — the live
   `FedosRatchetPeerCapabilityEvidenceLevel` precedent (`account-authenticated`
   etc.) uses different literals for the same 3-state *shape*. This Arc
   defines its own, purpose-fit closed vocabularies
   (`FedosIdentityTransitionEvidenceStatus`,
   `FedosIdentityTransitionEvidenceOutcome`) rather than force-fitting
   either prior naming scheme, since neither prior enum's exact literals
   map cleanly onto this domain's own decision points (compromise-reason
   gating, Device-corroboration-changes-level-but-not-quorum).
4. **No Rust/WASM changes are needed or made.** Every real signature this
   Arc verifies is BIP-340 Schnorr via `@noble/curves`, already a
   production dependency, used directly (never through the WASM-backed
   `FedosNostrSigningAuthority`) — identical posture to
   `fedos_device_signing_keypair.ts` and
   `test/support/real_fedos_nostr_signing_authority.ts`. This worktree has
   no compiled `pkg/` artifact (consistent with prior Arcs' own findings);
   nothing in this Arc requires one.
5. **Supersession and conflict state are derived, not stored mutably.**
   A durable `FedosIdentityTransitionFactV1` is never rewritten once
   inserted (true append-only, matching the Peer Capability Observation
   and Session Reset Record precedents). "Is this fact superseded?" and
   "does the durable log show a competing/rollback attempt?" are answered
   by pure query functions over the full lineage, not by mutating an
   older row.

## Conclusion

No production source file existed to modify — this is a brand-new,
standalone domain. Proceeding directly to Phase B.
