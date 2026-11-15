import { SuppressionHeading } from "@/features/suppression/components/suppression-heading";
import { SuppressionTableSkeleton } from "@/features/suppression/components/suppression-table-skeleton";

/** Shown while the suppression page starts: its real heading and the skeleton its table streams into. */
export default function Loading() {
	return (
		<>
			<SuppressionHeading />
			<SuppressionTableSkeleton />
		</>
	);
}
