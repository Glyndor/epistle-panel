/**
 * Notice shown when the mail server's management API cannot be reached or
 * returns an unexpected response. Rendered as an alert so assistive tech
 * announces it; copy never carries error internals.
 */
export function UnreachableNotice({ message }: { message: string }) {
	return (
		<p
			role="alert"
			className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
		>
			{message}
		</p>
	);
}
