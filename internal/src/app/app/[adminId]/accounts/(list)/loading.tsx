import { AccountsHeading } from "@/features/accounts/components/accounts-heading";
import { AccountsTableSkeleton } from "@/features/accounts/components/accounts-table-skeleton";

/**
 * Shown while the accounts page starts: its real heading and the skeleton its
 * table streams into. The list lives in a route group so this is not also the
 * first paint of an account's own page, the folder below.
 */
export default function Loading() {
	return (
		<>
			<AccountsHeading />
			<AccountsTableSkeleton />
		</>
	);
}
