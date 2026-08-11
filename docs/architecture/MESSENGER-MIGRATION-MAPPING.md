# FedOS Messenger — Complete File-by-File Migration Mapping

Status: mapping only. **No file listed here has been physically moved.** This
document is the mechanical input for the follow-up arc that performs the
actual `git mv` sequence (see `docs/architecture/MESSENGER-MIGRATION-STAGING.md`
for the order to do it in). Every row below can be executed as a literal
`git mv "<old path>" "<new path>"` with zero judgment calls — the judgment
calls (which bucket each subtree belongs to, and the two entangled exceptions
below) were made once, here, by this document's own generation rules.

Generated mechanically from a full `find src/conversation src/board
src/desktop src/device src/nostr -name "*.ts"` enumeration (764 files) run
against the six rules below — not sampled, not hand-curated file-by-file.
Regenerate with the same rules any time the source tree changes before the
physical move happens.

## Source scope

Everything under `src/conversation/`, `src/board/`, `src/desktop/`,
`src/device/`, `src/nostr/` — the current, unmoved, shipped messenger code
this arc's audit mapped. **764 `.ts` files total**, not the ~830 estimate
in this arc's own kickoff prompt — 764 is the actual, counted number
(`find … -name "*.ts" | wc -l` per directory: conversation 422, board 85,
desktop 157, device 88, nostr 12).

## Mapping rules (applied mechanically, in this priority order)

