/** One mailbox of an account, with how deep it sits in the tree (0 for a top-level one). */
export interface MailboxRow {
	readonly id: string;
	readonly name: string;
	readonly depth: number;
}

/** One masked address. `lastUsedAt` is epoch seconds, `null` until the first delivery. */
export interface MaskedRow {
	readonly address: string;
	readonly label: string;
	readonly enabled: boolean;
	readonly createdAt: number;
	readonly lastUsedAt: number | null;
	/** Whether the address has the shape the server mints, so it can go in a removal path. */
	readonly removable: boolean;
}

/** One archived (expunged) message. `deletedAt` is epoch seconds. */
export interface ArchiveRow {
	readonly id: string;
	readonly mailbox: string;
	readonly deletedAt: number;
}

/**
 * The archive of an account. It exists only when the server keeps deleted mail
 * (`deleted_retention_days`), and a `404` is a normal answer, so it is a state
 * of its own and not a failure.
 */
export type ArchiveView =
	| { readonly state: "available"; readonly entries: readonly ArchiveRow[] }
	| { readonly state: "unavailable" };

/** A masked address minted just now. */
export interface MaskedCreatedView {
	readonly address: string;
}

/** The secret of a fresh TOTP enrolment; it is shown once and never kept. */
export interface TotpSecretView {
	readonly secret: string;
	readonly otpauthUri: string;
}

/** Where a restored message went. */
export interface RestoredView {
	readonly restoredTo: string;
}

/** What a display-name change stored, `null` when it was cleared. */
export interface DisplayNameView {
	readonly displayName: string | null;
}
