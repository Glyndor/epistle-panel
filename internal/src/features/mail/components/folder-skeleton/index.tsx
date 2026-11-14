import { Skeleton } from "@/components/ui/skeleton";

/**
 * The folder tree while its folders are on their way: the place of its
 * heading and, under it, of its folders. With the folders closed only the
 * heading's place is drawn, so nothing is shown that the tree will not have.
 */
export function FolderSkeleton({ open = true }: { open?: boolean }) {
	return (
		<div
			className="flex flex-col gap-2 p-2"
			aria-busy="true"
			data-slot="folder-skeleton"
			data-state={open ? "open" : "closed"}
		>
			<Skeleton className="h-8" />
			{open ? <Skeleton className="h-8" /> : null}
		</div>
	);
}
