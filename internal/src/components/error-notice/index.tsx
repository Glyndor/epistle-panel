"use client";

/** Text of an {@link ErrorNotice}, already translated by the caller. */
export interface ErrorNoticeLabels {
	heading: string;
	body: string;
	retry: string;
	home: string;
}

/**
 * Body of the error pages: what failed in plain words, a button that asks Next
 * to render the segment again and a link back to the status page. It styles
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
			<p role="alert" className="text-zinc-500 dark:text-zinc-400">
				{labels.body}
			</p>
			<div className="flex items-center gap-4">
				<button
					type="button"
					onClick={onRetry}
					className="rounded bg-zinc-900 px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:bg-zinc-100 dark:text-zinc-900"
				>
					{labels.retry}
				</button>
				<a
					href="/"
					className="text-sm text-zinc-600 underline hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-100"
				>
					{labels.home}
				</a>
			</div>
		</main>
	);
}