1. Any file under `src/nostr/` → `src/os/messenger/adapters/nostr/protocol/**`
   (flattened protocol primitives — event/crypto/relay/signing types, no
   third-party SDK, this repo's own wire-level Nostr code).
2. Any file under `src/conversation/delivery/nostr/**` →
   `src/os/messenger/adapters/nostr/conversation_delivery/**` (the NIP-17/
   NIP-59 private-delivery wire adapter, including its `nip17/` subfolder,
   kept as a subfolder so it doesn't collide with rule 1's files).
3. Any file under `src/conversation/transport/**` →
   `src/os/messenger/adapters/nostr/transport/**` (publish scheduling,
   outbox, relay set/dedup — transport-layer code that is Nostr-specific
   in practice even though the type names are protocol-neutral; it never
   builds on anything outside the Nostr relay stack today).
4. Any file under `src/conversation/encryption/identity/**` →
   `src/os/messenger/conversations/encryption/identity/**` — **kept nested
   inside `conversations/`, NOT hoisted to the top-level `contacts/`
   bucket.** See "The `contacts/` decision" below for why.
5. Any other file under `src/conversation/**` →
   `src/os/messenger/conversations/**`, preserving its relative path.
6. Any file under `src/board/**` → `src/os/messenger/board/**`, preserving
   its relative path (federated/social sub-capability, stays inside
   `os/messenger` per this arc's own scope decision — it is not a DM
   feature, but the user has already decided it lives here).
7. Any file under `src/device/**` → `src/os/messenger/device/**`,
   preserving its relative path.
8. Any file under `src/desktop/notification/**` →
   `src/os/messenger/notifications/**`, preserving its relative path
   (the live notification coordinator this arc's kickoff prompt named —
   not the dormant top-level `src/notification/`, which is out of this
   arc's scope entirely and is being quarantined by a different agent).
9. Any other file under `src/desktop/**` → `src/os/messenger/desktop/**`,
   preserving its relative path (the Electron-facing composition layer —
   shell, runtime, host_boundary, badge, tray, onboarding, settings,
   presentation, renderer, production_activation, background).

## The `contacts/` decision

The kickoff prompt asked this arc to map `src/conversation/encryption/identity/*`
(the participant/identity/counterparty/key resolvers — the closest thing
this codebase has to "contacts") to a top-level `src/os/messenger/contacts/`
bucket, OR to recommend keeping it nested if it is too entangled with
`conversations/` to cleanly split — and to document the decision either way.

Measured fan-in (`grep` for `encryption/identity` import paths across
`src/`):

- **22 files inside `src/conversation/**`** import from
  `encryption/identity/` — activation, messaging, deletion_request,
  identity_transition/peer_integration, and encryption/coordination code
  all resolve identity through it directly.
- **1 file outside `src/conversation/`** imports from it:
  `src/desktop/runtime/fedos_desktop_runtime_config.ts`.

22-internal-to-1-external is not a "too entangled to ever separate" result
in the absolute sense, but it is a result that says the real internal
audience for this code is `conversations/` itself, not some external
`contacts/` consumer that doesn't exist yet. Hoisting it to a sibling
top-level bucket today would lengthen the relative-import path for all 22
internal call sites (`../identity/...` inside `encryption/` becomes
`../../conversations/encryption/identity/...` or similar from wherever it
lands) for a separation with exactly one real present-day beneficiary.

**Decision: keep it nested at
`src/os/messenger/conversations/encryption/identity/**`.** The empty
`src/os/messenger/contacts/` directory is still created (per this arc's own
directory-scaffolding deliverable) as a **documented reserved pointer** —
its README says explicitly where the real code lives and under what
condition a future arc should reconsider hoisting it (see that README).

## Bucket totals

| Bucket | File count |
|---|---|
| `src/os/messenger/conversations/` | 377 |
| `src/os/messenger/adapters/nostr/` | 57 (12 from `src/nostr/` + 24 from `delivery/nostr/` + 21 from `transport/`) |
| `src/os/messenger/device/` | 88 |
| `src/os/messenger/board/` | 85 |
| `src/os/messenger/notifications/` | 3 |
| `src/os/messenger/desktop/` | 154 |
| **Total** | **764** |

`src/os/messenger/contacts/` and `src/os/messenger/onion/` are not in this
table — zero files map to either (see "The `contacts/` decision" above for
`contacts/`; `onion/` has no source anywhere in the repo to map, see its own
README).

## Full mapping, grouped by target bucket


### 1. `src/os/messenger/conversations/` — from `src/conversation/**` (minus delivery/nostr and transport, see adapters/nostr below)

377 files.

| Old path | New path |
|---|---|
| `src/conversation/activation/append_only_fedos_conversation_activation_persistence.ts` | `src/os/messenger/conversations/activation/append_only_fedos_conversation_activation_persistence.ts` |
| `src/conversation/activation/fedos_conversation_activation_persistence.ts` | `src/os/messenger/conversations/activation/fedos_conversation_activation_persistence.ts` |
| `src/conversation/activation/fedos_conversation_active_lookup.ts` | `src/os/messenger/conversations/activation/fedos_conversation_active_lookup.ts` |
| `src/conversation/activation/fedos_conversation_direct_activation_coordinator.ts` | `src/os/messenger/conversations/activation/fedos_conversation_direct_activation_coordinator.ts` |
| `src/conversation/activation/fedos_conversation_direct_activation_result.ts` | `src/os/messenger/conversations/activation/fedos_conversation_direct_activation_result.ts` |
| `src/conversation/activation/fedos_conversation_reactivation_coordinator.ts` | `src/os/messenger/conversations/activation/fedos_conversation_reactivation_coordinator.ts` |
| `src/conversation/activation/fedos_conversation_reactivation_result.ts` | `src/os/messenger/conversations/activation/fedos_conversation_reactivation_result.ts` |
| `src/conversation/activation/fedos_persisted_conversation_activation_v1.ts` | `src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.ts` |
| `src/conversation/activation/in_memory_fedos_conversation_activation_persistence.ts` | `src/os/messenger/conversations/activation/in_memory_fedos_conversation_activation_persistence.ts` |
| `src/conversation/archive_cli/fedos_conversation_archive_cli_directory.ts` | `src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_directory.ts` |
| `src/conversation/archive_cli/fedos_conversation_archive_cli_export.ts` | `src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_export.ts` |
| `src/conversation/archive_cli/fedos_conversation_archive_cli_file_system.ts` | `src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_file_system.ts` |
| `src/conversation/archive_cli/fedos_conversation_archive_cli_import.ts` | `src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_import.ts` |
| `src/conversation/archive_cli/fedos_conversation_archive_cli_metadata.ts` | `src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_metadata.ts` |
| `src/conversation/archive_cli/fedos_conversation_archive_cli_package_codec.ts` | `src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_package_codec.ts` |
| `src/conversation/archive_cli/fedos_conversation_archive_cli_package.ts` | `src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_package.ts` |
| `src/conversation/archive/fedos_conversation_archive_bundle_codec.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_bundle_codec.ts` |
| `src/conversation/archive/fedos_conversation_archive_bundle.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.ts` |
| `src/conversation/archive/fedos_conversation_archive_collector.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_collector.ts` |
| `src/conversation/archive/fedos_conversation_archive_direct_subject.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_direct_subject.ts` |
| `src/conversation/archive/fedos_conversation_archive_duplicate_detection.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_duplicate_detection.ts` |
| `src/conversation/archive/fedos_conversation_archive_encryption.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_encryption.ts` |
| `src/conversation/archive/fedos_conversation_archive_group_section.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_group_section.ts` |
| `src/conversation/archive/fedos_conversation_archive_header.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_header.ts` |
| `src/conversation/archive/fedos_conversation_archive_integrity.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_integrity.ts` |
| `src/conversation/archive/fedos_conversation_archive_manifest_codec.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_manifest_codec.ts` |
| `src/conversation/archive/fedos_conversation_archive_manifest.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_manifest.ts` |
| `src/conversation/archive/fedos_conversation_archive_restore.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_restore.ts` |
| `src/conversation/archive/fedos_conversation_archive_schema_version.ts` | `src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.ts` |
| `src/conversation/archive/fs/fedos_conversation_archive_file_authority.ts` | `src/os/messenger/conversations/archive/fs/fedos_conversation_archive_file_authority.ts` |
| `src/conversation/archive/fs/fedos_conversation_archive_file_container.ts` | `src/os/messenger/conversations/archive/fs/fedos_conversation_archive_file_container.ts` |
| `src/conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.ts` | `src/os/messenger/conversations/archive/runtime/fedos_conversation_archive_runtime_assembly.ts` |
| `src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts` | `src/os/messenger/conversations/archive/runtime/fedos_conversation_archive_runtime.ts` |
| `src/conversation/capability/coordination/append_only_fedos_conversation_redemption_coordination_persistence.ts` | `src/os/messenger/conversations/capability/coordination/append_only_fedos_conversation_redemption_coordination_persistence.ts` |
| `src/conversation/capability/coordination/fedos_conversation_durable_redemption_coordinator.ts` | `src/os/messenger/conversations/capability/coordination/fedos_conversation_durable_redemption_coordinator.ts` |
| `src/conversation/capability/coordination/fedos_conversation_redemption_coordination_persistence.ts` | `src/os/messenger/conversations/capability/coordination/fedos_conversation_redemption_coordination_persistence.ts` |
| `src/conversation/capability/coordination/fedos_persisted_conversation_redemption_coordination_v1.ts` | `src/os/messenger/conversations/capability/coordination/fedos_persisted_conversation_redemption_coordination_v1.ts` |
| `src/conversation/capability/coordination/in_memory_fedos_conversation_redemption_coordination_persistence.ts` | `src/os/messenger/conversations/capability/coordination/in_memory_fedos_conversation_redemption_coordination_persistence.ts` |
| `src/conversation/capability/fedos_conversation_capability_bearer_secret.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_bearer_secret.ts` |
| `src/conversation/capability/fedos_conversation_capability_descriptor.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_descriptor.ts` |
| `src/conversation/capability/fedos_conversation_capability_id.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_id.ts` |
| `src/conversation/capability/fedos_conversation_capability_issuance_result.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_issuance_result.ts` |
| `src/conversation/capability/fedos_conversation_capability_issuer_authority.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_issuer_authority.ts` |
| `src/conversation/capability/fedos_conversation_capability_redemption_authority.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_redemption_authority.ts` |
| `src/conversation/capability/fedos_conversation_capability_redemption_request.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_redemption_request.ts` |
| `src/conversation/capability/fedos_conversation_capability_redemption_result.ts` | `src/os/messenger/conversations/capability/fedos_conversation_capability_redemption_result.ts` |
| `src/conversation/capability/in_memory_fedos_conversation_capability_authority.ts` | `src/os/messenger/conversations/capability/in_memory_fedos_conversation_capability_authority.ts` |
| `src/conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.ts` | `src/os/messenger/conversations/capability/persistence/append_only_fedos_conversation_capability_persistence.ts` |
| `src/conversation/capability/persistence/fedos_conversation_capability_bearer_verifier.ts` | `src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_bearer_verifier.ts` |
| `src/conversation/capability/persistence/fedos_conversation_capability_codec.ts` | `src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_codec.ts` |
| `src/conversation/capability/persistence/fedos_conversation_capability_persistence.ts` | `src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_persistence.ts` |
| `src/conversation/capability/persistence/fedos_persisted_conversation_capability_v1.ts` | `src/os/messenger/conversations/capability/persistence/fedos_persisted_conversation_capability_v1.ts` |
| `src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.ts` | `src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.ts` |
| `src/conversation/capability/persistence/persisted_fedos_conversation_capability_authority.ts` | `src/os/messenger/conversations/capability/persistence/persisted_fedos_conversation_capability_authority.ts` |
| `src/conversation/construction/append_only_fedos_conversation_draft_management_persistence.ts` | `src/os/messenger/conversations/construction/append_only_fedos_conversation_draft_management_persistence.ts` |
| `src/conversation/construction/append_only_fedos_conversation_draft_persistence.ts` | `src/os/messenger/conversations/construction/append_only_fedos_conversation_draft_persistence.ts` |
| `src/conversation/construction/coordination/append_only_fedos_conversation_construction_coordination_persistence.ts` | `src/os/messenger/conversations/construction/coordination/append_only_fedos_conversation_construction_coordination_persistence.ts` |
| `src/conversation/construction/coordination/fedos_conversation_construction_coordination_persistence.ts` | `src/os/messenger/conversations/construction/coordination/fedos_conversation_construction_coordination_persistence.ts` |
| `src/conversation/construction/coordination/fedos_persisted_conversation_construction_coordination_v1.ts` | `src/os/messenger/conversations/construction/coordination/fedos_persisted_conversation_construction_coordination_v1.ts` |
| `src/conversation/construction/coordination/in_memory_fedos_conversation_construction_coordination_persistence.ts` | `src/os/messenger/conversations/construction/coordination/in_memory_fedos_conversation_construction_coordination_persistence.ts` |
| `src/conversation/construction/fedos_conversation_creator_identity_authority.ts` | `src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.ts` |
| `src/conversation/construction/fedos_conversation_draft_management_persistence.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_management_persistence.ts` |
| `src/conversation/construction/fedos_conversation_draft_management_result.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_management_result.ts` |
| `src/conversation/construction/fedos_conversation_draft_manager.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_manager.ts` |
| `src/conversation/construction/fedos_conversation_draft_persistence.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_persistence.ts` |
| `src/conversation/construction/fedos_conversation_draft_record_codec.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_record_codec.ts` |
| `src/conversation/construction/fedos_conversation_draft_record_validator.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_record_validator.ts` |
| `src/conversation/construction/fedos_conversation_draft_record.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_record.ts` |
| `src/conversation/construction/fedos_conversation_draft_view.ts` | `src/os/messenger/conversations/construction/fedos_conversation_draft_view.ts` |
| `src/conversation/construction/fedos_conversation_lifecycle_state.ts` | `src/os/messenger/conversations/construction/fedos_conversation_lifecycle_state.ts` |
| `src/conversation/construction/fedos_conversation_managed_draft_state.ts` | `src/os/messenger/conversations/construction/fedos_conversation_managed_draft_state.ts` |
| `src/conversation/construction/fedos_persisted_conversation_draft_management_state_v1.ts` | `src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_management_state_v1.ts` |
| `src/conversation/construction/fedos_persisted_conversation_draft_record_v1.ts` | `src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.ts` |
| `src/conversation/construction/fedos_private_conversation_construction_command.ts` | `src/os/messenger/conversations/construction/fedos_private_conversation_construction_command.ts` |
| `src/conversation/construction/fedos_private_conversation_construction_coordinator.ts` | `src/os/messenger/conversations/construction/fedos_private_conversation_construction_coordinator.ts` |
| `src/conversation/construction/fedos_private_conversation_construction_result.ts` | `src/os/messenger/conversations/construction/fedos_private_conversation_construction_result.ts` |
| `src/conversation/construction/fedos_private_conversation_id.ts` | `src/os/messenger/conversations/construction/fedos_private_conversation_id.ts` |
| `src/conversation/construction/fedos_private_conversation_policy.ts` | `src/os/messenger/conversations/construction/fedos_private_conversation_policy.ts` |
| `src/conversation/construction/in_memory_fedos_conversation_draft_management_persistence.ts` | `src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_management_persistence.ts` |
| `src/conversation/construction/in_memory_fedos_conversation_draft_persistence.ts` | `src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.ts` |
| `src/conversation/deletion_request/append_only_fedos_deletion_acknowledgement_persistence.ts` | `src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_acknowledgement_persistence.ts` |
| `src/conversation/deletion_request/append_only_fedos_deletion_recipient_decision_persistence.ts` | `src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_recipient_decision_persistence.ts` |
| `src/conversation/deletion_request/append_only_fedos_deletion_request_inbox_summary_persistence.ts` | `src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_request_inbox_summary_persistence.ts` |
| `src/conversation/deletion_request/append_only_fedos_deletion_request_pending_review_persistence.ts` | `src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_request_pending_review_persistence.ts` |
| `src/conversation/deletion_request/append_only_fedos_deletion_request_state_persistence.ts` | `src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_request_state_persistence.ts` |
| `src/conversation/deletion_request/fedos_deletion_acknowledgement_inbound_coordinator.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_acknowledgement_inbound_coordinator.ts` |
| `src/conversation/deletion_request/fedos_deletion_acknowledgement_outbound_coordinator.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_acknowledgement_outbound_coordinator.ts` |
| `src/conversation/deletion_request/fedos_deletion_acknowledgement_persistence.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_acknowledgement_persistence.ts` |
| `src/conversation/deletion_request/fedos_deletion_acknowledgement_record.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_acknowledgement_record.ts` |
| `src/conversation/deletion_request/fedos_deletion_acknowledgement_signing.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_acknowledgement_signing.ts` |
| `src/conversation/deletion_request/fedos_deletion_recipient_decision_persistence.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_recipient_decision_persistence.ts` |
| `src/conversation/deletion_request/fedos_deletion_recipient_decision_state.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_recipient_decision_state.ts` |
| `src/conversation/deletion_request/fedos_deletion_recipient_policy.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_recipient_policy.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_acknowledgement_outcome.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_acknowledgement_outcome.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_authorization_assessment.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_authorization_assessment.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_authorization_outcome.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_authorization_outcome.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_canonical_bytes.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_canonical_bytes.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_control_payload.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_control_payload.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_conversation_existence_adapter.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_conversation_existence_adapter.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_id.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_id.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_inbound_coordinator.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_inbound_coordinator.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_inbox_summary.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_inbox_summary.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_lifecycle_state.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_lifecycle_state.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_outbound_coordinator.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_outbound_coordinator.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_pending_review_persistence.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_pending_review_persistence.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_reason_code.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_reason_code.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_recipient_evaluation.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_recipient_evaluation.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_record.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_record.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_retry_plan.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_retry_plan.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_runtime.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_runtime.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_safe_status.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_safe_status.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_scope.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_scope.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_signing.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_signing.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_state_persistence.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_state_persistence.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_target_type.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_target_type.ts` |
| `src/conversation/deletion_request/fedos_deletion_request_validation.ts` | `src/os/messenger/conversations/deletion_request/fedos_deletion_request_validation.ts` |
| `src/conversation/deletion_request/fedos_persisted_deletion_acknowledgement_record_v1.ts` | `src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_acknowledgement_record_v1.ts` |
| `src/conversation/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.ts` | `src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.ts` |
| `src/conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.ts` | `src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_request_state_record_v1.ts` |
| `src/conversation/deletion_request/in_memory_fedos_deletion_acknowledgement_persistence.ts` | `src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_acknowledgement_persistence.ts` |
| `src/conversation/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.ts` | `src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.ts` |
| `src/conversation/deletion_request/in_memory_fedos_deletion_request_state_persistence.ts` | `src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_request_state_persistence.ts` |
| `src/conversation/deletion/append_only_fedos_deletion_execution_persistence.ts` | `src/os/messenger/conversations/deletion/append_only_fedos_deletion_execution_persistence.ts` |
| `src/conversation/deletion/fedos_deletion_archive_file_authority.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_archive_file_authority.ts` |
| `src/conversation/deletion/fedos_deletion_archive_path_authority.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_archive_path_authority.ts` |
| `src/conversation/deletion/fedos_deletion_assessment.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_assessment.ts` |
| `src/conversation/deletion/fedos_deletion_capability_descriptor.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_capability_descriptor.ts` |
| `src/conversation/deletion/fedos_deletion_evidence.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_evidence.ts` |
| `src/conversation/deletion/fedos_deletion_execution_coordinator.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_execution_coordinator.ts` |
| `src/conversation/deletion/fedos_deletion_execution_persistence.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_execution_persistence.ts` |
| `src/conversation/deletion/fedos_deletion_non_guarantees.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_non_guarantees.ts` |
| `src/conversation/deletion/fedos_deletion_operation.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_operation.ts` |
| `src/conversation/deletion/fedos_deletion_plan.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_plan.ts` |
| `src/conversation/deletion/fedos_deletion_status.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_status.ts` |
| `src/conversation/deletion/fedos_deletion_target.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_target.ts` |
| `src/conversation/deletion/fedos_deletion_user_summary.ts` | `src/os/messenger/conversations/deletion/fedos_deletion_user_summary.ts` |
| `src/conversation/deletion/fedos_persisted_deletion_execution_record_v1.ts` | `src/os/messenger/conversations/deletion/fedos_persisted_deletion_execution_record_v1.ts` |
| `src/conversation/deletion/in_memory_fedos_deletion_execution_persistence.ts` | `src/os/messenger/conversations/deletion/in_memory_fedos_deletion_execution_persistence.ts` |
| `src/conversation/encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.ts` | `src/os/messenger/conversations/encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.ts` |
| `src/conversation/encryption/coordination/fedos_conversation_encryption_coordination_persistence.ts` | `src/os/messenger/conversations/encryption/coordination/fedos_conversation_encryption_coordination_persistence.ts` |
| `src/conversation/encryption/coordination/fedos_persisted_conversation_encryption_coordination_v1.ts` | `src/os/messenger/conversations/encryption/coordination/fedos_persisted_conversation_encryption_coordination_v1.ts` |
| `src/conversation/encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.ts` | `src/os/messenger/conversations/encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.ts` |
| `src/conversation/encryption/fedos_conversation_decryption_authority.ts` | `src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.ts` |
| `src/conversation/encryption/fedos_conversation_decryption_coordinator.ts` | `src/os/messenger/conversations/encryption/fedos_conversation_decryption_coordinator.ts` |
| `src/conversation/encryption/fedos_conversation_encryption_authority.ts` | `src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.ts` |
| `src/conversation/encryption/fedos_conversation_encryption_coordinator.ts` | `src/os/messenger/conversations/encryption/fedos_conversation_encryption_coordinator.ts` |
| `src/conversation/encryption/fedos_conversation_membership_readiness.ts` | `src/os/messenger/conversations/encryption/fedos_conversation_membership_readiness.ts` |
| `src/conversation/encryption/fedos_unavailable_conversation_decryption_authority.ts` | `src/os/messenger/conversations/encryption/fedos_unavailable_conversation_decryption_authority.ts` |
| `src/conversation/encryption/fedos_unavailable_conversation_encryption_authority.ts` | `src/os/messenger/conversations/encryption/fedos_unavailable_conversation_encryption_authority.ts` |
| `src/conversation/encryption/fedos_wasm_conversation_decryption_authority.ts` | `src/os/messenger/conversations/encryption/fedos_wasm_conversation_decryption_authority.ts` |
| `src/conversation/encryption/fedos_wasm_conversation_encryption_authority.ts` | `src/os/messenger/conversations/encryption/fedos_wasm_conversation_encryption_authority.ts` |
| `src/conversation/encryption/identity/fedos_conversation_counterparty_public_key_resolver.ts` | `src/os/messenger/conversations/encryption/identity/fedos_conversation_counterparty_public_key_resolver.ts` |
| `src/conversation/encryption/identity/fedos_conversation_identity_resolver.ts` | `src/os/messenger/conversations/encryption/identity/fedos_conversation_identity_resolver.ts` |
| `src/conversation/encryption/identity/fedos_conversation_key_resolver.ts` | `src/os/messenger/conversations/encryption/identity/fedos_conversation_key_resolver.ts` |
| `src/conversation/encryption/identity/fedos_conversation_local_account_index_authority.ts` | `src/os/messenger/conversations/encryption/identity/fedos_conversation_local_account_index_authority.ts` |
| `src/conversation/encryption/identity/fedos_conversation_participant_resolver.ts` | `src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.ts` |
| `src/conversation/encryption/production/fedos_conversation_canonical_production_crypto_authority_factory.ts` | `src/os/messenger/conversations/encryption/production/fedos_conversation_canonical_production_crypto_authority_factory.ts` |
| `src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts` | `src/os/messenger/conversations/encryption/production/fedos_conversation_production_crypto_authority_factory.ts` |
| `src/conversation/encryption/production/fedos_conversation_production_crypto_capability_result.ts` | `src/os/messenger/conversations/encryption/production/fedos_conversation_production_crypto_capability_result.ts` |
| `src/conversation/envelope/fedos_conversation_envelope_associated_data.ts` | `src/os/messenger/conversations/envelope/fedos_conversation_envelope_associated_data.ts` |
| `src/conversation/envelope/fedos_conversation_envelope_id.ts` | `src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.ts` |
| `src/conversation/envelope/fedos_conversation_message_envelope_validator.ts` | `src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.ts` |
| `src/conversation/envelope/fedos_conversation_message_envelope.ts` | `src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.ts` |
| `src/conversation/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.ts` | `src/os/messenger/conversations/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.ts` |
| `src/conversation/envelope/persistence/fedos_conversation_message_envelope_codec.ts` | `src/os/messenger/conversations/envelope/persistence/fedos_conversation_message_envelope_codec.ts` |
| `src/conversation/envelope/persistence/fedos_conversation_message_envelope_persistence.ts` | `src/os/messenger/conversations/envelope/persistence/fedos_conversation_message_envelope_persistence.ts` |
| `src/conversation/envelope/persistence/fedos_persisted_conversation_message_envelope_v1.ts` | `src/os/messenger/conversations/envelope/persistence/fedos_persisted_conversation_message_envelope_v1.ts` |
| `src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.ts` | `src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.ts` |
| `src/conversation/fedos_conversation_hydration.ts` | `src/os/messenger/conversations/fedos_conversation_hydration.ts` |
| `src/conversation/fedos_conversation_id.ts` | `src/os/messenger/conversations/fedos_conversation_id.ts` |
| `src/conversation/fedos_conversation_reader.ts` | `src/os/messenger/conversations/fedos_conversation_reader.ts` |
| `src/conversation/fedos_conversation_record_validator.ts` | `src/os/messenger/conversations/fedos_conversation_record_validator.ts` |
| `src/conversation/fedos_conversation_record.ts` | `src/os/messenger/conversations/fedos_conversation_record.ts` |
| `src/conversation/group/append_only_fedos_group_direct_path_persistence.ts` | `src/os/messenger/conversations/group/append_only_fedos_group_direct_path_persistence.ts` |
| `src/conversation/group/append_only_fedos_group_fanout_delivery_persistence.ts` | `src/os/messenger/conversations/group/append_only_fedos_group_fanout_delivery_persistence.ts` |
| `src/conversation/group/append_only_fedos_group_generation_persistence.ts` | `src/os/messenger/conversations/group/append_only_fedos_group_generation_persistence.ts` |
| `src/conversation/group/append_only_fedos_group_message_persistence.ts` | `src/os/messenger/conversations/group/append_only_fedos_group_message_persistence.ts` |
| `src/conversation/group/fedos_conversation_group_runtime.ts` | `src/os/messenger/conversations/group/fedos_conversation_group_runtime.ts` |
| `src/conversation/group/fedos_group_admission.ts` | `src/os/messenger/conversations/group/fedos_group_admission.ts` |
| `src/conversation/group/fedos_group_direct_path_authority.ts` | `src/os/messenger/conversations/group/fedos_group_direct_path_authority.ts` |
| `src/conversation/group/fedos_group_direct_path.ts` | `src/os/messenger/conversations/group/fedos_group_direct_path.ts` |
| `src/conversation/group/fedos_group_fanout_delivery.ts` | `src/os/messenger/conversations/group/fedos_group_fanout_delivery.ts` |
| `src/conversation/group/fedos_group_generation_authority.ts` | `src/os/messenger/conversations/group/fedos_group_generation_authority.ts` |
| `src/conversation/group/fedos_group_generation.ts` | `src/os/messenger/conversations/group/fedos_group_generation.ts` |
| `src/conversation/group/fedos_group_message_local_read_result.ts` | `src/os/messenger/conversations/group/fedos_group_message_local_read_result.ts` |
| `src/conversation/group/fedos_group_message.ts` | `src/os/messenger/conversations/group/fedos_group_message.ts` |
| `src/conversation/group/fedos_group_participant_limit.ts` | `src/os/messenger/conversations/group/fedos_group_participant_limit.ts` |
| `src/conversation/group/fedos_group_read_facade.ts` | `src/os/messenger/conversations/group/fedos_group_read_facade.ts` |
| `src/conversation/group/fedos_group_send_coordinator.ts` | `src/os/messenger/conversations/group/fedos_group_send_coordinator.ts` |
| `src/conversation/group/fedos_group_usability.ts` | `src/os/messenger/conversations/group/fedos_group_usability.ts` |
| `src/conversation/group/in_memory_fedos_group_direct_path_persistence.ts` | `src/os/messenger/conversations/group/in_memory_fedos_group_direct_path_persistence.ts` |
| `src/conversation/group/in_memory_fedos_group_fanout_delivery_persistence.ts` | `src/os/messenger/conversations/group/in_memory_fedos_group_fanout_delivery_persistence.ts` |
| `src/conversation/group/in_memory_fedos_group_generation_persistence.ts` | `src/os/messenger/conversations/group/in_memory_fedos_group_generation_persistence.ts` |
| `src/conversation/group/in_memory_fedos_group_message_persistence.ts` | `src/os/messenger/conversations/group/in_memory_fedos_group_message_persistence.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_acceptance_state.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_acceptance_state.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_canonical.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_canonical.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_continuity_evidence.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_continuity_evidence.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_device_corroboration.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_device_corroboration.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_downstream_plan.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_downstream_plan.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_evidence_evaluation.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_evidence_evaluation.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_facade.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_facade.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_fact_conflict_detection.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_fact_conflict_detection.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_fact.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_fact.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_id_limits.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_id_limits.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_id.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_id.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_new_key_proof.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_new_key_proof.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_ratchet_impact_plan.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_ratchet_impact_plan.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_record.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_safe_status.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_safe_status.ts` |
| `src/conversation/identity_transition/fedos_identity_transition_vocabulary.ts` | `src/os/messenger/conversations/identity_transition/fedos_identity_transition_vocabulary.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_device_evidence_display.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_device_evidence_display.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_inbound_notification_coordinator.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_inbound_notification_coordinator.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_local_decision.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_local_decision.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_manual_verification.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_manual_verification.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_notification.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_notification.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_peer_observation_conflict_detection.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_observation_conflict_detection.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_peer_observation.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_observation.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_impact_view.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_impact_view.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_authorization.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_authorization.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_safe_view.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_safe_view.ts` |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_warning_codes.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_warning_codes.ts` |
| `src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_conversation_continuity_persistence.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_conversation_continuity_persistence.ts` |
| `src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_local_decision_persistence.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_local_decision_persistence.ts` |
| `src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_manual_verification_persistence.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_manual_verification_persistence.ts` |
| `src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_peer_observation_persistence.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_peer_observation_persistence.ts` |
| `src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_ratchet_reset_link_persistence.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_ratchet_reset_link_persistence.ts` |
| `src/conversation/identity_transition/peer_integration/persistence/fedos_identity_transition_peer_observation_persistence.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/persistence/fedos_identity_transition_peer_observation_persistence.ts` |
| `src/conversation/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.ts` | `src/os/messenger/conversations/identity_transition/peer_integration/persistence/in_memory_fedos_identity_transition_peer_observation_persistence.ts` |
| `src/conversation/identity_transition/persistence/append_only_fedos_identity_transition_fact_persistence.ts` | `src/os/messenger/conversations/identity_transition/persistence/append_only_fedos_identity_transition_fact_persistence.ts` |
| `src/conversation/identity_transition/persistence/fedos_identity_transition_fact_persistence.ts` | `src/os/messenger/conversations/identity_transition/persistence/fedos_identity_transition_fact_persistence.ts` |
| `src/conversation/identity_transition/persistence/in_memory_fedos_identity_transition_fact_persistence.ts` | `src/os/messenger/conversations/identity_transition/persistence/in_memory_fedos_identity_transition_fact_persistence.ts` |
| `src/conversation/invitation_bootstrap/fedos_conversation_invitation_advertisement.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_advertisement.ts` |
| `src/conversation/invitation_bootstrap/fedos_conversation_invitation_authentication.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_authentication.ts` |
| `src/conversation/invitation_bootstrap/fedos_conversation_invitation_control_payload.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_control_payload.ts` |
| `src/conversation/invitation_bootstrap/fedos_conversation_invitation_inbound_coordinator.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_inbound_coordinator.ts` |
| `src/conversation/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.ts` |
| `src/conversation/invitation_bootstrap/fedos_conversation_invitation_received_record.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_received_record.ts` |
| `src/conversation/invitation_bootstrap/fedos_conversation_invitation_runtime.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_runtime.ts` |
| `src/conversation/invitation_bootstrap/fedos_secure_random_conversation_invitation_id_generator.ts` | `src/os/messenger/conversations/invitation_bootstrap/fedos_secure_random_conversation_invitation_id_generator.ts` |
| `src/conversation/invitation_bootstrap/persistence/append_only_fedos_conversation_invitation_received_persistence.ts` | `src/os/messenger/conversations/invitation_bootstrap/persistence/append_only_fedos_conversation_invitation_received_persistence.ts` |
| `src/conversation/invitation_bootstrap/persistence/fedos_conversation_invitation_received_codec.ts` | `src/os/messenger/conversations/invitation_bootstrap/persistence/fedos_conversation_invitation_received_codec.ts` |
| `src/conversation/invitation_bootstrap/persistence/fedos_conversation_invitation_received_persistence.ts` | `src/os/messenger/conversations/invitation_bootstrap/persistence/fedos_conversation_invitation_received_persistence.ts` |
| `src/conversation/invitation_bootstrap/persistence/in_memory_fedos_conversation_invitation_received_persistence.ts` | `src/os/messenger/conversations/invitation_bootstrap/persistence/in_memory_fedos_conversation_invitation_received_persistence.ts` |
| `src/conversation/invitation/append_only_fedos_conversation_invitation_revocation_registry.ts` | `src/os/messenger/conversations/invitation/append_only_fedos_conversation_invitation_revocation_registry.ts` |
| `src/conversation/invitation/fedos_conversation_invitation_result.ts` | `src/os/messenger/conversations/invitation/fedos_conversation_invitation_result.ts` |
| `src/conversation/invitation/fedos_conversation_invitation_revocation_registry.ts` | `src/os/messenger/conversations/invitation/fedos_conversation_invitation_revocation_registry.ts` |
| `src/conversation/invitation/fedos_conversation_invitation_token.ts` | `src/os/messenger/conversations/invitation/fedos_conversation_invitation_token.ts` |
| `src/conversation/invitation/fedos_conversation_invitation_transport.ts` | `src/os/messenger/conversations/invitation/fedos_conversation_invitation_transport.ts` |
| `src/conversation/invitation/fedos_persisted_conversation_invitation_revocation_v1.ts` | `src/os/messenger/conversations/invitation/fedos_persisted_conversation_invitation_revocation_v1.ts` |
| `src/conversation/invitation/in_memory_fedos_conversation_invitation_revocation_registry.ts` | `src/os/messenger/conversations/invitation/in_memory_fedos_conversation_invitation_revocation_registry.ts` |
| `src/conversation/membership/fedos_conversation_membership_authority.ts` | `src/os/messenger/conversations/membership/fedos_conversation_membership_authority.ts` |
| `src/conversation/membership/fedos_conversation_membership_id.ts` | `src/os/messenger/conversations/membership/fedos_conversation_membership_id.ts` |
| `src/conversation/membership/fedos_conversation_membership_result.ts` | `src/os/messenger/conversations/membership/fedos_conversation_membership_result.ts` |
| `src/conversation/membership/fedos_conversation_membership_state.ts` | `src/os/messenger/conversations/membership/fedos_conversation_membership_state.ts` |
| `src/conversation/membership/fedos_conversation_membership_transition.ts` | `src/os/messenger/conversations/membership/fedos_conversation_membership_transition.ts` |
| `src/conversation/membership/fedos_conversation_membership_validator.ts` | `src/os/messenger/conversations/membership/fedos_conversation_membership_validator.ts` |
| `src/conversation/membership/fedos_conversation_membership.ts` | `src/os/messenger/conversations/membership/fedos_conversation_membership.ts` |
| `src/conversation/membership/fedos_conversation_participant_reference_validator.ts` | `src/os/messenger/conversations/membership/fedos_conversation_participant_reference_validator.ts` |
| `src/conversation/membership/fedos_conversation_participant_reference.ts` | `src/os/messenger/conversations/membership/fedos_conversation_participant_reference.ts` |
| `src/conversation/membership/fedos_conversation_role.ts` | `src/os/messenger/conversations/membership/fedos_conversation_role.ts` |
| `src/conversation/membership/in_memory_fedos_conversation_membership_authority.ts` | `src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.ts` |
| `src/conversation/membership/persistence/append_only_fedos_conversation_membership_persistence.ts` | `src/os/messenger/conversations/membership/persistence/append_only_fedos_conversation_membership_persistence.ts` |
| `src/conversation/membership/persistence/fedos_conversation_membership_codec.ts` | `src/os/messenger/conversations/membership/persistence/fedos_conversation_membership_codec.ts` |
| `src/conversation/membership/persistence/fedos_conversation_membership_persistence.ts` | `src/os/messenger/conversations/membership/persistence/fedos_conversation_membership_persistence.ts` |
| `src/conversation/membership/persistence/fedos_persisted_conversation_membership_v1.ts` | `src/os/messenger/conversations/membership/persistence/fedos_persisted_conversation_membership_v1.ts` |
| `src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.ts` | `src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.ts` |
| `src/conversation/membership/persistence/persisted_fedos_conversation_membership_authority.ts` | `src/os/messenger/conversations/membership/persistence/persisted_fedos_conversation_membership_authority.ts` |
| `src/conversation/messaging/fedos_conversation_direct_message_plaintext_policy.ts` | `src/os/messenger/conversations/messaging/fedos_conversation_direct_message_plaintext_policy.ts` |
| `src/conversation/messaging/fedos_conversation_direct_message_read_result.ts` | `src/os/messenger/conversations/messaging/fedos_conversation_direct_message_read_result.ts` |
| `src/conversation/messaging/fedos_conversation_direct_message_send_result.ts` | `src/os/messenger/conversations/messaging/fedos_conversation_direct_message_send_result.ts` |
| `src/conversation/messaging/fedos_conversation_direct_message_summary.ts` | `src/os/messenger/conversations/messaging/fedos_conversation_direct_message_summary.ts` |
| `src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts` | `src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.ts` |
| `src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.ts` | `src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.ts` |
| `src/conversation/payload_storage/fedos_conversation_payload_codec.ts` | `src/os/messenger/conversations/payload_storage/fedos_conversation_payload_codec.ts` |
| `src/conversation/payload_storage/fedos_conversation_payload_descriptor_validator.ts` | `src/os/messenger/conversations/payload_storage/fedos_conversation_payload_descriptor_validator.ts` |
| `src/conversation/payload_storage/fedos_conversation_payload_descriptor.ts` | `src/os/messenger/conversations/payload_storage/fedos_conversation_payload_descriptor.ts` |
| `src/conversation/payload_storage/fedos_conversation_payload_id.ts` | `src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.ts` |
| `src/conversation/payload_storage/fedos_conversation_payload_storage.ts` | `src/os/messenger/conversations/payload_storage/fedos_conversation_payload_storage.ts` |
| `src/conversation/payload_storage/fedos_persisted_conversation_payload_v1.ts` | `src/os/messenger/conversations/payload_storage/fedos_persisted_conversation_payload_v1.ts` |
| `src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.ts` | `src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.ts` |
| `src/conversation/persistence/append_only_fedos_conversation_persistence.ts` | `src/os/messenger/conversations/persistence/append_only_fedos_conversation_persistence.ts` |
| `src/conversation/persistence/fedos_conversation_persistence.ts` | `src/os/messenger/conversations/persistence/fedos_conversation_persistence.ts` |
| `src/conversation/persistence/fedos_conversation_record_codec.ts` | `src/os/messenger/conversations/persistence/fedos_conversation_record_codec.ts` |
| `src/conversation/persistence/fedos_persisted_conversation_record_v1.ts` | `src/os/messenger/conversations/persistence/fedos_persisted_conversation_record_v1.ts` |
| `src/conversation/persistence/in_memory_fedos_conversation_persistence.ts` | `src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.ts` |
| `src/conversation/ratchet/fedos_direct_conversation_forward_secrecy_route.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_conversation_forward_secrecy_route.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_conversation_runtime.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_conversation_runtime.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_counters.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_counters.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_device_pair_resolver.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_pair_resolver.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_inbound_integration.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_inbound_integration.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_limits.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_limits.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_live_session_cache.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_live_session_cache.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_outbound_integration.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_outbound_integration.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_readiness.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_readiness.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_recovered_secret_handle.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_recovered_secret_handle.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_recovery_outcome.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_recovery_outcome.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_reset_coordinator.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_reset_coordinator.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_route_resolution.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_route_resolution.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_sealing_authority.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_secret_checkpoint.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_secret_checkpoint.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_binding.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_binding.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_id.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_lifecycle.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_lifecycle.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_record.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_record.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_reset_authentication.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_authentication.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_reset_authority.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_authority.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_reset_nonce.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_nonce.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_reset_reason.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_reason.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_session_reset_record.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_record.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_skipped_key_index.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_skipped_key_index.ts` |
| `src/conversation/ratchet/fedos_direct_ratchet_state_runtime.ts` | `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_state_runtime.ts` |
| `src/conversation/ratchet/fedos_sealed_direct_ratchet_secret_record.ts` | `src/os/messenger/conversations/ratchet/fedos_sealed_direct_ratchet_secret_record.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_outcome.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_outcome.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_policy.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_policy.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_advertisement.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_advertisement.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_inbound_coordinator.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_inbound_coordinator.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_nonce.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_nonce.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_outbound_coordinator.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_outbound_coordinator.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_safe_status.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_safe_status.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_session_action_recommendation.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_session_action_recommendation.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.ts` |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_lifecycle_notification.ts` | `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_lifecycle_notification.ts` |
| `src/conversation/ratchet/peer_capability/persistence/append_only_fedos_ratchet_peer_capability_observation_persistence.ts` | `src/os/messenger/conversations/ratchet/peer_capability/persistence/append_only_fedos_ratchet_peer_capability_observation_persistence.ts` |
| `src/conversation/ratchet/peer_capability/persistence/fedos_ratchet_peer_capability_observation_persistence.ts` | `src/os/messenger/conversations/ratchet/peer_capability/persistence/fedos_ratchet_peer_capability_observation_persistence.ts` |
| `src/conversation/ratchet/peer_capability/persistence/in_memory_fedos_ratchet_peer_capability_observation_persistence.ts` | `src/os/messenger/conversations/ratchet/peer_capability/persistence/in_memory_fedos_ratchet_peer_capability_observation_persistence.ts` |
| `src/conversation/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.ts` |
| `src/conversation/ratchet/persistence/append_only_fedos_direct_ratchet_session_reset_record_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_reset_record_persistence.ts` |
| `src/conversation/ratchet/persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.ts` |
| `src/conversation/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.ts` |
| `src/conversation/ratchet/persistence/fedos_direct_ratchet_remote_public_key_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_remote_public_key_persistence.ts` |
| `src/conversation/ratchet/persistence/fedos_direct_ratchet_session_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_session_persistence.ts` |
| `src/conversation/ratchet/persistence/fedos_direct_ratchet_session_reset_record_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_session_reset_record_persistence.ts` |
| `src/conversation/ratchet/persistence/fedos_sealed_direct_ratchet_secret_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/fedos_sealed_direct_ratchet_secret_persistence.ts` |
| `src/conversation/ratchet/persistence/in_memory_fedos_direct_ratchet_session_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_direct_ratchet_session_persistence.ts` |
| `src/conversation/ratchet/persistence/in_memory_fedos_direct_ratchet_session_reset_record_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_direct_ratchet_session_reset_record_persistence.ts` |
| `src/conversation/ratchet/persistence/in_memory_fedos_sealed_direct_ratchet_secret_persistence.ts` | `src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_sealed_direct_ratchet_secret_persistence.ts` |
| `src/conversation/readiness/fedos_conversation_encryption_readiness_authority.ts` | `src/os/messenger/conversations/readiness/fedos_conversation_encryption_readiness_authority.ts` |
| `src/conversation/readiness/fedos_conversation_readiness_axis.ts` | `src/os/messenger/conversations/readiness/fedos_conversation_readiness_axis.ts` |
| `src/conversation/readiness/fedos_conversation_readiness.ts` | `src/os/messenger/conversations/readiness/fedos_conversation_readiness.ts` |
| `src/conversation/retention/append_only_fedos_archive_suppression_observation_persistence.ts` | `src/os/messenger/conversations/retention/append_only_fedos_archive_suppression_observation_persistence.ts` |
| `src/conversation/retention/append_only_fedos_payload_retention_persistence.ts` | `src/os/messenger/conversations/retention/append_only_fedos_payload_retention_persistence.ts` |
| `src/conversation/retention/fedos_archive_suppression_fact_signing.ts` | `src/os/messenger/conversations/retention/fedos_archive_suppression_fact_signing.ts` |
| `src/conversation/retention/fedos_archive_suppression_fact.ts` | `src/os/messenger/conversations/retention/fedos_archive_suppression_fact.ts` |
| `src/conversation/retention/fedos_archive_suppression_local_bridge.ts` | `src/os/messenger/conversations/retention/fedos_archive_suppression_local_bridge.ts` |
| `src/conversation/retention/fedos_archive_suppression_observation_authority.ts` | `src/os/messenger/conversations/retention/fedos_archive_suppression_observation_authority.ts` |
| `src/conversation/retention/fedos_archive_suppression_observation_persistence.ts` | `src/os/messenger/conversations/retention/fedos_archive_suppression_observation_persistence.ts` |
| `src/conversation/retention/fedos_payload_retention_authority.ts` | `src/os/messenger/conversations/retention/fedos_payload_retention_authority.ts` |
| `src/conversation/retention/fedos_payload_retention_decision_codec.ts` | `src/os/messenger/conversations/retention/fedos_payload_retention_decision_codec.ts` |
| `src/conversation/retention/fedos_payload_retention_decision_validator.ts` | `src/os/messenger/conversations/retention/fedos_payload_retention_decision_validator.ts` |
| `src/conversation/retention/fedos_payload_retention_decision.ts` | `src/os/messenger/conversations/retention/fedos_payload_retention_decision.ts` |
| `src/conversation/retention/fedos_payload_retention_persistence.ts` | `src/os/messenger/conversations/retention/fedos_payload_retention_persistence.ts` |
| `src/conversation/retention/fedos_payload_retention_state.ts` | `src/os/messenger/conversations/retention/fedos_payload_retention_state.ts` |
| `src/conversation/retention/fedos_persisted_archive_suppression_observation_v1.ts` | `src/os/messenger/conversations/retention/fedos_persisted_archive_suppression_observation_v1.ts` |
| `src/conversation/retention/fedos_persisted_payload_retention_decision_v1.ts` | `src/os/messenger/conversations/retention/fedos_persisted_payload_retention_decision_v1.ts` |
| `src/conversation/retention/in_memory_fedos_archive_suppression_observation_persistence.ts` | `src/os/messenger/conversations/retention/in_memory_fedos_archive_suppression_observation_persistence.ts` |
| `src/conversation/retention/in_memory_fedos_payload_retention_persistence.ts` | `src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.ts` |
| `src/conversation/runtime/fedos_conversation_capability_generators.ts` | `src/os/messenger/conversations/runtime/fedos_conversation_capability_generators.ts` |
| `src/conversation/runtime/fedos_conversation_runtime_assembly.ts` | `src/os/messenger/conversations/runtime/fedos_conversation_runtime_assembly.ts` |
| `src/conversation/runtime/fedos_conversation_runtime.ts` | `src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts` |
| `src/conversation/search/fedos_conversation_search_archive_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_archive_index.ts` |
| `src/conversation/search/fedos_conversation_search_date_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_date_index.ts` |
| `src/conversation/search/fedos_conversation_search_document.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_document.ts` |
| `src/conversation/search/fedos_conversation_search_incremental_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_incremental_index.ts` |
| `src/conversation/search/fedos_conversation_search_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_index.ts` |
| `src/conversation/search/fedos_conversation_search_keyword_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_keyword_index.ts` |
| `src/conversation/search/fedos_conversation_search_mode_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_mode_index.ts` |
| `src/conversation/search/fedos_conversation_search_participant_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_participant_index.ts` |
| `src/conversation/search/fedos_conversation_search_reply_index.ts` | `src/os/messenger/conversations/search/fedos_conversation_search_reply_index.ts` |


### 2. `src/os/messenger/adapters/nostr/` — from `src/nostr/**`, `src/conversation/delivery/nostr/**`, `src/conversation/transport/**`

57 files.

| Old path | New path |
|---|---|
| `src/conversation/delivery/nostr/append_only_fedos_private_nostr_delivery_request_persistence.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/append_only_fedos_private_nostr_delivery_request_persistence.ts` |
| `src/conversation/delivery/nostr/append_only_fedos_private_nostr_import_record_persistence.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/append_only_fedos_private_nostr_import_record_persistence.ts` |
| `src/conversation/delivery/nostr/fedos_conversation_private_nostr_delivery_runtime.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_conversation_private_nostr_delivery_runtime.ts` |
| `src/conversation/delivery/nostr/fedos_direct_conversation_route_binding_resolver.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_direct_conversation_route_binding_resolver.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_delivery_mode.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_delivery_mode.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_delivery_publisher.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_delivery_publisher.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_delivery_request.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_delivery_request.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_group_delivery_planner.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_group_delivery_planner.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_import_record.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_import_record.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_inbound_conversation_resolver.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_inbound_conversation_resolver.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_inbound_delivery_coordinator.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_inbound_delivery_coordinator.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_inbound_legacy_candidate_count.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_inbound_legacy_candidate_count.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_outbound_delivery_coordinator.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_outbound_delivery_coordinator.ts` |
| `src/conversation/delivery/nostr/fedos_private_nostr_wire_payload.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_wire_payload.ts` |
| `src/conversation/delivery/nostr/in_memory_fedos_private_nostr_delivery_request_persistence.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/in_memory_fedos_private_nostr_delivery_request_persistence.ts` |
| `src/conversation/delivery/nostr/in_memory_fedos_private_nostr_import_record_persistence.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/in_memory_fedos_private_nostr_import_record_persistence.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_direct_conversation_plain_message_payload.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_direct_conversation_plain_message_payload.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_direct_ratchet_nip17_payload.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_nip17_inbound_import_coordinator.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nip17_inbound_import_coordinator.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nip17_rumor.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nip59_gift_wrap.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nip59_seal.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nostr_nip17_v1_wire_adapter.ts` |
| `src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts` | `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts` |
| `src/conversation/transport/append_only_fedos_conversation_transport_outbox_persistence.ts` | `src/os/messenger/adapters/nostr/transport/append_only_fedos_conversation_transport_outbox_persistence.ts` |
| `src/conversation/transport/fedos_conversation_ephemeral_transport.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_ephemeral_transport.ts` |
| `src/conversation/transport/fedos_conversation_transport_delivery_recovery_hydration.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_delivery_recovery_hydration.ts` |
| `src/conversation/transport/fedos_conversation_transport_event.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_event.ts` |
| `src/conversation/transport/fedos_conversation_transport_outbox_codec.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_codec.ts` |
| `src/conversation/transport/fedos_conversation_transport_outbox_persistence.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_persistence.ts` |
| `src/conversation/transport/fedos_conversation_transport_outbox_types.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_types.ts` |
| `src/conversation/transport/fedos_conversation_transport_publisher.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_publisher.ts` |
| `src/conversation/transport/fedos_conversation_transport_routing.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_routing.ts` |
| `src/conversation/transport/fedos_conversation_transport_scheduler.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_scheduler.ts` |
| `src/conversation/transport/fedos_conversation_transport_signed_event_source.ts` | `src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_signed_event_source.ts` |
| `src/conversation/transport/fedos_private_transport.ts` | `src/os/messenger/adapters/nostr/transport/fedos_private_transport.ts` |
| `src/conversation/transport/fedos_private_v1_wire_adapter.ts` | `src/os/messenger/adapters/nostr/transport/fedos_private_v1_wire_adapter.ts` |
| `src/conversation/transport/fedos_private_wire_adapter.ts` | `src/os/messenger/adapters/nostr/transport/fedos_private_wire_adapter.ts` |
| `src/conversation/transport/fedos_private_wire_prepared_delivery.ts` | `src/os/messenger/adapters/nostr/transport/fedos_private_wire_prepared_delivery.ts` |
| `src/conversation/transport/fedos_private_wire_route.ts` | `src/os/messenger/adapters/nostr/transport/fedos_private_wire_route.ts` |
| `src/conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.ts` | `src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.ts` |
| `src/conversation/transport/relay/fedos_conversation_inbound_subscription.ts` | `src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_inbound_subscription.ts` |
| `src/conversation/transport/relay/fedos_conversation_relay_set.ts` | `src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.ts` |
| `src/conversation/transport/relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.ts` | `src/os/messenger/adapters/nostr/transport/relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.ts` |
| `src/conversation/transport/relay/fedos_relay_event_deduplicator.ts` | `src/os/messenger/adapters/nostr/transport/relay/fedos_relay_event_deduplicator.ts` |
| `src/nostr/crypto.ts` | `src/os/messenger/adapters/nostr/protocol/crypto.ts` |
| `src/nostr/event.ts` | `src/os/messenger/adapters/nostr/protocol/event.ts` |
| `src/nostr/messages.ts` | `src/os/messenger/adapters/nostr/protocol/messages.ts` |
| `src/nostr/noble_signature.ts` | `src/os/messenger/adapters/nostr/protocol/noble_signature.ts` |
| `src/nostr/publish.ts` | `src/os/messenger/adapters/nostr/protocol/publish.ts` |
| `src/nostr/relay.ts` | `src/os/messenger/adapters/nostr/protocol/relay.ts` |
| `src/nostr/sign/fedos_nostr_signing_authority.ts` | `src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts` |
| `src/nostr/sign/fedos_nostr_signing_public_identity.ts` | `src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_public_identity.ts` |
| `src/nostr/sign/fedos_wasm_nostr_signing_authority.ts` | `src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.ts` |
| `src/nostr/signature.ts` | `src/os/messenger/adapters/nostr/protocol/signature.ts` |
| `src/nostr/types.ts` | `src/os/messenger/adapters/nostr/protocol/types.ts` |
| `src/nostr/ws_relay.ts` | `src/os/messenger/adapters/nostr/protocol/ws_relay.ts` |


### 3. `src/os/messenger/device/` — from `src/device/**`

88 files.

| Old path | New path |
|---|---|
| `src/device/archive_suppression_sync/fedos_archive_suppression_event.ts` | `src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_event.ts` |
| `src/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.ts` | `src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.ts` |
| `src/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts` | `src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts` |
| `src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts` | `src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts` |
| `src/device/archive_suppression_sync/fedos_archive_suppression_status_aggregation.ts` | `src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_status_aggregation.ts` |
| `src/device/archive_suppression_sync/fedos_archive_suppression_wire_payload.ts` | `src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_wire_payload.ts` |
| `src/device/archive_suppression_sync/persistence/append_only_fedos_archive_suppression_inbound_dedup_persistence.ts` | `src/os/messenger/device/archive_suppression_sync/persistence/append_only_fedos_archive_suppression_inbound_dedup_persistence.ts` |
| `src/device/archive_suppression_sync/persistence/fedos_archive_suppression_inbound_dedup_persistence.ts` | `src/os/messenger/device/archive_suppression_sync/persistence/fedos_archive_suppression_inbound_dedup_persistence.ts` |
| `src/device/binding_challenge/fedos_already_verified_device_registration_authority.ts` | `src/os/messenger/device/binding_challenge/fedos_already_verified_device_registration_authority.ts` |
| `src/device/binding_challenge/fedos_device_binding_account_authorization.ts` | `src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.ts` |
| `src/device/binding_challenge/fedos_device_binding_boundary_factory.ts` | `src/os/messenger/device/binding_challenge/fedos_device_binding_boundary_factory.ts` |
| `src/device/binding_challenge/fedos_device_binding_challenge.ts` | `src/os/messenger/device/binding_challenge/fedos_device_binding_challenge.ts` |
| `src/device/binding_challenge/fedos_device_binding_pairing_exchange.ts` | `src/os/messenger/device/binding_challenge/fedos_device_binding_pairing_exchange.ts` |
| `src/device/binding_challenge/fedos_device_binding_proof_of_possession.ts` | `src/os/messenger/device/binding_challenge/fedos_device_binding_proof_of_possession.ts` |
| `src/device/binding_challenge/fedos_device_binding_registration_authority.ts` | `src/os/messenger/device/binding_challenge/fedos_device_binding_registration_authority.ts` |
| `src/device/crypto/fedos_device_signing_keypair.ts` | `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts` |
| `src/device/fedos_device_binding.ts` | `src/os/messenger/device/fedos_device_binding.ts` |
| `src/device/fedos_device_lifecycle.ts` | `src/os/messenger/device/fedos_device_lifecycle.ts` |
| `src/device/fedos_device_registration_authority.ts` | `src/os/messenger/device/fedos_device_registration_authority.ts` |
| `src/device/fedos_device_replacement_coordinator.ts` | `src/os/messenger/device/fedos_device_replacement_coordinator.ts` |
| `src/device/fedos_device_replacement_record.ts` | `src/os/messenger/device/fedos_device_replacement_record.ts` |
| `src/device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.ts` | `src/os/messenger/device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.ts` |
| `src/device/persistence/append_only_fedos_device_registry_persistence.ts` | `src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.ts` |
| `src/device/persistence/append_only_fedos_device_replacement_persistence.ts` | `src/os/messenger/device/persistence/append_only_fedos_device_replacement_persistence.ts` |
| `src/device/persistence/fedos_device_binding_challenge_replay_codec.ts` | `src/os/messenger/device/persistence/fedos_device_binding_challenge_replay_codec.ts` |
| `src/device/persistence/fedos_device_binding_challenge_replay_persistence.ts` | `src/os/messenger/device/persistence/fedos_device_binding_challenge_replay_persistence.ts` |
| `src/device/persistence/fedos_device_binding_codec.ts` | `src/os/messenger/device/persistence/fedos_device_binding_codec.ts` |
| `src/device/persistence/fedos_device_registry_persistence.ts` | `src/os/messenger/device/persistence/fedos_device_registry_persistence.ts` |
| `src/device/persistence/fedos_device_replacement_persistence.ts` | `src/os/messenger/device/persistence/fedos_device_replacement_persistence.ts` |
| `src/device/persistence/fedos_persisted_device_binding_challenge_consumption_v1.ts` | `src/os/messenger/device/persistence/fedos_persisted_device_binding_challenge_consumption_v1.ts` |
| `src/device/persistence/fedos_persisted_device_binding_event_v1.ts` | `src/os/messenger/device/persistence/fedos_persisted_device_binding_event_v1.ts` |
| `src/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.ts` | `src/os/messenger/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.ts` |
| `src/device/persistence/in_memory_fedos_device_registry_persistence.ts` | `src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.ts` |
| `src/device/persistence/in_memory_fedos_device_replacement_persistence.ts` | `src/os/messenger/device/persistence/in_memory_fedos_device_replacement_persistence.ts` |
| `src/device/persistence/persisted_fedos_device_trust_authority.ts` | `src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts` |
| `src/device/relay_sync/fedos_device_relay_sync_event.ts` | `src/os/messenger/device/relay_sync/fedos_device_relay_sync_event.ts` |
| `src/device/relay_sync/fedos_device_relay_sync_inbound_handler.ts` | `src/os/messenger/device/relay_sync/fedos_device_relay_sync_inbound_handler.ts` |
| `src/device/relay_sync/fedos_device_relay_sync_observation.ts` | `src/os/messenger/device/relay_sync/fedos_device_relay_sync_observation.ts` |
| `src/device/relay_sync/fedos_device_relay_sync_outbound_coordinator.ts` | `src/os/messenger/device/relay_sync/fedos_device_relay_sync_outbound_coordinator.ts` |
| `src/device/relay_sync/fedos_device_relay_sync_publisher.ts` | `src/os/messenger/device/relay_sync/fedos_device_relay_sync_publisher.ts` |
| `src/device/relay_sync/fedos_device_relay_sync_wire_payload.ts` | `src/os/messenger/device/relay_sync/fedos_device_relay_sync_wire_payload.ts` |
| `src/device/relay_sync/persistence/append_only_fedos_device_relay_sync_inbound_dedup_persistence.ts` | `src/os/messenger/device/relay_sync/persistence/append_only_fedos_device_relay_sync_inbound_dedup_persistence.ts` |
| `src/device/relay_sync/persistence/append_only_fedos_device_relay_sync_observation_repository.ts` | `src/os/messenger/device/relay_sync/persistence/append_only_fedos_device_relay_sync_observation_repository.ts` |
| `src/device/relay_sync/persistence/append_only_fedos_device_relay_sync_outbox_persistence.ts` | `src/os/messenger/device/relay_sync/persistence/append_only_fedos_device_relay_sync_outbox_persistence.ts` |
| `src/device/relay_sync/persistence/fedos_device_relay_sync_inbound_dedup_persistence.ts` | `src/os/messenger/device/relay_sync/persistence/fedos_device_relay_sync_inbound_dedup_persistence.ts` |
| `src/device/relay_sync/persistence/fedos_device_relay_sync_outbox_persistence.ts` | `src/os/messenger/device/relay_sync/persistence/fedos_device_relay_sync_outbox_persistence.ts` |
| `src/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_inbound_dedup_persistence.ts` | `src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_inbound_dedup_persistence.ts` |
| `src/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_observation_repository.ts` | `src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_observation_repository.ts` |
| `src/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_outbox_persistence.ts` | `src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_outbox_persistence.ts` |
| `src/device/runtime/fedos_device_sync_runtime.ts` | `src/os/messenger/device/runtime/fedos_device_sync_runtime.ts` |
| `src/device/sync_events/fedos_device_sync_event_bridge.ts` | `src/os/messenger/device/sync_events/fedos_device_sync_event_bridge.ts` |
| `src/device/sync_events/fedos_device_sync_event.ts` | `src/os/messenger/device/sync_events/fedos_device_sync_event.ts` |
| `src/device/sync_package/fedos_device_sync_package_encryption.ts` | `src/os/messenger/device/sync_package/fedos_device_sync_package_encryption.ts` |
| `src/device/sync_package/fedos_device_sync_package_header.ts` | `src/os/messenger/device/sync_package/fedos_device_sync_package_header.ts` |
| `src/device/sync_package/fedos_device_sync_package_manifest.ts` | `src/os/messenger/device/sync_package/fedos_device_sync_package_manifest.ts` |
| `src/device/sync_package/fedos_device_sync_package.ts` | `src/os/messenger/device/sync_package/fedos_device_sync_package.ts` |
| `src/device/sync_scheduler/fedos_device_sync_attempt.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_attempt.ts` |
| `src/device/sync_scheduler/fedos_device_sync_conflict_authority.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_conflict_authority.ts` |
| `src/device/sync_scheduler/fedos_device_sync_conflict_query.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_conflict_query.ts` |
| `src/device/sync_scheduler/fedos_device_sync_conflict.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_conflict.ts` |
| `src/device/sync_scheduler/fedos_device_sync_import_coordinator.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_import_coordinator.ts` |
| `src/device/sync_scheduler/fedos_device_sync_resource_limits.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_resource_limits.ts` |
| `src/device/sync_scheduler/fedos_device_sync_retry_policy.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_retry_policy.ts` |
| `src/device/sync_scheduler/fedos_device_sync_schedule.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_schedule.ts` |
| `src/device/sync_scheduler/fedos_device_sync_scheduler.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_scheduler.ts` |
| `src/device/sync_scheduler/fedos_device_sync_target_planning.ts` | `src/os/messenger/device/sync_scheduler/fedos_device_sync_target_planning.ts` |
| `src/device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.ts` | `src/os/messenger/device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.ts` |
| `src/device/sync_scheduler/persistence/append_only_fedos_device_sync_schedule_persistence.ts` | `src/os/messenger/device/sync_scheduler/persistence/append_only_fedos_device_sync_schedule_persistence.ts` |
| `src/device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.ts` | `src/os/messenger/device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.ts` |
| `src/device/sync_scheduler/persistence/fedos_device_sync_schedule_event_codec.ts` | `src/os/messenger/device/sync_scheduler/persistence/fedos_device_sync_schedule_event_codec.ts` |
| `src/device/sync_scheduler/persistence/fedos_device_sync_schedule_persistence.ts` | `src/os/messenger/device/sync_scheduler/persistence/fedos_device_sync_schedule_persistence.ts` |
| `src/device/sync_scheduler/persistence/fedos_persisted_device_sync_schedule_event_v1.ts` | `src/os/messenger/device/sync_scheduler/persistence/fedos_persisted_device_sync_schedule_event_v1.ts` |
| `src/device/sync_scheduler/persistence/in_memory_fedos_device_sync_conflict_persistence.ts` | `src/os/messenger/device/sync_scheduler/persistence/in_memory_fedos_device_sync_conflict_persistence.ts` |
| `src/device/sync_scheduler/persistence/in_memory_fedos_device_sync_schedule_persistence.ts` | `src/os/messenger/device/sync_scheduler/persistence/in_memory_fedos_device_sync_schedule_persistence.ts` |
| `src/device/sync_session/fedos_device_sync_session_codec.ts` | `src/os/messenger/device/sync_session/fedos_device_sync_session_codec.ts` |
| `src/device/sync_session/fedos_device_sync_session.ts` | `src/os/messenger/device/sync_session/fedos_device_sync_session.ts` |
| `src/device/transfer/fedos_device_transfer_challenge.ts` | `src/os/messenger/device/transfer/fedos_device_transfer_challenge.ts` |
| `src/device/transfer/fedos_device_transfer_coordinator.ts` | `src/os/messenger/device/transfer/fedos_device_transfer_coordinator.ts` |
| `src/device/transfer/fedos_device_transfer_invitation.ts` | `src/os/messenger/device/transfer/fedos_device_transfer_invitation.ts` |
| `src/device/transfer/fedos_device_transfer_package.ts` | `src/os/messenger/device/transfer/fedos_device_transfer_package.ts` |
| `src/device/transfer/fedos_device_transfer_proof.ts` | `src/os/messenger/device/transfer/fedos_device_transfer_proof.ts` |
| `src/device/transfer/fedos_device_transfer_session.ts` | `src/os/messenger/device/transfer/fedos_device_transfer_session.ts` |
| `src/device/transfer/persistence/append_only_fedos_device_transfer_session_persistence.ts` | `src/os/messenger/device/transfer/persistence/append_only_fedos_device_transfer_session_persistence.ts` |
| `src/device/transfer/persistence/fedos_device_transfer_event_codec.ts` | `src/os/messenger/device/transfer/persistence/fedos_device_transfer_event_codec.ts` |
| `src/device/transfer/persistence/fedos_device_transfer_session_persistence.ts` | `src/os/messenger/device/transfer/persistence/fedos_device_transfer_session_persistence.ts` |
| `src/device/transfer/persistence/fedos_persisted_device_transfer_event_v1.ts` | `src/os/messenger/device/transfer/persistence/fedos_persisted_device_transfer_event_v1.ts` |
| `src/device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.ts` | `src/os/messenger/device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.ts` |
| `src/device/unavailable_fedos_device_registration_authority.ts` | `src/os/messenger/device/unavailable_fedos_device_registration_authority.ts` |


### 4. `src/os/messenger/board/` — from `src/board/**`

85 files.

| Old path | New path |
|---|---|
| `src/board/activitypub/fedos_activitypub_board_adapter.ts` | `src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.ts` |
| `src/board/activitypub/fedos_activitypub_mutation_boundary.ts` | `src/os/messenger/board/activitypub/fedos_activitypub_mutation_boundary.ts` |
| `src/board/activitypub/fedos_validated_activitypub_post.ts` | `src/os/messenger/board/activitypub/fedos_validated_activitypub_post.ts` |
| `src/board/atproto/fedos_atproto_board_adapter.ts` | `src/os/messenger/board/atproto/fedos_atproto_board_adapter.ts` |
| `src/board/atproto/fedos_atproto_mutation_boundary.ts` | `src/os/messenger/board/atproto/fedos_atproto_mutation_boundary.ts` |
| `src/board/atproto/fedos_validated_atproto_post.ts` | `src/os/messenger/board/atproto/fedos_validated_atproto_post.ts` |
| `src/board/fedos_board_author.ts` | `src/os/messenger/board/fedos_board_author.ts` |
| `src/board/fedos_board_identifiers.ts` | `src/os/messenger/board/fedos_board_identifiers.ts` |
| `src/board/fedos_board_moderation.ts` | `src/os/messenger/board/fedos_board_moderation.ts` |
| `src/board/fedos_board_nostr_adapter.ts` | `src/os/messenger/board/fedos_board_nostr_adapter.ts` |
| `src/board/fedos_board_post_validator.ts` | `src/os/messenger/board/fedos_board_post_validator.ts` |
| `src/board/fedos_board_post.ts` | `src/os/messenger/board/fedos_board_post.ts` |
| `src/board/fedos_board_source.ts` | `src/os/messenger/board/fedos_board_source.ts` |
| `src/board/observation/append_only_fedos_delivery_observation_persistence.ts` | `src/os/messenger/board/observation/append_only_fedos_delivery_observation_persistence.ts` |
| `src/board/observation/fedos_delivery_attempt_subject_id.ts` | `src/os/messenger/board/observation/fedos_delivery_attempt_subject_id.ts` |
| `src/board/observation/fedos_delivery_observation_codec.ts` | `src/os/messenger/board/observation/fedos_delivery_observation_codec.ts` |
| `src/board/observation/fedos_delivery_observation_persistence.ts` | `src/os/messenger/board/observation/fedos_delivery_observation_persistence.ts` |
| `src/board/observation/fedos_delivery_observation_query.ts` | `src/os/messenger/board/observation/fedos_delivery_observation_query.ts` |
| `src/board/observation/fedos_delivery_observation_repository.ts` | `src/os/messenger/board/observation/fedos_delivery_observation_repository.ts` |
| `src/board/observation/fedos_delivery_observation_transition_graph.ts` | `src/os/messenger/board/observation/fedos_delivery_observation_transition_graph.ts` |
| `src/board/observation/fedos_delivery_observation_write_validator.ts` | `src/os/messenger/board/observation/fedos_delivery_observation_write_validator.ts` |
| `src/board/observation/fedos_delivery_observation.ts` | `src/os/messenger/board/observation/fedos_delivery_observation.ts` |
| `src/board/observation/fedos_delivery_retry_query.ts` | `src/os/messenger/board/observation/fedos_delivery_retry_query.ts` |
| `src/board/observation/fedos_delivery_retry_reason_codec.ts` | `src/os/messenger/board/observation/fedos_delivery_retry_reason_codec.ts` |
| `src/board/observation/fedos_delivery_retry_registry.ts` | `src/os/messenger/board/observation/fedos_delivery_retry_registry.ts` |
| `src/board/observation/in_memory_fedos_delivery_observation_persistence.ts` | `src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.ts` |
| `src/board/outbox/append_only_fedos_board_outbox_persistence.ts` | `src/os/messenger/board/outbox/append_only_fedos_board_outbox_persistence.ts` |
| `src/board/outbox/fedos_board_outbox_abandonment_policy.ts` | `src/os/messenger/board/outbox/fedos_board_outbox_abandonment_policy.ts` |
| `src/board/outbox/fedos_board_outbox_codec.ts` | `src/os/messenger/board/outbox/fedos_board_outbox_codec.ts` |
| `src/board/outbox/fedos_board_outbox_observation_to_delivery_observation.ts` | `src/os/messenger/board/outbox/fedos_board_outbox_observation_to_delivery_observation.ts` |
| `src/board/outbox/fedos_board_outbox_observation.ts` | `src/os/messenger/board/outbox/fedos_board_outbox_observation.ts` |
| `src/board/outbox/fedos_board_outbox_persistence.ts` | `src/os/messenger/board/outbox/fedos_board_outbox_persistence.ts` |
| `src/board/outbox/fedos_board_outbox_publisher.ts` | `src/os/messenger/board/outbox/fedos_board_outbox_publisher.ts` |
| `src/board/outbox/fedos_board_outbox_types.ts` | `src/os/messenger/board/outbox/fedos_board_outbox_types.ts` |
| `src/board/outbox/fedos_publish_scheduler.ts` | `src/os/messenger/board/outbox/fedos_publish_scheduler.ts` |
| `src/board/outbox/in_memory_fedos_board_outbox_persistence.ts` | `src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.ts` |
| `src/board/persistence/append_only_fedos_board_persistence.ts` | `src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts` |
| `src/board/persistence/fedos_board_hydration.ts` | `src/os/messenger/board/persistence/fedos_board_hydration.ts` |
| `src/board/persistence/fedos_board_persistence.ts` | `src/os/messenger/board/persistence/fedos_board_persistence.ts` |
| `src/board/persistence/fedos_board_post_codec.ts` | `src/os/messenger/board/persistence/fedos_board_post_codec.ts` |
| `src/board/persistence/fedos_persisted_board_post_v1.ts` | `src/os/messenger/board/persistence/fedos_persisted_board_post_v1.ts` |
| `src/board/persistence/in_memory_fedos_board_persistence.ts` | `src/os/messenger/board/persistence/in_memory_fedos_board_persistence.ts` |
| `src/board/persistence/persisted_fedos_board_repository.ts` | `src/os/messenger/board/persistence/persisted_fedos_board_repository.ts` |
| `src/board/publish/fedos_outbound_publish_result_retry_policy.ts` | `src/os/messenger/board/publish/fedos_outbound_publish_result_retry_policy.ts` |
| `src/board/publish/fedos_outbound_publish_result_to_board_outbox_publish_result.ts` | `src/os/messenger/board/publish/fedos_outbound_publish_result_to_board_outbox_publish_result.ts` |
| `src/board/publish/fedos_outbound_publish_result.ts` | `src/os/messenger/board/publish/fedos_outbound_publish_result.ts` |
| `src/board/publish/nostr/fedos_board_post_to_nostr_unsigned_event.ts` | `src/os/messenger/board/publish/nostr/fedos_board_post_to_nostr_unsigned_event.ts` |
| `src/board/publish/nostr/fedos_nostr_board_publisher_adapter.ts` | `src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher_adapter.ts` |
| `src/board/publish/nostr/fedos_nostr_board_publisher_with_outcome.ts` | `src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher_with_outcome.ts` |
| `src/board/publish/nostr/fedos_nostr_board_publisher.ts` | `src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher.ts` |
| `src/board/publish/nostr/fedos_nostr_publish_result_to_outbound_publish_result.ts` | `src/os/messenger/board/publish/nostr/fedos_nostr_publish_result_to_outbound_publish_result.ts` |
| `src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts` | `src/os/messenger/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts` |
| `src/board/publish/nostr/fedos_outcome_aware_nostr_board_publisher_adapter.ts` | `src/os/messenger/board/publish/nostr/fedos_outcome_aware_nostr_board_publisher_adapter.ts` |
| `src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts` | `src/os/messenger/board/publish/nostr/fedos_relay_nostr_board_publisher.ts` |
| `src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts` | `src/os/messenger/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts` |
| `src/board/publish/nostr/fedos_signing_authority_board_post_event_source.ts` | `src/os/messenger/board/publish/nostr/fedos_signing_authority_board_post_event_source.ts` |
| `src/board/query/fedos_board_query_types.ts` | `src/os/messenger/board/query/fedos_board_query_types.ts` |
| `src/board/query/fedos_board_query.ts` | `src/os/messenger/board/query/fedos_board_query.ts` |
| `src/board/repository/fedos_board_feed.ts` | `src/os/messenger/board/repository/fedos_board_feed.ts` |
| `src/board/repository/fedos_board_index.ts` | `src/os/messenger/board/repository/fedos_board_index.ts` |
| `src/board/repository/fedos_board_reader.ts` | `src/os/messenger/board/repository/fedos_board_reader.ts` |
| `src/board/repository/fedos_board_repository.ts` | `src/os/messenger/board/repository/fedos_board_repository.ts` |
| `src/board/repository/fedos_board_service.ts` | `src/os/messenger/board/repository/fedos_board_service.ts` |
| `src/board/repository/fedos_board_source_index.ts` | `src/os/messenger/board/repository/fedos_board_source_index.ts` |
| `src/board/repository/in_memory_fedos_board_repository.ts` | `src/os/messenger/board/repository/in_memory_fedos_board_repository.ts` |
| `src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts` | `src/os/messenger/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts` |
| `src/board/runtime/eligibility/fedos_outbound_eligibility_types.ts` | `src/os/messenger/board/runtime/eligibility/fedos_outbound_eligibility_types.ts` |
| `src/board/runtime/fedos_board_runtime_author_authority.ts` | `src/os/messenger/board/runtime/fedos_board_runtime_author_authority.ts` |
| `src/board/runtime/fedos_board_runtime_clock.ts` | `src/os/messenger/board/runtime/fedos_board_runtime_clock.ts` |
| `src/board/runtime/fedos_board_runtime_command_types.ts` | `src/os/messenger/board/runtime/fedos_board_runtime_command_types.ts` |
| `src/board/runtime/fedos_board_runtime_id_generator.ts` | `src/os/messenger/board/runtime/fedos_board_runtime_id_generator.ts` |
| `src/board/runtime/fedos_board_runtime_outbound_eligibility.ts` | `src/os/messenger/board/runtime/fedos_board_runtime_outbound_eligibility.ts` |
| `src/board/runtime/fedos_board_runtime.ts` | `src/os/messenger/board/runtime/fedos_board_runtime.ts` |
| `src/board/runtime/identity/anonymous_local_public_author_authority.ts` | `src/os/messenger/board/runtime/identity/anonymous_local_public_author_authority.ts` |
| `src/board/runtime/identity/fedos_desktop_public_author_authority.ts` | `src/os/messenger/board/runtime/identity/fedos_desktop_public_author_authority.ts` |
| `src/board/runtime/identity/fedos_nostr_author_binding_authority.ts` | `src/os/messenger/board/runtime/identity/fedos_nostr_author_binding_authority.ts` |
| `src/board/runtime/identity/fedos_nostr_author_binding_types.ts` | `src/os/messenger/board/runtime/identity/fedos_nostr_author_binding_types.ts` |
| `src/board/runtime/identity/fedos_nostr_signing_public_author_authority.ts` | `src/os/messenger/board/runtime/identity/fedos_nostr_signing_public_author_authority.ts` |
| `src/board/runtime/identity/fedos_public_author_authority.ts` | `src/os/messenger/board/runtime/identity/fedos_public_author_authority.ts` |
| `src/board/runtime/identity/static_fedos_public_author_authority.ts` | `src/os/messenger/board/runtime/identity/static_fedos_public_author_authority.ts` |
| `src/board/runtime/policy/fedos_conversation_mode.ts` | `src/os/messenger/board/runtime/policy/fedos_conversation_mode.ts` |
| `src/board/runtime/policy/fedos_conversation_policy_authority.ts` | `src/os/messenger/board/runtime/policy/fedos_conversation_policy_authority.ts` |
| `src/board/runtime/policy/fedos_conversation_policy.ts` | `src/os/messenger/board/runtime/policy/fedos_conversation_policy.ts` |
| `src/board/session/fedos_session_board_adapter.ts` | `src/os/messenger/board/session/fedos_session_board_adapter.ts` |
| `src/board/session/fedos_validated_session_post.ts` | `src/os/messenger/board/session/fedos_validated_session_post.ts` |


### 5. `src/os/messenger/notifications/` — from `src/desktop/notification/**`

3 files.

| Old path | New path |
|---|---|
| `src/desktop/notification/fedos_desktop_notification_coordinator.ts` | `src/os/messenger/notifications/fedos_desktop_notification_coordinator.ts` |
| `src/desktop/notification/fedos_desktop_notification_port.ts` | `src/os/messenger/notifications/fedos_desktop_notification_port.ts` |
| `src/desktop/notification/fedos_desktop_notification_types.ts` | `src/os/messenger/notifications/fedos_desktop_notification_types.ts` |


### 6. `src/os/messenger/desktop/` — from the rest of `src/desktop/**`

154 files.

| Old path | New path |
|---|---|
| `src/desktop/background/fedos_desktop_background_lifecycle_coordinator.ts` | `src/os/messenger/desktop/background/fedos_desktop_background_lifecycle_coordinator.ts` |
| `src/desktop/badge/fedos_desktop_badge_coordinator.ts` | `src/os/messenger/desktop/badge/fedos_desktop_badge_coordinator.ts` |
| `src/desktop/badge/fedos_desktop_badge_port.ts` | `src/os/messenger/desktop/badge/fedos_desktop_badge_port.ts` |
| `src/desktop/badge/fedos_desktop_badge_types.ts` | `src/os/messenger/desktop/badge/fedos_desktop_badge_types.ts` |
| `src/desktop/beta/fedos_desktop_beta_application_assembly.ts` | `src/os/messenger/desktop/beta/fedos_desktop_beta_application_assembly.ts` |
| `src/desktop/beta/fedos_desktop_beta_capability_manifest.ts` | `src/os/messenger/desktop/beta/fedos_desktop_beta_capability_manifest.ts` |
| `src/desktop/beta/fedos_desktop_beta_limitations.ts` | `src/os/messenger/desktop/beta/fedos_desktop_beta_limitations.ts` |
| `src/desktop/beta/fedos_desktop_beta_release_configuration.ts` | `src/os/messenger/desktop/beta/fedos_desktop_beta_release_configuration.ts` |
| `src/desktop/combined_inbound_event_validator.ts` | `src/os/messenger/desktop/combined_inbound_event_validator.ts` |
| `src/desktop/content_accessor/fedos_desktop_conversation_content_accessor_result.ts` | `src/os/messenger/desktop/content_accessor/fedos_desktop_conversation_content_accessor_result.ts` |
| `src/desktop/content_accessor/fedos_desktop_conversation_content_accessor.ts` | `src/os/messenger/desktop/content_accessor/fedos_desktop_conversation_content_accessor.ts` |
| `src/desktop/create_desktop_application.ts` | `src/os/messenger/desktop/create_desktop_application.ts` |
| `src/desktop/desktop_application.ts` | `src/os/messenger/desktop/desktop_application.ts` |
| `src/desktop/fedos_event_descriptor.ts` | `src/os/messenger/desktop/fedos_event_descriptor.ts` |
| `src/desktop/fedos_event_reader.ts` | `src/os/messenger/desktop/fedos_event_reader.ts` |
| `src/desktop/fedos_nostr_wire_event.ts` | `src/os/messenger/desktop/fedos_nostr_wire_event.ts` |
| `src/desktop/fedos_public_identity_reader.ts` | `src/os/messenger/desktop/fedos_public_identity_reader.ts` |
| `src/desktop/fedos_relay_inbound_message.ts` | `src/os/messenger/desktop/fedos_relay_inbound_message.ts` |
| `src/desktop/fedos_relay_listeners.ts` | `src/os/messenger/desktop/fedos_relay_listeners.ts` |
| `src/desktop/fedos_relay.ts` | `src/os/messenger/desktop/fedos_relay.ts` |
| `src/desktop/fedos_subscription_filter.ts` | `src/os/messenger/desktop/fedos_subscription_filter.ts` |
| `src/desktop/fedos_subscription.ts` | `src/os/messenger/desktop/fedos_subscription.ts` |
| `src/desktop/fedos_validated_nostr_event.ts` | `src/os/messenger/desktop/fedos_validated_nostr_event.ts` |
| `src/desktop/host_boundary/fedos_desktop_host_bridge.ts` | `src/os/messenger/desktop/host_boundary/fedos_desktop_host_bridge.ts` |
| `src/desktop/host_boundary/fedos_desktop_host_command.ts` | `src/os/messenger/desktop/host_boundary/fedos_desktop_host_command.ts` |
| `src/desktop/host_boundary/fedos_desktop_host_port.ts` | `src/os/messenger/desktop/host_boundary/fedos_desktop_host_port.ts` |
| `src/desktop/host_boundary/fedos_desktop_host_response.ts` | `src/os/messenger/desktop/host_boundary/fedos_desktop_host_response.ts` |
| `src/desktop/host/create_fedos_desktop_host.ts` | `src/os/messenger/desktop/host/create_fedos_desktop_host.ts` |
| `src/desktop/host/fedos_delivery_recovery_hydration.ts` | `src/os/messenger/desktop/host/fedos_delivery_recovery_hydration.ts` |
| `src/desktop/host/fedos_desktop_host_state.ts` | `src/os/messenger/desktop/host/fedos_desktop_host_state.ts` |
| `src/desktop/host/fedos_desktop_host.ts` | `src/os/messenger/desktop/host/fedos_desktop_host.ts` |
| `src/desktop/host/fedos_host_delivery_controller.ts` | `src/os/messenger/desktop/host/fedos_host_delivery_controller.ts` |
| `src/desktop/navigation/append_only_fedos_desktop_navigation_persistence.ts` | `src/os/messenger/desktop/navigation/append_only_fedos_desktop_navigation_persistence.ts` |
| `src/desktop/navigation/fedos_desktop_conversation_navigation_history.ts` | `src/os/messenger/desktop/navigation/fedos_desktop_conversation_navigation_history.ts` |
| `src/desktop/navigation/fedos_desktop_conversation_navigation_state.ts` | `src/os/messenger/desktop/navigation/fedos_desktop_conversation_navigation_state.ts` |
| `src/desktop/navigation/fedos_desktop_conversation_window_controller.ts` | `src/os/messenger/desktop/navigation/fedos_desktop_conversation_window_controller.ts` |
| `src/desktop/navigation/fedos_desktop_conversation_window_registry.ts` | `src/os/messenger/desktop/navigation/fedos_desktop_conversation_window_registry.ts` |
| `src/desktop/navigation/fedos_desktop_conversation_window_title.ts` | `src/os/messenger/desktop/navigation/fedos_desktop_conversation_window_title.ts` |
| `src/desktop/node_websocket_relay_socket_factory.ts` | `src/os/messenger/desktop/node_websocket_relay_socket_factory.ts` |
| `src/desktop/nostr_event_id_verifier.ts` | `src/os/messenger/desktop/nostr_event_id_verifier.ts` |
| `src/desktop/nostr_public_identity_reader.ts` | `src/os/messenger/desktop/nostr_public_identity_reader.ts` |
| `src/desktop/nostr_signature_verifier.ts` | `src/os/messenger/desktop/nostr_signature_verifier.ts` |
| `src/desktop/null_event_reader.ts` | `src/os/messenger/desktop/null_event_reader.ts` |
| `src/desktop/null_public_identity_reader.ts` | `src/os/messenger/desktop/null_public_identity_reader.ts` |
| `src/desktop/null_relay.ts` | `src/os/messenger/desktop/null_relay.ts` |
| `src/desktop/onboarding/fedos_development_master_seed_authority.ts` | `src/os/messenger/desktop/onboarding/fedos_development_master_seed_authority.ts` |
| `src/desktop/onboarding/fedos_local_profile_descriptor.ts` | `src/os/messenger/desktop/onboarding/fedos_local_profile_descriptor.ts` |
| `src/desktop/onboarding/fedos_local_profile_paths.ts` | `src/os/messenger/desktop/onboarding/fedos_local_profile_paths.ts` |
| `src/desktop/onboarding/fedos_local_profile_persistence.ts` | `src/os/messenger/desktop/onboarding/fedos_local_profile_persistence.ts` |
| `src/desktop/onboarding/fedos_onboarding_command.ts` | `src/os/messenger/desktop/onboarding/fedos_onboarding_command.ts` |
| `src/desktop/onboarding/fedos_onboarding_presentation.ts` | `src/os/messenger/desktop/onboarding/fedos_onboarding_presentation.ts` |
| `src/desktop/onboarding/fedos_profile_initialization_coordinator.ts` | `src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts` |
| `src/desktop/onboarding/fedos_profile_lifecycle_state.ts` | `src/os/messenger/desktop/onboarding/fedos_profile_lifecycle_state.ts` |
| `src/desktop/onboarding/fedos_profile_recovery_notice.ts` | `src/os/messenger/desktop/onboarding/fedos_profile_recovery_notice.ts` |
| `src/desktop/onboarding/fedos_profile_unlock_secret.ts` | `src/os/messenger/desktop/onboarding/fedos_profile_unlock_secret.ts` |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_controller.ts` | `src/os/messenger/desktop/presentation/deletion_request/fedos_deletion_request_controller.ts` |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_device_status.ts` | `src/os/messenger/desktop/presentation/deletion_request/fedos_deletion_request_device_status.ts` |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_navigation_state.ts` | `src/os/messenger/desktop/presentation/deletion_request/fedos_deletion_request_navigation_state.ts` |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_screen_model.ts` | `src/os/messenger/desktop/presentation/deletion_request/fedos_deletion_request_screen_model.ts` |
| `src/desktop/presentation/device_management/fedos_device_management_controller.ts` | `src/os/messenger/desktop/presentation/device_management/fedos_device_management_controller.ts` |
| `src/desktop/presentation/device_management/fedos_device_management_navigation_state.ts` | `src/os/messenger/desktop/presentation/device_management/fedos_device_management_navigation_state.ts` |
| `src/desktop/presentation/device_management/fedos_device_management_presentation_limits.ts` | `src/os/messenger/desktop/presentation/device_management/fedos_device_management_presentation_limits.ts` |
| `src/desktop/presentation/device_management/fedos_device_management_screen_model.ts` | `src/os/messenger/desktop/presentation/device_management/fedos_device_management_screen_model.ts` |
| `src/desktop/presentation/device_management/fedos_device_management_screen.ts` | `src/os/messenger/desktop/presentation/device_management/fedos_device_management_screen.ts` |
| `src/desktop/presentation/fedos_desktop_archive_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_archive_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_compose_message_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_compose_message_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_conversation_detail_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_conversation_detail_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_conversation_list_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_conversation_list_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` |
| `src/desktop/presentation/fedos_desktop_device_inventory_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_device_inventory_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_device_pairing_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_device_pairing_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_device_sync_status_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_device_sync_status_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_membership_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_membership_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_message_list_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_message_list_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_notifications_tray_status_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_notifications_tray_status_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_reply_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_reply_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_runtime_status_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_runtime_status_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_search_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_search_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_settings_application_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_settings_application_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_settings_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_settings_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_sync_conflict_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_sync_conflict_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_sync_schedule_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_sync_schedule_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_transfer_session_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_transfer_session_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_unread_counter_view_model.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_unread_counter_view_model.ts` |
| `src/desktop/presentation/fedos_desktop_view_model_state.ts` | `src/os/messenger/desktop/presentation/fedos_desktop_view_model_state.ts` |
| `src/desktop/presentation/identity_transition/fedos_identity_transition_controller.ts` | `src/os/messenger/desktop/presentation/identity_transition/fedos_identity_transition_controller.ts` |
| `src/desktop/presentation/identity_transition/fedos_identity_transition_navigation_state.ts` | `src/os/messenger/desktop/presentation/identity_transition/fedos_identity_transition_navigation_state.ts` |
| `src/desktop/presentation/identity_transition/fedos_identity_transition_screen_model.ts` | `src/os/messenger/desktop/presentation/identity_transition/fedos_identity_transition_screen_model.ts` |
| `src/desktop/presentation/safety_center/fedos_archive_workflow_safety_warnings.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_archive_workflow_safety_warnings.ts` |
| `src/desktop/presentation/safety_center/fedos_safety_center_controller.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_controller.ts` |
| `src/desktop/presentation/safety_center/fedos_safety_center_event_timeline.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_event_timeline.ts` |
| `src/desktop/presentation/safety_center/fedos_safety_center_navigation_state.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_navigation_state.ts` |
| `src/desktop/presentation/safety_center/fedos_safety_center_screen_model.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_screen_model.ts` |
| `src/desktop/presentation/safety_center/fedos_safety_center_state.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_state.ts` |
| `src/desktop/presentation/safety_center/fedos_safety_center_summary.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_summary.ts` |
| `src/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts` |
| `src/desktop/production_activation/fedos_production_conversation_archive_encryption_runtime_boundary.ts` | `src/os/messenger/desktop/production_activation/fedos_production_conversation_archive_encryption_runtime_boundary.ts` |
| `src/desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.ts` | `src/os/messenger/desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.ts` |
| `src/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.ts` | `src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.ts` |
| `src/desktop/production_activation/fedos_production_desktop_host_attestation.ts` | `src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.ts` |
| `src/desktop/production_activation/fedos_production_ephemeral_gift_wrap_signing_authority.ts` | `src/os/messenger/desktop/production_activation/fedos_production_ephemeral_gift_wrap_signing_authority.ts` |
| `src/desktop/production_activation/fedos_production_master_seed_authority.ts` | `src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.ts` |
| `src/desktop/production_activation/fedos_production_nostr_signing_authority.ts` | `src/os/messenger/desktop/production_activation/fedos_production_nostr_signing_authority.ts` |
| `src/desktop/production_activation/fedos_production_profile_activation.ts` | `src/os/messenger/desktop/production_activation/fedos_production_profile_activation.ts` |
| `src/desktop/production_activation/fedos_production_wasm_artifact_manifest.ts` | `src/os/messenger/desktop/production_activation/fedos_production_wasm_artifact_manifest.ts` |
| `src/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts` | `src/os/messenger/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts` |
| `src/desktop/relay_inbound_parser.ts` | `src/os/messenger/desktop/relay_inbound_parser.ts` |
| `src/desktop/renderer/deletion_request/fedos_deletion_request_renderer.ts` | `src/os/messenger/desktop/renderer/deletion_request/fedos_deletion_request_renderer.ts` |
| `src/desktop/renderer/device_management/fedos_device_management_action_descriptor.ts` | `src/os/messenger/desktop/renderer/device_management/fedos_device_management_action_descriptor.ts` |
| `src/desktop/renderer/device_management/fedos_device_management_renderer.ts` | `src/os/messenger/desktop/renderer/device_management/fedos_device_management_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_archive_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_archive_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_conversation_detail_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_conversation_detail_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_conversation_list_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_conversation_list_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_device_list_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_device_list_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_device_sync_status_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_device_sync_status_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_error_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_error_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_loading_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_loading_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_membership_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_membership_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_message_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_message_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_render_model.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_render_model.ts` |
| `src/desktop/renderer/fedos_desktop_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_reply_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_reply_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_search_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_search_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_settings_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_settings_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_status_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_status_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_sync_conflict_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_sync_conflict_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_sync_schedule_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_sync_schedule_renderer.ts` |
| `src/desktop/renderer/fedos_desktop_transfer_session_renderer.ts` | `src/os/messenger/desktop/renderer/fedos_desktop_transfer_session_renderer.ts` |
| `src/desktop/renderer/identity_transition/fedos_identity_transition_renderer.ts` | `src/os/messenger/desktop/renderer/identity_transition/fedos_identity_transition_renderer.ts` |
| `src/desktop/renderer/safety_center/fedos_safety_center_renderer.ts` | `src/os/messenger/desktop/renderer/safety_center/fedos_safety_center_renderer.ts` |
| `src/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.ts` | `src/os/messenger/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.ts` |
| `src/desktop/runtime/fedos_desktop_runtime_config.ts` | `src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.ts` |
| `src/desktop/runtime/fedos_desktop_runtime.ts` | `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts` |
| `src/desktop/runtime/fedos_device_pairing_facade.ts` | `src/os/messenger/desktop/runtime/fedos_device_pairing_facade.ts` |
| `src/desktop/runtime/fedos_device_sync_operational_facade.ts` | `src/os/messenger/desktop/runtime/fedos_device_sync_operational_facade.ts` |
| `src/desktop/runtime/fedos_device_trust_runtime.ts` | `src/os/messenger/desktop/runtime/fedos_device_trust_runtime.ts` |
| `src/desktop/runtime/run_fedos_desktop_runtime.ts` | `src/os/messenger/desktop/runtime/run_fedos_desktop_runtime.ts` |
| `src/desktop/settings/fedos_desktop_settings_application_coordinator.ts` | `src/os/messenger/desktop/settings/fedos_desktop_settings_application_coordinator.ts` |
| `src/desktop/settings/fedos_desktop_settings_application_host_bridge.ts` | `src/os/messenger/desktop/settings/fedos_desktop_settings_application_host_bridge.ts` |
| `src/desktop/settings/fedos_desktop_settings_application_host_command.ts` | `src/os/messenger/desktop/settings/fedos_desktop_settings_application_host_command.ts` |
| `src/desktop/settings/fedos_desktop_settings_application_ports.ts` | `src/os/messenger/desktop/settings/fedos_desktop_settings_application_ports.ts` |
| `src/desktop/settings/fedos_desktop_settings_controller.ts` | `src/os/messenger/desktop/settings/fedos_desktop_settings_controller.ts` |
| `src/desktop/settings/fedos_desktop_settings_host_bridge.ts` | `src/os/messenger/desktop/settings/fedos_desktop_settings_host_bridge.ts` |
| `src/desktop/settings/fedos_desktop_settings_host_command.ts` | `src/os/messenger/desktop/settings/fedos_desktop_settings_host_command.ts` |
| `src/desktop/shell/fedos_desktop_application_shell.ts` | `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts` |
| `src/desktop/shell/fedos_desktop_shell_result.ts` | `src/os/messenger/desktop/shell/fedos_desktop_shell_result.ts` |
| `src/desktop/shell/fedos_desktop_shell_view_models.ts` | `src/os/messenger/desktop/shell/fedos_desktop_shell_view_models.ts` |
| `src/desktop/static_nostr_public_identity_source.ts` | `src/os/messenger/desktop/static_nostr_public_identity_source.ts` |
| `src/desktop/subscription_messages.ts` | `src/os/messenger/desktop/subscription_messages.ts` |
| `src/desktop/tray/fedos_desktop_tray_coordinator.ts` | `src/os/messenger/desktop/tray/fedos_desktop_tray_coordinator.ts` |
| `src/desktop/tray/fedos_desktop_tray_port.ts` | `src/os/messenger/desktop/tray/fedos_desktop_tray_port.ts` |
| `src/desktop/tray/fedos_desktop_tray_types.ts` | `src/os/messenger/desktop/tray/fedos_desktop_tray_types.ts` |
| `src/desktop/validated_subscription_adapter.ts` | `src/os/messenger/desktop/validated_subscription_adapter.ts` |
| `src/desktop/websocket_relay.ts` | `src/os/messenger/desktop/websocket_relay.ts` |

