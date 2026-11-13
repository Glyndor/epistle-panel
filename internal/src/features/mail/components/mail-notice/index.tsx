import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * The empty, error and waiting states of a pane. `status` is a polite live
 * region for what is only informative (an empty folder, a wait), and the
 * `warning` variant is an alert for a failure; the page's own texts arrive
 * already translated.
 */
export function MailNotice({
	tone,
	children,
	action,
}: {
	tone: "empty" | "loading" | "error";
	children: React.ReactNode;
	action?: React.ReactNode;
}) {
	if (tone === "error") {
		return (
			<div className="p-3">
				<Alert variant="warning">
					<AlertDescription>{children}</AlertDescription>
					{action}
				</Alert>
			</div>
		);
	}
	return (
		<div
			role="status"
			aria-busy={tone === "loading" ? "true" : undefined}
			className="flex flex-col items-start gap-2 p-4 text-muted-foreground text-sm"
		>
			<p>{children}</p>
			{action}
		</div>
	);
}
