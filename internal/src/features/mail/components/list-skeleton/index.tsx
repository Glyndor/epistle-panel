import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { RowSkeleton } from "@/features/mail/components/list-skeleton/row-skeleton";

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
		<div className="px-2 pb-2" aria-busy="true">
			<span className="sr-only" role="status">
				{t("loading")}
			</span>
			<div className="flex h-8 items-center px-3">
				<Skeleton className="h-3 w-16 rounded-md" />
			</div>
			{/* The heading stands right on its rows, as in the list: a gap here was a jump of its size when the messages came. */}
			<div className="flex flex-col gap-1">
				{ROWS.map((row) => (
					<RowSkeleton key={row} />
				))}
			</div>
		</div>
	);
}
