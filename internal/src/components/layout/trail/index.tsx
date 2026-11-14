import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/class-names";

/** One step of a trail, already in the reader's language. */
export interface TrailStep {
	/** Stable among the steps of one trail. */
	readonly key: string;
	/** What the step says; `null` while its name is not known yet, and a bar holds its place. */
	readonly text: string | null;
	/** Where the step leads. A step with no address is plain text. */
	readonly href?: Route | undefined;
	/** The page the person is on: marked with `aria-current`, never a link. */
	readonly current?: boolean | undefined;
	/**
	 * Text somebody else wrote (a folder's name, a subject): kept apart from
	 * the direction of the text around it with `bdi`.
	 */
	readonly foreign?: boolean | undefined;
}

/**
 * The trail to the current page, drawn in the bar above the content: one line
 * whatever its steps say. Each step is cut short where the bar has no room,
 * the last one first, so the bar is as tall with a short name, with a long
 * one and with the bar that holds an unknown name's place. Below 768 px the
 * first step, the area itself, is left out: the sidebar's sheet leads there.
 */
export function Trail({
	label,
	steps,
}: {
	/** Name of the navigation landmark, already translated. */
	label: string;
	steps: readonly TrailStep[];
}) {
	return (
		<Breadcrumb aria-label={label} className="min-w-0">
			<BreadcrumbList className="flex-nowrap">
				{steps.map((step, index) => {
					const first = index === 0 && steps.length > 1;
					const text = step.foreign ? (
						<bdi>{step.text}</bdi>
					) : (
						step.text
					);
					return (
						<Fragment key={step.key}>
							{index > 0 ? (
								<BreadcrumbSeparator
									className={cn(
										"shrink-0",
										index === 1 && "max-md:hidden",
									)}
								/>
							) : null}
							<BreadcrumbItem
								className={cn(
									"min-w-0",
									first && "max-md:hidden",
									step.current || step.text === null
										? "shrink"
										: "max-w-40 shrink-0 max-md:max-w-28",
								)}
							>
								{step.text === null ? (
									<Skeleton className="h-4 w-24 max-w-full rounded-md" />
								) : step.current ? (
									<BreadcrumbPage className="min-w-0 truncate">
										{text}
									</BreadcrumbPage>
								) : step.href === undefined ? (
									<span className="min-w-0 truncate px-1">
										{text}
									</span>
								) : (
									<BreadcrumbLink
										asChild
										className="min-w-0 max-w-full"
									>
										<Link href={step.href}>
											<span className="truncate">
												{text}
											</span>
										</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
