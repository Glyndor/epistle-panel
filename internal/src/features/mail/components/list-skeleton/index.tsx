import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** The message list while a page of it is on its way, said once to a screen reader. */
export function ListSkeleton() {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-col gap-2 p-3" aria-busy="true">
			<span className="sr-only" role="status">
				{t("loading")}
			</span>
			<Skeleton className="h-14" />
			<Skeleton className="h-14" />
			<Skeleton className="h-14" />
		</div>
	);
}

/**
 * The list pane before its folder is known: the place of the search field and
 * of the filter row, then the list, so nothing below them moves when they
 * arrive.
 */
export function ListPaneSkeleton() {
	return (
		<>
			<div className="flex flex-col gap-2 p-2" aria-hidden="true">
				<Skeleton className="h-9" />
				<Skeleton className="h-7 w-2/3" />
			</div>
			<div className="relative min-h-0 flex-1 overflow-y-auto">
				<ListSkeleton />
			</div>
		</>
	);
}
