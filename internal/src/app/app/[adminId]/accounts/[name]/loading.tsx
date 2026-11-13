import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";

/**
 * Shown while an account page starts. The heading names the account, which a
 * loading state is not given, so a bar holds the heading's line instead.
 */
export default function Loading() {
	return (
		<>
			<Skeleton aria-hidden="true" className="h-7 w-56 rounded-md" />
			<AccountDetailSkeleton />
		</>
	);
}
