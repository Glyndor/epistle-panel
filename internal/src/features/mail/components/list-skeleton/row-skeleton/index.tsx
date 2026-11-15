import { Skeleton } from "@/components/ui/skeleton";

/**
 * The place of one row: the same height, margins and parts as `MessageRow` in
 * either density (the initials where the row is wide enough for them, then
 * the lines beside them), so nothing moves when the messages arrive.
 */
export function RowSkeleton() {
	return (
		<div
			data-slot="row-skeleton"
			className="@container/row grid h-18 grid-cols-[auto_minmax(0,1fr)] content-center items-center ps-5 pe-3 group-data-[density=compact]/list:h-10 group-data-[density=compact]/list:pe-21 pointer-coarse:pe-34 pointer-coarse:group-data-[density=compact]/list:h-11 pointer-coarse:group-data-[density=compact]/list:pe-34"
		>
			<Skeleton className="row-span-3 me-3 mt-1 hidden size-8 self-start rounded-full @xs/row:block group-data-[density=compact]/list:me-2 group-data-[density=compact]/list:mt-0 group-data-[density=compact]/list:row-span-2 group-data-[density=compact]/list:hidden group-data-[density=compact]/list:size-6 group-data-[density=compact]/list:self-center group-data-[density=compact]/list:@sm/row:block" />
			<span className="col-start-2 flex h-5 items-center group-data-[density=compact]/list:h-4">
				<Skeleton className="h-3 w-1/3 rounded-md" />
			</span>
			<span className="col-start-2 flex h-5 items-center group-data-[density=compact]/list:h-4">
				<Skeleton className="h-3 w-2/3 rounded-md" />
			</span>
			<span className="col-start-2 flex h-4 items-center group-data-[density=compact]/list:hidden">
				<Skeleton className="h-2.5 w-1/2 rounded-md" />
			</span>
		</div>
	);
}
