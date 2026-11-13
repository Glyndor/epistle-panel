import "server-only";

import type { MaskedRow } from "@/features/account-detail/schemas/account-views";
import { getMasked } from "@/lib/api/account-client";
import { type AccountName, maskedAddressSchema } from "@/lib/api/schemas";

/** Read the masked addresses of an account, in the API's order (creation order). */
export async function loadMasked(
	name: AccountName,
): Promise<readonly MaskedRow[]> {
	const { addresses } = await getMasked(name);
	return addresses.map((entry) => ({
		address: entry.address,
		label: entry.label,
		enabled: entry.enabled,
		createdAt: entry.created_at,
		lastUsedAt: entry.last_used_at ?? null,
		removable: maskedAddressSchema.safeParse(entry.address).success,
	}));
}
