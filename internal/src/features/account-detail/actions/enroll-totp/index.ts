"use server";

import { settle } from "@/features/account-detail/queries/settle";
import { accountInputSchema } from "@/features/account-detail/schemas/account-input";
import type { TotpSecretView } from "@/features/account-detail/schemas/account-views";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { enrollTotp } from "@/lib/api/account-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action: replace the account's TOTP secret and hand the new one to the
 * person who asked. The API replaces the secret at once and returns it only
 * here, so this answer is the only copy: it is never logged, put in a query
 * cache or kept by the page after the person has seen it.
 */
export async function enrollTotpAction(
	input: unknown,
): Promise<ActionResult<Outcome<TotpSecretView>>> {
	return runValidatedAction(
		"account totp enroll",
		accountInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() => enrollTotp(data.name));
			return outcome.kind === "done"
				? {
						kind: "done",
						value: {
							secret: outcome.value.secret,
							otpauthUri: outcome.value.otpauth_uri,
						},
					}
				: outcome;
		},
	);
}
