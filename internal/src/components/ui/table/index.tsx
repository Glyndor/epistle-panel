import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A semantic table in a container that scrolls sideways when the columns do
 * not fit, so an action column is never clipped on a narrow screen.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div
			data-slot="table-container"
			className="relative w-full overflow-x-auto rounded-lg border"
		>
			<table
				data-slot="table"
				className={cn("w-full text-left text-sm", className)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			data-slot="table-header"
			className={cn("[&_tr]:border-b", className)}
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot="table-body"
			className={cn("[&_tr:last-child]:border-0", className)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			data-slot="table-row"
			className={cn("border-b", className)}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot="table-head"
			className={cn("px-4 py-3 align-middle font-medium", className)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot="table-cell"
			className={cn("px-4 py-3 align-middle", className)}
			{...props}
		/>
	);
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
