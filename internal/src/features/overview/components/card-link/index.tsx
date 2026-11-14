import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The link at the end of a chart card's title row, to the page the data lives
 * on. Words only: an icon here would be an `svg` with children rendered on the
 * server, which the charts avoid (see `components/charts/mark`).
 */
export function CardLink({ href, label }: { href: Route; label: string }) {
	return (
		<Button asChild variant="ghost" size="sm" className="-me-2 -mt-1">
			<Link href={href}>{label}</Link>
		</Button>
	);
}
