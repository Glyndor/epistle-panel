import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * The data of a chart as a table, behind a button under the drawing. A chart
 * that cannot print every value on its marks keeps them here, so no value is
 * only in a tooltip and a reader who cannot tell the colours apart has the
 * numbers. The button says whether the table is open (`aria-expanded`) and
 * looks the same either way, so the pointer and a press still change it when
 * it is open; the table under it is what shows that it is. It is closed to
 * start with and out of the page until then. The button is words only: an icon here
 * would be an `svg` with children rendered on the server, which the charts
 * avoid (see `components/charts/mark`).
 */
export function ChartData({
	label,
	children,
}: {
	/** The words on the button. */
	label: string;
	/** The table. */
	children: React.ReactNode;
}) {
	return (
		<Collapsible data-slot="chart-data" className="flex flex-col">
			<CollapsibleTrigger asChild>
				<Button variant="outline" size="sm" className="self-start">
					{label}
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent className="-mx-4 mt-3 -mb-4">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}
