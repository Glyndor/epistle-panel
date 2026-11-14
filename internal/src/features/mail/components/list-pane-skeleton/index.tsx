import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/features/mail/components/list-skeleton";

/**
 * The list pane before its folder is known: the place of the search field and
 * of the filter row, then the list, so nothing below them moves when they
 * arrive.
 */
export function ListPaneSkeleton() {
	return (
		<>
			<div className="flex flex-col gap-2 p-2" aria-hidden="true">
				<Skeleton className="h-8 pointer-coarse:h-11" />
				<Skeleton className="h-8 w-2/3 pointer-coarse:h-11" />
			</div>
			<div className="relative min-h-0 flex-1 scroll-pt-8 overflow-y-auto">
				<ListSkeleton />
			</div>
		</>
	);
}
