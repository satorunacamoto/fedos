/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Schema Version.
 *
 * ONE literal schema version for every new wire shape this Arc adds
 * (`FedosConversationArchiveBundleV1`, `FedosConversationArchiveManifestV1`)
 * — mirrors every existing `Persisted*V1` type's own `schemaVersion: 1`
 * literal-numeric-type discipline (Alpha 750/825/833/858/803), kept as
 * ONE named constant here so every Archive file references the same
 * value rather than repeating the literal `1` independently.
 *
 * HARD GUARDRAILS:
 *   - No silent migration path: a mismatched schema version is always
 *     rejected (`null`/`"invalid-input"`-shaped outcome), never guessed
 *     at or auto-upgraded, matching every existing codec in this
 *     codebase.
 *   - This file defines constants/types ONLY — no function, no class.
 */

export const FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION = 1 as const;

export type FedosConversationArchiveSchemaVersion = typeof FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION;
