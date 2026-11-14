import { Skeleton } from "@/components/ui/skeleton";
import { ListPaneSkeleton } from "@/features/mail/components/list-skeleton";
import { readListDensity } from "@/features/mail/queries/list-density";

/**
 * Shown while a folder of the webmail starts: the two panes of the page, in
 * the same grid, with the skeleton the list streams into. The reader is left
 * empty, as it is until a message is opened. The folders are in the sidebar,
 * which the layout already drew. The list's place is drawn in the density
 * the reader chose, like the list that replaces it.
 */
export default async function Loading() {
	const density = await readListDensity();

	return (
		<div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-2 p-2 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]">
			<div
				data-density={density}
				className="group/list flex min-h-0 flex-col rounded-2xl bg-surface"
			>
				{/* The place of the way into the composer, which the page draws here below 768 px: without it the list stood 40 px higher while this showed. */}
				<div
					aria-hidden="true"
					data-slot="write-place"
					className="flex items-center gap-2 p-2 md:hidden"
				>
					<Skeleton className="h-6 w-20 pointer-coarse:h-11" />
				</div>
				<ListPaneSkeleton />
			</div>
			<div className="min-h-0 rounded-2xl bg-surface max-lg:hidden" />
		</div>
	);
}
