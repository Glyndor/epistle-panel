import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

/**
 * The waiting state of a `DataTable`, drawn with the same parts: the filter bar
 * at the height of the field, then a table whose header and rows have the
 * height of real ones (a text line in the same cell padding). A page shows it
 * in its `loading.tsx`, in its `Suspense` fallback and while its query has no
 * data, so the three states are one drawing and the table replaces it without
 * moving what is above.
 *
 * Only one sentence reaches a screen reader, a status that names the wait; the
 * blocks are hidden from it and the region is marked busy.
 */
export function TableSkeleton({
	columns,
	rows = 3,
	toolbar = true,
}: {
	/** Columns of the table it stands for. */
	columns: number;
	/** Rows to draw; the real count is not known yet. */
	rows?: number;
	/** Whether the table has the filter bar above it. */
	toolbar?: boolean;
}) {
	const t = useTranslations("table");
	const cells = Array.from({ length: columns }, (_, index) => `c${index}`);
	return (
		<div className="flex flex-col gap-2">
			<p className="sr-only" role="status">
				{t("loading")}
			</p>
			<div
				aria-busy="true"
				data-testid="table-skeleton"
				className="flex flex-col gap-2"
			>
				{toolbar ? (
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton className="h-8 w-full max-w-64 rounded-lg pointer-coarse:h-11" />
						<Skeleton className="h-5 w-20 rounded-md" />
					</div>
				) : null}
				<Table aria-hidden="true">
					<TableHeader>
						<TableRow>
							{cells.map((cell) => (
								<TableHead key={cell}>
									<Skeleton className="h-5 w-24 rounded-md" />
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from(
							{ length: rows },
							(_, row) => `r${row}`,
						).map((row) => (
							<TableRow key={row}>
								{cells.map((cell) => (
									<TableCell key={cell}>
										<Skeleton className="h-5 rounded-md" />
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
