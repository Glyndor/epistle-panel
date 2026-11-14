import { TableSkeleton } from "@/components/skeletons/table-skeleton";

/**
 * The waiting state of the accounts table, with its 4 columns. The route's
 * `loading.tsx`, the page's `Suspense` fallback and the table's own pending
 * state draw this one, so the three cannot differ.
 */
export function AccountsTableSkeleton() {
	return <TableSkeleton columns={4} />;
}
