import type * as React from "react";

import { Illustration, type IllustrationName } from "@/components/illustration";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";

/**
 * The state of a list or a pane with nothing in it, told the same way
 * everywhere: a drawing, a title, one sentence and the next step, which is
 * a real link or button the caller passes. The text carries the meaning; the
 * drawing is decoration (see {@link Illustration}). It is presentational, so a
 * server component and a client one draw it alike; what the caller needs on the
 * wrapper (`role="status"` for an empty list that appears after a navigation)
 * goes through the props.
 */
export function EmptyState({
	illustration,
	title,
	description,
	action,
	...props
}: {
	illustration: IllustrationName;
	title: string;
	/** The one sentence: why it is empty and what to do. */
	description: string;
	/** The next step as a link or a button. */
	action?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Empty>, "children">) {
	return (
		<Empty data-slot="empty-state" {...props}>
			<Illustration name={illustration} />
			<EmptyHeader>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{action}
		</Empty>
	);
}
