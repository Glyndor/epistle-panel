import "server-only";

import type { DomainRow } from "@/features/domains/schemas/domains-view";
import { getDomains } from "@/lib/api/client";

/** Read the configured domains from the API as table rows. */
export async function loadDomains(): Promise<readonly DomainRow[]> {
	const { domains } = await getDomains();
	return domains.map((name) => ({ name }));
}
