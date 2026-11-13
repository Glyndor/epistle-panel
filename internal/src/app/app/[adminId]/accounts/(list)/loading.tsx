import { AccountsHeading } from "@/features/accounts/components/accounts-heading";
import { AccountsTableSkeleton } from "@/features/accounts/components/accounts-table-skeleton";

/** Shown while the accounts page starts: its real heading and the skeleton its table streams into. */
export default function Loading() {
	return (
		<>
			<AccountsHeading />
			<AccountsTableSkeleton />
		</>
	);
}
