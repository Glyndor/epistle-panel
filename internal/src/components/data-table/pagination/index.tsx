import { useTranslations } from "next-intl";
import { useId } from "react";

import {
	isPageSize,
	PAGE_SIZES,
	type PageSize,
	pageCountOf,
	pageItems,
	pageRange,
} from "@/components/data-table/paging";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";

/**
 * The foot of a paged table: which rows are on screen, the page size, and the
 * page controls. Previous and next are there at every width; the page numbers
 * join them once the foot is wide enough, and below that a "page 2 of 6" stands
 * between the two. A list that fits one page has no page controls, only its
 * range and the size. The table's announcer, not this text, tells a screen
 * reader that the range changed.
 */
export function DataTablePagination({
	pageIndex,
	pageSize,
	count,
	onPageChange,
	onPageSizeChange,
}: {
	/** The page on screen, counted from 0. */
	pageIndex: number;
	pageSize: PageSize;
	/** Rows left after the filters, over every page. */
	count: number;
	onPageChange: (pageIndex: number) => void;
	onPageSizeChange: (pageSize: PageSize) => void;
}) {
	const t = useTranslations("table");
	const sizeId = useId();
	const pages = pageCountOf(count, pageSize);
	const page = pageIndex + 1;
	const { from, to } = pageRange(pageIndex, pageSize, count);

	return (
		<div className="@container">
			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
				<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
					<p className="text-muted-foreground tabular-nums">
						{t("range", { from, to, count })}
					</p>
					<div className="flex items-center gap-2">
						<Label htmlFor={sizeId} className="font-normal">
							{t("pageSize")}
						</Label>
						<div className="w-20">
							<NativeSelect
								id={sizeId}
								value={pageSize}
								onChange={(event) => {
									const size = Number(event.target.value);
									if (isPageSize(size)) {
										onPageSizeChange(size);
									}
								}}
							>
								{PAGE_SIZES.map((size) => (
									<NativeSelectOption key={size} value={size}>
										{size}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
					</div>
				</div>
				{pages === 1 ? null : (
					<Pagination aria-label={t("pagination")}>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									disabled={page === 1}
									onClick={() => onPageChange(pageIndex - 1)}
								>
									{t("previous")}
								</PaginationPrevious>
							</PaginationItem>
							<PaginationItem className="px-2 text-muted-foreground tabular-nums @md:hidden">
								{t("pageOf", { page, pages })}
							</PaginationItem>
							{pageItems(page, pages).map((item) =>
								typeof item === "number" ? (
									<PaginationItem
										key={item}
										className="hidden @md:block"
									>
										<PaginationLink
											isActive={item === page}
											aria-label={t("page", {
												page: item,
											})}
											onClick={() =>
												onPageChange(item - 1)
											}
										>
											{item}
										</PaginationLink>
									</PaginationItem>
								) : (
									<PaginationItem
										key={item}
										aria-hidden="true"
										className="hidden @md:block"
									>
										<PaginationEllipsis />
									</PaginationItem>
								),
							)}
							<PaginationItem>
								<PaginationNext
									disabled={page === pages}
									onClick={() => onPageChange(pageIndex + 1)}
								>
									{t("next")}
								</PaginationNext>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				)}
			</div>
		</div>
	);
}
