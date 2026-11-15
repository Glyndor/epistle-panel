import { DomainsHeading } from "@/features/domains/components/domains-heading";
import { DomainsTableSkeleton } from "@/features/domains/components/domains-table-skeleton";

/** Shown while the domains page starts: its real heading and the skeleton its table streams into. */
export default function Loading() {
	return (
		<>
			<DomainsHeading />
			<DomainsTableSkeleton />
		</>
	);
}
