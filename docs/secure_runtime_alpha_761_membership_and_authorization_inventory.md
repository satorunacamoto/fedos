# Secure Runtime Alpha 761 — Existing Membership and Authorization Inventory

Stage 1 of the Alpha 761–790 Canonical Conversation Membership & Capability Foundation Arc. Real source inspection, done before any production change.

## 1. Existing participant-like identities

`FedosBoardAuthorReference` (`src/board/fedos_board_author.ts`, Alpha 254) — `identityId | protocol | publicIdentifier`. Closest existing shape; NOT reused directly (see `docs/secure_runtime_alpha_762_participant_reference_decision.md`).

## 2. Existing role/member types

- `SpaceMembership`/`SpaceRole` (`src/community/types.ts`) — five-value `owner | admin | moderator | member | guest`, pubkey-allowlist-keyed, boolean `SpaceDecision.allowed` with a free-text `reason`.
- `MembershipPlanDescriptor`/`MembershipPlanKind` (`src/creator/membership.ts`) — creator monetization tiers, unrelated domain (price/checkout labels, not conversation participation).

## 3. Which existing types are Community/Nostr-specific

Both of the above. `SpaceMembership` is pubkey-allowlist-keyed (Nostr-specific identity model) with no fail-closed validator. `MembershipPlanDescriptor` is creator-monetization-specific, has no participant/role/conversation concept at all.

## 4. Which concepts are reusable

None of the two TYPES above, reused directly. The DISCIPLINE is reused: `FedosConversationPersistenceWriteResult`'s closed-vocabulary result pattern (Alpha 749), `FedosConversationRecord`'s "validator is the sole constructor" rule (Alpha 748), `FedosBoardAuthorReference`'s `identityId | protocol | publicIdentifier` shape (Alpha 254), and `FedosBoardRuntimeIdGenerator`'s injected-generator convention (Alpha 626).

## 5. Whether membership currently has any authority

No. `FedosConversationRecord` (Alpha 745) explicitly excludes a member list ("no membership authority exists" — its own header). No file under `src/` implements or claims to implement a membership check.

## 6. Whether membership state is persisted anywhere

No. No `FedosConversationMembership`-shaped record, table, or file exists anywhere in `src/`.

## 7. Whether public mode currently needs membership

No. `FedosConversationPolicy.writeAccess` (`src/board/runtime/policy/fedos_conversation_policy.ts`) has exactly one enforceable V1 value, `"public"`; `"restricted"` is syntactically valid vocabulary but rejected by `validateFedosConversationPolicy()` specifically because no membership authority exists to honor it (Alpha 653's own comment, unchanged, re-confirmed).

## 8. Exact expected RIPPLE scope

New files only, under `src/conversation/membership/` and `src/conversation/capability/`. No existing `src/conversation/*` core file (`fedos_conversation_id.ts`, `fedos_conversation_record.ts`, `fedos_conversation_record_validator.ts`, `fedos_conversation_hydration.ts`, `fedos_conversation_reader.ts`, `persistence/*`) requires a change — none is touched by this Arc. No `src/board/runtime/*` file requires a change — Membership/Capability are consulted BY nothing in this Arc, confirmed structurally by `test/secure_runtime_alpha_772_public_mode_compatibility.test.ts`.
