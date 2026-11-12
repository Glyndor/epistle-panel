import { COPYRIGHT_NOTICE } from "@/features/branding/copyright";

/** The original copyright notice: small and quiet, and always rendered. */
export function CopyrightNotice({ className }: { className?: string }) {
	return (
		<small className={className} data-slot="copyright-notice">
			{COPYRIGHT_NOTICE}
		</small>
	);
}
