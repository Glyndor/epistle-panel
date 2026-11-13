import { Input } from "@/components/ui/input";

/** Longest text the filter takes, in characters: no value a row shows is longer than an address. */
const FILTER_MAX = 254;

/**
 * The bar above a panel table: the text filter, the Filters menu when the
 * table has facets, how many rows match, and whatever the page adds at the
 * end (the links of a list the server pages).
 */
export function DataTableToolbar({
	filterLabel,
	filter,
	onFilterChange,
	inputRef,
	count,
	filters,
	children,
}: {
	/** Visible label of the filter field; it also names the input. */
	filterLabel: string;
	filter: string;
	onFilterChange: (value: string) => void;
	/** The filter field, so the table can send the focus back to it. */
	inputRef: React.Ref<HTMLInputElement>;
	/** The sentence that counts the rows. The table's announcer says a change of it. */
	count: string;
	/** The Filters menu, when the table has facets. */
	filters?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Input
				ref={inputRef}
				type="search"
				name="filter"
				maxLength={FILTER_MAX}
				value={filter}
				onChange={(event) => onFilterChange(event.target.value)}
				aria-label={filterLabel}
				placeholder={filterLabel}
				className="max-w-64"
			/>
			{filters}
			<p className="text-muted-foreground">{count}</p>
			{children ? (
				<div className="ms-auto flex items-center gap-2">
					{children}
				</div>
			) : null}
		</div>
	);
}
