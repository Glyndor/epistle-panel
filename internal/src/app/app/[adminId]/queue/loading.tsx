import { QueueHeading } from "@/features/queue/components/queue-heading";
import { QueueTableSkeleton } from "@/features/queue/components/queue-table-skeleton";

/** Shown while the queue page starts: its real heading and the skeleton its table streams into. */
export default function Loading() {
	return (
		<>
			<QueueHeading />
			<QueueTableSkeleton />
		</>
	);
}
