import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The place of one row: the same height, margins and parts as `MessageRow` in
 * either density (the initials, then the lines beside them), so nothing moves
 * when the messages arrive.
 */
function RowSkeleton() {
	return (
		<div
			data-slot="row-skeleton"
			className="grid h-18 grid-cols-[auto_minmax(0,1fr)] content-center items-center gap-x-3 ps-5 pe-3 group-data-[density=compact]/list:h-10 group-data-[density=compact]/list:grid-cols-[auto_5rem_minmax(0,1fr)] group-data-[density=compact]/list:gap-x-2 pointer-coarse:group-data-[density=compact]/list:h-11"
		>
			<Skeleton className="row-span-3 mt-1 size-8 self-start rounded-full group-data-[density=compact]/list:row-span-1 group-data-[density=compact]/list:mt-0 group-data-[density=compact]/list:size-6 group-data-[density=compact]/list:self-center" />
			<span className="col-start-2 flex h-5 items-center">
				<Skeleton className="h-3 w-1/3 rounded-md group-data-[density=compact]/list:w-full" />
			</span>
			<span className="col-start-2 flex h-5 items-center group-data-[density=compact]/list:col-start-3 group-data-[density=compact]/list:row-start-1">
				<Skeleton className="h-3 w-2/3 rounded-md" />
			</span>
			<span className="col-start-2 flex h-4 items-center group-data-[density=compact]/list:hidden">
				<Skeleton className="h-2.5 w-1/2 rounded-md" />
			</span>
		</div>
	);
}

/** How many rows hold the list's place. */
const ROWS = ["a", "b", "c", "d", "e", "f"] as const;

/**
 * The message list while a page of it is on its way, said once to a screen
 * reader: the place of a date heading, then rows of the shape and the density
 * of the real ones.
 */
export function ListSkeleton() {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-col gap-1 px-2 pb-2" aria-busy="true">
			<span className="sr-only" role="status">
				{t("loading")}
			</span>
			<div className="flex h-8 items-center px-3">
				<Skeleton className="h-3 w-16 rounded-md" />
			</div>
			{ROWS.map((row) => (
				<RowSkeleton key={row} />
			))}
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
			<div className="relative min-h-0 flex-1 scroll-pt-8 overflow-y-auto">
				<ListSkeleton />
			</div>
		</>
	);
}
