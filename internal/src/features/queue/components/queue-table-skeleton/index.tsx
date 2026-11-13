import { TableSkeleton } from "@/components/skeletons/table-skeleton";

/**
 * The waiting state of the queue table, with its 3 columns. The route's
 * `loading.tsx`, the page's `Suspense` fallback and the table's own pending
 * state draw this one, so the three cannot differ.
 */
export function QueueTableSkeleton() {
	return <TableSkeleton columns={3} />;
}
