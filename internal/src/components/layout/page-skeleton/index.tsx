import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a signed-in page shows while it streams: the heading's height and a
 * block for the content. It is the route's `loading.tsx`, so navigating between
 * pages shows the shell at once and the page fills in when its data arrives.
 */
export function PageSkeleton() {
	return (
		<div aria-busy="true" className="flex flex-col gap-3">
			<Skeleton className="h-7 w-40" />
			<Skeleton className="h-24" />
		</div>
	);
}
