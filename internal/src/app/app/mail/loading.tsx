import { FolderSkeleton } from "@/features/mail/components/folder-skeleton";
import { ListPaneSkeleton } from "@/features/mail/components/list-skeleton";

/**
 * Shown while the webmail starts: the three panes of the page, in the same
 * grid, with the skeleton each one streams into. The reader is left empty, as
 * it is until a message is opened.
 */
export default function Loading() {
	return (
		<div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-2 p-2 lg:grid-cols-[14rem_minmax(18rem,26rem)_minmax(0,1fr)]">
			<div className="hidden min-h-0 rounded-2xl bg-background lg:block">
				<FolderSkeleton />
			</div>
			<div className="flex min-h-0 flex-col rounded-2xl bg-background">
				<ListPaneSkeleton />
			</div>
			<div className="min-h-0 rounded-2xl bg-background max-lg:hidden" />
		</div>
	);
}
