import { Suspense } from "react";

import {
	accountSectionNeedsAccount,
	parseSectionParam,
} from "@/features/account-detail/schemas/account-section";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { accountLeaf } from "@/features/navigation/queries/account-leaf";
import { requireAdmin } from "@/lib/auth/require-session";
import type { AdminRoutes } from "@/lib/routes";

/** The trail once the accounts list has answered: the account, or no last step for a name that is none. */
async function AccountTrail({
	routes,
	segment,
	validate,
}: {
	routes: AdminRoutes;
	segment: string;
	validate: boolean;
}) {
	const name = await accountLeaf(segment, validate);

	return (
		<AdminBreadcrumbs
			routes={routes}
			page="accounts"
			leaf={name ?? false}
		/>
	);
}

/**
 * The trail of an account's page, in the header: the administration and the
 * accounts list at once, then the account, streamed in once the list says it
 * is one. Until then a bar holds the last step's place; for a name that is no
 * account there is no last step. Either way no step is the current page.
 */
export default async function Trail({
	params,
	searchParams,
}: {
	params: Promise<{ name: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { routes } = await requireAdmin();
	const segment = (await params).name;
	const section = parseSectionParam((await searchParams)["section"]);

	return (
		<Suspense
			key={`${segment}-${section}`}
			fallback={
				<AdminBreadcrumbs routes={routes} page="accounts" leaf={null} />
			}
		>
			<AccountTrail
				routes={routes}
				segment={segment}
				validate={accountSectionNeedsAccount(section)}
			/>
		</Suspense>
	);
}
