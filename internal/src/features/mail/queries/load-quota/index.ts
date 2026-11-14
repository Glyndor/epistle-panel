import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import { quotaGetSchema } from "@/features/mail/jmap/responses";
import type { QuotaView } from "@/features/mail/schemas/mail-view";

/**
 * The account's storage: what it uses and its limit, in bytes. `null` when
 * the server lists no quota counted in octets. A limit of zero is no limit:
 * epistle spells "no quota" as 0 in its configuration and as `null` here, and
 * a meter of zero could only ever read as full.
 */
export async function loadQuota(
	session: MailSession,
): Promise<QuotaView | null> {
	const responses = await jmapCall(session, [
		["Quota/get", { accountId: session.accountId, ids: null }, "q"],
	]);
	const quota = methodResult(
		responses,
		"q",
		"Quota/get",
		quotaGetSchema,
	).list.find((entry) => entry.resourceType === "octets");
	if (quota === undefined) {
		return null;
	}
	return {
		used: quota.used,
		limit: quota.limit ? quota.limit : null,
	};
}
