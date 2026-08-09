/**
 * FedOS Identity Transition Foundation Arc — shared size-limit constants.
 *
 * Split into its own file (rather than living in
 * `fedos_identity_transition_record.ts` or `fedos_identity_transition_id.ts`)
 * purely to avoid a circular import between those two files, which both
 * need this bound.
 */
export const FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH = 256;
