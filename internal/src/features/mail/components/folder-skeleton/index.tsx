import { Skeleton } from "@/components/ui/skeleton";

/** The folder tree while its folders are on their way. */
export function FolderSkeleton() {
	return (
		<div className="flex flex-col gap-2 p-2" aria-busy="true">
			<Skeleton className="h-8" />
			<Skeleton className="h-8" />
		</div>
	);
}
