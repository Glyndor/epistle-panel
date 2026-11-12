"use server";

import { loadDomains } from "@/features/domains/queries/load-domains";
import type { DomainRow } from "@/features/domains/schemas/domains-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runAction } from "@/lib/query/run-action";

/** Server Action behind the domains query. */
export async function getDomainsAction(): Promise<
	ActionResult<readonly DomainRow[]>
> {
	return runAction("domains fetch", loadDomains);
}
