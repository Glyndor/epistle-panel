import { TableSkeleton } from "@/components/skeletons/table-skeleton";

/**
 * The waiting state of the domains table, with its 1 column. The route's
 * `loading.tsx`, the page's `Suspense` fallback and the table's own pending
 * state draw this one, so the three cannot differ.
 */
export function DomainsTableSkeleton() {
	return <TableSkeleton columns={1} />;
}
