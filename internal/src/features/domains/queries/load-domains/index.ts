import "server-only";

import type { DomainRow } from "@/features/domains/schemas/domains-view";
import { getDomains } from "@/lib/api/client";

/**
 * Read the configured domains from the API as table rows, each with whether
 * the server has it switched off.
 */
export async function loadDomains(): Promise<readonly DomainRow[]> {
	const { domains, disabled } = await getDomains();
	const off = new Set(disabled ?? []);
	return domains.map((name) => ({ name, disabled: off.has(name) }));
}
