import { cn } from "@/lib/class-names";
import { copyrightNotice } from "@/lib/config/copyright-notice";

/**
 * The line at the foot of the pages: small and quiet. It is the panel's own
 * notice, the one the operator chose, or nothing at all when the operator
 * asked for no line (a white label shows no notice of another company).
 */
export function CopyrightNotice({ className }: { className?: string }) {
	const notice = copyrightNotice();
	if (notice === null) {
		return null;
	}
	return (
		<small
			className={cn("[overflow-wrap:anywhere]", className)}
			data-slot="copyright-notice"
		>
			{notice}
		</small>
	);
}
