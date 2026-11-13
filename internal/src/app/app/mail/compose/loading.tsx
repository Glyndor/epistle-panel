import { ComposeSkeleton } from "@/features/mail/components/compose-skeleton";

/** Shown while the composer starts, in the frame the composer has. */
export default function Loading() {
	return (
		<div className="h-full overflow-y-auto p-2">
			<div className="mx-auto max-w-3xl rounded-2xl bg-background">
				<ComposeSkeleton />
			</div>
		</div>
	);
}
