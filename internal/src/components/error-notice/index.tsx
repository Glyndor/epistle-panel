"use client";

import { Button } from "@/components/ui/button";
import { PUBLIC_ROUTES } from "@/lib/routes";

/** Text of an {@link ErrorNotice}, already translated by the caller. */
export interface ErrorNoticeLabels {
	heading: string;
	body: string;
	retry: string;
	home: string;
}

/**
 * Body of the error pages: what failed in plain words, a button that asks Next
 * to render the segment again and a link back to the start. It styles
 * itself with classes only, because `style-src 'self'` refuses inline styles,
 * and it never shows the error's message or digest, which can carry internals.
 */
export function ErrorNotice({
	labels,
	onRetry,
}: {
	labels: ErrorNoticeLabels;
	onRetry: () => void;
}) {
	return (
		<main
			id="main-content"
			className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-8"
		>
			<h1 className="font-semibold text-3xl">{labels.heading}</h1>
			<p role="alert" className="text-muted-foreground">
				{labels.body}
			</p>
			<div className="flex items-center gap-4">
				<Button type="button" onClick={onRetry}>
					{labels.retry}
				</Button>
				<Button asChild variant="link">
					<a href={PUBLIC_ROUTES.root}>{labels.home}</a>
				</Button>
			</div>
		</main>
	);
}
