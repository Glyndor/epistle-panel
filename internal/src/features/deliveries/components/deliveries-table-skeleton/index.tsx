import { TableSkeleton } from "@/components/skeletons/table-skeleton";

/**
 * The waiting state of the delivery log, with its 8 columns. The route's
 * `loading.tsx`, the page's `Suspense` fallback and the table's own pending
 * state draw this one, so the three cannot differ.
 */
export function DeliveriesTableSkeleton() {
	return <TableSkeleton columns={8} />;
}
