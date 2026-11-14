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
	/**
	 * A step that leads up to where the person is and can go without being
	 * drawn where the bar is narrow (the area itself, the folders above a
	 * folder): below 768 px it is kept for a screen reader, as text, and takes
	 * no room.
	 */
	readonly collapse?: boolean | undefined;
}

/**
 * The trail to the current page, drawn in the bar above the content: one line
 * whatever its steps say. The last step takes the room the others leave and is
 * the one that is cut short, so the bar is as tall with a short name, with a
 * long one and with the bar that holds an unknown name's place. A step before
 * the last is written whole; it gives way only when it alone is wider than the
 * bar. Below 768 px the steps marked `collapse` are not drawn.
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
		<Breadcrumb aria-label={label} className="min-w-0 flex-1">
			<BreadcrumbList className="flex-nowrap">
				{steps.map((step, index) => {
					const last = index === steps.length - 1;
					const collapse = step.collapse === true && !last;
					const text = step.foreign ? (
						<bdi>{step.text}</bdi>
					) : (
						step.text
					);
					return (
						<Fragment key={step.key}>
							<BreadcrumbItem
								className={cn(
									// The last step has no width of its own: it
									// takes what is left, so the steps before it
									// are never squeezed to make it room.
									last
										? "min-w-6 flex-1 basis-0"
										: "min-w-0 shrink",
									collapse && "max-md:sr-only",
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
									<>
										<BreadcrumbLink
											asChild
											className={cn(
												"min-w-0 max-w-full",
												// A link nobody can see must not
												// take the focus: where the step
												// is not drawn the link is gone.
												collapse && "max-md:hidden",
											)}
										>
											<Link href={step.href}>
												<span className="truncate">
													{text}
												</span>
											</Link>
										</BreadcrumbLink>
										{collapse ? (
											// And its words stand in for it,
											// for a screen reader. Written a
											// second time on purpose: a hidden
											// link with its words left visible
											// reached no accessibility tree
											// that was tried.
											<span
												data-slot="breadcrumb-narrow"
												className="md:hidden"
											>
												{text}
											</span>
										) : null}
									</>
								)}
							</BreadcrumbItem>
							{last ? null : (
								<BreadcrumbSeparator
									className={cn(
										"shrink-0",
										collapse && "max-md:hidden",
									)}
								/>
							)}
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
