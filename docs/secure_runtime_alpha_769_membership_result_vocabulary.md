# Secure Runtime Alpha 769 — Membership Result Vocabulary

`FedosConversationMembershipMutationResult`/`FedosConversationMembershipAdmissionPreview` (`src/conversation/membership/fedos_conversation_membership_result.ts`). No boolean, no `Error` object, no stack, no arbitrary provider text.

The instruction's own candidate list (`admitted | already-present | conflict | invalid-transition | not-found | unavailable`) is shared by all three mutating operations (`admit`/`revoke`/`leave`, Alpha 770) at the Authority interface level — but labeling a successful `revoke()`/`leave()` as `"admitted"` would be actively misleading. This file extends the candidate with two operation-specific success tokens, `"revoked"`/`"left"`, mirroring `"admitted"`'s own shape exactly (`{ outcome; membership }`); the shared failure tokens are untouched. `"conflict"` is reachable: `admit()` on an already-active membership with a DIFFERENT role than requested returns `"conflict"`, never a silent overwrite (`test/secure_runtime_alpha_769_771_membership_authority.test.ts` #4).

`previewAdmission()`'s own result is deliberately narrower — never `"not-found"` (nothing is looked up by id) and never a `membership` payload (nothing was constructed): `would-admit | already-active | blocked (reason: invalid-transition) | unavailable`.
