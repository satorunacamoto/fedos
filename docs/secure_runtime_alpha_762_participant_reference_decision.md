# Secure Runtime Alpha 762 — Participant Reference Decision

`FedosConversationParticipantReference` (`src/conversation/membership/fedos_conversation_participant_reference.ts`) — `authority | publicIdentifier | identityId`, mirroring `FedosBoardAuthorReference`'s shape but kept as a DEDICATED type: a post author and a Conversation participant are different facts that happen to share a shape today, and collapsing them would make a future participant-only field (e.g. `role`) look like it also applies to board authorship.

Adjusted from the instruction's own candidate: `"fedos"` replaces `"fedos-identity"` — the codebase's existing `FedosBoardSourceProtocol` (`src/board/fedos_board_source.ts`) already uses `"fedos"`, and this type must never disagree with that established vocabulary. Extended with exactly one new authority, `"temporary-capability"`, for a participant who has redeemed a join Capability but is not yet bound to any protocol identity.

Requirements satisfied: immutable (every field `readonly`), exact closed field set, no display name/avatar/secret/signing object/raw capability secret/arbitrary metadata, no implicit cross-protocol identity equivalence (verified by `test/secure_runtime_alpha_762_763_participant_reference.test.ts` #11).
