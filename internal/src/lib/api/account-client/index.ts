import "server-only";

import { z } from "zod";

import { request } from "../request";
import {
	type AccountName,
	type ArchiveList,
	accountNameSchema,
	archiveListSchema,
	type DisplayNameStored,
	displayNameSchema,
	type Mailboxes,
	type MaskedAddress,
	type MaskedCreated,
	type MaskedList,
	type MaskedRemoved,
	mailboxesSchema,
	maskedAddressSchema,
	maskedCreatedSchema,
	maskedListSchema,
	maskedRemovedSchema,
	type Restored,
	restoredSchema,
	type TotpEnrolled,
	totpEnrolledSchema,
	type Updated,
	updatedSchema,
} from "../schemas";

/**
 * The path of one account. The name is checked here as well as by the caller,
 * so a value that is not an account name never becomes a path segment: `..`
 * survives `encodeURIComponent` and would climb out of `/accounts`.
 */
function accountPath(name: AccountName): string {
	return `/api/v1/accounts/${accountNameSchema.parse(name)}`;
}

function jsonInit(method: string, body: unknown): RequestInit {
	return {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	};
}

/** List the mailboxes of an account. */
export async function getMailboxes(name: AccountName): Promise<Mailboxes> {
	return request(`${accountPath(name)}/mailboxes`, mailboxesSchema);
}

/** List the masked addresses of an account. */
export async function getMasked(name: AccountName): Promise<MaskedList> {
	return request(`${accountPath(name)}/masked`, maskedListSchema);
}

/** Mint a masked address from `label`; the server picks the random part. */
export async function createMasked(
	name: AccountName,
	label: string,
): Promise<MaskedCreated> {
	return request(
		`${accountPath(name)}/masked`,
		maskedCreatedSchema,
		jsonInit("POST", { label }),
	);
}

/** Remove one masked address of an account. */
export async function removeMasked(
	name: AccountName,
	address: MaskedAddress,
): Promise<MaskedRemoved> {
	return request(
		`${accountPath(name)}/masked/${encodeURIComponent(maskedAddressSchema.parse(address))}`,
		maskedRemovedSchema,
		{ method: "DELETE" },
	);
}

/** List the archived (expunged) messages of an account. */
export async function getArchive(name: AccountName): Promise<ArchiveList> {
	return request(`${accountPath(name)}/archive`, archiveListSchema);
}

/** Put one archived message back in its mailbox. */
export async function restoreArchived(
	name: AccountName,
	id: string,
): Promise<Restored> {
	return request(
		`${accountPath(name)}/archive/${z.uuid().parse(id)}/restore`,
		restoredSchema,
		{ method: "POST" },
	);
}

/** Replace the password of an API-managed account. The password is never logged. */
export async function setPassword(
	name: AccountName,
	password: string,
): Promise<Updated> {
	return request(
		`${accountPath(name)}/password`,
		updatedSchema,
		jsonInit("PUT", { password }),
	);
}

/** Set the person's name of an account; an empty value clears it. */
export async function setDisplayName(
	name: AccountName,
	displayName: string,
): Promise<DisplayNameStored> {
	return request(
		`${accountPath(name)}/display_name`,
		displayNameSchema,
		jsonInit("PUT", { display_name: displayName }),
	);
}

/** Replace the TOTP secret of an account and return the new one. */
export async function enrollTotp(name: AccountName): Promise<TotpEnrolled> {
	return request(`${accountPath(name)}/totp`, totpEnrolledSchema, {
		method: "POST",
	});
}

/** Turn two-factor authentication off for an account. */
export async function disableTotp(name: AccountName): Promise<Updated> {
	return request(`${accountPath(name)}/totp`, updatedSchema, {
		method: "DELETE",
	});
}
