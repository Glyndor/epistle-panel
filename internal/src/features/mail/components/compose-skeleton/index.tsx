import { Skeleton } from "@/components/ui/skeleton";

/** The composer while it starts: the place of its fields, its body and its buttons. */
export function ComposeSkeleton() {
	return (
		<div className="flex flex-col gap-3 p-4" aria-busy="true">
			<Skeleton className="h-9" />
			<Skeleton className="h-9" />
			<Skeleton className="h-9" />
			<Skeleton className="h-64" />
			<Skeleton className="h-9 w-40" />
		</div>
	);
}
